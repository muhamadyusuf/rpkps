import { LEVEL_BLOOM, type LevelBloom } from "./bloom";
import {
  JENIS_TAK_DITERAPKAN,
  type ButirInput,
  type DasarInput,
  type JenisButir,
  type JenisDasar,
} from "./usulan";

/**
 * Penyaring draf AI untuk Usulan Revisi Kurikulum — fase U3a.
 * Acuan: docs/04-usulan-revisi-kurikulum.md §9.3–9.4.
 *
 * Modul ini berdiri di antara keluaran model dan basis data, dan menjawab satu
 * pertanyaan yang tidak dapat dijawab `periksaButir`:
 *
 *   **Apakah butir ini dikarang?**
 *
 * Pembagiannya begitu: `periksaButir` menilai apakah sebuah butir DAPAT
 * DITERAPKAN pada kurikulum, dan temuannya memblokir usulan. Modul ini menilai
 * apakah sebuah butir BOLEH ADA sama sekali, dan butir yang tidak lolos
 * dibuang sebelum menyentuh basis data. Konsekuensinya berbeda, jadi keduanya
 * memang memeriksa hal yang bersinggungan — bukan duplikasi.
 *
 * Poros seluruh rancangan U3 (§9.2):
 *
 *   > AI boleh menyusun butir. AI tidak pernah boleh menerbitkan dasar.
 *
 * Karena itu model tidak mengirim `kutipan`. Ia hanya menyebut RUJUKAN ke
 * katalog dasar yang tadi dirakit server, dan kutipannya disalin dari katalog
 * itu — bukan dari jawaban model. Satu-satunya kutipan yang boleh datang dari
 * jawaban model adalah potongan verbatim catatan yang diketik dosen sendiri,
 * dan keverbatimannya diuji di sini, bukan dipercaya.
 *
 * Modul ini murni: tanpa Prisma, tanpa React, tanpa AI. Ia dapat diuji dengan
 * keluaran model palsu, dan memang begitulah ia diuji.
 */

/** Butir mentah dari model. Sengaja bertipe longgar: model bisa mengarang apa saja. */
export interface ButirDraf {
  jenis: string;
  cpmkKode: string;
  subCpmkKode?: string | null;
  rumusan?: string | null;
  levelBloom?: string | null;
  cplKode?: string[] | null;
  mingguDisarankan?: number[] | null;
  alasan: string;
  /** Rujukan ke katalog dasar. Model MEMILIH, tidak menulis. */
  dasarRef?: string[] | null;
  /** Potongan verbatim catatan dosen, bila butir ini bersandar padanya. */
  kutipanCatatan?: string | null;
}

/**
 * Satu dasar yang benar-benar ada, dirakit server sebelum model dipanggil.
 * `sasaran` mengikat dasar pada capaian tertentu bila memang spesifik.
 */
export interface DasarTersedia {
  /** Rujukan stabil: kode temuan validator, atau id baris temuan evaluasi. */
  ref: string;
  jenis: Extract<JenisDasar, "TEMUAN_VALIDATOR" | "TEMUAN_EVALUASI">;
  kutipan: string;
  cpmkKode?: string | null;
  subCpmkKode?: string | null;
}

export interface BahanDraf {
  mkKode: string;
  /** Kode CPMK yang sudah ada pada mata kuliah ini. */
  cpmkKode: string[];
  /** Kode Sub-CPMK yang sudah ada pada mata kuliah ini. */
  subCpmkKode: string[];
  /** CPL yang dibebankan pada mata kuliah — batas sah bagi CPMK_PETA_CPL. */
  cplDibebankan: string[];
  dasar: DasarTersedia[];
  /** Catatan yang diketik dosen. Kosong berarti CATATAN_DOSEN tidak tersedia. */
  catatanDosen?: string | null;
}

export interface ButirDibuang {
  /** Posisi butir pada jawaban model, supaya panel dapat menyebutnya. */
  indeks: number;
  sasaran: string;
  kode: string;
  alasan: string;
}

export interface HasilSaring {
  butir: ButirInput[];
  dibuang: ButirDibuang[];
}

/**
 * Jenis butir yang boleh lahir dari draf AI.
 *
 * `CPMK_PENSIUN` dan `SUB_PENSIUN` sengaja di luar daftar (§9.4, disetujui 30
 * Agustus 2026). Mempensiunkan capaian adalah penilaian atas program, bukan
 * perbaikan kalimat, dan akibatnya menjangkau RPKPS tahun berikutnya. Jalurnya
 * tetap manual.
 *
 * `CATATAN_CPL` justru DIIZINKAN: di situlah temuan "ini sebenarnya soal CPL"
 * seharusnya mendarat, dan ia memang tidak pernah diterapkan otomatis (§2.2).
 */
