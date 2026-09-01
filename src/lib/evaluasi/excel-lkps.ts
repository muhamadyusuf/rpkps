import ExcelJS from "exceljs";
import type { Bahasa } from "@/kamus";
import { labelDokumen, type LabelDokumen } from "@/lib/dokumen/label";
import type { BarisCapaian, HasilAgregasi } from "@/domain/evaluasi/agregasi";

/**
 * Tabel capaian CPL siap tempel untuk LKPS/LED — doc 05 tahap E5.
 *
 * Bentuknya sengaja lembar kerja, bukan dokumen: yang dibutuhkan penyusun
 * borang adalah angka yang bisa disalin dan diperiksa ulang, bukan halaman
 * bergaya. Lembar "Rincian" memuat baris asalnya supaya setiap angka agregat
 * dapat ditelusuri sampai ke kelas dan evaluasi yang menghasilkannya —
 * pertanyaan pertama asesor selalu "angka ini dari mana".
 *
 * Tanpa `server-only`: modul ini hanya menyusun workbook, sama seperti
 * `excel-nilai.ts` dan `rpkps-docx.ts`.
 */

export interface OpsiLkps {
  prodi: string;
  kurikulum: string;
  /** Deskripsi CPL, untuk kolom kedua tabel utama. */
  deskripsiCpl: Record<string, string>;
  ambangKetercapaian: number;
  agregasi: HasilAgregasi;
  baris: readonly BarisCapaian[];
  dibuatPada: Date;
}

