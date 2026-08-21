import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy hanya memeriksa KEBERADAAN cookie sesi, bukan keabsahannya —
 * firebase-admin tidak dapat berjalan di runtime Edge. Verifikasi tanda tangan,
 * status pencabutan, dan peran dilakukan di layout server (lihat lib/otorisasi).
 * Fungsinya di sini murni pengalaman pengguna: menghindari kedipan halaman
 * bagi tamu yang membuka tautan dalam.
 */

/**
 * Alamat yang dicocokkan UTUH. "/" harus di sini, bukan di daftar awalan —
 * `"/".startsWith` benar untuk setiap alamat, sehingga menaruhnya di sana akan
 * membuka seluruh aplikasi.
 */
const JALUR_PUBLIK_TEPAT = new Set([
  "/",
  "/sitemap.xml",
  "/robots.txt",
  "/favicon.ico",
]);

/** Alamat yang dicocokkan dari awalannya, berikut seluruh isinya. */
const JALUR_PUBLIK_AWALAN = [
  "/katalog", // katalog RPKPS terbit — tanpa login, lihat lib/publik/muat.ts
  "/api/publik",
  "/masuk",
  "/setup",
  "/api/sesi",
];

function terbukaUntukUmum(pathname: string) {
  return (
    JALUR_PUBLIK_TEPAT.has(pathname) ||
    JALUR_PUBLIK_AWALAN.some((j) => pathname === j || pathname.startsWith(`${j}/`))
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (terbukaUntukUmum(pathname)) {
    return NextResponse.next();
  }

  const adaCookie = request.cookies.has("sesi");
  if (!adaCookie) {
    const tujuan = new URL("/masuk", request.url);
    tujuan.searchParams.set("lanjut", pathname);
    return NextResponse.redirect(tujuan);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
