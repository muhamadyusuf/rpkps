import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy hanya memeriksa KEBERADAAN cookie sesi, bukan keabsahannya —
 * firebase-admin tidak dapat berjalan di runtime Edge. Verifikasi tanda tangan,
 * status pencabutan, dan peran dilakukan di layout server (lihat lib/otorisasi).
 * Fungsinya di sini murni pengalaman pengguna: menghindari kedipan halaman
 * bagi tamu yang membuka tautan dalam.
 */
const JALUR_PUBLIK = ["/masuk", "/setup", "/api/sesi"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (JALUR_PUBLIK.some((j) => pathname.startsWith(j))) {
    return NextResponse.next();
  }

  const adaCookie = request.cookies.has("sesi");
  if (!adaCookie) {
    const tujuan = new URL("/masuk", request.url);
    if (pathname !== "/") tujuan.searchParams.set("lanjut", pathname);
    return NextResponse.redirect(tujuan);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
