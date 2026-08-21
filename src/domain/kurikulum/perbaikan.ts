import type { LevelBloom } from "./bloom";
import type {
  CpmkInput,
  KurikulumInput,
  MataKuliahInput,
  SubCpmkInput,
  TemuanKurikulum,
} from "./tipe";

/**
 * Usulan perbaikan temuan impor kurikulum.
 *
 * Modul ini MURNI: tidak memanggil AI, tidak menyentuh Prisma. AI hanya
 * menghasilkan daftar usulan; yang menentukan usulan mana yang sah dan
 * bagaimana ia diterapkan adalah kode di sini. Sesuai docs/01 §4.4 —
 * "prompt untuk mengarahkan, kode untuk memvalidasi".
 */

export type JenisUsulan =
  /** Menulis ulang rumusan Sub-CPMK yang sudah ada. */
  | "RUMUSAN_SUB"
  /** Menulis ulang rumusan atau menaikkan level CPMK yang sudah ada. */
  | "RUMUSAN_CPMK"
  /** Menambah Sub-CPMK pada CPMK yang belum punya tahapan belajar. */
  | "SUB_BARU"
  /** Mengganti daftar CPL yang dijabarkan sebuah CPMK. */
  | "PETA_CPL";

export interface UsulanPerbaikan {
  /** Stabil selama satu sesi pratinjau; dipakai UI untuk terima/tolak. */
  id: string;
  jenis: JenisUsulan;
  mkKode: string;
  cpmkKode: string;
  /** Wajib untuk RUMUSAN_SUB. */
  subCpmkKode?: string;
  /** Kode temuan yang dijawab usulan ini, untuk ditampilkan ke dosen. */
  kodeTemuan: string[];
  /** Mengapa AI mengusulkan ini — dosen perlu dasar untuk menilai. */
  alasan: string;

  rumusan?: string;
  levelBloom?: LevelBloom | null;
  subCpmkBaru?: { kode: string; rumusan: string; levelBloom: LevelBloom | null }[];
  cplKode?: string[];
}

export interface UsulanDitolak {
  usulan: UsulanPerbaikan;
  alasan: string;
}

/**
 * Temuan yang boleh dikerjakan AI, dipetakan ke jenis usulannya.
 *
 * Temuan di luar daftar ini sengaja dibiarkan manual: kode berulang, sks nol,
 * semester di luar rentang, dan mata kuliah tanpa CPMK adalah keputusan
 * struktural prodi — bukan soal perumusan kalimat.
 */
export const TEMUAN_DAPAT_DIPERBAIKI: Record<string, JenisUsulan[]> = {
  "K-SUB-PENDEK": ["RUMUSAN_SUB"],
  "K-SUB-TIDAK-TERUKUR": ["RUMUSAN_SUB"],
  "K-SUB-TANPA-KKO": ["RUMUSAN_SUB"],
  "K-SUB-KKO-GANDA": ["RUMUSAN_SUB"],
  "K-SUB-LEVEL-LEBIH-TINGGI": ["RUMUSAN_SUB", "RUMUSAN_CPMK"],
  "K-CPMK-TANPA-SUB": ["SUB_BARU"],
  "K-CPMK-TANPA-CPL": ["PETA_CPL"],
  "K-CPMK-CPL-TIDAK-ADA": ["PETA_CPL"],
  "K-CPMK-CPL-DILUAR-MK": ["PETA_CPL"],
  "K-MK-CPL-TIDAK-DIJABARKAN": ["PETA_CPL"],
};

export function dapatDiperbaikiAi(temuan: TemuanKurikulum): boolean {
  return temuan.kode in TEMUAN_DAPAT_DIPERBAIKI;
}

/** Menyaring temuan menjadi hanya yang masuk akal diserahkan ke AI. */
export function temuanUntukAi(temuan: TemuanKurikulum[]): TemuanKurikulum[] {
  return temuan.filter(dapatDiperbaikiAi);
}

const PANJANG_RUMUSAN_MINIMAL = 15;

/**
 * Memeriksa usulan terhadap kurikulum sebelum diterapkan.
 *
 * AI tidak dipercaya menyebut kode yang benar. Setiap usulan harus menunjuk
 * mata kuliah, CPMK, dan Sub-CPMK yang benar-benar ada; CPL yang dirujuk harus
 * ada di daftar CPL kurikulum DAN dibebankan pada mata kuliahnya; dan Sub-CPMK
 * baru tidak boleh menimpa kode yang sudah dipakai. Usulan yang melanggar
 * dikembalikan sebagai `ditolak` — tidak dibuang diam-diam, supaya dosen tahu
 * ada usulan yang tidak bisa dipakai.
 */
