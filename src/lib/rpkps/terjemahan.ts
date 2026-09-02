import "server-only";
import {
  hitungKelengkapan,
  type MedanTerjemahan,
  type PasanganTeks,
} from "@/domain/rpkps/terjemahan";
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

/**
 * Medan terjemahan beserta alamatnya — bentuk yang dapat ditulis kembali.
 *
 * Daftarnya sengaja lebih sempit daripada `pasanganTerjemahan`: hanya medan
 * yang punya baris sendiri dengan id, sehingga hasilnya dapat dituliskan
 * kembali tanpa menebak. Daftar berindeks (`subtopik`, `rincian`) tidak ikut —
 * menuliskannya kembali menuntut menulis ulang seluruh larik, dan larik itu
 * milik muatan simpan yang lain (§5.3).
 */
export function medanRpkps(r: RpkpsLengkap): MedanTerjemahan[] {
  const m: MedanTerjemahan[] = [];
  const tambah = (
    alamat: string,
    label: string,
    asal: string | null,
    terjemahan: string | null,
  ) => {
    m.push({ alamat, label, asal: asal ?? "", terjemahan });
  };

  tambah(`rpkps:${r.id}:deskripsiEn`, "Deskripsi mata kuliah", r.deskripsi, r.deskripsiEn);
  tambah(
    `rpkps:${r.id}:kalimatPembukaCpmkEn`,
    "Kalimat pembuka CPMK",
    r.kalimatPembukaCpmk,
    r.kalimatPembukaCpmkEn,
  );

  for (const p of r.pertemuan) {
    const m0 = `Minggu ${p.minggu}`;
    tambah(`pertemuan:${p.id}:topikEn`, `${m0} · Topik`, p.topik, p.topikEn);
    tambah(`pertemuan:${p.id}:metodeNarasiEn`, `${m0} · Metode`, p.metodeNarasi, p.metodeNarasiEn);
    tambah(
      `pertemuan:${p.id}:aktivitasDosenEn`,
      `${m0} · Aktivitas dosen`,
      p.aktivitasDosen,
      p.aktivitasDosenEn,
    );
    tambah(
      `pertemuan:${p.id}:aktivitasMahasiswaEn`,
      `${m0} · Aktivitas mahasiswa`,
      p.aktivitasMahasiswa,
      p.aktivitasMahasiswaEn,
    );
    tambah(
      `pertemuan:${p.id}:tugasTerstrukturEn`,
      `${m0} · Tugas terstruktur`,
      p.tugasTerstruktur,
      p.tugasTerstrukturEn,
    );
    tambah(
      `pertemuan:${p.id}:penilaianJenisEn`,
      `${m0} · Jenis penilaian`,
      p.penilaianJenis,
      p.penilaianJenisEn,
    );
    tambah(
      `pertemuan:${p.id}:penilaianSistemEn`,
      `${m0} · Sistem penilaian`,
      p.penilaianSistem,
      p.penilaianSistemEn,
    );
    for (const i of p.indikator) {
      tambah(`indikator:${i.id}:teksEn`, `${m0} · Indikator`, i.teks, i.teksEn);
    }
    for (const a of p.aktivitas) {
      tambah(`aktivitasBelajar:${a.id}:namaEn`, `${m0} · Aktivitas`, a.nama, a.namaEn);
    }
  }

  for (const komp of r.komponenNilai) {
    tambah(`komponenNilai:${komp.id}:namaEn`, `Komponen · ${komp.nama}`, komp.nama, komp.namaEn);
  }

  for (const t of r.tugas) {
    const t0 = `Tugas ${t.nomor}`;
    tambah(`tugas:${t.id}:namaEn`, `${t0} · Nama`, t.nama, t.namaEn);
    tambah(`tugas:${t.id}:deskripsiEn`, `${t0} · Deskripsi`, t.deskripsi, t.deskripsiEn);
    tambah(`tugas:${t.id}:uraianTugasEn`, `${t0} · Uraian`, t.uraianTugas, t.uraianTugasEn);
    tambah(`tugas:${t.id}:formatLuaranEn`, `${t0} · Format luaran`, t.formatLuaran, t.formatLuaranEn);
    tambah(
      `tugas:${t.id}:ketentuanLainEn`,
      `${t0} · Ketentuan lain`,
      t.ketentuanLain,
      t.ketentuanLainEn,
    );
    for (const kr of t.kriteria) {
      tambah(
        `kriteriaTugas:${kr.id}:indikatorEn`,
        `${t0} · Indikator ${kr.nomor}`,
        kr.indikator,
        kr.indikatorEn,
      );
    }
    for (const l of t.linimasa) {
      tambah(`linimasaTugas:${l.id}:tahapanEn`, `${t0} · Tahapan`, l.tahapan, l.tahapanEn);
      tambah(`linimasaTugas:${l.id}:aktivitasEn`, `${t0} · Aktivitas`, l.aktivitas, l.aktivitasEn);
    }
  }

  for (const kk of r.kisiKisi) {
    tambah(`kisiKisi:${kk.id}:catatanEn`, `Kisi-kisi ${kk.jenis} · Catatan`, kk.catatan, kk.catatanEn);
    for (const b of kk.butir) {
      tambah(
        `butirKisiKisi:${b.id}:indikatorEn`,
        `Kisi-kisi ${kk.jenis} · Butir ${b.nomor}`,
        b.indikator,
        b.indikatorEn,
      );
    }
  }

  return m;
}
