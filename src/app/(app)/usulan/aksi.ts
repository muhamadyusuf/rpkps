"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { punyaPeranDiProdi, wajibAktif } from "@/lib/otorisasi";
import {
  keUsulanInput,
  muatKurikulumInput,
  muatUsulan,
  terapkanUsulan,
  taBerlakuBawaan,
  type UsulanLengkap,
} from "@/lib/kurikulum/usulan";
import {
  periksaPenerapan,
  periksaUsulanRevisi,
  type TemuanUsulan,
} from "@/domain/kurikulum/usulan";
import type { PenggunaSesi } from "@/lib/sesi";
import { PESAN_KLIEN_BASI, intiPesanPrisma, klienBasi } from "@/lib/galat-prisma";

/**
 * Aksi Usulan Revisi Kurikulum.
 * Acuan: docs/04-usulan-revisi-kurikulum.md §3.
 *
 * Pembagian yang dipegang berkas ini: siapa boleh berbuat apa diputuskan di
 * sini, sedangkan boleh-tidaknya sebuah usulan dari sisi akademik diputuskan
 * `src/domain/kurikulum/usulan.ts`. Tidak ada aturan kurikulum yang ditulis
 * ulang di sini.
 */

export interface Hasil {
  ok: boolean;
  pesan: string;
  temuan?: TemuanUsulan[];
  id?: string;
}

const MIN_CATATAN = 12;

const SkemaUsulanBaru = z.object({
  mataKuliahId: z.string().min(1, "Pilih mata kuliah."),
  judul: z.string().trim().min(6, "Judul terlalu pendek."),
  latar: z
    .string()
    .trim()
    .min(30, "Latar belakang minimal 30 karakter — Kaprodi membacanya lebih dulu."),
  jalurRalat: z.boolean().optional(),
});

const SkemaButir = z.object({
  jenis: z.enum([
    "CPMK_BARU",
    "CPMK_RUMUSAN",
    "CPMK_PETA_CPL",
    "CPMK_PENSIUN",
    "SUB_BARU",
    "SUB_RUMUSAN",
    "SUB_MINGGU",
    "SUB_PENSIUN",
    "CATATAN_CPL",
  ]),
  cpmkKode: z.string().trim().min(1, "Kode CPMK wajib diisi."),
  subCpmkKode: z.string().trim().optional(),
  rumusan: z.string().trim().optional(),
  levelBloom: z
    .enum([
      "C1", "C2", "C3", "C4", "C5", "C6",
      "A1", "A2", "A3", "A4", "A5",
      "P1", "P2", "P3", "P4", "P5",
    ])
    .optional(),
  cplKode: z.string().optional(),
  mingguDisarankan: z.string().optional(),
  alasan: z.string().trim().min(1, "Alasan wajib diisi."),
  dasarJenis: z.enum([
    "TEMUAN_VALIDATOR",
    "SINYAL_INDUSTRI",
    "MASUKAN_DUDI",
    "TRACER",
    "CATATAN_DOSEN",
    "TEMUAN_EVALUASI",
  ]),
  dasarRef: z.string().trim().optional(),
  dasarKutipan: z.string().trim().min(1, "Dasar wajib diisi."),
});

