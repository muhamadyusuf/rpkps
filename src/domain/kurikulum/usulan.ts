import {
  hitungKkoBerbeda,
  levelDariRumusan,
  type LevelBloom,
} from "./bloom";
import type {
  CpmkInput,
  KurikulumInput,
  MataKuliahInput,
  SubCpmkInput,
  TemuanKurikulum,
} from "./tipe";
import { validasiKurikulum } from "./validator";

/**
 * Usulan Revisi Kurikulum — aturan murni.
 * Acuan: docs/04-usulan-revisi-kurikulum.md.
 *
 * Modul ini tidak menyentuh Prisma, AI, maupun React. Ia menjawab tiga
 * pertanyaan yang menentukan boleh-tidaknya sebuah usulan disahkan:
 *
 *   1. Apakah butirnya menunjuk sesuatu yang benar-benar ada? (`periksaButir`)
 *   2. Apa AKIBATNYA pada kurikulum bila diterapkan? (`periksaAkibat`)
 *   3. Bila mengaku ralat, benarkah maknanya tidak berubah? (`periksaJalurRalat`)
 *
 * Pertanyaan kedua adalah yang terpenting, dan cara menjawabnya sengaja tidak
 * dengan menulis ulang aturan kurikulum di sini: usulan disimulasikan lewat
 * `terapkanKeInput`, lalu hasilnya dilewatkan `validasiKurikulum` yang sudah
 * ada. Usulan dinilai dari akibatnya, bukan dari bentuknya — dan aturan
 * kurikulum tetap tinggal di satu tempat.
 */

export type JenisButir =
  | "CPMK_BARU"
  | "CPMK_RUMUSAN"
  | "CPMK_PETA_CPL"
  | "CPMK_PENSIUN"
  | "SUB_BARU"
  | "SUB_RUMUSAN"
  | "SUB_MINGGU"
  | "SUB_PENSIUN"
  | "CATATAN_CPL";

export type StatusButir = "BARU" | "DITERIMA" | "DISESUAIKAN" | "DITOLAK";

export type JenisDasar =
  | "TEMUAN_VALIDATOR"
  | "SINYAL_INDUSTRI"
  | "MASUKAN_DUDI"
  | "TRACER"
  | "CATATAN_DOSEN"
  | "TEMUAN_EVALUASI";

export interface DasarInput {
  jenis: JenisDasar;
  ref?: string | null;
  kutipan: string;
}

export interface ButirInput {
  id: string;
  jenis: JenisButir;
  /** Untuk *_BARU ini kode yang diusulkan; untuk sisanya kode yang sudah ada. */
  cpmkKode: string;
  subCpmkKode?: string | null;
  rumusan?: string | null;
  levelBloom?: LevelBloom | null;
  cplKode?: string[];
  mingguDisarankan?: number[];
  alasan: string;
  dasar: DasarInput[];
  status?: StatusButir;
}

export interface UsulanInput {
  mkKode: string;
  jalurRalat?: boolean;
  butir: ButirInput[];
}

export interface TemuanUsulan extends TemuanKurikulum {
  /** Butir yang ditunjuk temuan. Kosong berarti temuan tingkat usulan. */
  butirId?: string;
}

/** Butir yang menyentuh CPL/profil lulusan — selamanya di luar kewenangan URK. */
export const JENIS_TAK_DITERAPKAN: readonly JenisButir[] = ["CATATAN_CPL"];

const JENIS_PERLU_RUMUSAN: readonly JenisButir[] = [
  "CPMK_BARU",
  "CPMK_RUMUSAN",
  "SUB_BARU",
  "SUB_RUMUSAN",
];

const JENIS_SASARAN_SUB: readonly JenisButir[] = [
  "SUB_RUMUSAN",
  "SUB_MINGGU",
  "SUB_PENSIUN",
];

const PANJANG_ALASAN_MINIMAL = 20;
const PANJANG_KUTIPAN_MINIMAL = 12;

