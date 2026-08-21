import type {
  CpmkInput,
  KurikulumInput,
  MataKuliahInput,
  ProfilLulusanInput,
} from "./tipe";
import type { LevelBloom } from "./bloom";

/**
 * Bentuk baris mentah dari berkas Excel. Sengaja longgar (semua string)
 * supaya kesalahan pengisian menjadi TEMUAN yang bisa dibaca dosen,
 * bukan galat parsing yang menggagalkan seluruh berkas.
 */
export interface BarisProfilLulusan {
  kode: string;
  deskripsi: string;
}
export interface BarisCpl {
  kode: string;
  deskripsi: string;
  tingkatKkni?: string;
  /// Kode profil lulusan yang ditopang CPL ini, dipisah koma. Boleh kosong
  /// pada berkas yang diunduh sebelum kolom ini ada.
  profilLulusanKode?: string;
}
export interface BarisMk {
  kode: string;
  nama: string;
  semester: string;
  sksTeori: string;
  sksPraktik: string;
  status?: string;
  cplKode: string; // dipisah koma
}
export interface BarisCpmk {
  mkKode: string;
  kode: string;
  rumusan: string;
  levelBloom?: string;
  cplKode: string;
}
export interface BarisSubCpmk {
  /// Kode CPMK hanya unik DI DALAM satu mata kuliah, jadi induk Sub-CPMK
  /// tidak dapat ditentukan dari kode CPMK saja. Kolom ini boleh kosong pada
  /// berkas lama — lihat rakitKurikulum untuk aturan penelusurannya.
  mkKode?: string;
  cpmkKode: string;
  kode: string;
  rumusan: string;
  levelBloom?: string;
}

export interface IsiBerkas {
  /// Lembar baru; berkas lama tidak memilikinya dan itu bukan galat.
  profilLulusan?: BarisProfilLulusan[];
  cpl: BarisCpl[];
  mk: BarisMk[];
  cpmk: BarisCpmk[];
  subCpmk: BarisSubCpmk[];
}

export interface GalatBaris {
  lembar: string;
  baris: number;
  pesan: string;
}

export interface HasilRakit {
  kurikulum: KurikulumInput;
  galat: GalatBaris[];
}

const LEVEL_SAH = new Set<string>([
  "C1", "C2", "C3", "C4", "C5", "C6",
  "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5",
]);