function daftarKode(nilai: string | undefined): string[] {
  return (nilai ?? "")
    .split(/[,\s]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function daftarAngka(nilai: string | undefined): number[] {
  return daftarKode(nilai)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 20);
}

function pesanZod(galat: z.ZodError): string {
  return galat.issues[0]?.message ?? "Isian tidak valid.";
}

// ─────────────────────────────────────────────────────────────
// Kewenangan
// ─────────────────────────────────────────────────────────────

/**
 * Pengusul: siapa pun yang mengajar atau mengoordinasi di prodi pemilik
 * kurikulum. Sengaja luas — pintu ini justru dibuat supaya dosen tidak lagi
 * buntu (doc 04 §1).
 */
const PERAN_PENGUSUL = ["ADMIN", "KAPRODI", "KOORDINATOR_MK", "DOSEN"] as const;
/** Pemutus tunggal. GPM hanya memberi catatan, tidak memblokir (doc 04 §8.3). */
const PERAN_PEMUTUS = ["ADMIN", "KAPRODI"] as const;

async function wajibUsulan(
  id: string,
  peran: readonly ("ADMIN" | "KAPRODI" | "KOORDINATOR_MK" | "DOSEN" | "GPM")[],
): Promise<{ sesi: PenggunaSesi; usulan: UsulanLengkap } | { pesan: string }> {
  const sesi = await wajibAktif();
  const usulan = await muatUsulan(id);
  if (!usulan) return { pesan: "Usulan tidak ditemukan." };

  const prodiId = await prodiKurikulum(usulan.kurikulumId);
  if (!prodiId || !punyaPeranDiProdi(sesi, prodiId, ...peran)) {
    return { pesan: "Anda tidak berwenang atas usulan ini." };
  }
  return { sesi, usulan };
}

async function prodiKurikulum(kurikulumId: string): Promise<string | null> {
  const k = await prisma.kurikulum.findUnique({
    where: { id: kurikulumId },
    select: { prodiId: true },
  });
  return k?.prodiId ?? null;
}

function segarkan(id: string) {
  revalidatePath("/usulan");
  revalidatePath(`/usulan/${id}`);
}

// ─────────────────────────────────────────────────────────────
// Penyusunan
// ─────────────────────────────────────────────────────────────

export async function buatUsulan(data: FormData): Promise<Hasil> {
  const sesi = await wajibAktif();
  const terurai = SkemaUsulanBaru.safeParse({
    mataKuliahId: String(data.get("mataKuliahId") ?? ""),
    judul: String(data.get("judul") ?? ""),
    latar: String(data.get("latar") ?? ""),
    jalurRalat: data.get("jalurRalat") === "on",
  });
  if (!terurai.success) return { ok: false, pesan: pesanZod(terurai.error) };

  const mk = await prisma.mataKuliah.findUnique({
    where: { id: terurai.data.mataKuliahId },
    select: { id: true, kurikulumId: true, kurikulum: { select: { prodiId: true } } },
  });
  if (!mk) return { ok: false, pesan: "Mata kuliah tidak ditemukan." };
  if (!punyaPeranDiProdi(sesi, mk.kurikulum.prodiId, ...PERAN_PENGUSUL)) {
    return { ok: false, pesan: "Anda tidak berwenang mengusulkan revisi di prodi ini." };
  }

  const usulan = await prisma.usulanRevisi.create({
    data: {
      kurikulumId: mk.kurikulumId,
      mataKuliahId: mk.id,
      judul: terurai.data.judul,
      latar: terurai.data.latar,
      jalurRalat: terurai.data.jalurRalat ?? false,
      diajukanOlehId: sesi.id,
    },
    select: { id: true },
  });

  revalidatePath("/usulan");
  return { ok: true, pesan: "Usulan dibuat. Tambahkan butir perubahannya.", id: usulan.id };
}

export async function tambahButir(usulanId: string, data: FormData): Promise<Hasil> {
  const akses = await wajibUsulan(usulanId, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan, sesi } = akses;

  if (usulan.status !== "DRAF" && usulan.status !== "DIREVISI") {
    return { ok: false, pesan: "Usulan yang sudah diajukan tidak dapat disunting." };
  }
  if (usulan.diajukanOlehId !== sesi.id && !punyaPeranDiProdi(sesi, await prodiUsulan(usulan), ...PERAN_PEMUTUS)) {
    return { ok: false, pesan: "Hanya pengusul yang dapat menyunting butir." };
  }

  const terurai = SkemaButir.safeParse({
    jenis: String(data.get("jenis") ?? ""),
    cpmkKode: String(data.get("cpmkKode") ?? ""),
    subCpmkKode: String(data.get("subCpmkKode") ?? ""),
    rumusan: String(data.get("rumusan") ?? ""),
    levelBloom: String(data.get("levelBloom") ?? "") || undefined,
    cplKode: String(data.get("cplKode") ?? ""),
    mingguDisarankan: String(data.get("mingguDisarankan") ?? ""),
    alasan: String(data.get("alasan") ?? ""),
    dasarJenis: String(data.get("dasarJenis") ?? "CATATAN_DOSEN"),
    dasarRef: String(data.get("dasarRef") ?? ""),
    dasarKutipan: String(data.get("dasarKutipan") ?? ""),
  });
  if (!terurai.success) return { ok: false, pesan: pesanZod(terurai.error) };
  const d = terurai.data;

  const terakhir = await prisma.butirUsulan.aggregate({
    where: { usulanId },
    _max: { urutan: true },
  });

  try {
    await prisma.butirUsulan.create({
      data: {
        usulanId,
        urutan: (terakhir._max.urutan ?? 0) + 1,
        jenis: d.jenis,
        cpmkKode: d.cpmkKode,
        subCpmkKode: d.subCpmkKode || null,
        rumusan: d.rumusan || null,
        levelBloom: d.levelBloom ?? null,
        cplKode: daftarKode(d.cplKode),
        mingguDisarankan: daftarAngka(d.mingguDisarankan),
        alasan: d.alasan,
        dasar: {
          create: {
            jenis: d.dasarJenis,
            ref: d.dasarRef || null,
            kutipan: d.dasarKutipan,
          },
        },
      },
    });
  } catch (galat) {
    if (klienBasi(galat)) return { ok: false, pesan: PESAN_KLIEN_BASI };
    const inti = galat instanceof Error ? intiPesanPrisma(galat.message) : "";
    return { ok: false, pesan: `Butir gagal disimpan${inti ? `: ${inti}` : "."}` };
  }

  segarkan(usulanId);
  return { ok: true, pesan: "Butir ditambahkan." };
}

async function prodiUsulan(usulan: UsulanLengkap): Promise<string> {
  return (await prodiKurikulum(usulan.kurikulumId)) ?? "";
}

export async function hapusButir(butirId: string): Promise<Hasil> {
  const butir = await prisma.butirUsulan.findUnique({
    where: { id: butirId },
    select: { usulanId: true },
  });
  if (!butir) return { ok: false, pesan: "Butir tidak ditemukan." };

  const akses = await wajibUsulan(butir.usulanId, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DRAF" && akses.usulan.status !== "DIREVISI") {
    return { ok: false, pesan: "Usulan yang sudah diajukan tidak dapat disunting." };
  }

  await prisma.butirUsulan.delete({ where: { id: butirId } });
  segarkan(butir.usulanId);
  return { ok: true, pesan: "Butir dihapus." };
}

/** Pemeriksaan tanpa menyimpan apa pun — dipakai panel pratinjau. */
export async function periksaUsulan(id: string): Promise<Hasil> {
  const akses = await wajibUsulan(id, [...PERAN_PENGUSUL, "GPM"]);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };

  const kurikulum = await muatKurikulumInput(akses.usulan.kurikulumId);
  if (!kurikulum) return { ok: false, pesan: "Kurikulum tidak ditemukan." };

  const hasil = periksaUsulanRevisi(kurikulum, keUsulanInput(akses.usulan));
  return {
    ok: hasil.lolos,
    pesan: hasil.lolos
      ? "Tidak ada temuan pemblokir."
      : `${hasil.pemblokir.length} temuan pemblokir.`,
    temuan: hasil.temuan,
  };
}

