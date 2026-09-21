import {
  JENIS_PUSTAKA,
  periksaDraf,
  type BentukSoal,
  type DrafButirUjian,
  type DrafKisiKisi,
  type DrafKriteria,
  type DrafPertemuan,
  type DrafPustaka,
  type DrafRpkps,
  type DrafTugas,
  type DrafUjian,
  type JenisPustaka,
  type JenisTugas,
  type KonteksDraf,
} from "@/domain/rpkps/draf";

/**
 * Impor isi RPKPS dari berkas template (docs/23).
 *
 * MURNI: yang masuk adalah sel-sel yang sudah dibaca menjadi string, yang
 * keluar adalah `DrafRpkps` dan temuan. Pembacaan `.xlsx`-nya ada di
 * `src/lib/rpkps/templat-excel.ts`, supaya seluruh aturan di sini dapat diuji
 * tanpa berkas.
 *
 * Tiga hal yang membedakannya dari draf AI, dan ketiganya disengaja:
 *
 *  1. Angka dosen TIDAK ditambal. `alokasikanAsesmen` ada karena model lalai;
 *     berkas dosen adalah sumber kebenaran, dan menormalkannya ke 100 berarti
 *     server mengarang keputusan penilaian. Yang tidak pas dilaporkan.
 *  2. Keluarannya melewati `periksaDraf()` yang SAMA. Tidak ada aturan bobot,
 *     komponen, atau keterukuran Sub-CPMK di berkas ini — hanya aturan tentang
 *     BERKAS: bentuk sel, batas, dan kecocokan dengan kerangka.
 *  3. Kerangka tidak dapat ditulis. Minggu, jenis, dan Sub-CPMK terjadwal ada
 *     di template sebagai rujukan; yang berbeda dari kerangka menjadi temuan.
 */

// ─────────────────────────────────────────────────────────────────────────
// Skema berkas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Nama lembar. Pengenal berkas Excel tetap bahasa Indonesia di kedua bahasa
 * (AGENTS.md): berkas yang diunduh dalam bahasa Inggris harus tetap terbaca
 * saat diunggah. Hanya teks lembar Petunjuk yang diterjemahkan.
 */
export const LEMBAR_TEMPLAT = {
  petunjuk: "Petunjuk",
  identitas: "Identitas",
  mingguan: "Mingguan",
  komponen: "Komponen Nilai",
  ujian: "Ujian",
  tugas: "Tugas",
  kriteria: "Kriteria Tugas",
  kisi: "Kisi-kisi",
  pustaka: "Pustaka",
} as const;

export type LembarTemplat = keyof typeof LEMBAR_TEMPLAT;

/** Lembar berdaftar (bertabel). Petunjuk dan Identitas dibaca dengan cara lain. */
export type LembarTabel = Exclude<LembarTemplat, "petunjuk" | "identitas">;

/** Setiap lembar wajib ada: lembar yang hilang tidak boleh terbaca sebagai "kosong". */
export const LEMBAR_WAJIB: readonly LembarTemplat[] = [
  "petunjuk", "identitas", "mingguan", "komponen", "ujian", "tugas", "kriteria", "kisi", "pustaka",
];

/**
 * Kolom tiap lembar. `judul` dicocokkan lewat teksnya, bukan posisinya,
 * setelah `normalisasiJudul` — bagian dalam kurung hanyalah petunjuk pengisian.
 */
export const SKEMA_TEMPLAT = {
  mingguan: {
    kunci: [
      "minggu", "jenis", "subCpmk", "topik", "subtopik", "metode", "aktivitasDosen",
      "aktivitasMahasiswa", "tugasTerstruktur", "penilaianJenis", "penilaianSistem",
      "bobot", "komponen", "indikator", "pustaka",
    ],
    judul: [
      "Minggu", "Jenis", "Sub-CPMK Terjadwal", "Topik", "Subtopik (satu per baris sel)",
      "Metode Pembelajaran", "Aktivitas Dosen", "Aktivitas Mahasiswa", "Tugas Terstruktur",
      "Jenis Penilaian", "Sistem Penilaian", "Bobot (%)", "Komponen Nilai",
      "Indikator (satu per baris sel)", "Pustaka (pisah koma)",
    ],
  },
  komponen: {
    kunci: ["nama", "bobot"],
    judul: ["Nama Komponen", "Bobot (%)"],
  },
  ujian: {
    kunci: ["minggu", "jenis", "bobot", "komponen"],
    judul: ["Minggu", "Jenis", "Bobot (%)", "Komponen Nilai"],
  },
  tugas: {
    kunci: [
      "nomor", "nama", "jenis", "mingguMulai", "mingguSelesai", "bobot", "komponen",
      "subCpmk", "deskripsi", "uraian", "format",
    ],
    judul: [
      "Nomor", "Nama Tugas", "Jenis (INDIVIDU/KELOMPOK)", "Minggu Mulai", "Minggu Selesai",
      "Bobot (%)", "Komponen Nilai", "Kode Sub-CPMK (pisah koma)", "Deskripsi",
      "Uraian Tugas", "Format Luaran",
    ],
  },
  kriteria: {
    kunci: ["tugas", "nomor", "indikator", "rincian", "bobot"],
    judul: [
      "Nomor Tugas", "Nomor Kriteria", "Indikator", "Rincian (satu per baris sel)", "Bobot (%)",
    ],
  },
  kisi: {
    kunci: [
      "jenis", "durasi", "nomor", "subCpmk", "levelBloom", "bentuk", "jumlah", "skor", "indikator",
    ],
    judul: [
      "Jenis (UTS/UAS)", "Durasi (menit)", "Nomor Butir", "Kode Sub-CPMK", "Level Bloom",
      "Bentuk Soal", "Jumlah Butir", "Skor", "Indikator Soal",
    ],
  },
  pustaka: {
    kunci: ["jenis", "nomor", "teks", "url"],
    judul: ["Jenis (UTAMA/PENDUKUNG/DARING/TOOLS)", "Nomor", "Referensi", "URL"],
  },
} as const satisfies Record<LembarTabel, { kunci: readonly string[]; judul: readonly string[] }>;