export async function buatTabelLkps(
  opsi: OpsiLkps,
  bahasa: Bahasa = "id",
): Promise<Buffer> {
  const L = labelDokumen(bahasa);
  const wb = new ExcelJS.Workbook();
  wb.creator = "RPKPS ITTS";
  wb.created = opsi.dibuatPada;

  lembarCapaian(wb, opsi, L);
  lembarTren(wb, opsi, L);
  lembarSebaran(wb, opsi, L);
  lembarRincian(wb, opsi, L);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function juduli(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function lembarCapaian(wb: ExcelJS.Workbook, opsi: OpsiLkps, L: LabelDokumen) {
  const ws = wb.addWorksheet(L.lkps.lembarCapaian);
  ws.columns = [
    { header: "CPL", key: "kode", width: 12 },
    { header: L.lkps.deskripsi, key: "deskripsi", width: 56 },
    { header: L.lkps.rerataTertimbang, key: "rerata", width: 22 },
    { header: L.lkps.mahasiswaLulusPersen, key: "lulus", width: 20 },
    { header: L.lkps.status, key: "status", width: 18 },
    { header: L.lkps.mkTerukur, key: "mk", width: 30 },
    { header: L.lkps.kelasTercapaiTerukur, key: "kelas", width: 24 },
    { header: L.lkps.mahasiswaTerukur, key: "n", width: 18 },
  ];
  juduli(ws);

  for (const c of opsi.agregasi.cpl) {
    ws.addRow({
      kode: c.kode,
      deskripsi: opsi.deskripsiCpl[c.kode] ?? "",
      rerata: c.rerata ?? "—",
      lulus: c.persenLulus ?? "—",
      status:
        c.kelasTerukur === 0
          ? "belum terukur"
          : (c.persenLulus ?? 0) >= opsi.ambangKetercapaian
            ? "tercapai"
            : "belum tercapai",
      mk: c.mkTerukur.join(", "),
      kelas: `${c.kelasTercapai} / ${c.kelasTerukur}`,
      n: c.jumlahDinilai,
    });
  }

  ws.addRow({});
  ws.addRow({
    kode: L.lkps.catatan,
    deskripsi:
      `Rerata ditimbang menurut sks mata kuliah (Capaian CPL Prodi = Σ(Capaian CPL(MK) × sks) / Σ sks). ` +
      `CPL dinyatakan tercapai bila ≥ ${opsi.ambangKetercapaian}% mahasiswa lulus. ` +
      `Hanya evaluasi berstatus DITUTUP yang dihitung.`,
  });
  ws.addRow({
    kode: L.lkps.cakupan,
    deskripsi:
      `${opsi.agregasi.ringkasan.mkDievaluasi} mata kuliah dievaluasi ` +
      `(${opsi.agregasi.ringkasan.cakupanPersen}% dari kurikulum ${opsi.kurikulum}), ` +
      `${opsi.agregasi.ringkasan.kelasDievaluasi} kelas.`,
  });
}

function lembarTren(wb: ExcelJS.Workbook, opsi: OpsiLkps, L: LabelDokumen) {
  const ws = wb.addWorksheet(L.lkps.lembarTren);

  const ta = [
    ...new Set(
      [...opsi.agregasi.tren.values()].flat().map((t) => `${t.tahunMulai}|${t.tahunAkademik}`),
    ),
  ]
    .sort()
    .map((x) => x.split("|")[1]);

  ws.columns = [
    { header: "CPL", key: "kode", width: 12 },
    ...ta.map((t) => ({ header: t.replace("-", " "), key: t, width: 18 })),
  ];
  juduli(ws);

  for (const c of opsi.agregasi.cpl) {
    const titik = opsi.agregasi.tren.get(c.kode) ?? [];
    const baris: Record<string, string | number> = { kode: c.kode };
    for (const t of titik) {
      if (t.persenLulus !== null) baris[t.tahunAkademik] = t.persenLulus;
    }
    ws.addRow(baris);
  }

  ws.addRow({});
  ws.addRow({ kode: L.lkps.angkaSelPersen });
}

function lembarSebaran(wb: ExcelJS.Workbook, opsi: OpsiLkps, L: LabelDokumen) {
  const ws = wb.addWorksheet(L.lkps.lembarSebaran);
  ws.columns = [
    { header: L.lkps.mataKuliah, key: "mk", width: 14 },
    { header: "CPL", key: "cpl", width: 12 },
    { header: L.lkps.tahunAkademik, key: "ta", width: 20 },
    { header: L.lkps.kelasTertinggi, key: "atas", width: 18 },
    { header: "%", key: "persenAtas", width: 10 },
    { header: L.lkps.kelasTerendah, key: "bawah", width: 18 },
    { header: "%", key: "persenBawah", width: 10 },
    { header: L.lkps.selisihPoin, key: "selisih", width: 16 },
  ];
  juduli(ws);

  for (const s of opsi.agregasi.sebaran) {
    ws.addRow({
      mk: s.mkKode,
      cpl: s.cplKode,
      ta: s.tahunAkademik.replace("-", " "),
      atas: s.tertinggi.kelas,
      persenAtas: s.tertinggi.persenLulus,
      bawah: s.terendah.kelas,
      persenBawah: s.terendah.persenLulus,
      selisih: s.selisih,
    });
  }

  if (opsi.agregasi.sebaran.length === 0) {
    ws.addRow({ mk: L.lkps.tanpaSelisih });
  } else {
    ws.addRow({});
    ws.addRow({
      mk: L.lkps.selisihMenunjukPelaksanaan,
    });
  }
}

function lembarRincian(wb: ExcelJS.Workbook, opsi: OpsiLkps, L: LabelDokumen) {
  const ws = wb.addWorksheet(L.lkps.lembarRincian);
  ws.columns = [
    { header: "CPL", key: "cpl", width: 12 },
    { header: L.kodeMk, key: "mkKode", width: 12 },
    { header: L.lkps.mataKuliah, key: "mkNama", width: 34 },
    { header: "sks", key: "sks", width: 8 },
    { header: L.lkps.kelas, key: "kelas", width: 10 },
    { header: "Tahun Akademik", key: "ta", width: 20 },
    { header: L.lkps.rerata, key: "rerata", width: 12 },
    { header: L.lkps.lulusPersen, key: "lulus", width: 12 },
    { header: L.lkps.tercapai, key: "tercapai", width: 12 },
    { header: "Mahasiswa terukur", key: "n", width: 18 },
  ];
  juduli(ws);

  const urut = [...opsi.baris].sort(
    (a, b) =>
      a.cplKode.localeCompare(b.cplKode) ||
      a.tahunMulai - b.tahunMulai ||
      a.mkKode.localeCompare(b.mkKode) ||
      a.kelas.localeCompare(b.kelas),
  );

  for (const b of urut) {
    ws.addRow({
      cpl: b.cplKode,
      mkKode: b.mkKode,
      mkNama: b.mkNama,
      sks: b.sks,
      kelas: b.kelas,
      ta: b.tahunAkademik.replace("-", " "),
      rerata: b.rerata ?? "—",
      lulus: b.persenLulus ?? "—",
      tercapai: b.jumlahDinilai === 0 ? "—" : b.tercapai ? "ya" : "tidak",
      n: b.jumlahDinilai,
    });
  }
}
