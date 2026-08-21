import { createHash } from "node:crypto";

/**
 * Serialisasi kanonik dan sidik dokumen.
 *
 * Sidik dipakai untuk membuktikan bahwa berkas yang dicetak hari ini identik
 * dengan yang disahkan Ketua Program Studi. Karena itu serialisasinya harus
 * DETERMINISTIK: urutan kunci objek pada JSON tidak dijamin stabil antar
 * runtime maupun antar versi Prisma, sehingga kunci diurutkan sebelum di-hash.
 */

export function serialisasiKanonik(nilai: unknown): string {
  return JSON.stringify(urutkan(nilai));
}

function urutkan(nilai: unknown): unknown {
  if (nilai === null || typeof nilai !== "object") return nilai;
  if (nilai instanceof Date) return nilai.toISOString();
  if (Array.isArray(nilai)) return nilai.map(urutkan);

  // Decimal Prisma dan objek sejenis punya toJSON/toString sendiri.
  const objek = nilai as Record<string, unknown> & { toJSON?: () => unknown };
  if (typeof objek.toJSON === "function") return urutkan(objek.toJSON());

  const hasil: Record<string, unknown> = {};
  for (const kunci of Object.keys(objek).sort()) {
    const isi = objek[kunci];
    if (isi === undefined) continue; // undefined tidak stabil pada JSON
    hasil[kunci] = urutkan(isi);
  }
  return hasil;
}

export function hitungSidik(nilai: unknown): string {
  return createHash("sha256").update(serialisasiKanonik(nilai)).digest("hex");
}

/** "a1b2c3d4 · e5f6g7h8" — bentuk pendek untuk dicetak di dokumen. */
export function sidikRingkas(sidik: string): string {
  return `${sidik.slice(0, 8)} · ${sidik.slice(8, 16)}`;
}

/** Isi salinan beku: dokumen apa adanya saat terbit, plus riwayatnya. */
export interface IsiSnapshot {
  dokumen: unknown;
  riwayat: { versi: number; dibuatPada: string; deskripsi: string }[];
}

/** Mengembalikan bentuk siap render dari salinan beku (tanggal dihidupkan). */
export function cairkanSnapshot<T>(isi: IsiSnapshot): {
  rpkps: T;
  riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
} {
  return {
    rpkps: isi.dokumen as T,
    riwayat: isi.riwayat.map((h) => ({
      versi: h.versi,
      dibuatPada: new Date(h.dibuatPada),
      deskripsi: h.deskripsi,
    })),
  };
}
