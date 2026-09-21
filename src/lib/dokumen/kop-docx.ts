import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  VerticalAlign,
  WidthType,
} from "docx";
import { GARIS, paragraf, teks } from "./gaya";
import { barisKontak, type KopLembaga, type LogoKop } from "./kop";
import type { Bahasa } from "@/kamus";

/**
 * Kop lembaga sebagai blok DOCX. Acuan: docs/21 §2.9.
 *
 * Terpisah dari `kop.ts` supaya berkas itu tetap bebas dari `docx`:
 * `rakit-naskah.ts` dan halaman pratinjau memakai datanya, dan mengimpor
 * penyusun dokumen dari sebuah halaman akan menarik seluruh `docx` ke dalam
 * bundel halaman itu.
 *
 * Bentuknya tabel tiga kolom TANPA garis — lambang institut, blok nama dan
 * kontak, lambang prodi — dengan satu garis tipis di bawahnya. Kolom lambang
 * yang tidak punya isi TIDAK dirender sebagai sel kosong: tabelnya menyusut,
 * sehingga prodi yang belum mengunggah logo tidak mendapat kop yang pincang.
 */

/** Lebar kolom lambang, dalam twip. 1 cm = 567 twip. */
const LEBAR_LOGO = 1020; // ±1,8 cm
const TANPA_TEPI = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function selLogo(logo: LogoKop): TableCell {
  /*
   * Tinggi dihitung dari nisbah aslinya, bukan dipatok: logo yang tercetak
   * gepeng adalah cara tercepat membuat dokumen resmi terlihat seperti
   * tempelan. `docx` memakai poin di sini (1 pt = 20 twip).
   */
  const lebarPt = LEBAR_LOGO / 20;
  const tinggiPt = Math.round((logo.tinggi / Math.max(1, logo.lebar)) * lebarPt);

  return new TableCell({
    width: { size: LEBAR_LOGO, type: WidthType.DXA },
    borders: TANPA_TEPI,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 0, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [
          new ImageRun({
            // Hanya PNG dan JPEG yang pernah tersimpan — `periksaLogo`
            // menolak sisanya sebelum satu bita pun masuk basis data.
            type: logo.bita?.[0] === 0xff ? "jpg" : "png",
            data: logo.bita!,
            transformation: { width: lebarPt, height: tinggiPt },
          }),
        ],
      }),
    ],
  });
}

/**
 * Kop penuh. Dipakai pada halaman PERTAMA tiap bagian; halaman berikutnya
 * memakai `kopRingkas`, karena lambang beresolusi penuh pada setiap halaman
 * dari tiga bagian membengkakkan berkas tanpa menambah satu keterangan pun.
 */
export function kopPenuh(kop: KopLembaga, bahasa: Bahasa): (Paragraph | Table)[] {
  const kiri = kop.logoInstitusi?.bita ? selLogo(kop.logoInstitusi) : null;
  const kanan = kop.logoProdi?.bita ? selLogo(kop.logoProdi) : null;
  const kontak = barisKontak(kop, bahasa);

  const tengah = new TableCell({
    borders: TANPA_TEPI,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: [
      paragraf([teks(kop.institusi, { tebal: true, ukuran: 22 })], {
        rata: AlignmentType.CENTER,
        spasi: { after: 0 },
      }),
      ...(kop.prodi
        ? [
            paragraf([teks(kop.prodi, { ukuran: 20 })], {
              rata: AlignmentType.CENTER,
              spasi: { after: 0 },
            }),
          ]
        : []),
      ...(kontak
        ? [
            paragraf([teks(kontak, { ukuran: 14, warna: "6B7280" })], {
              rata: AlignmentType.CENTER,
              spasi: { after: 0 },
            }),
          ]
        : []),
    ],
  });

  const tabel = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      ...TANPA_TEPI,
      // Satu-satunya garis: pemisah kop dari isi, seperti kop surat.
      insideHorizontal: TANPA_TEPI.top,
      insideVertical: TANPA_TEPI.top,
    },
    rows: [
      new TableRow({
        children: [...(kiri ? [kiri] : []), tengah, ...(kanan ? [kanan] : [])],
      }),
    ],
  });

  return [
    tabel,
    new Paragraph({
      spacing: { before: 40, after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GARIS } },
      children: [],
    }),
  ];
}
