import {
  AlignmentType,
  Document,
  Footer,
  Header,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableRow,
  WidthType,
} from "docx";
import {
  ABU,
  baris,
  daftarBernomor,
  judulBagian,
  paragraf,
  sel,
  teks,
  UKURAN_JUDUL,
} from "./gaya";
import { formatMenit } from "@/domain/beban-belajar/kalkulator";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { namaLengkapPengampu } from "@/domain/rpkps/pemetaan";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";

/**
 * Menghasilkan dokumen RPKPS sesuai template ITTS (bagian A–J).
 * Acuan struktur: docs/02-template-itts-dan-penyelarasan-industri.md §1.1–1.2.
 *
 * Tabel mingguan memakai 7 kolom dengan "Penilaian" bercabang tiga, bukan
 * 9 kolom datar seperti format generik Diktiristek. Halaman untuk tabel itu
 * dibuat mendatar (landscape) di bagian terpisah.
 */

const LABEL_JENIS_PUSTAKA: Record<string, string> = {
  UTAMA: "Sumber Utama",
  PENDUKUNG: "Sumber Pendukung",
  DARING: "Sumber Belajar Daring",
  TOOLS: "Perangkat Lunak dan Tools Praktikum",
};

function kepala(r: RpkpsLengkap) {
  return new Header({
    children: [
      paragraf(
        [teks("KODE DOKUMEN : FORM RPKPS", { ukuran: 14, warna: "6B7280" })],
        { spasi: { after: 0 } },
      ),
      paragraf(
        [teks(`Rencana Pembelajaran : ${r.mataKuliah.nama}`, { ukuran: 14, warna: "6B7280" })],
        { spasi: { after: 60 } },
      ),
    ],
  });
}

function kaki(r: RpkpsLengkap) {
  const [tahun, semester] = r.tahunAkademik.kode.split("-");
  const namaSemester = semester === "GANJIL" ? "Ganjil" : semester === "GENAP" ? "Genap" : "Antara";
  return new Footer({
    children: [
      paragraf(
        [
          teks(
            `${r.mataKuliah.kurikulum.prodi.nama} - ITTS    Tahun Akademik : ${namaSemester} ${tahun}`,
            { ukuran: 14, warna: "6B7280" },
          ),
        ],
        { rata: AlignmentType.CENTER, spasi: { before: 60 } },
      ),
    ],
  });
}