export function periksaUsulan(
  kurikulum: KurikulumInput,
  usulan: UsulanPerbaikan[],
): { sah: UsulanPerbaikan[]; ditolak: UsulanDitolak[] } {
  const sah: UsulanPerbaikan[] = [];
  const ditolak: UsulanDitolak[] = [];
  const kodeCpl = new Set(kurikulum.cpl.map((c) => c.kode));

  for (const u of usulan) {
    const alasan = alasanTolak(kurikulum, kodeCpl, u);
    if (alasan) ditolak.push({ usulan: u, alasan });
    else sah.push(u);
  }
  return { sah, ditolak };
}

function alasanTolak(
  kurikulum: KurikulumInput,
  kodeCpl: Set<string>,
  u: UsulanPerbaikan,
): string | null {
  const mk = kurikulum.mataKuliah.find((m) => m.kode === u.mkKode);
  if (!mk) return `Mata kuliah ${u.mkKode} tidak ada di berkas.`;

  const cpmk = mk.cpmk.find((c) => c.kode === u.cpmkKode);
  if (!cpmk) return `CPMK ${u.cpmkKode} tidak ada pada ${u.mkKode}.`;

  switch (u.jenis) {
    case "RUMUSAN_SUB": {
      const sub = cpmk.subCpmk.find((s) => s.kode === u.subCpmkKode);
      if (!sub) return `Sub-CPMK ${u.subCpmkKode ?? ""} tidak ada pada ${u.cpmkKode}.`;
      if ((u.rumusan?.trim().length ?? 0) < PANJANG_RUMUSAN_MINIMAL) {
        return "Rumusan usulan terlalu pendek.";
      }
      return null;
    }

    case "RUMUSAN_CPMK": {
      if ((u.rumusan?.trim().length ?? 0) < PANJANG_RUMUSAN_MINIMAL) {
        return "Rumusan usulan terlalu pendek.";
      }
      return null;
    }

    case "SUB_BARU": {
      const baru = u.subCpmkBaru ?? [];
      if (baru.length === 0) return "Tidak ada Sub-CPMK yang diusulkan.";
      const dipakai = new Set(cpmk.subCpmk.map((s) => s.kode));
      for (const s of baru) {
        if (dipakai.has(s.kode)) return `Kode ${s.kode} sudah dipakai pada ${u.cpmkKode}.`;
        if (s.rumusan.trim().length < PANJANG_RUMUSAN_MINIMAL) {
          return `Rumusan ${s.kode} terlalu pendek.`;
        }
        dipakai.add(s.kode);
      }
      return null;
    }

    case "PETA_CPL": {
      const kode = u.cplKode ?? [];
      if (kode.length === 0) return "Tidak ada CPL yang diusulkan.";
      // CPL harus ada di kurikulum DAN dibebankan pada mata kuliahnya —
      // CPMK tidak boleh menjabarkan CPL yang bukan beban mata kuliah itu.
      const bebanMk = new Set(mk.cplKode);
      for (const k of kode) {
        if (!kodeCpl.has(k)) return `${k} tidak ada di daftar CPL kurikulum.`;
        if (!bebanMk.has(k)) return `${k} tidak dibebankan pada ${u.mkKode}.`;
      }
      return null;
    }
  }
}

/**
 * Menerapkan usulan ke kurikulum, mengembalikan salinan baru.
 *
 * Tidak memvalidasi apa pun — pemanggil wajib menyaring lewat periksaUsulan
 * lebih dulu, lalu memvalidasi ulang hasilnya dengan validasiKurikulum.
 * Usulan yang tidak menemukan sasarannya diabaikan tanpa melempar galat.
 */
export function terapkanUsulan(
  kurikulum: KurikulumInput,
  usulan: UsulanPerbaikan[],
): KurikulumInput {
  if (usulan.length === 0) return kurikulum;

  return {
    ...kurikulum,
    mataKuliah: kurikulum.mataKuliah.map((mk) => {
      const untukMk = usulan.filter((u) => u.mkKode === mk.kode);
      return untukMk.length === 0 ? mk : terapkanKeMk(mk, untukMk);
    }),
  };
}

