import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import type { CapaianButir, TingkatCapaian } from "./capaian";

/**
 * Tindak lanjut dan verifikasinya — tahap E4 pada
 * docs/05-evaluasi-ketercapaian-mk.md §5.6.
 *
 * Ini huruf P kedua dan ketiga pada PPEPP: pengendalian dan peningkatan.
 * Angka ketercapaian tanpa bagian ini adalah angka tanpa akibat — persis
 * keluhan asesor terhadap kebanyakan prodi.
 *
 * Aturan yang paling menentukan ada di `periksaPenutupan`: evaluasi tidak
 * boleh ditutup selama masih ada CPMK yang tidak tercapai tanpa tindak
 * lanjut. Dengan begitu siklusnya ditegakkan kode, bukan diserahkan pada
 * kerelaan pengisi borang.
 */

/** Panjang minimum akar masalah dan tindakan. */
export const MIN_AKAR_MASALAH = 20;
export const MIN_TINDAKAN = 20;
/** Panjang minimum refleksi pelaksanaan. */
export const MIN_CATATAN_PROSES = 40;

export interface TemuanInput {
  tingkat: TingkatCapaian;
  kode: string;
  akarMasalah: string;
  tindakan: string;
  taSasaranId: string | null;
}

export function periksaTemuan(t: TemuanInput): TemuanRpkps[] {
  const temuan: TemuanRpkps[] = [];

  if (t.akarMasalah.trim().length < MIN_AKAR_MASALAH) {
    temuan.push({
      kode: "TL-AKAR-PENDEK",
      tingkat: "PEMBLOKIR",
      pesan: `Akar masalah ${t.kode} terlalu pendek (minimal ${MIN_AKAR_MASALAH} karakter).`,
      saran: "\"Mahasiswa kurang belajar\" bukan akar masalah — sebut apa pada rancangan atau pelaksanaan yang membuatnya begitu.",
    });
  }
  if (t.tindakan.trim().length < MIN_TINDAKAN) {
    temuan.push({
      kode: "TL-TINDAKAN-PENDEK",
      tingkat: "PEMBLOKIR",
      pesan: `Tindakan untuk ${t.kode} terlalu pendek (minimal ${MIN_TINDAKAN} karakter).`,
      saran: "Tindakan harus dapat diperiksa semester depan: apa yang diubah, oleh siapa.",
    });
  }
  if (!t.taSasaranId) {
    temuan.push({
      kode: "TL-TANPA-TA-SASARAN",
      tingkat: "PEMBLOKIR",
      pesan: `Tindakan untuk ${t.kode} belum menyebut tahun akademik pemberlakuannya.`,
      saran: "Tanpa TA sasaran, tindak lanjut tidak pernah punya waktu jatuh tempo dan tidak dapat diverifikasi.",
    });
  }

  return temuan;
}

export interface ArgPenutupan {
  butir: readonly CapaianButir[];
  temuan: readonly TemuanInput[];
  catatanProses: string | null;
  /** Temuan pemblokir dari `hitungCapaian` — ikut menahan penutupan. */
  pemblokirCapaian: readonly TemuanRpkps[];
}

export interface HasilPenutupan {
  temuan: TemuanRpkps[];
  pemblokir: TemuanRpkps[];
  dapatDitutup: boolean;
}

