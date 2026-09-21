import { NextResponse } from "next/server";
import { lajuImporTemplat, jawabanTerlaluBanyak } from "@/lib/keamanan/laju";
import { bahasaBerkas } from "@/lib/dokumen/bahasa-berkas";
import { muatRpkps } from "@/lib/rpkps/muat";
import { buatTemplat } from "@/lib/rpkps/templat-excel";
import { bolehSuntingIsi, wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { sesiSaatIni } from "@/lib/sesi";

export const runtime = "nodejs";

/**
 * Template isi RPKPS untuk diisi lalu diimpor kembali (docs/23).
 *
 * Dibuat ulang tiap diunduh dari keadaan dokumen SAAT INI, tidak disimpan:
 * kolom terkunci (minggu, jenis, Sub-CPMK terjadwal) harus cocok dengan
 * kerangka yang berlaku, dan isi yang sudah ada ikut terunduh sehingga
 * unduhan berikutnya adalah lanjutan, bukan mulai dari kosong.
 *
 * Wewenangnya `boleh` (pengampu atau pengelola di prodinya), bukan sekadar
 * `bolehLihat`: template memuat isi yang dapat ditimpakan kembali, dan
 * dokumen yang tidak dapat disunting tidak punya gunanya.
 */
export async function GET(
  permintaan: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesi = await sesiSaatIni();
  if (!sesi || sesi.status !== "AKTIF") {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const laju = lajuImporTemplat.coba(sesi.id);
  if (!laju.boleh) return jawabanTerlaluBanyak(laju.ulangDalamMs);

  const { id } = await params;
  const rpkps = await muatRpkps(id);
  if (!rpkps) return NextResponse.json({ pesan: "RPKPS tidak ditemukan." }, { status: 404 });

  if (!wenangAtasRpkps(sesi, rpkps).boleh) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });
  }
  if (!bolehSuntingIsi(rpkps.status)) {
    return NextResponse.json({ pesan: "Dokumen ini tidak dapat disunting." }, { status: 409 });
  }

  const buffer = await buatTemplat(rpkps, bahasaBerkas(permintaan));
  const nama = `Template RPKPS ${rpkps.mataKuliah.kode} - ${rpkps.tahunAkademik.kode}.xlsx`.replace(
    /[/\\?%*:|"<>]/g,
    "-",
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nama}"`,
      "Cache-Control": "no-store",
    },
  });
}
