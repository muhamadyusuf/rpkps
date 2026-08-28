/**
 * Penormalan angka yang WAJIB berjumlah tepat 100.
 *
 * Ada empat tempat di draf RPKPS yang jumlahnya dikunci 100: bobot komponen
 * nilai, bobot mingguan, bobot kriteria tiap tugas, dan skor butir tiap
 * kisi-kisi. Keempatnya sebelum ini diserahkan sepenuhnya kepada model, dan
 * itu keliru: menjumlahkan belasan angka tanpa alat hitung adalah pekerjaan
 * yang tidak dapat diandalkan dari sebuah model bahasa. Hasilnya draf yang
 * isinya bagus tetapi ditolak validator karena berjumlah 105 atau 110 — dosen
 * kehilangan seluruh draf gara-gara aritmetika, bukan gara-gara isinya.
 *
 * Modul ini memperbaikinya secara DETERMINISTIK. Prompt tetap meminta jumlah
 * yang tepat — makin jarang penormalan terpakai, makin dekat hasilnya dengan
 * maksud model — tetapi prompt bukan lagi penjaga terakhirnya.
 *
 * Dua hal yang sengaja TIDAK dilakukan:
 *
 *  1. Penormalan tidak menyentuh angka yang jumlahnya jauh di luar akal
 *     (di luar 50–200). Total 12 atau 900 bukan kesalahan pembulatan
 *     melainkan salah paham terhadap tugasnya, dan mengalikan angka semacam
 *     itu hanya akan menyulap keluaran ngawur menjadi tampak sah. Draf
 *     seperti itu tetap jatuh ke periksaDraf() dan ditolak.
 *  2. Penormalan tidak pernah diam-diam. Pemanggilnya menerima `disesuaikan`
 *     beserta total aslinya untuk ditunjukkan kepada dosen — yang menyetujui
 *     dokumen adalah dia, dan dia berhak tahu angka mana yang bukan berasal
 *     dari model.
 */

/** Batas kewajaran total masukan. Di luar ini, angka tidak dinormalkan. */
export const BATAS_BAWAH = 50;
export const BATAS_ATAS = 200;

/** Selisih yang masih dianggap "sudah 100" — sama dengan toleransi domain. */
const TOLERANSI = 0.01;

export interface HasilNormalisasi {
  /** Nilai yang sudah dinormalkan, dua desimal, berjumlah TEPAT 100. */
  nilai: number[];
  /** Total sebelum dinormalkan, dua desimal. */
  totalAsli: number;
  /** true bila ada angka yang berubah. */
  disesuaikan: boolean;
  /**
   * true bila masukan berada di luar batas kewajaran sehingga sengaja
   * dibiarkan apa adanya untuk ditolak validator.
   */
  diluarBatas: boolean;
}

function bulat2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Menskalakan sederet angka agar berjumlah tepat 100, dengan proporsi tetap.
 *
 * Pembulatannya memakai metode sisa terbesar (largest remainder) di atas
 * satuan sen, bukan pembulatan per angka: membulatkan satu per satu lalu
 * berharap jumlahnya kebetulan pas adalah cara yang sama yang membuat model
 * meleset sejak awal. Dengan sisa terbesar, jumlahnya pas menurut konstruksi.
 *
 * Nilai nol tetap nol — minggu yang memang tidak dinilai tidak boleh mendadak
 * mendapat bobot hanya karena tetangganya dibulatkan.
 */
export function normalisasiKe100(masukan: readonly number[]): HasilNormalisasi {
  // Angka tak hingga, NaN, dan negatif tidak punya arti sebagai bobot.
  const bersih = masukan.map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  const total = bulat2(bersih.reduce((s, n) => s + n, 0));

  const apaAdanya = (diluarBatas: boolean): HasilNormalisasi => ({
    nilai: masukan.map(bulat2),
    totalAsli: total,
    disesuaikan: false,
    diluarBatas,
  });

  if (masukan.length === 0 || total <= 0) return apaAdanya(true);
  if (total < BATAS_BAWAH || total > BATAS_ATAS) return apaAdanya(true);

  // Sudah 100 dan setiap angkanya sudah rapi dua desimal: jangan disentuh.
  const sudahRapi = masukan.every((n) => bulat2(n) === n);
  if (Math.abs(total - 100) <= TOLERANSI && sudahRapi) return apaAdanya(false);

  // ── Sisa terbesar di atas satuan sen ────────────────────────────────
  const skala = 10_000 / bersih.reduce((s, n) => s + n, 0);
  const tepat = bersih.map((n) => n * skala);
  const bawah = tepat.map((n) => Math.floor(n));
  let kurang = 10_000 - bawah.reduce((s, n) => s + n, 0);

  const urutan = tepat
    .map((n, i) => ({ i, sisa: n - Math.floor(n), asli: bersih[i] }))
    // Sisa terbesar didahulukan; seri diputus oleh nilai asli yang lebih
    // besar, lalu oleh urutan — supaya hasilnya sama tiap kali dijalankan.
    .sort((a, b) => b.sisa - a.sisa || b.asli - a.asli || a.i - b.i);

  const sen = [...bawah];
  for (const u of urutan) {
    if (kurang <= 0) break;
    // Nol tetap nol: yang tidak dinilai tidak boleh kebagian sisa pembulatan.
    if (bersih[u.i] === 0) continue;
    sen[u.i] += 1;
    kurang -= 1;
  }

  const nilai = sen.map((s) => bulat2(s / 100));
  return {
    nilai,
    totalAsli: total,
    disesuaikan: nilai.some((n, i) => n !== bulat2(masukan[i])),
    diluarBatas: false,
  };
}
