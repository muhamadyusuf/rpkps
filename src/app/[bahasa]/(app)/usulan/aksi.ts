"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kirimNotifikasi, penerimaPengelola } from "@/lib/notifikasi/kirim";
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
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";

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
  mataKuliahId: z.string().min(1, "@aksi.periksa.pilihMk"),
  judul: z.string().trim().min(6, "@aksi.periksa.judulPendek"),
  latar: z
    .string()
    .trim()
    .min(30, "@aksi.periksa.latarPendek"),
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
  cpmkKode: z.string().trim().min(1, "@aksi.periksa.kodeCpmkWajib"),
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
  alasan: z.string().trim().min(1, "@aksi.periksa.alasanWajib"),
  dasarJenis: z.enum([
    "TEMUAN_VALIDATOR",
    "SINYAL_INDUSTRI",
    "MASUKAN_DUDI",
    "TRACER",
    "CATATAN_DOSEN",
    "TEMUAN_EVALUASI",
  ]),
  dasarRef: z.string().trim().optional(),
  dasarKutipan: z.string().trim().min(1, "@aksi.periksa.dasarWajib"),
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

/**
 * Pesan Zod pertama, dengan cadangan dari kamus.
 *
 * Kamusnya dioper, bukan diambil sendiri: fungsi ini sinkron dan dipanggil
 * dari dalam Server Action yang sudah memegangnya.
 */

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
  const kam = await kamusAksi();
  const sesi = await wajibAktif();
  const usulan = await muatUsulan(id);
  if (!usulan) return { pesan: kam.aksi.takAda.usulan };

  const prodiId = await prodiKurikulum(usulan.kurikulumId);
  if (!prodiId || !punyaPeranDiProdi(sesi, prodiId, ...peran)) {
    return { pesan: kam.aksi.wenang.atasUsulan };
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

/**
 * Mengabari pengusul atas keputusan usulannya.
 *
 * Hanya pengusul: keputusan Kaprodi menyangkut orang yang menunggu jawaban,
 * bukan seluruh prodi. Yang lain melihatnya di daftar usulan bila berminat.
 */
async function kabariPengusul(
  usulan: { id: string; judul: string; diajukanOlehId: string },
  sesi: PenggunaSesi,
  keputusan: "DISAHKAN" | "DIREVISI" | "DITOLAK",
  catatan: string | null,
) {
  await kirimNotifikasi(
    [usulan.diajukanOlehId],
    {
      jenis: "USULAN_DIPUTUSKAN",
      usulanId: usulan.id,
      judul: usulan.judul,
      oleh: sesi.namaLengkap,
      keputusan,
      catatan,
    },
    sesi.id,
  );
}

function segarkanUsulan(id: string) {
  segarkan("/usulan");
  segarkan(`/usulan/${id}`);
}

// ─────────────────────────────────────────────────────────────
// Penyusunan
// ─────────────────────────────────────────────────────────────

export async function buatUsulan(data: FormData): Promise<Hasil> {
  const kam = await kamusAksi();
  const sesi = await wajibAktif();
  const terurai = SkemaUsulanBaru.safeParse({
    mataKuliahId: String(data.get("mataKuliahId") ?? ""),
    judul: String(data.get("judul") ?? ""),
    latar: String(data.get("latar") ?? ""),
    jalurRalat: data.get("jalurRalat") === "on",
  });
  if (!terurai.success) return { ok: false, pesan: pesanZod(terurai.error, kam) };

  const mk = await prisma.mataKuliah.findUnique({
    where: { id: terurai.data.mataKuliahId },
    select: { id: true, kurikulumId: true, kurikulum: { select: { prodiId: true } } },
  });
  if (!mk) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };
  if (!punyaPeranDiProdi(sesi, mk.kurikulum.prodiId, ...PERAN_PENGUSUL)) {
    return { ok: false, pesan: kam.aksi.wenang.usulkanRevisi };
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

  segarkan("/usulan");
  return { ok: true, pesan: kam.aksi.usulan.dibuat, id: usulan.id };
}

export async function tambahButir(usulanId: string, data: FormData): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(usulanId, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan, sesi } = akses;

  if (usulan.status !== "DRAF" && usulan.status !== "DIREVISI") {
    return { ok: false, pesan: kam.aksi.usulan.takDapatDisunting };
  }
  if (usulan.diajukanOlehId !== sesi.id && !punyaPeranDiProdi(sesi, await prodiUsulan(usulan), ...PERAN_PEMUTUS)) {
    return { ok: false, pesan: kam.aksi.wenang.hanyaPengusulSunting };
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
  if (!terurai.success) return { ok: false, pesan: pesanZod(terurai.error, kam) };
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
    return { ok: false, pesan: `${kam.aksi.usulan.butirGagal}${inti ? `: ${inti}` : "."}` };
  }

  segarkanUsulan(usulanId);
  return { ok: true, pesan: kam.aksi.usulan.butirDitambahkan };
}