export async function ajukanUsulan(id: string): Promise<Hasil> {
  const akses = await wajibUsulan(id, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan } = akses;

  if (usulan.status !== "DRAF" && usulan.status !== "DIREVISI") {
    return { ok: false, pesan: "Usulan ini sudah diajukan." };
  }

  const kurikulum = await muatKurikulumInput(usulan.kurikulumId);
  if (!kurikulum) return { ok: false, pesan: "Kurikulum tidak ditemukan." };

  const hasil = periksaUsulanRevisi(kurikulum, keUsulanInput(usulan));
  if (!hasil.lolos) {
    return {
      ok: false,
      pesan: `Masih ada ${hasil.pemblokir.length} temuan pemblokir. Perbaiki lebih dulu.`,
      temuan: hasil.temuan,
    };
  }

  await prisma.usulanRevisi.update({
    where: { id },
    data: { status: "DIAJUKAN", diajukanPada: new Date() },
  });

  segarkan(id);
  return { ok: true, pesan: "Usulan diajukan ke Ketua Program Studi." };
}

export async function tarikUsulan(id: string): Promise<Hasil> {
  const akses = await wajibUsulan(id, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan, sesi } = akses;

  if (usulan.diajukanOlehId !== sesi.id) {
    return { ok: false, pesan: "Hanya pengusul yang dapat menarik usulannya." };
  }
  if (usulan.status === "DITERAPKAN") {
    return { ok: false, pesan: "Usulan yang sudah diterapkan tidak dapat ditarik." };
  }

  await prisma.usulanRevisi.update({ where: { id }, data: { status: "DITARIK" } });
  segarkan(id);
  return { ok: true, pesan: "Usulan ditarik." };
}

