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
  /** RPKPS berstatus DIAJUKAN yang berhak saya putuskan — Kaprodi. */
  rpkpsMenungguKeputusan: number;
  /**
   * RPKPS berstatus DISETUJUI yang menunggu cap terakhir — Penjaminan Mutu.
   * Terpisah dari butir di atas karena pemiliknya berbeda: sejak rantai
   * pengesahan terpasang (docs/14 §2.1), menyetujui dan mengesahkan adalah dua
   * perbuatan oleh dua jabatan.
   */
  rpkpsMenungguPengesahan: number;
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
   * Tenggat semester berjalan bagi pekerjaan yang BELUM diajukan. Menaikkan
   * kegentingan dua butir milik dosen — draf dan dokumen yang dikembalikan —
   * karena keduanya menghalangi tenggat yang sama.
   */
  tenggat: NilaiTenggat | null;
}

export const SUMBER_KOSONG: SumberAntrian = {
  usulanMenungguKeputusan: 0,
  rpkpsMenungguKeputusan: 0,
  rpkpsMenungguPengesahan: 0,
  rpkpsDikembalikan: 0,
  rpkpsDraf: 0,
  penggunaMenungguVerifikasi: 0,
  temuanBelumDiverifikasi: 0,
  kelasSiapDitutup: 0,
  kebijakanMasihDraf: false,
  tenggat: null,
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

/** Kalimat tenggat yang ditempelkan pada rincian butir, bila ada. */
function tambahanTenggat(tenggat: NilaiTenggat | null): string {
  if (tenggat === null) return "";
  if (tenggat.tingkat === "LEWAT") return ` Tenggat semester ${tenggat.label}.`;
  if (tenggat.tingkat === "DEKAT") return ` Tenggat semester ${tenggat.label}.`;
  return "";
}

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
      rincian: "Selama belum disetujui, dokumen ini tidak sampai ke Penjaminan Mutu.",
      href: "/rpkps",
      jumlah: s.rpkpsMenungguKeputusan,
      kegentingan: "TINGGI",
      nada: "bahaya",
    },
    {
      kunci: "rpkps-pengesahan",
      judul: "RPKPS menunggu pengesahan Anda",
      rincian:
        "Sudah ditandatangani Kaprodi. Tinggal pemeriksaan kesesuaian standar sebelum terbit.",
      href: "/rpkps",
      jumlah: s.rpkpsMenungguPengesahan,
      kegentingan: "TINGGI",
      nada: "bahaya",
    },
    {
      kunci: "rpkps-dikembalikan",
      judul: "RPKPS dikembalikan untuk direvisi",
      rincian: `Catatan pemutus menunggu ditindaklanjuti.${tambahanTenggat(s.tenggat)}`,
      href: "/rpkps",
      jumlah: s.rpkpsDikembalikan,
      ...karenaTenggat("TINGGI", "peringatan", s.tenggat),
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
      rincian: `Belum diajukan untuk diputuskan.${tambahanTenggat(s.tenggat)}`,
      href: "/rpkps",
      jumlah: s.rpkpsDraf,
      ...karenaTenggat("RENDAH", "netral", s.tenggat),
    },
  ];

  return semua
    .filter((b) => b.jumlah > 0)
    .sort((a, b) => BOBOT[a.kegentingan] - BOBOT[b.kegentingan]);
}
