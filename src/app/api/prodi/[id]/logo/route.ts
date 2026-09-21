import { NextResponse } from "next/server";
import { logoProdi, tanggapanLogo } from "@/lib/prodi/logo";

export const runtime = "nodejs";

/**
 * Lambang satu program studi.
 *
 * Tanpa login: halaman katalog publik memuatnya, dan lambang prodi memang
 * sudah terpampang di gerbang kampus. Aturan pintunya ada di
 * `src/lib/prodi/logo.ts` — rute ini hanya menyalurkan.
 *
 * Ada sebagai rute tersendiri supaya bita gambar TIDAK ikut ke muatan render
 * setiap halaman: kop muncul di tiap lembar pratinjau, dan mengirimkan
 * setengah megabita bersama HTML-nya berarti membayarnya berulang-ulang.
 */
export async function GET(
  _permintaan: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const logo = await logoProdi(id);
  if (!logo) return NextResponse.json({ pesan: "Logo tidak ditemukan." }, { status: 404 });
  return tanggapanLogo(logo);
}
