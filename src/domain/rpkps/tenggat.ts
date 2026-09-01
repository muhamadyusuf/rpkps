/**
 * Urgensi sebuah RPKPS terhadap tenggat semesternya.
 *
 * Tiga tenggat, bukan satu — penyusunan, review, pengesahan (docs/14 §3) —
 * tetapi sebuah dokumen hanya terikat SATU di antaranya pada satu waktu, dan
 * pemiliknya berpindah mengikuti rantai pengesahan:
 *
 *   DRAF / DIREVISI  → penyusunan  → dosen pengampu
 *   DIAJUKAN         → review      → Ketua Program Studi
 *   DISETUJUI        → pengesahan  → Kepala Penjaminan Mutu
 *   TERBIT / ARSIP   → —
 *
 * Ketiganya disimpan pada tahun akademik, bukan pada tiap RPKPS: yang berlaku
 * adalah satu batas untuk seluruh dokumen semester itu, dan menyalinnya ke tiap
 * baris hanya melahirkan angka yang saling berbeda tanpa alasan.
 *
 * Tenggat TIDAK mengunci apa pun. Melewatinya tidak menutup penyuntingan,
 * tidak menolak pengajuan, dan tidak menolak pengesahan — yang berubah hanya
 * urutan dan warna pada antrian kerja. Aturan keras milik validator; ini alat
 * bantu perhatian.
 */

export type TingkatTenggat = "TIDAK_ADA" | "SELESAI" | "AMAN" | "DEKAT" | "LEWAT";

/** Petak tanggung jawab yang sedang berjalan. */
export type TahapTenggat = "PENYUSUNAN" | "REVIEW" | "PENGESAHAN" | "SELESAI";

export type StatusRingkasTenggat =
  | "DRAF"
  | "DIAJUKAN"
  | "DIREVISI"
  | "DISETUJUI"
  | "TERBIT"
  | "ARSIP";

/** Batas hari sebuah tenggat mulai disebut dekat. */
export const AMBANG_DEKAT_HARI = 7;

const HARI = 86_400_000;

export interface TenggatSemester {
  penyusunan: Date | null;
  review: Date | null;
  pengesahan: Date | null;
}

export const TENGGAT_KOSONG: TenggatSemester = {
  penyusunan: null,
  review: null,
  pengesahan: null,
};

export type NilaiTenggat = {
  tahap: TahapTenggat;
  tingkat: TingkatTenggat;
  /** Sisa hari; negatif bila sudah lewat, null bila tenggat tidak berlaku. */
  hari: number | null;
  label: string;
};

/** Tahap yang sedang berjalan — murni dari status dokumen. */
export function tahapTenggat(status: StatusRingkasTenggat): TahapTenggat {
  switch (status) {
    case "DRAF":
    case "DIREVISI":
      return "PENYUSUNAN";
    case "DIAJUKAN":
      return "REVIEW";
    case "DISETUJUI":
      return "PENGESAHAN";
    default:
      return "SELESAI";
  }
}

/**
 * Batas efektif tahap yang sedang berjalan.
 *
 * Bagi pemutus, jaminan N hari adalah LANTAI, bukan langit-langit: dokumen
 * yang masuk jauh-jauh hari tetap terikat tanggal semester — pemutus tidak
 * mendapat perpanjangan karena orang lain rajin — sedangkan dokumen yang masuk
 * mepet memberi pemutusnya N hari penuh sejak dokumen benar-benar sampai di
 * mejanya. Keterlambatan penyusunan tidak hilang karenanya; ia sudah tercatat
 * pada tahap penyusunan. Yang ditolak hanyalah memindahkan tanggungannya ke
 * orang berikutnya di rantai.
 *
 * Tenggat semester yang kosong berarti tahap itu memang tidak bertenggat.
 * Jaminan N hari tidak pernah MENCIPTAKAN tenggat yang tidak ditetapkan Admin.
 */
export function batasTahap(arg: {
  tahap: TahapTenggat;
  tenggat: TenggatSemester;
  /** Kapan dokumen sampai ke pemutus tahap ini. Diabaikan pada PENYUSUNAN. */
  sejak: Date | null;
  jaminanHari: number;
}): Date | null {
  if (arg.tahap === "SELESAI") return null;
  if (arg.tahap === "PENYUSUNAN") return arg.tenggat.penyusunan;

  const tetap = arg.tahap === "REVIEW" ? arg.tenggat.review : arg.tenggat.pengesahan;
  if (tetap === null) return null;
  if (arg.sejak === null) return tetap;

  const dijamin = new Date(arg.sejak.getTime() + arg.jaminanHari * HARI);
  return dijamin > tetap ? dijamin : tetap;
}

