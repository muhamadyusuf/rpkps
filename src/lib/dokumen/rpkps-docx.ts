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
  pemisahHalaman,
  RATA_ISI,
  sel,
  teks,
  UKURAN_JUDUL,
} from "./gaya";
import { formatMenit } from "@/domain/beban-belajar/kalkulator";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { tanggal as tanggalTeks } from "@/lib/bahasa/format";
import { namaLengkapPengampu } from "@/domain/rpkps/pemetaan";
import { rantaiPengesahan, type PeranPengesah } from "@/domain/rpkps/paraf";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import {
  jumlahPertemuanEfektif,
  minimalKehadiran,
  skalaNilai,
} from "@/domain/rpkps/cetak";
import { petaKomponenSubCpmk, susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";
import type { PeranTtd } from "@/generated/prisma";
import { labelDokumen, type LabelDokumen } from "./label";
import { LOCALE, type Bahasa } from "@/kamus";
// `isi` sudah dipakai sebagai nama variabel lokal di beberapa bagian.
import { isi as isi_ } from "@/lib/bahasa/teks";

/**
 * Menghasilkan dokumen RPKPS sesuai template ITTS (bagian A–J).
 * Acuan struktur: docs/02-template-itts-dan-penyelarasan-industri.md §1.1–1.2.
 *
 * Tabel mingguan memakai 7 kolom dengan L.penilaian bercabang tiga, bukan
 * 9 kolom datar seperti format generik Diktiristek. Halaman untuk tabel itu
 * dibuat mendatar (landscape) di bagian terpisah.
 */

function kepala(r: RpkpsLengkap, L: LabelDokumen) {
  return new Header({
    children: [
      paragraf(
        [teks(L.kodeDokumenFormRpkps, { ukuran: 14, warna: "6B7280" })],
        { spasi: { after: 0 } },
      ),
      paragraf(
        [
          teks(`${L.kepalaRencanaPembelajaran}${r.mataKuliah.nama}`, {
            ukuran: 14,
            warna: "6B7280",
          }),
        ],
        { spasi: { after: 60 } },
      ),
    ],
  });
}

function kaki(r: RpkpsLengkap, L: LabelDokumen) {
  const [tahun, semester] = r.tahunAkademik.kode.split("-");
  const namaSemester =
    semester === "GANJIL"
      ? L.excel.semesterGanjil
      : semester === "GENAP"
        ? L.excel.semesterGenap
        : L.excel.semesterAntara;
  return new Footer({
    children: [
      paragraf(
        [
          teks(
            isi_(L.excel.kakiHalaman, {
              prodi: r.mataKuliah.kurikulum.prodi.nama,
              semester: namaSemester,
              tahun: tahun ?? "",
            }),
            { ukuran: 14, warna: "6B7280" },
          ),
        ],
        { rata: AlignmentType.CENTER, spasi: { before: 60 } },
      ),
    ],
  });
}

/**
 * Satu baris tanda tangan sebagaimana dicetak: nama dan identitas yang
 * DIBEKUKAN saat menandatangani, bukan nama pemegang jabatan hari ini
 * (docs/14 §5).
 */
export interface CapTandaTangan {
  peran: PeranTtd;
  penggunaId: string;
  nama: string;
  identitas: string | null;
  sidik: string;
  ditandatanganiPada: Date;
}

function halamanPengesahan(
  r: RpkpsLengkap,
  L: LabelDokumen,
  ttd: readonly CapTandaTangan[],
  bahasa: Bahasa,
): (Paragraph | Table)[] {
  const koordinator = r.pengampu.find((p) => p.peran === "KOORDINATOR") ?? r.pengampu[0];
  const hari = (d: Date) => tanggalTeks(d, bahasa, "panjang");

  /*
   * Urutan ketiga blok datang dari `rantaiPengesahan`, bukan dari urutan
   * penulisan di sini: urutan itulah yang membuat halaman terbaca sebagai
   * rantai, dan ia hanya boleh ditulis di satu tempat.
   */
  const slot = new Map(
    rantaiPengesahan(
      ttd.map((t) => ({ ...t, versi: r.versi })),
      r.versi,
    ).map((x) => [x.peran, x.cap]),
  );

  /**
   * Satu blok tanda tangan. Yang belum ditandatangani tetap KOSONG — draf
   * boleh dicetak, ia hanya belum sah, dan halaman yang kosong itulah yang
   * mengatakannya. Mengarang nama pemegang jabatan hari ini di blok yang
   * belum dicap adalah persis yang dicegah seluruh rancangan ini.
   */
  const blok = (peran: PeranPengesah, jabatan: string, lebar: number) => {
    const t = slot.get(peran) ?? null;
    return {
      tanggal: sel(t ? `${L.tanggal} ${hari(t.ditandatanganiPada)}` : L.tanggal, { lebar }),
      nama: sel(
        [
          paragraf(t?.nama ?? "", { tebal: true, spasi: { after: 0 } }),
          paragraf(jabatan, { spasi: { after: 0 } }),
          ...(t
            ? [
                paragraf(
                  [
                    teks(`${L.ditandatanganiElektronik} · ${sidikRingkas(t.sidik)}`, {
                      ukuran: 13,
                      warna: "6B7280",
                    }),
                  ],
                  { spasi: { after: 0 } },
                ),
              ]
            : []),
        ],
        { lebar },
      ),
    };
  };

  const koordinatorBlok = blok("KOORDINATOR", L.koordinatorMataKuliah, 33);
  const kaprodiBlok = blok("KAPRODI", L.ketuaProgramStudi, 33);
  const mutuBlok = blok("PENJAMINAN_MUTU", L.kepalaPenjaminanMutuInternal, 34);

  const barisTim = r.pengampu.map((p, i) => {
    // Kolom "Tanda Tangan" pada tabel tim: tanggal paraf, bukan kotak kosong
    // untuk ditandatangani tangan (docs/14 §5).
    const paraf = ttd.find((t) => t.peran === "PENGAMPU" && t.penggunaId === p.penggunaId);
    return new TableRow({
      children: [
        sel(String(i + 1), { lebar: 8, rata: AlignmentType.CENTER }),
        sel(namaLengkapPengampu(p.pengguna), { lebar: 47 }),
        sel(p.pengguna.nidn ?? p.pengguna.nip ?? "", { lebar: 25 }),
        sel(paraf ? hari(paraf.ditandatanganiPada) : "", {
          lebar: 20,
          rata: AlignmentType.CENTER,
        }),
      ],
    });
  });
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
      [teks(L.rencanaProgramDanKegiatanPembelaja, { tebal: true, ukuran: 24 })],
      { rata: AlignmentType.CENTER, spasi: { after: 40 } },
    ),
    paragraf(
      [teks(L.institutTeknologiTangerangSelatan, { tebal: true, ukuran: 24 })],
      { rata: AlignmentType.CENTER, spasi: { after: 320 } },
    ),
    paragraf([teks(L.halamanPengesahan, { tebal: true, ukuran: UKURAN_JUDUL })], {
      rata: AlignmentType.CENTER,
      spasi: { after: 240 },
    }),

    paragraf([teks(L.namaMataKuliah2, { tebal: true }), teks(r.mataKuliah.nama)]),
    paragraf([teks(L.kodeMataKuliah, { tebal: true }), teks(r.mataKuliah.kode)]),
    paragraf([
      teks(L.koordinatorMataKuliah2, { tebal: true }),
      teks(koordinator ? namaLengkapPengampu(koordinator.pengguna) : "-"),
    ]),
    paragraf([teks(L.timDosenPengampu, { tebal: true })], { spasi: { after: 120 } }),

    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel(L.no, { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.namaDosen, { lebar: 47, tebal: true, latar: ABU }),
            sel(L.nidnNipNik, { lebar: 25, tebal: true, latar: ABU }),
            sel(L.tandaTangan, { lebar: 20, tebal: true, latar: ABU }),
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
            sel(L.aNTimPenyusunRpkps, { lebar: 33, tebal: true }),
            sel(L.disetujuiOleh, { lebar: 33, tebal: true }),
            sel(L.telahDiperiksaDanDinyatakanSesuaiD, {
              lebar: 34,
              tebal: true,
            }),
          ],
        }),
        new TableRow({
          children: [koordinatorBlok.tanggal, kaprodiBlok.tanggal, mutuBlok.tanggal],
        }),
        new TableRow({
          children: [
            sel([paragraf(""), paragraf(""), paragraf("")], { lebar: 33 }),
            sel([paragraf(""), paragraf(""), paragraf("")], { lebar: 33 }),
            sel([paragraf(""), paragraf(""), paragraf("")], { lebar: 34 }),
          ],
        }),
        new TableRow({
          children: [koordinatorBlok.nama, kaprodiBlok.nama, mutuBlok.nama],
        }),
      ],
    }),
    /**
     * Satu baris di kaki halaman pengesahan, hanya pada berkas Inggris:
     * naskah yang sah adalah yang berbahasa Indonesia. Untuk keperluan
     * akreditasi, yang diserahkan tetap berkas Indonesia (docs/11 §7).
     */
    ...(L.naskahSahIndonesia
      ? [
          paragraf([teks(L.naskahSahIndonesia, { ukuran: 14, warna: "6B7280" })], {
            rata: AlignmentType.CENTER,
            spasi: { before: 200 },
          }),
        ]
      : []),
  ];
}

