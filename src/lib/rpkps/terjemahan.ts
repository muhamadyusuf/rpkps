import "server-only";
import { hitungKelengkapan, type PasanganTeks } from "@/domain/rpkps/terjemahan";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Mengumpulkan seluruh pasangan teks sebuah RPKPS untuk dihitung
 * kelengkapannya.
 *
 * Daftarnya sengaja ditulis apa adanya, bukan diturunkan dari nama kolom yang
 * berakhiran "En": kolom `*En` juga ada di lapisan kurikulum
 * (`MataKuliah.namaEn`, `Cpmk.rumusanEn`) yang BUKAN milik dokumen ini dan
 * tidak dapat disunting dari sini. Memasukkannya akan menampilkan angka
 * kelengkapan yang tidak dapat diperbaiki siapa pun dari halaman RPKPS.
 */
export function pasanganTerjemahan(r: RpkpsLengkap): PasanganTeks[] {
  const p: PasanganTeks[] = [
    { asal: r.deskripsi, terjemahan: r.deskripsiEn },
    { asal: r.kalimatPembukaCpmk, terjemahan: r.kalimatPembukaCpmkEn },
    { asal: r.catatanEvaluasi, terjemahan: r.catatanEvaluasiEn },
  ];

  for (const m of r.pertemuan) {
    p.push(
      { asal: m.topik, terjemahan: m.topikEn },
      { asal: m.metodeNarasi, terjemahan: m.metodeNarasiEn },
      { asal: m.aktivitasDosen, terjemahan: m.aktivitasDosenEn },
      { asal: m.aktivitasMahasiswa, terjemahan: m.aktivitasMahasiswaEn },
      { asal: m.tugasTerstruktur, terjemahan: m.tugasTerstrukturEn },
      { asal: m.penilaianJenis, terjemahan: m.penilaianJenisEn },
      { asal: m.penilaianSistem, terjemahan: m.penilaianSistemEn },
    );
    // Daftar dipasangkan menurut urutan — sama seperti penyuntingnya.
    m.subtopik.forEach((teks, i) => p.push({ asal: teks, terjemahan: m.subtopikEn[i] }));
    for (const i of m.indikator) p.push({ asal: i.teks, terjemahan: i.teksEn });
    for (const a of m.aktivitas) p.push({ asal: a.nama, terjemahan: a.namaEn });
  }

  for (const komp of r.komponenNilai) p.push({ asal: komp.nama, terjemahan: komp.namaEn });

  for (const t of r.tugas) {
    p.push(
      { asal: t.nama, terjemahan: t.namaEn },
      { asal: t.deskripsi, terjemahan: t.deskripsiEn },
      { asal: t.uraianTugas, terjemahan: t.uraianTugasEn },
      { asal: t.formatLuaran, terjemahan: t.formatLuaranEn },
      { asal: t.ketentuanLain, terjemahan: t.ketentuanLainEn },
    );
    for (const kr of t.kriteria) {
      p.push({ asal: kr.indikator, terjemahan: kr.indikatorEn });
      kr.rincian.forEach((teks, i) => p.push({ asal: teks, terjemahan: kr.rincianEn[i] }));
    }
    for (const l of t.linimasa) {
      p.push(
        { asal: l.tahapan, terjemahan: l.tahapanEn },
        { asal: l.aktivitas, terjemahan: l.aktivitasEn },
      );
    }
  }

  for (const kk of r.kisiKisi) {
    p.push({ asal: kk.catatan, terjemahan: kk.catatanEn });
    for (const b of kk.butir) p.push({ asal: b.indikator, terjemahan: b.indikatorEn });
  }

  return p;
}

/** Kelengkapan terjemahan sebuah RPKPS. */
export function kelengkapanRpkps(r: RpkpsLengkap) {
  return hitungKelengkapan(pasanganTerjemahan(r));
}