function halamanPengesahan(r: RpkpsLengkap): (Paragraph | Table)[] {
  const koordinator = r.pengampu.find((p) => p.peran === "KOORDINATOR") ?? r.pengampu[0];

  const barisTim = r.pengampu.map((p, i) =>
    new TableRow({
      children: [
        sel(String(i + 1), { lebar: 8, rata: AlignmentType.CENTER }),
        sel(namaLengkapPengampu(p.pengguna), { lebar: 47 }),
        sel(p.pengguna.nidn ?? p.pengguna.nip ?? "", { lebar: 25 }),
        sel("", { lebar: 20 }),
      ],
    }),
  );
  // Template ITTS menyediakan lima baris tim dosen.
  for (let i = r.pengampu.length; i < 5; i += 1) {
    barisTim.push(
      new TableRow({
        children: [
          sel(String(i + 1), { lebar: 8, rata: AlignmentType.CENTER }),
          sel("", { lebar: 47 }),
          sel("", { lebar: 25 }),
          sel("", { lebar: 20 }),
        ],
      }),
    );
  }

  return [
    paragraf(
      [teks("RENCANA PROGRAM DAN KEGIATAN PEMBELAJARAN SEMESTER (RPKPS)", { tebal: true, ukuran: 24 })],
      { rata: AlignmentType.CENTER, spasi: { after: 40 } },
    ),
    paragraf(
      [teks("INSTITUT TEKNOLOGI TANGERANG SELATAN", { tebal: true, ukuran: 24 })],
      { rata: AlignmentType.CENTER, spasi: { after: 320 } },
    ),
    paragraf([teks("HALAMAN PENGESAHAN", { tebal: true, ukuran: UKURAN_JUDUL })], {
      rata: AlignmentType.CENTER,
      spasi: { after: 240 },
    }),

    paragraf([teks("Nama Mata Kuliah\t: ", { tebal: true }), teks(r.mataKuliah.nama)]),
    paragraf([teks("Kode Mata Kuliah\t: ", { tebal: true }), teks(r.mataKuliah.kode)]),
    paragraf([
      teks("Koordinator Mata Kuliah\t: ", { tebal: true }),
      teks(koordinator ? namaLengkapPengampu(koordinator.pengguna) : "-"),
    ]),
    paragraf([teks("Tim Dosen Pengampu\t:", { tebal: true })], { spasi: { after: 120 } }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel("No.", { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("Nama Dosen", { lebar: 47, tebal: true, latar: ABU }),
            sel("NIDN / NIP / NIK", { lebar: 25, tebal: true, latar: ABU }),
            sel("Tanda Tangan", { lebar: 20, tebal: true, latar: ABU }),
          ],
        }),
        ...barisTim,
      ],
    }),

    paragraf("", { spasi: { after: 320 } }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            sel("a.n Tim penyusun RPKPS", { lebar: 33, tebal: true }),
            sel("Disetujui oleh,", { lebar: 33, tebal: true }),
            sel("Telah diperiksa dan dinyatakan sesuai dengan standar ITTS", {
              lebar: 34,
              tebal: true,
            }),
          ],
        }),
        new TableRow({
          children: [
            sel("Tanggal :", { lebar: 33 }),
            sel("Tanggal :", { lebar: 33 }),
            sel("Tanggal :", { lebar: 34 }),
          ],
        }),
        new TableRow({
          children: [
            sel([paragraf(""), paragraf(""), paragraf("")], { lebar: 33 }),
            sel([paragraf(""), paragraf(""), paragraf("")], { lebar: 33 }),
            sel([paragraf(""), paragraf(""), paragraf("")], { lebar: 34 }),
          ],
        }),
        new TableRow({
          children: [
            sel(
              [
                paragraf(koordinator ? namaLengkapPengampu(koordinator.pengguna) : "", {
                  tebal: true,
                  spasi: { after: 0 },
                }),
                paragraf("Koordinator Mata Kuliah", { spasi: { after: 0 } }),
              ],
              { lebar: 33 },
            ),
            sel(
              [paragraf("", { spasi: { after: 0 } }), paragraf("Ketua Program Studi", { spasi: { after: 0 } })],
              { lebar: 33 },
            ),
            sel(
              [
                paragraf("", { spasi: { after: 0 } }),
                paragraf("Kepala Penjaminan Mutu Internal", { spasi: { after: 0 } }),
              ],
              { lebar: 34 },
            ),
          ],
        }),
      ],
    }),
  ];
}

