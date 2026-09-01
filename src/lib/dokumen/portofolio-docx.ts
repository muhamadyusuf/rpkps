import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  WidthType,
} from "docx";
import { ABU, baris, judulBagian, paragraf, RATA_ISI, sel, teks, UKURAN_JUDUL } from "./gaya";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import type { CapaianButir, NilaiMahasiswa } from "@/domain/evaluasi/capaian";
import type { Asesmen } from "@/domain/evaluasi/peta-asesmen";

/**
 * Portofolio mata kuliah — bundel bukti yang lazim diminta asesor per MK per
 * semester (doc 05 §2.1).
 *
 * Bukan modul tersendiri: ia satu tombol ekspor di atas data yang sudah ada
 * ditambah hasil evaluasi. Empat dari lima isinya sudah dihasilkan aplikasi
 * jauh sebelum ini — yang baru hanya rekap ketercapaian dan rencana perbaikan,
 * dan justru dua itu yang dinilai.
 */

export interface SumberPortofolio {
  mk: { kode: string; nama: string; sksTeori: number; sksPraktik: number };
  prodi: string;
  tahunAkademik: string;
  kelas: string;
  dosen: string | null;
  jumlahPeserta: number;
  ambangKelulusanMhs: number;
  ambangKetercapaianMk: number;
  kelengkapan: number;
  rerataNilaiAkhir: number | null;
  catatanProses: string | null;
  asesmen: readonly Asesmen[];
  butir: readonly CapaianButir[];
  mahasiswa: readonly NilaiMahasiswa[];
  temuan: readonly {
    kode: string;
    capaianTerukur: number | null;
    akarMasalah: string;
    tindakan: string;
    penanggungJawab: string | null;
    taSasaran: string | null;
    statusVerifikasi: string;
    catatanVerifikasi: string | null;
  }[];
  /** Null berarti evaluasi belum ditutup — dokumen dicetak sebagai draf. */
  sidik: string | null;
  ditutupPada: Date | null;
  ditutupOleh: string | null;
}

export async function buatPortofolioMk(s: SumberPortofolio): Promise<Buffer> {
  const isi: (Paragraph | Table)[] = [
    paragraf("PORTOFOLIO MATA KULIAH", {
      tebal: true,
      ukuran: UKURAN_JUDUL,
      rata: AlignmentType.CENTER,
      spasi: { after: 40 },
    }),
    paragraf(s.prodi, { rata: AlignmentType.CENTER, spasi: { after: 240 } }),

    ...bagianIdentitas(s),
    ...bagianRingkasan(s),
    ...bagianCapaian(s),
    ...bagianRefleksi(s),
    ...bagianTindakLanjut(s),
    ...bagianPengesahan(s),
  ];

  const dokumen = new Document({
    sections: [{ properties: { page: { margin: { top: 850, right: 850, bottom: 850, left: 1000 } } }, children: isi }],
  });

  return Buffer.from(await Packer.toBuffer(dokumen));
}

function bagianIdentitas(s: SumberPortofolio): (Paragraph | Table)[] {
  const sks = s.mk.sksTeori + s.mk.sksPraktik;
  return [
    judulBagian("A", "IDENTITAS"),
    tabelDua([
      ["Mata Kuliah", `${s.mk.kode} — ${s.mk.nama}`],
      ["Bobot", `${sks} sks (${s.mk.sksTeori}T + ${s.mk.sksPraktik}P)`],
      ["Tahun Akademik", s.tahunAkademik.replace("-", " ")],
      ["Kelas", s.kelas],
      ["Dosen Pengampu", s.dosen ?? "—"],
      ["Jumlah Peserta", String(s.jumlahPeserta)],
    ]),
  ];
}

