"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibPeran } from "@/lib/otorisasi";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import {
  muatKebijakan,
  muatRpkps,
  keRpkpsInput,
  saringSubCpmkMilikRpkps,
} from "@/lib/rpkps/muat";
import { bekukanRpkps } from "@/lib/rpkps/snapshot";
import { susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { validasiRpkps } from "@/domain/rpkps/validator";
import { MIN_CATATAN_REVISI } from "@/domain/rpkps/tipe";
import type { KategoriWaktu } from "@/generated/prisma";

export type Hasil = { ok: boolean; pesan: string; id?: string };

/** Memastikan pengguna berwenang atas RPKPS tertentu. Aturannya di lib/rpkps/wenang.ts. */
const pastikanWenang = wenangRpkps;

/**
 * Membuat RPKPS baru dan langsung MENYUSUN KERANGKANYA:
 * 16 pertemuan bernomor, minggu ujian di posisi yang benar, alokasi waktu
 * terisi sesuai pagu, dan Sub-CPMK dari kurikulum tersebar berurutan.
 *
 * Ini yang menghilangkan "halaman kosong" — hambatan terbesar dosen. Dosen
 * mulai dari kerangka yang sudah konsisten, bukan dari tabel kosong.
 */
export async function buatRpkps(
  mataKuliahId: string,
  tahunAkademikId: string,
): Promise<Hasil> {
  const sesi = await wajibPeran("ADMIN", "KAPRODI", "KOORDINATOR_MK", "DOSEN");

  const mk = await prisma.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    include: {
      kurikulum: { select: { prodiId: true, status: true } },
      cpmk: { orderBy: { urutan: "asc" }, include: { subCpmk: { orderBy: { urutan: "asc" } } } },
    },
  });
  if (!mk) return { ok: false, pesan: "Mata kuliah tidak ditemukan." };

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(mk.kurikulum.prodiId)) {
    return { ok: false, pesan: "Anda tidak berwenang atas program studi tersebut." };
  }

  const sudahAda = await prisma.rpkps.findFirst({
    where: { mataKuliahId, tahunAkademikId },
    select: { id: true },
  });
  if (sudahAda) {
    return { ok: false, pesan: "RPKPS untuk mata kuliah dan tahun akademik ini sudah ada.", id: sudahAda.id };
  }

  const { kebijakan } = await muatKebijakan();
  const rencana = susunRencanaSemester(kebijakan, {
    sksTeori: mk.sksTeori,
    sksPraktik: mk.sksPraktik,
    bentukTeori: mk.bentukTeori,
    bentukPraktik: mk.bentukPraktik,
  });

  const semuaSubCpmk = mk.cpmk.flatMap((c) => c.subCpmk);
  const mingguEfektif = rencana.minggu.filter((m) => m.jenis === "EFEKTIF");

  const id = await prisma.$transaction(async (tx) => {
    const rpkps = await tx.rpkps.create({
      data: {
        mataKuliahId,
        tahunAkademikId,
        status: "DRAF",
        deskripsi: mk.deskripsi,
        pengampu: {
          create: { penggunaId: sesi.id, peran: "KOORDINATOR", urutan: 0 },
        },
        komponenNilai: {
          create: [
            { nama: "Ujian Tengah Semester", bobot: 15, urutan: 0 },
            { nama: "Ujian Akhir Semester", bobot: 20, urutan: 1 },
            { nama: "Kehadiran / Kuis", bobot: 10, urutan: 2 },
            { nama: "Praktik / Tugas", bobot: 30, urutan: 3 },
            { nama: "Presentasi", bobot: 15, urutan: 4 },
            { nama: "Tugas Kelompok", bobot: 10, urutan: 5 },
          ],
        },
      },
      select: { id: true },
    });

    for (const m of rencana.minggu) {
      const ujian = m.jenis === "UJIAN";
      const indeks = mingguEfektif.findIndex((x) => x.minggu === m.minggu);
      // Sub-CPMK dibagikan berurutan, satu per pertemuan efektif.
      const sub = !ujian && indeks >= 0 ? semuaSubCpmk[indeks] : undefined;

      const aktivitas: { nama: string; kategori: KategoriWaktu; menit: number; urutan: number }[] = [];
      if (m.pagu.tm > 0) {
        aktivitas.push({
          nama: ujian ? "Pelaksanaan ujian" : "Tatap muka",
          kategori: "TM",
          menit: m.pagu.tm,
          urutan: 0,
        });
      }
      if (m.pagu.pt > 0) {
        aktivitas.push({ nama: "Penugasan terstruktur", kategori: "PT", menit: m.pagu.pt, urutan: 1 });
      }
      if (m.pagu.bm > 0) {
        aktivitas.push({
          nama: ujian ? "Persiapan ujian" : "Belajar mandiri",
          kategori: "BM",
          menit: m.pagu.bm,
          urutan: 2,
        });
      }

      await tx.pertemuan.create({
        data: {
          rpkpsId: rpkps.id,
          minggu: m.minggu,
          jenis: ujian ? (m.minggu < kebijakan.mingguPerSemester ? "UTS" : "UAS") : "EFEKTIF",
          topik: ujian
            ? m.minggu < kebijakan.mingguPerSemester
              ? "Ujian Tengah Semester"
              : "Ujian Akhir Semester"
            : null,
          subtopik: [],
          bobot: 0,
          aktivitas: { create: aktivitas },
          ...(sub ? { subCpmk: { create: { subCpmkId: sub.id } } } : {}),
        },
      });
    }

    await tx.rpkpsRiwayat.create({
      data: {
        rpkpsId: rpkps.id,
        versi: 1,
        status: "DRAF",
        deskripsi: `Kerangka dibuat otomatis: ${rencana.minggu.length} pertemuan, ${semuaSubCpmk.length} Sub-CPMK terjadwal`,
        olehId: sesi.id,
      },
    });

    await tx.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "RPKPS_DIBUAT",
        entitas: "rpkps",
        entitasId: rpkps.id,
        ringkasan: `${sesi.email} membuat RPKPS ${mk.kode}`,
      },
    });

    return rpkps.id;
  });

  revalidatePath("/rpkps");
  return { ok: true, pesan: "RPKPS dibuat beserta kerangka mingguannya.", id };
}

