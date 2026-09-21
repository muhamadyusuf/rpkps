import { NextResponse } from "next/server";
import { logoInstitusi, tanggapanLogo } from "@/lib/prodi/logo";

export const runtime = "nodejs";

/**
 * Lambang institusi. Satu institusi, satu lambang — karena itu tanpa
 * parameter (skema ini bercakupan SATU institusi; lihat kepala schema.prisma).
 *
 * Aturan pintunya sama dengan lambang prodi: lihat `src/lib/prodi/logo.ts`.
 */
export async function GET() {
  const logo = await logoInstitusi();
  if (!logo) return NextResponse.json({ pesan: "Logo tidak ditemukan." }, { status: 404 });
  return tanggapanLogo(logo);
}
