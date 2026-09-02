/**
 * Kebijakan seberapa sering status pencabutan sesi ditanyakan ke Firebase.
 *
 * `verifySessionCookie(cookie, true)` bukan pemeriksaan lokal: argumen kedua
 * itu memanggil Identity Toolkit lewat jaringan untuk membaca `validSince`
 * akun. Diukur dari jaringan kampus, satu panggilan memakan 290–710 ms — dan
 * sebelumnya ia terjadi pada SETIAP permintaan: setiap halaman, setiap Server
 * Action, setiap route handler. Itu lantai waktu tunggu yang tidak dapat
 * ditembus optimasi kueri mana pun.
 *
 * Yang TETAP diperiksa setiap permintaan, tanpa jaringan:
 *
 * - Tanda tangan, penerbit, dan masa berlaku cookie — diverifikasi lokal
 *   memakai kunci publik Google yang sudah di-cache firebase-admin.
 * - Status akun di basis data. `sesiSaatIni` menolak `NONAKTIF` setiap kali,
 *   jadi penonaktifan LEWAT APLIKASI INI tetap berlaku seketika.
 *
 * Yang tertunda paling lama satu selang: pencabutan dari luar aplikasi —
 * menonaktifkan akun langsung di Firebase Console, atau `revokeRefreshTokens`.
 *
 * Murni: tanpa jaringan, tanpa jam sistem. Waktu selalu dilewatkan pemanggil
 * supaya perilakunya dapat diuji.
 */

/** Selang antar-pemeriksaan pencabutan, untuk satu cookie yang sama. */
export const SELANG_PERIKSA_CABUT_MS = 5 * 60 * 1000;

/** Batas jumlah entri, agar peta tidak tumbuh mengikuti umur proses. */
export const BATAS_CATATAN = 500;

export interface JadwalCabut {
  /** Apakah permintaan ini wajib menanyakan pencabutan ke Firebase. */
  perluPeriksa(kunci: string, sekarang: number): boolean;
  /** Dicatat SETELAH pemeriksaan berhasil, bukan sebelum. */
  catat(kunci: string, sekarang: number): void;
  /** Dipanggil saat cookie ditolak atau saat pengguna keluar. */
  lupakan(kunci: string): void;
  readonly jumlah: number;
}

export function buatJadwalCabut(
  selangMs: number = SELANG_PERIKSA_CABUT_MS,
  batas: number = BATAS_CATATAN,
): JadwalCabut {
  const berlakuSampai = new Map<string, number>();

  return {
    perluPeriksa(kunci, sekarang) {
      const sampai = berlakuSampai.get(kunci);
      return sampai === undefined || sampai <= sekarang;
    },

    catat(kunci, sekarang) {
      if (!berlakuSampai.has(kunci) && berlakuSampai.size >= batas) {
        for (const [k, sampai] of berlakuSampai) {
          if (sampai <= sekarang) berlakuSampai.delete(k);
        }
        // Masih penuh berarti semuanya masih berlaku: buang yang terlama
        // disisipkan. Map menjaga urutan sisip, jadi kunci pertama adalah itu.
        if (berlakuSampai.size >= batas) {
          const tertua = berlakuSampai.keys().next();
          if (!tertua.done) berlakuSampai.delete(tertua.value);
        }
      }
      berlakuSampai.set(kunci, sekarang + selangMs);
    },

    lupakan(kunci) {
      berlakuSampai.delete(kunci);
    },

    get jumlah() {
      return berlakuSampai.size;
    },
  };
}
