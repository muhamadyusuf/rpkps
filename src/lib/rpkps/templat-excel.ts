import ExcelJS from "exceljs";
import type { Bahasa } from "@/kamus";
import { LEVEL_BLOOM } from "@/domain/kurikulum/bloom";
import { BENTUK_SOAL, JENIS_PUSTAKA, JENIS_TUGAS } from "@/domain/rpkps/draf";
import {
  BATAS_TEMPLAT,
  LABEL_CAP,
  LABEL_IDENTITAS,
  LEMBAR_TEMPLAT,
  SKEMA_TEMPLAT,
  normalisasiJudul,
  type BarisKisi,
  type BarisKomponen,
  type BarisKriteria,
  type BarisMingguan,
  type BarisPustaka,
  type BarisTugas,
  type BarisUjian,
  type IsiTemplat,
  type LembarTabel,
  type LembarTemplat,
} from "@/domain/rpkps/templat";

/**
 * Pembacaan dan pembuatan berkas template isi RPKPS (docs/23).
 *
 * Sengaja TANPA `import "server-only"`: modul ini tidak memegang rahasia apa
 * pun dan harus dapat diuji dengan pulang-pergi (ekspor lalu impor). Ia hanya
 * diimpor dari aksi dan rute server.
 *
 * Yang dikerjakan di sini hanya pertukaran sel ↔ string. Aturan tentang ISI
 * sel ada di `domain/rpkps/templat.ts`.
 */

/**
 * Bentuk minimal RPKPS yang dibutuhkan penulis. Ditulis terstruktur, bukan
 * `RpkpsLengkap`, supaya uji dapat menyusunnya tanpa Prisma; `RpkpsLengkap`
 * memenuhinya apa adanya (`Decimal` cukup memiliki `toString`).
 */
type Angka = number | { toString(): string };

export interface SumberTemplat {
  id: string;
  deskripsi: string | null;
  kalimatPembukaCpmk: string | null;
  tahunAkademik: { kode: string };
  mataKuliah: {
    kode: string;
    nama: string;
    deskripsi: string | null;
    cpmk: { subCpmk: { kode: string; rumusan: string }[] }[];
  };
  komponenNilai: { id: string; nama: string; bobot: Angka }[];
  pustaka: { jenis: string; nomor: number; teks: string; url: string | null }[];
  pertemuan: {
    minggu: number;
    jenis: "EFEKTIF" | "UTS" | "UAS";
    topik: string | null;
    subtopik: string[];
    metodeNarasi: string | null;
    aktivitasDosen: string | null;
    aktivitasMahasiswa: string | null;
    tugasTerstruktur: string | null;
    penilaianJenis: string | null;
    penilaianSistem: string | null;
    bobot: Angka;
    komponenNilaiId: string | null;
    subCpmk: { subCpmk: { kode: string } }[];
    indikator: { teks: string }[];
    pustaka: { pustaka: { jenis: string; nomor: number } }[];
  }[];
  tugas: {
    nomor: number;
    nama: string;
    jenis: string;
    mingguMulai: number;
    mingguSelesai: number;
    bobot: Angka;
    deskripsi: string;
    uraianTugas: string | null;
    formatLuaran: string | null;
    komponenNilai: { nama: string } | null;
    subCpmk: { subCpmk: { kode: string } }[];
    kriteria: { nomor: number; indikator: string; rincian: string[]; bobot: Angka }[];
  }[];
  kisiKisi: {
    jenis: string;
    durasiMenit: number | null;
    butir: {
      nomor: number;
      levelBloom: string;
      bentuk: string;
      jumlahButir: number;
      skor: Angka;
      indikator: string | null;
      subCpmk: { kode: string };
    }[];
  }[];
}

// ─────────────────────────────────────────────────────────────────────────
// Membaca
// ─────────────────────────────────────────────────────────────────────────

