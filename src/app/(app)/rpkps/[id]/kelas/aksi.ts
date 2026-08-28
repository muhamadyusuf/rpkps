"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import { muatRpkps } from "@/lib/rpkps/muat";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { bacaNilai, bacaSkorButir, type HasilBacaNilai } from "@/domain/evaluasi/nilai";
import { bacaBerkasButir, bacaBerkasNilai } from "@/lib/evaluasi/excel-nilai";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import { simpanNilaiKelas, simpanSkorButir } from "@/lib/evaluasi/nilai-inti";

export type Hasil = { ok: boolean; pesan: string; id?: string };

export type HasilUnggah = Hasil & {
  temuan?: HasilBacaNilai["temuan"];
  ringkasan?: HasilBacaNilai["ringkasan"] & {
    pesertaBaru: number;
    tidakDiberkas: number;
    /** Skor per butir ujian yang ikut terbaca; 0 berarti lembarnya kosong. */
    skorButir: number;
  };
};

/**
 * Wewenang untuk urusan kelas dan nilai.
 *
 * BEDA dengan penyuntingan RPKPS: nilai justru masuk SETELAH dokumen terbit,
 * saat semester berjalan dan berakhir. Karena itu status TERBIT tidak
 * menghalangi — yang dijaga adalah cakupan prodi dan kepengampuan.
 */
const pastikanWenang = wenangRpkps;

const SkemaKelas = z.object({
  kode: z
    .string()
    .trim()
    .min(1, "Kode kelas wajib diisi.")
    .max(20, "Kode kelas terlalu panjang."),
  dosenId: z.string().nullable(),
});

export async function buatKelas(
  rpkpsId: string,
  masukan: z.input<typeof SkemaKelas>,
): Promise<Hasil> {
  const { boleh } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Tidak berwenang." };

  const urai = SkemaKelas.safeParse(masukan);
  if (!urai.success) {
    return { ok: false, pesan: urai.error.issues[0]?.message ?? "Masukan tidak sah." };
  }

  const sudahAda = await prisma.kelas.findUnique({
    where: { rpkpsId_kode: { rpkpsId, kode: urai.data.kode } },
    select: { id: true },
  });
  if (sudahAda) return { ok: false, pesan: `Kelas ${urai.data.kode} sudah ada.` };

  const kelas = await prisma.kelas.create({
    data: { rpkpsId, kode: urai.data.kode, dosenId: urai.data.dosenId },
    select: { id: true },
  });

  revalidatePath(`/rpkps/${rpkpsId}/kelas`);
  return { ok: true, pesan: `Kelas ${urai.data.kode} dibuat.`, id: kelas.id };
}

export async function hapusKelas(kelasId: string): Promise<Hasil> {
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    select: {
      rpkpsId: true,
      kode: true,
      peserta: { select: { _count: { select: { nilai: true } } } },
    },
  });
  if (!kelas) return { ok: false, pesan: "Kelas tidak ditemukan." };

  const { boleh } = await pastikanWenang(kelas.rpkpsId);
  if (!boleh) return { ok: false, pesan: "Tidak berwenang." };

  // Nilai adalah bukti pelaksanaan. Menghapus kelas berisi nilai akan
  // melenyapkannya lewat cascade — tanpa jejak, dan tanpa cara memulihkan.
  const jumlahNilai = kelas.peserta.reduce((s, p) => s + p._count.nilai, 0);
  if (jumlahNilai > 0) {
    return {
      ok: false,
      pesan: `Kelas ${kelas.kode} sudah memuat ${jumlahNilai} nilai dan tidak dapat dihapus.`,
    };
  }

  await prisma.kelas.delete({ where: { id: kelasId } });
  revalidatePath(`/rpkps/${kelas.rpkpsId}/kelas`);
  return { ok: true, pesan: `Kelas ${kelas.kode} dihapus.` };
}

const UKURAN_MAKS = 5 * 1024 * 1024;

