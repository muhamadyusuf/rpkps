import PptxGenJS from "pptxgenjs";
import { labelDokumen, type LabelDokumen } from "./label";
import type { Bahasa } from "@/kamus";

/**
 * Pencetak slide kuliah — docs/16 §4.2.
 *
 * Satu bab menjadi satu berkas presentasi, atau seluruh buku menjadi satu
 * berkas panjang. Bentuk masukannya datar dan tidak menyentuh Prisma, sama
 * seperti `buku-ajar-docx.ts`, sehingga dapat diuji tanpa basis data.
 *
 * # Kunci jawaban tidak dapat masuk ke sini
 *
 * Perhatikan `LatihanSlide` di bawah: ia hanya punya `nomor` dan `soal`.
 * Ketiadaan medan `kunci` disengaja dan merupakan penjaga yang sesungguhnya —
 * slide ditayangkan di depan kelas, dan kunci jawaban yang tersorot di layar
 * tidak dapat ditarik kembali. Melarangnya lewat kehati-hatian saja akan
 * bertahan tepat sampai orang berikutnya menambahkan satu baris; medan yang
 * tidak ada pada tipe tidak dapat dicetak dengan cara apa pun.
 */

/** 16:9 dalam inci — ukuran proyektor dan layar kelas masa kini. */
const LEBAR = 13.33;
const TINGGI = 7.5;

const WARNA_JUDUL = "1F2937";
const WARNA_ISI = "374151";
const WARNA_REDUP = "9CA3AF";

export interface SlideCetak {
  nomor: number;
  judul: string;
  butir: string[];
  /** Menjadi speaker notes; tidak pernah tercetak di badan slide. */
  catatan: string | null;
}

/** Sengaja tanpa medan `kunci`. Lihat catatan modul. */
export interface LatihanSlide {
  nomor: number;
  soal: string;
}

export interface BabUntukSlide {
  nomor: number;
  judul: string;
  tujuan: string[];
  slide: SlideCetak[];
  latihan: LatihanSlide[];
}

export interface DekUntukSlide {
  bahasa: Bahasa;
  judulBuku: string;
  penulis: string[];
  mataKuliah: { kode: string; nama: string };
  bab: BabUntukSlide[];
}

export interface OpsiSlide {
  /** Cetak satu bab saja. Kosong berarti seluruh buku dalam satu berkas. */
  bab?: number;
}

export async function buatSlidePptx(
  dek: DekUntukSlide,
  opsi: OpsiSlide = {},
): Promise<Buffer> {
  const L = labelDokumen(dek.bahasa);
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_16x9";
  pptx.author = dek.penulis.join("; ");
  pptx.title = dek.judulBuku;
  pptx.subject = `${dek.mataKuliah.kode} ${dek.mataKuliah.nama}`;

  const bab =
    opsi.bab === undefined ? dek.bab : dek.bab.filter((b) => b.nomor === opsi.bab);

  for (const b of bab) {
    slidePembuka(pptx, dek, b, L);
    if (b.tujuan.length > 0) {
      slideButir(pptx, L.buku.tujuanPembelajaran, b.tujuan, null, kaki(dek, b, L));
    }

    for (const s of b.slide) {
      slideButir(pptx, s.judul, s.butir, s.catatan, kaki(dek, b, L));
    }

    // Slide latihan menutup tiap bab — SOALNYA saja. Kuncinya tidak dapat
    // sampai ke sini: `LatihanSlide` tidak punya medannya.
    if (b.latihan.length > 0) {
      slideButir(
        pptx,
        L.buku.latihan,
        b.latihan.map((l) => `${l.nomor}. ${l.soal}`),
        null,
        kaki(dek, b, L),
      );
    }
  }

  // Berkas tanpa satu slide pun tidak dapat dibuka PowerPoint; satu slide
  // kosong yang menyebut sebabnya jauh lebih baik daripada berkas rusak.
  if (bab.length === 0) {
    const slide = pptx.addSlide();
    slide.addText(dek.judulBuku, {
      x: 0.8,
      y: TINGGI / 2 - 0.5,
      w: LEBAR - 1.6,
      h: 1,
      fontSize: 28,
      bold: true,
      color: WARNA_JUDUL,
    });
  }

  const hasil = await pptx.write({ outputType: "nodebuffer" });
  return hasil as Buffer;
}

function kaki(dek: DekUntukSlide, bab: BabUntukSlide, L: LabelDokumen): string {
  return `${dek.mataKuliah.kode} · ${L.buku.bab} ${bab.nomor} — ${bab.judul}`;
}

function slidePembuka(
  pptx: PptxGenJS,
  dek: DekUntukSlide,
  bab: BabUntukSlide,
  L: LabelDokumen,
) {
  const slide = pptx.addSlide();

  slide.addText(`${L.buku.bab} ${bab.nomor}`, {
    x: 0.8,
    y: 2.2,
    w: LEBAR - 1.6,
    h: 0.5,
    fontSize: 16,
    color: WARNA_REDUP,
  });
  slide.addText(bab.judul, {
    x: 0.8,
    y: 2.7,
    w: LEBAR - 1.6,
    h: 1.6,
    fontSize: 40,
    bold: true,
    color: WARNA_JUDUL,
  });
  slide.addText(`${dek.mataKuliah.kode} — ${dek.mataKuliah.nama}`, {
    x: 0.8,
    y: 4.4,
    w: LEBAR - 1.6,
    h: 0.5,
    fontSize: 16,
    color: WARNA_ISI,
  });
  if (dek.penulis.length > 0) {
    slide.addText(dek.penulis.join("; "), {
      x: 0.8,
      y: 4.9,
      w: LEBAR - 1.6,
      h: 0.5,
      fontSize: 14,
      color: WARNA_REDUP,
    });
  }
}

function slideButir(
  pptx: PptxGenJS,
  judul: string,
  butir: readonly string[],
  catatan: string | null,
  kakiTeks: string,
) {
  const slide = pptx.addSlide();

  slide.addText(judul, {
    x: 0.7,
    y: 0.5,
    w: LEBAR - 1.4,
    h: 0.9,
    fontSize: 28,
    bold: true,
    color: WARNA_JUDUL,
  });

  const isi = butir.map((b) => b.trim()).filter(Boolean);
  if (isi.length > 0) {
    slide.addText(
      isi.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      {
        x: 0.9,
        y: 1.6,
        w: LEBAR - 1.8,
        h: TINGGI - 2.6,
        fontSize: isi.length > 6 ? 16 : 20,
        color: WARNA_ISI,
        lineSpacingMultiple: 1.2,
        valign: "top",
      },
    );
  }

  slide.addText(kakiTeks, {
    x: 0.7,
    y: TINGGI - 0.7,
    w: LEBAR - 1.4,
    h: 0.4,
    fontSize: 10,
    color: WARNA_REDUP,
  });

  // Catatan pembicara. Tidak pernah menjadi teks di atas slide — itu beda
  // antara bahan mengajar dan slide yang dibacakan.
  if (catatan?.trim()) slide.addNotes(catatan.trim());
}

export function namaBerkasSlide(dek: DekUntukSlide, opsi: OpsiSlide = {}): string {
  const bagian = opsi.bab !== undefined ? ` - Bab ${opsi.bab}` : "";
  return `${dek.judulBuku}${bagian}.pptx`.replace(/[/\\?%*:|"<>]/g, "-");
}