/** Butir yang dihitung sebagai diterima oleh Kaprodi. */
export function butirDipakai(butir: ButirInput[]): ButirInput[] {
  return butir.filter(
    (b) =>
      (b.status === "DITERIMA" || b.status === "DISESUAIKAN") &&
      !JENIS_TAK_DITERAPKAN.includes(b.jenis),
  );
}

// ─────────────────────────────────────────────────────────────
// 1. Pemeriksaan struktural
// ─────────────────────────────────────────────────────────────

/**
 * Memeriksa tiap butir terhadap kurikulum: rujukannya ada, kodenya belum
 * dipakai, isinya lengkap, dan dasarnya dibawa.
 *
 * Yang diperiksa di sini adalah hal-hal yang membuat penerapan MUSTAHIL atau
 * usulan tidak dapat dinilai. Mutu rumusan tidak diperiksa di sini — itu
 * urusan `periksaAkibat`, yang melihat kurikulum hasil secara utuh.
 */
export function periksaButir(
  kurikulum: KurikulumInput,
  usulan: UsulanInput,
): TemuanUsulan[] {
  const temuan: TemuanUsulan[] = [];
  const mk = kurikulum.mataKuliah.find((m) => m.kode === usulan.mkKode);

  if (!mk) {
    return [
      {
        kode: "U-MK-TIDAK-ADA",
        tingkat: "PEMBLOKIR",
        pesan: `Mata kuliah ${usulan.mkKode} tidak ada di kurikulum ini.`,
      },
    ];
  }

  if (usulan.butir.length === 0) {
    return [
      {
        kode: "U-TANPA-BUTIR",
        tingkat: "PEMBLOKIR",
        pesan: "Usulan belum berisi satu butir pun.",
      },
    ];
  }

  const kodeCpl = new Set(kurikulum.cpl.map((c) => c.kode));
  const kodeCpmkAda = new Set(mk.cpmk.map((c) => c.kode));
  const kodeSubAda = new Set(mk.cpmk.flatMap((c) => c.subCpmk.map((s) => s.kode)));
  /** Kode CPMK yang diperkenalkan usulan ini sendiri. */
  const kodeCpmkBaru = new Set(
    usulan.butir.filter((b) => b.jenis === "CPMK_BARU").map((b) => b.cpmkKode),
  );

  for (const b of usulan.butir) {
    const lokasi = { mk: mk.kode, cpmk: b.cpmkKode, ...(b.subCpmkKode ? { subCpmk: b.subCpmkKode } : {}) };
    const tandai = (kode: string, pesan: string, saran?: string) =>
      temuan.push({ kode, tingkat: "PEMBLOKIR", pesan, lokasi, saran, butirId: b.id });

    if (b.alasan.trim().length < PANJANG_ALASAN_MINIMAL) {
      tandai(
        "U-ALASAN-PENDEK",
        `Butir ${b.cpmkKode} belum menyertakan alasan yang dapat dinilai.`,
        "Sebutkan apa yang salah pada rumusan sekarang, bukan hanya bahwa ia perlu diganti.",
      );
    }

    // Dasar wajib. Inilah yang memisahkan revisi berbasis bukti dari karangan
    // model — doc 04 §2.3. Tanpa aturan ini, fitur ini jadi mesin mengarang
    // capaian yang terlihat rapi.
    const dasarSah = b.dasar.filter(
      (d) => d.kutipan.trim().length >= PANJANG_KUTIPAN_MINIMAL,
    );
    if (dasarSah.length === 0) {
      tandai(
        "U-TANPA-DASAR",
        `Butir ${b.cpmkKode} tidak membawa satu pun dasar.`,
        "Lampirkan temuan validator, sinyal industri, masukan DUDI, tracer study, atau argumen tertulis.",
      );
    }
    for (const d of dasarSah) {
      if (d.jenis !== "CATATAN_DOSEN" && !d.ref?.trim()) {
        tandai(
          "U-DASAR-TANPA-RUJUKAN",
          `Dasar ${d.jenis} pada butir ${b.cpmkKode} tidak menyebut sumber yang dapat ditelusuri.`,
          "Hanya CATATAN_DOSEN yang boleh tanpa rujukan.",
        );
      }
    }

    if (JENIS_PERLU_RUMUSAN.includes(b.jenis) && !b.rumusan?.trim()) {
      tandai("U-RUMUSAN-KOSONG", `Butir ${b.jenis} pada ${b.cpmkKode} belum berisi rumusan.`);
    }

    switch (b.jenis) {
      case "CPMK_BARU": {
        if (kodeCpmkAda.has(b.cpmkKode)) {
          tandai(
            "U-KODE-DIPAKAI",
            `Kode ${b.cpmkKode} sudah dipakai CPMK lain pada ${mk.kode}.`,
            "Kode tidak boleh didaur ulang — nomor CPMK di dokumen lama harus tetap berarti satu hal.",
          );
        }
        if ((b.cplKode ?? []).length === 0) {
          tandai(
            "U-CPMK-BARU-TANPA-CPL",
            `${b.cpmkKode} belum dipetakan ke satu pun CPL.`,
            "CPMK yang tidak menjabarkan CPL apa pun memutus rantai penelusuran OBE.",
          );
        }
        const punyaSub = usulan.butir.some(
          (x) => x.jenis === "SUB_BARU" && x.cpmkKode === b.cpmkKode,
        );
        if (!punyaSub) {
          tandai(
            "U-CPMK-BARU-TANPA-SUB",
            `${b.cpmkKode} belum diuraikan menjadi Sub-CPMK.`,
            "Tambahkan minimal satu butir SUB_BARU pada usulan yang sama.",
          );
        }
        break;
      }

      case "SUB_BARU": {
        // Induknya boleh CPMK yang sudah ada, boleh juga yang diperkenalkan
        // usulan ini sendiri — urutan penerapan yang mengurusnya.
        if (!kodeCpmkAda.has(b.cpmkKode) && !kodeCpmkBaru.has(b.cpmkKode)) {
          tandai("U-CPMK-TIDAK-ADA", `CPMK ${b.cpmkKode} tidak ada pada ${mk.kode}.`);
        }
        if (!b.subCpmkKode?.trim()) {
          tandai("U-SUB-KODE-KOSONG", `Sub-CPMK baru pada ${b.cpmkKode} belum diberi kode.`);
        } else if (kodeSubAda.has(b.subCpmkKode)) {
          tandai(
            "U-KODE-DIPAKAI",
            `Kode ${b.subCpmkKode} sudah dipakai Sub-CPMK lain pada ${mk.kode}.`,
          );
        }
        break;
      }

      case "CATATAN_CPL": {
        // Tidak menuntut apa pun selain alasan dan dasar: ia memang tidak
        // pernah diterapkan, hanya dibaca Kaprodi saat evaluasi kurikulum.
        break;
      }

      default: {
        if (!kodeCpmkAda.has(b.cpmkKode)) {
          tandai("U-CPMK-TIDAK-ADA", `CPMK ${b.cpmkKode} tidak ada pada ${mk.kode}.`);
        }
        if (JENIS_SASARAN_SUB.includes(b.jenis)) {
          if (!b.subCpmkKode) {
            tandai("U-SUB-KODE-KOSONG", `Butir ${b.jenis} harus menyebut Sub-CPMK sasaran.`);
          } else if (!kodeSubAda.has(b.subCpmkKode)) {
            tandai(
              "U-SUB-TIDAK-ADA",
              `Sub-CPMK ${b.subCpmkKode} tidak ada pada ${mk.kode}.`,
            );
          }
        }
      }
    }

    if (b.jenis === "CPMK_BARU" || b.jenis === "CPMK_PETA_CPL") {
      for (const kode of b.cplKode ?? []) {
        if (!kodeCpl.has(kode)) {
          tandai("U-CPL-TIDAK-ADA", `CPL ${kode} tidak ada di kurikulum ini.`);
        } else if (!mk.cplKode.includes(kode)) {
          tandai(
            "U-CPL-DILUAR-MK",
            `CPL ${kode} tidak dibebankan pada ${mk.kode}.`,
            "Membebankan CPL baru pada mata kuliah adalah keputusan matriks CPL×MK — di luar kewenangan usulan ini.",
          );
        }
      }
    }
  }

  return temuan;
}

