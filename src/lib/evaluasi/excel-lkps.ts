import ExcelJS from "exceljs";
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

export async function buatTabelLkps(opsi: OpsiLkps): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RPKPS ITTS";
  wb.created = opsi.dibuatPada;

  lembarCapaian(wb, opsi);
  lembarTren(wb, opsi);
  lembarSebaran(wb, opsi);
  lembarRincian(wb, opsi);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function juduli(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function lembarCapaian(wb: ExcelJS.Workbook, opsi: OpsiLkps) {
  const ws = wb.addWorksheet("Capaian CPL");
  ws.columns = [
    { header: "CPL", key: "kode", width: 12 },
    { header: "Deskripsi", key: "deskripsi", width: 56 },
    { header: "Rerata (tertimbang sks)", key: "rerata", width: 22 },
    { header: "Mahasiswa lulus (%)", key: "lulus", width: 20 },
    { header: "Status", key: "status", width: 18 },
    { header: "MK terukur", key: "mk", width: 30 },
    { header: "Kelas tercapai / terukur", key: "kelas", width: 24 },
    { header: "Mahasiswa terukur", key: "n", width: 18 },
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
    kode: "Catatan",
    deskripsi:
      `Rerata ditimbang menurut sks mata kuliah (Capaian CPL Prodi = Σ(Capaian CPL(MK) × sks) / Σ sks). ` +
      `CPL dinyatakan tercapai bila ≥ ${opsi.ambangKetercapaian}% mahasiswa lulus. ` +
      `Hanya evaluasi berstatus DITUTUP yang dihitung.`,
  });
  ws.addRow({
    kode: "Cakupan",
    deskripsi:
      `${opsi.agregasi.ringkasan.mkDievaluasi} mata kuliah dievaluasi ` +
      `(${opsi.agregasi.ringkasan.cakupanPersen}% dari kurikulum ${opsi.kurikulum}), ` +
      `${opsi.agregasi.ringkasan.kelasDievaluasi} kelas.`,
  });
}

function lembarTren(wb: ExcelJS.Workbook, opsi: OpsiLkps) {
  const ws = wb.addWorksheet("Tren");

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
  ws.addRow({ kode: "Angka pada sel adalah persen mahasiswa yang lulus CPL tersebut." });
}

function lembarSebaran(wb: ExcelJS.Workbook, opsi: OpsiLkps) {
  const ws = wb.addWorksheet("Sebaran Kelas");
  ws.columns = [
    { header: "Mata Kuliah", key: "mk", width: 14 },
    { header: "CPL", key: "cpl", width: 12 },
    { header: "Tahun Akademik", key: "ta", width: 20 },
    { header: "Kelas tertinggi", key: "atas", width: 18 },
    { header: "%", key: "persenAtas", width: 10 },
    { header: "Kelas terendah", key: "bawah", width: 18 },
    { header: "%", key: "persenBawah", width: 10 },
    { header: "Selisih (poin)", key: "selisih", width: 16 },
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
    ws.addRow({ mk: "Tidak ada selisih antar kelas yang mencolok." });
  } else {
    ws.addRow({});
    ws.addRow({
      mk: "Rencana yang sama dengan hasil jauh berbeda menunjuk pelaksanaan, bukan rancangan.",
    });
  }
}

function lembarRincian(wb: ExcelJS.Workbook, opsi: OpsiLkps) {
  const ws = wb.addWorksheet("Rincian");
  ws.columns = [
    { header: "CPL", key: "cpl", width: 12 },
    { header: "Kode MK", key: "mkKode", width: 12 },
    { header: "Mata Kuliah", key: "mkNama", width: 34 },
    { header: "sks", key: "sks", width: 8 },
    { header: "Kelas", key: "kelas", width: 10 },
    { header: "Tahun Akademik", key: "ta", width: 20 },
    { header: "Rerata", key: "rerata", width: 12 },
    { header: "Lulus (%)", key: "lulus", width: 12 },
    { header: "Tercapai", key: "tercapai", width: 12 },
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
