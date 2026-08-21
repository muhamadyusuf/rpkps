import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cakupanProdi } from "@/lib/otorisasi";
import { sesiSaatIni } from "@/lib/sesi";
import { muatRpkps, type RpkpsLengkap } from "@/lib/rpkps/muat";
import { ambilSnapshot, cairkanSnapshot, type IsiSnapshot } from "@/lib/rpkps/snapshot";
import { buatDokumenRpkps } from "@/lib/dokumen/rpkps-docx";

export const runtime = "nodejs";

export async function GET(
  _permintaan: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesi = await sesiSaatIni();
  if (!sesi || sesi.status !== "AKTIF") {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const { id } = await params;
  const rpkps = await muatRpkps(id);
  if (!rpkps) {
    return NextResponse.json({ pesan: "RPKPS tidak ditemukan." }, { status: 404 });
  }

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(rpkps.mataKuliah.kurikulum.prodiId)) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });
  }

  // Dokumen yang sudah terbit selalu dicetak dari salinan beku, bukan dari
  // data langsung. Kalau kurikulum disunting setelah pengesahan, berkas yang
  // diunduh tetap identik dengan yang ditandatangani.
  const snapshot =
    rpkps.status === "TERBIT" ? await ambilSnapshot(id, rpkps.versi) : null;

  let sumber = rpkps;
  let riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
  let sidik: string | null = null;

  if (snapshot) {
    const beku = cairkanSnapshot<RpkpsLengkap>(snapshot.isi as unknown as IsiSnapshot);
    sumber = beku.rpkps;
    riwayat = beku.riwayat;
    sidik = snapshot.sidik;
  } else {
    riwayat = await prisma.rpkpsRiwayat.findMany({
      where: { rpkpsId: id },
      orderBy: { dibuatPada: "asc" },
      select: { versi: true, dibuatPada: true, deskripsi: true },
    });
  }

  const buffer = await buatDokumenRpkps(sumber, riwayat, sidik);
  const namaBerkas = `RPKPS ${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama} - ${rpkps.tahunAkademik.kode}${sidik ? " (terbit)" : " (draf)"}.docx`
    .replace(/[/\\?%*:|"<>]/g, "-");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
