/**
 * Arahan bebas dosen untuk penyusunan draf AI (docs/20).
 *
 * Dua pekerjaan yang sengaja dipisah, karena keduanya menjawab pertanyaan yang
 * berbeda:
 *
 * - `bersihkanArahan` menyiapkan teks untuk DISIMPAN. Hasilnya dibaca manusia
 *   kembali di dalam textarea, jadi ia tidak boleh mengandung entitas HTML.
 * - `amplopArahan` menyiapkan teks untuk DIKIRIM ke model. Di sanalah `<` dan
 *   `>` di-escape, supaya tidak ada cara menulis penutup tag lalu melanjutkan
 *   seolah-olah sebagai panduan.
 *
 * Menggabungkan keduanya menjadi satu fungsi berarti memilih salah satu
 * korban: kolom basis data yang penuh `&lt;`, atau amplop yang dapat ditutup
 * penulisnya sendiri.
 *
 * Yang TIDAK ada di sini, dan memang tidak boleh ada: penilaian atas isi
 * arahan. Penjaga draf tetap `periksaDraf()`, yang berjalan tanpa mengetahui
 * ada arahan sama sekali.
 */

/**
 * Batas panjang arahan.
 *
 * Bukan semata soal biaya — teksnya dikirim ke ketiga tahap, jadi tiap
 * karakter terhitung tiga kali. Yang lebih menentukan: arahan sepanjang satu
 * halaman bersaing bobotnya dengan panduan, dan biasanya menandakan dosen
 * sebenarnya ingin menyunting dokumen, bukan memandu draf.
 */
export const BATAS_ARAHAN = 1000;

export interface ArahanBersih {
  /** Kosong menjadi `null`, bukan string kosong: blok arahan tidak dikirim. */
  arahan: string | null;
  /** Benar bila teks aslinya melampaui `BATAS_ARAHAN` dan dipangkas. */
  dipotong: boolean;
}

/**
 * Merapikan arahan yang diketik dosen menjadi bentuk yang disimpan.
 *
 * Dipanggil di server — `maxLength` pada textarea hanyalah kenyamanan dan
 * tidak menjaga apa pun.
 */
export function bersihkanArahan(teks: string | null | undefined): ArahanBersih {
  if (typeof teks !== "string") return { arahan: null, dipotong: false };

  const rapi = teks
    .replace(/\r\n?/g, "\n")
    // Baris kosong beruntun menjadi satu. Arahan yang ditempel dari dokumen
    // lain sering membawa selusin baris kosong yang tidak berarti apa pun bagi
    // model tetapi tetap dihitung terhadap batas.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (rapi === "") return { arahan: null, dipotong: false };
  if (rapi.length <= BATAS_ARAHAN) return { arahan: rapi, dipotong: false };

  // Dipangkas, lalu di-trim lagi: potongan yang berakhir di tengah spasi
  // meninggalkan ekor yang tidak perlu ikut tersimpan.
  const potong = rapi.slice(0, BATAS_ARAHAN).trimEnd();
  return { arahan: potong === "" ? null : potong, dipotong: true };
}

/**
 * Membungkus arahan menjadi blok yang siap disisipkan ke bagian `permintaan`.
 *
 * Mengembalikan string KOSONG bila tidak ada arahan, sehingga pemanggil dapat
 * merangkainya begitu saja tanpa percabangan — dan blok `<arahan_dosen>` yang
 * kosong tidak pernah sampai ke model, karena blok kosong terbaca sebagai
 * "dosen tidak punya arahan" dengan cara yang paling boros.
 */
export function amplopArahan(arahan: string | null | undefined): string {
  if (!arahan) return "";
  const aman = arahan.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `\n\n<arahan_dosen>\n${aman}\n</arahan_dosen>`;
}