// ─────────────────────────────────────────────────────────────
// 2. Simulasi & akibat
// ─────────────────────────────────────────────────────────────

/**
 * Menerapkan butir ke salinan kurikulum, tanpa menyentuh basis data.
 *
 * Dipakai dua kali: untuk memeriksa akibat sebelum pengesahan, dan sebagai
 * acuan tunggal urutan penerapan yang ditiru lapisan Prisma. Butir pensiun
 * membuang capaian dari salinan — sesuai maknanya di tahun akademik berlaku:
 * masih tercetak di dokumen lama, tidak lagi ditawarkan ke depan.
 */
export function terapkanKeInput(
  kurikulum: KurikulumInput,
  usulan: UsulanInput,
  butir: ButirInput[] = usulan.butir,
): KurikulumInput {
  const dipakai = butir.filter((b) => !JENIS_TAK_DITERAPKAN.includes(b.jenis));
  const hasil: KurikulumInput = salin(kurikulum);
  const mk = hasil.mataKuliah.find((m) => m.kode === usulan.mkKode);
  if (!mk) return hasil;

  const urut = (b: ButirInput) => (b.jenis === "CPMK_BARU" ? 0 : b.jenis === "SUB_BARU" ? 1 : 2);
  for (const b of [...dipakai].sort((a, z) => urut(a) - urut(z))) {
    terapkanSatu(mk, b);
  }
  return hasil;
}