function bagianAwal(r: RpkpsLengkap): (Paragraph | Table)[] {
  const sks = r.mataKuliah.sksTeori + r.mataKuliah.sksPraktik;
  const isi: (Paragraph | Table)[] = [
    paragraf(
      [teks("RENCANA PROGRAM DAN KEGIATAN PEMBELAJARAN SEMESTER (RPKPS)", { tebal: true, ukuran: 24 })],
      { rata: AlignmentType.CENTER, spasi: { after: 40 } },
    ),
    paragraf([teks("INSTITUT TEKNOLOGI TANGERANG SELATAN", { tebal: true, ukuran: 24 })], {
      rata: AlignmentType.CENTER,
      spasi: { after: 240 },
    }),

    paragraf([teks("NAMA MATA KULIAH\t: ", { tebal: true }), teks(r.mataKuliah.nama)]),
    paragraf([
      teks("KODE MK / SKS\t: ", { tebal: true }),
      teks(`${r.mataKuliah.kode} / ${sks} (${r.mataKuliah.sksTeori}T + ${r.mataKuliah.sksPraktik}P)`),
    ]),
    paragraf([teks("SEMESTER\t: ", { tebal: true }), teks(String(r.mataKuliah.semester))]),
    paragraf([teks("MK PRASYARAT\t: ", { tebal: true }), teks("-")]),
    paragraf([
      teks("STATUS MATAKULIAH\t: ", { tebal: true }),
      teks(r.mataKuliah.status === "PILIHAN" ? "Pilihan" : "Wajib"),
    ]),

    judulBagian("A", "DESKRIPSI MATA KULIAH"),
    ...(r.deskripsi ? baris(r.deskripsi) : [paragraf("(belum diisi)", { miring: true })]),

    judulBagian("B", "CAPAIAN PEMBELAJARAN"),
    paragraf(
      [teks("B.1  Capaian Pembelajaran Lulusan (CPL) Program Studi yang Terkait dengan Mata Kuliah", { tebal: true })],
      { spasi: { after: 100 } },
    ),
  ];

  const kkni = r.mataKuliah.cpl.map((m) => m.cpl).find(() => true);
  if (kkni) isi.push(paragraf([teks("Tingkat KKNI: 6")], { spasi: { after: 100 } }));

  for (const m of r.mataKuliah.cpl) {
    isi.push(
      paragraf([teks(`${m.cpl.kode}  `, { tebal: true }), teks(m.cpl.deskripsi)], {
        spasi: { after: 80 },
      }),
    );
  }

  isi.push(
    paragraf([teks("B.2  Capaian Pembelajaran Mata Kuliah (CPMK)", { tebal: true })], {
      spasi: { before: 160, after: 100 },
    }),
  );
  if (r.kalimatPembukaCpmk) isi.push(paragraf(r.kalimatPembukaCpmk));
  for (const c of r.mataKuliah.cpmk) {
    isi.push(
      paragraf([teks(`${c.kode}  `, { tebal: true }), teks(c.rumusan)], { spasi: { after: 80 } }),
    );
  }

  isi.push(
    paragraf([teks("B.3  Sub Capaian Pembelajaran Mata Kuliah (Sub-CPMK)", { tebal: true })], {
      spasi: { before: 160, after: 100 },
    }),
  );
  for (const c of r.mataKuliah.cpmk) {
    isi.push(paragraf([teks(c.kode, { tebal: true })], { spasi: { after: 60 } }));
    for (const s of c.subCpmk) {
      isi.push(
        paragraf([teks(`${s.kode}  `, { tebal: true }), teks(s.rumusan)], {
          spasi: { after: 60 },
          indentasi: 240,
        }),
      );
    }
  }

  isi.push(
    judulBagian("C", "ANALISIS PEMBELAJARAN"),
    paragraf("- Gambar Terlampir -", { miring: true }),
  );

  // Bagian D diturunkan dari topik pertemuan efektif, bukan disimpan ganda.
  const topik = r.pertemuan
    .filter((p) => p.jenis === "EFEKTIF" && p.topik?.trim())
    .map((p) => p.topik!.trim());
  isi.push(judulBagian("D", "TOPIK PEMBELAJARAN"));
  isi.push(
    ...(topik.length > 0
      ? daftarBernomor(topik)
      : [paragraf("(belum ada topik)", { miring: true })]),
  );

  return isi;
}

