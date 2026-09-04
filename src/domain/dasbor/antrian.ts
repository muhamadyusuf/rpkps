import type { Nada } from "./ringkasan";
import type { NilaiTenggat } from "../rpkps/tenggat";

/**
 * Antrian kerja — tahap D1 pada docs/07-dasbor-peran.md §3.1.
 *
 * Satu daftar gabungan yang menjawab satu pertanyaan: "apa yang menunggu
 * SAYA?". Sumbernya beberapa modul, tetapi penyusunannya murni supaya urutan
 * dan kegentingannya dapat diuji tanpa basis data.
 *
 * Aturan yang ditegakkan di sini:
 *  - Butir bernilai nol tidak pernah muncul. Dasbor yang penuh angka nol
 *    melatih orang mengabaikannya.
 *  - Kegentingan TINGGI hanya untuk hal yang MENGHAMBAT ORANG LAIN atau
 *    seluruh institusi. Pekerjaan sendiri yang tertunda tidak pernah merah.
 */

export type Kegentingan = "TINGGI" | "SEDANG" | "RENDAH";

/**
 * Butir antrian dikenali dari kuncinya, dan kalimatnya ada di kamus
 * (`kamus.dasbor.antrian.butir`). Domain tidak menyimpan kalimat: dasbor
 * dibaca dalam dua bahasa, dan judul yang lahir di sini akan selalu bahasa
 * penulisnya (docs/11 §4).
 */
export type KunciAntrian =
  | "kebijakan-draf"
  | "usulan-menunggu"
  | "rpkps-menunggu"
  | "rpkps-pengesahan"
  | "rpkps-paraf"
  | "rpkps-dikembalikan"
  | "pengguna-verifikasi"
  | "kelas-siap-tutup"
  | "temuan-belum-verifikasi"
  | "rpkps-draf";

export interface ButirAntrian {
  kunci: KunciAntrian;
  href: string;
  jumlah: number;
  kegentingan: Kegentingan;
  nada: Nada;
  /**
   * Tenggat JALUR butir ini — bukan tenggat dokumen mana pun tertentu, dan
   * bukan tenggat jalur orang lain. Dirender pemanggil; di sini ia hanya
   * menaikkan kegentingan.
   */
  tenggat: NilaiTenggat | null;
}

export interface SumberAntrian {
  /** Usulan revisi berstatus DIAJUKAN di prodi yang saya pimpin. */
  usulanMenungguKeputusan: number;
  /** RPKPS berstatus DIAJUKAN yang berhak saya putuskan — Kaprodi. */
  rpkpsMenungguKeputusan: number;
  /**
   * RPKPS berstatus DISETUJUI yang menunggu cap terakhir — Penjaminan Mutu.
   * Terpisah dari butir di atas karena pemiliknya berbeda: sejak rantai
   * pengesahan terpasang (docs/14 §2.1), menyetujui dan mengesahkan adalah dua
   * perbuatan oleh dua jabatan.
   */
  rpkpsMenungguPengesahan: number;
  /**
   * RPKPS yang saya ampu dan masih menunggu paraf SAYA pada ronde berjalan.
   * Selama satu paraf belum masuk, koordinator tidak dapat mengajukan
   * dokumennya sama sekali (docs/14 §2.2).
   */
  rpkpsMenungguParaf: number;
  /** RPKPS yang saya ampu dan dikembalikan untuk direvisi. */
  rpkpsDikembalikan: number;
  /** RPKPS yang saya ampu dan masih draf. */
  rpkpsDraf: number;
  /** Pengguna berstatus MENUNGGU_VERIFIKASI (hanya Admin). */
  penggunaMenungguVerifikasi: number;
  /** Temuan evaluasi yang saya tanggung dan belum diverifikasi. */
  temuanBelumDiverifikasi: number;
  /** Kelas yang nilainya lengkap tetapi evaluasinya belum ditutup. */
  kelasSiapDitutup: number;
  /** Kebijakan beban belajar masih DRAF (hanya Admin/GPM). */
  kebijakanMasihDraf: boolean;
  /**
   * Tenggat semester berjalan, SATU PER JALUR (docs/14 §4.1).
   *
   * Tiga, bukan satu, karena satu dokumen hanya terikat satu tenggat pada satu
   * waktu dan pemiliknya berpindah mengikuti rantai. Satu bidang tunggal
   * berarti keterlambatan penyusunan mewarnai merah butir milik Kaprodi —
   * menyalahkan orang atas keterlambatan orang lain, persis yang ditolak
   * §3.2. Nilainya adalah yang TERPARAH di jalur itu.
   */
  tenggat: TenggatJalur;
}

export interface TenggatJalur {
  penyusunan: NilaiTenggat | null;
  review: NilaiTenggat | null;
  pengesahan: NilaiTenggat | null;
}

