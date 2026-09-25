import { NextResponse, type NextRequest } from "next/server";
import { ambilIpKlien } from "@/domain/keamanan/ip";
import { jawabanTerlaluBanyak, lajuMasuk } from "@/lib/keamanan/laju";
import { bukaAlur, cocokState, type KodeGalatSso } from "@/domain/identitas/sso";
import {
  GalatSso,
  NAMA_COOKIE_ALUR_SSO,
  idTokenFirebaseUntuk,
  opsiCookieAlur,
  tukarKode,
  verifikasiIdToken,
} from "@/lib/identitas/sso";
import { pasangCookieMasuk, selesaikanMasuk, type KodeGagalMasuk } from "@/lib/masuk";

export const runtime = "nodejs";

const DARI_KODE_MASUK: Record<KodeGagalMasuk, KodeGalatSso> = {
  "belum-terdaftar": "belum-terdaftar",
  "akun-nonaktif": "akun-nonaktif",
  layanan: "layanan",
  "email-kosong": "gagal",
  "tidak-sah": "gagal",
  gagal: "gagal",
};

/**
 * Alamat balik identitas-itts (docs/25). Peramban tiba di sini membawa
 * `code` + `state`; keluar sebagai sesi RPKPS yang sah, atau kembali ke
 * halaman masuk membawa `?galat=`.
 *
 * Urutan pemeriksaannya sengaja begini — yang murah dan tanpa jaringan dulu:
 *   1. batas laju per IP
 *   2. cookie alur ada, utuh, belum kedaluwarsa, dan `state`-nya cocok
 *      (menangkal pemalsuan permintaan lintas situs: penyerang tidak dapat
 *      membuat peramban KORBAN memegang cookie alur yang cocok)
 *   3. `code` ditukar server-ke-server dengan `client_secret` + PKCE
 *   4. id_token diverifikasi (tanda tangan, penerbit, penonton, masa berlaku)
 *   5. jembatan ke sesi Firebase, lalu pintu bersama `selesaikanMasuk` —
 *      gerbang kepegawaian, penyiapan pengguna, dan audit sama dengan masuk
 *      lewat Google
 */
export async function GET(request: NextRequest) {
  const ip = ambilIpKlien(request.headers);
  const laju = lajuMasuk.coba(ip);
  if (!laju.boleh) return jawabanTerlaluBanyak(laju.ulangDalamMs);

  /** Alur ini SEKALI PAKAI, apa pun hasilnya: cookienya dibuang pada setiap jawaban. */
  const tutup = (respons: NextResponse) => {
    respons.cookies.set({ name: NAMA_COOKIE_ALUR_SSO, value: "", ...opsiCookieAlur(0) });
    respons.headers.set("Cache-Control", "no-store");
    return respons;
  };
  const galat = (kode: KodeGalatSso) =>
    tutup(NextResponse.redirect(new URL(`/masuk?galat=${kode}`, request.url)));

  const p = request.nextUrl.searchParams;
  const alur = bukaAlur(request.cookies.get(NAMA_COOKIE_ALUR_SSO)?.value);
  if (!alur || !cocokState(alur.state, p.get("state"))) return galat("kedaluwarsa");

  const kode = p.get("code");
  if (p.has("error") || !kode || kode.length > 512) return galat("gagal");

  try {
    const idTokenIdentitas = await tukarKode(kode, alur.verifier);
    const klaim = await verifikasiIdToken(idTokenIdentitas);
    const idTokenFirebase = await idTokenFirebaseUntuk(klaim);

    const hasil = await selesaikanMasuk(idTokenFirebase, {
      ip,
      lewat: "identitas-itts",
      namaCadangan: klaim.nama,
    });
    if (!hasil.ok) return galat(DARI_KODE_MASUK[hasil.kode]);

    // Awalan bahasa dari preferensi akun — sama dengan masuk lewat Google.
    const respons = NextResponse.redirect(
      new URL(`/${hasil.bahasa}${alur.lanjut ?? "/dashboard"}`, request.url),
    );
    pasangCookieMasuk(respons, hasil);
    return tutup(respons);
  } catch (g) {
    // Tanpa token, kode, maupun rahasia — hanya tahap dan nama galatnya.
    console.error("[sso] masuk lewat identitas-itts gagal:", g instanceof Error ? `${g.name}: ${g.message}` : "galat tak dikenal");
    return galat(g instanceof GalatSso ? g.tahap : "gagal");
  }
}