const SkemaIdentitas = z.object({
  deskripsi: z.string().trim().max(4000).nullable(),
  kalimatPembukaCpmk: z.string().trim().max(1000).nullable(),
  ambangKelulusanMhs: z.number().min(0).max(100),
  ambangKetercapaianMk: z.number().min(0).max(100),
  minimalKehadiranPersen: z.number().int().min(0).max(100),
});

export async function perbaruiIdentitas(id: string, data: FormData): Promise<Hasil> {
  const { boleh, sesi } = await pastikanWenang(id);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang mengubah RPKPS ini." };

  const kosongJadiNull = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };

  const parsed = SkemaIdentitas.safeParse({
    deskripsi: kosongJadiNull(data.get("deskripsi")),
    kalimatPembukaCpmk: kosongJadiNull(data.get("kalimatPembukaCpmk")),
    ambangKelulusanMhs: Number(data.get("ambangKelulusanMhs")),
    ambangKetercapaianMk: Number(data.get("ambangKetercapaianMk")),
    minimalKehadiranPersen: Number(data.get("minimalKehadiranPersen")),
  });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  await prisma.rpkps.update({ where: { id }, data: parsed.data });
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "RPKPS_DIPERBARUI",
      entitas: "rpkps",
      entitasId: id,
      ringkasan: `${sesi.email} memperbarui identitas RPKPS`,
    },
  });

  revalidatePath(`/rpkps/${id}`);
  return { ok: true, pesan: "Tersimpan." };
}

const SkemaPertemuan = z.object({
  topik: z.string().trim().max(500).nullable(),
  subtopik: z.array(z.string().trim().min(1)).max(30),
  metodeNarasi: z.string().trim().max(4000).nullable(),
  aktivitasDosen: z.string().trim().max(2000).nullable(),
  aktivitasMahasiswa: z.string().trim().max(2000).nullable(),
  tugasTerstruktur: z.string().trim().max(2000).nullable(),
  penilaianJenis: z.string().trim().max(500).nullable(),
  penilaianSistem: z.string().trim().max(1000).nullable(),
  bobot: z.number().min(0).max(100),
  /// Komponen nilai yang menampung bobot pertemuan ini. Dipakai untuk
  /// menyusun tabel distribusi penilaian (bagian E template ITTS).
  komponenNilaiId: z.string().nullable(),
  subCpmkId: z.array(z.string()).max(10),
  indikator: z.array(z.string().trim().min(1)).max(20),
  aktivitas: z
    .array(
      z.object({
        nama: z.string().trim().min(1),
        kategori: z.enum(["TM", "PT", "BM"]),
        menit: z.number().int().min(0).max(2000),
      }),
    )
    .max(30),
  pustakaId: z.array(z.string()).max(20),
});

export type IsiPertemuan = z.infer<typeof SkemaPertemuan>;

