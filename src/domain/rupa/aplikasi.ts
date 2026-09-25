/**
 * Aplikasi terhubung di pusat kontrol (docs/28 §4.2; registri: docs/27 §6.6) —
 * daftar yang dibaca dari registri identitas-itts (`GET /api/v1/aplikasi`).
 *
 * Murni: tanpa jaringan, tanpa React. Yang masuk jawaban JSON apa adanya,
 * yang keluar daftar yang AMAN dirender sebagai `href`. Jawaban itu datang
 * dari layanan lain, jadi setiap medannya diperiksa ulang di sini — terutama
 * alamatnya: `javascript:` yang lolos ke pusat kontrol adalah skrip yang dijalankan di
 * asal-usul RPKPS dengan sekali klik.
 */

/** Warna ubin — nilainya sama dengan identitas-itts (`--color-ubin-*`). */
export const WARNA_UBIN = [
  "biru",
  "hijau",
  "jingga",
  "ungu",
  "nila",
  "merah",
  "teal",
  "abu",
  "kuning",
  "cokelat",
  "merahmuda",
  "grafit",
] as const;
export type WarnaUbin = (typeof WARNA_UBIN)[number];

/**
 * Kosakata ikon registri. Subset nama ikon identitas-itts yang punya padanan
 * di RPKPS; registri di sana menolak nama di luar daftar yang sama.
 */
export const IKON_APLIKASI = [
  "aplikasi",
  "buku",
  "unit",
  "orang",
  "orangBanyak",
  "pohon",
  "grafik",
  "rumah",
  "bola",
  "kunci",
  "perisai",
  "layar",
  "daftar",
  "pena",
  "bidik",
] as const;
export type IkonAplikasi = (typeof IKON_APLIKASI)[number];

export type AplikasiTerhubung = {
  klienId: string;
  nama: string;
  href: string;
  ikon: IkonAplikasi;
  warna: WarnaUbin;
};

/** Panel bukan daftar tak berujung: sisanya diabaikan, bukan dipaksa muat. */
export const BATAS_APLIKASI = 12;
const BATAS_NAMA = 40;

function bolehDariDaftar<T extends string>(daftar: readonly T[], nilai: unknown, cadangan: T): T {
  return typeof nilai === "string" && (daftar as readonly string[]).includes(nilai)
    ? (nilai as T)
    : cadangan;
}

/** Hanya http/https. Mengembalikan alamat yang sudah dinormalkan, atau null. */
export function alamatAman(nilai: unknown): string | null {
  if (typeof nilai !== "string" || nilai.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(nilai.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

/**
 * Mengurai jawaban registri. Butir yang cacat DIBUANG satu per satu, bukan
 * menggagalkan seluruh daftar: satu aplikasi yang salah didaftarkan tidak
 * boleh menghapus aplikasi lain dari pusat kontrol setiap orang.
 *
 * `klienSendiri` — RPKPS tidak menautkan dirinya sendiri.
 */
export function uraiDaftarAplikasi(json: unknown, klienSendiri: string): AplikasiTerhubung[] {
  if (typeof json !== "object" || json === null) return [];
  const daftar = (json as { aplikasi?: unknown }).aplikasi;
  if (!Array.isArray(daftar)) return [];

  const hasil: AplikasiTerhubung[] = [];
  const terlihat = new Set<string>();
  for (const butir of daftar) {
    if (hasil.length >= BATAS_APLIKASI) break;
    if (typeof butir !== "object" || butir === null) continue;
    const b = butir as Record<string, unknown>;

    const klienId = typeof b.klien_id === "string" ? b.klien_id.trim() : "";
    if (!klienId || klienId === klienSendiri || terlihat.has(klienId)) continue;

    const nama = typeof b.nama === "string" ? b.nama.trim().slice(0, BATAS_NAMA) : "";
    const href = alamatAman(b.url);
    if (!nama || !href) continue;

    terlihat.add(klienId);
    hasil.push({
      klienId,
      nama,
      href,
      ikon: bolehDariDaftar(IKON_APLIKASI, b.ikon, "aplikasi"),
      warna: bolehDariDaftar(WARNA_UBIN, b.warna, "nila"),
    });
  }
  return hasil;
}