export async function tambahCatatan(id: string, isi: string): Promise<Hasil> {
  const akses = await wajibUsulan(id, [...PERAN_PENGUSUL, "GPM"]);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };

  const bersih = isi.trim();
  if (bersih.length < MIN_CATATAN) {
    return { ok: false, pesan: `Catatan minimal ${MIN_CATATAN} karakter.` };
  }

  await prisma.catatanUsulan.create({
    data: { usulanId: id, olehId: akses.sesi.id, isi: bersih },
  });
  segarkan(id);
  return { ok: true, pesan: "Catatan ditambahkan." };
}

// ─────────────────────────────────────────────────────────────
// Keputusan Kaprodi
// ─────────────────────────────────────────────────────────────

/**
 * Memutuskan satu butir. Rumusan yang disunting Kaprodi menjadikan butir
 * DISESUAIKAN — kalimat akhir tetap kalimat Kaprodi, dan jejaknya tercatat.
 */
export async function putuskanButir(
  butirId: string,
  keputusan: "DITERIMA" | "DITOLAK",
  rumusanBaru?: string,
  catatan?: string,
): Promise<Hasil> {
  const butir = await prisma.butirUsulan.findUnique({
    where: { id: butirId },
    select: { usulanId: true, rumusan: true },
  });
  if (!butir) return { ok: false, pesan: "Butir tidak ditemukan." };

  const akses = await wajibUsulan(butir.usulanId, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: "Hanya usulan berstatus diajukan yang dapat diputuskan." };
  }

  const bersih = (catatan ?? "").trim();
  if (keputusan === "DITOLAK" && bersih.length < MIN_CATATAN) {
    return {
      ok: false,
      pesan: `Butir yang ditolak wajib bercatatan, minimal ${MIN_CATATAN} karakter.`,
    };
  }

  const disunting =
    keputusan === "DITERIMA" &&
    Boolean(rumusanBaru?.trim()) &&
    rumusanBaru?.trim() !== butir.rumusan;

  await prisma.butirUsulan.update({
    where: { id: butirId },
    data: {
      status: keputusan === "DITOLAK" ? "DITOLAK" : disunting ? "DISESUAIKAN" : "DITERIMA",
      ...(disunting ? { rumusan: rumusanBaru!.trim() } : {}),
      catatanPemutus: bersih || null,
    },
  });

  segarkan(butir.usulanId);
  return {
    ok: true,
    pesan: disunting ? "Butir diterima dengan penyesuaian." : "Keputusan butir disimpan.",
  };
}

