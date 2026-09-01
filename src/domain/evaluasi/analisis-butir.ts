import { bulatkan } from "@/domain/beban-belajar/kalkulator";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";

/**
 * Analisis butir soal — tahap E6 pada docs/05-evaluasi-ketercapaian-mk.md.
 *
 * Menjawab pertanyaan yang tidak dapat dijawab nilai akhir: butir mana yang
 * tidak membedakan mahasiswa yang paham dari yang tidak. Butir dengan daya
 * beda negatif berarti mahasiswa terbaik justru lebih sering salah — hampir
 * selalu tanda kunci jawaban keliru atau pertanyaan bermakna ganda, dan itu
 * mencemari capaian Sub-CPMK yang bergantung padanya.
 *
 * Analisis ini OPSIONAL: ia butuh skor per butir, sedangkan capaian hanya
 * butuh skor per asesmen. Prodi yang tidak merekam skor per butir tetap
 * mendapat seluruh E1–E5.
 *
 * Rumus yang dipakai:
 *
 *   Tingkat kesukaran  P = rerata skor butir / skor maksimum butir
 *   Daya beda          D = (rerata kelompok atas − rerata kelompok bawah)
 *                          / skor maksimum butir
 *   Reliabilitas       α = (k/(k−1)) × (1 − Σσ²ᵢ / σ²ₜ)          (Cronbach)
 *
 * Kelompok atas dan bawah adalah 27% teratas dan terbawah menurut skor total —
 * proporsi baku Kelley yang memaksimalkan kepekaan pada sebaran normal.
 */

/** Proporsi kelompok atas/bawah untuk daya beda. */
export const PROPORSI_KELOMPOK = 0.27;
/** Di bawah ini, analisis butir tidak layak dipercaya. */
export const PESERTA_MINIMAL = 10;
/** Batas bawah reliabilitas yang lazim diterima. */
export const RELIABILITAS_MINIMAL = 0.7;

export type KategoriKesukaran = "SUKAR" | "SEDANG" | "MUDAH";
export type KategoriDayaBeda = "BURUK" | "JELEK" | "CUKUP" | "BAIK" | "SANGAT BAIK";

export interface ButirUjian {
  nomor: number;
  subCpmkKode: string;
  levelBloom: string;
  /** Skor maksimum baris ini pada kisi-kisi. */
  skorMaks: number;
}

export interface JawabanPeserta {
  nim: string;
  /** Kunci = nomor butir. null berarti butir itu tidak dinilai untuk dia. */
  skor: Record<number, number | null>;
}

export interface AnalisisButir {
  nomor: number;
  subCpmkKode: string;
  levelBloom: string;
  skorMaks: number;
  jumlahDijawab: number;
  rerata: number;
  /** Tingkat kesukaran, 0–1. Makin besar makin mudah. */
  kesukaran: number;
  kategoriKesukaran: KategoriKesukaran;
  /** Daya beda, −1 sampai 1. */
  dayaBeda: number;
  kategoriDayaBeda: KategoriDayaBeda;
}

export interface HasilAnalisisButir {
  butir: AnalisisButir[];
  /** Cronbach's alpha; null bila tidak dapat dihitung. */
  reliabilitas: number | null;
  temuan: TemuanRpkps[];
  ringkasan: {
    jumlahPeserta: number;
    jumlahButir: number;
    ukuranKelompok: number;
    rerataTotal: number | null;
    butirBermasalah: number[];
  };
}

