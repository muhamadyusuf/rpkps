import { z } from "zod";
import { BENTUK_SOAL, JENIS_PUSTAKA, JENIS_TUGAS } from "@/domain/rpkps/draf";

/**
 * Skema keluaran terstruktur tugas DRAF_RPKPS.
 *
 * Dipisah dari draf-rpkps.ts karena modul itu `server-only` sehingga tidak
 * dapat diimpor uji. Modul ini murni: hanya zod dan konstanta domain.
 *
 * # Mengapa tidak ada satu pun `.nullable()` di sini
 *
 * Structured output mengekang keluaran model lewat grammar hasil kompilasi
 * skema ini, dan grammar itu punya batas ukuran. Melewatinya membuat Anthropic
 * menolak permintaan sebelum model berjalan:
 *
 *   400 invalid_request_error — "The compiled grammar is too large, which
 *   would cause performance issues. Simplify your tool schemas or reduce the
 *   number of strict tools."
 *
 * Yang mahal bagi grammar adalah PERCABANGAN, bukan panjang skema. Setiap
 * `.nullable()` menjadi `anyOf: [string, null]` — satu cabang — dan satu
 * cabang berharga sekitar dua setengah field biasa. Skema draf ini memuat satu
 * dokumen RPKPS utuh, jadi sembilan `.nullable()` saja sudah melewati batas.
 *
 * Diukur langsung ke API pada 2026-08-21, model claude-opus-5:
 *
 *   sembilan .nullable() (bentuk lama)      → DITOLAK   (3.891 aksara)
 *   sama, tanpa .int()                      → DITOLAK   (3.818)
 *   sama, tanpa z.enum()                    → DITOLAK   (3.467)
 *   tanpa .nullable() (bentuk sekarang)     → lolos     (4.084)
 *   tanpa .nullable() + 2 .nullable() lagi  → lolos
 *   tanpa .nullable() + 3 .nullable() lagi  → DITOLAK
 *   tanpa .nullable() + 4 field teks biasa  → lolos
 *   tanpa .nullable() + 8 field teks biasa  → DITOLAK
 *   tanpa .nullable() + 2 field array       → DITOLAK
 *
 * Perhatikan baris ketiga: skema yang LEBIH PENDEK tetap ditolak. Mengecilkan
 * jumlah aksara tidak menolong; mengurangi percabangan yang menolong.
 *
 * # Pemecahan menjadi tiga tahap
 *
 * Saran pada catatan di atas — "pecah penyusunan draf menjadi beberapa
 * panggilan, masing-masing dengan skema sendiri" — sudah dijalankan. Bukan
 * karena skemanya tumbuh, melainkan karena satu panggilan 32.000 token
 * keluaran memakan kuota gratis penyedia dengan cara yang paling boros:
 * ketika ia gagal di tengah, SELURUH anggaran itu hangus tanpa menghasilkan
 * apa pun, dan pada penyedia yang menghitung `max_tokens` terhadap batas
 * token-per-menit, memesan 32.000 untuk kebutuhan nyata ~7.000 ikut membakar
 * jatah yang tidak pernah dipakai.
 *
 * Tiga tahap, masing-masing dengan skema sendiri:
 *
 *   1. KERANGKA   — deskripsi, kalimat pembuka, komponen nilai, pustaka baru,
 *                   dan alokasi bobot tiap minggu. Seluruh ARITMETIKA
 *                   diputuskan di sini, sekali, dalam panggilan terkecil.
 *   2. PERTEMUAN  — isi tiap minggu efektif. Bobotnya DIBERIKAN dari tahap 1,
 *                   jadi tahap ini murni prosa dan tidak dapat merusak jumlah.
 *   3. TUGAS+KISI — lembar rencana tugas dan kisi-kisi UTS/UAS, memakai
 *                   komponen nilai yang sudah ditetapkan tahap 1.
 *
 * Ikutan yang menyenangkan: tiap grammar kini jauh di bawah ambang, sehingga
 * larangan `.nullable()` sebenarnya sudah longgar. Larangan itu tetap
 * dipertahankan agar bentuk sentinel-nya seragam di ketiga tahap dan
 * susunDraf() tidak perlu menangani dua konvensi sekaligus.
 * skema-draf.test.ts menjaga ambang ini untuk tiap tahap.
 *
 * # Sentinel pengganti null
 *
 * Tanpa null, "tidak ada" diwakili string kosong untuk teks dan 0 untuk
 * durasi_menit. PANDUAN memberitahukannya ke model; susunDraf() yang
 * mengembalikan sentinel itu menjadi null sebelum masuk domain.
 *
 * # Enum tidak ditegakkan grammar
 *
 * zodOutputFormat membuang kata kunci yang tak didukung ke `description`,
 * termasuk `enum`. Jadi z.enum() di bawah ini hanya menjadi petunjuk bagi
 * model, bukan jaminan — nilainya tetap wajib diperiksa periksaDraf() di
 * domain, seperti nilai lainnya.
 */