function teks(sel: ExcelJS.Cell): string {
  const nilai = sel.value;
  if (nilai === null || nilai === undefined) return "";
  if (typeof nilai === "number") {
    // Sel berformat persen menyimpan 0,3 untuk "30%". Tanpa ini bobot 30%
    // terbaca 0,3 — dan lolos sebagai angka yang sah.
    const persen = typeof sel.numFmt === "string" && sel.numFmt.includes("%");
    return String(persen ? Math.round(nilai * 100 * 1e6) / 1e6 : nilai);
  }
  if (typeof nilai === "boolean") return nilai ? "TRUE" : "FALSE";
  if (nilai instanceof Date) return nilai.toISOString();
  if (typeof nilai === "object") {
    if ("richText" in nilai && Array.isArray(nilai.richText)) {
      return nilai.richText.map((r) => r.text).join("");
    }
    // Rumus dibaca HASILNYA, bukan rumusnya: yang dibaca adalah yang tampak di
    // layar dosen, dan kita tidak pernah mengevaluasi ekspresi dari berkas.
    if ("result" in nilai) {
      const h = nilai.result;
      if (h === null || h === undefined) return "";
      if (typeof h === "object") return "";
      return String(h);
    }
    if ("text" in nilai && typeof nilai.text === "string") return nilai.text;
    if ("error" in nilai) return "";
  }
  return String(nilai);
}

/** Pemindaian dibatasi: baris berformat kosong sampai jutaan tidak boleh menahan server. */
const BATAS_PINDAI = 5000;

function kosongSemua(v: string[]): boolean {
  return v.every((s) => s.trim() === "");
}

function bacaTabel<T extends { baris: number }>(
  wb: ExcelJS.Workbook,
  lembar: LembarTabel,
  hasil: {
    kolomHilang: Partial<Record<LembarTabel, string[]>>;
    lembarBesar: LembarTabel[];
    lembarAda: LembarTemplat[];
  },
): T[] {
  const ws = wb.getWorksheet(LEMBAR_TEMPLAT[lembar]);
  if (!ws) return [];
  hasil.lembarAda.push(lembar);

  const { kunci, judul } = SKEMA_TEMPLAT[lembar];
  const posisi = new Map<string, number>();
  ws.getRow(1).eachCell((sel, kolom) => {
    const t = normalisasiJudul(teks(sel));
    if (t && !posisi.has(t)) posisi.set(t, kolom);
  });

  // Kolom dicari lewat teks judulnya, tetapi TIDAK ada pembacaan cadangan
  // berdasarkan posisi seperti impor kurikulum: berkas ini dibuat dari
  // dokumen yang bersangkutan, dan judul yang hilang berarti isinya tidak
  // dapat dipercaya — bukan sekadar berkas lama.
  const kolom = judul.map((j) => posisi.get(normalisasiJudul(j)) ?? null);
  const hilang = judul.filter((_, i) => kolom[i] === null);
  if (hilang.length > 0) {
    hasil.kolomHilang[lembar] = hilang;
    return [];
  }

  const baris: T[] = [];
  const akhir = Math.min(ws.rowCount, BATAS_PINDAI);
  for (let r = 2; r <= akhir; r++) {
    const row = ws.getRow(r);
    const nilai = kunci.map((_, i) => teks(row.getCell(kolom[i] as number)));
    if (kosongSemua(nilai)) continue;
    if (baris.length >= BATAS_TEMPLAT.barisPerLembar) {
      hasil.lembarBesar.push(lembar);
      break;
    }
    const obj: Record<string, string | number> = { baris: r };
    kunci.forEach((k, i) => (obj[k] = nilai[i]));
    baris.push(obj as unknown as T);
  }
  return baris;
}

/** Cap dan identitas dibaca dari pasangan label (kolom A) dan isi (kolom B). */
function bacaPasangan(ws: ExcelJS.Worksheet | undefined, batas = 60): Map<string, { isi: string; baris: number }> {
  const peta = new Map<string, { isi: string; baris: number }>();
  if (!ws) return peta;
  const akhir = Math.min(ws.rowCount, batas);
  for (let r = 1; r <= akhir; r++) {
    const row = ws.getRow(r);
    const label = teks(row.getCell(1)).trim().toLowerCase();
    if (label && !peta.has(label)) peta.set(label, { isi: teks(row.getCell(2)), baris: r });
  }
  return peta;
}

/**
 * Membaca berkas menjadi sel-sel mentah. Melempar bila bukan XLSX yang dapat
 * dibuka; pemanggil menerjemahkannya menjadi `I-BERKAS-RUSAK`.
 */
