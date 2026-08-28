import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { sesiSaatIni } from "@/lib/sesi";
import { muatRpkps } from "@/lib/rpkps/muat";
import { muatKelasEvaluasi } from "@/lib/evaluasi/muat";
import { ambilSnapshotEvaluasi } from "@/lib/evaluasi/evaluasi-inti";
import { kePesertaCapaian, keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { hitungCapaian } from "@/domain/evaluasi/capaian";
import { buatPortofolioMk } from "@/lib/dokumen/portofolio-docx";

export const runtime = "nodejs";

/**
 * Portofolio mata kuliah satu kelas.
 *
 * Selama evaluasi belum ditutup, dokumen dicetak dari data langsung dan
 * ditandai sebagai draf. Setelah ditutup, angkanya diambil dari SALINAN BEKU
 * — dengan alasan yang sama seperti RPKPS terbit: nilai bisa berubah setelah
 * remedial, dan laporan akreditasi harus dapat diulang persis.
 */
export async function GET(
  _permintaan: Request,
  { params }: { params: Promise<{ id: string; kelasId: string }> },
) {
  const sesi = await sesiSaatIni();
  if (!sesi || sesi.status !== "AKTIF") {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const { id, kelasId } = await params;
  const kelas = await muatKelasEvaluasi(kelasId);
  if (!kelas || kelas.rpkps.id !== id) {
    return NextResponse.json({ pesan: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const rpkps = await muatRpkps(id);
  if (!rpkps) {
    return NextResponse.json({ pesan: "RPKPS tidak ditemukan." }, { status: 404 });
  }

  if (!wenangAtasRpkps(sesi, rpkps).bolehLihat) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });
  }

  const peta = susunPetaAsesmen(keSumberPeta(rpkps));
  const evaluasi = kelas.evaluasi;
  const ditutup = evaluasi?.status === "DITUTUP";

  const snapshot =
    ditutup && evaluasi ? await ambilSnapshotEvaluasi(prisma, evaluasi.id, evaluasi.versi) : null;

  const hasil = hitungCapaian({
    asesmen: peta.asesmen,
    cpmk: rpkps.mataKuliah.cpmk.map((c) => ({
      kode: c.kode,
      subCpmkKode: c.subCpmk.map((s) => s.kode),
      cplKode: c.cpl.map((m) => m.cpl.kode),
    })),
    cplDibebankan: rpkps.mataKuliah.cpl.map((m) => m.cpl.kode),
    peserta: kePesertaCapaian(kelas.peserta, peta.asesmen.map((a) => a.kode)),
    ambangKelulusanMhs: Number(evaluasi?.ambangKelulusanMhs ?? rpkps.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(evaluasi?.ambangKetercapaianMk ?? rpkps.ambangKetercapaianMk),
  });

  // Setelah ditutup, angka yang dicetak berasal dari salinan beku.
  const beku = snapshot
    ? (snapshot.isi as unknown as {
        butir: typeof hasil.butir;
        mahasiswa: typeof hasil.mahasiswa;
        asesmen: { kode: string; nama: string; komponen: string | null; bobot: number; subCpmk: { kode: string; bobot: number }[] }[];
      })
    : null;

  const buffer = await buatPortofolioMk({
    mk: {
      kode: rpkps.mataKuliah.kode,
      nama: rpkps.mataKuliah.nama,
      sksTeori: rpkps.mataKuliah.sksTeori,
      sksPraktik: rpkps.mataKuliah.sksPraktik,
    },
    prodi: rpkps.mataKuliah.kurikulum.prodi.nama,
    tahunAkademik: kelas.rpkps.tahunAkademik.kode,
    kelas: kelas.kode,
    dosen: kelas.dosen?.nama ?? null,
    jumlahPeserta: kelas.peserta.length,
    ambangKelulusanMhs: Number(evaluasi?.ambangKelulusanMhs ?? rpkps.ambangKelulusanMhs),
    ambangKetercapaianMk: Number(evaluasi?.ambangKetercapaianMk ?? rpkps.ambangKetercapaianMk),
    kelengkapan: hasil.ringkasan.kelengkapan,
    rerataNilaiAkhir: hasil.ringkasan.rerataNilaiAkhir,
    catatanProses: evaluasi?.catatanProses ?? null,
    asesmen: beku
      ? beku.asesmen.map((a) => ({
          ...a,
          asal: "MINGGUAN" as const,
          minggu: [],
          pembagian: "RATA" as const,
        }))
      : peta.asesmen,
    butir: beku ? beku.butir : hasil.butir,
    mahasiswa: beku ? beku.mahasiswa : hasil.mahasiswa,
    temuan: (evaluasi?.temuan ?? []).map((t) => ({
      kode: t.kode,
      capaianTerukur: t.capaianTerukur === null ? null : Number(t.capaianTerukur),
      akarMasalah: t.akarMasalah,
      tindakan: t.tindakan,
      penanggungJawab: t.penanggungJawab?.nama ?? null,
      taSasaran: t.taSasaran?.kode ?? null,
      statusVerifikasi: t.statusVerifikasi,
      catatanVerifikasi: t.catatanVerifikasi,
    })),
    sidik: snapshot?.sidik ?? null,
    ditutupPada: evaluasi?.ditutupPada ?? null,
    ditutupOleh: evaluasi?.ditutupOleh?.nama ?? null,
  });

  const namaBerkas =
    `Portofolio ${rpkps.mataKuliah.kode} kelas ${kelas.kode} - ${kelas.rpkps.tahunAkademik.kode}${
      snapshot ? "" : " (draf)"
    }.docx`.replace(/[/\\?%*:|"<>]/g, "-");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${namaBerkas}"`,
      "Cache-Control": "no-store",
    },
  });
}