export async function simpanPertemuan(
  pertemuanId: string,
  isi: IsiPertemuan,
): Promise<Hasil> {
  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: pertemuanId },
    select: { id: true, rpkpsId: true, minggu: true },
  });
  if (!pertemuan) return { ok: false, pesan: "Pertemuan tidak ditemukan." };

  const { boleh, sesi } = await pastikanWenang(pertemuan.rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang mengubah RPKPS ini." };

  const parsed = SkemaPertemuan.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const d = parsed.data;

  // Sub-CPMK harus benar-benar milik mata kuliah ini — data dari klien
  // tidak dipercaya begitu saja.
  const { sah: subCpmkSah, asing } = await saringSubCpmkMilikRpkps(
    pertemuan.rpkpsId,
    d.subCpmkId,
  );
  if (asing.length > 0) {
    return { ok: false, pesan: "Ada Sub-CPMK di luar mata kuliah RPKPS ini." };
  }

  // Anak-anak pertemuan diganti seluruhnya, bukan di-diff: jumlahnya kecil dan
  // penggantian utuh menghindari kondisi balapan saat dua tab terbuka.
  await prisma.$transaction([
    prisma.pertemuan.update({
      where: { id: pertemuanId },
      data: {
        topik: d.topik,
        subtopik: d.subtopik,
        metodeNarasi: d.metodeNarasi,
        aktivitasDosen: d.aktivitasDosen,
        aktivitasMahasiswa: d.aktivitasMahasiswa,
        tugasTerstruktur: d.tugasTerstruktur,
        penilaianJenis: d.penilaianJenis,
        penilaianSistem: d.penilaianSistem,
        bobot: d.bobot,
        komponenNilaiId: d.komponenNilaiId,
      },
    }),
    prisma.aktivitasBelajar.deleteMany({ where: { pertemuanId } }),
    prisma.aktivitasBelajar.createMany({
      data: d.aktivitas.map((a, i) => ({
        pertemuanId,
        nama: a.nama,
        kategori: a.kategori,
        menit: a.menit,
        urutan: i,
      })),
    }),
    prisma.indikator.deleteMany({ where: { pertemuanId } }),
    prisma.indikator.createMany({
      data: d.indikator.map((teks, i) => ({ pertemuanId, teks, urutan: i })),
    }),
    prisma.pertemuanSubCpmk.deleteMany({ where: { pertemuanId } }),
    prisma.pertemuanSubCpmk.createMany({
      data: subCpmkSah.map((subCpmkId) => ({ pertemuanId, subCpmkId })),
    }),
    prisma.pertemuanPustaka.deleteMany({ where: { pertemuanId } }),
    prisma.pertemuanPustaka.createMany({
      data: d.pustakaId.map((pustakaId) => ({ pertemuanId, pustakaId })),
    }),
  ]);

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PERTEMUAN_DISIMPAN",
      entitas: "pertemuan",
      entitasId: pertemuanId,
      ringkasan: `${sesi.email} menyimpan minggu ${pertemuan.minggu}`,
    },
  });

  revalidatePath(`/rpkps/${pertemuan.rpkpsId}`);
  revalidatePath(`/rpkps/${pertemuan.rpkpsId}/mingguan`);
  return { ok: true, pesan: `Minggu ${pertemuan.minggu} tersimpan.` };
}

export async function tambahPustaka(
  rpkpsId: string,
  jenis: "UTAMA" | "PENDUKUNG" | "DARING" | "TOOLS",
  teks: string,
  url?: string,
): Promise<Hasil> {
  const { boleh } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };
  if (teks.trim().length < 5) return { ok: false, pesan: "Teks pustaka terlalu pendek." };

  const terakhir = await prisma.pustaka.findFirst({
    where: { rpkpsId, jenis },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });

  await prisma.pustaka.create({
    data: {
      rpkpsId,
      jenis,
      nomor: (terakhir?.nomor ?? 0) + 1,
      teks: teks.trim(),
      url: url?.trim() || null,
    },
  });

  revalidatePath(`/rpkps/${rpkpsId}`);
  return { ok: true, pesan: "Pustaka ditambahkan." };
}

export async function hapusPustaka(pustakaId: string): Promise<Hasil> {
  const p = await prisma.pustaka.findUnique({
    where: { id: pustakaId },
    select: { id: true, rpkpsId: true },
  });
  if (!p) return { ok: false, pesan: "Pustaka tidak ditemukan." };

  const { boleh } = await pastikanWenang(p.rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };

  await prisma.pustaka.delete({ where: { id: pustakaId } });
  revalidatePath(`/rpkps/${p.rpkpsId}`);
  return { ok: true, pesan: "Pustaka dihapus." };
}

