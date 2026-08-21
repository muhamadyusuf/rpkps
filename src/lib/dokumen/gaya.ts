import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  TableCell,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISpacingProperties,
} from "docx";

/** Gaya bersama untuk seluruh dokumen ekspor. */

export const FONT = "Arial";
export const UKURAN_ISI = 18; // half-point → 9pt
export const UKURAN_JUDUL = 22; // 11pt
export const ABU = "F3F4F6";
export const GARIS = "9CA3AF";

export const TEPI_SEL = {
  top: { style: BorderStyle.SINGLE, size: 4, color: GARIS },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: GARIS },
  left: { style: BorderStyle.SINGLE, size: 4, color: GARIS },
  right: { style: BorderStyle.SINGLE, size: 4, color: GARIS },
};

export function teks(
  isi: string,
  opsi: { tebal?: boolean; miring?: boolean; ukuran?: number; warna?: string } = {},
): TextRun {
  return new TextRun({
    text: isi,
    bold: opsi.tebal,
    italics: opsi.miring,
    size: opsi.ukuran ?? UKURAN_ISI,
    color: opsi.warna,
    font: FONT,
  });
}

export function paragraf(
  isi: string | TextRun[],
  opsi: {
    tebal?: boolean;
    miring?: boolean;
    ukuran?: number;
    rata?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spasi?: ISpacingProperties;
    indentasi?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    children:
      typeof isi === "string"
        ? [teks(isi, { tebal: opsi.tebal, miring: opsi.miring, ukuran: opsi.ukuran })]
        : isi,
    alignment: opsi.rata,
    spacing: opsi.spasi ?? { after: 80 },
    indent: opsi.indentasi ? { left: opsi.indentasi } : undefined,
  });
}

export function judulBagian(nomor: string, judul: string): Paragraph {
  return new Paragraph({
    children: [teks(`${nomor}. ${judul}`, { tebal: true, ukuran: UKURAN_JUDUL })],
    spacing: { before: 240, after: 120 },
  });
}

export function sel(
  isi: (Paragraph | TextRun)[] | string,
  opsi: {
    lebar?: number;
    latar?: string;
    tebal?: boolean;
    rata?: (typeof AlignmentType)[keyof typeof AlignmentType];
    kolomGabung?: number;
    barisGabung?: number;
  } = {},
): TableCell {
  const anak =
    typeof isi === "string"
      ? [paragraf(isi, { tebal: opsi.tebal, rata: opsi.rata, spasi: { after: 0 } })]
      : (isi as Paragraph[]);

  return new TableCell({
    children: anak.length > 0 ? anak : [paragraf("", { spasi: { after: 0 } })],
    width: opsi.lebar ? { size: opsi.lebar, type: WidthType.PERCENTAGE } : undefined,
    shading: opsi.latar ? { fill: opsi.latar } : undefined,
    columnSpan: opsi.kolomGabung,
    rowSpan: opsi.barisGabung,
    verticalAlign: VerticalAlign.TOP,
    borders: TEPI_SEL,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

/** Memecah teks berbaris ganda menjadi beberapa paragraf. */
export function baris(isi: string | null, opsi: { tebal?: boolean } = {}): Paragraph[] {
  if (!isi?.trim()) return [];
  return isi
    .split(/\r?\n/)
    .filter((b) => b.trim() !== "")
    .map((b) => paragraf(b.trim(), { tebal: opsi.tebal, spasi: { after: 20 } }));
}

export function daftarBernomor(isi: string[]): Paragraph[] {
  return isi.map((t, i) =>
    paragraf(`${i + 1}. ${t}`, { spasi: { after: 20 }, indentasi: 120 }),
  );
}