function bagianAwal(r: RpkpsLengkap, L: LabelDokumen): (Paragraph | Table)[] {
  const sks = r.mataKuliah.sksTeori + r.mataKuliah.sksPraktik;
  const isi: (Paragraph | Table)[] = [
    paragraf(
      [teks(L.rencanaProgramDanKegiatanPembelaja, { tebal: true, ukuran: 24 })],
      { rata: AlignmentType.CENTER, spasi: { after: 40 } },
    ),
    paragraf([teks(L.institutTeknologiTangerangSelatan, { tebal: true, ukuran: 24 })], {
      rata: AlignmentType.CENTER,
      spasi: { after: 240 },
    }),

    paragraf([teks(L.namaMataKuliah, { tebal: true }), teks(r.mataKuliah.nama)]),
    paragraf([
      teks(L.kodeMkSks, { tebal: true }),
      teks(`${r.mataKuliah.kode} / ${sks} (${r.mataKuliah.sksTeori}T + ${r.mataKuliah.sksPraktik}P)`),
    ]),
    paragraf([teks(L.semester, { tebal: true }), teks(String(r.mataKuliah.semester))]),
    paragraf([teks(L.mkPrasyarat, { tebal: true }), teks("-")]),
    paragraf([
      teks(L.statusMatakuliah, { tebal: true }),
      /*
       * Template ITTS hanya mengenal dua nilai pada baris ini, jadi
       * `WAJIB_UMUM` ikut tercetak sebagai Wajib — sama seperti sebelumnya.
       * Yang berubah hanya bahasanya.
       */
      teks(r.mataKuliah.status === "PILIHAN" ? L.statusMkPilihan : L.statusMkWajib),
    ]),

    judulBagian("A", L.deskripsiMataKuliah),
    ...(r.deskripsi ? baris(r.deskripsi) : [paragraf(L.belumDiisi, { miring: true })]),

    judulBagian("B", L.capaianPembelajaran),
    paragraf(
      [teks(L.b1CapaianPembelajaranLulusanCpl, { tebal: true })],
      { spasi: { after: 100 } },
    ),
  ];

  const kkni = r.mataKuliah.cpl.map((m) => m.cpl).find(() => true);
  if (kkni) isi.push(paragraf([teks(L.tingkatKkni6)], { spasi: { after: 100 } }));

  for (const m of r.mataKuliah.cpl) {
    isi.push(
      paragraf([teks(`${m.cpl.kode}  `, { tebal: true }), teks(m.cpl.deskripsi)], {
        rata: RATA_ISI,
        spasi: { after: 80 },
      }),
    );
  }

  isi.push(
    paragraf([teks(L.b2CapaianPembelajaranMataKuliah, { tebal: true })], {
      spasi: { before: 160, after: 100 },
    }),
  );
  if (r.kalimatPembukaCpmk) isi.push(paragraf(r.kalimatPembukaCpmk, { rata: RATA_ISI }));
  for (const c of r.mataKuliah.cpmk) {
    isi.push(
      paragraf([teks(`${c.kode}  `, { tebal: true }), teks(c.rumusan)], {
        rata: RATA_ISI,
        spasi: { after: 80 },
      }),
    );
  }

  isi.push(
    paragraf([teks(L.b3SubCapaianPembelajaranMata, { tebal: true })], {
      spasi: { before: 160, after: 100 },
    }),
  );
  for (const c of r.mataKuliah.cpmk) {
    isi.push(paragraf([teks(c.kode, { tebal: true })], { spasi: { after: 60 } }));
    for (const s of c.subCpmk) {
      isi.push(
        paragraf([teks(`${s.kode}  `, { tebal: true }), teks(s.rumusan)], {
          rata: RATA_ISI,
          spasi: { after: 60 },
          indentasi: 240,
        }),
      );
    }
  }

  isi.push(
    judulBagian("C", L.analisisPembelajaran),
    paragraf(L.gambarTerlampir, { miring: true }),
  );

  // Bagian D diturunkan dari topik pertemuan efektif, bukan disimpan ganda.
  const topik = r.pertemuan
    .filter((p) => p.jenis === "EFEKTIF" && p.topik?.trim())
    .map((p) => p.topik!.trim());
  isi.push(judulBagian("D", L.topikPembelajaran));
  isi.push(
    ...(topik.length > 0
      ? daftarBernomor(topik)
      : [paragraf(L.belumAdaTopik, { miring: true })]),
  );

  return isi;
}

