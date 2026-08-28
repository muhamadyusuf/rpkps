import { NextResponse } from "next/server";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { sesiSaatIni } from "@/lib/sesi";
import { muatRpkps } from "@/lib/rpkps/muat";
import { muatKelas } from "@/lib/evaluasi/muat";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { buatTemplatNilai } from "@/lib/evaluasi/excel-nilai";

export const runtime = "nodejs";

/**
 * Templat nilai satu kelas.
 *
 * Dihasilkan ulang setiap kali diunduh, bukan disimpan: judul kolomnya adalah
 * kode asesmen dari peta asesmen RPKPS saat ini, sehingga berkas yang diunduh
 * selalu cocok dengan rencana yang berlaku. Nilai yang sudah tersimpan ikut
 * terisi, jadi unduhan berikutnya adalah lanjutan, bukan mulai dari kosong.
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
  const kelas = await muatKelas(kelasId);
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

  // Nomor baris kisi-kisi dipetakan ke idnya sekali di sini; lembar butir
  // memakai nomor (yang dibaca dosen), basis data memakai id.
  const idButir = new Map<string, { jenis: "UTS" | "UAS"; nomor: number }>();
  for (const k of rpkps.kisiKisi) {
    for (const b of k.butir) idButir.set(b.id, { jenis: k.jenis, nomor: b.nomor });
  }

  const buffer = await buatTemplatNilai({
    mk: { kode: rpkps.mataKuliah.kode, nama: rpkps.mataKuliah.nama },
    tahunAkademik: rpkps.tahunAkademik.kode,
    kelas: kelas.kode,
    asesmen: peta.asesmen,
    peserta: kelas.peserta.map((p) => ({
      nim: p.mahasiswa.nim,
      nama: p.mahasiswa.nama,
      angkatan: p.mahasiswa.angkatan,
      skor: Object.fromEntries(p.nilai.map((n) => [n.asesmenKode, Number(n.skor)])),
      skorButir: Object.fromEntries(
        p.nilaiButir.flatMap((n) => {
          const acuan = idButir.get(n.butirKisiKisiId);
          return acuan ? [[`${acuan.jenis}|${acuan.nomor}`, Number(n.skor)] as const] : [];
        }),
      ),
    })),
    ujian: rpkps.kisiKisi.map((k) => ({
      jenis: k.jenis,
      butir: k.butir.map((b) => ({
        nomor: b.nomor,
        subCpmkKode: b.subCpmk.kode,
        skorMaks: Number(b.skor),
      })),
    })),
  });

  const namaBerkas =
    `Nilai ${rpkps.mataKuliah.kode} kelas ${kelas.kode} - ${rpkps.tahunAkademik.kode}.xlsx`.replace(
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
