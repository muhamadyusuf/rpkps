/**
 * Taksonomi Bloom revisi + kamus Kata Kerja Operasional (KKO) bahasa Indonesia.
 * Acuan: docs/00-konsep-rpkps.md §2 (aturan perumusan CPMK/Sub-CPMK).
 *
 * Dipakai untuk tiga hal:
 *   1. Memvalidasi rumusan CPMK/Sub-CPMK memakai kata kerja terukur
 *   2. Memastikan level Sub-CPMK tidak melampaui CPMK induknya
 *   3. Menjadi daftar pilihan saat dosen menyusun rumusan
 */

export const RANAH = ["KOGNITIF", "AFEKTIF", "PSIKOMOTOR"] as const;
export type Ranah = (typeof RANAH)[number];

export type LevelBloom =
  | "C1" | "C2" | "C3" | "C4" | "C5" | "C6"
  | "A1" | "A2" | "A3" | "A4" | "A5"
  | "P1" | "P2" | "P3" | "P4" | "P5";

export interface InfoLevel {
  level: LevelBloom;
  ranah: Ranah;
  /** Urutan dalam ranahnya, 1 = paling dasar. */
  tingkat: number;
  nama: string;
  kko: string[];
}

export const LEVEL_BLOOM: InfoLevel[] = [
  // ── RANAH KOGNITIF ─────────────────────────────────────────────────────
  // Daftar kognitif mengikuti kamus KKO resmi ITTS (aturan penentuan level
  // pada buku kurikulum). Kata kerja yang sudah ada sebelumnya dipertahankan
  // selama tidak bertabrakan; bila bertabrakan, level ITTS yang dipakai —
  // mis. "menyusun" C6 (bukan C3), "mengidentifikasi" C4 (bukan C1),
  // "menguji" C5 (bukan C4), "membandingkan" C4 (bukan C5).
  //
  // INVARIAN: satu kata kerja hanya boleh muncul di SATU level kognitif.
  // Melanggarnya membuat penentuan level bergantung pada urutan penelusuran,
  // dan itu pernah menghasilkan level yang salah pada impor kurikulum.
  {
    level: "C1", ranah: "KOGNITIF", tingkat: 1, nama: "Mengingat",
    kko: ["menyebutkan", "mendefinisikan", "menuliskan", "menyatakan", "mengurutkan",
      "mencocokkan", "memberi nama", "memberi label", "melukiskan"],
  },
  {
    level: "C2", ranah: "KOGNITIF", tingkat: 2, nama: "Memahami",
    kko: ["menjelaskan", "merangkum", "menerangkan", "mengenali", "memahami",
      "menginterpretasi", "menafsirkan", "membaca", "menangkap", "mendeskripsikan",
      "menguraikan", "mengubah", "mempertahankan", "memperkirakan", "menceritakan",
      "mengelompokkan", "mencontohkan"],
  },
  {
    level: "C3", ranah: "KOGNITIF", tingkat: 3, nama: "Menerapkan",
    kko: ["menerapkan", "menggunakan", "mengimplementasikan", "menyelesaikan", "melakukan",
      "mengadministrasikan", "mengelola", "berkontribusi", "beradaptasi", "menunjukkan",
      "menyajikan", "menentukan", "mengkonfigurasi", "menyiapkan", "mendemonstrasikan",
      "merepresentasikan", "mempresentasikan", "mengaplikasikan", "mengamankan", "menghitung",
      "mendokumentasikan", "mengadopsi", "mengikuti", "memanfaatkan", "melaksanakan",
      "memelihara", "menyampaikan", "berperan", "memberikan", "menyesuaikan",
      "mengumpulkan", "mencari", "berdiskusi", "merespons", "memfasilitasi", "mengakses",
      "mengoperasikan", "memproses", "mempraktikkan"],
  },
  {
    level: "C4", ranah: "KOGNITIF", tingkat: 4, nama: "Menganalisis",
    kko: ["menganalisis", "mengidentifikasi", "membandingkan", "mendiagnosis", "mengeksplorasi",
      "mengorganisasikan", "mendeteksi", "menelusuri", "memonitor", "menghubungkan",
      "membedakan", "memantau", "mengkaji", "mengaitkan",
      "memecah", "menelaah", "memilah", "menyimpulkan", "memeriksa"],
  },
  {
    level: "C5", ranah: "KOGNITIF", tingkat: 5, nama: "Mengevaluasi",
    kko: ["mengevaluasi", "menilai", "mengkritik", "mengkritisi", "menguji",
      "memilih", "merekomendasikan", "memvalidasi", "mengaudit", "mengoptimalkan",
      "mengukur", "mengambil keputusan", "merefleksikan", "berargumentasi",
      "memutuskan", "mempertimbangkan", "membuktikan", "menyanggah"],
  },
  {
    level: "C6", ranah: "KOGNITIF", tingkat: 6, nama: "Mencipta",
    kko: ["merancang", "mengembangkan", "membuat", "merumuskan", "mengintegrasikan",
      "menyusun", "mendesain", "memformulasikan", "mengusulkan", "memproduksi",
      "membangun", "memperbaiki", "memperbarui", "menulis", "membentuk",
      "menciptakan", "menghasilkan", "mengkonstruksi", "merekonstruksi", "mengarang",
      "menyintesis"],
  },

  // ── RANAH AFEKTIF & PSIKOMOTOR ─────────────────────────────────────────
  // Tidak tercakup kamus ITTS, jadi dibiarkan apa adanya. Beberapa kata kerja
  // di sini juga terdaftar di ranah kognitif; PETA_KKO di bawah menyelesaikan
  // ambiguitasnya dengan selalu memenangkan ranah kognitif.
  { level: "A1", ranah: "AFEKTIF", tingkat: 1, nama: "Menerima",
    kko: ["menanyakan", "memilih", "mengikuti", "menjawab", "mendengarkan", "memperhatikan"] },
  { level: "A2", ranah: "AFEKTIF", tingkat: 2, nama: "Menanggapi",
    kko: ["menjawab", "membantu", "mematuhi", "melaporkan", "menyambut", "berpartisipasi"] },
  { level: "A3", ranah: "AFEKTIF", tingkat: 3, nama: "Menilai",
    kko: ["menunjukkan", "melaksanakan", "mengusulkan", "menyatakan pendapat", "mengargumentasikan"] },
  { level: "A4", ranah: "AFEKTIF", tingkat: 4, nama: "Mengelola",
    kko: ["mengubah", "menata", "mengintegrasikan", "mengorganisasikan", "menyusun rencana"] },
  { level: "A5", ranah: "AFEKTIF", tingkat: 5, nama: "Menghayati",
    kko: ["membiasakan", "menunjukkan sikap", "mempertahankan", "mempengaruhi", "menerapkan nilai"] },

  { level: "P1", ranah: "PSIKOMOTOR", tingkat: 1, nama: "Meniru",
    kko: ["menyalin", "mengikuti", "mereplikasi", "mengulangi", "meniru"] },
  { level: "P2", ranah: "PSIKOMOTOR", tingkat: 2, nama: "Manipulasi",
    kko: ["membuat kembali", "membangun", "melaksanakan", "menerapkan", "mengerjakan"] },
  { level: "P3", ranah: "PSIKOMOTOR", tingkat: 3, nama: "Presisi",
    kko: ["menunjukkan", "menyelesaikan", "mengkalibrasi", "mengendalikan", "menyempurnakan"] },
  { level: "P4", ranah: "PSIKOMOTOR", tingkat: 4, nama: "Artikulasi",
    kko: ["membangun", "mengadaptasi", "memodifikasi", "merumuskan", "memadukan"] },
  { level: "P5", ranah: "PSIKOMOTOR", tingkat: 5, nama: "Naturalisasi",
    kko: ["mendesain", "menciptakan", "mengelola", "menemukan", "membiasakan"] },
];