function bagianRingkasan(s: SumberPortofolio): (Paragraph | Table)[] {
  const cpmk = s.butir.filter((b) => b.tingkat === "CPMK");
  const cpl = s.butir.filter((b) => b.tingkat === "CPL");

  return [
    judulBagian("B", "RINGKASAN KETERCAPAIAN"),
    paragraf(
      `Mahasiswa dinyatakan lulus sebuah CPMK bila nilainya mencapai ${s.ambangKelulusanMhs}. ` +
        `CPMK dinyatakan tercapai bila sekurang-kurangnya ${s.ambangKetercapaianMk}% mahasiswa lulus. ` +
        `Kedua ambang menjawab pertanyaan yang berbeda: yang pertama tentang seorang mahasiswa, ` +
        `yang kedua tentang kelas.`,
      { rata: RATA_ISI },
    ),
    tabelDua([
      ["Kelengkapan nilai", `${s.kelengkapan}%`],
      ["Rerata nilai akhir", s.rerataNilaiAkhir === null ? "—" : String(s.rerataNilaiAkhir)],
      ["CPMK tercapai", `${cpmk.filter((b) => b.tercapai).length} dari ${cpmk.length}`],
      ["CPL tercapai", `${cpl.filter((b) => b.tercapai).length} dari ${cpl.length}`],
    ]),
  ];
}

function bagianCapaian(s: SumberPortofolio): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("C", "CAPAIAN PER BUTIR")];

  for (const [tingkat, judul] of [
    ["CPL", "Capaian Pembelajaran Lulusan"],
    ["CPMK", "Capaian Pembelajaran Mata Kuliah"],
    ["SUB_CPMK", "Sub-CPMK"],
  ] as const) {
    const butir = s.butir.filter((b) => b.tingkat === tingkat);
    if (butir.length === 0) continue;

    isi.push(paragraf([teks(judul, { tebal: true })], { spasi: { before: 160, after: 80 } }));
    isi.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              sel("Kode", { lebar: 22, tebal: true, latar: ABU }),
              sel("Rerata", { lebar: 15, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel("Mahasiswa Lulus", { lebar: 22, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel("Pita", { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel("Status", { lebar: 21, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            ],
          }),
          ...butir.map(
            (b) =>
              new TableRow({
                children: [
                  sel(b.kode, { lebar: 22 }),
                  sel(b.rerata === null ? "—" : String(b.rerata), { lebar: 15, rata: AlignmentType.CENTER }),
                  sel(b.persenLulus === null ? "—" : `${b.persenLulus}%`, { lebar: 22, rata: AlignmentType.CENTER }),
                  sel(b.pita, { lebar: 20, rata: AlignmentType.CENTER }),
                  sel(b.jumlahDinilai === 0 ? "belum terukur" : b.tercapai ? "tercapai" : "belum tercapai", {
                    lebar: 21,
                    rata: AlignmentType.CENTER,
                  }),
                ],
              }),
          ),
        ],
      }),
    );
  }

  // Peta asesmen ikut dicetak: tanpa bobot yang berlaku, angka di atas tidak
  // dapat diperiksa ulang oleh siapa pun.
  isi.push(paragraf([teks("Asesmen yang menyusun capaian", { tebal: true })], { spasi: { before: 200, after: 80 } }));
  isi.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel("Kode", { lebar: 12, tebal: true, latar: ABU }),
            sel("Asesmen", { lebar: 34, tebal: true, latar: ABU }),
            sel("Komponen", { lebar: 22, tebal: true, latar: ABU }),
            sel("Bobot", { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("Sub-CPMK", { lebar: 20, tebal: true, latar: ABU }),
          ],
        }),
        ...s.asesmen.map(
          (a) =>
            new TableRow({
              children: [
                sel(a.kode, { lebar: 12 }),
                sel(a.nama, { lebar: 34 }),
                sel(a.komponen ?? "—", { lebar: 22 }),
                sel(`${a.bobot}%`, { lebar: 12, rata: AlignmentType.CENTER }),
                sel(a.subCpmk.map((x) => x.kode).join(", "), { lebar: 20 }),
              ],
            }),
        ),
      ],
    }),
  );

  return isi;
}