async function prodiUsulan(usulan: UsulanLengkap): Promise<string> {
  return (await prodiKurikulum(usulan.kurikulumId)) ?? "";
}

export async function hapusButir(butirId: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const butir = await prisma.butirUsulan.findUnique({
    where: { id: butirId },
    select: { usulanId: true },
  });
  if (!butir) return { ok: false, pesan: kam.aksi.takAda.butir };

  const akses = await wajibUsulan(butir.usulanId, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DRAF" && akses.usulan.status !== "DIREVISI") {
    return { ok: false, pesan: kam.aksi.usulan.takDapatDisunting };
  }

  await prisma.butirUsulan.delete({ where: { id: butirId } });
  segarkanUsulan(butir.usulanId);
  return { ok: true, pesan: kam.aksi.usulan.butirDihapus };
}

/** Pemeriksaan tanpa menyimpan apa pun — dipakai panel pratinjau. */
export async function periksaUsulan(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(id, [...PERAN_PENGUSUL, "GPM"]);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };

  const kurikulum = await muatKurikulumInput(akses.usulan.kurikulumId);
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  const hasil = periksaUsulanRevisi(kurikulum, keUsulanInput(akses.usulan));
  return {
    ok: hasil.lolos,
    pesan: hasil.lolos
      ? kam.aksi.lain.takAdaPemblokir
      : sisip(kam.aksi.lain.adaPemblokir, { n: hasil.pemblokir.length }),
    temuan: hasil.temuan,
  };
}

export async function ajukanUsulan(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(id, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan } = akses;

  if (usulan.status !== "DRAF" && usulan.status !== "DIREVISI") {
    return { ok: false, pesan: kam.aksi.usulan.sudahDiajukan };
  }

  const kurikulum = await muatKurikulumInput(usulan.kurikulumId);
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  const hasil = periksaUsulanRevisi(kurikulum, keUsulanInput(usulan));
  if (!hasil.lolos) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.rpkps.pemblokirTersisa, { jumlah: hasil.pemblokir.length }),
      temuan: hasil.temuan,
    };
  }

  await prisma.usulanRevisi.update({
    where: { id },
    data: { status: "DIAJUKAN", diajukanPada: new Date() },
  });

  const prodiId = await prodiKurikulum(usulan.kurikulumId);
  if (prodiId) {
    await kirimNotifikasi(
      await penerimaPengelola(prodiId),
      {
        jenis: "USULAN_DIAJUKAN",
        usulanId: id,
        judul: usulan.judul,
        oleh: akses.sesi.namaLengkap,
      },
      akses.sesi.id,
    );
  }

  segarkanUsulan(id);
  return { ok: true, pesan: kam.aksi.usulan.diajukan };
}

export async function tarikUsulan(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(id, PERAN_PENGUSUL);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan, sesi } = akses;

  if (usulan.diajukanOlehId !== sesi.id) {
    return { ok: false, pesan: kam.aksi.wenang.hanyaPengusulTarik };
  }
  if (usulan.status === "DITERAPKAN") {
    return { ok: false, pesan: kam.aksi.usulan.takDapatDitarik };
  }

  await prisma.usulanRevisi.update({ where: { id }, data: { status: "DITARIK" } });
  segarkanUsulan(id);
  return { ok: true, pesan: kam.aksi.usulan.ditarik };
}

