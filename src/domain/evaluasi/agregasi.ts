import { bulatkan } from "@/domain/beban-belajar/kalkulator";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import { daftarRingkas } from "@/domain/temuan";

/**
 * Agregasi capaian tingkat program studi — tahap E5 pada
 * docs/05-evaluasi-ketercapaian-mk.md.
 *
 * Rumusnya baris terakhir docs/00 §3.4:
 *
 *   Capaian CPL Prodi = Σ(Capaian CPL(MK) × sks_MK) / Σ sks_MK
 *
 * Tertimbang sks, bukan rata-rata biasa: mata kuliah 4 sks yang membebani
 * sebuah CPL lebih berarti daripada mata kuliah 1 sks yang menyentuhnya
 * sekilas. Rata-rata polos akan membuat keduanya setara.
 *
 * Masukannya adalah baris `HasilCapaian` dari evaluasi yang SUDAH DITUTUP —
 * itulah gunanya menyimpan capaian sebagai baris, bukan hanya di dalam
 * snapshot: agregasi tidak perlu membongkar JSON satu per satu.
 */

const TOLERANSI = 0.01;

/** Ambang cakupan yang lazim dituntut panduan PT: CPL prodi harus terwakili
 * sekurang-kurangnya sekian persen mata kuliah yang membebaninya. */
export const CAKUPAN_MINIMAL_PERSEN = 75;

/** Selisih persen lulus antar kelas yang sudah pantas dipertanyakan. */
export const SELISIH_KELAS_WAJAR = 25;

export interface BarisCapaian {
  cplKode: string;
  mkKode: string;
  mkNama: string;
  sks: number;
  kelas: string;
  tahunAkademik: string;
  /** Urutan tahun akademik untuk pengurutan tren. */
  tahunMulai: number;
  rerata: number | null;
  persenLulus: number | null;
  tercapai: boolean;
  jumlahDinilai: number;
}

export interface CapaianCplProdi {
  kode: string;
  /** Rerata tertimbang sks atas seluruh evaluasi yang menyentuh CPL ini. */
  rerata: number | null;
  /** Persen mahasiswa lulus, tertimbang sks. */
  persenLulus: number | null;
  /** Berapa evaluasi kelas yang menyatakan CPL ini tercapai. */
  kelasTercapai: number;
  kelasTerukur: number;
  mkTerukur: string[];
  sksTerukur: number;
  jumlahDinilai: number;
}

export interface TitikTren {
  tahunAkademik: string;
  tahunMulai: number;
  rerata: number | null;
  persenLulus: number | null;
  kelasTerukur: number;
}

export interface SebaranKelas {
  mkKode: string;
  cplKode: string;
  tahunAkademik: string;
  tertinggi: { kelas: string; persenLulus: number };
  terendah: { kelas: string; persenLulus: number };
  selisih: number;
}

export interface HasilAgregasi {
  cpl: CapaianCplProdi[];
  tren: Map<string, TitikTren[]>;
  sebaran: SebaranKelas[];
  temuan: TemuanRpkps[];
  ringkasan: {
    cplTerukur: number;
    cplDibebankan: number;
    kelasDievaluasi: number;
    mkDievaluasi: number;
    cakupanPersen: number;
  };
}

export interface ArgAgregasi {
  baris: readonly BarisCapaian[];
  /** Seluruh CPL prodi, termasuk yang belum pernah terukur. */
  cplProdi: readonly string[];
  /** Jumlah mata kuliah pada kurikulum, untuk menghitung cakupan evaluasi. */
  jumlahMkKurikulum: number;
  ambangKetercapaian: number;
}

