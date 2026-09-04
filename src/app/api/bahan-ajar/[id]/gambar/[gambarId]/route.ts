import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wenangBuku } from "@/lib/bahan-ajar/wenang";
import { sesiSaatIni } from "@/lib/sesi";

export const runtime = "nodejs";

/**
 * Menyajikan PNG sebuah gambar bab.
 *
 * Ada supaya bita gambar TIDAK ikut ke muatan render setiap halaman: satu bab
 * dapat memuat dua belas gambar berukuran megabyte, dan menariknya hanya untuk
 * menampilkan daftar berjudul berarti mengirimkan belasan megabyte percuma.
 *
 * Selalu PNG, apa pun bentuk aslinya. SVG mentah tidak pernah disajikan lewat
 * rute ini: berkas yang disajikan dari alamat kita sendiri dieksekusi dalam
 * asal-usul kita, dan gambar yang dirender di layar sudah cukup lewat PNG-nya
 * (docs/17 §5.2).
 */
export async function GET(
  _permintaan: Request,
  { params }: { params: Promise<{ id: string; gambarId: string }> },
) {
  const sesi = await sesiSaatIni();
  if (!sesi || sesi.status !== "AKTIF") {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const { id, gambarId } = await params;

  const w = await wenangBuku(id);
  if (!w.ada) return NextResponse.json({ pesan: "Buku ajar tidak ditemukan." }, { status: 404 });
  if (!w.bolehLihat) return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });

  /*
   * Kepemilikan gambar diperiksa DI DALAM kueri — `bab.bukuAjarId` harus buku
   * yang wewenangnya baru saja ditimbang. Id gambar bersifat global, jadi
   * memuatnya lebih dulu lalu memeriksa sesudahnya akan menyajikan gambar
   * milik buku lain kepada siapa pun yang menebak idnya dengan benar.
   */
  const gambar = await prisma.gambarBab.findFirst({
    where: { id: gambarId, bab: { bukuAjarId: id } },
    select: { png: true, diubahPada: true },
  });
  if (!gambar) {
    return NextResponse.json({ pesan: "Gambar tidak ditemukan." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(gambar.png), {
    headers: {
      "Content-Type": "image/png",
      // Pribadi: gambar buku ajar bukan berkas publik, jadi ia tidak boleh
      // singgah di cache bersama mana pun.
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
