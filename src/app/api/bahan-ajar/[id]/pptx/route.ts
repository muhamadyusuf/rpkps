import { NextResponse } from "next/server";
import { siapkanSlideBuku } from "@/lib/bahan-ajar/cetak";
import { wenangBuku } from "@/lib/bahan-ajar/wenang";
import { sesiSaatIni } from "@/lib/sesi";

export const runtime = "nodejs";

/**
 * Unduhan slide kuliah dalam .pptx — docs/16 §4.2.
 *
 *   ?bab=3   hanya bab itu; kosong berarti seluruh buku dalam satu berkas
 *
 * Tidak ada parameter kunci jawaban di sini, dan itu bukan kelalaian: slide
 * tidak pernah memuat kunci sama sekali (lihat `slide-pptx.ts`).
 */
export async function GET(
  permintaan: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesi = await sesiSaatIni();
  if (!sesi || sesi.status !== "AKTIF") {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const { id } = await params;

  const w = await wenangBuku(id);
  if (!w.ada) return NextResponse.json({ pesan: "Buku ajar tidak ditemukan." }, { status: 404 });
  if (!w.bolehLihat) return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });

  const alamat = new URL(permintaan.url);
  const babTeks = alamat.searchParams.get("bab");
  const bab = babTeks === null ? undefined : Number(babTeks);
  if (bab !== undefined && !Number.isInteger(bab)) {
    return NextResponse.json({ pesan: "Nomor bab tidak sah." }, { status: 400 });
  }

  const berkas = await siapkanSlideBuku(id, { bab });
  if (!berkas) {
    return NextResponse.json({ pesan: "Buku ajar tidak ditemukan." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(berkas.buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${berkas.namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
