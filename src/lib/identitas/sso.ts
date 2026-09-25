import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { adminAuth } from "@/lib/firebase/admin";
import { env } from "@/lib/env";
import { urlSitus } from "@/lib/publik/tautan";
import { JALUR_BALIK_SSO, bacaKlaim, type KlaimIdentitas } from "@/domain/identitas/sso";

/**
 * Masuk tunggal lewat identitas-itts (docs/25) — bagian yang menyentuh
 * jaringan dan Firebase. Aturan murninya ada di `domain/identitas/sso.ts`.
 *
 * Alurnya: peramban → identitas-itts (sudah masuk di sana? langsung kembali
 * membawa `code`) → rute callback menukar `code` (server-ke-server, dengan
 * `client_secret` + PKCE) → memverifikasi id_token → menjembatani ke sesi
 * Firebase, yang tetap satu-satunya bentuk sesi RPKPS.
 */

/** Sama dengan gerbang kepegawaian (status.ts): identitas-itts yang lambat tidak boleh menggantung. */
const BATAS_WAKTU_MS = 8000;

/**
 * `__Host-` di produksi: cookie berawalan ini hanya dapat dipasang dari
 * situsnya sendiri (wajib Secure, tanpa Domain, Path=/) — tidak dapat ditimpa
 * dari subdomain lain di bawah itts.ac.id. Yang ditimpa itu cookie alur: siapa
 * pun yang dapat memasang cookie ini di peramban korban dapat memasukkan
 * `state`/`verifier`-nya sendiri, lalu menyodorkan `code` akunnya kepada
 * korban — korban masuk sebagai penyerang. Di http (pengembangan) awalan itu
 * ditolak peramban, jadi namanya polos.
 */
export const NAMA_COOKIE_ALUR_SSO =
  process.env.NODE_ENV === "production" ? "__Host-sso_alur" : "sso_alur";

export function opsiCookieAlur(umurDetik: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, bukan Strict: balik dari identitas-itts adalah navigasi lintas situs
    // tingkat atas, dan cookie Strict tidak ikut terkirim padanya.
    sameSite: "lax" as const,
    path: "/",
    maxAge: umurDetik,
  };
}

/** Tombol "Masuk dengan Identitas ITTS" hanya tampil bila integrasinya dikonfigurasi. */
export function ssoTersedia(): boolean {
  return env.identitasItts !== null;
}

/**
 * Alamat balik yang didaftarkan pada klien di identitas-itts. Dari
 * NEXT_PUBLIC_URL_SITUS, bukan dari permintaan: `redirect_uri` harus PERSIS
 * sama pada tahap otorisasi dan penukaran kode, dan alamat permintaan dapat
 * berbeda di balik proksi.
 */
export function alamatBalikSso(): string {
  return `${urlSitus()}${JALUR_BALIK_SSO}`;
}

/** Tahap yang gagal; menentukan pesan yang dilihat pengguna, bukan isi log. */
export class GalatSso extends Error {
  constructor(
    readonly tahap: "layanan" | "gagal",
    pesan: string,
  ) {
    super(pesan);
    this.name = "GalatSso";
  }
}

function konfigurasi() {
  const k = env.identitasItts;
  if (!k) throw new GalatSso("gagal", "IDENTITAS_ITTS_* belum dikonfigurasi");
  return k;
}

