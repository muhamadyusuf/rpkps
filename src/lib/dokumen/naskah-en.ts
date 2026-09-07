import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Naskah berbahasa Inggris dalam BENTUK yang sama dengan naskah Indonesia.
 *
 * Pencetak dokumen (`rpkps-docx.ts`) dan pratinjau naskah membaca satu bentuk
 * saja: `RpkpsLengkap`. Keduanya tidak tahu — dan tidak perlu tahu — bahasa apa
 * yang sedang dicetak; yang mereka terima adalah baris yang teksnya sudah
 * berbahasa itu. Fungsi ini yang menukarnya: tiap kolom `*En` naik menggantikan
 * pasangan Indonesianya, dengan cadangan satu arah yang sama seperti
 * `proyeksiIsiEn` dan `pilihTeks` — kosong berarti tampil apa adanya.
 *
 * Ini MENGGANTIKAN jalan pintas yang dulu dipakai `siapkanUnduhanRpkps`:
 * melewatkan `rpkps_snapshot.isi_en` (keluaran `proyeksiIsiEn`, bentuk
 * PROYEKSI) sebagai kalau-kalau ia `RpkpsLengkap`. Bentuknya berbeda —
 * `tahunAkademik` di sana string, `pengampu[].pengguna` tidak ada, `cpl` naik
 * ke akar — sehingga unduhan berbahasa Inggris atas dokumen TERBIT selalu
 * gagal pada baris pertama yang membaca `r.tahunAkademik.kode`.
 *
 * Yang TIDAK diterjemahkan, sama persis dengan `proyeksiIsiEn`: kode mata
 * kuliah, kode CPL/CPMK/Sub-CPMK, nama orang, NIDN, angka, dan entri pustaka —
 * judul buku yang diterjemahkan membuat sitasinya tidak dapat dilacak.
 *
 * Sumbernya boleh data langsung maupun salinan beku: keduanya bentuk yang sama,
 * dan salinan beku membawa seluruh kolom `*En` apa adanya. Salinan beku yang
 * dibuat sebelum sebuah kolom `*En` ada tinggal jatuh ke cadangan Indonesia.
 */
export function naskahEn(r: RpkpsLengkap): RpkpsLengkap {
  return {
    ...r,
    deskripsi: en(r.deskripsi, r.deskripsiEn),
    kalimatPembukaCpmk: en(r.kalimatPembukaCpmk, r.kalimatPembukaCpmkEn),

    mataKuliah: {
      ...r.mataKuliah,
      nama: en(r.mataKuliah.nama, r.mataKuliah.namaEn),
      kurikulum: {
        ...r.mataKuliah.kurikulum,
        prodi: {
          ...r.mataKuliah.kurikulum.prodi,
          // Nama prodi tercetak di kaki setiap halaman. Ia tidak ikut
          // `proyeksiIsiEn` karena bukan isi dokumen — halaman publik pun
          // memilihnya dengan `pilihTeks` dari data langsung.
          nama: en(r.mataKuliah.kurikulum.prodi.nama, r.mataKuliah.kurikulum.prodi.namaEn),
        },
      },
      cpl: r.mataKuliah.cpl.map((m) => ({
        ...m,
        cpl: { ...m.cpl, deskripsi: en(m.cpl.deskripsi, m.cpl.deskripsiEn) },
      })),
      cpmk: r.mataKuliah.cpmk.map((c) => ({
        ...c,
        rumusan: en(c.rumusan, c.rumusanEn),
        subCpmk: c.subCpmk.map((s) => ({ ...s, rumusan: en(s.rumusan, s.rumusanEn) })),
      })),
    },

    komponenNilai: r.komponenNilai.map((k) => ({ ...k, nama: en(k.nama, k.namaEn) })),

    pertemuan: r.pertemuan.map((p) => ({
      ...p,
      topik: en(p.topik, p.topikEn),
      subtopik: enDaftar(p.subtopik, p.subtopikEn),
      metodeNarasi: en(p.metodeNarasi, p.metodeNarasiEn),
      aktivitasDosen: en(p.aktivitasDosen, p.aktivitasDosenEn),
      aktivitasMahasiswa: en(p.aktivitasMahasiswa, p.aktivitasMahasiswaEn),
      tugasTerstruktur: en(p.tugasTerstruktur, p.tugasTerstrukturEn),
      penilaianJenis: en(p.penilaianJenis, p.penilaianJenisEn),
      penilaianSistem: en(p.penilaianSistem, p.penilaianSistemEn),
      subCpmk: p.subCpmk.map((s) => ({
        ...s,
        subCpmk: { ...s.subCpmk, rumusan: en(s.subCpmk.rumusan, s.subCpmk.rumusanEn) },
      })),
      aktivitas: p.aktivitas.map((a) => ({ ...a, nama: en(a.nama, a.namaEn) })),
      indikator: p.indikator.map((i) => ({ ...i, teks: en(i.teks, i.teksEn) })),
    })),

    kisiKisi: r.kisiKisi.map((k) => ({
      ...k,
      catatan: en(k.catatan, k.catatanEn),
      butir: k.butir.map((b) => ({
        ...b,
        indikator: en(b.indikator, b.indikatorEn),
        subCpmk: { ...b.subCpmk, rumusan: en(b.subCpmk.rumusan, b.subCpmk.rumusanEn) },
      })),
    })),

    tugas: r.tugas.map((t) => ({
      ...t,
      nama: en(t.nama, t.namaEn),
      deskripsi: en(t.deskripsi, t.deskripsiEn),
      uraianTugas: en(t.uraianTugas, t.uraianTugasEn),
      formatLuaran: en(t.formatLuaran, t.formatLuaranEn),
      ketentuanLain: en(t.ketentuanLain, t.ketentuanLainEn),
      komponenNilai: t.komponenNilai
        ? { ...t.komponenNilai, nama: en(t.komponenNilai.nama, t.komponenNilai.namaEn) }
        : t.komponenNilai,
      kriteria: t.kriteria.map((k) => ({
        ...k,
        indikator: en(k.indikator, k.indikatorEn),
        rincian: enDaftar(k.rincian, k.rincianEn),
      })),
      linimasa: t.linimasa.map((l) => ({
        ...l,
        tahapan: en(l.tahapan, l.tahapanEn),
        aktivitas: en(l.aktivitas, l.aktivitasEn),
      })),
    })),
  };
}

/**
 * Teks Inggris dengan cadangan ke Indonesia. Arahnya SATU — sama seperti
 * `pilihTeks` dan `proyeksiIsiEn`: yang belum diterjemahkan tampil apa adanya,
 * dan halaman pengesahan berkas Inggris menerangkan sekali bahwa naskah
 * Indonesia adalah yang sah.
 */
function en(asal: string, terjemahan: string | null | undefined): string;
function en(asal: string | null, terjemahan: string | null | undefined): string | null;
function en(asal: string | null, terjemahan: string | null | undefined): string | null {
  const t = terjemahan?.trim() ?? "";
  return t.length > 0 ? t : asal;
}

/** Bentuk daftar dari `en()`. Daftar kosong dihitung belum diterjemahkan. */
function enDaftar(asal: string[], terjemahan: readonly string[] | undefined): string[] {
  const t = (terjemahan ?? []).filter((x) => x.trim().length > 0);
  return t.length > 0 ? [...t] : asal;
}
