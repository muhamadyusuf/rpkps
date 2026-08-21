import { formatMenit, susunRencanaSemester, bulatkan } from "@/domain/beban-belajar/kalkulator";
import { validasiPertemuan, validasiSemester } from "@/domain/beban-belajar/validator";
import type { Kebijakan, SpesifikasiMataKuliah } from "@/domain/beban-belajar/tipe";
import type { RpkpsInput, TemuanRpkps } from "./tipe";

/**
 * Validator RPKPS.
 *
 * Aturan di sini bukan hasil menebak-nebak: seluruhnya diturunkan dari temuan
 * nyata pada RPKPS ITTS TI214 (docs/02 §2). Kode temuan mengikuti penomoran
 * dokumen itu — B1–B6 pemblokir, W1–W7 peringatan — agar mudah dilacak balik.
 */

const TOLERANSI_BOBOT = 0.01; // toleransi pembulatan desimal

export interface HasilValidasiRpkps {
  temuan: TemuanRpkps[];
  pemblokir: TemuanRpkps[];
  peringatan: TemuanRpkps[];
  lolos: boolean;
  ringkasan: {
    totalBobotMingguan: number;
    totalBobotKomponen: number;
    jumlahPertemuan: number;
    jumlahTugas: number;
    subCpmkTerpakai: number;
    subCpmkTersedia: number;
    subCpmkBelumDijadwalkan: string[];
  };
}

