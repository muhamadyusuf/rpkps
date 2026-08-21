import { NextResponse } from "next/server";
import { siapkanUnduhanRpkps } from "@/lib/dokumen/siapkan-unduhan";

export const runtime = "nodejs";

/**
 * Unduhan dokumen resmi tanpa login.
 *
 * `hanyaTerbit` adalah seluruh gerbangnya: apa pun yang belum disahkan Kaprodi
 * — atau sudah berstatus TERBIT tetapi tidak punya salinan beku — dijawab 404,
 * bukan 403. Menjawab 403 akan memberi tahu penebak alamat bahwa dokumen itu
 * ada dan sedang disusun.
 *
 * Isi salinan beku tidak pernah berubah, jadi berkasnya aman di-cache lama.
 * Penerbitan versi berikutnya memakai id yang sama tetapi versi berbeda, dan
 * `siapkanUnduhanRpkps` selalu membaca versi mutakhir — karena itu umurnya
 * tetap dibatasi sehari, bukan setahun.
 */
export async function GET(
  _permintaan: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const berkas = await siapkanUnduhanRpkps(id, { hanyaTerbit: true });

  if (!berkas) {
    return NextResponse.json(
      { pesan: "Dokumen tidak ditemukan atau belum diterbitkan." },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(berkas.buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${berkas.namaBerkas}"`,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