/** Tukar `code` → id_token. Server-ke-server; `client_secret` tidak pernah lewat peramban. */
export async function tukarKode(code: string, verifier: string): Promise<string> {
  const k = konfigurasi();

  let resp: Response;
  try {
    resp = await fetch(`${k.url}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: alamatBalikSso(),
        client_id: k.klienId,
        client_secret: k.rahasia,
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    });
  } catch (galat) {
    throw new GalatSso("layanan", `identitas-itts tak terjangkau: ${(galat as Error).name}`);
  }

  if (!resp.ok) {
    // Isi jawaban tidak dicatat: pada kegagalan pun bisa memuat petunjuk tentang kode/rahasia.
    throw new GalatSso(
      resp.status >= 500 ? "layanan" : "gagal",
      `identitas-itts menjawab ${resp.status} pada /oauth/token`,
    );
  }

  const isi = (await resp.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!isi || typeof isi.id_token !== "string" || !isi.id_token) {
    throw new GalatSso("gagal", "jawaban /oauth/token tanpa id_token");
  }
  return isi.id_token;
}

/**
 * Satu set kunci per alamat JWKS, dipakai ulang antarpermintaan: `jose`
 * menyimpan kunci yang sudah diambil dan mengambil ulang hanya saat `kid`
 * baru muncul (rotasi). Membuatnya per permintaan berarti satu unduhan JWKS
 * pada SETIAP masuk.
 */
let jwks: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | undefined;

function kunciPenerbit(url: string) {
  if (jwks?.url !== url) {
    jwks = {
      url,
      set: createRemoteJWKSet(new URL(`${url}/oauth/jwks`), { timeoutDuration: BATAS_WAKTU_MS }),
    };
  }
  return jwks.set;
}

/**
 * Memverifikasi id_token: tanda tangan RS256 dari JWKS identitas-itts,
 * penerbit, PENONTON (harus klien ini — token milik klien lain ditolak), dan
 * masa berlaku. Lalu mengambil klaimnya.
 */
export async function verifikasiIdToken(idToken: string): Promise<KlaimIdentitas> {
  const k = konfigurasi();
  try {
    const { payload } = await jwtVerify(idToken, kunciPenerbit(k.url), {
      issuer: k.penerbit,
      audience: k.klienId,
      algorithms: ["RS256"],
      clockTolerance: 30,
    });
    const klaim = bacaKlaim(payload);
    if (!klaim) throw new GalatSso("gagal", "id_token tanpa sub/email yang sah");
    return klaim;
  } catch (galat) {
    if (galat instanceof GalatSso) throw galat;
    // JWKS tak terjangkau = layanan; tanda tangan/klaim salah = token tidak sah.
    const nama = (galat as Error).name;
    throw new GalatSso(
      nama === "JWKSTimeout" || nama === "TypeError" ? "layanan" : "gagal",
      `id_token ditolak: ${nama}`,
    );
  }
}

/**
 * Menjembatani identitas yang SUDAH terverifikasi ke sesi Firebase.
 *
 * Sesi RPKPS adalah cookie sesi Firebase, dan Firebase hanya menerbitkannya
 * dari ID token. Jadi: temukan (atau buat) pengguna Firebase dengan surel itu,
 * cetak token kustom untuknya, lalu tukarkan ke ID token lewat REST — persis
 * yang dilakukan `signInWithCustomToken` di peramban, tetapi di peladen.
 *
 * Surel adalah kunci penyatu, sama dengan masuk lewat Google: pengguna yang
 * sudah pernah masuk dengan Google mendapat uid yang SAMA, jadi peran dan
 * datanya utuh. Yang belum pernah masuk dibuatkan pengguna Firebase (surel
 * terverifikasi — identitas-itts yang menjaminnya) dan berstatus
 * MENUNGGU_VERIFIKASI seperti biasa, kecuali sudah diundang admin.
 */
export async function idTokenFirebaseUntuk(klaim: KlaimIdentitas): Promise<string> {
  const auth = adminAuth();

  let uid: string;
  try {
    uid = (await auth.getUserByEmail(klaim.email)).uid;
  } catch (galat) {
    if ((galat as { code?: string }).code !== "auth/user-not-found") throw galat;
    try {
      uid = (
        await auth.createUser({
          email: klaim.email,
          emailVerified: true,
          displayName: klaim.nama ?? undefined,
        })
      ).uid;
    } catch (g2) {
      // Dua permintaan pertama-kali serentak: yang kalah mengambil pengguna yang dibuat pemenang.
      if ((g2 as { code?: string }).code !== "auth/email-already-exists") throw g2;
      uid = (await auth.getUserByEmail(klaim.email)).uid;
    }
  }

  const tokenKustom = await auth.createCustomToken(uid);

  let resp: Response;
  try {
    resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(env.firebaseKunciWeb)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenKustom, returnSecureToken: true }),
        cache: "no-store",
        signal: AbortSignal.timeout(BATAS_WAKTU_MS),
      },
    );
  } catch (galat) {
    throw new GalatSso("layanan", `Firebase tak terjangkau: ${(galat as Error).name}`);
  }

  const isi = (await resp.json().catch(() => null)) as { idToken?: unknown } | null;
  if (!resp.ok || !isi || typeof isi.idToken !== "string") {
    throw new GalatSso("gagal", `Firebase menolak token kustom (${resp.status})`);
  }
  return isi.idToken;
}
