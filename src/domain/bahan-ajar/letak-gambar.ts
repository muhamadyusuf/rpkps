import type { TemuanBahanAjar } from "./tipe";

/**
 * Penempatan dan penomoran gambar dalam bab — docs/17 §4.4.
 *
 * Model menyebut `letak` sebuah gambar dengan menyalin judul subbab. Salinan
 * itu tidak selalu persis: spasi ganda, penomoran yang ikut atau tidak ikut,
 * huruf besar di awal. Karena itu pencocokannya dinormalkan — dan yang tetap
 * tidak cocok TIDAK PERNAH DIBUANG, melainkan jatuh ke akhir bab dan ditandai.
 *
 * Gambar yang hilang diam-diam adalah kegagalan yang paling mahal di sini:
 * dosen menyetujui sepuluh diagram, mencetak bukunya, dan menemukan tujuh.
 *
 * Murni: tanpa Prisma, tanpa React.
 */

export interface GambarUntukLetak {
  /** Urutan gambar dalam bab, sebagaimana tersimpan. */
  nomor: number;
  judul: string;
  /** Judul subbab yang disebut model; null berarti memang tanpa letak. */
  letak: string | null;
}

export interface PenempatanGambar<T extends GambarUntukLetak> {
  /**
   * Indeks subbab (berbasis 0) yang gambar-gambar ini menyusul sesudahnya.
   * `null` berarti akhir bab — tempat jatuhnya gambar yang letaknya tidak
   * dikenali maupun yang memang tidak menyebut letak.
   */
  indeksSubbab: number | null;
  gambar: T[];
}

export interface HasilLetak<T extends GambarUntukLetak> {
  penempatan: PenempatanGambar<T>[];
  /** Nilai `letak` yang tidak cocok dengan satu pun subbab. */
  asing: string[];
  temuan: TemuanBahanAjar[];
}

/**
 * Menormalkan judul subbab untuk dicocokkan.
 *
 * Membuang penomoran di depan ("2.", "2.1 "), merapatkan spasi, dan
 * mengabaikan besar-kecil huruf. Tiga hal itulah yang paling sering berbeda
 * antara judul yang ditulis model pada `letak` dan judul yang ditulisnya
 * sendiri di dalam uraian bab.
 */
export function normalkanJudul(judul: string): string {
  return judul
    .trim()
    .replace(/^\d+(\.\d+)*\.?\s*/, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("id");
}

export function tempatkanGambar<T extends GambarUntukLetak>(
  subbab: readonly string[],
  gambar: readonly T[],
): HasilLetak<T> {
  /*
   * Peta dibangun dari subbab PERTAMA yang memakai sebuah judul. Judul subbab
   * yang berulang dalam satu bab memang tidak lazim, tetapi bila terjadi,
   * memilih yang pertama lebih dapat ditebak daripada yang terakhir.
   */
  const peta = new Map<string, number>();
  subbab.forEach((judul, i) => {
    const kunci = normalkanJudul(judul);
    if (kunci && !peta.has(kunci)) peta.set(kunci, i);
  });

  const perSubbab = new Map<number, T[]>();
  const akhir: T[] = [];
  const asing: string[] = [];

  for (const g of [...gambar].sort((a, b) => a.nomor - b.nomor)) {
    const letak = g.letak?.trim();
    if (!letak) {
      akhir.push(g);
      continue;
    }

    const indeks = peta.get(normalkanJudul(letak));
    if (indeks === undefined) {
      // Ditandai, lalu tetap dicetak. Lihat catatan modul.
      if (!asing.includes(letak)) asing.push(letak);
      akhir.push(g);
      continue;
    }

    const daftar = perSubbab.get(indeks) ?? [];
    daftar.push(g);
    perSubbab.set(indeks, daftar);
  }

  const penempatan: PenempatanGambar<T>[] = [...perSubbab.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([indeksSubbab, gambar]) => ({ indeksSubbab, gambar }));

  if (akhir.length > 0) penempatan.push({ indeksSubbab: null, gambar: akhir });

  const temuan: TemuanBahanAjar[] =
    asing.length > 0
      ? [
          {
            kode: "IL-LETAK-ASING",
            tingkat: "PERINGATAN",
            params: { jumlah: asing.length },
          },
        ]
      : [];

  return { penempatan, asing, temuan };
}

/**
 * Nomor cetak sebuah gambar: "3.2" — bab tiga, gambar kedua.
 *
 * Urutannya adalah URUTAN CETAK, bukan `nomor` tersimpan: gambar yang jatuh ke
 * akhir bab karena letaknya tidak dikenali harus tetap bernomor runtut dengan
 * yang lain. Nomor ini diberikan server, tidak pernah oleh model.
 */
export function nomorGambar(nomorBab: number, urutanCetak: number): string {
  return `${nomorBab}.${urutanCetak}`;
}

/** Seluruh gambar bab menurut urutan cetaknya, sudah bernomor. */
export function urutanCetakGambar<T extends GambarUntukLetak>(
  hasil: HasilLetak<T>,
  nomorBab: number,
): { gambar: T; nomorCetak: string }[] {
  const keluar: { gambar: T; nomorCetak: string }[] = [];
  for (const p of hasil.penempatan) {
    for (const g of p.gambar) {
      keluar.push({ gambar: g, nomorCetak: nomorGambar(nomorBab, keluar.length + 1) });
    }
  }
  return keluar;
}
