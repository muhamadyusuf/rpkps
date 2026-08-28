import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bacaKek, buka, bungkus, ekorKunci, GalatKripto } from "@/lib/kripto/amplop";
import { GalatAi } from "./galat";
import { buatPenyedia, modelBawaan, type PenyediaTerpilih } from "./klien";
import type { PenyediaAi } from "@/generated/prisma";

/**
 * Kredensial AI milik dosen — BYOK Mode A, docs/08.
 *
 * Satu-satunya tempat kunci API dibuka. Kunci yang sudah terbuka tidak pernah
 * meninggalkan berkas ini kecuali sebagai adapter `Penyedia` yang sudah jadi;
 * ia tidak pernah dikembalikan sebagai string, tidak pernah masuk log, dan
 * tidak pernah masuk pesan galat.
 */

export type KredensialRingkas = {
  id: string;
  penyedia: PenyediaAi;
  label: string;
  /** Empat karakter terakhir kunci. Tidak cukup untuk memakainya. */
  ekor: string;
  model: string | null;
  /** Model yang benar-benar dipakai bila `model` kosong. */
  modelEfektif: string;
  bawaan: boolean;
  aktif: boolean;
  terakhirDipakai: Date | null;
};

const PESAN_TANPA_KUNCI =
  "Fitur AI memakai kunci API milik Anda sendiri, dan Anda belum mendaftarkan satu pun. " +
  "Buka Pengaturan → Kunci AI untuk menambahkannya.";

function kek() {
  const nilai = process.env.AI_KUNCI_MASTER?.trim();
  if (!nilai) {
    // Tanpa KEK, menyimpan kunci berarti menyimpannya tanpa perlindungan.
    // Lebih baik fitur mati daripada rahasia dosen tersimpan telanjang.
    throw new GalatAi(
      "AI_KUNCI_MASTER belum dipasang di server, sehingga kunci API tidak dapat disimpan dengan aman. Hubungi admin.",
    );
  }
  try {
    return bacaKek(nilai);
  } catch (galat) {
    throw new GalatAi(
      galat instanceof GalatKripto
        ? `AI_KUNCI_MASTER tidak sah: ${galat.message}`
        : "AI_KUNCI_MASTER tidak sah.",
    );
  }
}

export function kunciMasterTerpasang(): boolean {
  try {
    kek();
    return true;
  } catch {
    return false;
  }
}

function ringkas(k: {
  id: string;
  penyedia: PenyediaAi;
  label: string;
  ekor: string;
  model: string | null;
  bawaan: boolean;
  aktif: boolean;
  terakhirDipakai: Date | null;
}): KredensialRingkas {
  return { ...k, modelEfektif: k.model ?? modelBawaan(k.penyedia) };
}

const PILIH = {
  id: true,
  penyedia: true,
  label: true,
  ekor: true,
  model: true,
  bawaan: true,
  aktif: true,
  terakhirDipakai: true,
} as const;

export async function daftarKredensial(penggunaId: string): Promise<KredensialRingkas[]> {
  const baris = await prisma.kredensialAi.findMany({
    where: { penggunaId },
    orderBy: [{ bawaan: "desc" }, { penyedia: "asc" }, { label: "asc" }],
    select: PILIH,
  });
  return baris.map(ringkas);
}

/** Dipakai halaman untuk menyembunyikan tombol AI bila dosen belum punya kunci. */
export async function aiTersediaUntuk(penggunaId: string): Promise<boolean> {
  if (!kunciMasterTerpasang()) return false;
  const n = await prisma.kredensialAi.count({ where: { penggunaId, aktif: true } });
  return n > 0;
}

/**
 * Resolusi kredensial — docs/08 §2. Tanpa cadangan ke kunci institusi, tanpa
 * cadangan ke penyedia lain: kegagalan harus berbunyi sebagai kegagalan.
 *
 * Kepemilikan diperiksa DI DALAM kueri, bukan sesudahnya, sehingga id milik
 * dosen lain tidak pernah terbuka walau ditebak dengan benar.
 */