function bagianEvaluasi(r: RpkpsLengkap): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("E", "EVALUASI PEMBELAJARAN")];

  const pertemuanEfektif = r.pertemuan.filter((p) => p.jenis === "EFEKTIF").length;
  const minimalHadir = Math.ceil((r.minimalKehadiranPersen / 100) * pertemuanEfektif);

  isi.push(
    ...daftarBernomor([
      "Kehadiran tepat waktu dalam perkuliahan adalah wajib. Mahasiswa akan dianggap tidak hadir apabila datang melebihi waktu yang telah ditentukan.",
      `Mengikuti ${pertemuanEfektif} kali pertemuan perkuliahan adalah wajib. Mahasiswa harus hadir minimal ${minimalHadir} dari ${pertemuanEfektif} pertemuan untuk dapat mengikuti ujian akhir.`,
      "Nilai akhir ditentukan berdasarkan komponen berikut:",
    ]),
  );

  for (const k of r.komponenNilai) {
    isi.push(
      paragraf(`•  ${k.nama} : ${Number(k.bobot)}%`, { indentasi: 480, spasi: { after: 20 } }),
    );
  }

  // Tabel distribusi penilaian: CPL x CPMK x Sub-CPMK x komponen.
  // Tanda centang diturunkan dari kaitan pertemuan ke komponen nilai — di
  // basis data tersimpan sebagai bobot numerik, bukan sekadar centang, agar
  // ketercapaian CPMK dapat dihitung (lihat docs/02 §2.2 temuan W7).
  const komponen = r.komponenNilai;
  const petaSub = new Map<string, Set<string>>();
  for (const p of r.pertemuan) {
    if (!p.komponenNilaiId) continue;
    for (const s of p.subCpmk) {
      const set = petaSub.get(s.subCpmk.id) ?? new Set<string>();
      set.add(p.komponenNilaiId);
      petaSub.set(s.subCpmk.id, set);
    }
  }

  isi.push(
    paragraf([teks("Tabel: Distribusi Penilaian Capaian Pembelajaran", { tebal: true })], {
      spasi: { before: 200, after: 100 },
    }),
  );

  const lebarKomponen = Math.max(4, Math.floor(46 / Math.max(1, komponen.length)));
  const barisTabel: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        sel("CPL", { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
        sel("CPMK", { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
        sel("SUB-CPMK", { lebar: 36, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
        ...komponen.map((k) =>
          sel(`${k.nama} (${Number(k.bobot)}%)`, {
            lebar: lebarKomponen,
            tebal: true,
            latar: ABU,
            rata: AlignmentType.CENTER,
          }),
        ),
      ],
    }),
  ];

  for (const c of r.mataKuliah.cpmk) {
    const kodeCpl = c.cpl.map((x) => x.cpl.kode).join(", ");
    for (const [i, s] of c.subCpmk.entries()) {
      const dipakai = petaSub.get(s.id) ?? new Set<string>();
      barisTabel.push(
        new TableRow({
          children: [
            sel(i === 0 ? kodeCpl : "", { lebar: 8, rata: AlignmentType.CENTER }),
            sel(i === 0 ? c.kode : "", { lebar: 10, rata: AlignmentType.CENTER }),
            sel([paragraf(`${s.kode}  ${s.rumusan}`, { spasi: { after: 0 } })], { lebar: 36 }),
            ...komponen.map((k) =>
              sel(dipakai.has(k.id) ? "√" : "", {
                lebar: lebarKomponen,
                rata: AlignmentType.CENTER,
              }),
            ),
          ],
        }),
      );
    }
  }

  isi.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: barisTabel }));

  isi.push(
    paragraf([teks("PENILAIAN AKHIR :", { tebal: true })], { spasi: { before: 200, after: 100 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel("RENTANG SKOR", { lebar: 25, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("NILAI HURUF", { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("NILAI ANGKA", { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("KETERANGAN", { lebar: 35, tebal: true, latar: ABU }),
          ],
        }),
        ...SKALA_NILAI.map((s) =>
          new TableRow({
            children: [
              sel(s.rentang, { lebar: 25, rata: AlignmentType.CENTER }),
              sel(s.huruf, { lebar: 20, rata: AlignmentType.CENTER }),
              sel(s.angka, { lebar: 20, rata: AlignmentType.CENTER }),
              sel(s.keterangan, { lebar: 35 }),
            ],
          }),
        ),
      ],
    }),

    judulBagian("F", "AMBANG BATAS KELULUSAN"),
    paragraf([
      teks("Ambang Batas Kelulusan Mahasiswa\t: ", { tebal: true }),
      teks(String(Number(r.ambangKelulusanMhs))),
    ]),
    paragraf([
      teks("Ambang Batas Kelulusan MK\t: ", { tebal: true }),
      teks(`${Number(r.ambangKetercapaianMk).toFixed(2)}%`),
    ]),
  );

  return isi;
}

const SKALA_NILAI = [
  { rentang: "85 – 100", huruf: "A", angka: "4", keterangan: "Sangat Baik" },
  { rentang: "80 – 84,99", huruf: "A-", angka: "3,7", keterangan: "Baik" },
  { rentang: "75 – 79,99", huruf: "B+", angka: "3,3", keterangan: "" },
  { rentang: "70 – 74,99", huruf: "B", angka: "3,0", keterangan: "" },
  { rentang: "65 – 69,99", huruf: "B-", angka: "2,7", keterangan: "Memuaskan" },
  { rentang: "60 – 64,99", huruf: "C+", angka: "2,3", keterangan: "" },
  { rentang: "55 – 59,99", huruf: "C", angka: "2,0", keterangan: "" },
  { rentang: "45 – 54,99", huruf: "D", angka: "1,0", keterangan: "Kurang Memuaskan" },
  { rentang: "0 – 44,99", huruf: "E", angka: "0", keterangan: "Sangat Tidak Memuaskan" },
];

function bagianReferensi(r: RpkpsLengkap): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("G", "REFERENSI DAN SUMBER PEMBELAJARAN")];

  for (const jenis of ["UTAMA", "PENDUKUNG", "DARING", "TOOLS"] as const) {
    const daftar = r.pustaka.filter((p) => p.jenis === jenis);
    if (daftar.length === 0) continue;
    isi.push(
      paragraf([teks(`${LABEL_JENIS_PUSTAKA[jenis]} :`, { tebal: true })], {
        spasi: { before: 140, after: 80 },
      }),
    );
    for (const p of daftar) {
      isi.push(
        paragraf(`${p.nomor}. ${p.teks}${p.url ? ` — ${p.url}` : ""}`, {
          spasi: { after: 40 },
          indentasi: 240,
        }),
      );
    }
  }

  if (r.pustaka.length === 0) isi.push(paragraf("(belum ada pustaka)", { miring: true }));
  return isi;
}

