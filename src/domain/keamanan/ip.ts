import { isIP } from "node:net";

/**
 * Alamat IP klien dari kepala permintaan.
 *
 * Yang dipercaya hanya kepala yang DIPASANG platform di depan aplikasi, dan
 * urutannya dari yang paling sulit dipalsukan: `x-vercel-forwarded-for` (Vercel
 * menimpanya, klien tidak dapat mengisinya), lalu `x-real-ip`, lalu elemen
 * PERTAMA `x-forwarded-for`.
 *
 * Batasnya perlu diketahui: bila aplikasi dijalankan sendiri di belakang proxy
 * yang MENAMBAHKAN ke `x-forwarded-for` alih-alih menimpanya, elemen pertama
 * adalah kiriman klien dan dapat dipalsukan. Karena itu nilai ini dipakai untuk
 * jejak dan pembatasan laju — bukan sebagai bukti identitas — dan rantai
 * MENTAH-nya disimpan terpisah pada catatan perangkap.
 *
 * Nilai yang bukan IP sah (`isIP` = 0) dibuang, bukan dicatat: kolom ini
 * ditampilkan di layar admin dan dipakai sebagai kunci kueri.
 */

export type KepalaBaca = { get(nama: string): string | null };

const TIDAK_DIKETAHUI = "tidak-diketahui";

function bersihkan(nilai: string | null): string | null {
  if (!nilai) return null;
  let v = nilai.trim();
  // "[::1]:1234" dan "1.2.3.4:5678" — buang nomor porta bila ada.
  const kurung = /^\[([^\]]+)\](?::\d+)?$/.exec(v);
  if (kurung) v = kurung[1];
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(v)) v = v.slice(0, v.lastIndexOf(":"));
  return isIP(v) ? v : null;
}

export function ambilIpKlien(kepala: KepalaBaca): string {
  const vercel = bersihkan(kepala.get("x-vercel-forwarded-for")?.split(",")[0] ?? null);
  if (vercel) return vercel;

  const nyata = bersihkan(kepala.get("x-real-ip"));
  if (nyata) return nyata;

  const teruskan = kepala.get("x-forwarded-for")?.split(",")[0] ?? null;
  return bersihkan(teruskan) ?? TIDAK_DIKETAHUI;
}

/** Rantai mentah `x-forwarded-for`, dipotong; bukti, bukan kunci. */
export function rantaiMentah(kepala: KepalaBaca): string | null {
  const nilai = kepala.get("x-forwarded-for");
  return nilai ? nilai.slice(0, 300) : null;
}

/** IP yang dapat dijangkau layanan geolokasi: bukan loopback, privat, atau link-local. */
export function adalahIpPublik(ip: string): boolean {
  const versi = isIP(ip);
  if (versi === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a >= 224) return false; // multicast dan cadangan
    return true;
  }
  if (versi === 6) {
    const kecil = ip.toLowerCase();
    if (kecil === "::1" || kecil === "::") return false;
    if (kecil.startsWith("fe80") || kecil.startsWith("fc") || kecil.startsWith("fd")) return false;
    const terpetakan = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(kecil);
    return terpetakan ? adalahIpPublik(terpetakan[1]) : true;
  }
  return false;
}
