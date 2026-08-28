import { NextResponse } from "next/server";
import { cakupanProdi } from "@/lib/otorisasi";
import { sesiSaatIni } from "@/lib/sesi";
import { prisma } from "@/lib/prisma";
import { muatBarisCapaian, muatKonteksProdi } from "@/lib/evaluasi/muat";
import { agregasiProdi } from "@/domain/evaluasi/agregasi";
import { buatTabelLkps } from "@/lib/evaluasi/excel-lkps";

export const runtime = "nodejs";

const AMBANG_PRODI = 85;

export async function GET(
  _permintaan: Request,
  { params }: { params: Promise<{ prodiId: string }> },
) {
  const sesi = await sesiSaatIni();
  if (!sesi || sesi.status !== "AKTIF") {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const { prodiId } = await params;
  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(prodiId)) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });
  }

  const prodi = await prisma.prodi.findUnique({
    where: { id: prodiId },
    select: { kode: true, nama: true },
  });
  const kurikulum = await muatKonteksProdi(prodiId);
  if (!prodi || !kurikulum) {
    return NextResponse.json({ pesan: "Program studi tidak ditemukan." }, { status: 404 });
  }

  const baris = await muatBarisCapaian(prodiId);
  const agregasi = agregasiProdi({
    baris,
    cplProdi: kurikulum.cpl.map((c) => c.kode),
    jumlahMkKurikulum: kurikulum._count.mataKuliah,
    ambangKetercapaian: AMBANG_PRODI,
  });

  const buffer = await buatTabelLkps({
    prodi: prodi.nama,
    kurikulum: kurikulum.nama,
    deskripsiCpl: Object.fromEntries(kurikulum.cpl.map((c) => [c.kode, c.deskripsi])),
    ambangKetercapaian: AMBANG_PRODI,
    agregasi,
    baris,
    dibuatPada: new Date(),
  });

  const namaBerkas = `Capaian CPL ${prodi.kode} - ${kurikulum.nama}.xlsx`.replace(
    /[/\\?%*:|"<>]/g,
    "-",
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
