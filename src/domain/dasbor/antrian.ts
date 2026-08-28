import type { Nada } from "./ringkasan";

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

export interface ButirAntrian {
  kunci: string;
  judul: string;
  rincian: string;
  href: string;
  jumlah: number;
  kegentingan: Kegentingan;
  nada: Nada;
}

export interface SumberAntrian {
  /** Usulan revisi berstatus DIAJUKAN di prodi yang saya pimpin. */
  usulanMenungguKeputusan: number;
  /** RPKPS berstatus DIAJUKAN yang berhak saya putuskan. */
  rpkpsMenungguKeputusan: number;
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
}

export const SUMBER_KOSONG: SumberAntrian = {
  usulanMenungguKeputusan: 0,
  rpkpsMenungguKeputusan: 0,
  rpkpsDikembalikan: 0,
  rpkpsDraf: 0,
  penggunaMenungguVerifikasi: 0,
  temuanBelumDiverifikasi: 0,
  kelasSiapDitutup: 0,
  kebijakanMasihDraf: false,
};

const BOBOT: Record<Kegentingan, number> = { TINGGI: 0, SEDANG: 1, RENDAH: 2 };

export function susunAntrian(s: SumberAntrian): ButirAntrian[] {
  const semua: ButirAntrian[] = [
    {
      kunci: "kebijakan-draf",
      judul: "Kebijakan beban belajar belum diberlakukan",
      rincian:
        "Angkanya masih bawaan SN-Dikti. Memperbaikinya setelah ada RPKPS terbit berarti menghitung ulang semuanya.",
      href: "/kebijakan",
      jumlah: s.kebijakanMasihDraf ? 1 : 0,
      kegentingan: "TINGGI",
      nada: "bahaya",
    },
    {
      kunci: "usulan-menunggu",
      judul: "Usulan revisi menunggu keputusan Anda",
      rincian: "Pengusul tidak dapat melanjutkan sebelum tiap butir diputuskan.",
      href: "/usulan",
      jumlah: s.usulanMenungguKeputusan,
      kegentingan: "TINGGI",
      nada: "bahaya",
    },
    {
      kunci: "rpkps-menunggu",
      judul: "RPKPS menunggu putusan Anda",
      rincian: "Selama belum diputuskan, dokumen ini tidak dapat terbit.",
      href: "/rpkps",
      jumlah: s.rpkpsMenungguKeputusan,
      kegentingan: "TINGGI",
      nada: "bahaya",
    },
    {
      kunci: "rpkps-dikembalikan",
      judul: "RPKPS dikembalikan untuk direvisi",
      rincian: "Catatan pemutus menunggu ditindaklanjuti.",
      href: "/rpkps",
      jumlah: s.rpkpsDikembalikan,
      kegentingan: "TINGGI",
      nada: "peringatan",
    },
    {
      kunci: "pengguna-verifikasi",
      judul: "Pengguna menunggu verifikasi",
      rincian: "Belum punya peran, sehingga belum dapat mengakses apa pun.",
      href: "/pengguna",
      jumlah: s.penggunaMenungguVerifikasi,
      kegentingan: "SEDANG",
      nada: "peringatan",
    },
    {
      kunci: "kelas-siap-tutup",
      judul: "Kelas siap ditutup evaluasinya",
      rincian: "Nilai sudah lengkap; capaian belum masuk agregasi prodi.",
      href: "/rpkps",
      jumlah: s.kelasSiapDitutup,
      kegentingan: "SEDANG",
      nada: "cahaya",
    },
    {
      kunci: "temuan-belum-verifikasi",
      judul: "Temuan yang Anda tanggung belum diverifikasi",
      rincian: "Tindak lanjut tanpa verifikasi memutus siklus PPEPP.",
      href: "/evaluasi",
      jumlah: s.temuanBelumDiverifikasi,
      kegentingan: "SEDANG",
      nada: "peringatan",
    },
    {
      kunci: "rpkps-draf",
      judul: "RPKPS Anda masih draf",
      rincian: "Belum diajukan untuk diputuskan.",
      href: "/rpkps",
      jumlah: s.rpkpsDraf,
      kegentingan: "RENDAH",
      nada: "netral",
    },
  ];

  return semua
    .filter((b) => b.jumlah > 0)
    .sort((a, b) => BOBOT[a.kegentingan] - BOBOT[b.kegentingan]);
}