function pisahKode(teks: string): string[] {
  return teks
    .split(/[,;/]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function bacaLevel(nilai: string | undefined): LevelBloom | null {
  const v = (nilai ?? "").trim().toUpperCase();
  return LEVEL_SAH.has(v) ? (v as LevelBloom) : null;
}

/** Kunci gabungan MK + CPMK, sejalan dengan @@unique([mataKuliahId, kode]). */
function kunciCpmk(mkKode: string, cpmkKode: string): string {
  return `${mkKode}\u0000${cpmkKode}`;
}

function bacaAngka(nilai: string | undefined): number | null {
  const v = (nilai ?? "").trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Merakit isi berkas menjadi struktur kurikulum.
 *
 * Baris yang tidak dapat dirakit dilaporkan sebagai galat, tetapi baris lain
 * tetap diproses — dosen dapat memperbaiki beberapa kesalahan sekaligus,
 * bukan satu per satu tiap kali mengunggah ulang.
 */
export function rakitKurikulum(
  isi: IsiBerkas,
  meta: { nama: string; tahun: number },
): HasilRakit {
  const galat: GalatBaris[] = [];

  // Profil lulusan dirakit lebih dulu karena lembar CPL menunjuk balik ke sini.
  // Kode berulang DITOLAK di lapisan ini, bukan diserahkan ke validator: dua
  // baris berkode sama akan menabrak @@unique([kurikulumId, kode]) saat
  // disimpan, dan galat basis data tidak menyebutkan baris keberapa.
  const petaPl = new Map<string, ProfilLulusanInput>();
  (isi.profilLulusan ?? []).forEach((b, i) => {
    const baris = i + 2;
    const kode = b.kode?.trim().toUpperCase();
    if (!kode) {
      galat.push({ lembar: "Profil Lulusan", baris, pesan: "Kode profil lulusan kosong." });
      return;
    }
    if (petaPl.has(kode)) {
      galat.push({ lembar: "Profil Lulusan", baris, pesan: `${kode}: kode berulang.` });
      return;
    }
    if (!b.deskripsi?.trim()) {
      galat.push({ lembar: "Profil Lulusan", baris, pesan: `${kode}: rumusan profil kosong.` });
      return;
    }
    petaPl.set(kode, { kode, deskripsi: b.deskripsi.trim() });
  });

  const cpl = isi.cpl
    .map((b, i) => {
      const kode = b.kode.trim().toUpperCase();
      if (!kode) {
        galat.push({ lembar: "CPL", baris: i + 2, pesan: "Kode CPL kosong." });
        return null;
      }
      if (!b.deskripsi?.trim()) {
        galat.push({ lembar: "CPL", baris: i + 2, pesan: `${kode}: deskripsi kosong.` });
        return null;
      }
      return {
        kode,
        deskripsi: b.deskripsi.trim(),
        tingkatKkni: bacaAngka(b.tingkatKkni),
        profilLulusanKode: pisahKode(b.profilLulusanKode ?? ""),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const petaMk = new Map<string, MataKuliahInput>();
  isi.mk.forEach((b, i) => {
    const baris = i + 2;
    const kode = b.kode.trim().toUpperCase();
    if (!kode) {
      galat.push({ lembar: "Mata Kuliah", baris, pesan: "Kode mata kuliah kosong." });
      return;
    }
    if (petaMk.has(kode)) {
      galat.push({ lembar: "Mata Kuliah", baris, pesan: `${kode}: kode berulang.` });
      return;
    }
    const semester = bacaAngka(b.semester);
    const sksTeori = bacaAngka(b.sksTeori);
    const sksPraktik = bacaAngka(b.sksPraktik) ?? 0;

    if (semester === null) {
      galat.push({ lembar: "Mata Kuliah", baris, pesan: `${kode}: semester harus angka.` });
      return;
    }
    if (sksTeori === null) {
      galat.push({
        lembar: "Mata Kuliah",
        baris,
        pesan: `${kode}: sks teori harus angka (isi 0 bila murni praktik).`,
      });
      return;
    }

    petaMk.set(kode, {
      kode,
      nama: b.nama?.trim() || kode,
      semester,
      sksTeori,
      sksPraktik,
      cplKode: pisahKode(b.cplKode ?? ""),
      cpmk: [],
    });
  });

  // Kode CPMK hanya unik di dalam satu mata kuliah (lihat @@unique pada model
  // Cpmk), sehingga kuncinya harus gabungan MK + CPMK. Memakai kode CPMK saja
  // membuat "CPMK01" milik dua mata kuliah bertabrakan — pola yang lazim di
  // buku kurikulum.
  const petaCpmk = new Map<string, CpmkInput>();
  // Indeks bantu untuk berkas yang lembar Sub-CPMK-nya belum berkolom Kode MK.
  const cpmkPerKode = new Map<string, { mkKode: string; cpmk: CpmkInput }[]>();

  isi.cpmk.forEach((b, i) => {
    const baris = i + 2;
    const mkKode = b.mkKode?.trim().toUpperCase();
    const kode = b.kode?.trim().toUpperCase();
    if (!kode) {
      galat.push({ lembar: "CPMK", baris, pesan: "Kode CPMK kosong." });
      return;
    }
    const mk = mkKode ? petaMk.get(mkKode) : undefined;
    if (!mk) {
      galat.push({
        lembar: "CPMK",
        baris,
        pesan: `${kode}: mata kuliah "${mkKode ?? ""}" tidak ada di lembar Mata Kuliah.`,
      });
      return;
    }
    if (petaCpmk.has(kunciCpmk(mk.kode, kode))) {
      galat.push({
        lembar: "CPMK",
        baris,
        pesan: `${kode}: kode berulang pada mata kuliah ${mk.kode}.`,
      });
      return;
    }

    const cpmk: CpmkInput = {
      kode,
      rumusan: b.rumusan?.trim() ?? "",
      levelBloom: bacaLevel(b.levelBloom),
      cplKode: pisahKode(b.cplKode ?? ""),
      subCpmk: [],
    };
    petaCpmk.set(kunciCpmk(mk.kode, kode), cpmk);
    const sekode = cpmkPerKode.get(kode) ?? [];
    sekode.push({ mkKode: mk.kode, cpmk });
    cpmkPerKode.set(kode, sekode);
    mk.cpmk.push(cpmk);
  });

  /**
   * Menelusuri CPMK induk sebuah Sub-CPMK.
   *
   * Bila Kode MK diisi, penelusuran tepat. Bila kosong — berkas lama, sebelum
   * kolom itu ada — kode CPMK ditelusuri ke seluruh mata kuliah: diterima
   * hanya jika cocok tunggal, dan ditolak sebagai AMBIGU bila cocok di banyak
   * mata kuliah. Menebak salah satu akan menempelkan Sub-CPMK ke mata kuliah
   * yang keliru tanpa jejak apa pun.
   */
  function cariCpmkInduk(
    mkKode: string | undefined,
    cpmkKode: string,
  ): { induk: CpmkInput } | { pesan: string } {
    if (mkKode) {
      if (!petaMk.has(mkKode)) {
        return { pesan: `mata kuliah "${mkKode}" tidak ada di lembar Mata Kuliah.` };
      }
      const induk = petaCpmk.get(kunciCpmk(mkKode, cpmkKode));
      return induk
        ? { induk }
        : { pesan: `CPMK "${cpmkKode}" tidak ada pada mata kuliah ${mkKode}.` };
    }

    const calon = cpmkPerKode.get(cpmkKode) ?? [];
    if (calon.length === 0) {
      return { pesan: `CPMK "${cpmkKode}" tidak ada di lembar CPMK.` };
    }
    if (calon.length > 1) {
      const daftar = calon.map((c) => c.mkKode).join(", ");
      return {
        pesan:
          `CPMK "${cpmkKode}" dipakai oleh beberapa mata kuliah (${daftar}). ` +
          `Isi kolom Kode MK agar induknya jelas.`,
      };
    }
    return { induk: calon[0].cpmk };
  }

  isi.subCpmk.forEach((b, i) => {
    const baris = i + 2;
    const mkKode = b.mkKode?.trim().toUpperCase();
    const cpmkKode = b.cpmkKode?.trim().toUpperCase();
    const kode = b.kode?.trim().toUpperCase();
    if (!kode) {
      galat.push({ lembar: "Sub-CPMK", baris, pesan: "Kode Sub-CPMK kosong." });
      return;
    }
    if (!cpmkKode) {
      galat.push({ lembar: "Sub-CPMK", baris, pesan: `${kode}: kode CPMK induk kosong.` });
      return;
    }

    const cpmk = cariCpmkInduk(mkKode, cpmkKode);
    if ("pesan" in cpmk) {
      galat.push({ lembar: "Sub-CPMK", baris, pesan: `${kode}: ${cpmk.pesan}` });
      return;
    }

    cpmk.induk.subCpmk.push({
      kode,
      rumusan: b.rumusan?.trim() ?? "",
      levelBloom: bacaLevel(b.levelBloom),
    });
  });

  return {
    kurikulum: {
      nama: meta.nama,
      tahun: meta.tahun,
      profilLulusan: [...petaPl.values()],
      cpl,
      mataKuliah: [...petaMk.values()],
    },
    galat,
  };
}
