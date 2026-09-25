import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { lepasAwalan } from "@/lib/bahasa/jalur";

/**
 * Masuk tunggal lewat identitas-itts (docs/25) — bagian murninya.
 *
 * RPKPS berperan sebagai KLIEN OIDC: alur kode otorisasi + PKCE (S256) yang
 * dilayani `/oauth/*` di identitas-itts. Berkas ini tidak menyentuh jaringan,
 * cookie, maupun basis data — hanya bentuk data dan aturan yang harus benar
 * supaya alurnya aman, agar dapat diuji tanpa menjalankan apa pun.
 */

export const JALUR_MULAI_SSO = "/api/identitas/masuk";
export const JALUR_BALIK_SSO = "/api/identitas/callback";

/**
 * Hanya `openid`. Klaim `email` dan `name` sudah ikut di id_token setiap kali
 * `openid` diminta (identitas-itts, `lib/oidc/token.ts`), dan setiap cakupan
 * tambahan harus terdaftar pada klien — meminta yang tidak terdaftar membuat
 * seluruh alur ditolak di layar galat identitas-itts.
 */
export const CAKUPAN_SSO = "openid";

/** Alur yang tak selesai dalam 10 menit dianggap ditinggalkan. */
export const UMUR_ALUR_SSO_MS = 10 * 60 * 1000;

/** Toleransi selisih jam antar-peladen, untuk cap waktu yang "dari masa depan". */
const TOLERANSI_JAM_MS = 60 * 1000;

export interface AlurSso {
  /** Nilai acak yang harus kembali utuh di alamat balik — penangkal pemalsuan permintaan lintas situs. */
  state: string;
  /** Rahasia PKCE. Tidak pernah keluar dari peladen ini kecuali ke /oauth/token. */
  verifier: string;
  /** Halaman tujuan setelah masuk, TANPA awalan bahasa; null = dasbor. */
  lanjut: string | null;
  /** ms sejak epoch. */
  mulai: number;
}

/** RFC 7636 §4.2: `BASE64URL(SHA256(verifier))`. */
export function tantanganPkce(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function mulaiAlurSso(lanjut: string | null, sekarang: number = Date.now()): AlurSso {
  return {
    state: randomBytes(24).toString("base64url"),
    // 48 bita acak → 64 karakter; RFC 7636 mensyaratkan 43–128.
    verifier: randomBytes(48).toString("base64url"),
    lanjut,
    mulai: sekarang,
  };
}

export function urlOtorisasi(p: {
  basis: string;
  klienId: string;
  redirectUri: string;
  alur: Pick<AlurSso, "state" | "verifier">;
}): string {
  const tujuan = new URL(`${p.basis.replace(/\/+$/, "")}/oauth/authorize`);
  tujuan.searchParams.set("response_type", "code");
  tujuan.searchParams.set("client_id", p.klienId);
  tujuan.searchParams.set("redirect_uri", p.redirectUri);
  tujuan.searchParams.set("scope", CAKUPAN_SSO);
  tujuan.searchParams.set("state", p.alur.state);
  tujuan.searchParams.set("code_challenge", tantanganPkce(p.alur.verifier));
  tujuan.searchParams.set("code_challenge_method", "S256");
  return tujuan.toString();
}

/** Isi cookie alur. Bukan rahasia yang ditandatangani — lihat komentar di `lib/identitas/sso.ts`. */
export function bungkusAlur(alur: AlurSso): string {
  return Buffer.from(JSON.stringify(alur)).toString("base64url");
}

/**
 * Membuka cookie alur. `null` untuk APA PUN yang tidak beres — kosong, rusak,
 * bentuk salah, kedaluwarsa, atau bertanda waktu dari masa depan. Pemanggil
 * tidak perlu (dan tidak boleh) membedakan sebabnya kepada pengguna.
 */
export function bukaAlur(nilai: string | undefined, sekarang: number = Date.now()): AlurSso | null {
  if (!nilai || nilai.length > 2048) return null;
  let mentah: unknown;
  try {
    mentah = JSON.parse(Buffer.from(nilai, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!mentah || typeof mentah !== "object") return null;
  const { state, verifier, lanjut, mulai } = mentah as Record<string, unknown>;

  if (typeof state !== "string" || state.length < 16) return null;
  if (typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return null;
  if (lanjut !== null && typeof lanjut !== "string") return null;
  if (typeof mulai !== "number" || !Number.isFinite(mulai)) return null;
  if (sekarang - mulai > UMUR_ALUR_SSO_MS) return null;
  if (mulai - sekarang > TOLERANSI_JAM_MS) return null;

  // `lanjut` diperiksa ULANG: cookie ini datang dari peramban.
  return { state, verifier, lanjut: lanjutAman(lanjut), mulai };
}

/** Perbandingan `state` berwaktu-tetap. */
export function cocokState(dariCookie: string, dariAlamat: string | null | undefined): boolean {
  if (!dariAlamat) return false;
  const a = Buffer.from(dariCookie);
  const b = Buffer.from(dariAlamat);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Halaman tujuan setelah masuk. Hanya alamat DALAM situs dan bukan API;
 * selain itu `null` (= dasbor).
 *
 * Aturan yang sama dengan halaman masuk Google (`tombol-masuk.tsx`): "//host"
 * dan "/\\host" dibaca peramban sebagai alamat luar. Ditambah `/api`, supaya
 * `lanjut=/api/identitas/masuk` tidak menjadi putaran tak berujung.
 * Awalan bahasa dilepas — pemasangnya satu, di `jalur()`.
 */
export function lanjutAman(nilai: string | null | undefined): string | null {
  if (!nilai || nilai.length > 512) return null;
  if (!nilai.startsWith("/") || nilai.startsWith("//") || nilai.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(nilai)) return null;
  const tanpaBahasa = lepasAwalan(nilai);
  if (tanpaBahasa === "/api" || tanpaBahasa.startsWith("/api/")) return null;
  return tanpaBahasa === "/" ? null : tanpaBahasa;
}

export interface KlaimIdentitas {
  /** `akunId` di identitas-itts. */
  sub: string;
  email: string;
  nama: string | null;
}

/** Klaim yang dipakai RPKPS dari id_token yang SUDAH terverifikasi tanda tangannya. */
export function bacaKlaim(payload: Record<string, unknown>): KlaimIdentitas | null {
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!sub || !/^[^@\s]+@[^@\s]+$/.test(email)) return null;
  const nama = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  return { sub, email, nama };
}

/**
 * Kode galat yang boleh tampil di halaman masuk (`?galat=`). Daftar tertutup:
 * nilai dari alamat tidak pernah ditulis ke layar, hanya dicari di sini.
 */
export const KODE_GALAT_SSO = [
  "tidak-aktif",
  "kedaluwarsa",
  "belum-terdaftar",
  "akun-nonaktif",
  "layanan",
  "gagal",
] as const;

export type KodeGalatSso = (typeof KODE_GALAT_SSO)[number];

export function kodeGalatSso(nilai: string | null | undefined): KodeGalatSso | null {
  return (KODE_GALAT_SSO as readonly string[]).includes(nilai ?? "") ? (nilai as KodeGalatSso) : null;
}