export function agregasiProdi(arg: ArgAgregasi): HasilAgregasi {
  const temuan: TemuanRpkps[] = [];

  // ── Capaian per CPL, tertimbang sks ─────────────────────────────────
  const perCpl = new Map<string, BarisCapaian[]>();
  for (const b of arg.baris) {
    const daftar = perCpl.get(b.cplKode) ?? [];
    daftar.push(b);
    perCpl.set(b.cplKode, daftar);
  }

  const cpl: CapaianCplProdi[] = arg.cplProdi.map((kode) => {
    const daftar = (perCpl.get(kode) ?? []).filter((b) => b.jumlahDinilai > 0);
    if (daftar.length === 0) {
      return {
        kode,
        rerata: null,
        persenLulus: null,
        kelasTercapai: 0,
        kelasTerukur: 0,
        mkTerukur: [],
        sksTerukur: 0,
        jumlahDinilai: 0,
      };
    }

    return {
      kode,
      rerata: tertimbang(daftar, (b) => b.rerata),
      persenLulus: tertimbang(daftar, (b) => b.persenLulus),
      kelasTercapai: daftar.filter((b) => b.tercapai).length,
      kelasTerukur: daftar.length,
      mkTerukur: [...new Set(daftar.map((b) => b.mkKode))].sort(),
      sksTerukur: [...new Set(daftar.map((b) => b.mkKode))].reduce(
        (t, mk) => t + (daftar.find((b) => b.mkKode === mk)?.sks ?? 0),
        0,
      ),
      jumlahDinilai: daftar.reduce((t, b) => t + b.jumlahDinilai, 0),
    };
  });

  // ── Tren antar tahun akademik ───────────────────────────────────────
  const tren = new Map<string, TitikTren[]>();
  for (const c of cpl) {
    const daftar = (perCpl.get(c.kode) ?? []).filter((b) => b.jumlahDinilai > 0);
    const perTa = new Map<string, BarisCapaian[]>();
    for (const b of daftar) {
      const isi = perTa.get(b.tahunAkademik) ?? [];
      isi.push(b);
      perTa.set(b.tahunAkademik, isi);
    }
    tren.set(
      c.kode,
      [...perTa.entries()]
        .map(([tahunAkademik, isi]) => ({
          tahunAkademik,
          tahunMulai: isi[0].tahunMulai,
          rerata: tertimbang(isi, (b) => b.rerata),
          persenLulus: tertimbang(isi, (b) => b.persenLulus),
          kelasTerukur: isi.length,
        }))
        .sort((a, b) => a.tahunMulai - b.tahunMulai || a.tahunAkademik.localeCompare(b.tahunAkademik)),
    );
  }

  // ── Sebaran antar kelas paralel ─────────────────────────────────────
  // Rencana yang sama menghasilkan capaian jauh berbeda: yang bermasalah
  // pelaksanaan, bukan rancangan (doc 05 §4.1b). Temuan ini tidak akan
  // pernah muncul dari angka gabungan.
  const sebaran: SebaranKelas[] = [];
  const perMk = new Map<string, BarisCapaian[]>();
  for (const b of arg.baris) {
    if (b.persenLulus === null || b.jumlahDinilai === 0) continue;
    const kunci = `${b.mkKode}|${b.cplKode}|${b.tahunAkademik}`;
    const daftar = perMk.get(kunci) ?? [];
    daftar.push(b);
    perMk.set(kunci, daftar);
  }
  for (const daftar of perMk.values()) {
    if (daftar.length < 2) continue;
    const urut = [...daftar].sort((a, b) => (b.persenLulus ?? 0) - (a.persenLulus ?? 0));
    const atas = urut[0];
    const bawah = urut[urut.length - 1];
    const selisih = bulatkan((atas.persenLulus ?? 0) - (bawah.persenLulus ?? 0), 1);
    if (selisih > SELISIH_KELAS_WAJAR) {
      sebaran.push({
        mkKode: atas.mkKode,
        cplKode: atas.cplKode,
        tahunAkademik: atas.tahunAkademik,
        tertinggi: { kelas: atas.kelas, persenLulus: atas.persenLulus ?? 0 },
        terendah: { kelas: bawah.kelas, persenLulus: bawah.persenLulus ?? 0 },
        selisih,
      });
    }
  }

  // ── Temuan ──────────────────────────────────────────────────────────
  const belumTerukur = cpl.filter((c) => c.kelasTerukur === 0);
  if (belumTerukur.length > 0) {
    temuan.push({
      kode: "AG-CPL-TANPA-DATA",
      tingkat: "PEMBLOKIR",
      params: { jumlah: belumTerukur.length, daftar: belumTerukur.map((c) => c.kode).join(", ") },
    });
  }

  const gagal = cpl.filter(
    (c) => c.persenLulus !== null && c.persenLulus < arg.ambangKetercapaian - TOLERANSI,
  );
  if (gagal.length > 0) {
    temuan.push({
      kode: "AG-CPL-BELUM-TERCAPAI",
      tingkat: "PERINGATAN",
      params: {
        daftar: gagal.map((c) => `${c.kode} (${c.persenLulus}%)`).join(", "),
        ambang: arg.ambangKetercapaian,
      },
    });
  }

  const mkDievaluasi = new Set(arg.baris.map((b) => b.mkKode));
  const cakupan =
    arg.jumlahMkKurikulum === 0
      ? 0
      : bulatkan((mkDievaluasi.size / arg.jumlahMkKurikulum) * 100, 1);
  if (arg.jumlahMkKurikulum > 0 && cakupan < CAKUPAN_MINIMAL_PERSEN) {
    temuan.push({
      kode: "AG-CAKUPAN-RENDAH",
      tingkat: "PERINGATAN",
      params: {
        dievaluasi: mkDievaluasi.size,
        total: arg.jumlahMkKurikulum,
        persen: cakupan,
        minimal: CAKUPAN_MINIMAL_PERSEN,
      },
    });
  }

  if (sebaran.length > 0) {
    temuan.push({
      kode: "AG-SEBARAN-KELAS",
      tingkat: "PERINGATAN",
      params: {
        jumlah: sebaran.length,
        ambang: SELISIH_KELAS_WAJAR,
        daftar: daftarRingkas(
          sebaran.map((s) => `${s.mkKode} ${s.cplKode} (${s.selisih} poin)`),
          3,
        ),
      },
    });
  }

  return {
    cpl,
    tren,
    sebaran,
    temuan,
    ringkasan: {
      cplTerukur: cpl.filter((c) => c.kelasTerukur > 0).length,
      cplDibebankan: arg.cplProdi.length,
      kelasDievaluasi: new Set(arg.baris.map((b) => `${b.mkKode}|${b.kelas}|${b.tahunAkademik}`)).size,
      mkDievaluasi: mkDievaluasi.size,
      cakupanPersen: cakupan,
    },
  };
}

/** Rerata tertimbang sks, mengabaikan baris yang nilainya null. */
function tertimbang(
  baris: readonly BarisCapaian[],
  ambil: (b: BarisCapaian) => number | null,
): number | null {
  let atas = 0;
  let bawah = 0;
  for (const b of baris) {
    const nilai = ambil(b);
    if (nilai === null || b.sks <= 0) continue;
    atas += nilai * b.sks;
    bawah += b.sks;
  }
  return bawah > TOLERANSI ? bulatkan(atas / bawah, 2) : null;
}
