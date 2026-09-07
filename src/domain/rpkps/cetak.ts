/**
 * Angka dan tabel yang IDENTIK antara berkas DOCX dan pratinjau naskah.
 *
 * Pratinjau di dalam aplikasi ada supaya dosen tidak perlu mengunduh berkas
 * untuk melihat hasilnya. Janji itu runtuh diam-diam bila keduanya menghitung
 * sendiri-sendiri: skala nilai yang berbeda satu baris, atau ambang kehadiran
 * yang dibulatkan dengan cara lain, tidak memunculkan galat apa pun — hanya
 * pratinjau yang berbohong. Karena itu keduanya di sini, murni dan sekali
 * tulis.
 */

/**
 * Kata keterangan skala nilai, dari `L.keteranganNilai` di
 * `src/lib/dokumen/label.ts` — kuncinya `sangatBaik`, `baik`, `memuaskan`,
 * `kurangMemuaskan`, `sangatTidakMemuaskan`.
 *
 * Bertipe peta, bukan antarmuka berkunci tetap: `LebarkanLabel` di label.ts
 * sudah melebarkan setiap tabel label menjadi `Record<string, string>`, jadi
 * antarmuka yang lebih ketat di sini hanya akan menolak nilai yang sah tanpa
 * menambah jaminan apa pun. Kelengkapan kuncinya dijaga di sana.
 */
export type KeteranganNilai = Readonly<Record<string, string>>;

export interface BarisSkalaNilai {
  rentang: string;
  huruf: string;
  angka: string;
  keterangan: string;
}

/**
 * Skala nilai ITTS. Rentang, huruf, dan angka adalah ketetapan institusi —
 * bukan konfigurasi per mata kuliah — jadi ia ditulis di sini, bukan dibaca
 * dari basis data. Yang berbahasa hanyalah kolom keterangan.
 */
export function skalaNilai(k: KeteranganNilai): BarisSkalaNilai[] {
  return [
    { rentang: "85 – 100", huruf: "A", angka: "4", keterangan: k.sangatBaik },
    { rentang: "80 – 84,99", huruf: "A-", angka: "3,7", keterangan: k.baik },
    { rentang: "75 – 79,99", huruf: "B+", angka: "3,3", keterangan: "" },
    { rentang: "70 – 74,99", huruf: "B", angka: "3,0", keterangan: "" },
    { rentang: "65 – 69,99", huruf: "B-", angka: "2,7", keterangan: k.memuaskan },
    { rentang: "60 – 64,99", huruf: "C+", angka: "2,3", keterangan: "" },
    { rentang: "55 – 59,99", huruf: "C", angka: "2,0", keterangan: "" },
    { rentang: "45 – 54,99", huruf: "D", angka: "1,0", keterangan: k.kurangMemuaskan },
    { rentang: "0 – 44,99", huruf: "E", angka: "0", keterangan: k.sangatTidakMemuaskan },
  ];
}

/** Jumlah pertemuan efektif — dasar aturan kehadiran pada bagian E. */
export function jumlahPertemuanEfektif(
  pertemuan: readonly { jenis: string }[],
): number {
  return pertemuan.filter((p) => p.jenis === "EFEKTIF").length;
}

/** Kehadiran minimal, dibulatkan KE ATAS: setengah pertemuan tidak ada. */
export function minimalKehadiran(persen: number, jumlahEfektif: number): number {
  return Math.ceil((persen / 100) * jumlahEfektif);
}
