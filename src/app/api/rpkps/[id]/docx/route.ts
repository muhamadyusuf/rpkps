import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cakupanProdi } from "@/lib/otorisasi";
import { sesiSaatIni } from "@/lib/sesi";
import { siapkanUnduhanRpkps } from "@/lib/dokumen/siapkan-unduhan";

export const runtime = "nodejs";

/**
 * Unduhan untuk pengguna terdaftar — termasuk draf yang belum disahkan.
 * Padanan publiknya ada di /api/publik/rpkps/[id]/docx dan hanya melayani
 * dokumen berstatus TERBIT.
 */
export async function GET(
  _permintaan: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesi = await sesiSaatIni();
  if (!sesi || sesi.status !== "AKTIF") {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const { id } = await params;

  // Cakupan prodi diperiksa lebih dulu, dengan kueri murah: menyusun DOCX
  // lengkap untuk kemudian menolaknya adalah kerja yang terbuang.
  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: { mataKuliah: { select: { kurikulum: { select: { prodiId: true } } } } },
  });
  if (!rpkps) {
    return NextResponse.json({ pesan: "RPKPS tidak ditemukan." }, { status: 404 });
  }

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(rpkps.mataKuliah.kurikulum.prodiId)) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });
  }

  const berkas = await siapkanUnduhanRpkps(id);
  if (!berkas) {
    return NextResponse.json({ pesan: "RPKPS tidak ditemukan." }, { status: 404 });
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
