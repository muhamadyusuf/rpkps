"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { muatRpkps, namaLengkapPengampu } from "@/lib/rpkps/muat";
import { muatKelasEvaluasi } from "@/lib/evaluasi/muat";
import {
  bukaKembaliEvaluasi,
  muatAtauBuatEvaluasi,
  tutupEvaluasi as tutupDiBasisData,
} from "@/lib/evaluasi/evaluasi-inti";
import { keSumberPeta, kePesertaCapaian } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { hitungCapaian } from "@/domain/evaluasi/capaian";
import { periksaPenutupan, periksaTemuan } from "@/domain/evaluasi/tindak-lanjut";
import { proyeksiEvaluasi, sidikEvaluasi } from "@/domain/evaluasi/proyeksi";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";

export type Hasil = { ok: boolean; pesan: string; temuan?: TemuanRpkps[] };

async function pastikanWenang(kelasId: string) {
  const sesi = await wajibAktif();
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    select: {
      id: true,
      rpkpsId: true,
      rpkps: {
        select: {
          mataKuliah: { select: { kurikulum: { select: { prodiId: true } } } },
          pengampu: { select: { penggunaId: true, peran: true } },
        },
      },
    },
  });
  if (!kelas) return { sesi, kelas: null, boleh: false };

  return { sesi, kelas, boleh: wenangAtasRpkps(sesi, kelas.rpkps).boleh };
}

