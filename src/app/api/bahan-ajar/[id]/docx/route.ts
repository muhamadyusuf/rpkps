import { NextResponse } from "next/server";
import { siapkanUnduhanBuku } from "@/lib/bahan-ajar/cetak";
import { wenangBuku } from "@/lib/bahan-ajar/wenang";
import { sesiSaatIni } from "@/lib/sesi";

export const runtime = "nodejs";

/**
 * Unduhan buku ajar dalam .docx — docs/16 §4.1.
 *
 * Dua parameter, dan keduanya mengubah isi berkas:
 *
 *   ?bab=3    hanya bab itu, untuk dibagikan mingguan
 *   ?kunci=0  TANPA kunci jawaban — inilah berkas untuk mahasiswa
 *
 * Tidak ada padanan publiknya. Buku ajar milik dosen, bukan dokumen mutu, dan
 * tidak pernah masuk katalog publik.
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

  // Wewenang diperiksa lebih dulu dengan kueri murah: menyusun buku utuh untuk
  // kemudian menolaknya adalah kerja yang terbuang.
  const w = await wenangBuku(id);
  if (!w.ada) return NextResponse.json({ pesan: "Buku ajar tidak ditemukan." }, { status: 404 });
  if (!w.bolehLihat) return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });

  const alamat = new URL(permintaan.url);
  const babTeks = alamat.searchParams.get("bab");
  const bab = babTeks === null ? undefined : Number(babTeks);
  if (bab !== undefined && !Number.isInteger(bab)) {
    return NextResponse.json({ pesan: "Nomor bab tidak sah." }, { status: 400 });
  }

  const berkas = await siapkanUnduhanBuku(id, {
    bab,
    // Bawaannya MEMUAT kunci; hanya "0" yang mematikannya. Kebalikannya —
    // kunci hanya ikut bila diminta — akan membuat berkas yang dosen kira
    // lengkap diam-diam kehilangan kunci jawabannya.
    kunci: alamat.searchParams.get("kunci") !== "0",
  });
  if (!berkas) {
    return NextResponse.json({ pesan: "Buku ajar tidak ditemukan." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(berkas.buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${berkas.namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