/** Bagian H — tabel mingguan 7 kolom, halaman mendatar. */
function tabelMingguan(r: RpkpsLengkap): (Paragraph | Table)[] {
  const kepalaTabel = new TableRow({
    tableHeader: true,
    children: [
      sel("Minggu ke", { lebar: 5, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel("Sub-Capaian Pembelajaran Mata Kuliah (Sub-CPMK)", { lebar: 16, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel("Topik & Subtopik", { lebar: 16, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel("Metode dan Aktivitas Pembelajaran", { lebar: 22, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel("Alokasi Waktu", { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel("Penilaian", { lebar: 26, tebal: true, latar: ABU, rata: AlignmentType.CENTER, kolomGabung: 3 }),
      sel("Referensi", { lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
    ],
  });

  const subKepala = new TableRow({
    tableHeader: true,
    children: [
      sel("Jenis Penilaian dan Sistem Penilaian", { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
      sel("Indikator", { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
      sel("Bobot", { lebar: 4, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
    ],
  });

  const barisIsi = r.pertemuan.map((p) => {
    const sub = p.subCpmk.map((s) =>
      paragraf([teks(`${s.subCpmk.kode}  `, { tebal: true }), teks(s.subCpmk.rumusan)], {
        spasi: { after: 40 },
      }),
    );

    const topik: Paragraph[] = [];
    if (p.topik) topik.push(paragraf([teks("Topik: ", { tebal: true }), teks(p.topik)]));
    if (p.subtopik.length > 0) {
      topik.push(paragraf([teks("Subtopik:", { tebal: true })], { spasi: { after: 20 } }));
      topik.push(...daftarBernomor(p.subtopik));
    }

    const metode: Paragraph[] = [];
    if (p.metodeNarasi) {
      metode.push(paragraf([teks("Metode Pembelajaran:", { tebal: true })], { spasi: { after: 20 } }));
      metode.push(...baris(p.metodeNarasi));
    }
    if (p.aktivitasDosen || p.aktivitasMahasiswa) {
      metode.push(paragraf([teks("Aktivitas:", { tebal: true })], { spasi: { before: 60, after: 20 } }));
      if (p.aktivitasDosen) {
        metode.push(paragraf([teks("Dosen: ", { tebal: true, miring: true }), teks(p.aktivitasDosen)]));
      }
      if (p.aktivitasMahasiswa) {
        metode.push(
          paragraf([teks("Mahasiswa: ", { tebal: true, miring: true }), teks(p.aktivitasMahasiswa)]),
        );
      }
    }
    if (p.tugasTerstruktur) {
      metode.push(
        paragraf([teks("Tugas / Pekerjaan Terstruktur (PT):", { tebal: true })], {
          spasi: { before: 60, after: 20 },
        }),
      );
      metode.push(...baris(p.tugasTerstruktur));
    }

    const per = (k: "TM" | "PT" | "BM") =>
      p.aktivitas.filter((a) => a.kategori === k).reduce((s, a) => s + a.menit, 0);
    const waktu = [
      paragraf(`TM: ${per("TM")}′`, { spasi: { after: 20 } }),
      paragraf(`PT: ${per("PT")}′`, { spasi: { after: 20 } }),
      paragraf(`BM: ${per("BM")}′`, { spasi: { after: 20 } }),
      paragraf(formatMenit(per("TM") + per("PT") + per("BM")), {
        tebal: true,
        spasi: { before: 40 },
      }),
    ];

    const penilaian: Paragraph[] = [];
    if (p.penilaianJenis) {
      penilaian.push(paragraf([teks("Penilaian:", { tebal: true })], { spasi: { after: 20 } }));
      penilaian.push(paragraf(p.penilaianJenis));
    }
    if (p.penilaianSistem) {
      penilaian.push(
        paragraf([teks("Sistem Penilaian:", { tebal: true })], { spasi: { before: 60, after: 20 } }),
      );
      penilaian.push(paragraf(p.penilaianSistem));
    }

    const referensi = p.pustaka.map((x) =>
      paragraf(`• [${x.pustaka.nomor}]`, { spasi: { after: 20 } }),
    );

    return new TableRow({
      children: [
        sel(String(p.minggu), { lebar: 5, rata: AlignmentType.CENTER, tebal: true }),
        sel(sub, { lebar: 16 }),
        sel(topik, { lebar: 16 }),
        sel(metode, { lebar: 22 }),
        sel(waktu, { lebar: 8, rata: AlignmentType.CENTER }),
        sel(penilaian, { lebar: 12 }),
        sel(p.indikator.map((i) => paragraf(i.teks, { spasi: { after: 20 } })), { lebar: 10 }),
        sel(`${Number(p.bobot)}%`, { lebar: 4, rata: AlignmentType.CENTER }),
        sel(referensi, { lebar: 7 }),
      ],
    });
  });

  return [
    judulBagian("H", "RENCANA PEMBELAJARAN MINGGUAN"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [kepalaTabel, subKepala, ...barisIsi],
    }),
  ];
}

/** Bagian I — Detail Tugas / Proyek. */
function bagianTugas(r: RpkpsLengkap): (Paragraph | Table)[] {
  if (r.tugas.length === 0) return [];

  const isi: (Paragraph | Table)[] = [judulBagian("I", "DETAIL TUGAS / PROYEK")];

  for (const t of r.tugas) {
    const sub = t.subCpmk.map((x) => x.subCpmk.kode).join(", ");

    isi.push(
      paragraf([teks(`${t.nomor}. ${t.nama}`, { tebal: true, ukuran: UKURAN_JUDUL })], {
        spasi: { before: 200, after: 100 },
      }),
      paragraf([
        teks("Nomor Tugas / Proyek\t: ", { tebal: true }),
        teks(`${t.nomor},  Minggu : ${t.mingguMulai}-${t.mingguSelesai}`),
      ]),
      paragraf([teks("Nama Mata Kuliah\t: ", { tebal: true }), teks(r.mataKuliah.nama)]),
      paragraf([teks("Kode Mata Kuliah\t: ", { tebal: true }), teks(r.mataKuliah.kode)]),
      paragraf([
        teks("Jenis Tugas / Proyek\t: ", { tebal: true }),
        teks(t.jenis === "KELOMPOK" ? "Group Project" : "Tugas Individu"),
      ]),
      paragraf([
        teks("Bobot\t: ", { tebal: true }),
        teks(
          `${Number(t.bobot)}%${t.komponenNilai ? ` (Komponen ${t.komponenNilai.nama})` : ""}`,
        ),
      ]),
      paragraf([teks("Sub-CPMK Terkait\t: ", { tebal: true }), teks(sub || "-")]),
    );

    isi.push(
      paragraf([teks("Deskripsi Tugas", { tebal: true })], {
        spasi: { before: 140, after: 60 },
      }),
      ...baris(t.deskripsi),
    );

    if (t.uraianTugas) {
      isi.push(
        paragraf([teks("Uraian Tugas", { tebal: true })], {
          spasi: { before: 140, after: 60 },
        }),
        ...baris(t.uraianTugas),
      );
    }

    if (t.formatLuaran) {
      isi.push(
        paragraf([teks("Format dan Luaran", { tebal: true })], {
          spasi: { before: 140, after: 60 },
        }),
        ...baris(t.formatLuaran),
      );
    }

    if (t.kriteria.length > 0) {
      isi.push(
        paragraf([teks("Indikator, Kriteria, dan Bobot Penilaian", { tebal: true })], {
          spasi: { before: 160, after: 100 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                sel("No.", { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
                sel("Indikator", { lebar: 77, tebal: true, latar: ABU }),
                sel("Bobot (%)", { lebar: 15, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              ],
            }),
            ...t.kriteria.map((k) =>
              new TableRow({
                children: [
                  sel(String(k.nomor), { lebar: 8, rata: AlignmentType.CENTER }),
                  sel(
                    [
                      paragraf(k.indikator, { tebal: true, spasi: { after: 20 } }),
                      ...k.rincian.map((d) =>
                        paragraf(`•  ${d}`, { spasi: { after: 20 }, indentasi: 120 }),
                      ),
                    ],
                    { lebar: 77 },
                  ),
                  sel(`${Number(k.bobot)}%`, { lebar: 15, rata: AlignmentType.CENTER }),
                ],
              }),
            ),
            new TableRow({
              children: [
                sel("", { lebar: 8, latar: ABU }),
                sel("Total", { lebar: 77, tebal: true, latar: ABU, rata: AlignmentType.RIGHT }),
                sel(
                  `${t.kriteria.reduce((a, k) => a + Number(k.bobot), 0)}%`,
                  { lebar: 15, tebal: true, latar: ABU, rata: AlignmentType.CENTER },
                ),
              ],
            }),
          ],
        }),
      );
    }

    if (t.linimasa.length > 0) {
      isi.push(
        paragraf([teks("Linimasa Proyek / Tugas", { tebal: true })], {
          spasi: { before: 160, after: 100 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                sel("Minggu ke", { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
                sel("Tahapan", { lebar: 28, tebal: true, latar: ABU }),
                sel("Deskripsi Aktivitas", { lebar: 60, tebal: true, latar: ABU }),
              ],
            }),
            ...t.linimasa.map((l) =>
              new TableRow({
                children: [
                  sel(String(l.minggu), { lebar: 12, rata: AlignmentType.CENTER }),
                  sel(l.tahapan, { lebar: 28 }),
                  sel(l.aktivitas, { lebar: 60 }),
                ],
              }),
            ),
          ],
        }),
      );
    }

    if (t.ketentuanLain) {
      isi.push(
        paragraf([teks("Ketentuan Lainnya", { tebal: true })], {
          spasi: { before: 160, after: 60 },
        }),
        ...baris(t.ketentuanLain),
      );
    }
  }

  return isi;
}

const LABEL_BENTUK_SOAL: Record<string, string> = {
  PILIHAN_GANDA: "Pilihan ganda",
  ESAI: "Esai",
  URAIAN_SINGKAT: "Uraian singkat",
  STUDI_KASUS: "Studi kasus",
  PRAKTIK: "Praktik",
  PROYEK: "Proyek",
  LISAN: "Lisan",
};

/** Lampiran — kisi-kisi UTS dan UAS. */
function lampiranKisiKisi(r: RpkpsLengkap): (Paragraph | Table)[] {
  if (r.kisiKisi.length === 0) return [];

  const isi: (Paragraph | Table)[] = [
    paragraf([teks("LAMPIRAN — KISI-KISI UJIAN", { tebal: true, ukuran: UKURAN_JUDUL })], {
      spasi: { before: 240, after: 120 },
    }),
  ];

  for (const k of r.kisiKisi) {
    const judul = k.jenis === "UTS" ? "Ujian Tengah Semester" : "Ujian Akhir Semester";
    isi.push(
      paragraf([teks(judul, { tebal: true })], { spasi: { before: 180, after: 60 } }),
      paragraf(
        [
          teks(`Total skor ${Number(k.totalSkor)}`),
          ...(k.durasiMenit ? [teks(` · durasi ${k.durasiMenit} menit`)] : []),
          ...(k.catatan ? [teks(` · ${k.catatan}`)] : []),
        ],
        { spasi: { after: 100 } },
      ),
    );

    if (k.butir.length === 0) {
      isi.push(paragraf("(belum ada butir)", { miring: true }));
      continue;
    }

    isi.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              sel("No.", { lebar: 6, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel("Sub-CPMK", { lebar: 16, tebal: true, latar: ABU }),
              sel("Indikator soal", { lebar: 38, tebal: true, latar: ABU }),
              sel("Level", { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel("Bentuk", { lebar: 16, tebal: true, latar: ABU }),
              sel("Butir", { lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel("Skor", { lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            ],
          }),
          ...k.butir.map((b) =>
            new TableRow({
              children: [
                sel(String(b.nomor), { lebar: 6, rata: AlignmentType.CENTER }),
                sel(b.subCpmk.kode, { lebar: 16 }),
                sel(b.indikator ?? b.subCpmk.rumusan, { lebar: 38 }),
                sel(b.levelBloom, { lebar: 10, rata: AlignmentType.CENTER }),
                sel(LABEL_BENTUK_SOAL[b.bentuk] ?? b.bentuk, { lebar: 16 }),
                sel(String(b.jumlahButir), { lebar: 7, rata: AlignmentType.CENTER }),
                sel(String(Number(b.skor)), { lebar: 7, rata: AlignmentType.CENTER }),
              ],
            }),
          ),
          new TableRow({
            children: [
              sel("", { lebar: 6, latar: ABU }),
              sel("Total", { lebar: 80, tebal: true, latar: ABU, rata: AlignmentType.RIGHT, kolomGabung: 4 }),
              sel(String(k.butir.reduce((s, b) => s + b.jumlahButir, 0)), {
                lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER,
              }),
              sel(String(k.butir.reduce((s, b) => s + Number(b.skor), 0)), {
                lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
    );
  }

  return isi;
}

function bagianRiwayat(r: RpkpsLengkap, riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[]) {
  return [
    judulBagian("J", "HISTORI REVISI"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel("Kode MK", { lebar: 15, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("No. Revisi", { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("Tanggal Berlaku", { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel("Deskripsi Perubahan", { lebar: 53, tebal: true, latar: ABU }),
          ],
        }),
        ...riwayat.map((h) =>
          new TableRow({
            children: [
              sel(r.mataKuliah.kode, { lebar: 15, rata: AlignmentType.CENTER }),
              sel(String(h.versi), { lebar: 12, rata: AlignmentType.CENTER }),
              sel(
                h.dibuatPada.toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                }),
                { lebar: 20, rata: AlignmentType.CENTER },
              ),
              sel(h.deskripsi, { lebar: 53 }),
            ],
          }),
        ),
      ],
    }),
  ];
}

export async function buatDokumenRpkps(
  r: RpkpsLengkap,
  riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[],
  /** Sidik salinan beku; hanya ada pada dokumen yang sudah terbit. */
  sidik?: string | null,
): Promise<Buffer> {
  const potret = { width: 11906, height: 16838 }; // A4 dalam twip
  const mendatar = { width: 16838, height: 11906 };

  const dokumen = new Document({
    creator: "RPKPS ITTS",
    title: `RPKPS ${r.mataKuliah.kode} — ${r.mataKuliah.nama}`,
    sections: [
      {
        properties: { page: { size: potret, margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
        headers: { default: kepala(r) },
        footers: { default: kaki(r) },
        children: [
          ...halamanPengesahan(r),
          paragraf("", { spasi: { after: 0 } }),
          ...(sidik
            ? [
                paragraf(
                  [
                    teks("Dokumen ini dicetak dari salinan resmi versi ", {
                      ukuran: 14,
                      warna: "6B7280",
                    }),
                    teks(String(r.versi), { ukuran: 14, tebal: true, warna: "6B7280" }),
                    teks(`. Sidik dokumen: ${sidikRingkas(sidik)}`, {
                      ukuran: 14,
                      warna: "6B7280",
                    }),
                  ],
                  { rata: AlignmentType.CENTER, spasi: { after: 160 } },
                ),
              ]
            : []),
          ...bagianAwal(r),
          ...bagianEvaluasi(r),
          ...bagianReferensi(r),
        ],
      },
      {
        // Tabel mingguan butuh halaman mendatar agar tujuh kolomnya terbaca.
        properties: {
          page: {
            size: { ...mendatar, orientation: PageOrientation.LANDSCAPE },
            margin: { top: 700, bottom: 700, left: 700, right: 700 },
          },
        },
        headers: { default: kepala(r) },
        footers: { default: kaki(r) },
        children: [...tabelMingguan(r)],
      },
      {
        properties: { page: { size: potret, margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
        headers: { default: kepala(r) },
        footers: { default: kaki(r) },
        children: [
          ...bagianTugas(r),
          ...lampiranKisiKisi(r),
          ...bagianRiwayat(r, riwayat),
        ],
      },
    ],
  });

  return Packer.toBuffer(dokumen);
}