function terapkanSatu(mk: MataKuliahInput, b: ButirInput) {
  const cpmk = mk.cpmk.find((c) => c.kode === b.cpmkKode);

  switch (b.jenis) {
    case "CPMK_BARU": {
      if (cpmk) return;
      mk.cpmk.push({
        kode: b.cpmkKode,
        rumusan: b.rumusan ?? "",
        levelBloom: b.levelBloom ?? levelDariRumusan(b.rumusan ?? ""),
        cplKode: [...(b.cplKode ?? [])],
        subCpmk: [],
      });
      return;
    }
    case "CPMK_RUMUSAN": {
      if (!cpmk) return;
      cpmk.rumusan = b.rumusan ?? cpmk.rumusan;
      cpmk.levelBloom = b.levelBloom ?? levelDariRumusan(cpmk.rumusan);
      return;
    }
    case "CPMK_PETA_CPL": {
      if (!cpmk) return;
      cpmk.cplKode = [...(b.cplKode ?? [])];
      return;
    }
    case "CPMK_PENSIUN": {
      mk.cpmk = mk.cpmk.filter((c) => c.kode !== b.cpmkKode);
      return;
    }
    case "SUB_BARU": {
      if (!cpmk || !b.subCpmkKode) return;
      cpmk.subCpmk.push({
        kode: b.subCpmkKode,
        rumusan: b.rumusan ?? "",
        levelBloom: b.levelBloom ?? levelDariRumusan(b.rumusan ?? ""),
      });
      return;
    }
    case "SUB_RUMUSAN": {
      const sub = cariSub(cpmk, b.subCpmkKode);
      if (!sub) return;
      sub.rumusan = b.rumusan ?? sub.rumusan;
      sub.levelBloom = b.levelBloom ?? levelDariRumusan(sub.rumusan);
      return;
    }
    case "SUB_PENSIUN": {
      if (!cpmk) return;
      cpmk.subCpmk = cpmk.subCpmk.filter((s) => s.kode !== b.subCpmkKode);
      return;
    }
    // SUB_MINGGU tidak mengubah rumusan apa pun, jadi tidak berpengaruh pada
    // validasi kurikulum. Ia hanya berarti di lapisan basis data.
    default:
      return;
  }
}