export async function pakaiKredensial(
  penggunaId: string,
  kredensialId?: string | null,
): Promise<PenyediaTerpilih> {
  const kunciMaster = kek();

  const baris = kredensialId
    ? await prisma.kredensialAi.findFirst({
        where: { id: kredensialId, penggunaId, aktif: true },
      })
    : ((await prisma.kredensialAi.findFirst({
        where: { penggunaId, aktif: true, bawaan: true },
      })) ??
      // Tanpa bawaan, satu-satunya kunci aktif sudah cukup jelas maksudnya.
      // Bila ada beberapa dan tak satu pun ditandai bawaan, dosen harus
      // memilih — menebak berarti menagih ke kunci yang salah.
      (await satuSatunya(penggunaId)));

  if (!baris) {
    throw new GalatAi(
      kredensialId
        ? "Kunci AI yang dipilih tidak ditemukan atau bukan milik Anda."
        : PESAN_TANPA_KUNCI,
    );
  }

  const apiKey = buka(kunciMaster, Buffer.from(baris.kunciTerenkripsi));

  await prisma.kredensialAi
    .update({ where: { id: baris.id }, data: { terakhirDipakai: new Date() } })
    .catch(() => {
      // Penanda waktu bukan alasan menggagalkan pekerjaan dosen.
    });

  return {
    penyedia: buatPenyedia(baris.penyedia, apiKey),
    model: baris.model ?? modelBawaan(baris.penyedia),
    kredensialId: baris.id,
  };
}

