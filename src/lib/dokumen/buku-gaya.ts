import {
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  NumberFormat,
  PageOrientation,
  Paragraph,
  TextRun,
  convertMillimetersToTwip,
  type IParagraphStyleOptions,
  type ISectionOptions,
} from "docx";

/**
 * Gaya buku ajar — docs/16 §4.1.
 *
 * TERPISAH dari `gaya.ts`, dan itu bukan soal selera. `gaya.ts` menyetel
 * formulir RPKPS: Arial 9pt, rapat, dirancang untuk tabel tujuh kolom yang
 * harus muat di satu halaman. Buku ajar adalah barang cetakan lain sama
 * sekali — dibaca berjam-jam, berukuran B5, berhuruf serif, dan butuh gaya
 * heading sungguhan supaya Word dapat membangkitkan daftar isinya.
 *
 * Mengubah `gaya.ts` agar "cocok untuk keduanya" akan menggeser tata letak
 * SETIAP RPKPS yang dicetak — termasuk yang sudah ditandatangani dan
 * disebarkan. Karena itu berkas ini tidak mengimpor apa pun dari sana.
 */

/** Serif; buku ajar dibaca berhalaman-halaman, bukan dipindai sekilas. */
export const FONT_BUKU = "Times New Roman";
export const UKURAN_BUKU = 22; // half-point, jadi 11pt

/** B5, 18,2 x 25,7 cm - ukuran lazim buku ajar perguruan tinggi. */
export const HALAMAN_B5 = {
  width: convertMillimetersToTwip(182),
  height: convertMillimetersToTwip(257),
  orientation: PageOrientation.PORTRAIT,
} as const;

export const TEPI_B5 = {
  top: convertMillimetersToTwip(25),
  bottom: convertMillimetersToTwip(25),
  left: convertMillimetersToTwip(25),
  right: convertMillimetersToTwip(20),
} as const;

/**
 * Gaya paragraf dokumen.
 *
 * Judul bab memakai `Heading1` dan subbab `Heading2` — BUKAN paragraf tebal.
 * Field `TableOfContents` membangun daftar isi dari gaya heading; judul yang
 * sekadar ditebalkan menghasilkan daftar isi kosong, dan gagalnya senyap:
 * berkasnya tetap terbuka, hanya halaman daftar isinya yang melompong.
 */
export function gayaBuku(): IParagraphStyleOptions[] {
  return [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT_BUKU, size: 32, bold: true },
      paragraph: { spacing: { before: 480, after: 240 } },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT_BUKU, size: 26, bold: true },
      paragraph: { spacing: { before: 280, after: 140 } },
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: FONT_BUKU, size: 24, bold: true, italics: true },
      paragraph: { spacing: { before: 200, after: 100 } },
    },
  ];
}

export const GAYA_BAWAAN = {
  document: {
    run: { font: FONT_BUKU, size: UKURAN_BUKU },
    paragraph: { spacing: { line: 300, after: 120 } },
  },
} as const;

export function teksBuku(
  isi: string,
  opsi: { tebal?: boolean; miring?: boolean; ukuran?: number; warna?: string } = {},
): TextRun {
  return new TextRun({
    text: isi,
    bold: opsi.tebal,
    italics: opsi.miring,
    size: opsi.ukuran ?? UKURAN_BUKU,
    color: opsi.warna,
    font: FONT_BUKU,
  });
}

/** Paragraf isi buku: rata kiri-kanan, baris pertama boleh menjorok. */
export function paragrafBuku(
  isi: string,
  opsi: {
    tebal?: boolean;
    miring?: boolean;
    ukuran?: number;
    rata?: (typeof AlignmentType)[keyof typeof AlignmentType];
    menjorok?: boolean;
    spasiSesudah?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    children: [teksBuku(isi, opsi)],
    alignment: opsi.rata ?? AlignmentType.JUSTIFIED,
    indent: opsi.menjorok ? { firstLine: convertMillimetersToTwip(8) } : undefined,
    spacing: { after: opsi.spasiSesudah ?? 120 },
  });
}

/**
 * Judul bab. Tiap bab mulai di halaman baru — dipasang di paragrafnya, bukan
 * di gaya `Heading1`: `pageBreakBefore` bukan sifat gaya paragraf pada docx.
 */
export function judulBab(teks: string, halamanBaru = true): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: halamanBaru,
    children: [teksBuku(teks, { tebal: true, ukuran: 32 })],
  });
}

export function judulBagianBuku(judul: string, tingkat: 2 | 3 = 2): Paragraph {
  return new Paragraph({
    heading: tingkat === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    children: [teksBuku(judul, { tebal: true, ukuran: tingkat === 2 ? 26 : 24 })],
  });
}

/** Halaman awal: angka romawi kecil, seperti lazimnya buku. */
export function sifatHalamanAwal(): ISectionOptions["properties"] {
  return {
    page: {
      size: HALAMAN_B5,
      margin: TEPI_B5,
      pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
    },
  };
}

/** Batang tubuh: angka Arab, dimulai dari 1 lagi. */
export function sifatHalamanIsi(): ISectionOptions["properties"] {
  return {
    page: {
      size: HALAMAN_B5,
      margin: TEPI_B5,
      pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
    },
  };
}

/** Penomoran latihan dan daftar bernomor lain di dalam buku. */
export const PENOMORAN_BUKU = {
  config: [
    {
      reference: "latihan",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.START,
          style: {
            paragraph: {
              indent: {
                left: convertMillimetersToTwip(10),
                hanging: convertMillimetersToTwip(6),
              },
            },
          },
        },
      ],
    },
  ],
};
