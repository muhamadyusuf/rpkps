import { bandingkanLevel, infoLevel, type LevelBloom } from "@/domain/kurikulum/bloom";
import { bulatkan } from "@/domain/beban-belajar/kalkulator";
import type { TemuanRpkps } from "./tipe";

/**
 * Validator kisi-kisi ujian.
 * Acuan: docs/00-konsep-rpkps.md §3.5.
 *
 * Tujuannya satu: memastikan ujian benar-benar mengukur apa yang diajarkan.
 * Kisi-kisi yang tidak menyentuh sebagian Sub-CPMK berarti ada tahapan belajar
 * yang diajarkan tetapi tidak pernah diuji.
 */

export type JenisUjian = "UTS" | "UAS";

export interface ButirKisiKisi {
  nomor: number;
  subCpmkKode: string;
  levelBloom: LevelBloom;
  jumlahButir: number;
  skor: number;
}

export interface KisiKisiInput {
  jenis: JenisUjian;
  totalSkor: number;
  butir: ButirKisiKisi[];
}

export interface KonteksKisiKisi {
  /** Sub-CPMK yang dijadwalkan sebelum UTS (minggu 1 sampai minggu UTS). */
  subCpmkSebelumUts: string[];
  /** Sub-CPMK yang dijadwalkan setelah UTS. */
  subCpmkSetelahUts: string[];
  /** Level Bloom tiap Sub-CPMK menurut kurikulum. */
  levelSubCpmk: Record<string, LevelBloom | null>;
  /** Bobot mingguan tiap Sub-CPMK, untuk memeriksa proporsi. */
  bobotSubCpmk: Record<string, number>;
}

export interface HasilValidasiKisiKisi {
  temuan: TemuanRpkps[];
  pemblokir: TemuanRpkps[];
  peringatan: TemuanRpkps[];
  lolos: boolean;
  ringkasan: {
    totalSkor: number;
    jumlahButir: number;
    subCpmkTercakup: number;
    subCpmkSeharusnya: number;
    sebaranBloom: Record<string, number>;
  };
}

const TOLERANSI_SKOR = 0.01;
/** Selisih proporsi yang masih dianggap wajar antara bobot ajar dan bobot uji. */
const TOLERANSI_PROPORSI = 15;