const AWALAN: Record<TahapTenggat, string> = {
  PENYUSUNAN: "",
  REVIEW: "review ",
  PENGESAHAN: "pengesahan ",
  SELESAI: "",
};

/**
 * Menilai satu batas yang sudah dihitung. Labelnya menyebut tahap — "review
 * terlambat 3 hari", bukan "terlambat 3 hari" — karena penanda tenggat yang
 * tidak menyebut tenggat apa memaksa pembacanya membuka dokumen hanya untuk
 * tahu itu urusan siapa.
 */
export function nilaiTenggat(arg: {
  batas: Date | null;
  sekarang: Date;
  tahap: TahapTenggat;
}): NilaiTenggat {
  const tahap = arg.tahap;
  const awalan = AWALAN[tahap];

  if (tahap === "SELESAI") {
    return { tahap, tingkat: "SELESAI", hari: null, label: "sudah selesai" };
  }
  if (arg.batas === null) {
    return { tahap, tingkat: "TIDAK_ADA", hari: null, label: "tanpa tenggat" };
  }

  const selisih = arg.batas.getTime() - arg.sekarang.getTime();

  if (selisih < 0) {
    const lewat = Math.floor(-selisih / HARI);
    return {
      tahap,
      tingkat: "LEWAT",
      hari: -lewat,
      label:
        lewat === 0
          ? `lewat tenggat ${awalan}hari ini`
          : `${awalan}terlambat ${lewat} hari`,
    };
  }

  const sisa = Math.ceil(selisih / HARI);
  return {
    tahap,
    tingkat: sisa <= AMBANG_DEKAT_HARI ? "DEKAT" : "AMAN",
    hari: sisa,
    label: sisa === 0 ? `tenggat ${awalan}hari ini` : `${awalan}tersisa ${sisa} hari`,
  };
}

/**
 * Penilaian utuh sebuah dokumen: status menentukan tahap, tahap menentukan
 * tanggal mana yang berlaku dan cap waktu mana yang menjadi titik mulai
 * jaminan N hari.
 *
 * Inilah yang dipanggil pemuat halaman. Merangkainya sendiri di tiap halaman
 * berarti cepat atau lambat ada yang memasangkan tahap review dengan cap waktu
 * persetujuan Kaprodi, dan salah pasang itu tidak menimbulkan galat apa pun —
 * hanya angka hari yang diam-diam keliru.
 */
export function nilaiTenggatDokumen(arg: {
  status: StatusRingkasTenggat;
  tenggat: TenggatSemester;
  /** Cap waktu tanda tangan koordinator pada ronde berjalan. */
  diajukanPada: Date | null;
  /** Cap waktu tanda tangan Kaprodi pada ronde berjalan. */
  disetujuiPada: Date | null;
  jaminanHari: number;
  sekarang: Date;
}): NilaiTenggat {
  const tahap = tahapTenggat(arg.status);
  const sejak =
    tahap === "REVIEW" ? arg.diajukanPada : tahap === "PENGESAHAN" ? arg.disetujuiPada : null;

  return nilaiTenggat({
    tahap,
    sekarang: arg.sekarang,
    batas: batasTahap({
      tahap,
      tenggat: arg.tenggat,
      sejak,
      jaminanHari: arg.jaminanHari,
    }),
  });
}

/**
 * Urutan antrian kerja: yang paling mendesak lebih dulu. Dipakai sebagai
 * pembanding, sehingga aturannya satu tempat dan tidak ditebak ulang tiap
 * halaman.
 */
const URUTAN: Record<TingkatTenggat, number> = {
  LEWAT: 0,
  DEKAT: 1,
  AMAN: 2,
  TIDAK_ADA: 3,
  SELESAI: 4,
};

export function bandingkanUrgensi(a: NilaiTenggat, b: NilaiTenggat): number {
  const beda = URUTAN[a.tingkat] - URUTAN[b.tingkat];
  if (beda !== 0) return beda;
  if (a.hari === null || b.hari === null) return 0;
  return a.hari - b.hari;
}