export async function bacaTemplat(buffer: ArrayBuffer): Promise<IsiTemplat> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const lembarAda: LembarTemplat[] = [];
  const kolomHilang: Partial<Record<LembarTabel, string[]>> = {};
  const lembarBesar: LembarTabel[] = [];
  const bagi = { kolomHilang, lembarBesar, lembarAda };

  const petunjuk = wb.getWorksheet(LEMBAR_TEMPLAT.petunjuk);
  if (petunjuk) lembarAda.push("petunjuk");
  const cap = bacaPasangan(petunjuk);
  const kodeMk = cap.get(LABEL_CAP.kodeMk.toLowerCase())?.isi ?? "";
  const rpkpsId = cap.get(LABEL_CAP.rpkpsId.toLowerCase())?.isi ?? "";

  const identitasWs = wb.getWorksheet(LEMBAR_TEMPLAT.identitas);
  if (identitasWs) lembarAda.push("identitas");
  const ident = bacaPasangan(identitasWs);
  const deskripsi = ident.get(LABEL_IDENTITAS.deskripsi.toLowerCase());
  const pembuka = ident.get(LABEL_IDENTITAS.pembuka.toLowerCase());

  return {
    cap: petunjuk ? { kodeMk, rpkpsId } : null,
    identitas: {
      deskripsi: deskripsi?.isi ?? "",
      barisDeskripsi: deskripsi?.baris ?? null,
      pembuka: pembuka?.isi ?? "",
      barisPembuka: pembuka?.baris ?? null,
    },
    mingguan: bacaTabel<BarisMingguan>(wb, "mingguan", bagi),
    komponen: bacaTabel<BarisKomponen>(wb, "komponen", bagi),
    ujian: bacaTabel<BarisUjian>(wb, "ujian", bagi),
    tugas: bacaTabel<BarisTugas>(wb, "tugas", bagi),
    kriteria: bacaTabel<BarisKriteria>(wb, "kriteria", bagi),
    kisi: bacaTabel<BarisKisi>(wb, "kisi", bagi),
    pustaka: bacaTabel<BarisPustaka>(wb, "pustaka", bagi),
    lembarAda,
    kolomHilang,
    lembarBesar,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Menulis
// ─────────────────────────────────────────────────────────────────────────

const PETUNJUK: Record<Bahasa, string[]> = {
  id: [
    "Berkas ini dibuat dari RPKPS di atas. Lengkapi, simpan, lalu unggah kembali pada halaman RPKPS.",
    "Isi yang sudah ada di dokumen ikut terunduh. Saat diterapkan, isi berkas MENGGANTIKAN isi dokumen.",
    "Kolom berlatar abu-abu (Minggu, Jenis, Sub-CPMK Terjadwal) berasal dari kurikulum dan tidak dapat diubah lewat berkas; nilai yang berbeda ditolak.",
    "Jangan mengubah judul kolom, nama lembar, maupun cap di atas. Baris bebas ditambah atau dikurangi, kecuali baris minggu pada lembar Mingguan dan Ujian.",
    "Bobot ditulis apa adanya: total bobot mingguan dan ujian harus 100, dan jumlah baris tiap komponen harus sama dengan bobot komponennya. Angka Anda tidak akan diubah otomatis.",
    "Kolom bertanda 'satu per baris sel' diisi dengan menekan Alt+Enter (Windows) atau Option+Enter (Mac) di antara butir.",
    "Lembar Pustaka: baris berlatar abu-abu sudah ada di dokumen dan tidak ditimpa. Baris baru boleh dikosongkan nomornya; nomor diberikan otomatis.",
    "Lembar Rujukan hanya daftar pilihan dan tidak dibaca saat diunggah.",
  ],
  en: [
    "This file was generated from the RPKPS above. Complete it, save it, and upload it back on the RPKPS page.",
    "Content already in the document is included. When applied, the file's content REPLACES the document's content.",
    "Grey columns (Week, Type, Scheduled Sub-CPMK) come from the curriculum and cannot be changed through the file; differing values are rejected.",
    "Do not change column titles, sheet names, or the stamp above. Rows may be added or removed freely, except the week rows on the Mingguan and Ujian sheets.",
    "Weights are used exactly as written: total weekly and exam weight must be 100, and each component's rows must sum to its own weight. Your numbers are never adjusted automatically.",
    "Columns marked 'one per cell line' take one item per line: press Alt+Enter (Windows) or Option+Enter (Mac) between items.",
    "Pustaka sheet: grey rows already exist in the document and are not overwritten. New rows may leave the number blank; it is assigned automatically.",
    "The Rujukan sheet is a list of choices only and is not read on upload.",
  ],
};

const ABU = "FFE5E7EB";
const GELAP = "FF1F2937";

function siapkanLembar(
  wb: ExcelJS.Workbook,
  lembar: LembarTabel,
  lebar: number[],
  baris: (string | number | null)[][],
  terkunci: number[] = [],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(LEMBAR_TEMPLAT[lembar]);
  const { judul } = SKEMA_TEMPLAT[lembar];
  ws.addRow([...judul]);
  const kepala = ws.getRow(1);
  kepala.font = { bold: true, color: { argb: "FFFFFFFF" } };
  kepala.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GELAP } };
  kepala.alignment = { vertical: "middle", wrapText: true };
  kepala.height = 30;
  judul.forEach((_, i) => (ws.getColumn(i + 1).width = lebar[i] ?? 20));
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const b of baris) ws.addRow(b);
  ws.eachRow((row, nomor) => {
    if (nomor === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    for (const k of terkunci) {
      row.getCell(k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
    }
  });
  for (const k of terkunci) {
    ws.getRow(1).getCell(k).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6B7280" } };
  }
  return ws;
}

/** Daftar pilihan pada kolom, untuk baris yang ada dan 100 baris cadangan. */
function pilihan(ws: ExcelJS.Worksheet, kolom: number, nilai: readonly string[], barisTerisi: number) {
  const rumus = `"${nilai.join(",")}"`;
  if (rumus.length > 255) return; // batas Excel untuk daftar sebaris
  const akhir = Math.max(barisTerisi, 1) + 101;
  for (let r = 2; r <= akhir; r++) {
    ws.getCell(r, kolom).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [rumus],
      showErrorMessage: false,
    };
  }
}