export function validasiKisiKisi(
  k: KisiKisiInput,
  konteks: KonteksKisiKisi,
): HasilValidasiKisiKisi {
  const temuan: TemuanRpkps[] = [];
  const label = k.jenis;

  const seharusnya =
    k.jenis === "UTS" ? konteks.subCpmkSebelumUts : konteks.subCpmkSetelahUts;
  const setSeharusnya = new Set(seharusnya);
  const tercakup = new Set(k.butir.map((b) => b.subCpmkKode));

  // ── Total skor ──────────────────────────────────────────────────────
  const totalButir = bulatkan(k.butir.reduce((s, b) => s + b.skor, 0), 2);
  if (k.butir.length === 0) {
    temuan.push({
      kode: "KK-KOSONG",
      tingkat: "PEMBLOKIR",
      pesan: `Kisi-kisi ${label} belum memiliki butir.`,
    });
  } else if (Math.abs(totalButir - k.totalSkor) > TOLERANSI_SKOR) {
    temuan.push({
      kode: "KK-TOTAL-SKOR",
      tingkat: "PEMBLOKIR",
      pesan:
        `Total skor butir ${label} berjumlah ${totalButir}, ` +
        `seharusnya ${k.totalSkor}.`,
    });
  }

  for (const b of k.butir) {
    if (b.jumlahButir < 1) {
      temuan.push({
        kode: "KK-JUMLAH-BUTIR",
        tingkat: "PEMBLOKIR",
        pesan: `Baris ${b.nomor} pada ${label} memiliki jumlah butir kurang dari satu.`,
      });
    }
    if (b.skor <= 0) {
      temuan.push({
        kode: "KK-SKOR-NOL",
        tingkat: "PEMBLOKIR",
        pesan: `Baris ${b.nomor} pada ${label} berskor nol — butir tanpa skor tidak mengukur apa pun.`,
      });
    }
  }

  // ── Cakupan Sub-CPMK ────────────────────────────────────────────────
  const belum = seharusnya.filter((kode) => !tercakup.has(kode));
  if (belum.length > 0) {
    temuan.push({
      kode: "KK-SUB-CPMK-TIDAK-DIUJI",
      tingkat: "PEMBLOKIR",
      pesan:
        `${belum.length} Sub-CPMK diajarkan sebelum ${label} tetapi tidak diuji: ` +
        `${belum.slice(0, 5).join(", ")}${belum.length > 5 ? ", …" : ""}.`,
      saran: "Tambahkan butir untuk Sub-CPMK tersebut, atau pindahkan ke ujian yang lain.",
    });
  }

  // Menguji materi yang belum diajarkan pada saat ujian berlangsung.
  const semuaSah = new Set([...konteks.subCpmkSebelumUts, ...konteks.subCpmkSetelahUts]);
  for (const kode of tercakup) {
    if (!semuaSah.has(kode)) {
      temuan.push({
        kode: "KK-SUB-CPMK-ASING",
        tingkat: "PEMBLOKIR",
        pesan: `${label} menguji ${kode}, yang tidak dijadwalkan pada mata kuliah ini.`,
      });
    } else if (!setSeharusnya.has(kode)) {
      temuan.push({
        kode: "KK-SUB-CPMK-BELUM-DIAJARKAN",
        tingkat: "PERINGATAN",
        pesan:
          `${label} menguji ${kode}, yang dijadwalkan ` +
          `${k.jenis === "UTS" ? "setelah" : "sebelum"} ujian ini.`,
      });
    }
  }

  // ── Kesesuaian level Bloom ──────────────────────────────────────────
  for (const b of k.butir) {
    const levelKurikulum = konteks.levelSubCpmk[b.subCpmkKode];
    if (!levelKurikulum) continue;
    const selisih = bandingkanLevel(b.levelBloom, levelKurikulum);
    if (selisih !== null && selisih > 0) {
      temuan.push({
        kode: "KK-LEVEL-MELAMPAUI",
        tingkat: "PERINGATAN",
        pesan:
          `Butir ${b.nomor} menguji ${b.subCpmkKode} pada level ${b.levelBloom} ` +
          `(${infoLevel(b.levelBloom).nama}), lebih tinggi daripada level ` +
          `Sub-CPMK-nya ${levelKurikulum}.`,
        saran: "Menguji di atas level yang diajarkan membuat hasilnya sulit dipertanggungjawabkan.",
      });
    }
  }

  // Sebaran level: ujian yang seluruhnya C1–C2 hanya mengukur hafalan.
  const sebaran: Record<string, number> = {};
  for (const b of k.butir) {
    sebaran[b.levelBloom] = (sebaran[b.levelBloom] ?? 0) + b.skor;
  }
  const skorRendah = k.butir
    .filter((b) => ["C1", "C2"].includes(b.levelBloom))
    .reduce((s, b) => s + b.skor, 0);
  if (k.butir.length > 0 && totalButir > 0 && skorRendah / totalButir > 0.8) {
    temuan.push({
      kode: "KK-BLOOM-TIMPANG",
      tingkat: "PERINGATAN",
      pesan:
        `${bulatkan((skorRendah / totalButir) * 100, 1)}% skor ${label} berada di level C1–C2.`,
      saran: "Ujian yang hampir seluruhnya mengingat dan memahami tidak mengukur penerapan.",
    });
  }

  // ── Proporsi terhadap bobot ajar ────────────────────────────────────
  const totalBobotAjar = seharusnya.reduce(
    (s, kode) => s + (konteks.bobotSubCpmk[kode] ?? 0),
    0,
  );
  if (totalBobotAjar > 0 && totalButir > 0) {
    for (const kode of seharusnya) {
      const bobotAjar = konteks.bobotSubCpmk[kode] ?? 0;
      if (bobotAjar === 0) continue;
      const skorUji = k.butir
        .filter((b) => b.subCpmkKode === kode)
        .reduce((s, b) => s + b.skor, 0);

      const persenAjar = (bobotAjar / totalBobotAjar) * 100;
      const persenUji = (skorUji / totalButir) * 100;
      if (Math.abs(persenAjar - persenUji) > TOLERANSI_PROPORSI) {
        temuan.push({
          kode: "KK-PROPORSI",
          tingkat: "PERINGATAN",
          pesan:
            `${kode} mendapat ${bulatkan(persenAjar, 1)}% porsi pembelajaran ` +
            `tetapi ${bulatkan(persenUji, 1)}% skor ${label}.`,
        });
      }
    }
  }

  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");
  return {
    temuan,
    pemblokir,
    peringatan: temuan.filter((t) => t.tingkat === "PERINGATAN"),
    lolos: pemblokir.length === 0,
    ringkasan: {
      totalSkor: totalButir,
      jumlahButir: k.butir.reduce((s, b) => s + b.jumlahButir, 0),
      subCpmkTercakup: tercakup.size,
      subCpmkSeharusnya: seharusnya.length,
      sebaranBloom: sebaran,
    },
  };
}
