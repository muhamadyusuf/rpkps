import { NextResponse, type NextRequest } from "next/server";
import { lupakanCookieSesi } from "@/lib/firebase/admin";
import { NAMA_COOKIE_SESI } from "@/lib/sesi";
import { ambilIpKlien } from "@/domain/keamanan/ip";
import { jawabanTerlaluBanyak, lajuMasuk } from "@/lib/keamanan/laju";
import { pasangCookieMasuk, selesaikanMasuk } from "@/lib/masuk";

export const runtime = "nodejs";

/**
 * Menukar Firebase ID token (umur pendek, dipegang browser) dengan cookie sesi
 * HttpOnly. Setelah ini browser tidak perlu lagi menyimpan token apa pun yang
 * dapat dibaca skrip.
 *
 * Seluruh urutannya — gerbang kepegawaian, penyiapan pengguna, audit — ada di
 * `lib/masuk.ts`, dipakai bersama masuk lewat identitas-itts (docs/25).
 */
export async function POST(request: NextRequest) {
  // Sebelum apa pun yang mahal: verifikasi token memanggil Firebase, dan
  // penulisan sesi menyentuh basis data yang jauh.
  const ip = ambilIpKlien(request.headers);
  const laju = lajuMasuk.coba(ip);
  if (!laju.boleh) return jawabanTerlaluBanyak(laju.ulangDalamMs);

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ pesan: "Badan permintaan tidak valid." }, { status: 400 });
  }

  if (typeof idToken !== "string" || idToken.length === 0) {
    return NextResponse.json({ pesan: "idToken wajib diisi." }, { status: 400 });
  }

  const hasil = await selesaikanMasuk(idToken, { ip, lewat: "google" });
  if (!hasil.ok) {
    return NextResponse.json({ pesan: hasil.pesan }, { status: hasil.status });
  }

  const respons = NextResponse.json({
    status: hasil.status,
    baru: hasil.baru,
    bahasa: hasil.bahasa,
  });
  pasangCookieMasuk(respons, hasil);
  return respons;
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