export function analisisButir(
  butir: readonly ButirUjian[],
  peserta: readonly JawabanPeserta[],
  label = "ujian",
): HasilAnalisisButir {
  const temuan: TemuanRpkps[] = [];

  // Hanya peserta yang punya skor pada seluruh butir yang ikut dianalisis:
  // total yang tidak setara membuat pemeringkatan atas–bawah menyesatkan.
  const lengkap = peserta.filter((p) =>
    butir.every((b) => p.skor[b.nomor] !== null && p.skor[b.nomor] !== undefined),
  );

  const total = new Map<string, number>();
  for (const p of lengkap) {
    total.set(
      p.nim,
      butir.reduce((t, b) => t + (p.skor[b.nomor] ?? 0), 0),
    );
  }

  const urut = [...lengkap].sort((a, b) => (total.get(b.nim) ?? 0) - (total.get(a.nim) ?? 0));
  const ukuran = Math.max(1, Math.round(urut.length * PROPORSI_KELOMPOK));
  const atas = urut.slice(0, ukuran);
  const bawah = urut.slice(-ukuran);

  const hasil: AnalisisButir[] = butir.map((b) => {
    const nilai = lengkap
      .map((p) => p.skor[b.nomor])
      .filter((n): n is number => n !== null && n !== undefined);

    const rerata = nilai.length === 0 ? 0 : nilai.reduce((t, n) => t + n, 0) / nilai.length;
    const kesukaran = b.skorMaks > 0 ? rerata / b.skorMaks : 0;

    const rerataAtas = rataKelompok(atas, b.nomor);
    const rerataBawah = rataKelompok(bawah, b.nomor);
    const dayaBeda =
      b.skorMaks > 0 && urut.length >= 2 ? (rerataAtas - rerataBawah) / b.skorMaks : 0;

    return {
      nomor: b.nomor,
      subCpmkKode: b.subCpmkKode,
      levelBloom: b.levelBloom,
      skorMaks: b.skorMaks,
      jumlahDijawab: nilai.length,
      rerata: bulatkan(rerata, 2),
      kesukaran: bulatkan(kesukaran, 3),
      kategoriKesukaran: kategoriKesukaran(kesukaran),
      dayaBeda: bulatkan(dayaBeda, 3),
      kategoriDayaBeda: kategoriDayaBeda(dayaBeda),
    };
  });

  // ── Reliabilitas (Cronbach's alpha) ─────────────────────────────────
  const k = butir.length;
  let reliabilitas: number | null = null;
  if (k >= 2 && lengkap.length >= 2) {
    const ragamButir = butir.reduce(
      (t, b) => t + ragam(lengkap.map((p) => p.skor[b.nomor] ?? 0)),
      0,
    );
    const ragamTotal = ragam([...total.values()]);
    if (ragamTotal > 0) {
      reliabilitas = bulatkan((k / (k - 1)) * (1 - ragamButir / ragamTotal), 3);
    }
  }

  // ── Temuan ──────────────────────────────────────────────────────────
  if (lengkap.length === 0) {
    temuan.push({
      kode: "BS-TANPA-DATA",
      tingkat: "PERINGATAN",
      params: { label },
    });
    return {
      butir: hasil,
      reliabilitas,
      temuan,
      ringkasan: {
        jumlahPeserta: 0,
        jumlahButir: k,
        ukuranKelompok: 0,
        rerataTotal: null,
        butirBermasalah: [],
      },
    };
  }

  if (lengkap.length < PESERTA_MINIMAL) {
    temuan.push({
      kode: "BS-PESERTA-SEDIKIT",
      tingkat: "PERINGATAN",
      params: { jumlah: lengkap.length, label, minimal: PESERTA_MINIMAL },
    });
  }

  const negatif = hasil.filter((b) => b.dayaBeda < 0);
  if (negatif.length > 0) {
    // Peringatan, bukan pemblokir. Daya beda negatif HAMPIR selalu berarti
    // kunci keliru — tetapi tidak selalu, dan mesin tidak dapat membedakannya
    // dari butir sukar yang membuat mahasiswa terbaik berpikir terlalu jauh.
    // Yang memutuskan tetap dosen; tugas modul ini menunjukkannya, bukan
    // menyandera penutupan evaluasi.
    temuan.push({
      kode: "BS-DAYA-BEDA-NEGATIF",
      tingkat: "PERINGATAN",
      params: { daftar: negatif.map((b) => b.nomor).join(", "), label },
    });
  }

  const lemah = hasil.filter((b) => b.dayaBeda >= 0 && b.kategoriDayaBeda === "JELEK");
  if (lemah.length > 0) {
    temuan.push({
      kode: "BS-DAYA-BEDA-RENDAH",
      tingkat: "PERINGATAN",
      params: { daftar: lemah.map((b) => b.nomor).join(", ") },
    });
  }

  const mudah = hasil.filter((b) => b.kategoriKesukaran === "MUDAH");
  const sukar = hasil.filter((b) => b.kategoriKesukaran === "SUKAR");
  if (mudah.length > 0 && mudah.length === hasil.length) {
    temuan.push({
      kode: "BS-SELURUHNYA-MUDAH",
      tingkat: "PERINGATAN",
      params: { label },
    });
  }
  if (sukar.length > 0) {
    temuan.push({
      kode: "BS-BUTIR-SUKAR",
      tingkat: "PERINGATAN",
      params: { daftar: sukar.map((b) => b.nomor).join(", ") },
    });
  }

  if (reliabilitas !== null && reliabilitas < RELIABILITAS_MINIMAL) {
    temuan.push({
      kode: "BS-RELIABILITAS-RENDAH",
      tingkat: "PERINGATAN",
      params: { label, nilai: reliabilitas, minimal: RELIABILITAS_MINIMAL },
    });
  }

  const tertinggal = peserta.length - lengkap.length;
  if (tertinggal > 0) {
    temuan.push({
      kode: "BS-SKOR-TIDAK-LENGKAP",
      tingkat: "PERINGATAN",
      params: { jumlah: tertinggal },
    });
  }

  const nilaiTotal = [...total.values()];

  return {
    butir: hasil,
    reliabilitas,
    temuan,
    ringkasan: {
      jumlahPeserta: lengkap.length,
      jumlahButir: k,
      ukuranKelompok: ukuran,
      rerataTotal:
        nilaiTotal.length === 0
          ? null
          : bulatkan(nilaiTotal.reduce((t, n) => t + n, 0) / nilaiTotal.length, 2),
      butirBermasalah: [...negatif, ...lemah].map((b) => b.nomor).sort((a, b) => a - b),
    },
  };
}

function rataKelompok(kelompok: readonly JawabanPeserta[], nomor: number): number {
  const nilai = kelompok
    .map((p) => p.skor[nomor])
    .filter((n): n is number => n !== null && n !== undefined);
  return nilai.length === 0 ? 0 : nilai.reduce((t, n) => t + n, 0) / nilai.length;
}

/** Ragam populasi. Dipakai keduanya pada rumus alpha, jadi pembaginya konsisten. */
function ragam(nilai: readonly number[]): number {
  if (nilai.length === 0) return 0;
  const rerata = nilai.reduce((t, n) => t + n, 0) / nilai.length;
  return nilai.reduce((t, n) => t + (n - rerata) ** 2, 0) / nilai.length;
}

function kategoriKesukaran(p: number): KategoriKesukaran {
  if (p < 0.3) return "SUKAR";
  if (p > 0.7) return "MUDAH";
  return "SEDANG";
}

function kategoriDayaBeda(d: number): KategoriDayaBeda {
  if (d < 0) return "BURUK";
  if (d < 0.2) return "JELEK";
  if (d < 0.3) return "CUKUP";
  if (d < 0.4) return "BAIK";
  return "SANGAT BAIK";
}
