import { bulatkan } from "@/domain/beban-belajar/kalkulator";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import type { Asesmen, CpmkPeta } from "./peta-asesmen";

/**
 * Mesin hitung ketercapaian — tahap E3 pada
 * docs/05-evaluasi-ketercapaian-mk.md. Rumusnya dari docs/00 §3.4:
 *
 *   Nilai Sub-CPMK (mhs) = Σ(skor asesmen_i × bobot_i) / Σ bobot_i
 *   Nilai CPMK     (mhs) = Σ(Nilai Sub-CPMK_j × bobot_j) / Σ bobot_j
 *   Capaian CPL(MK)(mhs) = Σ(Nilai CPMK_k × kontribusi_k) / Σ kontribusi_k
 *   Nilai akhir MK (mhs) = Σ(skor asesmen × bobot asesmen) / Σ bobot
 *
 * Seluruh bobot datang dari `susunPetaAsesmen`, tidak pernah dihitung ulang di
 * sini — itulah gunanya peta kanonik.
 *
 * Dua ambang, dua pertanyaan berbeda (doc 05 §3.1). `ambangKelulusanMhs`
 * menjawab "mahasiswa ini lulus CPMK itu atau tidak"; `ambangKetercapaianMk`
 * menjawab "CPMK itu tercapai di kelas ini atau tidak". Melaporkan rata-rata
 * saja menyembunyikan sebaran: rerata 70 bisa berarti semua di 70, bisa
 * berarti separuh di 95 dan separuh di 45.
 */

const TOLERANSI = 0.01;

export interface Pita {
  nama: string;
  /** Batas bawah rerata, inklusif. Daftar diurutkan menurun. */
  batasBawah: number;
}

/**
 * Empat pita yang lazim dipakai panduan PT. Batasnya KONFIGURASI prodi,
 * bukan konstanta — sejajar dengan `kebijakan_bentuk` pada doc 03.
 */
export const PITA_BAWAAN: readonly Pita[] = [
  { nama: "SANGAT BAIK", batasBawah: 85 },
  { nama: "BAIK", batasBawah: 70 },
  { nama: "SEDANG", batasBawah: 55 },
  { nama: "KURANG", batasBawah: 0 },
];

export interface PesertaCapaian {
  nim: string;
  nama: string;
  /** Kunci = kode asesmen. null berarti belum dinilai, bukan nol. */
  skor: Record<string, number | null>;
}

export interface SumberCapaian {
  asesmen: readonly Asesmen[];
  cpmk: readonly CpmkPeta[];
  cplDibebankan: readonly string[];
  peserta: readonly PesertaCapaian[];
  ambangKelulusanMhs: number;
  ambangKetercapaianMk: number;
  pita?: readonly Pita[];
}

export type TingkatCapaian = "SUB_CPMK" | "CPMK" | "CPL";

export interface NilaiMahasiswa {
  nim: string;
  nama: string;
  /** null = tidak ada satu pun asesmen penyusunnya yang sudah dinilai. */
  subCpmk: Record<string, number | null>;
  cpmk: Record<string, number | null>;
  cpl: Record<string, number | null>;
  nilaiAkhir: number | null;
  /** Persen bobot asesmen yang sudah punya skor. 100 = lengkap. */
  kelengkapan: number;
}

export interface CapaianButir {
  tingkat: TingkatCapaian;
  kode: string;
  /** Rata-rata nilai mahasiswa yang punya nilai pada butir ini. */
  rerata: number | null;
  /** Persen mahasiswa bernilai yang mencapai ambang kelulusan. */
  persenLulus: number | null;
  /** persenLulus ≥ ambangKetercapaianMk. */
  tercapai: boolean;
  pita: string;
  jumlahDinilai: number;
}

export interface HasilCapaian {
  mahasiswa: NilaiMahasiswa[];
  butir: CapaianButir[];
  temuan: TemuanRpkps[];
  pemblokir: TemuanRpkps[];
  peringatan: TemuanRpkps[];
  /** true bila hasil ini boleh ditutup menjadi catatan resmi. */
  dapatDitutup: boolean;
  ringkasan: {
    jumlahPeserta: number;
    kelengkapan: number;
    cpmkTercapai: number;
    cpmkSeluruh: number;
    cplTercapai: number;
    cplSeluruh: number;
    rerataNilaiAkhir: number | null;
    /** Kode CPMK yang belum tercapai — bahan tindak lanjut pada E4. */
    cpmkBelumTercapai: string[];
  };
}

