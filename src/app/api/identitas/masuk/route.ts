import { NextResponse, type NextRequest } from "next/server";
import { sesiSaatIni } from "@/lib/sesi";
import {
  UMUR_ALUR_SSO_MS,
  alamatMulaiKanonik,
  bungkusAlur,
  lanjutAman,
  mulaiAlurSso,
  urlOtorisasi,
} from "@/domain/identitas/sso";
import {
  NAMA_COOKIE_ALUR_SSO,
  alamatBalikSso,
  opsiCookieAlur,
  ssoTersedia,
} from "@/lib/identitas/sso";
import { env } from "@/lib/env";
import { urlSitus } from "@/lib/publik/tautan";

export const runtime = "nodejs";

/**
 * Pintu masuk lewat identitas-itts (docs/25).
 *
 * Alamat inilah yang ditautkan dari identitas-itts ("Buka RPKPS") dan dari
 * tombol di halaman masuk. Bila pengguna SUDAH masuk di identitas-itts,
 * peramban langsung dikembalikan ke `/api/identitas/callback` membawa kode
 * tanpa melihat layar apa pun — itulah "buka RPKPS tanpa masuk lagi". Bila
 * belum, identitas-itts meminta masuk lebih dulu, lalu melanjutkan.
 *
 * Publik (proxy.ts, "/api/identitas"): penjaganya `state` + PKCE yang diperiksa
 * callback, bukan sesi.
 *
 * `?lanjut=/rpkps/abc` — halaman tujuan setelah masuk, tanpa awalan bahasa.
 */
export async function GET(request: NextRequest) {
  const lanjut = lanjutAman(request.nextUrl.searchParams.get("lanjut"));

  // Cookie alur harus lahir di host yang sama dengan `redirect_uri`; tautan
  // "Buka RPKPS" yang menunjuk alamat lain dialihkan dulu ke host kanonik.
  const kanonik = alamatMulaiKanonik(request.nextUrl, urlSitus(), lanjut);
  if (kanonik) return NextResponse.redirect(kanonik);

  // Sudah punya sesi RPKPS yang sah: tak perlu berputar lewat identitas-itts.
  const sesi = await sesiSaatIni().catch(() => null);
  if (sesi) return NextResponse.redirect(new URL(lanjut ?? "/dashboard", request.url));

  const konfig = env.identitasItts;
  if (!konfig || !ssoTersedia()) {
    return NextResponse.redirect(new URL("/masuk?galat=tidak-aktif", request.url));
  }

  const alur = mulaiAlurSso(lanjut);
  const respons = NextResponse.redirect(
    urlOtorisasi({
      basis: konfig.url,
      klienId: konfig.klienId,
      redirectUri: alamatBalikSso(),
      alur,
    }),
  );
  respons.cookies.set({
    name: NAMA_COOKIE_ALUR_SSO,
    value: bungkusAlur(alur),
    ...opsiCookieAlur(UMUR_ALUR_SSO_MS / 1000),
  });
  respons.headers.set("Cache-Control", "no-store");
  return respons;
}
