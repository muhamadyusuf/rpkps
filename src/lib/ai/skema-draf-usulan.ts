import { z } from "zod";
import { JENIS_BOLEH_AI } from "@/domain/kurikulum/draf-usulan";

/**
 * Skema keluaran draf Usulan Revisi Kurikulum — docs/04 §9.
 *
 * Murni: hanya zod. Tanpa `.nullable()`, dengan alasan yang sama seperti skema
 * lain di folder ini — percabangan membengkakkan tata bahasa terkompilasi, dan
 * medan yang tidak berlaku cukup diisi sentinel kosong.
 *
 * # Bentuknya menegakkan poros §9.2
 *
 *   > AI boleh menyusun butir. AI tidak pernah boleh menerbitkan dasar.
 *
 * Karena itu tidak ada medan `dasar_kutipan` di sini. Yang ada `dasar_ref`:
 * model MEMILIH dari katalog yang dirakit server, dan kutipannya nanti disalin
 * server dari katalog itu — bukan dari jawaban model. Satu-satunya teks dasar
 * yang boleh datang dari model adalah `kutipan_catatan`, dan itu pun wajib
 * potongan verbatim catatan yang diketik dosen; keverbatimannya diuji
 * `saringDrafUsulan`, tidak dipercaya.
 *
 * `jenis` mengambil daftarnya dari domain, bukan menuliskannya ulang: jenis
 * yang boleh dikarang model adalah keputusan §9.4, dan dua daftar yang
 * menyimpang diam-diam persis bentuk kegagalan yang paling sulit terlihat —
 * skema menerima `SUB_PENSIUN`, penyaring membuangnya, dan yang terbaca dosen
 * hanyalah "3 butir dibuang" tanpa sebab yang masuk akal.
 */

/**
 * Level taksonomi. Ditulis harfiah karena `z.enum` menuntut tuple, dan
 * kelengkapannya terhadap kamus Bloom dijaga uji, bukan komentar.
 *
 * `""` berarti tidak berlaku bagi jenis butir ini — sentinel, bukan level.
 */
const LEVEL = [
  "C1", "C2", "C3", "C4", "C5", "C6",
  "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5",
  "",
] as const;

export const SkemaDrafUsulan = z.object({
  butir: z.array(
    z.object({
      jenis: z.enum(JENIS_BOLEH_AI),
      /** Kode CPMK sasaran; untuk CPMK_BARU, kode yang diusulkan. */
      cpmk_kode: z.string(),
      /** Kode Sub-CPMK sasaran, atau "" bila butir ini menyangkut CPMK saja. */
      sub_cpmk_kode: z.string(),
      /** Rumusan baru; "" bila jenisnya tidak menuntut rumusan. */
      rumusan: z.string(),
      level_bloom: z.enum(LEVEL),
      /** Daftar CPL LENGKAP bagi CPMK_PETA_CPL; [] bagi jenis lain. */
      cpl_kode: z.array(z.string()),
      /** Usulan pekan pelaksanaan bagi SUB_MINGGU; [] bagi jenis lain. */
      minggu_disarankan: z.array(z.number()),
      /** Mengapa perbaikan ini perlu. Inilah yang dibaca Kaprodi. */
      alasan: z.string(),
      /** Rujukan ke katalog dasar yang dikirim server. Model memilih, tidak menulis. */
      dasar_ref: z.array(z.string()),
      /** Potongan VERBATIM catatan dosen, atau "" bila butir ini tidak bersandar padanya. */
      kutipan_catatan: z.string(),
    }),
  ),
});

export type KeluaranDrafUsulan = z.infer<typeof SkemaDrafUsulan>;

/** Dibaca uji kelengkapan; bukan untuk dipakai di luar berkas ini dan ujinya. */
export const LEVEL_SKEMA = LEVEL;
