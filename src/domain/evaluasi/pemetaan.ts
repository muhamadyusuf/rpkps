import type { SumberPeta } from "./peta-asesmen";

/**
 * Pemetaan dari bentuk baris database ke masukan peta asesmen.
 *
 * Tipe argumennya struktural, bukan tipe Prisma, mengikuti pola
 * `src/domain/rpkps/pemetaan.ts` supaya modul ini tetap murni dan dapat
 * dipakai dari server maupun dari skrip uji.
 */
export interface SumberPetaDb {
  komponenNilai: { id: string; nama: string; bobot: unknown }[];
  pertemuan: {
    minggu: number;
    jenis: "EFEKTIF" | "UTS" | "UAS";
    penilaianJenis: string | null;
    bobot: unknown;
    komponenNilaiId: string | null;
    subCpmk: { subCpmk: { kode: string } }[];
  }[];
  tugas: {
    nomor: number;
    nama: string;
    bobot: unknown;
    komponenNilaiId: string | null;
    mingguMulai: number;
    mingguSelesai: number;
    subCpmk: { subCpmk: { kode: string } }[];
  }[];
  kisiKisi: {
    jenis: "UTS" | "UAS";
    butir: { skor: unknown; subCpmk: { kode: string } }[];
  }[];
  mataKuliah: {
    cpl: { cpl: { kode: string } }[];
    cpmk: {
      kode: string;
      cpl: { cpl: { kode: string } }[];
      subCpmk: { kode: string }[];
    }[];
  };
}

export function keSumberPeta(r: SumberPetaDb): SumberPeta {
  // Komponen dirujuk lewat nama pada peta asesmen, bukan id: nama itulah yang
  // tercetak di dokumen dan yang dibaca dosen saat menelusuri bobot.
  const namaKomponen = new Map(r.komponenNilai.map((k) => [k.id, k.nama]));

  return {
    komponenNilai: r.komponenNilai.map((k) => ({ nama: k.nama, bobot: Number(k.bobot) })),
    pertemuan: r.pertemuan.map((p) => ({
      minggu: p.minggu,
      jenis: p.jenis,
      penilaianJenis: p.penilaianJenis,
      bobot: Number(p.bobot),
      komponen: p.komponenNilaiId ? (namaKomponen.get(p.komponenNilaiId) ?? null) : null,
      subCpmkKode: p.subCpmk.map((s) => s.subCpmk.kode),
    })),
    tugas: r.tugas.map((t) => ({
      nomor: t.nomor,
      nama: t.nama,
      bobot: Number(t.bobot),
      komponen: t.komponenNilaiId ? (namaKomponen.get(t.komponenNilaiId) ?? null) : null,
      mingguMulai: t.mingguMulai,
      mingguSelesai: t.mingguSelesai,
      subCpmkKode: t.subCpmk.map((s) => s.subCpmk.kode),
    })),
    kisiKisi: r.kisiKisi.map((k) => ({
      jenis: k.jenis,
      butir: k.butir.map((b) => ({ subCpmkKode: b.subCpmk.kode, skor: Number(b.skor) })),
    })),
    cpmk: r.mataKuliah.cpmk.map((c) => ({
      kode: c.kode,
      subCpmkKode: c.subCpmk.map((s) => s.kode),
      cplKode: c.cpl.map((m) => m.cpl.kode),
    })),
    cplDibebankan: r.mataKuliah.cpl.map((m) => m.cpl.kode),
  };
}

/**
 * Peserta kelas beserta nilainya → masukan mesin capaian.
 *
 * Kolom asesmen yang belum punya baris nilai menjadi `null`, bukan 0: mesin
 * capaian membedakan "belum dinilai" dari "dinilai nol", dan perbedaan itu
 * menentukan apakah evaluasi boleh ditutup.
 */
export interface PesertaDb {
  mahasiswa: { nim: string; nama: string };
  nilai: { asesmenKode: string; skor: unknown }[];
}

export function kePesertaCapaian(
  peserta: readonly PesertaDb[],
  kodeAsesmen: readonly string[],
): { nim: string; nama: string; skor: Record<string, number | null> }[] {
  return peserta.map((p) => {
    const tersimpan = new Map(p.nilai.map((n) => [n.asesmenKode, Number(n.skor)]));
    const skor: Record<string, number | null> = {};
    for (const kode of kodeAsesmen) skor[kode] = tersimpan.get(kode) ?? null;
    return { nim: p.mahasiswa.nim, nama: p.mahasiswa.nama, skor };
  });
}