function cariSub(cpmk: CpmkInput | undefined, kode?: string | null): SubCpmkInput | undefined {
  if (!cpmk || !kode) return undefined;
  return cpmk.subCpmk.find((s) => s.kode === kode);
}

function salin(k: KurikulumInput): KurikulumInput {
  return {
    ...k,
    cpl: k.cpl.map((c) => ({ ...c })),
    mataKuliah: k.mataKuliah.map((m) => ({
      ...m,
      cplKode: [...m.cplKode],
      cpmk: m.cpmk.map((c) => ({
        ...c,
        cplKode: [...c.cplKode],
        subCpmk: c.subCpmk.map((s) => ({ ...s })),
      })),
    })),
  };
}

/**
 * Temuan yang MUNCUL karena usulan ini, bukan yang sudah ada sebelumnya.
 *
 * Selisihnya penting. Kurikulum warisan hampir selalu sudah membawa temuan
 * sendiri; kalau semuanya ditampilkan di halaman keputusan, Kaprodi tidak bisa
 * membedakan mana yang salah pengusul dan mana yang salah kurikulum lama —
 * lalu berhenti membacanya. Usulan hanya dipertanggungjawabkan atas kerusakan
 * yang ia bawa sendiri.
 */
export function periksaAkibat(
  kurikulum: KurikulumInput,
  usulan: UsulanInput,
  butir: ButirInput[] = usulan.butir,
): TemuanUsulan[] {
  const sebelum = kunciTemuan(validasiKurikulum(kurikulum).temuan);
  const sesudah = validasiKurikulum(terapkanKeInput(kurikulum, usulan, butir)).temuan;

  return sesudah
    .filter((t) => !sebelum.has(kunci(t)))
    .map((t) => ({ ...t, butirId: butirTerkait(butir, t) }));
}

function kunci(t: TemuanKurikulum): string {
  const lokasi = t.lokasi ?? {};
  return [t.kode, lokasi.mk, lokasi.cpmk, lokasi.subCpmk, lokasi.cpl].join("|");
}

function kunciTemuan(daftar: TemuanKurikulum[]): Set<string> {
  return new Set(daftar.map(kunci));
}

/** Menautkan temuan hasil ke butir yang paling mungkin menyebabkannya. */
function butirTerkait(butir: ButirInput[], t: TemuanKurikulum): string | undefined {
  const lokasi = t.lokasi ?? {};
  const cocokSub = butir.find(
    (b) => lokasi.subCpmk && b.subCpmkKode === lokasi.subCpmk,
  );
  if (cocokSub) return cocokSub.id;
  return butir.find((b) => lokasi.cpmk && b.cpmkKode === lokasi.cpmk)?.id;
}

// ─────────────────────────────────────────────────────────────
// 3. Jalur ralat
// ─────────────────────────────────────────────────────────────

/** Ambang jarak sunting yang masih dianggap ralat ejaan, bukan perubahan makna. */
const RALAT_JARAK_MUTLAK = 6;
const RALAT_JARAK_NISBI = 0.08;

/**
 * Menegakkan syarat jalur ralat (doc 04 §8.2).
 *
 * Ralat boleh berlaku SEGERA, di tengah semester berjalan — karena itu
 * syaratnya tidak boleh bergantung pada pengakuan pengusul. Yang dianggap
 * ralat: perbaikan ejaan atau tanda baca yang tidak menggeser kata kerja
 * operasional, tidak menggeser level Bloom, dan hanya menyentuh sebagian kecil
 * karakter. Selain itu, sekecil apa pun, ia perubahan makna dan harus antre ke
 * tahun akademik berikutnya.
 */