export function validasiRpkps(
  rpkps: RpkpsInput,
  kebijakan: Kebijakan,
): HasilValidasiRpkps {
  const temuan: TemuanRpkps[] = [];

  const mk: SpesifikasiMataKuliah = {
    kode: rpkps.mkKode,
    nama: rpkps.mkNama,
    sksTeori: rpkps.sksTeori,
    sksPraktik: rpkps.sksPraktik,
    bentukTeori: "KULIAH",
    bentukPraktik: "PRAKTIKUM",
  };

  // ── B1 · total bobot mingguan harus 100% ────────────────────────────
  const totalBobotMingguan = bulatkan(
    rpkps.pertemuan.reduce((s, p) => s + p.bobot, 0),
    2,
  );
  if (Math.abs(totalBobotMingguan - 100) > TOLERANSI_BOBOT) {
    temuan.push({
      kode: "B1-BOBOT-MINGGUAN",
      tingkat: "PEMBLOKIR",
      pesan: `Total bobot pada tabel mingguan ${totalBobotMingguan}%, seharusnya 100%.`,
      saran:
        totalBobotMingguan > 100
          ? `Kurangi ${bulatkan(totalBobotMingguan - 100, 2)}% dari salah satu pertemuan.`
          : `Tambahkan ${bulatkan(100 - totalBobotMingguan, 2)}% lagi.`,
    });
  }

  // ── B2 · bobot mingguan harus rekonsiliasi dengan komponen nilai ────
  const totalBobotKomponen = bulatkan(
    rpkps.komponenNilai.reduce((s, k) => s + k.bobot, 0),
    2,
  );
  if (rpkps.komponenNilai.length === 0) {
    temuan.push({
      kode: "B2-KOMPONEN-KOSONG",
      tingkat: "PEMBLOKIR",
      pesan: "Belum ada komponen nilai (UTS, UAS, tugas, dan seterusnya).",
    });
  } else if (Math.abs(totalBobotKomponen - 100) > TOLERANSI_BOBOT) {
    temuan.push({
      kode: "B2-BOBOT-KOMPONEN",
      tingkat: "PEMBLOKIR",
      pesan: `Total bobot komponen nilai ${totalBobotKomponen}%, seharusnya 100%.`,
    });
  } else if (Math.abs(totalBobotMingguan - totalBobotKomponen) > TOLERANSI_BOBOT) {
    temuan.push({
      kode: "B2-TIDAK-REKONSILIASI",
      tingkat: "PEMBLOKIR",
      pesan:
        `Bobot mingguan berjumlah ${totalBobotMingguan}% sedangkan komponen nilai ` +
        `${totalBobotKomponen}%. Keduanya harus sama.`,
    });
  }

  // ── B3 · setiap Sub-CPMK harus terjadwal, dan sebaliknya ────────────
  const terpakai = new Set(rpkps.pertemuan.flatMap((p) => p.subCpmkKode));
  const tersedia = new Set(rpkps.subCpmkTersedia);

  const belumDijadwalkan = rpkps.subCpmkTersedia.filter((k) => !terpakai.has(k));
  if (belumDijadwalkan.length > 0) {
    temuan.push({
      kode: "B3-SUB-CPMK-TIDAK-DIJADWALKAN",
      tingkat: "PEMBLOKIR",
      pesan:
        `${belumDijadwalkan.length} Sub-CPMK tidak dijadwalkan pada pertemuan mana pun: ` +
        `${belumDijadwalkan.slice(0, 5).join(", ")}${belumDijadwalkan.length > 5 ? ", …" : ""}.`,
      saran: "Sub-CPMK yang tidak diajarkan tidak akan pernah dicapai mahasiswa.",
    });
  }

  for (const kode of terpakai) {
    if (!tersedia.has(kode)) {
      temuan.push({
        kode: "B3-SUB-CPMK-ASING",
        tingkat: "PEMBLOKIR",
        pesan: `Pertemuan merujuk ${kode}, yang bukan milik mata kuliah ini.`,
      });
    }
  }

  // ── B6 · struktur 16 minggu lengkap dan bernomor ────────────────────
  const nomorMinggu = rpkps.pertemuan.map((p) => p.minggu).sort((a, b) => a - b);
  const harusnya = Array.from({ length: kebijakan.mingguPerSemester }, (_, i) => i + 1);
  const hilang = harusnya.filter((m) => !nomorMinggu.includes(m));
  if (hilang.length > 0) {
    temuan.push({
      kode: "B6-MINGGU-HILANG",
      tingkat: "PEMBLOKIR",
      pesan: `Minggu ${hilang.join(", ")} belum ada pada tabel mingguan.`,
      saran: "Minggu ujian tetap harus muncul sebagai baris bernomor.",
    });
  }
  const ganda = nomorMinggu.filter((m, i) => nomorMinggu.indexOf(m) !== i);
  if (ganda.length > 0) {
    temuan.push({
      kode: "B6-MINGGU-GANDA",
      tingkat: "PEMBLOKIR",
      pesan: `Minggu ${[...new Set(ganda)].join(", ")} muncul lebih dari sekali.`,
    });
  }

  // ── Neraca waktu: lapis 1 per pertemuan, lapis 2 per semester ───────
  const rencana = susunRencanaSemester(kebijakan, mk);
  const paguPerMinggu = new Map(rencana.minggu.map((m) => [m.minggu, m.pagu]));

  let totalMenitTerpakai = 0;
  for (const p of rpkps.pertemuan) {
    const menit = p.aktivitas.reduce((s, a) => s + a.menit, 0);
    totalMenitTerpakai += menit;

    const pagu = paguPerMinggu.get(p.minggu);
    if (!pagu) continue;

    // B5 dan W-lain: kelebihan/kekurangan per pertemuan.
    for (const t of validasiPertemuan(
      pagu,
      p.aktivitas.map((a) => ({ kategori: a.kategori, menit: a.menit })),
      kebijakan.toleransiPertemuanPersen,
      p.minggu,
    )) {
      temuan.push({
        kode: t.kode,
        tingkat: t.tingkat === "PEMBLOKIR" ? "PEMBLOKIR" : "PERINGATAN",
        pesan: t.pesan,
        minggu: p.minggu,
      });
    }

    // B4 · menit di narasi metode harus sama dengan jumlah aktivitas.
    const menitNarasi = ekstrakMenitDariNarasi(p.metodeNarasi);
    if (menitNarasi !== null && menit > 0 && menitNarasi !== menit) {
      temuan.push({
        kode: "B4-NARASI-BEDA",
        tingkat: "PEMBLOKIR",
        minggu: p.minggu,
        pesan:
          `Minggu ${p.minggu}: narasi metode menyebut total ${formatMenit(menitNarasi)}, ` +
          `sedangkan aktivitas berjumlah ${formatMenit(menit)}.`,
        saran: "Samakan angka pada narasi dengan rincian aktivitas.",
      });
    }

    // Minggu ujian wajib punya alokasi waktu (docs/03 §2.1).
    if (p.jenis !== "EFEKTIF" && menit === 0 && pagu.total > 0) {
      temuan.push({
        kode: "B5-UJIAN-TANPA-ALOKASI",
        tingkat: "PEMBLOKIR",
        minggu: p.minggu,
        pesan:
          `Minggu ${p.minggu} (ujian) belum memiliki alokasi waktu. ` +
          `Pagunya ${formatMenit(pagu.total)} — persiapan ujian adalah beban belajar nyata.`,
      });
    }
  }

  // Lapis 2 dijalankan terhadap total yang BENAR-BENAR diisi dosen,
  // bukan terhadap pagu teoretis.
  const targetMenit = rencana.targetMenit;
  const selisih = totalMenitTerpakai - targetMenit;
  const selisihPersen = targetMenit === 0 ? 0 : bulatkan((selisih / targetMenit) * 100, 2);
  if (
    totalMenitTerpakai > 0 &&
    Math.abs(selisihPersen) > kebijakan.toleransiSemesterPersen
  ) {
    temuan.push({
      kode: "B5-SEMESTER",
      tingkat: "PEMBLOKIR",
      pesan:
        `Total beban semester ${bulatkan(totalMenitTerpakai / 60 / (rpkps.sksTeori + rpkps.sksPraktik), 2)} jam/sks, ` +
        `${selisih > 0 ? "melebihi" : "kurang dari"} target ${kebijakan.jamPerSksPerSemester} jam/sks. ` +
        `Selisih ${formatMenit(Math.abs(selisih))}.`,
    });
  }
  // Konsistensi kebijakan itu sendiri (mis. minggu ujian tidak dihitung).
  for (const t of validasiSemester(rencana, kebijakan)) {
    if (t.kode === "L2-UJIAN-TANPA-BEBAN") {
      temuan.push({ kode: t.kode, tingkat: "PEMBLOKIR", pesan: t.pesan });
    }
  }

  // ── Kelengkapan sembilan komponen wajib SN-Dikti ────────────────────
  if (!rpkps.deskripsi || rpkps.deskripsi.trim().length < 30) {
    temuan.push({
      kode: "B-DESKRIPSI",
      tingkat: "PEMBLOKIR",
      pesan: "Deskripsi mata kuliah belum diisi.",
    });
  }
  if (rpkps.cplKode.length === 0) {
    temuan.push({
      kode: "B-TANPA-CPL",
      tingkat: "PEMBLOKIR",
      pesan: "Tidak ada CPL yang dibebankan pada mata kuliah ini di kurikulum.",
    });
  }
  if (rpkps.jumlahPustakaUtama === 0) {
    temuan.push({
      kode: "B-TANPA-PUSTAKA",
      tingkat: "PEMBLOKIR",
      pesan: "Belum ada pustaka utama.",
    });
  }
  if (rpkps.jumlahPengampu === 0) {
    temuan.push({
      kode: "B-TANPA-PENGAMPU",
      tingkat: "PEMBLOKIR",
      pesan: "Belum ada dosen pengampu.",
    });
  }

  // ── Tugas / proyek (bagian I template ITTS) ─────────────────────────
  for (const t of rpkps.tugas) {
    const label = `Tugas ${t.nomor}`;

    // Bobot indikator penilaian tugas harus 100% terhadap tugas itu sendiri,
    // bukan terhadap nilai akhir mata kuliah.
    if (t.kriteria.length === 0) {
      temuan.push({
        kode: "I-TANPA-KRITERIA",
        tingkat: "PEMBLOKIR",
        pesan: `${label} (${t.nama}) belum punya indikator penilaian.`,
        saran: "Tanpa indikator berbobot, tugas tidak dapat dinilai secara konsisten.",
      });
    } else {
      const totalKriteria = bulatkan(t.kriteria.reduce((s, k) => s + k.bobot, 0), 2);
      if (Math.abs(totalKriteria - 100) > TOLERANSI_BOBOT) {
        temuan.push({
          kode: "I-BOBOT-KRITERIA",
          tingkat: "PEMBLOKIR",
          pesan: `Bobot indikator ${label} berjumlah ${totalKriteria}%, seharusnya 100%.`,
        });
      }
    }

    if (t.subCpmkKode.length === 0) {
      temuan.push({
        kode: "I-TANPA-SUB-CPMK",
        tingkat: "PERINGATAN",
        pesan: `${label} belum dikaitkan ke Sub-CPMK mana pun.`,
      });
    }
    for (const kode of t.subCpmkKode) {
      if (!tersedia.has(kode)) {
        temuan.push({
          kode: "I-SUB-CPMK-ASING",
          tingkat: "PEMBLOKIR",
          pesan: `${label} merujuk ${kode}, yang bukan milik mata kuliah ini.`,
        });
      }
    }

    if (t.mingguMulai < 1 || t.mingguSelesai > kebijakan.mingguPerSemester) {
      temuan.push({
        kode: "I-MINGGU-DILUAR",
        tingkat: "PEMBLOKIR",
        pesan:
          `${label} dijadwalkan minggu ${t.mingguMulai}–${t.mingguSelesai}, ` +
          `di luar rentang 1–${kebijakan.mingguPerSemester}.`,
      });
    } else if (t.mingguMulai > t.mingguSelesai) {
      temuan.push({
        kode: "I-MINGGU-TERBALIK",
        tingkat: "PEMBLOKIR",
        pesan: `${label}: minggu mulai (${t.mingguMulai}) melebihi minggu selesai (${t.mingguSelesai}).`,
      });
    }

    if (t.jumlahLinimasa === 0) {
      temuan.push({
        kode: "I-TANPA-LINIMASA",
        tingkat: "PERINGATAN",
        pesan: `${label} belum punya linimasa tahapan.`,
      });
    }

    if (t.deskripsi.trim().length < 30) {
      temuan.push({
        kode: "I-DESKRIPSI-PENDEK",
        tingkat: "PERINGATAN",
        pesan: `Deskripsi ${label} terlalu ringkas untuk dikerjakan mahasiswa.`,
      });
    }
  }

  // ── Peringatan tingkat pertemuan ────────────────────────────────────
  for (const p of rpkps.pertemuan) {
    if (p.jenis !== "EFEKTIF") continue;

    if (!p.topik?.trim()) {
      temuan.push({
        kode: "W-TANPA-TOPIK",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        pesan: `Minggu ${p.minggu} belum punya topik.`,
      });
    }
    if (p.subCpmkKode.length === 0) {
      temuan.push({
        kode: "W-TANPA-SUB-CPMK",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        pesan: `Minggu ${p.minggu} belum dikaitkan ke Sub-CPMK mana pun.`,
      });
    }
    if (p.indikator.length === 0 && p.bobot > 0) {
      temuan.push({
        kode: "W-TANPA-INDIKATOR",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        pesan: `Minggu ${p.minggu} punya bobot ${p.bobot}% tetapi belum ada indikator penilaian.`,
      });
    }
    if (p.bobot > 0 && !p.penilaianJenis?.trim()) {
      temuan.push({
        kode: "W-TANPA-BENTUK-NILAI",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        pesan: `Minggu ${p.minggu} punya bobot tetapi bentuk penilaiannya belum ditulis.`,
      });
    }
    if (p.pustakaNomor.length === 0) {
      temuan.push({
        kode: "W-TANPA-REFERENSI",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        pesan: `Minggu ${p.minggu} belum merujuk pustaka.`,
      });
    }
  }

  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");

  return {
    temuan,
    pemblokir,
    peringatan: temuan.filter((t) => t.tingkat === "PERINGATAN"),
    lolos: pemblokir.length === 0,
    ringkasan: {
      totalBobotMingguan,
      totalBobotKomponen,
      jumlahPertemuan: rpkps.pertemuan.length,
      jumlahTugas: rpkps.tugas.length,
    subCpmkTerpakai: terpakai.size,
      subCpmkTersedia: tersedia.size,
      subCpmkBelumDijadwalkan: belumDijadwalkan,
    },
  };
}

/**
 * Menarik total menit dari narasi metode, mis.
 *   "Tatap muka (sinkron, 120 menit) … asinkron, 360 menit"  -> 480
 *
 * Dipakai untuk aturan B4. Mengembalikan null bila tidak ada angka menit,
 * sehingga narasi tanpa angka tidak dianggap bertentangan.
 */
export function ekstrakMenitDariNarasi(narasi: string | null): number | null {
  if (!narasi) return null;
  const cocok = [...narasi.matchAll(/(\d{2,4})\s*menit/gi)];
  if (cocok.length === 0) return null;
  return cocok.reduce((s, m) => s + Number(m[1]), 0);
}