export function periksaPenutupan(arg: ArgPenutupan): HasilPenutupan {
  const temuan: TemuanRpkps[] = [...arg.pemblokirCapaian];

  // Refleksi pelaksanaan tidak dapat dihitung mesin, dan tanpanya laporan
  // hanya berisi angka. Bagian inilah yang dibaca asesor lebih dulu.
  if ((arg.catatanProses ?? "").trim().length < MIN_CATATAN_PROSES) {
    temuan.push({
      kode: "TL-TANPA-REFLEKSI",
      tingkat: "PEMBLOKIR",
      pesan: `Catatan proses pembelajaran belum diisi (minimal ${MIN_CATATAN_PROSES} karakter).`,
      saran: "Apa yang berjalan seperti rencana, apa yang tidak, dan mengapa.",
    });
  }

  const berTemuan = new Set(arg.temuan.map((t) => `${t.tingkat}|${t.kode}`));

  const belumTercapai = arg.butir.filter((b) => b.tingkat === "CPMK" && !b.tercapai);
  const tanpaRtl = belumTercapai.filter((b) => !berTemuan.has(`CPMK|${b.kode}`));
  if (tanpaRtl.length > 0) {
    temuan.push({
      kode: "TL-TANPA-RTL",
      tingkat: "PEMBLOKIR",
      pesan:
        `${tanpaRtl.length} CPMK tidak tercapai dan belum punya tindak lanjut: ` +
        `${tanpaRtl.map((b) => b.kode).join(", ")}.`,
      saran:
        "Inilah yang membedakan evaluasi dari laporan nilai. CPMK yang gagal tanpa tindak lanjut berarti siklus PPEPP berhenti di huruf E.",
    });
  }

  // CPL yang tidak tercapai adalah urusan prodi, bukan satu mata kuliah —
  // ia ditandai, tetapi tidak menahan penutupan (sejajar doc 04 §2.2).
  const cplGagal = arg.butir.filter((b) => b.tingkat === "CPL" && !b.tercapai);
  if (cplGagal.length > 0) {
    temuan.push({
      kode: "TL-CPL-BELUM-TERCAPAI",
      tingkat: "PERINGATAN",
      pesan: `CPL ${cplGagal.map((b) => b.kode).join(", ")} belum tercapai pada mata kuliah ini.`,
      saran: "Bawa ke evaluasi kurikulum tingkat prodi; satu mata kuliah tidak menanggung CPL sendirian.",
    });
  }

  for (const t of arg.temuan) temuan.push(...periksaTemuan(t));

  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");
  return { temuan, pemblokir, dapatDitutup: pemblokir.length === 0 };
}

export type UsulanVerifikasi = "TERCAPAI" | "TIDAK_TERCAPAI" | "BELUM";

export interface HasilVerifikasi {
  tingkat: TingkatCapaian;
  kode: string;
  /** Angka saat temuan dibuat. */
  sebelum: number | null;
  /** Angka pada evaluasi berikutnya. */
  sesudah: number | null;
  usulan: UsulanVerifikasi;
  narasi: string;
}

/**
 * Membandingkan tindak lanjut semester lalu dengan hasil semester ini.
 *
 * Inilah yang menutup lingkaran: tanpa perbandingan ini, RTL hanya daftar niat
 * yang tidak pernah ditagih. Keluarannya USULAN, bukan putusan — yang
 * memutuskan tetap manusia, karena capaian bisa naik oleh sebab lain.
 */
export function nilaiVerifikasi(
  temuanLama: readonly { tingkat: TingkatCapaian; kode: string; capaianTerukur: number | null }[],
  butirBaru: readonly CapaianButir[],
): HasilVerifikasi[] {
  const peta = new Map(butirBaru.map((b) => [`${b.tingkat}|${b.kode}`, b]));

  return temuanLama.map((t) => {
    const baru = peta.get(`${t.tingkat}|${t.kode}`);

    if (!baru || baru.persenLulus === null) {
      return {
        tingkat: t.tingkat,
        kode: t.kode,
        sebelum: t.capaianTerukur,
        sesudah: null,
        usulan: "BELUM" as const,
        narasi: `${t.kode} tidak terukur pada evaluasi ini, sehingga tindak lanjutnya belum dapat dinilai.`,
      };
    }

    const sesudah = Number(baru.persenLulus);
    const sebelum = t.capaianTerukur;
    const usulan: UsulanVerifikasi = baru.tercapai ? "TERCAPAI" : "TIDAK_TERCAPAI";

    const arah =
      sebelum === null
        ? ""
        : sesudah > sebelum
          ? ` (naik dari ${sebelum}%)`
          : sesudah < sebelum
            ? ` (turun dari ${sebelum}%)`
            : ` (tetap di ${sebelum}%)`;

    return {
      tingkat: t.tingkat,
      kode: t.kode,
      sebelum,
      sesudah,
      usulan,
      narasi: baru.tercapai
        ? `${t.kode} kini tercapai dengan ${sesudah}% mahasiswa lulus${arah}.`
        : `${t.kode} masih belum tercapai: ${sesudah}% mahasiswa lulus${arah}.`,
    };
  });
}