const PETA_LEVEL = new Map(LEVEL_BLOOM.map((l) => [l.level, l]));

export function infoLevel(level: LevelBloom): InfoLevel {
  const info = PETA_LEVEL.get(level);
  if (!info) throw new Error(`Level Bloom "${level}" tidak dikenal.`);
  return info;
}

/**
 * Kata kerja yang tidak terukur — menggambarkan keadaan batin yang tidak dapat
 * diamati, sehingga tidak bisa dijadikan dasar penilaian.
 *
 * "memahami" TIDAK ada di daftar ini meski secara teori tidak terukur: kamus
 * KKO ITTS memetakannya ke C2, dan aplikasi mengikuti standar institusi.
 */
export const KKO_TIDAK_TERUKUR = [
  "mengetahui", "mengerti", "menghayati", "menyadari",
  "mempelajari", "belajar", "terbiasa", "familiar", "menguasai",
  "mendalami", "mengenal", "meyakini", "menikmati",
];

const AWALAN_ABAIKAN = [
  "mahasiswa", "peserta didik", "siswa", "praktikan",
  "mampu", "dapat", "akan", "harus", "bisa",
  "setelah", "menyelesaikan", "mengikuti", "mata", "kuliah", "ini",
];

function kataKata(teks: string): string[] {
  return teks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Kata kerja → level, dengan ranah KOGNITIF selalu menang.
 *
 * Beberapa kata kerja terdaftar di ranah kognitif DAN afektif/psikomotor
 * ("menerapkan" C3+P2, "membangun" C6+P2+P4). Tanpa peta ini setiap pemanggil
 * merakit petanya sendiri, dan siapa pun yang memakai pola "entri terakhir
 * menang" akan mengira kata-kata itu psikomotor lalu membuangnya dari
 * perhitungan kognitif. Itu sudah pernah terjadi dan merusak level pada 118
 * dari 756 Sub-CPMK saat impor kurikulum. Pakai peta ini, jangan bikin sendiri.
 */
const PETA_KKO: Map<string, InfoLevel> = (() => {
  const peta = new Map<string, InfoLevel>();
  for (const l of LEVEL_BLOOM) {
    for (const k of l.kko) {
      const ada = peta.get(k);
      if (!ada || (ada.ranah !== "KOGNITIF" && l.ranah === "KOGNITIF")) peta.set(k, l);
    }
  }
  return peta;
})();

/** Level sebuah kata kerja operasional, atau null bila tidak dikenal kamus. */
export function levelKko(kko: string): LevelBloom | null {
  return PETA_KKO.get(kko.toLowerCase())?.level ?? null;
}

/**
 * Level yang MENGATUR sebuah rumusan: level kognitif TERTINGGI di antara kata
 * kerja yang dikenali.
 *
 * Mengikuti aturan penentuan level pada buku kurikulum ITTS (rumus IFS yang
 * memeriksa C6 lebih dulu, lalu turun sampai C1). Konsekuensinya sama:
 * kata kerja di anak kalimat tujuan ikut terhitung, sehingga "menerapkan X
 * untuk membangun Y" menghasilkan C6. Perbedaannya, di sini pencocokan
 * memakai batas kata, bukan substring — "menulis" (C6) tidak akan tertangkap
 * di dalam "menuliskan" (C1).
 */
export function levelDariRumusan(rumusan: string): LevelBloom | null {
  const kognitif = hitungKkoBerbeda(rumusan)
    .map((k) => PETA_KKO.get(k))
    .filter((i): i is InfoLevel => i?.ranah === "KOGNITIF");
  if (kognitif.length === 0) return null;
  return kognitif.sort((a, b) => b.tingkat - a.tingkat)[0].level;
}

/**
 * Menebak kata kerja operasional utama dari sebuah rumusan.
 * Mengembalikan kata kerja pertama yang dikenali kamus, atau null.
 */
export function deteksiKko(rumusan: string): { kko: string; level: LevelBloom } | null {
  const teks = rumusan.toLowerCase();

  // Frasa lebih panjang diperiksa lebih dulu agar "menyatakan pendapat"
  // tidak keburu tertangkap sebagai "menyatakan".
  const kandidat = [...PETA_KKO].map(([kko, info]) => ({
    kko, level: info.level, panjang: kko.length,
  })).sort((a, b) => b.panjang - a.panjang);

  for (const k of kandidat) {
    const pola = new RegExp(`\\b${k.kko.replace(/\s+/g, "\\s+")}\\b`, "u");
    if (pola.test(teks)) return { kko: k.kko, level: k.level };
  }
  return null;
}

/** Kata kerja tidak terukur yang muncul pada rumusan. */
export function deteksiKkoTidakTerukur(rumusan: string): string[] {
  const teks = rumusan.toLowerCase();
  return KKO_TIDAK_TERUKUR.filter((k) => new RegExp(`\\b${k}\\b`, "u").test(teks));
}

/**
 * Menghitung jumlah kata kerja operasional berbeda dalam satu rumusan.
 * Lebih dari satu berarti rumusan mengandung lebih dari satu kemampuan dan
 * sebaiknya dipecah — kalau tidak, penilaiannya jadi ambigu.
 */
export function hitungKkoBerbeda(rumusan: string): string[] {
  const teks = rumusan.toLowerCase();
  const ditemukan = new Set<string>();
  for (const l of LEVEL_BLOOM) {
    for (const k of l.kko) {
      if (new RegExp(`\\b${k.replace(/\s+/g, "\\s+")}\\b`, "u").test(teks)) {
        ditemukan.add(k);
      }
    }
  }
  return [...ditemukan];
}

/** Membandingkan dua level. Lintas ranah tidak dapat dibandingkan (null). */
export function bandingkanLevel(a: LevelBloom, b: LevelBloom): number | null {
  const ia = infoLevel(a);
  const ib = infoLevel(b);
  if (ia.ranah !== ib.ranah) return null;
  return ia.tingkat - ib.tingkat;
}

export function kataBermakna(rumusan: string): string[] {
  return kataKata(rumusan).filter((k) => !AWALAN_ABAIKAN.includes(k));
}
