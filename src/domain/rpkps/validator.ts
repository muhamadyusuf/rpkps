import {
  posisiMingguUjian,
  susunRencanaSemester,
  bulatkan,
} from "@/domain/beban-belajar/kalkulator";
import { validasiPertemuan, validasiSemester } from "@/domain/beban-belajar/validator";
import type { Kebijakan, SpesifikasiMataKuliah } from "@/domain/beban-belajar/tipe";
import type { RpkpsInput, TemuanRpkps } from "./tipe";
import { daftarRingkas } from "@/domain/temuan";

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
      params: {
        total: totalBobotMingguan,
        selisih: bulatkan(Math.abs(totalBobotMingguan - 100), 2),
      },
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
    });
  } else if (Math.abs(totalBobotKomponen - 100) > TOLERANSI_BOBOT) {
    temuan.push({
      kode: "B2-BOBOT-KOMPONEN",
      tingkat: "PEMBLOKIR",
      params: { total: totalBobotKomponen },
    });
  } else if (Math.abs(totalBobotMingguan - totalBobotKomponen) > TOLERANSI_BOBOT) {
    temuan.push({
      kode: "B2-TIDAK-REKONSILIASI",
      tingkat: "PEMBLOKIR",
      params: { mingguan: totalBobotMingguan, komponen: totalBobotKomponen },
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
      params: {
        jumlah: belumDijadwalkan.length,
        daftar: daftarRingkas(belumDijadwalkan),
      },
    });
  }

  for (const kode of terpakai) {
    if (!tersedia.has(kode)) {
      temuan.push({
        kode: "B3-SUB-CPMK-ASING",
        tingkat: "PEMBLOKIR",
        params: { kode },
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
      params: { daftar: hilang.join(", ") },
    });
  }
  const ganda = nomorMinggu.filter((m, i) => nomorMinggu.indexOf(m) !== i);
  if (ganda.length > 0) {
    temuan.push({
      kode: "B6-MINGGU-GANDA",
      tingkat: "PEMBLOKIR",
      params: { daftar: [...new Set(ganda)].join(", ") },
    });
  }

  /**
   * Baris di luar rentang semester — mungkin sejak dosen menyusun tabelnya
   * sendiri (docs/09 §K6). PERINGATAN, bukan pemblokir: pertemuan pengganti
   * memang ada. Menitnya tetap dihitung, jadi kelebihan bebannya tertangkap
   * B5-SEMESTER sebagai pemblokir tersendiri.
   */
  const berlebih = nomorMinggu.filter((m) => m > kebijakan.mingguPerSemester);
  if (berlebih.length > 0) {
    temuan.push({
      kode: "W-MINGGU-BERLEBIH",
      tingkat: "PERINGATAN",
      params: {
        daftar: [...new Set(berlebih)].join(", "),
        minggu: kebijakan.mingguPerSemester,
      },
    });
  }

  /**
   * Posisi ujian pilihan dosen boleh berbeda dari pola kebijakan — kalender
   * akademik prodi kadang memang menggesernya (docs/09 §K5). Yang tetap
   * memblokir adalah B5-UJIAN-TANPA-ALOKASI di bawah.
   */
  const posisiUjian = posisiMingguUjian(kebijakan);
  const ujianGeser = rpkps.pertemuan
    .filter((p) => p.jenis !== "EFEKTIF" && !posisiUjian.includes(p.minggu))
    .map((p) => `${p.jenis} di minggu ${p.minggu}`);
  if (ujianGeser.length > 0 && posisiUjian.length > 0) {
    temuan.push({
      kode: "W-UJIAN-DI-LUAR-POSISI",
      tingkat: "PERINGATAN",
      params: { daftar: ujianGeser.join(", "), posisi: posisiUjian.join(" dan ") },
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
        params: t.params,
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
        params: {
          minggu: p.minggu,
          narasi: { menit: menitNarasi },
          aktivitas: { menit },
        },
      });
    }

    // Minggu ujian wajib punya alokasi waktu (docs/03 §2.1).
    if (p.jenis !== "EFEKTIF" && menit === 0 && pagu.total > 0) {
      temuan.push({
        kode: "B5-UJIAN-TANPA-ALOKASI",
        tingkat: "PEMBLOKIR",
        minggu: p.minggu,
        params: { minggu: p.minggu, pagu: { menit: pagu.total } },
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
      kode: selisih > 0 ? "B5-SEMESTER-LEBIH" : "B5-SEMESTER-KURANG",
      tingkat: "PEMBLOKIR",
      params: {
        jam: bulatkan(totalMenitTerpakai / 60 / (rpkps.sksTeori + rpkps.sksPraktik), 2),
        target: kebijakan.jamPerSksPerSemester,
        selisih: { menit: Math.abs(selisih) },
      },
    });
  }
  // Konsistensi kebijakan itu sendiri (mis. minggu ujian tidak dihitung).
  for (const t of validasiSemester(rencana, kebijakan)) {
    if (t.kode === "L2-UJIAN-TANPA-BEBAN") {
      temuan.push({ kode: t.kode, tingkat: "PEMBLOKIR", params: t.params });
    }
  }

  // ── Kelengkapan sembilan komponen wajib SN-Dikti ────────────────────
  if (!rpkps.deskripsi || rpkps.deskripsi.trim().length < 30) {
    temuan.push({
      kode: "B-DESKRIPSI",
      tingkat: "PEMBLOKIR",
    });
  }
  if (rpkps.cplKode.length === 0) {
    temuan.push({
      kode: "B-TANPA-CPL",
      tingkat: "PEMBLOKIR",
    });
  }
  if (rpkps.jumlahPustakaUtama === 0) {
    temuan.push({
      kode: "B-TANPA-PUSTAKA",
      tingkat: "PEMBLOKIR",
    });
  }
  if (rpkps.jumlahPengampu === 0) {
    temuan.push({
      kode: "B-TANPA-PENGAMPU",
      tingkat: "PEMBLOKIR",
    });
  } else if (rpkps.pengampuBelumParaf.length > 0) {
    /**
     * Rantai pengesahan tahap pertama (docs/14 §2.2). Ditegakkan di sini,
     * bukan dengan mematikan tombol Ajukan: dosen harus melihat siapa yang
     * masih ditunggu, bukan menemukan tombol yang tidak bereaksi.
     */
    const belum = rpkps.pengampuBelumParaf;
    temuan.push({
      kode: "B-PARAF-BELUM-LENGKAP",
      tingkat: "PEMBLOKIR",
      params: { jumlah: belum.length, daftar: daftarRingkas(belum, 3) },
    });
  }

  // ── Tugas / proyek (bagian I template ITTS) ─────────────────────────
  /**
   * Batas jadwal tugas adalah minggu TERAKHIR YANG ADA di tabel, bukan angka
   * kebijakan. Sejak tabel mingguan dapat disusun manual (docs/09 §K6),
   * pertemuan di luar 16 minggu hanya berstatus peringatan — memblokir tugas
   * yang menunjuk minggu itu berarti dua aturan yang saling bertentangan atas
   * baris yang sama.
   */
  const mingguTerakhir = Math.max(
    kebijakan.mingguPerSemester,
    ...rpkps.pertemuan.map((p) => p.minggu),
  );

  for (const t of rpkps.tugas) {
    const label = `Tugas ${t.nomor}`;

    // Bobot indikator penilaian tugas harus 100% terhadap tugas itu sendiri,
    // bukan terhadap nilai akhir mata kuliah.
    if (t.kriteria.length === 0) {
      temuan.push({
        kode: "I-TANPA-KRITERIA",
        tingkat: "PEMBLOKIR",
        params: { label, nama: t.nama },
      });
    } else {
      const totalKriteria = bulatkan(t.kriteria.reduce((s, k) => s + k.bobot, 0), 2);
      if (Math.abs(totalKriteria - 100) > TOLERANSI_BOBOT) {
        temuan.push({
          kode: "I-BOBOT-KRITERIA",
          tingkat: "PEMBLOKIR",
          params: { label, total: totalKriteria },
        });
      }
    }

    if (t.subCpmkKode.length === 0) {
      temuan.push({
        kode: "I-TANPA-SUB-CPMK",
        tingkat: "PERINGATAN",
        params: { label },
      });
    }
    for (const kode of t.subCpmkKode) {
      if (!tersedia.has(kode)) {
        temuan.push({
          kode: "I-SUB-CPMK-ASING",
          tingkat: "PEMBLOKIR",
          params: { label, kode },
        });
      }
    }

    if (t.mingguMulai < 1 || t.mingguSelesai > mingguTerakhir) {
      temuan.push({
        kode: "I-MINGGU-DILUAR",
        tingkat: "PEMBLOKIR",
        params: {
          label,
          mulai: t.mingguMulai,
          selesai: t.mingguSelesai,
          terakhir: mingguTerakhir,
        },
      });
    } else if (t.mingguMulai > t.mingguSelesai) {
      temuan.push({
        kode: "I-MINGGU-TERBALIK",
        tingkat: "PEMBLOKIR",
        params: { label, mulai: t.mingguMulai, selesai: t.mingguSelesai },
      });
    }

    if (t.jumlahLinimasa === 0) {
      temuan.push({
        kode: "I-TANPA-LINIMASA",
        tingkat: "PERINGATAN",
        params: { label },
      });
    }

    if (t.deskripsi.trim().length < 30) {
      temuan.push({
        kode: "I-DESKRIPSI-PENDEK",
        tingkat: "PERINGATAN",
        params: { label },
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
        params: { minggu: p.minggu },
      });
    }
    if (p.subCpmkKode.length === 0) {
      temuan.push({
        kode: "W-TANPA-SUB-CPMK",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        params: { minggu: p.minggu },
      });
    }
    if (p.indikator.length === 0 && p.bobot > 0) {
      temuan.push({
        kode: "W-TANPA-INDIKATOR",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        params: { minggu: p.minggu, bobot: p.bobot },
      });
    }
    if (p.bobot > 0 && !p.penilaianJenis?.trim()) {
      temuan.push({
        kode: "W-TANPA-BENTUK-NILAI",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        params: { minggu: p.minggu },
      });
    }
    if (p.pustakaNomor.length === 0) {
      temuan.push({
        kode: "W-TANPA-REFERENSI",
        tingkat: "PERINGATAN",
        minggu: p.minggu,
        params: { minggu: p.minggu },
      });
    }
  }

  /**
   * Dokumen setengah-Inggris lebih membingungkan daripada dokumen yang
   * seluruhnya Indonesia — pembaca tidak tahu bagian mana yang belum
   * diterjemahkan dan mana yang memang berbeda. Peringatan, bukan pemblokir:
   * terjemahan opsional, dan menahan dokumen yang sah karena fitur tambahan
   * adalah cara tercepat membuat fitur itu dibenci.
   */
  if (rpkps.terjemahanSebagian) {
    temuan.push({ kode: "W8-TERJEMAHAN-PARSIAL", tingkat: "PERINGATAN" });
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
