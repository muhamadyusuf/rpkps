import {
  AlignmentType,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  TableOfContents,
  TextRun,
} from "docx";
import {
  GAYA_BAWAAN,
  PENOMORAN_BUKU,
  gayaBuku,
  judulBab,
  judulBagianBuku,
  paragrafBuku,
  sifatHalamanAwal,
  sifatHalamanIsi,
  teksBuku,
  FONT_BUKU,
} from "./buku-gaya";
import { labelDokumen, type LabelDokumen } from "./label";
import { isi as sisip } from "@/lib/bahasa/teks";
import type { Bahasa } from "@/kamus";

/**
 * Pencetak buku ajar — docs/16 §4.1.
 *
 * Menerima bentuk datar `BukuUntukCetak`, bukan baris Prisma. Dua alasan:
 * modul ini dapat diuji tanpa basis data, dan susunan halaman buku tidak ikut
 * berubah setiap kali `select` pemuatnya digeser.
 *
 * # Kunci jawaban
 *
 * `opsi.kunci` menentukan apakah bagian kunci ikut dicetak. Inilah alasan
 * `latihan_bab.kunci` disimpan di kolomnya sendiri: berkas untuk mahasiswa
 * dibuat dengan mematikan bendera ini, bukan dengan menyunting naskah.
 * Penjaganya `buku-ajar-docx.test.ts`, yang membaca kembali isi berkasnya.
 */

export interface LatihanCetak {
  nomor: number;
  soal: string;
  kunci: string | null;
}

export interface BabCetak {
  nomor: number;
  judul: string;
  tujuan: string[];
  uraian: string | null;
  studiKasus: string | null;
  ringkasan: string | null;
  latihan: LatihanCetak[];
  /** Bab masih murni keluaran model; dipakai memasang catatan naskah. */
  belumDisunting: boolean;
}

export interface BukuUntukCetak {
  bahasa: Bahasa;
  judul: string;
  subjudul: string | null;
  penulis: string[];
  afiliasi: string | null;
  penerbit: string | null;
  kotaTerbit: string | null;
  tahunTerbit: number | null;
  edisi: string | null;
  isbn: string | null;
  hakCipta: string | null;
  prakata: string | null;
  pendahuluan: string | null;
  glosarium: { istilah: string; arti: string }[];
  biografi: string | null;
  mataKuliah: { kode: string; nama: string };
  prodi: string;
  bab: BabCetak[];
  pustaka: { nomor: number; jenis: string; teks: string }[];
}

export interface OpsiCetakBuku {
  /** Cetak kunci jawaban. Berkas untuk mahasiswa memakai `false`. */
  kunci?: boolean;
  /** Cetak satu bab saja, mis. untuk dibagikan mingguan. */
  bab?: number;
}

export async function buatBukuAjarDocx(
  buku: BukuUntukCetak,
  opsi: OpsiCetakBuku = {},
): Promise<Buffer> {
  const L = labelDokumen(buku.bahasa);
  const kunci = opsi.kunci ?? true;
  const bab =
    opsi.bab === undefined ? buku.bab : buku.bab.filter((b) => b.nomor === opsi.bab);

  const dokumen = new Document({
    // Tanpa ini, daftar isi terbuka sebagai bingkai kosong sampai pembaca
    // menekan "perbarui field" sendiri.
    features: { updateFields: true },
    styles: { default: GAYA_BAWAAN, paragraphStyles: gayaBuku() },
    numbering: PENOMORAN_BUKU,
    sections: [
      {
        properties: sifatHalamanAwal(),
        footers: { default: kakiHalaman() },
        children: [
          ...halamanJudul(buku),
          ...halamanHakCipta(buku, L),
          ...(opsi.bab === undefined ? halamanPrakata(buku, L) : []),
          ...(opsi.bab === undefined ? daftarIsi(L) : []),
        ],
      },
      {
        properties: sifatHalamanIsi(),
        footers: { default: kakiHalaman() },
        children: [
          ...(opsi.bab === undefined ? bagianPendahuluan(buku, L) : []),
          ...bab.flatMap((b) => bagianBab(b, L, kunci)),
          ...(opsi.bab === undefined ? bagianGlosarium(buku, L) : []),
          ...(opsi.bab === undefined ? bagianPustaka(buku, L) : []),
          ...(opsi.bab === undefined ? bagianBiografi(buku, L) : []),
        ],
      },
    ],
  });

  return Packer.toBuffer(dokumen);
}

function kakiHalaman(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: [PageNumber.CURRENT], font: FONT_BUKU, size: 20 }),
        ],
      }),
    ],
  });
}