export async function kembalikanUntukRevisi(id: string, catatan: string): Promise<Hasil> {
  const akses = await wajibUsulan(id, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: "Hanya usulan berstatus diajukan yang dapat dikembalikan." };
  }

  const bersih = catatan.trim();
  if (bersih.length < MIN_CATATAN) {
    return {
      ok: false,
      pesan: `Catatan revisi wajib diisi, minimal ${MIN_CATATAN} karakter — sebutkan apa yang harus diperbaiki.`,
    };
  }

  await prisma.usulanRevisi.update({
    where: { id },
    data: {
      status: "DIREVISI",
      catatanPemutus: bersih,
      diputuskanOlehId: akses.sesi.id,
      diputuskanPada: new Date(),
      butir: { updateMany: { where: {}, data: { status: "BARU" } } },
    },
  });

  segarkan(id);
  return { ok: true, pesan: "Usulan dikembalikan untuk revisi." };
}

export async function tolakUsulan(id: string, catatan: string): Promise<Hasil> {
  const akses = await wajibUsulan(id, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: "Hanya usulan berstatus diajukan yang dapat ditolak." };
  }

  const bersih = catatan.trim();
  if (bersih.length < MIN_CATATAN) {
    return { ok: false, pesan: `Penolakan wajib bercatatan, minimal ${MIN_CATATAN} karakter.` };
  }

  await prisma.usulanRevisi.update({
    where: { id },
    data: {
      status: "DITOLAK",
      catatanPemutus: bersih,
      diputuskanOlehId: akses.sesi.id,
      diputuskanPada: new Date(),
    },
  });

  segarkan(id);
  return { ok: true, pesan: "Usulan ditolak." };
}

/**
 * Mengesahkan: menerapkan butir yang diterima ke kurikulum.
 *
 * Langkah terpisah dari "menyetujui" dengan sengaja — menyetujui adalah
 * keputusan akademik, menerapkan adalah mutasi pada sumber kebenaran, dan
 * Kaprodi harus melihat dampaknya lebih dulu (doc 04 §3).
 */
export async function sahkanUsulan(id: string, berlakuMulaiTaId?: string): Promise<Hasil> {
  const akses = await wajibUsulan(id, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan, sesi } = akses;

  if (usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: "Hanya usulan berstatus diajukan yang dapat disahkan." };
  }
  if (usulan.butir.some((b) => b.status === "BARU")) {
    return { ok: false, pesan: "Masih ada butir yang belum Anda putuskan." };
  }

  const kurikulum = await muatKurikulumInput(usulan.kurikulumId);
  if (!kurikulum) return { ok: false, pesan: "Kurikulum tidak ditemukan." };

  const hasil = periksaPenerapan(kurikulum, keUsulanInput(usulan));
  if (!hasil.lolos) {
    return {
      ok: false,
      pesan: `Penerapan ditahan: ${hasil.pemblokir.length} temuan pemblokir.`,
      temuan: hasil.temuan,
    };
  }

  // Ralat boleh berlaku segera; syarat "tidak mengubah makna" sudah ditegakkan
  // domain saat pengajuan (doc 04 §8.2).
  const taId = usulan.jalurRalat
    ? null
    : (berlakuMulaiTaId ?? (await taBerlakuBawaan())?.id ?? null);
  if (!usulan.jalurRalat && !taId) {
    return {
      ok: false,
      pesan:
        "Belum ada tahun akademik berikutnya untuk menampung revisi ini. Tambahkan lebih dulu di menu Tahun Akademik.",
    };
  }

  const { revisiKe, ringkasan } = await terapkanUsulan(usulan, sesi.id, taId);

  revalidatePath("/usulan");
  revalidatePath(`/usulan/${id}`);
  revalidatePath("/kurikulum");
  revalidatePath(`/kurikulum/${usulan.kurikulumId}`);
  revalidatePath(`/kurikulum/${usulan.kurikulumId}/mk/${usulan.mataKuliahId}`);
  return { ok: true, pesan: `Disahkan sebagai revisi ${revisiKe}. ${ringkasan}` };
}