const LEVEL = z.enum([
  "C1", "C2", "C3", "C4", "C5", "C6",
  "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5",
]);

/** Tahap 1 — kerangka dokumen dan seluruh keputusan aritmetika. */
export const SkemaKerangka = z.object({
  deskripsi: z.string(),
  kalimat_pembuka_cpmk: z.string(),
  komponen_nilai: z.array(z.object({ nama: z.string(), bobot: z.number() })),
  pustaka_baru: z.array(
    z.object({
      jenis: z.enum(JENIS_PUSTAKA),
      nomor: z.number().int(),
      teks: z.string(),
      /** "" bila pustaka tidak punya URL. */
      url: z.string(),
    }),
  ),
  /**
   * Alokasi bobot penilaian tiap minggu — termasuk minggu UJIAN, karena di
   * sanalah bobot UTS/UAS hidup.
   *
   * `komponen` adalah bagian terpenting dari tahap ini dan sebabnya ada di
   * docs/12 §1: tanpa nama komponen di tiap baris, seluruh lembar tugas
   * terbaca sebagai bobot tambahan dan dokumen keluar dengan total 200%.
   * Minggu tak dinilai mengisi bobot 0 dan komponen "".
   *
   * Jumlahnya wajib 100 dan sama dengan total komponen_nilai — dua angka yang
   * harus cocok, diputuskan bersamaan dalam satu panggilan agar model tidak
   * perlu mengingat keputusannya sendiri lintas panggilan.
   */
  bobot_minggu: z.array(
    z.object({
      minggu: z.number().int(),
      bobot: z.number(),
      komponen: z.string(),
    }),
  ),
});

/** Tahap 2 — isi tiap minggu efektif. Bobot TIDAK ada di sini; ia diberikan. */
export const SkemaPertemuan = z.object({
  pertemuan: z.array(
    z.object({
      minggu: z.number().int(),
      topik: z.string(),
      subtopik: z.array(z.string()),
      metode_narasi: z.string(),
      aktivitas_dosen: z.string(),
      aktivitas_mahasiswa: z.string(),
      /** "" bila minggu itu tidak menuntut pekerjaan di luar kelas. */
      tugas_terstruktur: z.string(),
      /** Keduanya "" bila minggu itu tidak dinilai. */
      penilaian_jenis: z.string(),
      penilaian_sistem: z.string(),
      indikator: z.array(z.string()),
      pustaka_ref: z.array(z.string()),
    }),
  ),
});

/** Tahap 3 — lembar rencana tugas dan kisi-kisi ujian. */
export const SkemaTugasKisi = z.object({
  tugas: z.array(
    z.object({
      nomor: z.number().int(),
      nama: z.string(),
      // Hanya dua nilai ini yang ada pada enum JenisTugas di basis data.
      jenis: z.enum(JENIS_TUGAS),
      minggu_mulai: z.number().int(),
      minggu_selesai: z.number().int(),
      bobot: z.number(),
      komponen_nilai: z.string(),
      deskripsi: z.string(),
      uraian_tugas: z.string(),
      format_luaran: z.string(),
      sub_cpmk_kode: z.array(z.string()),
      kriteria: z.array(
        z.object({
          nomor: z.number().int(),
          indikator: z.string(),
          rincian: z.array(z.string()),
          bobot: z.number(),
        }),
      ),
    }),
  ),
  kisi_kisi: z.array(
    z.object({
      jenis: z.enum(["UTS", "UAS"]),
      /** 0 bila durasi belum ditetapkan. */
      durasi_menit: z.number().int(),
      butir: z.array(
        z.object({
          nomor: z.number().int(),
          sub_cpmk_kode: z.string(),
          level_bloom: LEVEL,
          bentuk: z.enum(BENTUK_SOAL),
          jumlah_butir: z.number().int(),
          skor: z.number(),
          indikator: z.string(),
        }),
      ),
    }),
  ),
});

export type KeluaranKerangka = z.infer<typeof SkemaKerangka>;
export type KeluaranPertemuan = z.infer<typeof SkemaPertemuan>;
export type KeluaranTugasKisi = z.infer<typeof SkemaTugasKisi>;