export async function tambahCatatan(id: string, isi: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(id, [...PERAN_PENGUSUL, "GPM"]);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };

  const bersih = isi.trim();
  if (bersih.length < MIN_CATATAN) {
    return { ok: false, pesan: sisip(kam.aksi.usulan.catatanMin, { min: MIN_CATATAN }) };
  }

  await prisma.catatanUsulan.create({
    data: { usulanId: id, olehId: akses.sesi.id, isi: bersih },
  });
  segarkanUsulan(id);
  return { ok: true, pesan: kam.aksi.usulan.catatanDitambahkan };
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
  const kam = await kamusAksi();
  const butir = await prisma.butirUsulan.findUnique({
    where: { id: butirId },
    select: { usulanId: true, rumusan: true },
  });
  if (!butir) return { ok: false, pesan: kam.aksi.takAda.butir };

  const akses = await wajibUsulan(butir.usulanId, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: kam.aksi.usulan.hanyaDiajukanDiputuskan };
  }

  const bersih = (catatan ?? "").trim();
  if (keputusan === "DITOLAK" && bersih.length < MIN_CATATAN) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.usulan.butirTolakMin, { min: MIN_CATATAN }),
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

  segarkanUsulan(butir.usulanId);
  return {
    ok: true,
    pesan: disunting
      ? kam.aksi.usulan.butirDisesuaikan
      : kam.aksi.usulan.butirDisimpan,
  };
}

export async function kembalikanUntukRevisi(id: string, catatan: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(id, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: kam.aksi.usulan.hanyaDiajukanDikembalikan };
  }

  const bersih = catatan.trim();
  if (bersih.length < MIN_CATATAN) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.usulan.catatanRevisiMin, { min: MIN_CATATAN }),
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

  await kabariPengusul(akses.usulan, akses.sesi, "DIREVISI", bersih);

  segarkanUsulan(id);
  return { ok: true, pesan: kam.aksi.usulan.dikembalikan };
}

export async function tolakUsulan(id: string, catatan: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(id, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  if (akses.usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: kam.aksi.usulan.hanyaDiajukanDitolak };
  }

  const bersih = catatan.trim();
  if (bersih.length < MIN_CATATAN) {
    return { ok: false, pesan: sisip(kam.aksi.usulan.penolakanMin, { min: MIN_CATATAN }) };
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

  await kabariPengusul(akses.usulan, akses.sesi, "DITOLAK", bersih);

  segarkanUsulan(id);
  return { ok: true, pesan: kam.aksi.usulan.ditolak };
}

/**
 * Mengesahkan: menerapkan butir yang diterima ke kurikulum.
 *
 * Langkah terpisah dari "menyetujui" dengan sengaja — menyetujui adalah
 * keputusan akademik, menerapkan adalah mutasi pada sumber kebenaran, dan
 * Kaprodi harus melihat dampaknya lebih dulu (doc 04 §3).
 */
export async function sahkanUsulan(id: string, berlakuMulaiTaId?: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const akses = await wajibUsulan(id, PERAN_PEMUTUS);
  if ("pesan" in akses) return { ok: false, pesan: akses.pesan };
  const { usulan, sesi } = akses;

  if (usulan.status !== "DIAJUKAN") {
    return { ok: false, pesan: kam.aksi.usulan.hanyaDiajukanDisahkan };
  }
  if (usulan.butir.some((b) => b.status === "BARU")) {
    return { ok: false, pesan: kam.aksi.usulan.butirBelumDiputuskan };
  }

  const kurikulum = await muatKurikulumInput(usulan.kurikulumId);
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  const hasil = periksaPenerapan(kurikulum, keUsulanInput(usulan));
  if (!hasil.lolos) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.usulan.penerapanDitahan, { jumlah: hasil.pemblokir.length }),
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
      pesan: kam.aksi.usulan.tanpaTaBerikutnya,
    };
  }

  const { revisiKe, ringkasan } = await terapkanUsulan(usulan, sesi.id, taId);

  await kabariPengusul(usulan, sesi, "DISAHKAN", usulan.catatanPemutus);

  segarkan("/usulan");
  segarkan(`/usulan/${id}`);
  segarkan("/kurikulum");
  segarkan(`/kurikulum/${usulan.kurikulumId}`);
  segarkan(`/kurikulum/${usulan.kurikulumId}/mk/${usulan.mataKuliahId}`);
  return { ok: true, pesan: sisip(kam.aksi.usulan.disahkanRevisi, { revisi: revisiKe, ringkasan }) };
}
