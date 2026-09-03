import "server-only";
import {
  hitungKelengkapan,
  susunAlamat,
  type MedanTerjemahan,
  type PasanganTeks,
} from "@/domain/rpkps/terjemahan";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Pasangan teks Indonesia–Inggris sebuah RPKPS, untuk menghitung
 * kelengkapannya.
 *
 * DITURUNKAN dari `medanRpkps`, bukan ditulis sebagai daftar kedua. Dulu
 * keduanya adalah daftar terpisah, dan itulah bug docs/11 §8.2: penyebut
 * kelengkapan memuat `subtopik` serta `rincian`, sedangkan yang ditawarkan ke
 * AI tidak — sehingga "Terjemahkan yang belum" selalu berhenti di bawah 100%
 * dan tidak ada tombol mana pun yang dapat menutup sisanya. Selama keduanya
 * satu sumber, angka yang ditampilkan selalu angka yang dapat dikerjakan.
 *
 * Kolom `*En` lapisan KURIKULUM (`MataKuliah.namaEn`, `Cpmk.rumusanEn`) tetap
 * di luar: ia bukan milik dokumen ini dan tidak dapat disunting dari sini.
 * Memasukkannya menampilkan kekurangan yang tidak dapat diperbaiki siapa pun
 * dari halaman RPKPS.
 */
export function pasanganTerjemahan(r: RpkpsLengkap): PasanganTeks[] {
  return medanRpkps(r).map((m) => ({ asal: m.asal, terjemahan: m.terjemahan }));
}

/** Kelengkapan terjemahan sebuah RPKPS. */
export function kelengkapanRpkps(r: RpkpsLengkap) {
  return hitungKelengkapan(pasanganTerjemahan(r));
}

/**
 * Medan terjemahan beserta alamatnya — bentuk yang dapat ditulis kembali.
 *
 * SETIAP teks yang dihitung kelengkapan ada di sini, termasuk elemen larik
 * (`subtopik`, `rincian`) yang alamatnya berindeks. Menambah medan `*En` baru
 * ke skema tanpa menambahkannya ke sini berarti menambah pekerjaan yang tidak
 * pernah dapat diselesaikan; penjaganya `terjemahan-cakupan.test.ts`.
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
  /**
   * Elemen larik, dipasangkan MENURUT URUTAN — sama seperti penyuntingnya.
   * Larik Inggris boleh lebih pendek (atau kosong): yang menentukan banyaknya
   * pekerjaan adalah larik Indonesia.
   */
  const tambahLarik = (
    model: string,
    id: string,
    medan: string,
    label: (i: number) => string,
    asal: readonly string[],
    terjemahan: readonly string[],
  ) => {
    asal.forEach((teks, i) => {
      tambah(susunAlamat(model, id, medan, i), label(i), teks, terjemahan[i] ?? null);
    });
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
    tambahLarik(
      "pertemuan",
      p.id,
      "subtopikEn",
      (i) => `${m0} · Subtopik ${i + 1}`,
      p.subtopik,
      p.subtopikEn,
    );
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
      tambahLarik(
        "kriteriaTugas",
        kr.id,
        "rincianEn",
        (i) => `${t0} · Rincian ${kr.nomor}.${i + 1}`,
        kr.rincian,
        kr.rincianEn,
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
