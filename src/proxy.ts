import { NextResponse, type NextRequest } from "next/server";
import { BAHASA, BAHASA_BAWAAN, NAMA_COOKIE_BAHASA, adalahBahasa, type Bahasa } from "@/kamus";
import { bahasaPadaJalur, lepasAwalan, tanpaAwalanBahasa } from "@/lib/bahasa/jalur";

/**
 * Proxy mengerjakan dua hal, dalam urutan ini.
 *
 * 1. **Bahasa.** Setiap alamat aplikasi wajib berawalan `/id` atau `/en`.
 *    Alamat telanjang — termasuk seluruh tautan yang sudah terlanjur dibagikan
 *    sebelum fitur ini ada — dialihkan ke bentuk berawalan.
 * 2. **Sesi.** Memeriksa KEBERADAAN cookie sesi, bukan keabsahannya:
 *    firebase-admin tidak dapat berjalan di runtime Edge. Verifikasi tanda
 *    tangan, status pencabutan, dan peran dilakukan di layout server (lihat
 *    lib/otorisasi). Fungsinya di sini murni pengalaman pengguna: menghindari
 *    kedipan halaman bagi tamu yang membuka tautan dalam.
 *
 * Preferensi `Pengguna.bahasa` yang tersimpan di basis data sengaja TIDAK
 * dibaca di sini — proxy tidak menyentuh basis data. Penyelarasannya
 * dikerjakan tata letak aplikasi saat pengguna masuk.
 */

/**
 * Alamat yang dicocokkan UTUH, setelah awalan bahasa dilepas. "/" harus di
 * sini, bukan di daftar awalan — `"/".startsWith` benar untuk setiap alamat,
 * sehingga menaruhnya di sana akan membuka seluruh aplikasi.
 */
const JALUR_PUBLIK_TEPAT = new Set(["/", "/sitemap.xml", "/robots.txt", "/favicon.ico"]);

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

/**
 * Bahasa untuk pengunjung yang alamatnya belum berawalan.
 *
 * Urutannya: pilihan yang pernah dinyatakan orang itu → tebakan sopan dari
 * perambannya → bahasa bawaan. Lihat docs/11-dwibahasa.md §2.2.
 */
function tebakBahasa(request: NextRequest): Bahasa {
  const cookie = request.cookies.get(NAMA_COOKIE_BAHASA)?.value;
  if (adalahBahasa(cookie)) return cookie;

  const header = request.headers.get("accept-language");
  if (header) {
    const diminta = header
      .split(",")
      .map((bagian) => {
        const [tag, ...parameter] = bagian.trim().split(";");
        const q = parameter.find((p) => p.trim().startsWith("q="));
        return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) : 1 };
      })
      .filter((x) => x.tag.length > 0 && Number.isFinite(x.q))
      .sort((a, b) => b.q - a.q);

    for (const { tag } of diminta) {
      // "en-GB" dan "en" sama-sama menunjuk bahasa Inggris.
      const dasar = tag.split("-")[0];
      const cocok = BAHASA.find((b) => b === dasar);
      if (cocok) return cocok;
    }
  }

  return BAHASA_BAWAAN;
}

const SETAHUN = 60 * 60 * 24 * 365;

function pasangCookieBahasa(respons: NextResponse, bahasa: Bahasa) {
  respons.cookies.set(NAMA_COOKIE_BAHASA, bahasa, {
    path: "/",
    maxAge: SETAHUN,
    sameSite: "lax",
  });
  return respons;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API dan berkas akar tidak berbahasa; hanya aturan sesi yang berlaku.
  if (tanpaAwalanBahasa(pathname)) {
    return terbukaUntukUmum(pathname) ? NextResponse.next() : jagaSesi(request, pathname);
  }

  const bahasa = bahasaPadaJalur(pathname);

  if (!bahasa) {
    // Alamat telanjang — termasuk tautan lama yang sudah tersebar. Dialihkan,
    // bukan ditulis ulang diam-diam, supaya alamat di bilah peramban dan
    // alamat yang nanti dibagikan ulang selalu bentuk yang sah.
    const tujuan = request.nextUrl.clone();
    const dipilih = tebakBahasa(request);
    tujuan.pathname = pathname === "/" ? `/${dipilih}` : `/${dipilih}${pathname}`;
    return pasangCookieBahasa(NextResponse.redirect(tujuan), dipilih);
  }

  const tanpaBahasa = lepasAwalan(pathname);
  const respons = terbukaUntukUmum(tanpaBahasa)
    ? NextResponse.next()
    : jagaSesi(request, tanpaBahasa);

  // Alamat adalah yang berkuasa, bukan cookie: membuka tautan /en yang
  // dibagikan orang lain membuat aplikasi ikut berbahasa Inggris pada
  // kunjungan berikutnya. Cookie hanya menyimpan apa yang terakhir dipakai.
  if (request.cookies.get(NAMA_COOKIE_BAHASA)?.value !== bahasa) {
    pasangCookieBahasa(respons, bahasa);
  }

  return respons;
}

/** Tamu yang membuka tautan dalam dikirim ke halaman masuk berbahasa sama. */
function jagaSesi(request: NextRequest, tanpaBahasa: string) {
  if (request.cookies.has("sesi")) return NextResponse.next();

  const bahasa = bahasaPadaJalur(request.nextUrl.pathname) ?? tebakBahasa(request);
  const tujuan = new URL(`/${bahasa}/masuk`, request.url);
  tujuan.searchParams.set("lanjut", tanpaBahasa);
  return NextResponse.redirect(tujuan);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