const num = (a: Angka): number => Number(a.toString());

/**
 * Membuat template terisi dari RPKPS. Kolom terkunci sudah benar; isi yang ada
 * ikut terunduh, jadi alurnya unduh → lengkapi → unggah, bukan mulai dari nol.
 */
export async function buatTemplat(sumber: SumberTemplat, bahasa: Bahasa = "id"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RPKPS ITTS";

  const namaKomponen = new Map(sumber.komponenNilai.map((k) => [k.id, k.nama]));

  // ── Petunjuk (dengan cap) ──
  const pet = wb.addWorksheet(LEMBAR_TEMPLAT.petunjuk);
  pet.getColumn(1).width = 26;
  pet.getColumn(2).width = 100;
  const capBaris: [string, string][] = [
    [LABEL_CAP.kodeMk, sumber.mataKuliah.kode],
    [LABEL_CAP.rpkpsId, sumber.id],
    [LABEL_CAP.tahunAkademik, sumber.tahunAkademik.kode],
    ["Mata Kuliah", sumber.mataKuliah.nama],
  ];
  for (const [label, isi] of capBaris) {
    const r = pet.addRow([label, isi]);
    r.getCell(1).font = { bold: true };
  }
  pet.addRow([]);
  for (const kalimat of PETUNJUK[bahasa]) {
    const r = pet.addRow(["", kalimat]);
    r.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  // ── Identitas ──
  const ident = wb.addWorksheet(LEMBAR_TEMPLAT.identitas);
  ident.getColumn(1).width = 28;
  ident.getColumn(2).width = 110;
  ident.addRow(["Bidang", "Isi"]);
  ident.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ident.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: GELAP } };
  ident.addRow([
    LABEL_IDENTITAS.deskripsi,
    sumber.deskripsi ?? sumber.mataKuliah.deskripsi ?? "",
  ]);
  ident.addRow([LABEL_IDENTITAS.pembuka, sumber.kalimatPembukaCpmk ?? ""]);
  ident.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
    row.getCell(1).font = { bold: true, color: row.number === 1 ? { argb: "FFFFFFFF" } : undefined };
  });

  // ── Mingguan: hanya pertemuan efektif; baris ujian ada di lembar Ujian ──
  const efektif = sumber.pertemuan.filter((p) => p.jenis === "EFEKTIF");
  siapkanLembar(
    wb, "mingguan",
    [8, 11, 22, 32, 36, 36, 36, 36, 30, 22, 30, 10, 20, 40, 22],
    efektif.map((p) => [
      p.minggu,
      p.jenis,
      p.subCpmk.map((s) => s.subCpmk.kode).join(", "),
      p.topik ?? "",
      p.subtopik.join("\n"),
      p.metodeNarasi ?? "",
      p.aktivitasDosen ?? "",
      p.aktivitasMahasiswa ?? "",
      p.tugasTerstruktur ?? "",
      p.penilaianJenis ?? "",
      p.penilaianSistem ?? "",
      num(p.bobot),
      p.komponenNilaiId ? (namaKomponen.get(p.komponenNilaiId) ?? "") : "",
      p.indikator.map((i) => i.teks).join("\n"),
      p.pustaka.map((x) => `${x.pustaka.jenis}-${x.pustaka.nomor}`).join(", "),
    ]),
    [1, 2, 3],
  );

  // ── Komponen Nilai ──
  siapkanLembar(
    wb, "komponen", [34, 12],
    sumber.komponenNilai.map((k) => [k.nama, num(k.bobot)]),
  );

  // ── Ujian ──
  siapkanLembar(
    wb, "ujian", [8, 11, 12, 30],
    sumber.pertemuan
      .filter((p) => p.jenis !== "EFEKTIF")
      .map((p) => [
        p.minggu,
        p.jenis,
        num(p.bobot),
        p.komponenNilaiId ? (namaKomponen.get(p.komponenNilaiId) ?? "") : "",
      ]),
    [1, 2],
  );

  // ── Tugas dan Kriteria ──
  const tugas = siapkanLembar(
    wb, "tugas", [8, 30, 16, 10, 10, 10, 22, 26, 44, 44, 30],
    sumber.tugas.map((t) => [
      t.nomor, t.nama, t.jenis, t.mingguMulai, t.mingguSelesai, num(t.bobot),
      t.komponenNilai?.nama ?? "",
      t.subCpmk.map((s) => s.subCpmk.kode).join(", "),
      t.deskripsi, t.uraianTugas ?? "", t.formatLuaran ?? "",
    ]),
  );
  pilihan(tugas, 3, JENIS_TUGAS, sumber.tugas.length);

  siapkanLembar(
    wb, "kriteria", [10, 10, 40, 50, 10],
    sumber.tugas.flatMap((t) =>
      t.kriteria.map((k) => [t.nomor, k.nomor, k.indikator, k.rincian.join("\n"), num(k.bobot)]),
    ),
  );

  // ── Kisi-kisi ──
  const butirKisi = sumber.kisiKisi.flatMap((k) =>
    k.butir.map((b) => [
      k.jenis, k.durasiMenit ?? "", b.nomor, b.subCpmk.kode, b.levelBloom, b.bentuk,
      b.jumlahButir, num(b.skor), b.indikator ?? "",
    ]),
  );
  const kisi = siapkanLembar(wb, "kisi", [12, 10, 10, 16, 12, 18, 10, 10, 44], butirKisi);
  pilihan(kisi, 1, ["UTS", "UAS"], butirKisi.length);
  pilihan(kisi, 5, LEVEL_BLOOM.map((l) => l.level), butirKisi.length);
  pilihan(kisi, 6, BENTUK_SOAL, butirKisi.length);

  // ── Pustaka ──
  const pustaka = siapkanLembar(
    wb, "pustaka", [18, 8, 70, 36],
    sumber.pustaka.map((p) => [p.jenis, p.nomor, p.teks, p.url ?? ""]),
    [1, 2, 3, 4],
  );
  pilihan(pustaka, 1, JENIS_PUSTAKA, sumber.pustaka.length);
  // ── Rujukan: hanya bacaan, tidak dibaca saat unggah ──
  const ruj = wb.addWorksheet("Rujukan");
  ruj.getColumn(1).width = 22;
  ruj.getColumn(2).width = 90;
  ruj.addRow(["Kode Sub-CPMK", "Rumusan"]);
  ruj.getRow(1).font = { bold: true };
  for (const c of sumber.mataKuliah.cpmk) {
    for (const s of c.subCpmk) ruj.addRow([s.kode, s.rumusan]);
  }
  ruj.addRow([]);
  ruj.addRow(["Level Bloom", LEVEL_BLOOM.map((l) => l.level).join(", ")]);
  ruj.addRow(["Bentuk Soal", BENTUK_SOAL.join(", ")]);
  ruj.addRow(["Jenis Tugas", JENIS_TUGAS.join(", ")]);
  ruj.addRow(["Jenis Pustaka", JENIS_PUSTAKA.join(", ")]);
  ruj.addRow(["Komponen Nilai", sumber.komponenNilai.map((k) => k.nama).join(", ")]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