export async function simpanKomponenNilai(
  rpkpsId: string,
  komponen: { nama: string; bobot: number }[],
): Promise<Hasil> {
  const { boleh } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };

  const bersih = komponen
    .map((k) => ({ nama: k.nama.trim(), bobot: Number(k.bobot) }))
    .filter((k) => k.nama.length > 0 && Number.isFinite(k.bobot));

  const nama = bersih.map((k) => k.nama);
  if (new Set(nama).size !== nama.length) {
    return { ok: false, pesan: "Nama komponen nilai tidak boleh berulang." };
  }

  await prisma.$transaction([
    prisma.komponenNilai.deleteMany({ where: { rpkpsId } }),
    prisma.komponenNilai.createMany({
      data: bersih.map((k, i) => ({ rpkpsId, nama: k.nama, bobot: k.bobot, urutan: i })),
    }),
  ]);

  revalidatePath(`/rpkps/${rpkpsId}`);
  return { ok: true, pesan: "Komponen nilai tersimpan." };
}

/** Mengajukan RPKPS untuk disetujui. Divalidasi ulang di server. */
export async function ajukanRpkps(id: string): Promise<Hasil> {
  const { boleh, sesi } = await pastikanWenang(id);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang." };

  const rpkps = await muatRpkps(id);
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan." };
  if (rpkps.status !== "DRAF" && rpkps.status !== "DIREVISI") {
    return { ok: false, pesan: "RPKPS ini sudah diajukan." };
  }

  const { kebijakan } = await muatKebijakan();
  const hasil = validasiRpkps(keRpkpsInput(rpkps), kebijakan);
  if (!hasil.lolos) {
    return {
      ok: false,
      pesan: `Masih ada ${hasil.pemblokir.length} temuan pemblokir. Perbaiki lebih dulu.`,
    };
  }

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status: "DIAJUKAN" } }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status: "DIAJUKAN",
        deskripsi: "Diajukan untuk pengesahan",
        olehId: sesi.id,
      },
    }),
  ]);

  revalidatePath(`/rpkps/${id}`);
  revalidatePath("/rpkps");
  return { ok: true, pesan: "RPKPS diajukan." };
}

export async function putuskanRpkps(
  id: string,
  keputusan: "SETUJU" | "REVISI",
  catatan?: string,
): Promise<Hasil> {
  /**
   * `wenang.pengelola` — bukan sekadar `punyaPeran(KAPRODI)`. Peran saja tidak
   * menyebut prodi mana; tanpa cakupan, Kaprodi prodi A dapat mengesahkan
   * dokumen prodi B hanya dengan menebak alamatnya.
   */
  const { pengelola, sesi } = await pastikanWenang(id);
  if (!pengelola) {
    return {
      ok: false,
      pesan: "Hanya Kaprodi, penjaminan mutu, atau admin program studi ini yang dapat memutuskan.",
    };
  }

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: { id: true, status: true, versi: true },
  });
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan." };
  if (rpkps.status !== "DIAJUKAN") {
    return { ok: false, pesan: "Hanya RPKPS berstatus diajukan yang dapat diputuskan." };
  }

  /**
   * Catatan WAJIB saat mengembalikan untuk revisi.
   *
   * Diperiksa di sini, bukan hanya di dialog: aksi ini dapat dipanggil
   * langsung, dan catatan kosong menghasilkan baris histori "Dikembalikan
   * untuk revisi" tanpa keterangan — dosen tidak punya petunjuk apa pun
   * tentang apa yang harus diperbaiki.
   */
  const catatanBersih = catatan?.trim() ?? "";
  if (keputusan === "REVISI" && catatanBersih.length < MIN_CATATAN_REVISI) {
    return {
      ok: false,
      pesan: `Catatan revisi wajib diisi, minimal ${MIN_CATATAN_REVISI} karakter — sebutkan bagian mana yang harus diperbaiki.`,
    };
  }

  const status = keputusan === "SETUJU" ? "TERBIT" : "DIREVISI";

  // Membekukan isi dokumen SEBELUM status berubah. Setelah ini, perubahan
  // pada kurikulum tidak lagi mengubah berkas yang sudah disahkan.
  let sidik: string | null = null;
  if (keputusan === "SETUJU") {
    const lengkap = await muatRpkps(id);
    if (!lengkap) return { ok: false, pesan: "RPKPS tidak ditemukan." };
    ({ sidik } = await bekukanRpkps(lengkap, sesi.id));
  }

  await prisma.$transaction([
    prisma.rpkps.update({
      where: { id },
      data: { status, ...(keputusan === "REVISI" ? { versi: rpkps.versi + 1 } : {}) },
    }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status,
        deskripsi:
          keputusan === "SETUJU"
            ? `Disetujui dan diterbitkan (sidik ${sidik?.slice(0, 16)})`
            : `Dikembalikan untuk revisi: ${catatanBersih}`,
        olehId: sesi.id,
      },
    }),
  ]);

  revalidatePath(`/rpkps/${id}`);
  revalidatePath("/rpkps");
  return {
    ok: true,
    pesan: keputusan === "SETUJU" ? "RPKPS diterbitkan." : "Dikembalikan untuk revisi.",
  };
}