function bagianRefleksi(s: SumberPortofolio): (Paragraph | Table)[] {
  return [
    judulBagian("D", "CATATAN PROSES PEMBELAJARAN"),
    ...(s.catatanProses?.trim()
      ? baris(s.catatanProses)
      : [paragraf("Belum diisi.", { miring: true })]),
  ];
}

function bagianTindakLanjut(s: SumberPortofolio): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("E", "TEMUAN DAN RENCANA TINDAK LANJUT")];

  if (s.temuan.length === 0) {
    isi.push(
      paragraf(
        "Tidak ada CPMK yang berada di bawah ambang ketercapaian, sehingga tidak ada tindak lanjut yang diwajibkan pada semester ini.",
        { rata: RATA_ISI },
      ),
    );
    return isi;
  }

  isi.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel("Butir", { lebar: 12, tebal: true, latar: ABU }),
            sel("Capaian", { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("Akar Masalah", { lebar: 30, tebal: true, latar: ABU }),
            sel("Tindakan", { lebar: 30, tebal: true, latar: ABU }),
            sel("Penanggung Jawab / Berlaku", { lebar: 18, tebal: true, latar: ABU }),
          ],
        }),
        ...s.temuan.map(
          (t) =>
            new TableRow({
              children: [
                sel(t.kode, { lebar: 12 }),
                sel(t.capaianTerukur === null ? "—" : `${t.capaianTerukur}%`, {
                  lebar: 10,
                  rata: AlignmentType.CENTER,
                }),
                sel(t.akarMasalah, { lebar: 30 }),
                sel(t.tindakan, { lebar: 30 }),
                sel(
                  [
                    paragraf(t.penanggungJawab ?? "—", { spasi: { after: 20 } }),
                    paragraf(t.taSasaran ? t.taSasaran.replace("-", " ") : "—", {
                      miring: true,
                      spasi: { after: 0 },
                    }),
                  ],
                  { lebar: 18 },
                ),
              ],
            }),
        ),
      ],
    }),
  );

  const diverifikasi = s.temuan.filter((t) => t.statusVerifikasi !== "BELUM");
  if (diverifikasi.length > 0) {
    isi.push(paragraf([teks("Verifikasi tindak lanjut", { tebal: true })], { spasi: { before: 200, after: 80 } }));
    for (const t of diverifikasi) {
      isi.push(
        paragraf(
          `${t.kode}: ${t.statusVerifikasi === "TERCAPAI" ? "tercapai" : "belum tercapai"}` +
            (t.catatanVerifikasi ? ` — ${t.catatanVerifikasi}` : ""),
          { rata: RATA_ISI, indentasi: 320 },
        ),
      );
    }
  }

  return isi;
}

function bagianPengesahan(s: SumberPortofolio): (Paragraph | Table)[] {
  if (!s.sidik) {
    return [
      judulBagian("F", "STATUS DOKUMEN"),
      paragraf(
        "Evaluasi belum ditutup. Angka pada dokumen ini masih dapat berubah dan belum menjadi catatan resmi.",
        { miring: true, rata: RATA_ISI },
      ),
    ];
  }

  return [
    judulBagian("F", "PENGESAHAN"),
    paragraf(
      `Evaluasi ditutup pada ${s.ditutupPada?.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })} oleh ${s.ditutupOleh ?? "—"}.`,
      { rata: RATA_ISI },
    ),
    paragraf([
      teks("Sidik dokumen: "),
      teks(sidikRingkas(s.sidik), { tebal: true }),
    ]),
    paragraf(
      "Sidik dihitung dengan SHA-256 atas seluruh isi evaluasi. Nilai mahasiswa boleh berubah setelah remedial; salinan beku yang menghasilkan sidik ini tidak.",
      { miring: true, rata: RATA_ISI },
    ),
  ];
}

function tabelDua(baris: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: baris.map(
      ([kiri, kanan]) =>
        new TableRow({
          children: [sel(kiri, { lebar: 30, tebal: true }), sel(kanan, { lebar: 70 })],
        }),
    ),
  });
}
