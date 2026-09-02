import { NextResponse, type NextRequest } from "next/server";
import {
  buatCookieSesi,
  lupakanCookieSesi,
  UMUR_SESI_MS,
  adminAuth,
} from "@/lib/firebase/admin";
import { siapkanPengguna, NAMA_COOKIE_SESI } from "@/lib/sesi";
import { NAMA_COOKIE_BAHASA } from "@/kamus";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Menukar Firebase ID token (umur pendek, dipegang browser) dengan cookie sesi
 * HttpOnly. Setelah ini browser tidak perlu lagi menyimpan token apa pun yang
 * dapat dibaca skrip.
 */
export async function POST(request: NextRequest) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ pesan: "Badan permintaan tidak valid." }, { status: 400 });
  }

  if (typeof idToken !== "string" || idToken.length === 0) {
    return NextResponse.json({ pesan: "idToken wajib diisi." }, { status: 400 });
  }

  try {
    // checkRevoked = true: akun yang baru dinonaktifkan langsung ditolak.
    const token = await adminAuth().verifyIdToken(idToken, true);

    if (!token.email) {
      return NextResponse.json(
        { pesan: "Akun Google tidak memiliki alamat email." },
        { status: 400 },
      );
    }

    const pengguna = await siapkanPengguna({
      firebaseUid: token.uid,
      email: token.email,
      nama: (token.name as string | undefined) ?? null,
      fotoUrl: (token.picture as string | undefined) ?? null,
    });

    const cookie = await buatCookieSesi(idToken);
    const respons = NextResponse.json({
      status: pengguna.status,
      baru: pengguna.baru,
      bahasa: pengguna.bahasa,
    });

    // Satu-satunya tempat preferensi bahasa tersimpan dapat mengambil alih.
    // Proxy tidak boleh menyentuh basis data (runtime Edge) dan Server
    // Component tidak dapat memasang cookie — tinggal Route Handler ini,
    // yang memang dilewati tepat sekali pada saat masuk. Sejak titik itu,
    // dosen yang memakai komputer lab langsung mendapat bahasanya sendiri.
    respons.cookies.set({
      name: NAMA_COOKIE_BAHASA,
      value: pengguna.bahasa,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    respons.cookies.set({
      name: NAMA_COOKIE_SESI,
      value: cookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: UMUR_SESI_MS / 1000,
    });

    await prisma.logAudit.create({
      data: {
        penggunaId: pengguna.id,
        aksi: pengguna.baru ? "PENGGUNA_DIBUAT" : "MASUK",
        entitas: "pengguna",
        entitasId: pengguna.id,
        ringkasan: pengguna.baru
          ? `Pengguna baru ${token.email} masuk pertama kali`
          : `${token.email} masuk`,
        ip: request.headers.get("x-forwarded-for") ?? undefined,
      },
    });

    return respons;
  } catch (galat) {
    console.error("[sesi] gagal membuat sesi:", galat);
    const { pesan, status } = jelaskanKegagalanSesi(galat);
    return NextResponse.json({ pesan }, { status });
  }
}

/**
 * Menerjemahkan kegagalan pembuatan sesi menjadi sebab yang dapat
 * ditindaklanjuti. Sebelumnya seluruh kegagalan — kredensial Firebase salah,
 * database tak terjangkau, tabel belum dibuat — berakhir sebagai satu pesan
 * "Verifikasi login gagal", yang tidak memberi petunjuk apa pun.
 *
 * Rincian teknis hanya disertakan di mode pengembangan; di produksi cukup
 * kategorinya, sedangkan jejak lengkapnya ada di log server.
 */
function jelaskanKegagalanSesi(galat: unknown): { pesan: string; status: number } {
  const pesanAsli = galat instanceof Error ? galat.message : String(galat);
  const kode =
    typeof galat === "object" && galat !== null && "code" in galat
      ? String((galat as { code: unknown }).code)
      : "";
  const dev = process.env.NODE_ENV === "development";
  const rinci = (dasar: string) => (dev ? `${dasar} (${pesanAsli.slice(0, 200)})` : dasar);

  if (pesanAsli.includes("Variabel lingkungan")) {
    return { pesan: pesanAsli, status: 500 };
  }

  // Database: belum terjangkau, atau skemanya belum dibuat.
  if (
    kode === "ECONNREFUSED" || kode === "ENOTFOUND" || kode === "ETIMEDOUT" ||
    kode.startsWith("P1") || pesanAsli.includes("Can\'t reach database")
  ) {
    return {
      pesan: rinci("Database tidak dapat dihubungi. Periksa DATABASE_URL."),
      status: 500,
    };
  }
  if (
    kode === "42P01" || kode.startsWith("P2021") ||
    pesanAsli.includes("does not exist") || pesanAsli.includes("tidak ditemukan di database")
  ) {
    return {
      pesan: rinci("Tabel database belum dibuat. Jalankan: npm run db:migrate:pg"),
      status: 500,
    };
  }

  // Kredensial Firebase Admin (service account) bermasalah.
  if (
    kode.startsWith("app/") ||
    pesanAsli.includes("Failed to parse private key") ||
    pesanAsli.includes("Credential implementation") ||
    pesanAsli.includes("invalid_grant")
  ) {
    return {
      pesan: rinci(
        "Kredensial Firebase Admin ditolak. Periksa FIREBASE_PRIVATE_KEY dan FIREBASE_CLIENT_EMAIL.",
      ),
      status: 500,
    };
  }

  // Token dari browser memang tidak sah — ini satu-satunya kegagalan
  // yang benar-benar milik pengguna, bukan konfigurasi.
  if (kode.startsWith("auth/")) {
    return { pesan: "Sesi login tidak sah. Coba masuk kembali.", status: 401 };
  }

  return { pesan: rinci("Gagal membuat sesi."), status: 500 };
}

export async function DELETE(request: NextRequest) {
  // Membuang izin-lewat pemeriksaan pencabutan milik cookie ini, supaya jejak
  // sesi yang sudah selesai tidak menganggur di memori sampai kedaluwarsa.
  const cookie = request.cookies.get(NAMA_COOKIE_SESI)?.value;
  if (cookie) lupakanCookieSesi(cookie);

  const respons = NextResponse.json({ ok: true });
  respons.cookies.set({
    name: NAMA_COOKIE_SESI,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return respons;
}