export function periksaJalurRalat(
  kurikulum: KurikulumInput,
  usulan: UsulanInput,
): TemuanUsulan[] {
  if (!usulan.jalurRalat) return [];
  const temuan: TemuanUsulan[] = [];
  const mk = kurikulum.mataKuliah.find((m) => m.kode === usulan.mkKode);

  for (const b of usulan.butir) {
    const tolak = (pesan: string, saran?: string) =>
      temuan.push({
        kode: "U-RALAT-BUKAN-EJAAN",
        tingkat: "PEMBLOKIR",
        pesan,
        saran: saran ?? "Lepaskan tanda ralat; usulan ini berlaku mulai tahun akademik berikutnya.",
        lokasi: { mk: usulan.mkKode, cpmk: b.cpmkKode },
        butirId: b.id,
      });

    if (b.jenis !== "CPMK_RUMUSAN" && b.jenis !== "SUB_RUMUSAN") {
      tolak(`Butir ${b.jenis} tidak dapat ditempuh lewat jalur ralat.`);
      continue;
    }

    const cpmk = mk?.cpmk.find((c) => c.kode === b.cpmkKode);
    const lama =
      b.jenis === "CPMK_RUMUSAN" ? cpmk?.rumusan : cariSub(cpmk, b.subCpmkKode)?.rumusan;
    const baru = b.rumusan ?? "";
    if (!lama) continue; // sudah dilaporkan periksaButir

    if (levelDariRumusan(lama) !== levelDariRumusan(baru)) {
      tolak(`Perbaikan pada ${b.subCpmkKode ?? b.cpmkKode} menggeser level Bloom rumusan.`);
      continue;
    }
    const kkoLama = hitungKkoBerbeda(lama).sort().join(",");
    const kkoBaru = hitungKkoBerbeda(baru).sort().join(",");
    if (kkoLama !== kkoBaru) {
      tolak(
        `Perbaikan pada ${b.subCpmkKode ?? b.cpmkKode} mengubah kata kerja operasionalnya.`,
      );
      continue;
    }
    const ambang = Math.max(RALAT_JARAK_MUTLAK, Math.round(lama.length * RALAT_JARAK_NISBI));
    const jarak = jarakSunting(lama, baru);
    if (jarak > ambang) {
      tolak(
        `Perbaikan pada ${b.subCpmkKode ?? b.cpmkKode} mengubah ${jarak} karakter, melebihi ambang ralat (${ambang}).`,
      );
    }
  }

  return temuan;
}