export function hitungCapaian(s: SumberCapaian): HasilCapaian {
  const temuan: TemuanRpkps[] = [];
  const pita = s.pita ?? PITA_BAWAAN;

  // ── Bobot dari peta asesmen ─────────────────────────────────────────
  // asesmen → Sub-CPMK → bobot. Satu asesmen bisa menagih banyak Sub-CPMK.
  const bobotAsesmenSub = new Map<string, Map<string, number>>();
  const bobotSub = new Map<string, number>();
  for (const a of s.asesmen) {
    const per = new Map<string, number>();
    for (const b of a.subCpmk) {
      if (b.bobot <= 0) continue;
      per.set(b.kode, (per.get(b.kode) ?? 0) + b.bobot);
      bobotSub.set(b.kode, (bobotSub.get(b.kode) ?? 0) + b.bobot);
    }
    bobotAsesmenSub.set(a.kode, per);
  }

  const bobotCpmk = new Map<string, number>();
  for (const c of s.cpmk) {
    bobotCpmk.set(
      c.kode,
      c.subCpmkKode.reduce((t, k) => t + (bobotSub.get(k) ?? 0), 0),
    );
  }

  const totalBobotAsesmen = s.asesmen.reduce((t, a) => t + a.bobot, 0);

  // ── Per mahasiswa ───────────────────────────────────────────────────
  const mahasiswa: NilaiMahasiswa[] = s.peserta.map((p) => {
    // Sub-CPMK
    const subCpmk: Record<string, number | null> = {};
    for (const [kode] of bobotSub) {
      let atas = 0;
      let bawah = 0;
      for (const a of s.asesmen) {
        const bobot = bobotAsesmenSub.get(a.kode)?.get(kode);
        if (bobot === undefined) continue;
        const skor = p.skor[a.kode];
        if (skor === null || skor === undefined) continue;
        atas += skor * bobot;
        bawah += bobot;
      }
      subCpmk[kode] = bawah > TOLERANSI ? bulatkan(atas / bawah, 2) : null;
    }

    // CPMK
    const cpmk: Record<string, number | null> = {};
    for (const c of s.cpmk) {
      let atas = 0;
      let bawah = 0;
      for (const k of c.subCpmkKode) {
        const nilai = subCpmk[k];
        const bobot = bobotSub.get(k) ?? 0;
        if (nilai === null || nilai === undefined || bobot <= TOLERANSI) continue;
        atas += nilai * bobot;
        bawah += bobot;
      }
      cpmk[c.kode] = bawah > TOLERANSI ? bulatkan(atas / bawah, 2) : null;
    }

    // CPL — kontribusi tiap CPMK adalah bobotnya, seperti doc 05 §5.4.
    const cpl: Record<string, number | null> = {};
    for (const kodeCpl of s.cplDibebankan) {
      let atas = 0;
      let bawah = 0;
      for (const c of s.cpmk) {
        if (!c.cplKode.includes(kodeCpl)) continue;
        const nilai = cpmk[c.kode];
        const kontribusi = bobotCpmk.get(c.kode) ?? 0;
        if (nilai === null || kontribusi <= TOLERANSI) continue;
        atas += nilai * kontribusi;
        bawah += kontribusi;
      }
      cpl[kodeCpl] = bawah > TOLERANSI ? bulatkan(atas / bawah, 2) : null;
    }

    // Nilai akhir dan kelengkapan
    let atasAkhir = 0;
    let bobotTerisi = 0;
    for (const a of s.asesmen) {
      const skor = p.skor[a.kode];
      if (skor === null || skor === undefined) continue;
      atasAkhir += skor * a.bobot;
      bobotTerisi += a.bobot;
    }

    return {
      nim: p.nim,
      nama: p.nama,
      subCpmk,
      cpmk,
      cpl,
      nilaiAkhir: bobotTerisi > TOLERANSI ? bulatkan(atasAkhir / bobotTerisi, 2) : null,
      kelengkapan:
        totalBobotAsesmen > TOLERANSI ? bulatkan((bobotTerisi / totalBobotAsesmen) * 100, 1) : 0,
    };
  });

  // ── Agregasi kelas ──────────────────────────────────────────────────
  const butir: CapaianButir[] = [];

  const kumpulkan = (
    tingkat: TingkatCapaian,
    kode: string,
    ambil: (m: NilaiMahasiswa) => number | null,
  ) => {
    const nilai = mahasiswa.map(ambil).filter((n): n is number => n !== null);
    if (nilai.length === 0) {
      butir.push({
        tingkat,
        kode,
        rerata: null,
        persenLulus: null,
        tercapai: false,
        pita: "—",
        jumlahDinilai: 0,
      });
      return;
    }
    const rerata = bulatkan(nilai.reduce((t, n) => t + n, 0) / nilai.length, 2);
    const lulus = nilai.filter((n) => n >= s.ambangKelulusanMhs).length;
    const persenLulus = bulatkan((lulus / nilai.length) * 100, 1);
    butir.push({
      tingkat,
      kode,
      rerata,
      persenLulus,
      tercapai: persenLulus >= s.ambangKetercapaianMk - TOLERANSI,
      pita: pitaUntuk(rerata, pita),
      jumlahDinilai: nilai.length,
    });
  };

  for (const [kode] of bobotSub) kumpulkan("SUB_CPMK", kode, (m) => m.subCpmk[kode] ?? null);
  for (const c of s.cpmk) kumpulkan("CPMK", c.kode, (m) => m.cpmk[c.kode] ?? null);
  for (const kode of s.cplDibebankan) kumpulkan("CPL", kode, (m) => m.cpl[kode] ?? null);

  // ── Temuan ──────────────────────────────────────────────────────────
  if (s.peserta.length === 0) {
    temuan.push({
      kode: "EV-TANPA-PESERTA",
      tingkat: "PEMBLOKIR",
    });
  }

  const totalSel = s.peserta.length * s.asesmen.length;
  const selTerisi = s.peserta.reduce(
    (t, p) => t + s.asesmen.filter((a) => p.skor[a.kode] !== null && p.skor[a.kode] !== undefined).length,
    0,
  );
  const kelengkapan = totalSel === 0 ? 0 : bulatkan((selTerisi / totalSel) * 100, 1);

  if (totalSel > 0 && selTerisi < totalSel) {
    temuan.push({
      kode: "EV-BELUM-LENGKAP",
      tingkat: "PEMBLOKIR",
      params: { terisi: totalSel - selTerisi, total: totalSel, persen: kelengkapan },
    });
  }

  const butirCpmk = butir.filter((b) => b.tingkat === "CPMK");
  const belumTercapai = butirCpmk.filter((b) => !b.tercapai);
  if (belumTercapai.length > 0 && s.peserta.length > 0) {
    temuan.push({
      kode: "EV-CPMK-BELUM-TERCAPAI",
      tingkat: "PERINGATAN",
      params: {
        jumlah: belumTercapai.length,
        daftar: belumTercapai
          .map((b) => `${b.kode} (${b.persenLulus ?? 0}% lulus)`)
          .join(", "),
        ambang: s.ambangKetercapaianMk,
      },
    });
  }

  const butirCpl = butir.filter((b) => b.tingkat === "CPL");
  const nilaiAkhir = mahasiswa.map((m) => m.nilaiAkhir).filter((n): n is number => n !== null);
  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");

  return {
    mahasiswa,
    butir,
    temuan,
    pemblokir,
    peringatan: temuan.filter((t) => t.tingkat === "PERINGATAN"),
    dapatDitutup: pemblokir.length === 0,
    ringkasan: {
      jumlahPeserta: s.peserta.length,
      kelengkapan,
      cpmkTercapai: butirCpmk.filter((b) => b.tercapai).length,
      cpmkSeluruh: butirCpmk.length,
      cplTercapai: butirCpl.filter((b) => b.tercapai).length,
      cplSeluruh: butirCpl.length,
      rerataNilaiAkhir:
        nilaiAkhir.length === 0
          ? null
          : bulatkan(nilaiAkhir.reduce((t, n) => t + n, 0) / nilaiAkhir.length, 2),
      cpmkBelumTercapai: belumTercapai.map((b) => b.kode),
    },
  };
}

function pitaUntuk(nilai: number, pita: readonly Pita[]): string {
  for (const p of pita) {
    if (nilai >= p.batasBawah) return p.nama;
  }
  return pita.at(-1)?.nama ?? "—";
}