function bagianEvaluasi(r: RpkpsLengkap, L: LabelDokumen): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("E", L.evaluasiPembelajaran)];

  const pertemuanEfektif = jumlahPertemuanEfektif(r.pertemuan);
  const minimalHadir = minimalKehadiran(r.minimalKehadiranPersen, pertemuanEfektif);

  isi.push(
    ...daftarBernomor([
      L.aturanKehadiran,
      isi_(L.aturanMinimalHadir, {
        pertemuan: pertemuanEfektif,
        minimal: minimalHadir,
      }),
      L.nilaiAkhirDitentukan,
    ]),
  );

  for (const k of r.komponenNilai) {
    isi.push(
      paragraf(`•  ${k.nama} : ${Number(k.bobot)}%`, { indentasi: 480, spasi: { after: 20 } }),
    );
  }

  // Tabel distribusi penilaian: CPL x CPMK x Sub-CPMK x komponen.
  // Tanda centang diturunkan dari PETA ASESMEN, bukan langsung dari kaitan
  // pertemuan → komponen. Bedanya menentukan: Sub-CPMK yang diuji UTS/UAS
  // tersimpan di kisi-kisi, bukan di baris mingguan, sehingga penurunan
  // langsung membuat kolom ujian selalu kosong — dokumen lalu menyatakan
  // ujian tidak mengukur capaian apa pun. Di basis data yang tersimpan tetap
  // bobot numerik, bukan sekadar centang, agar ketercapaian CPMK dapat
  // dihitung (docs/02 §2.2 temuan W7; docs/05 §5.7).
  const komponen = r.komponenNilai;
  const petaSub = petaKomponenSubCpmk(susunPetaAsesmen(keSumberPeta(r)));

  isi.push(
    paragraf([teks(L.tabelDistribusiPenilaianCapaianPem, { tebal: true })], {
      spasi: { before: 200, after: 100 },
    }),
  );

  const lebarKomponen = Math.max(4, Math.floor(46 / Math.max(1, komponen.length)));
  const barisTabel: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        sel(L.cpl, { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
        sel(L.cpmk, { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
        sel(L.subCpmk, { lebar: 36, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
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
      barisTabel.push(
        new TableRow({
          children: [
            sel(i === 0 ? kodeCpl : "", { lebar: 8, rata: AlignmentType.CENTER }),
            sel(i === 0 ? c.kode : "", { lebar: 10, rata: AlignmentType.CENTER }),
            sel([paragraf(`${s.kode}  ${s.rumusan}`, { spasi: { after: 0 } })], { lebar: 36 }),
            ...komponen.map((k) =>
              sel(petaSub.get(k.nama)?.has(s.kode) ? "√" : "", {
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
    paragraf([teks(L.penilaianAkhir, { tebal: true })], { spasi: { before: 200, after: 100 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel(L.rentangSkor, { lebar: 25, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.nilaiHuruf, { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.nilaiAngka, { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.keterangan, { lebar: 35, tebal: true, latar: ABU }),
          ],
        }),
        ...skalaNilai(L.keteranganNilai).map((s) =>
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

    judulBagian("F", L.ambangBatasKelulusan),
    paragraf([
      teks(L.ambangBatasKelulusanMahasiswa, { tebal: true }),
      teks(String(Number(r.ambangKelulusanMhs))),
    ]),
    paragraf([
      teks(L.ambangBatasKelulusanMk, { tebal: true }),
      teks(`${Number(r.ambangKetercapaianMk).toFixed(2)}%`),
    ]),
  );

  return isi;
}

function bagianReferensi(r: RpkpsLengkap, L: LabelDokumen): (Paragraph | Table)[] {
  const isi: (Paragraph | Table)[] = [judulBagian("G", L.referensiDanSumberPembelajaran)];

  for (const jenis of ["UTAMA", "PENDUKUNG", "DARING", "TOOLS"] as const) {
    const daftar = r.pustaka.filter((p) => p.jenis === jenis);
    if (daftar.length === 0) continue;
    isi.push(
      paragraf([teks(`${L.jenisPustaka[jenis]} :`, { tebal: true })], {
        spasi: { before: 140, after: 80 },
      }),
    );
    for (const p of daftar) {
      isi.push(
        paragraf(`${p.nomor}. ${p.teks}${p.url ? ` — ${p.url}` : ""}`, {
          rata: RATA_ISI,
          spasi: { after: 40 },
          indentasi: 240,
        }),
      );
    }
  }

  if (r.pustaka.length === 0) isi.push(paragraf(L.belumAdaPustaka, { miring: true }));
  return isi;
}

/** Bagian H — tabel mingguan 7 kolom, halaman mendatar. */
function tabelMingguan(r: RpkpsLengkap, L: LabelDokumen): (Paragraph | Table)[] {
  const kepalaTabel = new TableRow({
    tableHeader: true,
    children: [
      sel(L.mingguKe, { lebar: 5, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel(L.subCapaianPembelajaranMataKuliahSu, { lebar: 16, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel(L.topikSubtopik, { lebar: 16, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel(L.metodeDanAktivitasPembelajaran, { lebar: 22, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel(L.alokasiWaktu, { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
      sel(L.penilaian, { lebar: 26, tebal: true, latar: ABU, rata: AlignmentType.CENTER, kolomGabung: 3 }),
      sel(L.referensi, { lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER, barisGabung: 2 }),
    ],
  });

  const subKepala = new TableRow({
    tableHeader: true,
    children: [
      sel(L.jenisPenilaianDanSistemPenilaian, { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
      sel(L.indikator, { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
      sel(L.bobot, { lebar: 4, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
    ],
  });

  const barisIsi = r.pertemuan.map((p) => {
    const sub = p.subCpmk.map((s) =>
      paragraf([teks(`${s.subCpmk.kode}  `, { tebal: true }), teks(s.subCpmk.rumusan)], {
        spasi: { after: 40 },
      }),
    );

    const topik: Paragraph[] = [];
    if (p.topik) topik.push(paragraf([teks(L.topik, { tebal: true }), teks(p.topik)]));
    if (p.subtopik.length > 0) {
      topik.push(paragraf([teks(L.subtopik, { tebal: true })], { spasi: { after: 20 } }));
      topik.push(...daftarBernomor(p.subtopik, { rata: AlignmentType.LEFT }));
    }

    const metode: Paragraph[] = [];
    if (p.metodeNarasi) {
      metode.push(paragraf([teks(L.metodePembelajaran, { tebal: true })], { spasi: { after: 20 } }));
      metode.push(...baris(p.metodeNarasi, { rata: AlignmentType.LEFT }));
    }
    if (p.aktivitasDosen || p.aktivitasMahasiswa) {
      metode.push(paragraf([teks(L.aktivitas, { tebal: true })], { spasi: { before: 60, after: 20 } }));
      if (p.aktivitasDosen) {
        metode.push(paragraf([teks(L.dosen, { tebal: true, miring: true }), teks(p.aktivitasDosen)]));
      }
      if (p.aktivitasMahasiswa) {
        metode.push(
          paragraf([teks(L.mahasiswa, { tebal: true, miring: true }), teks(p.aktivitasMahasiswa)]),
        );
      }
    }
    if (p.tugasTerstruktur) {
      metode.push(
        paragraf([teks(L.tugasPekerjaanTerstrukturPt, { tebal: true })], {
          spasi: { before: 60, after: 20 },
        }),
      );
      metode.push(...baris(p.tugasTerstruktur, { rata: AlignmentType.LEFT }));
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
      penilaian.push(paragraf([teks(L.penilaian2, { tebal: true })], { spasi: { after: 20 } }));
      penilaian.push(paragraf(p.penilaianJenis));
    }
    if (p.penilaianSistem) {
      penilaian.push(
        paragraf([teks(L.sistemPenilaian, { tebal: true })], { spasi: { before: 60, after: 20 } }),
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
    judulBagian("H", L.rencanaPembelajaranMingguan),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [kepalaTabel, subKepala, ...barisIsi],
    }),
  ];
}

/** Bagian I — Detail Tugas / Proyek. */
function bagianTugas(r: RpkpsLengkap, L: LabelDokumen): (Paragraph | Table)[] {
  if (r.tugas.length === 0) return [];

  const isi: (Paragraph | Table)[] = [judulBagian("I", L.detailTugasProyek)];

  for (const t of r.tugas) {
    const sub = t.subCpmk.map((x) => x.subCpmk.kode).join(", ");

    isi.push(
      paragraf([teks(`${t.nomor}. ${t.nama}`, { tebal: true, ukuran: UKURAN_JUDUL })], {
        spasi: { before: 200, after: 100 },
      }),
      paragraf([
        teks(L.nomorTugasProyek, { tebal: true }),
        teks(`${t.nomor},  Minggu : ${t.mingguMulai}-${t.mingguSelesai}`),
      ]),
      paragraf([teks(L.namaMataKuliah2, { tebal: true }), teks(r.mataKuliah.nama)]),
      paragraf([teks(L.kodeMataKuliah, { tebal: true }), teks(r.mataKuliah.kode)]),
      paragraf([
        teks(L.jenisTugasProyek, { tebal: true }),
        teks(t.jenis === "KELOMPOK" ? L.jenisTugasKelompok : L.jenisTugasIndividu),
      ]),
      paragraf([
        teks(L.bobot3, { tebal: true }),
        teks(
          `${Number(t.bobot)}%${t.komponenNilai ? ` (Komponen ${t.komponenNilai.nama})` : ""}`,
        ),
      ]),
      paragraf([teks(L.subCpmkTerkait, { tebal: true }), teks(sub || "-")]),
    );

    isi.push(
      paragraf([teks(L.deskripsiTugas, { tebal: true })], {
        spasi: { before: 140, after: 60 },
      }),
      ...baris(t.deskripsi),
    );

    if (t.uraianTugas) {
      isi.push(
        paragraf([teks(L.uraianTugas, { tebal: true })], {
          spasi: { before: 140, after: 60 },
        }),
        ...baris(t.uraianTugas),
      );
    }

    if (t.formatLuaran) {
      isi.push(
        paragraf([teks(L.formatDanLuaran, { tebal: true })], {
          spasi: { before: 140, after: 60 },
        }),
        ...baris(t.formatLuaran),
      );
    }

    if (t.kriteria.length > 0) {
      isi.push(
        paragraf([teks(L.indikatorKriteriaDanBobotPenilaian, { tebal: true })], {
          spasi: { before: 160, after: 100 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                sel(L.no, { lebar: 8, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
                sel(L.indikator, { lebar: 77, tebal: true, latar: ABU }),
                sel(L.bobot2, { lebar: 15, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
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
                sel(L.total, { lebar: 77, tebal: true, latar: ABU, rata: AlignmentType.RIGHT }),
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
        paragraf([teks(L.linimasaProyekTugas, { tebal: true })], {
          spasi: { before: 160, after: 100 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                sel(L.mingguKe, { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
                sel(L.tahapan, { lebar: 28, tebal: true, latar: ABU }),
                sel(L.deskripsiAktivitas, { lebar: 60, tebal: true, latar: ABU }),
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
        paragraf([teks(L.ketentuanLainnya, { tebal: true })], {
          spasi: { before: 160, after: 60 },
        }),
        ...baris(t.ketentuanLain),
      );
    }
  }

  return isi;
}

/** Lampiran — kisi-kisi UTS dan UAS. */
function lampiranKisiKisi(r: RpkpsLengkap, L: LabelDokumen): (Paragraph | Table)[] {
  if (r.kisiKisi.length === 0) return [];

  const isi: (Paragraph | Table)[] = [
    paragraf([teks(L.lampiranKisiKisiUjian, { tebal: true, ukuran: UKURAN_JUDUL })], {
      spasi: { before: 240, after: 120 },
    }),
  ];

  for (const k of r.kisiKisi) {
    const judul = k.jenis === "UTS" ? L.ujianTengahSemester : L.ujianAkhirSemester;
    isi.push(
      paragraf([teks(judul, { tebal: true })], { spasi: { before: 180, after: 60 } }),
      paragraf(
        [
          teks(isi_(L.totalSkorKisi, { skor: Number(k.totalSkor) })),
          ...(k.durasiMenit ? [teks(isi_(L.durasiKisi, { menit: k.durasiMenit ?? 0 }))] : []),
          ...(k.catatan ? [teks(` · ${k.catatan}`)] : []),
        ],
        { spasi: { after: 100 } },
      ),
    );

    if (k.butir.length === 0) {
      isi.push(paragraf(L.belumAdaButir, { miring: true }));
      continue;
    }

    isi.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              sel(L.no, { lebar: 6, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel(L.subCpmk2, { lebar: 16, tebal: true, latar: ABU }),
              sel(L.indikatorSoal, { lebar: 38, tebal: true, latar: ABU }),
              sel(L.level, { lebar: 10, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel(L.bentuk, { lebar: 16, tebal: true, latar: ABU }),
              sel(L.butir, { lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
              sel(L.skor, { lebar: 7, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            ],
          }),
          ...k.butir.map((b) =>
            new TableRow({
              children: [
                sel(String(b.nomor), { lebar: 6, rata: AlignmentType.CENTER }),
                sel(b.subCpmk.kode, { lebar: 16 }),
                sel(b.indikator ?? b.subCpmk.rumusan, { lebar: 38 }),
                sel(b.levelBloom, { lebar: 10, rata: AlignmentType.CENTER }),
                sel(L.bentukSoal[b.bentuk] ?? b.bentuk, { lebar: 16 }),
                sel(String(b.jumlahButir), { lebar: 7, rata: AlignmentType.CENTER }),
                sel(String(Number(b.skor)), { lebar: 7, rata: AlignmentType.CENTER }),
              ],
            }),
          ),
          new TableRow({
            children: [
              sel("", { lebar: 6, latar: ABU }),
              sel(L.total, { lebar: 80, tebal: true, latar: ABU, rata: AlignmentType.RIGHT, kolomGabung: 4 }),
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

function bagianRiwayat(
  r: RpkpsLengkap,
  riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[],
  L: LabelDokumen,
  bahasa: Bahasa,
) {
  return [
    judulBagian("J", L.historiRevisi),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            sel(L.kodeMk, { lebar: 15, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.noRevisi, { lebar: 12, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.tanggalBerlaku, { lebar: 20, tebal: true, latar: ABU, rata: AlignmentType.CENTER }),
            sel(L.deskripsiPerubahan, { lebar: 53, tebal: true, latar: ABU }),
          ],
        }),
        ...riwayat.map((h) =>
          new TableRow({
            children: [
              sel(r.mataKuliah.kode, { lebar: 15, rata: AlignmentType.CENTER }),
              sel(String(h.versi), { lebar: 12, rata: AlignmentType.CENTER }),
              sel(
                /*
                 * Kolom angka, bukan kalimat — karena itu `Intl` langsung dan
                 * bukan `tanggalTeks`. Yang tidak boleh tetap adalah
                 * LOCALE-nya: "06/02/2025" dibaca 6 Februari oleh pembaca
                 * Indonesia dan 2 Juni oleh pembaca Inggris, dan tabel histori
                 * revisi adalah tempat terakhir yang boleh ambigu.
                 */
                h.dibuatPada.toLocaleDateString(LOCALE[bahasa], {
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
  /**
   * Tanda tangan ronde yang dicetak. Terpisah dari `r` dan dari salinan beku:
   * baris tanda tangan adalah catatannya sendiri — tidak pernah berubah, dan
   * tidak ikut ruang sidik mana pun (docs/14 §2.6).
   */
  ttd: readonly CapTandaTangan[],
  /** Sidik salinan beku; hanya ada pada dokumen yang sudah terbit. */
  sidik?: string | null,
  /**
   * Bahasa cetak. Bawaannya Indonesia — dan itu bukan sekadar bawaan teknis:
   * naskah Indonesia adalah dokumen yang sah dan yang ditandatangani. Berkas
   * Inggris adalah terjemahan resmi yang menyatakan hal itu di halaman
   * pengesahannya (docs/11 §7).
   */
  bahasa: Bahasa = "id",
): Promise<Buffer> {
  const L = labelDokumen(bahasa);
  const potret = { width: 11906, height: 16838 }; // A4 dalam twip
  const mendatar = { width: 16838, height: 11906 };

  const dokumen = new Document({
    creator: "RPKPS ITTS",
    title: `RPKPS ${r.mataKuliah.kode} — ${r.mataKuliah.nama}`,
    sections: [
      {
        properties: { page: { size: potret, margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
        headers: { default: kepala(r, L) },
        footers: { default: kaki(r, L) },
        children: [
          ...halamanPengesahan(r, L, ttd, bahasa),
          paragraf("", { spasi: { after: 0 } }),
          ...(sidik
            ? [
                paragraf(
                  [
                    teks(L.dokumenIniDicetakDariSalinanResmi, {
                      ukuran: 14,
                      warna: "6B7280",
                    }),
                    teks(String(r.versi), { ukuran: 14, tebal: true, warna: "6B7280" }),
                    teks(isi_(L.sidikDokumen, { sidik: sidikRingkas(sidik) }), {
                      ukuran: 14,
                      warna: "6B7280",
                    }),
                  ],
                  { rata: AlignmentType.CENTER, spasi: { after: 160 } },
                ),
              ]
            : []),
          // Halaman pengesahan berdiri sendiri; bagian A dimulai di halaman baru.
          pemisahHalaman(),
          ...bagianAwal(r, L),
          ...bagianEvaluasi(r, L),
          ...bagianReferensi(r, L),
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
        headers: { default: kepala(r, L) },
        footers: { default: kaki(r, L) },
        children: [...tabelMingguan(r, L)],
      },
      {
        properties: { page: { size: potret, margin: { top: 850, bottom: 850, left: 850, right: 850 } } },
        headers: { default: kepala(r, L) },
        footers: { default: kaki(r, L) },
        children: [
          ...bagianTugas(r, L),
          ...lampiranKisiKisi(r, L),
          ...bagianRiwayat(r, riwayat, L, bahasa),
        ],
      },
    ],
  });

  return Packer.toBuffer(dokumen);
}