/** Jarak Levenshtein. Cukup untuk rumusan sepanjang satu-dua kalimat. */
export function jarakSunting(a: string, b: string): number {
  const s = a.trim();
  const t = b.trim();
  if (s === t) return 0;
  let baris = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const berikut = [i];
    for (let j = 1; j <= t.length; j++) {
      berikut[j] = Math.min(
        baris[j] + 1,
        berikut[j - 1] + 1,
        baris[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    baris = berikut;
  }
  return baris[t.length];
}

// ─────────────────────────────────────────────────────────────
// 4. Konsistensi keputusan & ringkasan
// ─────────────────────────────────────────────────────────────

/**
 * Memeriksa keputusan per butir sebelum pengesahan.
 *
 * Menyetujui sebagian adalah hal biasa, tetapi sebagian kombinasi tidak dapat
 * diterapkan: Sub-CPMK yang induknya ditolak tidak punya tempat mendarat.
 */
export function periksaKonsistensiKeputusan(usulan: UsulanInput): TemuanUsulan[] {
  const temuan: TemuanUsulan[] = [];
  const dipakai = butirDipakai(usulan.butir);
  const indukDipakai = new Set(
    dipakai.filter((b) => b.jenis === "CPMK_BARU").map((b) => b.cpmkKode),
  );
  const indukDiusulkan = new Set(
    usulan.butir.filter((b) => b.jenis === "CPMK_BARU").map((b) => b.cpmkKode),
  );

  for (const b of dipakai) {
    if (
      b.jenis === "SUB_BARU" &&
      indukDiusulkan.has(b.cpmkKode) &&
      !indukDipakai.has(b.cpmkKode)
    ) {
      temuan.push({
        kode: "U-INDUK-DITOLAK",
        tingkat: "PEMBLOKIR",
        pesan: `${b.subCpmkKode} diterima, tetapi CPMK induknya (${b.cpmkKode}) ditolak.`,
        saran: "Tolak juga Sub-CPMK ini, atau terima CPMK induknya.",
        lokasi: { cpmk: b.cpmkKode },
        butirId: b.id,
      });
    }
  }

  if (dipakai.length === 0) {
    const adaCatatan = usulan.butir.some((b) => b.jenis === "CATATAN_CPL");
    if (!adaCatatan) {
      temuan.push({
        kode: "U-TANPA-BUTIR-DITERIMA",
        tingkat: "PEMBLOKIR",
        pesan: "Tidak ada butir yang diterima, jadi tidak ada yang dapat diterapkan.",
        saran: "Tolak usulan ini, atau kembalikan untuk revisi.",
      });
    }
  }

  return temuan;
}

export interface HasilPeriksaUsulan {
  temuan: TemuanUsulan[];
  pemblokir: TemuanUsulan[];
  lolos: boolean;
}

/** Pemeriksaan lengkap saat usulan diajukan. */
export function periksaUsulanRevisi(
  kurikulum: KurikulumInput,
  usulan: UsulanInput,
): HasilPeriksaUsulan {
  const struktural = periksaButir(kurikulum, usulan);
  // Akibat hanya bermakna bila rujukannya sudah benar; menjalankannya di atas
  // butir yang menunjuk entitas tak ada hanya menghasilkan temuan menyesatkan.
  const adaPemblokirStruktural = struktural.some((t) => t.tingkat === "PEMBLOKIR");
  const temuan = [
    ...struktural,
    ...periksaJalurRalat(kurikulum, usulan),
    ...(adaPemblokirStruktural ? [] : periksaAkibat(kurikulum, usulan)),
  ];
  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");
  return { temuan, pemblokir, lolos: pemblokir.length === 0 };
}

/** Pemeriksaan lengkap saat usulan hendak diterapkan ke kurikulum. */
export function periksaPenerapan(
  kurikulum: KurikulumInput,
  usulan: UsulanInput,
): HasilPeriksaUsulan {
  const dipakai = butirDipakai(usulan.butir);
  const konsistensi = periksaKonsistensiKeputusan(usulan);
  const temuan = [
    ...konsistensi,
    ...(konsistensi.some((t) => t.tingkat === "PEMBLOKIR")
      ? []
      : periksaAkibat(kurikulum, usulan, dipakai)),
  ];
  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");
  return { temuan, pemblokir, lolos: pemblokir.length === 0 };
}

const LABEL_JENIS: Record<JenisButir, string> = {
  CPMK_BARU: "CPMK baru",
  CPMK_RUMUSAN: "rumusan CPMK diubah",
  CPMK_PETA_CPL: "peta CPL diubah",
  CPMK_PENSIUN: "CPMK dipensiunkan",
  SUB_BARU: "Sub-CPMK baru",
  SUB_RUMUSAN: "rumusan Sub-CPMK diubah",
  SUB_MINGGU: "minggu disarankan diubah",
  SUB_PENSIUN: "Sub-CPMK dipensiunkan",
  CATATAN_CPL: "catatan untuk evaluasi kurikulum",
};

export function labelJenisButir(jenis: JenisButir): string {
  return LABEL_JENIS[jenis];
}

/**
 * Ringkasan satu kalimat untuk ledger revisi dan histori RPKPS.
 * Contoh: "TI214: 1 CPMK baru, 2 rumusan Sub-CPMK diubah".
 */
export function ringkasPenerapan(mkKode: string, butir: ButirInput[]): string {
  const dipakai = butirDipakai(butir);
  if (dipakai.length === 0) return `${mkKode}: tidak ada perubahan diterapkan`;

  const hitung = new Map<JenisButir, number>();
  for (const b of dipakai) hitung.set(b.jenis, (hitung.get(b.jenis) ?? 0) + 1);

  const bagian = [...hitung.entries()]
    .sort((a, z) => z[1] - a[1])
    .map(([jenis, n]) => `${n} ${LABEL_JENIS[jenis]}`);
  return `${mkKode}: ${bagian.join(", ")}`;
}