async function satuSatunya(penggunaId: string) {
  const aktif = await prisma.kredensialAi.findMany({
    where: { penggunaId, aktif: true },
    take: 2,
  });
  if (aktif.length === 1) return aktif[0];
  if (aktif.length > 1) {
    throw new GalatAi(
      "Anda punya beberapa kunci AI dan belum menandai satu sebagai bawaan. Pilih kunci lebih dulu.",
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// PENGELOLAAN
// ─────────────────────────────────────────────────────────────

export const SkemaKredensial = z.object({
  penyedia: z.enum(["ANTHROPIC", "MISTRAL", "GEMINI"]),
  label: z.string().trim().min(2, "Label minimal 2 karakter.").max(60),
  apiKey: z.string().trim().min(16, "Kunci API terlalu pendek untuk sah."),
  model: z.string().trim().max(80).nullable(),
});

export type MasukanKredensial = z.infer<typeof SkemaKredensial>;

/**
 * Uji koneksi: satu panggilan semurah mungkin dengan skema keluaran sepele.
 *
 * Wajib berhasil sebelum simpan (docs/01 §2.2). Kunci salah ketik yang
 * tersimpan diam-diam baru ketahuan di tengah penyusunan draf yang berjalan
 * beberapa menit — waktu dan kuota dosen yang terbuang percuma.
 */
export async function ujiKunci(
  penyedia: PenyediaAi,
  apiKey: string,
  model: string | null,
): Promise<{ ok: boolean; pesan: string }> {
  try {
    const adapter = buatPenyedia(penyedia, apiKey);
    const jawaban = await adapter.chat({
      model: model ?? adapter.modelBawaan,
      panduan: "Anda memeriksa koneksi. Jawab dengan JSON {\"siap\": true}.",
      permintaan: "Balas {\"siap\": true}.",
      skema: z.object({ siap: z.boolean() }),
      maxTokens: 256,
    });
    if (jawaban.alasan === "SELESAI" && jawaban.data) {
      return { ok: true, pesan: `Koneksi ke ${adapter.kode} berhasil.` };
    }
    // Model menjawab tetapi tidak sesuai skema tetap membuktikan kuncinya sah.
    return {
      ok: true,
      pesan: `Kunci diterima ${adapter.kode}, meski jawaban ujinya tidak persis sesuai skema.`,
    };
  } catch (galat) {
    return {
      ok: false,
      pesan: galat instanceof GalatAi ? galat.message : "Penyedia menolak kunci ini.",
    };
  }
}

export async function simpanKredensial(
  penggunaId: string,
  masukan: MasukanKredensial,
): Promise<{ ok: boolean; pesan: string; id?: string }> {
  const kunciMaster = kek();

  const uji = await ujiKunci(masukan.penyedia, masukan.apiKey, masukan.model);
  if (!uji.ok) return { ok: false, pesan: `Kunci tidak tersimpan — ${uji.pesan}` };

  const belumPunya =
    (await prisma.kredensialAi.count({ where: { penggunaId, aktif: true } })) === 0;

  const data = {
    penggunaId,
    penyedia: masukan.penyedia,
    label: masukan.label,
    kunciTerenkripsi: new Uint8Array(bungkus(kunciMaster, masukan.apiKey)),
    ekor: ekorKunci(masukan.apiKey),
    model: masukan.model,
    // Kunci pertama otomatis menjadi bawaan: tanpa itu dosen menyimpan kunci
    // lalu masih menemukan tombol AI menolak jalan.
    bawaan: belumPunya,
    aktif: true,
  };

  const adaLabelSama = await prisma.kredensialAi.findUnique({
    where: {
      penggunaId_penyedia_label: {
        penggunaId,
        penyedia: masukan.penyedia,
        label: masukan.label,
      },
    },
    select: { id: true },
  });

  // Label yang sama pada penyedia yang sama berarti MENGGANTI kunci, bukan
  // menambah baris kedua — persis alur "Ganti kunci" pada docs/01 §2.2.
  const baris = adaLabelSama
    ? await prisma.kredensialAi.update({
        where: { id: adaLabelSama.id },
        data: {
          kunciTerenkripsi: data.kunciTerenkripsi,
          ekor: data.ekor,
          model: data.model,
          aktif: true,
        },
        select: { id: true },
      })
    : await prisma.kredensialAi.create({ data, select: { id: true } });

  await prisma.logAudit.create({
    data: {
      penggunaId,
      aksi: adaLabelSama ? "KUNCI_AI_DIGANTI" : "KUNCI_AI_DITAMBAH",
      entitas: "kredensial_ai",
      entitasId: baris.id,
      // Yang dicatat: penyedia, label, dan ekor. Tidak pernah kuncinya.
      ringkasan: `${masukan.penyedia} · ${masukan.label} · …${data.ekor}`,
    },
  });

  return {
    ok: true,
    pesan: adaLabelSama
      ? `Kunci "${masukan.label}" diganti. ${uji.pesan}`
      : `Kunci "${masukan.label}" tersimpan. ${uji.pesan}`,
    id: baris.id,
  };
}

export async function jadikanBawaan(
  penggunaId: string,
  id: string,
): Promise<{ ok: boolean; pesan: string }> {
  const milik = await prisma.kredensialAi.findFirst({
    where: { id, penggunaId },
    select: { id: true, label: true, aktif: true },
  });
  if (!milik) return { ok: false, pesan: "Kunci tidak ditemukan." };
  if (!milik.aktif) return { ok: false, pesan: "Kunci yang nonaktif tidak dapat dijadikan bawaan." };

  await prisma.$transaction([
    prisma.kredensialAi.updateMany({ where: { penggunaId }, data: { bawaan: false } }),
    prisma.kredensialAi.update({ where: { id }, data: { bawaan: true } }),
  ]);

  return { ok: true, pesan: `"${milik.label}" kini kunci bawaan Anda.` };
}

export async function ubahAktif(
  penggunaId: string,
  id: string,
  aktif: boolean,
): Promise<{ ok: boolean; pesan: string }> {
  const milik = await prisma.kredensialAi.findFirst({
    where: { id, penggunaId },
    select: { id: true, label: true, bawaan: true },
  });
  if (!milik) return { ok: false, pesan: "Kunci tidak ditemukan." };

  await prisma.kredensialAi.update({
    where: { id },
    // Kunci bawaan yang dinonaktifkan berhenti menjadi bawaan; kalau tidak,
    // resolusi akan menemukan bawaan yang tidak dapat dipakai dan berhenti di
    // situ, alih-alih jatuh ke kunci lain yang masih hidup.
    data: { aktif, ...(aktif ? {} : { bawaan: false }) },
  });

  return {
    ok: true,
    pesan: aktif ? `"${milik.label}" diaktifkan.` : `"${milik.label}" dinonaktifkan.`,
  };
}

export async function hapusKredensial(
  penggunaId: string,
  id: string,
): Promise<{ ok: boolean; pesan: string }> {
  const milik = await prisma.kredensialAi.findFirst({
    where: { id, penggunaId },
    select: { id: true, label: true, penyedia: true, ekor: true },
  });
  if (!milik) return { ok: false, pesan: "Kunci tidak ditemukan." };

  await prisma.kredensialAi.delete({ where: { id } });
  await prisma.logAudit.create({
    data: {
      penggunaId,
      aksi: "KUNCI_AI_DIHAPUS",
      entitas: "kredensial_ai",
      entitasId: id,
      ringkasan: `${milik.penyedia} · ${milik.label} · …${milik.ekor}`,
    },
  });

  // Menghapus bawaan meninggalkan dosen tanpa bawaan; kunci yang tersisa
  // dipromosikan bila hanya tinggal satu, supaya tombol AI tidak mendadak
  // meminta memilih tanpa sebab.
  const sisa = await prisma.kredensialAi.findMany({
    where: { penggunaId, aktif: true },
    take: 2,
    select: { id: true, bawaan: true },
  });
  if (sisa.length === 1 && !sisa[0].bawaan) {
    await prisma.kredensialAi.update({ where: { id: sisa[0].id }, data: { bawaan: true } });
  }

  return { ok: true, pesan: `Kunci "${milik.label}" dihapus.` };
}