function halamanJudul(buku: BukuUntukCetak): Paragraph[] {
  const baris: Paragraph[] = [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    paragrafBuku(buku.judul, { tebal: true, ukuran: 44, rata: AlignmentType.CENTER }),
  ];

  if (buku.subjudul) {
    baris.push(
      paragrafBuku(buku.subjudul, { ukuran: 28, rata: AlignmentType.CENTER, miring: true }),
    );
  }

  baris.push(new Paragraph({ spacing: { before: 1600 }, children: [] }));
  for (const nama of buku.penulis) {
    baris.push(paragrafBuku(nama, { ukuran: 26, rata: AlignmentType.CENTER }));
  }
  if (buku.afiliasi) {
    baris.push(paragrafBuku(buku.afiliasi, { ukuran: 22, rata: AlignmentType.CENTER }));
  }

  if (buku.penerbit) {
    baris.push(new Paragraph({ spacing: { before: 1600 }, children: [] }));
    baris.push(paragrafBuku(buku.penerbit, { ukuran: 24, rata: AlignmentType.CENTER }));
  }

  return baris;
}

/**
 * Halaman hak cipta.
 *
 * Bagian yang kosong dicetak sebagai GARIS ISIAN, bukan dilewati diam-diam.
 * Buku tanpa ISBN yang halaman hak ciptanya tampak lengkap adalah jebakan:
 * dosen mengira sudah beres, penerbit menemukan kolomnya hilang.
 */
function halamanHakCipta(buku: BukuUntukCetak, L: LabelDokumen): Paragraph[] {
  const garis = L.buku.belumDidaftarkan;
  const baris: Paragraph[] = [
    new Paragraph({ pageBreakBefore: true, children: [] }),
    paragrafBuku(buku.judul, { tebal: true, ukuran: 26 }),
  ];

  if (buku.subjudul) baris.push(paragrafBuku(buku.subjudul, { miring: true }));

  baris.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  baris.push(
    keterangan(`${L.buku.penulis}: `, buku.penulis.join("; ") || garis),
    keterangan(`${L.buku.penerbit}: `, buku.penerbit ?? garis),
    keterangan(`${L.buku.kotaTerbit}: `, buku.kotaTerbit ?? garis),
    keterangan(`${L.buku.tahunTerbit}: `, buku.tahunTerbit?.toString() ?? garis),
    keterangan(`${L.buku.edisi}: `, buku.edisi ?? garis),
    keterangan(`${L.buku.isbn}: `, buku.isbn ?? garis),
  );

  baris.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
  baris.push(paragrafBuku(buku.hakCipta ?? L.buku.hakCiptaBawaan, { ukuran: 20 }));
  baris.push(
    paragrafBuku(
      sisip(L.buku.disusunDari, {
        mk: `${buku.mataKuliah.kode} ${buku.mataKuliah.nama}`,
        prodi: buku.prodi,
      }),
      { ukuran: 20, miring: true },
    ),
  );

  // Peringatan ini tercetak DI DALAM naskah, bukan hanya di layar: berkas
  // inilah yang dikirim ke penerbit, dan layar tidak ikut terkirim.
  if (buku.bab.some((b) => b.belumDisunting && b.uraian?.trim())) {
    baris.push(paragrafBuku(L.buku.catatanDraf, { ukuran: 20, tebal: true }));
  }

  return baris;
}

function keterangan(label: string, nilai: string): Paragraph {
  return new Paragraph({
    children: [teksBuku(label, { tebal: true, ukuran: 20 }), teksBuku(nilai, { ukuran: 20 })],
    spacing: { after: 60 },
  });
}

function halamanPrakata(buku: BukuUntukCetak, L: LabelDokumen): Paragraph[] {
  if (!buku.prakata?.trim()) return [];
  return [judulBab(L.buku.prakata), ...alinea(buku.prakata)];
}

function daftarIsi(L: LabelDokumen): Paragraph[] {
  return [
    judulBab(L.buku.daftarIsi),
    // Dibangun dari gaya Heading1-Heading3; judul yang sekadar ditebalkan
    // tidak akan pernah muncul di sini.
    new TableOfContents(L.buku.daftarIsi, {
      hyperlink: true,
      headingStyleRange: "1-3",
    }) as unknown as Paragraph,
  ];
}

function bagianPendahuluan(buku: BukuUntukCetak, L: LabelDokumen): Paragraph[] {
  if (!buku.pendahuluan?.trim()) return [];
  return [judulBab(L.buku.pendahuluan), ...alinea(buku.pendahuluan)];
}