export async function unggahNilai(
  kelasId: string,
  formData: FormData,
): Promise<HasilUnggah> {
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    select: { id: true, kode: true, rpkpsId: true },
  });
  if (!kelas) return { ok: false, pesan: "Kelas tidak ditemukan." };

  const { boleh, prodiId } = await pastikanWenang(kelas.rpkpsId);
  if (!boleh || !prodiId) return { ok: false, pesan: "Tidak berwenang." };

  const berkas = formData.get("berkas");
  if (!(berkas instanceof File) || berkas.size === 0) {
    return { ok: false, pesan: "Berkas belum dipilih." };
  }
  if (berkas.size > UKURAN_MAKS) {
    return { ok: false, pesan: "Berkas melebihi 5 MB." };
  }

  const rpkps = await muatRpkps(kelas.rpkpsId);
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan." };

  const peta = susunPetaAsesmen(keSumberPeta(rpkps));
  if (peta.asesmen.length === 0) {
    return {
      ok: false,
      pesan: "Belum ada asesmen berbobot pada RPKPS ini — templat nilainya kosong.",
    };
  }

  const isiBerkas = await berkas.arrayBuffer();
  let mentah;
  try {
    mentah = await bacaBerkasNilai(isiBerkas);
  } catch {
    return { ok: false, pesan: "Berkas tidak dapat dibaca sebagai XLSX." };
  }

  const hasil = bacaNilai(mentah, peta.asesmen);
  if (!hasil.lolos) {
    return {
      ok: false,
      pesan: `${hasil.pemblokir.length} masalah pada berkas — tidak ada nilai yang disimpan.`,
      temuan: hasil.temuan,
    };
  }

  const simpan = await simpanNilaiKelas(prisma, {
    kelasId,
    prodiId,
    baris: hasil.baris,
    kolomDikenal: hasil.ringkasan.kolomDikenal,
  });

  // Lembar butir bersifat opsional — berkas tanpa lembar itu bukan berkas
  // yang salah, dan capaian tetap terhitung penuh tanpanya.
  const temuanButir: TemuanRpkps[] = [];
  let skorButir = 0;
  for (const kisi of rpkps.kisiKisi) {
    const barisButir = await bacaBerkasButir(isiBerkas, kisi.jenis);
    if (barisButir.length === 0) continue;

    const acuan = kisi.butir.map((b) => ({ nomor: b.nomor, skorMaks: Number(b.skor) }));
    const dibaca = bacaSkorButir(barisButir, acuan, kisi.jenis);
    temuanButir.push(...dibaca.temuan);
    if (!dibaca.lolos) continue;

    const hasilButir = await simpanSkorButir(prisma, {
      kelasId,
      butirId: new Map(kisi.butir.map((b) => [b.nomor, b.id])),
      peserta: dibaca.peserta,
    });
    skorButir += hasilButir.skorDisimpan;

    if (hasilButir.nimTakDikenal.length > 0) {
      temuanButir.push({
        kode: "BT-NIM-ASING",
        tingkat: "PERINGATAN",
        pesan:
          `${hasilButir.nimTakDikenal.length} NIM pada lembar butir ${kisi.jenis} ` +
          `tidak terdaftar di kelas ini dan dilewati.`,
      });
    }
  }

  const seluruhPeserta = await prisma.pesertaKelas.count({ where: { kelasId } });

  revalidatePath(`/rpkps/${kelas.rpkpsId}/kelas`);
  return {
    ok: true,
    pesan:
      `${hasil.baris.length} baris tersimpan untuk kelas ${kelas.kode}` +
      (skorButir > 0 ? `, termasuk ${skorButir} skor per butir.` : "."),
    temuan: [...hasil.temuan, ...temuanButir],
    ringkasan: {
      ...hasil.ringkasan,
      pesertaBaru: simpan.pesertaBaru,
      // Peserta lama yang tidak ada di berkas TIDAK dihapus: menghilangkan
      // mahasiswa dari daftar akan menghapus nilainya lewat cascade.
      tidakDiberkas: seluruhPeserta - hasil.baris.length,
      skorButir,
    },
  };
}