function terapkanKeMk(mk: MataKuliahInput, usulan: UsulanPerbaikan[]): MataKuliahInput {
  return {
    ...mk,
    cpmk: mk.cpmk.map((cpmk) => {
      const untukCpmk = usulan.filter((u) => u.cpmkKode === cpmk.kode);
      return untukCpmk.length === 0 ? cpmk : terapkanKeCpmk(cpmk, untukCpmk);
    }),
  };
}

function terapkanKeCpmk(cpmk: CpmkInput, usulan: UsulanPerbaikan[]): CpmkInput {
  let hasil: CpmkInput = { ...cpmk, subCpmk: [...cpmk.subCpmk] };

  for (const u of usulan) {
    switch (u.jenis) {
      case "RUMUSAN_CPMK":
        hasil = {
          ...hasil,
          rumusan: u.rumusan ?? hasil.rumusan,
          levelBloom: u.levelBloom !== undefined ? u.levelBloom : hasil.levelBloom,
          sumberAi: true,
        };
        break;

      case "PETA_CPL":
        // sumberAi TIDAK diset: yang berubah hanya pemetaan CPL, sedangkan
        // rumusan CPMK tetap milik buku kurikulum. Menandainya AI akan
        // membuat jejak asal isi berbohong.
        hasil = { ...hasil, cplKode: [...(u.cplKode ?? [])] };
        break;

      case "SUB_BARU":
        hasil = {
          ...hasil,
          subCpmk: [
            ...hasil.subCpmk,
            ...(u.subCpmkBaru ?? []).map(
              (s): SubCpmkInput => ({
                kode: s.kode,
                rumusan: s.rumusan,
                levelBloom: s.levelBloom,
                sumberAi: true,
              }),
            ),
          ],
        };
        break;

      case "RUMUSAN_SUB":
        hasil = {
          ...hasil,
          subCpmk: hasil.subCpmk.map((s) =>
            s.kode === u.subCpmkKode
              ? {
                  ...s,
                  rumusan: u.rumusan ?? s.rumusan,
                  levelBloom: u.levelBloom !== undefined ? u.levelBloom : s.levelBloom,
                  sumberAi: true,
                }
              : s,
          ),
        };
        break;
    }
  }

  return hasil;
}

/**
 * Merakit konteks ringkas untuk dikirim ke model.
 *
 * Hanya mata kuliah yang punya temuan yang disertakan, beserta CPL yang
 * dibebankan padanya. Mengirim seluruh kurikulum akan membengkakkan token
 * tanpa menambah informasi yang dibutuhkan model untuk memperbaiki temuan.
 */
export function konteksPerbaikan(
  kurikulum: KurikulumInput,
  temuan: TemuanKurikulum[],
): {
  cpl: { kode: string; deskripsi: string }[];
  mataKuliah: unknown[];
  temuan: { kode: string; pesan: string; saran?: string; lokasi?: Record<string, string> }[];
} {
  const mkBermasalah = new Set(
    temuan.map((t) => t.lokasi?.mk).filter((k): k is string => Boolean(k)),
  );
  const mk = kurikulum.mataKuliah.filter((m) => mkBermasalah.has(m.kode));
  const cplTerpakai = new Set(mk.flatMap((m) => m.cplKode));

  return {
    cpl: kurikulum.cpl
      .filter((c) => cplTerpakai.has(c.kode))
      .map((c) => ({ kode: c.kode, deskripsi: c.deskripsi })),
    mataKuliah: mk.map((m) => ({
      kode: m.kode,
      nama: m.nama,
      semester: m.semester,
      sks: m.sksTeori + m.sksPraktik,
      cplDibebankan: m.cplKode,
      cpmk: m.cpmk.map((c) => ({
        kode: c.kode,
        rumusan: c.rumusan,
        levelBloom: c.levelBloom ?? null,
        cplDijabarkan: c.cplKode,
        subCpmk: c.subCpmk.map((s) => ({
          kode: s.kode,
          rumusan: s.rumusan,
          levelBloom: s.levelBloom ?? null,
        })),
      })),
    })),
    temuan: temuan.map((t) => ({
      kode: t.kode,
      pesan: t.pesan,
      saran: t.saran,
      lokasi: t.lokasi,
    })),
  };
}