/** Label baris pada lembar Identitas dan cap pada lembar Petunjuk. */
export const LABEL_IDENTITAS = {
  deskripsi: "Deskripsi Mata Kuliah",
  pembuka: "Kalimat Pembuka CPMK",
} as const;

export const LABEL_CAP = {
  kodeMk: "Kode MK",
  rpkpsId: "ID RPKPS",
  tahunAkademik: "Tahun Akademik",
} as const;

/**
 * "Bobot (%)" dan "Bobot" sama; kurung hanya petunjuk. Dipakai pembaca
 * (mencocokkan judul) dan uji.
 */
export function normalisasiJudul(judul: string): string {
  return judul.split("(")[0].replace(/\s+/g, " ").trim().toLowerCase();
}

export const BATAS_TEMPLAT = {
  /**
   * 3 MB, bukan 5 MB seperti impor kurikulum: batas badan Server Action
   * aplikasi ini 4 MB (`next.config.ts`), dan berkas yang lebih besar dari itu
   * gagal sebagai galat jaringan tanpa sebab. Template terisi penuh hanya
   * puluhan kilobita.
   */
  ukuranBayt: 3 * 1024 * 1024,
  /** Jumlah byte SETELAH dibuka; menolak berkas ZIP yang membengkak. */
  ukuranTerurai: 50 * 1024 * 1024,
  entriZip: 200,
  barisPerLembar: 500,
  topik: 300,
  subtopik: 300,
  subtopikJumlah: 30,
  narasi: 4000,
  indikator: 500,
  indikatorJumlah: 30,
  rincian: 500,
  rincianJumlah: 30,
  deskripsi: 8000,
  nama: 200,
  teksPendek: 300,
  pustakaTeks: 1000,
  url: 500,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Bentuk masukan (sel mentah)
// ─────────────────────────────────────────────────────────────────────────

type Sel = string;

/** `baris` adalah nomor baris di lembar Excel, untuk menunjuk lokasi temuan. */
export interface BarisMingguan {
  baris: number;
  minggu: Sel; jenis: Sel; subCpmk: Sel; topik: Sel; subtopik: Sel; metode: Sel;
  aktivitasDosen: Sel; aktivitasMahasiswa: Sel; tugasTerstruktur: Sel;
  penilaianJenis: Sel; penilaianSistem: Sel; bobot: Sel; komponen: Sel;
  indikator: Sel; pustaka: Sel;
}
export interface BarisKomponen { baris: number; nama: Sel; bobot: Sel }
export interface BarisUjian { baris: number; minggu: Sel; jenis: Sel; bobot: Sel; komponen: Sel }
export interface BarisTugas {
  baris: number;
  nomor: Sel; nama: Sel; jenis: Sel; mingguMulai: Sel; mingguSelesai: Sel; bobot: Sel;
  komponen: Sel; subCpmk: Sel; deskripsi: Sel; uraian: Sel; format: Sel;
}
export interface BarisKriteria {
  baris: number;
  tugas: Sel; nomor: Sel; indikator: Sel; rincian: Sel; bobot: Sel;
}
export interface BarisKisi {
  baris: number;
  jenis: Sel; durasi: Sel; nomor: Sel; subCpmk: Sel; levelBloom: Sel; bentuk: Sel;
  jumlah: Sel; skor: Sel; indikator: Sel;
}
export interface BarisPustaka { baris: number; jenis: Sel; nomor: Sel; teks: Sel; url: Sel }

export interface IsiTemplat {
  /** Cap pada lembar Petunjuk; null bila lembarnya tidak ada atau capnya kosong. */
  cap: { kodeMk: string; rpkpsId: string } | null;
  identitas: {
    deskripsi: Sel; barisDeskripsi: number | null;
    pembuka: Sel; barisPembuka: number | null;
  };
  mingguan: BarisMingguan[];
  komponen: BarisKomponen[];
  ujian: BarisUjian[];
  tugas: BarisTugas[];
  kriteria: BarisKriteria[];
  kisi: BarisKisi[];
  pustaka: BarisPustaka[];
  /** Lembar yang ditemukan di berkas. */
  lembarAda: LembarTemplat[];
  /** Judul kolom yang tidak ditemukan, per lembar. */
  kolomHilang: Partial<Record<LembarTabel, string[]>>;
  /** Lembar yang barisnya melebihi `BATAS_TEMPLAT.barisPerLembar`. */
  lembarBesar: LembarTabel[];
}

export interface KonteksTemplat {
  rpkpsId: string;
  kodeMk: string;
  /** Batas bagi draf — dipakai `periksaDraf`, dan untuk membandingkan kerangka. */
  batas: KonteksDraf;
}

/**
 * Temuan impor. Kode dan parameter, bukan kalimat: kalimatnya ada di kamus
 * (`rpkps.impor.temuan`), kecuali temuan dari `periksaDraf` yang membawa
 * `pesan` Indonesianya sendiri, sama seperti pada draf AI.
 */
export interface TemuanImpor {
  kode: string;
  lembar?: LembarTemplat;
  baris?: number;
  kolom?: string;
  params?: Record<string, string | number>;
  pesan?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Lapis 1 — berkas
// ─────────────────────────────────────────────────────────────────────────

/**
 * Memeriksa berkas SEBELUM dibaca.
 *
 * Nama dan `File.type` datang dari peramban dan dapat dikarang, jadi kesahihan
 * ZIP diputuskan dari empat bita pertama — bukan dari ekstensi.
 */
export function periksaBerkas(b: {
  nama: string;
  ukuran: number;
  kepala: Uint8Array;
}): TemuanImpor | null {
  if (b.ukuran === 0) return { kode: "I-BERKAS-KOSONG" };
  if (b.ukuran > BATAS_TEMPLAT.ukuranBayt) {
    return { kode: "I-BERKAS-BESAR", params: { maks: BATAS_TEMPLAT.ukuranBayt / (1024 * 1024) } };
  }
  if (!b.nama.toLowerCase().endsWith(".xlsx")) return { kode: "I-BERKAS-BUKAN-XLSX" };
  const k = b.kepala;
  if (k.length < 4 || k[0] !== 0x50 || k[1] !== 0x4b || k[2] !== 0x03 || k[3] !== 0x04) {
    return { kode: "I-BERKAS-BUKAN-XLSX" };
  }
  return null;
}

/**
 * Jumlah byte seluruh entri ZIP setelah dibuka, dibaca dari direktori pusat.
 *
 * Berkas 5 MB dapat membuka menjadi gigabita; `exceljs` memuat seluruhnya ke
 * memori. Direktori pusat dapat dibaca tanpa membuka satu entri pun. Null bila
 * struktur ZIP-nya tidak masuk akal — dan itu pun ditolak.
 */
export function ukuranTerurai(zip: Uint8Array): { total: number; entri: number } | null {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const akhir = zip.length - 22;
  const batasCari = Math.max(0, zip.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = akhir; i >= batasCari; i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const jumlah = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  if (jumlah === 0xffff || p === 0xffffffff) return null; // ZIP64: bukan berkas Excel sekecil ini

  let total = 0;
  for (let i = 0; i < jumlah; i++) {
    if (p + 46 > zip.length || v.getUint32(p, true) !== 0x02014b50) return null;
    const ukuran = v.getUint32(p + 24, true);
    if (ukuran === 0xffffffff) return null;
    total += ukuran;
    p += 46 + v.getUint16(p + 28, true) + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  return { total, entri: jumlah };
}

export function periksaIsiZip(zip: Uint8Array): TemuanImpor | null {
  const u = ukuranTerurai(zip);
  if (!u) return { kode: "I-BERKAS-RUSAK" };
  if (u.entri > BATAS_TEMPLAT.entriZip || u.total > BATAS_TEMPLAT.ukuranTerurai) {
    return { kode: "I-BERKAS-MEMBENGKAK" };
  }
  return null;
}

/**
 * Cap pada lembar Petunjuk. Ia mencegah SALAH UNGGAH — berkas mata kuliah lain
 * ditulis ke dokumen yang salah — bukan pemalsuan: berkas yang dikarang tetap
 * harus lolos `periksaDraf`, wewenang, dan cap versi (docs/23 §3.2).
 */
export function periksaCap(cap: IsiTemplat["cap"], k: KonteksTemplat): TemuanImpor[] {
  if (!cap || (cap.kodeMk === "" && cap.rpkpsId === "")) return [{ kode: "I-CAP-HILANG" }];
  if (cap.kodeMk.trim().toLowerCase() !== k.kodeMk.trim().toLowerCase()) {
    return [{ kode: "I-CAP-BEDA-MK", params: { berkas: cap.kodeMk, dokumen: k.kodeMk } }];
  }
  if (cap.rpkpsId.trim() !== k.rpkpsId) return [{ kode: "I-CAP-BEDA-RPKPS" }];
  return [];
}

// ─────────────────────────────────────────────────────────────────────────
// Lapis 2 — sel menjadi nilai
// ─────────────────────────────────────────────────────────────────────────

// Kendali C0, DEL, BOM, dan pengarah bidi (yang dapat memutarbalikkan teks
// tercetak). ZWJ/ZWNJ sengaja dibiarkan: dipakai aksara yang sah.
const KENDALI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFEFF\u202A-\u202E\u2066-\u2069]/g;

/** Menyeragamkan baris baru, membuang karakter kendali, memangkas tepi. */
export function bersihkanSel(nilai: string): string {
  return nilai.replace(/\r\n?/g, "\n").replace(KENDALI, "").trim();
}

export type HasilAngka = { ok: true; nilai: number } | { ok: false; kosong: boolean };

/**
 * Angka gaya Indonesia dan Excel: "12,5", "12.5", "30%". Ribuan tidak dikenal —
 * tidak ada bobot maupun nomor yang berribu, dan "1.500" yang dibaca 1,5
 * sama saja dengan menebak.
 */
export function bacaAngka(mentah: string): HasilAngka {
  const s = bersihkanSel(mentah).replace(/%/g, "").replace(/\s+/g, "");
  if (s === "") return { ok: false, kosong: true };
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return { ok: false, kosong: false };
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? { ok: true, nilai: n } : { ok: false, kosong: false };
}

/** Memecah sel menjadi butir: satu per baris, atau dipisah koma/titik koma. */
export function pecahDaftar(nilai: string, pemisah: RegExp = /\n/): string[] {
  return bersihkanSel(nilai)
    .split(pemisah)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const POLA_KODE_LIST = /[,;\n]/;

function kunciNama(nama: string): string {
  return nama.replace(/\s+/g, " ").trim().toLowerCase();
}

function urlSah(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const SAH_PUSTAKA: ReadonlySet<string> = new Set(JENIS_PUSTAKA);

function judulKolom(lembar: LembarTabel, kunci: string): string {
  const s = SKEMA_TEMPLAT[lembar];
  const i = (s.kunci as readonly string[]).indexOf(kunci);
  return i >= 0 ? s.judul[i] : kunci;
}

export interface HasilTemplat {
  /** Null bila berkasnya sendiri tidak dapat dibaca (cap, lembar, atau kolom). */
  draf: DrafRpkps | null;
  temuan: TemuanImpor[];
}

/**
 * Merakit `DrafRpkps` dari sel-sel berkas, lalu memeriksanya dengan
 * `periksaDraf`. Temuan lapis 2 (bentuk sel) mendahului temuan lapis 3
 * (aturan dokumen) pada urutan hasil.
 */
export function rakitTemplat(isi: IsiTemplat, konteks: KonteksTemplat): HasilTemplat {
  // ── Lapis 1 lanjutan: struktur berkas. Bila gagal, tidak ada gunanya lanjut —
  // sel yang dibaca dari lembar/kolom yang salah hanya melahirkan temuan palsu.
  const struktur: TemuanImpor[] = [];
  struktur.push(...periksaCap(isi.cap, konteks));
  for (const l of LEMBAR_WAJIB) {
    if (!isi.lembarAda.includes(l)) {
      struktur.push({ kode: "I-LEMBAR-HILANG", lembar: l, params: { lembar: LEMBAR_TEMPLAT[l] } });
    }
  }
  for (const [lembar, daftar] of Object.entries(isi.kolomHilang) as [LembarTabel, string[]][]) {
    for (const kolom of daftar) {
      struktur.push({
        kode: "I-KOLOM-HILANG",
        lembar,
        params: { lembar: LEMBAR_TEMPLAT[lembar], kolom },
      });
    }
  }
  for (const lembar of isi.lembarBesar) {
    struktur.push({
      kode: "I-BARIS-BANYAK",
      lembar,
      params: { lembar: LEMBAR_TEMPLAT[lembar], maks: BATAS_TEMPLAT.barisPerLembar },
    });
  }
  if (struktur.length > 0) return { draf: null, temuan: struktur };

  const temuan: TemuanImpor[] = [];
  const di = (lembar: LembarTabel, baris: number, kunci: string) => ({
    lembar,
    baris,
    kolom: judulKolom(lembar, kunci),
  });

  // ── Pembantu sel ──────────────────────────────────────────────────────
  function teks(
    mentah: string, maks: number, lembar: LembarTabel, baris: number, kunci: string, wajib = false,
  ): string {
    const s = bersihkanSel(mentah);
    if (s === "") {
      if (wajib) temuan.push({ kode: "I-WAJIB-ISI", ...di(lembar, baris, kunci) });
      return "";
    }
    if (s.length > maks) {
      temuan.push({
        kode: "I-TERLALU-PANJANG",
        ...di(lembar, baris, kunci),
        params: { maks, panjang: s.length },
      });
    }
    return s;
  }
  const atauNull = (s: string) => (s === "" ? null : s);

  function daftar(
    mentah: string, maksButir: number, maksJumlah: number,
    lembar: LembarTabel, baris: number, kunci: string,
  ): string[] {
    const butir = pecahDaftar(mentah);
    if (butir.length > maksJumlah) {
      temuan.push({
        kode: "I-TERLALU-BANYAK",
        ...di(lembar, baris, kunci),
        params: { maks: maksJumlah, jumlah: butir.length },
      });
    }
    for (const b of butir) {
      if (b.length > maksButir) {
        temuan.push({
          kode: "I-TERLALU-PANJANG",
          ...di(lembar, baris, kunci),
          params: { maks: maksButir, panjang: b.length },
        });
        break;
      }
    }
    return butir;
  }

  function angka(
    mentah: string, lembar: LembarTabel, baris: number, kunci: string,
    opsi: { wajib: boolean; bulat?: boolean; maks?: number },
  ): number {
    const h = bacaAngka(mentah);
    if (!h.ok) {
      if (h.kosong) {
        if (opsi.wajib) temuan.push({ kode: "I-ANGKA-KOSONG", ...di(lembar, baris, kunci) });
      } else {
        temuan.push({
          kode: "I-ANGKA-TIDAK-SAH",
          ...di(lembar, baris, kunci),
          params: { nilai: bersihkanSel(mentah).slice(0, 40) },
        });
      }
      return 0;
    }
    const batas = opsi.maks ?? 1_000_000;
    if (h.nilai < 0 || h.nilai > batas) {
      temuan.push({
        kode: "I-ANGKA-TIDAK-SAH",
        ...di(lembar, baris, kunci),
        params: { nilai: String(h.nilai), maks: batas },
      });
      return 0;
    }
    if (opsi.bulat && !Number.isInteger(h.nilai)) {
      temuan.push({
        kode: "I-BUKAN-BULAT",
        ...di(lembar, baris, kunci),
        params: { nilai: String(h.nilai) },
      });
      return 0;
    }
    return h.nilai;
  }

  // ── Komponen nilai lebih dulu: baris lain menunjuknya lewat nama ──────
  const komponenNilai = isi.komponen.map((r) => ({
    nama: teks(r.nama, BATAS_TEMPLAT.nama, "komponen", r.baris, "nama", true),
    bobot: angka(r.bobot, "komponen", r.baris, "bobot", { wajib: true, maks: 100 }),
  }));
  // Nama pada baris lain dipadankan tanpa peduli besar-kecil huruf dan spasi
  // ganda, lalu disamakan dengan penulisan di daftar komponen. Ini soal
  // penamaan, bukan angka: T2 tidak dilanggar. Nama yang tetap tidak dikenal
  // dibiarkan apa adanya supaya `periksaDraf` melaporkannya.
  const kanon = new Map<string, string>();
  for (const k of komponenNilai) if (k.nama && !kanon.has(kunciNama(k.nama))) kanon.set(kunciNama(k.nama), k.nama);
  const namaKomponen = (mentah: string): string | null => {
    const s = bersihkanSel(mentah);
    return s === "" ? null : (kanon.get(kunciNama(s)) ?? s);
  };

  // ── Pustaka baru ──────────────────────────────────────────────────────
  const ada = new Set(konteks.batas.refPustaka);
  const terpakai: Record<string, number> = {};
  for (const ref of konteks.batas.refPustaka) {
    const m = /^([A-Z]+)-(\d+)$/.exec(ref);
    if (m) terpakai[m[1]] = Math.max(terpakai[m[1]] ?? 0, Number(m[2]));
  }
  const pustakaBaru: DrafPustaka[] = [];
  const tanpaNomor: { r: BarisPustaka; jenis: JenisPustaka }[] = [];
  for (const r of isi.pustaka) {
    const jenis = bersihkanSel(r.jenis).toUpperCase();
    if (!SAH_PUSTAKA.has(jenis)) {
      temuan.push({
        kode: "I-ENUM-TIDAK-SAH",
        ...di("pustaka", r.baris, "jenis"),
        params: { nilai: jenis.slice(0, 30), pilihan: JENIS_PUSTAKA.join(", ") },
      });
      continue;
    }
    const nomorMentah = bacaAngka(r.nomor);
    if (!nomorMentah.ok && nomorMentah.kosong) {
      tanpaNomor.push({ r, jenis: jenis as JenisPustaka });
      continue;
    }
    const nomor = angka(r.nomor, "pustaka", r.baris, "nomor", { wajib: true, bulat: true, maks: 9999 });
    // Baris yang sudah ada di dokumen ikut terunduh sebagai rujukan. Ia
    // dipertahankan apa adanya dan TIDAK ditimpa dari berkas.
    if (ada.has(`${jenis}-${nomor}`)) continue;
    terpakai[jenis] = Math.max(terpakai[jenis] ?? 0, nomor);
    pustakaBaru.push(buatPustaka(r, jenis as JenisPustaka, nomor));
  }
  // Baris tanpa nomor mendapat nomor berikutnya — dihitung di sini, bukan oleh
  // dosen, karena Pustaka unik per (jenis, nomor). Ia tidak dapat dirujuk dari
  // tabel mingguan lewat nomor yang belum ada saat mengetik; dosen yang ingin
  // merujuknya menuliskan nomornya.
  for (const { r, jenis } of tanpaNomor) {
    const nomor = (terpakai[jenis] ?? 0) + 1;
    terpakai[jenis] = nomor;
    pustakaBaru.push(buatPustaka(r, jenis, nomor));
  }
  function buatPustaka(r: BarisPustaka, jenis: JenisPustaka, nomor: number): DrafPustaka {
    const url = teks(r.url, BATAS_TEMPLAT.url, "pustaka", r.baris, "url");
    if (url !== "" && !urlSah(url)) {
      temuan.push({ kode: "I-URL-TIDAK-SAH", ...di("pustaka", r.baris, "url") });
    }
    return {
      jenis,
      nomor,
      teks: teks(r.teks, BATAS_TEMPLAT.pustakaTeks, "pustaka", r.baris, "teks", true),
      url: atauNull(url),
    };
  }

  // ── Pertemuan ─────────────────────────────────────────────────────────
  const pertemuan: DrafPertemuan[] = isi.mingguan.map((r) => {
    const minggu = angka(r.minggu, "mingguan", r.baris, "minggu", { wajib: true, bulat: true, maks: 200 });

    // Sub-CPMK terjadwal adalah kolom terkunci. Berkas yang tidak sama dengan
    // kerangka saat ini berasal dari versi dokumen yang sudah bergeser
    // (revisi kurikulum, pemetaan diubah) — mengunggahnya berarti menulis
    // isi untuk jadwal yang tidak lagi berlaku.
    const harapan = konteks.batas.subCpmkPerMinggu[minggu];
    if (harapan) {
      const dalamBerkas = pecahDaftar(r.subCpmk, POLA_KODE_LIST);
      const sama =
        dalamBerkas.length === harapan.length && harapan.every((h) => dalamBerkas.includes(h));
      if (!sama) {
        temuan.push({
          kode: "I-KERANGKA-BEDA",
          ...di("mingguan", r.baris, "subCpmk"),
          params: { minggu, harapan: harapan.join(", ") || "—", isi: dalamBerkas.join(", ") || "—" },
        });
      }
    }

    return {
      minggu,
      topik: teks(r.topik, BATAS_TEMPLAT.topik, "mingguan", r.baris, "topik"),
      subtopik: daftar(r.subtopik, BATAS_TEMPLAT.subtopik, BATAS_TEMPLAT.subtopikJumlah, "mingguan", r.baris, "subtopik"),
      metodeNarasi: teks(r.metode, BATAS_TEMPLAT.narasi, "mingguan", r.baris, "metode"),
      aktivitasDosen: teks(r.aktivitasDosen, BATAS_TEMPLAT.narasi, "mingguan", r.baris, "aktivitasDosen"),
      aktivitasMahasiswa: teks(r.aktivitasMahasiswa, BATAS_TEMPLAT.narasi, "mingguan", r.baris, "aktivitasMahasiswa"),
      tugasTerstruktur: atauNull(teks(r.tugasTerstruktur, BATAS_TEMPLAT.narasi, "mingguan", r.baris, "tugasTerstruktur")),
      penilaianJenis: atauNull(teks(r.penilaianJenis, BATAS_TEMPLAT.teksPendek, "mingguan", r.baris, "penilaianJenis")),
      penilaianSistem: atauNull(teks(r.penilaianSistem, BATAS_TEMPLAT.narasi, "mingguan", r.baris, "penilaianSistem")),
      bobot: angka(r.bobot, "mingguan", r.baris, "bobot", { wajib: false, maks: 100 }),
      komponenNilai: namaKomponen(r.komponen),
      indikator: daftar(r.indikator, BATAS_TEMPLAT.indikator, BATAS_TEMPLAT.indikatorJumlah, "mingguan", r.baris, "indikator"),
      pustakaRef: pecahDaftar(r.pustaka, POLA_KODE_LIST).map((s) => s.toUpperCase()),
    };
  });

  // ── Ujian ─────────────────────────────────────────────────────────────
  const ujian: DrafUjian[] = [];
  for (const r of isi.ujian) {
    const jenis = bersihkanSel(r.jenis).toUpperCase();
    if (jenis !== "UTS" && jenis !== "UAS") {
      temuan.push({
        kode: "I-ENUM-TIDAK-SAH",
        ...di("ujian", r.baris, "jenis"),
        params: { nilai: jenis.slice(0, 30), pilihan: "UTS, UAS" },
      });
      continue;
    }
    ujian.push({
      minggu: angka(r.minggu, "ujian", r.baris, "minggu", { wajib: true, bulat: true, maks: 200 }),
      jenis,
      bobot: angka(r.bobot, "ujian", r.baris, "bobot", { wajib: false, maks: 100 }),
      komponenNilai: namaKomponen(r.komponen),
    });
  }

  // ── Tugas dan kriterianya ─────────────────────────────────────────────
  const nomorTugasAda = new Set<number>();
  const tugas: DrafTugas[] = isi.tugas.map((r) => {
    const nomor = angka(r.nomor, "tugas", r.baris, "nomor", { wajib: true, bulat: true, maks: 999 });
    nomorTugasAda.add(nomor);
    return {
      nomor,
      nama: teks(r.nama, BATAS_TEMPLAT.nama, "tugas", r.baris, "nama", true),
      // Enum tak dikenal dibiarkan lewat: `periksaDraf` melaporkannya
      // (D-TUGAS-JENIS-ASING), dan draf dengan temuan tidak pernah ditulis.
      jenis: bersihkanSel(r.jenis).toUpperCase() as JenisTugas,
      mingguMulai: angka(r.mingguMulai, "tugas", r.baris, "mingguMulai", { wajib: true, bulat: true, maks: 200 }),
      mingguSelesai: angka(r.mingguSelesai, "tugas", r.baris, "mingguSelesai", { wajib: true, bulat: true, maks: 200 }),
      bobot: angka(r.bobot, "tugas", r.baris, "bobot", { wajib: false, maks: 100 }),
      komponenNilai: namaKomponen(r.komponen),
      deskripsi: teks(r.deskripsi, BATAS_TEMPLAT.narasi, "tugas", r.baris, "deskripsi", true),
      uraianTugas: atauNull(teks(r.uraian, BATAS_TEMPLAT.narasi, "tugas", r.baris, "uraian")),
      formatLuaran: atauNull(teks(r.format, BATAS_TEMPLAT.narasi, "tugas", r.baris, "format")),
      subCpmkKode: pecahDaftar(r.subCpmk, POLA_KODE_LIST),
      kriteria: [] as DrafKriteria[],
    };
  });
  for (const r of isi.kriteria) {
    const nomorTugas = angka(r.tugas, "kriteria", r.baris, "tugas", { wajib: true, bulat: true, maks: 999 });
    const induk = tugas.find((t) => t.nomor === nomorTugas);
    const kriteria: DrafKriteria = {
      nomor: angka(r.nomor, "kriteria", r.baris, "nomor", { wajib: true, bulat: true, maks: 999 }),
      indikator: teks(r.indikator, BATAS_TEMPLAT.indikator, "kriteria", r.baris, "indikator", true),
      rincian: daftar(r.rincian, BATAS_TEMPLAT.rincian, BATAS_TEMPLAT.rincianJumlah, "kriteria", r.baris, "rincian"),
      bobot: angka(r.bobot, "kriteria", r.baris, "bobot", { wajib: true, maks: 100 }),
    };
    if (!induk) {
      temuan.push({
        kode: "I-KRITERIA-TANPA-TUGAS",
        ...di("kriteria", r.baris, "tugas"),
        params: { nomor: nomorTugas },
      });
      continue;
    }
    induk.kriteria.push(kriteria);
  }

  // ── Kisi-kisi ─────────────────────────────────────────────────────────
  const kisiPerJenis = new Map<"UTS" | "UAS", DrafKisiKisi>();
  const durasiDi = new Map<"UTS" | "UAS", number>();
  for (const r of isi.kisi) {
    const jenis = bersihkanSel(r.jenis).toUpperCase();
    if (jenis !== "UTS" && jenis !== "UAS") {
      temuan.push({
        kode: "I-ENUM-TIDAK-SAH",
        ...di("kisi", r.baris, "jenis"),
        params: { nilai: jenis.slice(0, 30), pilihan: "UTS, UAS" },
      });
      continue;
    }
    let kisi = kisiPerJenis.get(jenis);
    if (!kisi) {
      kisi = { jenis, durasiMenit: null, butir: [] };
      kisiPerJenis.set(jenis, kisi);
    }
    // Durasi milik satu kisi-kisi, tetapi ditulis per baris supaya tabelnya
    // rata. Nilai yang berbeda antar baris tidak dapat dipilihkan server.
    const d = bacaAngka(r.durasi);
    if (d.ok) {
      if (!Number.isInteger(d.nilai) || d.nilai < 1 || d.nilai > 1000) {
        temuan.push({
          kode: "I-ANGKA-TIDAK-SAH",
          ...di("kisi", r.baris, "durasi"),
          params: { nilai: String(d.nilai), maks: 1000 },
        });
      } else if (kisi.durasiMenit === null) {
        kisi.durasiMenit = d.nilai;
        durasiDi.set(jenis, r.baris);
      } else if (kisi.durasiMenit !== d.nilai) {
        temuan.push({
          kode: "I-DURASI-BEDA",
          ...di("kisi", r.baris, "durasi"),
          params: { jenis, baris: durasiDi.get(jenis) ?? 0 },
        });
      }
    } else if (!d.kosong) {
      temuan.push({
        kode: "I-ANGKA-TIDAK-SAH",
        ...di("kisi", r.baris, "durasi"),
        params: { nilai: bersihkanSel(r.durasi).slice(0, 40) },
      });
    }

    const butir: DrafButirUjian = {
      nomor: angka(r.nomor, "kisi", r.baris, "nomor", { wajib: true, bulat: true, maks: 999 }),
      subCpmkKode: bersihkanSel(r.subCpmk),
      // Level dan bentuk tak dikenal dibiarkan lewat untuk dilaporkan
      // `periksaDraf` (D-BUTIR-LEVEL-ASING / D-BUTIR-BENTUK-ASING).
      levelBloom: bersihkanSel(r.levelBloom).toUpperCase() as DrafButirUjian["levelBloom"],
      bentuk: bersihkanSel(r.bentuk).toUpperCase().replace(/[\s-]+/g, "_") as BentukSoal,
      jumlahButir: angka(r.jumlah, "kisi", r.baris, "jumlah", { wajib: true, bulat: true, maks: 999 }),
      skor: angka(r.skor, "kisi", r.baris, "skor", { wajib: true, maks: 100 }),
      indikator: atauNull(teks(r.indikator, BATAS_TEMPLAT.indikator, "kisi", r.baris, "indikator")),
    };
    if (butir.subCpmkKode === "") {
      temuan.push({ kode: "I-WAJIB-ISI", ...di("kisi", r.baris, "subCpmk") });
    }
    kisi.butir.push(butir);
  }

  // Identitas bukan lembar bertabel: panjangnya diperiksa dengan lokasi lembar
  // Identitas, bukan lewat `teks()` yang menunjuk kolom sebuah tabel.
  const deskripsi = bersihkanSel(isi.identitas.deskripsi);
  const pembuka = bersihkanSel(isi.identitas.pembuka);
  for (const [nilai, kunci, baris, maks] of [
    [deskripsi, "deskripsi", isi.identitas.barisDeskripsi, BATAS_TEMPLAT.deskripsi],
    [pembuka, "pembuka", isi.identitas.barisPembuka, BATAS_TEMPLAT.narasi],
  ] as const) {
    if (nilai.length > maks) {
      temuan.push({
        kode: "I-TERLALU-PANJANG",
        lembar: "identitas",
        baris: baris ?? undefined,
        kolom: LABEL_IDENTITAS[kunci],
        params: { maks, panjang: nilai.length },
      });
    }
  }

  const draf: DrafRpkps = {
    deskripsi,
    kalimatPembukaCpmk: pembuka,
    komponenNilai,
    pustakaBaru,
    pertemuan,
    ujian,
    tugas,
    kisiKisi: [...kisiPerJenis.values()],
  };

  // ── Lapis 3 — aturan dokumen: periksaDraf yang sama dengan draf AI ────
  for (const t of periksaDraf(konteks.batas, draf)) {
    temuan.push({ kode: t.kode, pesan: t.pesan, ...petakanLokasi(t.lokasi, isi) });
  }

  return { draf, temuan };
}

/**
 * Lokasi `periksaDraf` ("minggu 3", "tugas 2", "kisi-kisi UTS") menjadi
 * lembar dan baris Excel, supaya dosen dapat langsung menuju selnya.
 * Temuan tanpa lokasi (mis. total bobot) dibiarkan tanpa lokasi.
 */
function petakanLokasi(
  lokasi: string | undefined,
  isi: IsiTemplat,
): Pick<TemuanImpor, "lembar" | "baris"> {
  if (!lokasi) return {};
  const m = /^(minggu|tugas) (\d+)$/.exec(lokasi);
  if (m) {
    const n = Number(m[2]);
    const cocok = (sel: string) => {
      const h = bacaAngka(sel);
      return h.ok && h.nilai === n;
    };
    if (m[1] === "minggu") {
      const r = isi.mingguan.find((b) => cocok(b.minggu));
      if (r) return { lembar: "mingguan", baris: r.baris };
      const u = isi.ujian.find((b) => cocok(b.minggu));
      return u ? { lembar: "ujian", baris: u.baris } : {};
    }
    const t = isi.tugas.find((b) => cocok(b.nomor));
    return t ? { lembar: "tugas", baris: t.baris } : {};
  }
  const k = /^kisi-kisi (UTS|UAS)$/.exec(lokasi);
  if (k) {
    const r = isi.kisi.find((b) => bersihkanSel(b.jenis).toUpperCase() === k[1]);
    return r ? { lembar: "kisi", baris: r.baris } : {};
  }
  return {};
}
