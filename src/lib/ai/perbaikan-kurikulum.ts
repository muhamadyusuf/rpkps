import "server-only";
import { z } from "zod";
import { KKO_TIDAK_TERUKUR, LEVEL_BLOOM } from "@/domain/kurikulum/bloom";
import type { UsulanPerbaikan } from "@/domain/kurikulum/perbaikan";
import { jalankanTugasAi } from "./gerbang";

/**
 * Tugas AI: mengusulkan perbaikan atas temuan validator saat impor kurikulum.
 *
 * Gabungan T1–T3 pada docs/01 §3.1 yang dipersempit ke konteks impor. AI
 * hanya MENGUSULKAN; yang memutuskan usulan mana yang sah adalah
 * `periksaUsulan` di domain, dan yang memutuskan mana yang dipakai adalah
 * dosen — lihat docs/01 Prinsip 2.
 */

const LEVEL = z.enum([
  "C1", "C2", "C3", "C4", "C5", "C6",
  "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5",
]);

/**
 * Skema keluaran. Semua field wajib ada dan boleh null — bentuk yang dituntut
 * structured output, sekaligus menghindari tebak-tebakan field hilang.
 */
const SkemaKeluaran = z.object({
  usulan: z.array(
    z.object({
      jenis: z.enum(["RUMUSAN_SUB", "RUMUSAN_CPMK", "SUB_BARU", "PETA_CPL"]),
      mk_kode: z.string(),
      cpmk_kode: z.string(),
      sub_cpmk_kode: z.string().nullable(),
      kode_temuan: z.array(z.string()),
      alasan: z.string(),
      rumusan: z.string().nullable(),
      level_bloom: LEVEL.nullable(),
      sub_cpmk_baru: z
        .array(
          z.object({
            kode: z.string(),
            rumusan: z.string(),
            level_bloom: LEVEL.nullable(),
          }),
        )
        .nullable(),
      cpl_kode: z.array(z.string()).nullable(),
    }),
  ),
});

/** Kamus KKO dirender dari sumber yang sama dengan validator, agar tidak pernah berbeda. */
function kamusKko(): string {
  return LEVEL_BLOOM.map(
    (l) => `${l.level} ${l.nama} (${l.ranah.toLowerCase()}): ${l.kko.join(", ")}`,
  ).join("\n");
}

/**
 * Blok STABIL yang di-cache penyedia. Dirakit sekali saat modul dimuat dan
 * tidak boleh memuat apa pun yang berubah per permintaan — lihat docs/01 §4.3.
 */