/** Menghitung ulang capaian dari data terkini. Dipakai aksi mana pun yang butuh angka. */
async function hitungDariBasisData(kelasId: string) {
  const kelas = await muatKelasEvaluasi(kelasId);
  if (!kelas) return null;

  const rpkps = await muatRpkps(kelas.rpkps.id);
  if (!rpkps) return null;

  const peta = susunPetaAsesmen(keSumberPeta(rpkps));
  const evaluasi = kelas.evaluasi;

  const hasil = hitungCapaian({
    asesmen: peta.asesmen,
    cpmk: rpkps.mataKuliah.cpmk.map((c) => ({
      kode: c.kode,
      subCpmkKode: c.subCpmk.map((s) => s.kode),
      cplKode: c.cpl.map((m) => m.cpl.kode),
    })),
    cplDibebankan: rpkps.mataKuliah.cpl.map((m) => m.cpl.kode),
    peserta: kePesertaCapaian(kelas.peserta, peta.asesmen.map((a) => a.kode)),
    ambangKelulusanMhs: Number(evaluasi?.ambangKelulusanMhs ?? rpkps.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(evaluasi?.ambangKetercapaianMk ?? rpkps.ambangKetercapaianMk),
  });

  return { kelas, rpkps, peta, hasil };
}

async function pastikanEvaluasi(kelasId: string) {
  const konteks = await hitungDariBasisData(kelasId);
  if (!konteks) return null;
  const evaluasi = await muatAtauBuatEvaluasi(prisma, kelasId, {
    kelulusanMhs: Number(konteks.rpkps.ambangKelulusanMhs),
    ketercapaianMk: Number(konteks.rpkps.ambangKetercapaianMk),
  });
  return { ...konteks, evaluasi };
}

const SkemaCatatan = z.object({
  catatanProses: z.string().trim().max(4000),
});

export async function simpanCatatanProses(
  kelasId: string,
  masukan: z.input<typeof SkemaCatatan>,
): Promise<Hasil> {
  const { boleh, kelas } = await pastikanWenang(kelasId);
  if (!boleh || !kelas) return { ok: false, pesan: "Tidak berwenang." };

  const urai = SkemaCatatan.safeParse(masukan);
  if (!urai.success) return { ok: false, pesan: "Catatan terlalu panjang." };

  const konteks = await pastikanEvaluasi(kelasId);
  if (!konteks) return { ok: false, pesan: "Kelas tidak ditemukan." };
  if (konteks.evaluasi.status === "DITUTUP") {
    return { ok: false, pesan: "Evaluasi sudah ditutup — buka kembali lebih dulu." };
  }

  await prisma.evaluasiMk.update({
    where: { id: konteks.evaluasi.id },
    data: { catatanProses: urai.data.catatanProses || null, status: "DIHITUNG" },
  });

  revalidatePath(`/rpkps/${kelas.rpkpsId}/kelas/${kelasId}`);
  return { ok: true, pesan: "Catatan proses tersimpan." };
}

const SkemaTemuan = z.object({
  tingkat: z.enum(["SUB_CPMK", "CPMK", "CPL"]),
  kode: z.string().trim().min(1),
  akarMasalah: z.string().trim(),
  tindakan: z.string().trim(),
  penanggungJawabId: z.string().nullable(),
  taSasaranId: z.string().nullable(),
});

export async function simpanTemuan(
  kelasId: string,
  masukan: z.input<typeof SkemaTemuan>,
): Promise<Hasil> {
  const { boleh, kelas } = await pastikanWenang(kelasId);
  if (!boleh || !kelas) return { ok: false, pesan: "Tidak berwenang." };

  const urai = SkemaTemuan.safeParse(masukan);
  if (!urai.success) {
    return { ok: false, pesan: urai.error.issues[0]?.message ?? "Masukan tidak sah." };
  }

  const cacat = periksaTemuan(urai.data);
  if (cacat.length > 0) {
    return { ok: false, pesan: cacat[0].pesan, temuan: cacat };
  }

  const konteks = await pastikanEvaluasi(kelasId);
  if (!konteks) return { ok: false, pesan: "Kelas tidak ditemukan." };
  if (konteks.evaluasi.status === "DITUTUP") {
    return { ok: false, pesan: "Evaluasi sudah ditutup — buka kembali lebih dulu." };
  }

  const butir = konteks.hasil.butir.find(
    (b) => b.tingkat === urai.data.tingkat && b.kode === urai.data.kode,
  );

  await prisma.temuanEvaluasi.upsert({
    where: {
      evaluasiId_tingkat_kode: {
        evaluasiId: konteks.evaluasi.id,
        tingkat: urai.data.tingkat,
        kode: urai.data.kode,
      },
    },
    create: {
      evaluasiId: konteks.evaluasi.id,
      tingkat: urai.data.tingkat,
      kode: urai.data.kode,
      capaianTerukur: butir?.persenLulus ?? null,
      akarMasalah: urai.data.akarMasalah,
      tindakan: urai.data.tindakan,
      penanggungJawabId: urai.data.penanggungJawabId,
      taSasaranId: urai.data.taSasaranId,
    },
    update: {
      akarMasalah: urai.data.akarMasalah,
      tindakan: urai.data.tindakan,
      penanggungJawabId: urai.data.penanggungJawabId,
      taSasaranId: urai.data.taSasaranId,
    },
  });

  revalidatePath(`/rpkps/${kelas.rpkpsId}/kelas/${kelasId}`);
  return { ok: true, pesan: `Tindak lanjut ${urai.data.kode} tersimpan.` };
}

export async function hapusTemuan(temuanId: string): Promise<Hasil> {
  const temuan = await prisma.temuanEvaluasi.findUnique({
    where: { id: temuanId },
    select: { kode: true, evaluasi: { select: { status: true, kelasId: true, kelas: { select: { rpkpsId: true } } } } },
  });
  if (!temuan) return { ok: false, pesan: "Temuan tidak ditemukan." };

  const { boleh } = await pastikanWenang(temuan.evaluasi.kelasId);
  if (!boleh) return { ok: false, pesan: "Tidak berwenang." };
  if (temuan.evaluasi.status === "DITUTUP") {
    return { ok: false, pesan: "Evaluasi sudah ditutup — buka kembali lebih dulu." };
  }

  await prisma.temuanEvaluasi.delete({ where: { id: temuanId } });
  revalidatePath(`/rpkps/${temuan.evaluasi.kelas.rpkpsId}/kelas/${temuan.evaluasi.kelasId}`);
  return { ok: true, pesan: `Tindak lanjut ${temuan.kode} dihapus.` };
}

export async function tutupEvaluasi(kelasId: string): Promise<Hasil> {
  const { boleh, kelas, sesi } = await pastikanWenang(kelasId);
  if (!boleh || !kelas) return { ok: false, pesan: "Tidak berwenang." };

  const konteks = await pastikanEvaluasi(kelasId);
  if (!konteks) return { ok: false, pesan: "Kelas tidak ditemukan." };
  if (konteks.evaluasi.status === "DITUTUP") {
    return { ok: false, pesan: "Evaluasi sudah ditutup." };
  }

  const syarat = periksaPenutupan({
    butir: konteks.hasil.butir,
    temuan: konteks.evaluasi.temuan.map((t) => ({
      tingkat: t.tingkat,
      kode: t.kode,
      akarMasalah: t.akarMasalah,
      tindakan: t.tindakan,
      taSasaranId: t.taSasaranId,
    })),
    catatanProses: konteks.evaluasi.catatanProses,
    pemblokirCapaian: konteks.hasil.pemblokir,
  });

  if (!syarat.dapatDitutup) {
    return {
      ok: false,
      pesan: `${syarat.pemblokir.length} syarat belum terpenuhi — evaluasi tidak ditutup.`,
      temuan: syarat.temuan,
    };
  }

  const sumberProyeksi = {
    mk: { kode: konteks.rpkps.mataKuliah.kode, nama: konteks.rpkps.mataKuliah.nama },
    tahunAkademik: konteks.rpkps.tahunAkademik.kode,
    kelas: konteks.kelas.kode,
    dosen: konteks.kelas.dosen?.nama ?? null,
    ambangKelulusanMhs: Number(konteks.evaluasi.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(konteks.evaluasi.ambangKetercapaianMk),
    catatanProses: konteks.evaluasi.catatanProses,
    asesmen: konteks.peta.asesmen,
    butir: konteks.hasil.butir,
    mahasiswa: konteks.hasil.mahasiswa,
    temuan: konteks.evaluasi.temuan.map((t) => ({
      tingkat: t.tingkat,
      kode: t.kode,
      capaianTerukur: t.capaianTerukur === null ? null : Number(t.capaianTerukur),
      akarMasalah: t.akarMasalah,
      tindakan: t.tindakan,
      penanggungJawab: t.penanggungJawab?.nama ?? null,
      taSasaran: t.taSasaran?.kode ?? null,
    })),
  };

  await tutupDiBasisData(prisma, {
    evaluasiId: konteks.evaluasi.id,
    butir: konteks.hasil.butir,
    isi: proyeksiEvaluasi(sumberProyeksi),
    sidik: sidikEvaluasi(sumberProyeksi),
    ambang: {
      kelulusanMhs: Number(konteks.evaluasi.ambangKelulusanMhs),
      ketercapaianMk: Number(konteks.evaluasi.ambangKetercapaianMk),
    },
    olehId: sesi.id,
  });

  revalidatePath(`/rpkps/${kelas.rpkpsId}/kelas/${kelasId}`);
  return { ok: true, pesan: "Evaluasi ditutup dan dibekukan.", temuan: syarat.temuan };
}

export async function bukaKembali(kelasId: string): Promise<Hasil> {
  const { boleh, kelas } = await pastikanWenang(kelasId);
  if (!boleh || !kelas) return { ok: false, pesan: "Tidak berwenang." };

  const evaluasi = await prisma.evaluasiMk.findUnique({
    where: { kelasId },
    select: { id: true, status: true },
  });
  if (!evaluasi) return { ok: false, pesan: "Evaluasi belum pernah dibuat." };
  if (evaluasi.status !== "DITUTUP") return { ok: false, pesan: "Evaluasi belum ditutup." };

  const baru = await bukaKembaliEvaluasi(prisma, evaluasi.id);
  revalidatePath(`/rpkps/${kelas.rpkpsId}/kelas/${kelasId}`);
  return {
    ok: true,
    pesan: `Evaluasi dibuka kembali sebagai versi ${baru.versi}. Salinan beku sebelumnya tetap utuh.`,
  };
}

const SkemaVerifikasi = z.object({
  status: z.enum(["TERCAPAI", "TIDAK_TERCAPAI"]),
  catatan: z.string().trim().max(2000),
});

export async function verifikasiTemuan(
  temuanId: string,
  masukan: z.input<typeof SkemaVerifikasi>,
): Promise<Hasil> {
  const urai = SkemaVerifikasi.safeParse(masukan);
  if (!urai.success) return { ok: false, pesan: "Masukan tidak sah." };

  const temuan = await prisma.temuanEvaluasi.findUnique({
    where: { id: temuanId },
    select: { kode: true, evaluasi: { select: { kelasId: true } } },
  });
  if (!temuan) return { ok: false, pesan: "Temuan tidak ditemukan." };

  const { sesi, boleh } = await pastikanWenang(temuan.evaluasi.kelasId);
  if (!boleh) return { ok: false, pesan: "Tidak berwenang." };

  await prisma.temuanEvaluasi.update({
    where: { id: temuanId },
    data: {
      statusVerifikasi: urai.data.status,
      catatanVerifikasi: urai.data.catatan || null,
      diverifikasiPada: new Date(),
      diverifikasiOlehId: sesi.id,
    },
  });

  revalidatePath("/rpkps");
  return { ok: true, pesan: `Tindak lanjut ${temuan.kode} diverifikasi.` };
}

/**
 * Meneruskan temuan menjadi Usulan Revisi Kurikulum.
 *
 * Yang dibuat hanya AMPLOP usulan berstatus draf, bukan butir perubahannya.
 * Sistem tahu ada yang tidak tercapai; ia tidak tahu rumusan penggantinya —
 * itu keputusan dosen, dan doc 04 §2.1 menuntut butir yang dapat diterapkan
 * kode secara deterministik. Temuan ini menjadi DASAR-nya (JenisDasar
 * TEMUAN_EVALUASI, `ref` berisi id temuan).
 */
export async function teruskanKeUsulan(temuanId: string): Promise<Hasil & { id?: string }> {
  const temuan = await prisma.temuanEvaluasi.findUnique({
    where: { id: temuanId },
    include: {
      evaluasi: {
        select: {
          kelasId: true,
          kelas: {
            select: {
              kode: true,
              rpkps: {
                select: {
                  tahunAkademik: { select: { kode: true } },
                  mataKuliah: {
                    select: { id: true, kode: true, nama: true, kurikulumId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!temuan) return { ok: false, pesan: "Temuan tidak ditemukan." };
  if (temuan.usulanId) {
    return { ok: false, pesan: "Temuan ini sudah diteruskan menjadi usulan.", id: temuan.usulanId };
  }

  const { sesi, boleh } = await pastikanWenang(temuan.evaluasi.kelasId);
  if (!boleh) return { ok: false, pesan: "Tidak berwenang." };

  const mk = temuan.evaluasi.kelas.rpkps.mataKuliah;
  const ta = temuan.evaluasi.kelas.rpkps.tahunAkademik.kode;

  const usulan = await prisma.usulanRevisi.create({
    data: {
      kurikulumId: mk.kurikulumId,
      mataKuliahId: mk.id,
      judul: `Tindak lanjut ${temuan.kode} — ${mk.kode} ${ta}`,
      latar:
        `Evaluasi ketercapaian ${mk.kode} kelas ${temuan.evaluasi.kelas.kode} ${ta} ` +
        `menemukan ${temuan.kode} tidak tercapai` +
        (temuan.capaianTerukur === null
          ? ""
          : ` (${Number(temuan.capaianTerukur)}% mahasiswa lulus)`) +
        `.\n\nAkar masalah: ${temuan.akarMasalah}\n\nTindakan yang direncanakan: ${temuan.tindakan}` +
        `\n\nDasar butir: TEMUAN_EVALUASI, ref ${temuan.id}`,
      diajukanOlehId: sesi.id,
    },
    select: { id: true },
  });

  await prisma.temuanEvaluasi.update({
    where: { id: temuanId },
    data: { usulanId: usulan.id },
  });

  revalidatePath("/usulan");
  return {
    ok: true,
    pesan: "Draf usulan revisi dibuat. Lengkapi butir perubahannya di halaman usulan.",
    id: usulan.id,
  };
}

export async function daftarPengampu(rpkpsId: string) {
  const rpkps = await muatRpkps(rpkpsId);
  if (!rpkps) return [];
  return rpkps.pengampu.map((p) => ({
    id: p.pengguna.id,
    nama: namaLengkapPengampu(p.pengguna),
  }));
}
