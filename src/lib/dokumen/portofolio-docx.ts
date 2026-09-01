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
import type { Bahasa } from "@/kamus";
import { labelDokumen, type LabelDokumen } from "./label";

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

export async function buatPortofolioMk(
  s: SumberPortofolio,
  bahasa: Bahasa = "id",
): Promise<Buffer> {
  const L = labelDokumen(bahasa);
  const isi: (Paragraph | Table)[] = [
    paragraf(L.portofolio.portofolioMataKuliah, {
      tebal: true,
      ukuran: UKURAN_JUDUL,
      rata: AlignmentType.CENTER,
      spasi: { after: 40 },
    }),
    paragraf(s.prodi, { rata: AlignmentType.CENTER, spasi: { after: 240 } }),

    ...bagianIdentitas(s, L),
    ...bagianRingkasan(s, L),
    ...bagianCapaian(s, L),
    ...bagianRefleksi(s, L),
    ...bagianTindakLanjut(s, L),
    ...bagianPengesahan(s, L),
  ];

  const dokumen = new Document({
    sections: [{ properties: { page: { margin: { top: 850, right: 850, bottom: 850, left: 1000 } } }, children: isi }],
  });

  return Buffer.from(await Packer.toBuffer(dokumen));
}

function bagianIdentitas(s: SumberPortofolio, L: LabelDokumen): (Paragraph | Table)[] {
  const sks = s.mk.sksTeori + s.mk.sksPraktik;
  return [
    judulBagian("A", L.portofolio.identitas),
    tabelDua([
      [L.portofolio.mataKuliah, `${s.mk.kode} — ${s.mk.nama}`],
      [L.portofolio.bobot, `${sks} sks (${s.mk.sksTeori}T + ${s.mk.sksPraktik}P)`],
      [L.portofolio.tahunAkademik, s.tahunAkademik.replace("-", " ")],
      [L.portofolio.kelas, s.kelas],
      [L.portofolio.dosenPengampu, s.dosen ?? "—"],
      [L.portofolio.jumlahPeserta, String(s.jumlahPeserta)],
    ]),
  ];
}

function bagianRingkasan(s: SumberPortofolio, L: LabelDokumen): (Paragraph | Table)[] {
  const cpmk = s.butir.filter((b) => b.tingkat === L.portofolio.cpmk);
  const cpl = s.butir.filter((b) => b.tingkat === "CPL");

  return [
    judulBagian("B", L.portofolio.ringkasanKetercapaian),
    paragraf(
      `Mahasiswa dinyatakan lulus sebuah CPMK bila nilainya mencapai ${s.ambangKelulusanMhs}. ` +
        `CPMK dinyatakan tercapai bila sekurang-kurangnya ${s.ambangKetercapaianMk}% mahasiswa lulus. ` +
        `Kedua ambang menjawab pertanyaan yang berbeda: yang pertama tentang seorang mahasiswa, ` +
        `yang kedua tentang kelas.`,
      { rata: RATA_ISI },
    ),
    tabelDua([
      [L.portofolio.kelengkapanNilai, `${s.kelengkapan}%`],
      [L.portofolio.rerataNilaiAkhir, s.rerataNilaiAkhir === null ? "—" : String(s.rerataNilaiAkhir)],
      [L.portofolio.cpmkTercapai, `${cpmk.filter((b) => b.tercapai).length} dari ${cpmk.length}`],
      [L.portofolio.cplTercapai, `${cpl.filter((b) => b.tercapai).length} dari ${cpl.length}`],
    ]),
  ];
}

function bagianCapaian(s: SumberPortofolio, L: LabelDokumen): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("C", L.portofolio.capaianPerButir)];

  for (const [tingkat, judul] of [
    ["CPL", "Capaian Pembelajaran Lulusan"],
    [L.portofolio.cpmk, "Capaian Pembelajaran Mata Kuliah"],
    ["SUB_CPMK", L.portofolio.subCpmk],
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
              sel(L.portofolio.kode, { lebar: 22, tebal: true, latar: ABU }),
              sel(L.portofolio.rerata, { lebar: 15, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel(L.portofolio.mahasiswaLulus, { lebar: 22, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel(L.portofolio.pita, { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel(L.portofolio.status, { lebar: 21, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
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
  isi.push(paragraf([teks(L.portofolio.asesmenYangMenyusunCapaian, { tebal: true })], { spasi: { before: 200, after: 80 } }));
  isi.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel(L.portofolio.kode, { lebar: 12, tebal: true, latar: ABU }),
            sel(L.portofolio.asesmen, { lebar: 34, tebal: true, latar: ABU }),
            sel(L.portofolio.komponen, { lebar: 22, tebal: true, latar: ABU }),
            sel(L.portofolio.bobot, { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.portofolio.subCpmk, { lebar: 20, tebal: true, latar: ABU }),
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

function bagianRefleksi(s: SumberPortofolio, L: LabelDokumen): (Paragraph | Table)[] {
  return [
    judulBagian("D", L.portofolio.catatanProsesPembelajaran),
    ...(s.catatanProses?.trim()
      ? baris(s.catatanProses)
      : [paragraf(L.portofolio.belumDiisi, { miring: true })]),
  ];
}

function bagianTindakLanjut(s: SumberPortofolio, L: LabelDokumen): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("E", L.portofolio.temuanDanRtl)];

  if (s.temuan.length === 0) {
    isi.push(
      paragraf(
        L.portofolio.tanpaTindakLanjut,
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
            sel(L.portofolio.butir, { lebar: 12, tebal: true, latar: ABU }),
            sel(L.portofolio.capaian, { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.portofolio.akarMasalah, { lebar: 30, tebal: true, latar: ABU }),
            sel(L.portofolio.tindakan, { lebar: 30, tebal: true, latar: ABU }),
            sel(L.portofolio.penanggungJawabBerlaku, { lebar: 18, tebal: true, latar: ABU }),
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
    isi.push(paragraf([teks(L.portofolio.verifikasiTindakLanjut, { tebal: true })], { spasi: { before: 200, after: 80 } }));
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

function bagianPengesahan(s: SumberPortofolio, L: LabelDokumen): (Paragraph | Table)[] {
  if (!s.sidik) {
    return [
      judulBagian("F", L.portofolio.statusDokumen),
      paragraf(
        L.portofolio.evaluasiBelumDitutup,
        { miring: true, rata: RATA_ISI },
      ),
    ];
  }

  return [
    judulBagian("F", L.portofolio.pengesahan),
    paragraf(
      `Evaluasi ditutup pada ${s.ditutupPada?.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })} oleh ${s.ditutupOleh ?? "—"}.`,
      { rata: RATA_ISI },
    ),
    paragraf([
      teks(L.portofolio.sidikDokumen),
      teks(sidikRingkas(s.sidik), { tebal: true }),
    ]),
    paragraf(
      L.portofolio.sidikDihitungSha256,
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