export const TENGGAT_JALUR_KOSONG: TenggatJalur = {
  penyusunan: null,
  review: null,
  pengesahan: null,
};

export const SUMBER_KOSONG: SumberAntrian = {
  usulanMenungguKeputusan: 0,
  rpkpsMenungguKeputusan: 0,
  rpkpsMenungguPengesahan: 0,
  rpkpsMenungguParaf: 0,
  rpkpsDikembalikan: 0,
  rpkpsDraf: 0,
  penggunaMenungguVerifikasi: 0,
  temuanBelumDiverifikasi: 0,
  kelasSiapDitutup: 0,
  kebijakanMasihDraf: false,
  tenggat: TENGGAT_JALUR_KOSONG,
};

const BOBOT: Record<Kegentingan, number> = { TINGGI: 0, SEDANG: 1, RENDAH: 2 };

/**
 * Tenggat menaikkan kegentingan, tidak pernah menurunkannya: pekerjaan yang
 * sudah mendesak karena alasan lain tidak menjadi tenang hanya karena
 * tenggatnya masih jauh.
 */
function karenaTenggat(
  dasar: Kegentingan,
  nada: Nada,
  tenggat: NilaiTenggat | null,
): { kegentingan: Kegentingan; nada: Nada } {
  if (tenggat?.tingkat === "LEWAT") return { kegentingan: "TINGGI", nada: "bahaya" };
  if (tenggat?.tingkat === "DEKAT") {
    return {
      kegentingan: BOBOT[dasar] < BOBOT["SEDANG"] ? dasar : "SEDANG",
      nada: nada === "netral" ? "peringatan" : nada,
    };
  }
  return { kegentingan: dasar, nada };
}

export function susunAntrian(s: SumberAntrian): ButirAntrian[] {
  const semua: ButirAntrian[] = [
    {
      kunci: "kebijakan-draf",
      href: "/kebijakan",
      jumlah: s.kebijakanMasihDraf ? 1 : 0,
      kegentingan: "TINGGI",
      nada: "bahaya",
      tenggat: null,
    },
    {
      kunci: "usulan-menunggu",
      href: "/usulan",
      jumlah: s.usulanMenungguKeputusan,
      kegentingan: "TINGGI",
      nada: "bahaya",
      tenggat: null,
    },
    {
      kunci: "rpkps-menunggu",
      href: "/rpkps",
      jumlah: s.rpkpsMenungguKeputusan,
      tenggat: s.tenggat.review,
      ...karenaTenggat("TINGGI", "bahaya", s.tenggat.review),
    },
    {
      kunci: "rpkps-pengesahan",
      href: "/rpkps",
      jumlah: s.rpkpsMenungguPengesahan,
      tenggat: s.tenggat.pengesahan,
      ...karenaTenggat("TINGGI", "bahaya", s.tenggat.pengesahan),
    },
    {
      kunci: "rpkps-dikembalikan",
      href: "/rpkps",
      jumlah: s.rpkpsDikembalikan,
      tenggat: s.tenggat.penyusunan,
      ...karenaTenggat("TINGGI", "peringatan", s.tenggat.penyusunan),
    },
    {
      /*
       * Memaraf bukan pekerjaan sendiri: selama satu paraf tertahan,
       * koordinator tidak dapat mengajukan dokumennya sama sekali. Ia tetap
       * tidak dimulai dari TINGGI — yang tertahan baru satu langkah, bukan
       * sebuah keputusan — dan tenggat penyusunanlah yang menaikkannya.
       */
      kunci: "rpkps-paraf",
      href: "/rpkps",
      jumlah: s.rpkpsMenungguParaf,
      tenggat: s.tenggat.penyusunan,
      ...karenaTenggat("SEDANG", "peringatan", s.tenggat.penyusunan),
    },
    {
      kunci: "pengguna-verifikasi",
      href: "/pengguna",
      jumlah: s.penggunaMenungguVerifikasi,
      kegentingan: "SEDANG",
      nada: "peringatan",
      tenggat: null,
    },
    {
      kunci: "kelas-siap-tutup",
      href: "/rpkps",
      jumlah: s.kelasSiapDitutup,
      kegentingan: "SEDANG",
      nada: "cahaya",
      tenggat: null,
    },
    {
      kunci: "temuan-belum-verifikasi",
      href: "/evaluasi",
      jumlah: s.temuanBelumDiverifikasi,
      kegentingan: "SEDANG",
      nada: "peringatan",
      tenggat: null,
    },
    {
      kunci: "rpkps-draf",
      href: "/rpkps",
      jumlah: s.rpkpsDraf,
      tenggat: s.tenggat.penyusunan,
      ...karenaTenggat("RENDAH", "netral", s.tenggat.penyusunan),
    },
  ];

  return semua
    .filter((b) => b.jumlah > 0)
    .sort((a, b) => BOBOT[a.kegentingan] - BOBOT[b.kegentingan]);
}