function bagianBab(bab: BabCetak, L: LabelDokumen, kunci: boolean): Paragraph[] {
  const baris: Paragraph[] = [
    judulBab(`${L.buku.bab} ${bab.nomor}`),
    paragrafBuku(bab.judul, { tebal: true, ukuran: 28 }),
  ];

  const tujuan = bab.tujuan.map((t) => t.trim()).filter(Boolean);
  if (tujuan.length > 0) {
    baris.push(judulBagianBuku(L.buku.tujuanPembelajaran));
    baris.push(...tujuan.map((t) => butir(t)));
  }

  if (bab.uraian?.trim()) baris.push(...uraianBab(bab.uraian));

  if (bab.studiKasus?.trim()) {
    baris.push(judulBagianBuku(L.buku.studiKasus));
    baris.push(...alinea(bab.studiKasus));
  }

  if (bab.ringkasan?.trim()) {
    baris.push(judulBagianBuku(L.buku.ringkasan));
    baris.push(...alinea(bab.ringkasan));
  }

  if (bab.latihan.length > 0) {
    baris.push(judulBagianBuku(L.buku.latihan));
    baris.push(...bab.latihan.map((l) => bernomor(l.soal)));

    // Satu-satunya tempat kunci jawaban tercetak. Berkas untuk mahasiswa
    // dibuat dengan mematikan bendera ini, bukan dengan menyunting naskah.
    const berkunci = bab.latihan.filter((l) => l.kunci?.trim());
    if (kunci && berkunci.length > 0) {
      baris.push(judulBagianBuku(L.buku.kunciJawaban, 3));
      baris.push(...berkunci.map((l) => bernomor(`${l.nomor}. ${l.kunci!.trim()}`, false)));
    }
  }

  return baris;
}

function bagianGlosarium(buku: BukuUntukCetak, L: LabelDokumen): Paragraph[] {
  if (buku.glosarium.length === 0) return [];
  return [
    judulBab(L.buku.glosarium),
    ...buku.glosarium.map(
      (g) =>
        new Paragraph({
          children: [
            teksBuku(`${g.istilah}. `, { tebal: true }),
            teksBuku(g.arti),
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 100 },
        }),
    ),
  ];
}

/**
 * Daftar pustaka dirakit dari pustaka RPKPS, BUKAN dari karangan model
 * (docs/16 P6). Sitiran bab sudah disaring terhadap daftar yang sama, sehingga
 * tidak ada nomor yang menggantung tanpa padanan di halaman ini.
 */
function bagianPustaka(buku: BukuUntukCetak, L: LabelDokumen): Paragraph[] {
  if (buku.pustaka.length === 0) return [];
  return [
    judulBab(L.buku.daftarPustaka),
    ...buku.pustaka.map((p) => bernomor(`[${p.nomor}] ${p.teks}`, false)),
  ];
}

function bagianBiografi(buku: BukuUntukCetak, L: LabelDokumen): Paragraph[] {
  if (!buku.biografi?.trim()) return [];
  return [judulBab(L.buku.tentangPenulis), ...alinea(buku.biografi)];
}

// ─────────────────────────────────────────────────────────────

/**
 * Memecah teks bebas menjadi paragraf, dan mengangkat baris yang berbentuk
 * judul subbab menjadi Heading2.
 *
 * Panduan tahap 2 meminta model menulis subbab bernomor dengan judulnya pada
 * baris tersendiri. Dikenali di sini supaya daftar isi buku tidak hanya
 * memuat nama bab — dan bila modelnya tidak menurut, yang terjadi hanyalah
 * paragraf biasa, bukan berkas yang rusak.
 */
function uraianBab(teks: string): Paragraph[] {
  const hasil: Paragraph[] = [];
  for (const baris of teks.split(/\r?\n/)) {
    const isi = baris.trim();
    if (!isi) continue;
    if (adalahJudulSubbab(isi)) hasil.push(judulBagianBuku(isi));
    else hasil.push(paragrafBuku(isi, { menjorok: true }));
  }
  return hasil;
}

/** Baris pendek berawalan nomor bertitik, tanpa titik penutup kalimat. */
function adalahJudulSubbab(baris: string): boolean {
  if (baris.length > 90) return false;
  if (!/^\d+(\.\d+)*\.?\s+\S/.test(baris)) return false;
  return !/[.:;,]$/.test(baris);
}

function alinea(teks: string): Paragraph[] {
  return teks
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => paragrafBuku(b, { menjorok: true }));
}

function butir(teks: string): Paragraph {
  return new Paragraph({
    children: [teksBuku(teks)],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function bernomor(teks: string, otomatis = true): Paragraph {
  return new Paragraph({
    children: [teksBuku(teks)],
    numbering: otomatis ? { reference: "latihan", level: 0 } : undefined,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 80 },
  });
}

/** Nama berkas yang aman untuk sistem berkas mana pun. */
export function namaBerkasBuku(
  buku: BukuUntukCetak,
  opsi: OpsiCetakBuku,
  ekstensi = "docx",
): string {
  const bagian =
    opsi.bab !== undefined
      ? ` - Bab ${opsi.bab}`
      : opsi.kunci === false
        ? " - tanpa kunci"
        : "";
  return `${buku.judul}${bagian}.${ekstensi}`.replace(/[/\\?%*:|"<>]/g, "-");
}