export const JENIS_BOLEH_AI: readonly JenisButir[] = [
  "CPMK_BARU",
  "CPMK_RUMUSAN",
  "CPMK_PETA_CPL",
  "SUB_BARU",
  "SUB_RUMUSAN",
  "SUB_MINGGU",
  "CATATAN_CPL",
];

const JENIS_PERLU_RUMUSAN: readonly JenisButir[] = [
  "CPMK_BARU",
  "CPMK_RUMUSAN",
  "SUB_BARU",
  "SUB_RUMUSAN",
];

/** Jenis yang sasarannya sebuah Sub-CPMK yang sudah ada. */
const JENIS_SASARAN_SUB: readonly JenisButir[] = ["SUB_RUMUSAN", "SUB_MINGGU"];

const PANJANG_ALASAN_MINIMAL = 20;
const PANJANG_KUTIPAN_MINIMAL = 12;
const MINGGU_MAKSIMAL = 24;

const LEVEL_SAH = new Set<string>(LEVEL_BLOOM.map((l) => l.level));

function rapikanKode(k: string): string {
  return k.trim().toUpperCase();
}

/** Menyamakan spasi dan huruf agar pencocokan verbatim tidak gagal karena tata letak. */
function normalkan(teks: string): string {
  return teks.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Menyaring keluaran model menjadi butir yang boleh disimpan.
 *
 * Butir yang tidak lolos TIDAK dibuang diam-diam: alasannya dikembalikan
 * supaya panel dapat menyebutkannya kepada dosen (§9.3). Draf yang separuhnya
 * dibuang tanpa keterangan akan terbaca sebagai model yang bekerja baik,
 * padahal justru sebaliknya.
 */
export function saringDrafUsulan(bahan: BahanDraf, draf: ButirDraf[]): HasilSaring {
  const cpmkAda = new Set(bahan.cpmkKode.map(rapikanKode));
  const subAda = new Set(bahan.subCpmkKode.map(rapikanKode));
  const cplSah = new Set(bahan.cplDibebankan.map(rapikanKode));
  const katalog = new Map(bahan.dasar.map((d) => [d.ref.trim(), d]));
  const catatan = bahan.catatanDosen?.trim() ? normalkan(bahan.catatanDosen) : null;

  const butir: ButirInput[] = [];
  const dibuang: ButirDibuang[] = [];
  /** Sasaran yang sudah terpakai — satu butir per sasaran (§9.4). */
  const sasaranTerpakai = new Set<string>();
  /** Kode CPMK yang diperkenalkan draf ini sendiri, agar SUB_BARU boleh menempel padanya. */
  const cpmkBaru = new Set<string>();

  draf.forEach((d, indeks) => {
    const cpmkKode = rapikanKode(d.cpmkKode ?? "");
    const subCpmkKode = d.subCpmkKode ? rapikanKode(d.subCpmkKode) : null;
    const sasaran = subCpmkKode ? `${cpmkKode}/${subCpmkKode}` : cpmkKode;

    const buang = (kode: string, alasan: string) => {
      dibuang.push({ indeks, sasaran: sasaran || `butir ke-${indeks + 1}`, kode, alasan });
    };

    // ── 1 · Jenis harus termasuk yang diizinkan ────────────────────────
    const jenis = d.jenis?.trim().toUpperCase() as JenisButir;
    if (!JENIS_BOLEH_AI.includes(jenis)) {
      buang(
        "D-JENIS-TERLARANG",
        `Jenis butir "${d.jenis}" tidak boleh disusun AI.`,
      );
      return;
    }

    if (!cpmkKode) {
      buang("D-TANPA-SASARAN", "Butir tidak menyebut CPMK sasaran.");
      return;
    }

    // ── 2 · Kode harus menunjuk sesuatu yang nyata ─────────────────────
    if (jenis === "CPMK_BARU") {
      if (cpmkAda.has(cpmkKode)) {
        buang("D-KODE-BENTROK", `Kode ${cpmkKode} sudah dipakai CPMK yang ada.`);
        return;
      }
      cpmkBaru.add(cpmkKode);
    } else if (!cpmkAda.has(cpmkKode) && !cpmkBaru.has(cpmkKode)) {
      buang("D-KODE-TIDAK-DIKENAL", `CPMK ${cpmkKode} tidak ada pada mata kuliah ini.`);
      return;
    }

    if (jenis === "SUB_BARU") {
      if (!subCpmkKode) {
        buang("D-TANPA-SASARAN", "SUB_BARU tidak menyebut kode Sub-CPMK yang diusulkan.");
        return;
      }
      if (subAda.has(subCpmkKode)) {
        buang("D-KODE-BENTROK", `Kode ${subCpmkKode} sudah dipakai Sub-CPMK yang ada.`);
        return;
      }
    } else if (JENIS_SASARAN_SUB.includes(jenis)) {
      if (!subCpmkKode) {
        buang("D-TANPA-SASARAN", `${jenis} tidak menyebut Sub-CPMK sasaran.`);
        return;
      }
      if (!subAda.has(subCpmkKode)) {
        buang(
          "D-KODE-TIDAK-DIKENAL",
          `Sub-CPMK ${subCpmkKode} tidak ada pada mata kuliah ini.`,
        );
        return;
      }
    }

    // ── 3 · Isi yang membuat butir berguna ─────────────────────────────
    const rumusan = d.rumusan?.trim() || null;
    if (JENIS_PERLU_RUMUSAN.includes(jenis) && !rumusan) {
      buang("D-RUMUSAN-KOSONG", `${jenis} tidak membawa rumusan.`);
      return;
    }

    const alasan = d.alasan?.trim() ?? "";
    if (alasan.length < PANJANG_ALASAN_MINIMAL) {
      buang(
        "D-ALASAN-PENDEK",
        "Alasan terlalu ringkas untuk dinilai Kaprodi.",
      );
      return;
    }

    const level = d.levelBloom?.trim().toUpperCase() || null;
    if (level && !LEVEL_SAH.has(level)) {
      buang("D-LEVEL-ASING", `Level Bloom "${d.levelBloom}" tidak dikenal.`);
      return;
    }

    // CPL hanya boleh dari yang dibebankan pada mata kuliah ini. Mengarang
    // kode CPL adalah cara tercepat merusak matriks CPL×MK seluruh prodi.
    const cplKode = (d.cplKode ?? []).map(rapikanKode).filter((k) => k.length > 0);
    const cplAsing = cplKode.filter((k) => !cplSah.has(k));
    if (cplAsing.length > 0) {
      buang(
        "D-CPL-ASING",
        `CPL ${cplAsing.join(", ")} tidak dibebankan pada mata kuliah ini.`,
      );
      return;
    }
    if (jenis === "CPMK_PETA_CPL" && cplKode.length === 0) {
      buang("D-PETA-KOSONG", "CPMK_PETA_CPL tidak menyebut satu pun CPL.");
      return;
    }

    const minggu = (d.mingguDisarankan ?? []).filter(
      (m) => Number.isInteger(m) && m >= 1 && m <= MINGGU_MAKSIMAL,
    );

    // ── 4 · Dasar — inti seluruh modul ini ─────────────────────────────
    const dasar = kumpulkanDasar(d, { katalog, catatan, cpmkKode, subCpmkKode });
    if ("galat" in dasar) {
      buang(dasar.galat.kode, dasar.galat.pesan);
      return;
    }

    // ── 5 · Satu butir per sasaran ─────────────────────────────────────
    const kunci = `${jenis}:${sasaran}`;
    if (sasaranTerpakai.has(kunci)) {
      buang("D-SASARAN-GANDA", `Sudah ada butir ${jenis} untuk ${sasaran}.`);
      return;
    }
    sasaranTerpakai.add(kunci);

    butir.push({
      id: `d${indeks + 1}`,
      jenis,
      cpmkKode,
      subCpmkKode,
      rumusan,
      levelBloom: (level as LevelBloom | null) ?? null,
      cplKode,
      mingguDisarankan: minggu,
      alasan,
      dasar: dasar.dasar,
    });
  });

  return { butir, dibuang };
}

/**
 * Menyusun dasar sebuah butir dari katalog, bukan dari jawaban model.
 *
 * Dua aturan yang tidak boleh dilonggarkan:
 *
 *  1. **Kutipan disalin dari katalog.** Model hanya menyebut `ref`. Kalau model
 *     boleh mengirim kutipannya sendiri, ia dapat menempelkan kode temuan yang
 *     asli pada kalimat karangannya, dan Kaprodi membaca bukti yang tidak
 *     pernah ada.
 *  2. **Dasar harus menunjuk sasaran yang sama.** Temuan pada CPMK081-3 bukan
 *     alasan mengubah CPMK081-7. Bentuk penyelewengan ini paling halus: seluruh
 *     rujukannya nyata, hanya pasangannya yang salah.
 */
function kumpulkanDasar(
  d: ButirDraf,
  konteks: {
    katalog: Map<string, DasarTersedia>;
    catatan: string | null;
    cpmkKode: string;
    subCpmkKode: string | null;
  },
): { dasar: DasarInput[] } | { galat: { kode: string; pesan: string } } {
  const dasar: DasarInput[] = [];

  for (const refMentah of d.dasarRef ?? []) {
    const ref = refMentah?.trim();
    if (!ref) continue;

    const sumber = konteks.katalog.get(ref);
    if (!sumber) {
      return {
        galat: {
          kode: "D-DASAR-KARANGAN",
          pesan: `Dasar "${ref}" tidak ada pada bahan yang diberikan.`,
        },
      };
    }

    /**
     * Dasar hanya sah bagi sasarannya sendiri — dengan satu kelonggaran yang
     * memang benar: temuan pada sebuah Sub-CPMK boleh menjadi dasar perbaikan
     * CPMK INDUKNYA. Itu bukan celah, itu perbaikan yang sudah didokumentasikan
     * — `K-SUB-LEVEL-LEBIH-TINGGI` justru sering diselesaikan dengan menaikkan
     * level CPMK induk, bukan menurunkan Sub-CPMK-nya.
     *
     * Yang tetap tertutup rapat: kode CPMK wajib sama. Temuan di bawah CPMK081
     * tidak akan pernah menjadi dasar mengubah CPMK062, dan temuan pada
     * CPMK081-3 tidak menjadi dasar mengubah CPMK081-7.
     */
    const cpmkBeda =
      !!sumber.cpmkKode && rapikanKode(sumber.cpmkKode) !== konteks.cpmkKode;
    const subBeda =
      !!sumber.subCpmkKode &&
      konteks.subCpmkKode !== null &&
      rapikanKode(sumber.subCpmkKode) !== konteks.subCpmkKode;
    if (cpmkBeda || subBeda) {
      return {
        galat: {
          kode: "D-DASAR-BEDA-SASARAN",
          pesan:
            `Dasar "${ref}" menyangkut ` +
            `${sumber.subCpmkKode ?? sumber.cpmkKode}, bukan sasaran butir ini.`,
        },
      };
    }

    dasar.push({ jenis: sumber.jenis, ref: sumber.ref, kutipan: sumber.kutipan });
  }

  // Catatan dosen: kutipannya wajib VERBATIM dari yang diketik dosen sendiri.
  const kutipan = d.kutipanCatatan?.trim();
  if (kutipan) {
    if (!konteks.catatan) {
      return {
        galat: {
          kode: "D-CATATAN-TIDAK-ADA",
          pesan: "Butir mengutip catatan dosen, padahal dosen tidak menulis catatan.",
        },
      };
    }
    if (kutipan.length < PANJANG_KUTIPAN_MINIMAL) {
      return {
        galat: {
          kode: "D-KUTIPAN-PENDEK",
          pesan: "Kutipan catatan dosen terlalu pendek untuk menjadi dasar.",
        },
      };
    }
    if (!konteks.catatan.includes(normalkan(kutipan))) {
      return {
        galat: {
          kode: "D-KUTIPAN-KARANGAN",
          pesan: "Kutipan tidak terdapat pada catatan yang ditulis dosen.",
        },
      };
    }
    dasar.push({ jenis: "CATATAN_DOSEN", ref: null, kutipan });
  }

  if (dasar.length === 0) {
    return {
      galat: {
        kode: "D-TANPA-DASAR",
        pesan: "Butir tidak bersandar pada satu pun temuan atau catatan.",
      },
    };
  }

  return { dasar };
}

/**
 * Ringkasan untuk panel pratinjau: berapa yang lolos, berapa dibuang, dan
 * karena apa. Dipakai U3c; ditaruh di sini agar kalimatnya ikut teruji.
 */
export function ringkasSaringan(hasil: HasilSaring): string {
  if (hasil.dibuang.length === 0) {
    return `${hasil.butir.length} butir tersusun, tidak ada yang dibuang.`;
  }

  const perKode = new Map<string, number>();
  for (const b of hasil.dibuang) {
    perKode.set(b.kode, (perKode.get(b.kode) ?? 0) + 1);
  }
  const rincian = [...perKode.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kode, n]) => `${n} ${kode}`)
    .join(", ");

  return (
    `${hasil.butir.length} butir tersusun, ${hasil.dibuang.length} dibuang ` +
    `(${rincian}).`
  );
}

/** Butir jenis ini tidak pernah dapat diterapkan otomatis — dipakai panel untuk menandainya. */
export function hanyaCatatan(butir: ButirInput): boolean {
  return JENIS_TAK_DITERAPKAN.includes(butir.jenis);
}