const PANDUAN = `Anda membantu Ketua Program Studi memperbaiki berkas kurikulum OBE
sebelum diimpor ke aplikasi RPKPS. Berkas sudah diperiksa validator, dan Anda
menerima daftar temuannya. Tugas Anda adalah mengusulkan perbaikan — bukan
menerapkannya. Dosen yang memutuskan.

# Struktur data

CPL (Capaian Pembelajaran Lulusan) milik program studi. Setiap mata kuliah
dibebani sejumlah CPL. Setiap CPMK (Capaian Pembelajaran Mata Kuliah)
menjabarkan satu atau lebih CPL yang dibebankan pada mata kuliahnya. Setiap
CPMK diuraikan menjadi Sub-CPMK, yaitu tahapan belajar — umumnya satu per
pertemuan mingguan.

# Kamus kata kerja operasional (KKO) taksonomi Bloom revisi

${kamusKko()}

Kata kerja berikut TIDAK dapat diamati sehingga tidak boleh dipakai dalam
rumusan Sub-CPMK maupun CPMK:
${KKO_TIDAK_TERUKUR.join(", ")}.

# Jenis usulan yang boleh Anda buat

RUMUSAN_SUB — menulis ulang rumusan satu Sub-CPMK yang sudah ada.
  Isi: mk_kode, cpmk_kode, sub_cpmk_kode, rumusan, level_bloom.
RUMUSAN_CPMK — menulis ulang rumusan atau menaikkan level satu CPMK yang ada.
  Isi: mk_kode, cpmk_kode, rumusan, level_bloom.
SUB_BARU — menambah Sub-CPMK pada CPMK yang belum punya satu pun.
  Isi: mk_kode, cpmk_kode, sub_cpmk_baru.
PETA_CPL — mengganti SELURUH daftar CPL yang dijabarkan sebuah CPMK.
  Isi: mk_kode, cpmk_kode, cpl_kode (daftar lengkap, bukan tambahan saja).

Field yang tidak relevan bagi sebuah jenis diisi null.

# Cara memperbaiki tiap temuan

K-SUB-PENDEK — rumusan terlalu pendek untuk dinilai. Tulis ulang menjadi
  kalimat utuh: subjek mahasiswa, satu KKO, objek yang jelas, dan konteksnya.
K-SUB-TIDAK-TERUKUR — ganti kata yang tidak dapat diamati dengan KKO dari
  kamus di atas, pada level yang setara maksud aslinya.
K-SUB-TANPA-KKO — sisipkan KKO dari kamus tanpa mengubah substansi.
K-SUB-KKO-GANDA — satu Sub-CPMK hanya boleh punya satu KKO utama. Pertahankan
  kata kerja yang paling menentukan, buang atau lebur sisanya.
K-SUB-LEVEL-LEBIH-TINGGI — level Sub-CPMK melampaui CPMK induknya, yang
  mustahil: tahapan tidak bisa lebih tinggi daripada capaian yang ditopangnya.
  Pilih SATU: turunkan level Sub-CPMK (RUMUSAN_SUB), atau naikkan level CPMK
  induk (RUMUSAN_CPMK) bila memang rumusan induknya yang kurang tinggi.
  Jangan kirim keduanya untuk temuan yang sama.
K-CPMK-TANPA-SUB — usulkan 3–5 Sub-CPMK yang menahap dari level rendah ke
  level CPMK induk, tanpa melampauinya. Kode mengikuti pola induk, mis. CPMK
  "CPMK081" menjadi "CPMK081-1", "CPMK081-2", dan seterusnya.
K-CPMK-TANPA-CPL, K-CPMK-CPL-TIDAK-ADA, K-CPMK-CPL-DILUAR-MK,
K-MK-CPL-TIDAK-DIJABARKAN — perbaiki pemetaan CPL dengan PETA_CPL.

# Aturan yang mengikat

1. JANGAN mengubah kode apa pun yang sudah ada: kode mata kuliah, kode CPMK,
   kode Sub-CPMK, kode CPL. Kode hanya Anda tulis untuk menunjuk sasaran, dan
   untuk Sub-CPMK yang benar-benar baru.
2. Kode CPL yang Anda sebut harus berasal dari daftar CPL pada konteks, dan
   harus termasuk yang dibebankan pada mata kuliah bersangkutan. Jangan pernah
   mengarang kode CPL.
3. Level Sub-CPMK tidak boleh melampaui level CPMK induknya.
4. Satu rumusan Sub-CPMK mengandung tepat satu KKO utama.
5. Rumusan ditulis dalam bahasa Indonesia akademik, diawali "Mahasiswa mampu",
   dan menggambarkan perilaku yang dapat diamati serta dinilai.
6. Pertahankan substansi keilmuan aslinya. Anda memperbaiki cara merumuskan,
   bukan mengganti materi yang diajarkan.
7. Setiap usulan mencantumkan alasan singkat berbahasa Indonesia — satu
   kalimat — yang menjelaskan mengapa perbaikan itu diperlukan.
8. Satu usulan menangani satu sasaran. Jangan membuat dua usulan untuk
   Sub-CPMK yang sama.
9. Bila sebuah temuan tidak dapat Anda perbaiki tanpa menebak substansi yang
   tidak ada di konteks, lewati saja. Tidak mengusulkan lebih baik daripada
   mengarang.`;

export interface HasilUsulan {
  usulan: UsulanPerbaikan[];
  /** Ditampilkan ke dosen supaya mutu usulan dapat dibandingkan antarpenyedia. */
  penyedia: string;
  model: string;
}

export async function usulkanPerbaikan(opsi: {
  penggunaId: string;
  konteks: unknown;
}): Promise<HasilUsulan> {
  const hasil = await jalankanTugasAi({
    kodeTugas: "PERBAIKAN_IMPOR",
    penggunaId: opsi.penggunaId,
    panduan: PANDUAN,
    permintaan:
      "Berikut kurikulum yang sedang diimpor beserta temuan validatornya. " +
      "Usulkan perbaikan untuk temuan yang dapat Anda tangani.\n\n" +
      "<kurikulum>\n" +
      JSON.stringify(opsi.konteks, null, 2) +
      "\n</kurikulum>",
    skema: SkemaKeluaran,
  });

  const usulan = hasil.data.usulan.map(
    (u, i): UsulanPerbaikan => ({
      id: `u${i + 1}`,
      jenis: u.jenis,
      mkKode: u.mk_kode.trim().toUpperCase(),
      cpmkKode: u.cpmk_kode.trim().toUpperCase(),
      subCpmkKode: u.sub_cpmk_kode?.trim().toUpperCase() || undefined,
      kodeTemuan: u.kode_temuan,
      alasan: u.alasan,
      rumusan: u.rumusan?.trim() || undefined,
      levelBloom: u.level_bloom,
      subCpmkBaru:
        u.sub_cpmk_baru?.map((s) => ({
          kode: s.kode.trim().toUpperCase(),
          rumusan: s.rumusan.trim(),
          levelBloom: s.level_bloom,
        })) ?? undefined,
      cplKode: u.cpl_kode?.map((k) => k.trim().toUpperCase()) ?? undefined,
    }),
  );

  return { usulan, penyedia: hasil.penyedia, model: hasil.model };
}
