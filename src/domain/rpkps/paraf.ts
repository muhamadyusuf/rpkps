/**
 * Kelengkapan paraf tim pengampu — rantai pengesahan tahap pertama
 * (docs/14 §2.2).
 *
 * Kolom "Tanda Tangan" pada tabel Tim Dosen Pengampu bukan hiasan: ia
 * pernyataan tiap pengampu bahwa dokumen ini benar-benar rencana yang akan ia
 * jalankan. Karena itu koordinator baru dapat mengajukan setelah seluruh
 * pengampu memberi paraf — ditegakkan sebagai temuan pemblokir pada validator,
 * bukan sebagai tombol yang mati tanpa keterangan.
 *
 * Murni: tanpa Prisma, tanpa tanggal. Yang dihitung hanya "siapa belum".
 */

export type PeranTtdRingkas = "PENGAMPU" | "KOORDINATOR" | "KAPRODI" | "PENJAMINAN_MUTU";

export interface PengampuParaf {
  penggunaId: string;
  nama: string;
  koordinator: boolean;
}

export interface BarisTtd {
  versi: number;
  peran: PeranTtdRingkas;
  penggunaId: string;
  /** Sidik isi yang ditandatangani, bila pemanggil ikut memuatnya. */
  sidik?: string;
}

export interface StatusParaf {
  /** Pengampu yang belum memaraf ronde ini, urut seperti daftar tim. */
  belum: PengampuParaf[];
  sudah: PengampuParaf[];
  /** Koordinator sudah membubuhkan cap "a.n Tim penyusun" — yakni mengajukan. */
  koordinatorSudah: boolean;
  lengkap: boolean;
}

/**
 * Paraf dinilai PER RONDE. Tanda tangan terikat `versi`, dan pengembalian
 * untuk revisi menaikkan versi — kenaikan itulah yang menggugurkan seluruh
 * paraf ronde sebelumnya, tanpa menghapus satu baris pun.
 *
 * Paraf koordinator sendiri dihitung dari cap `PENGAMPU` seperti anggota lain:
 * ia memaraf sebagai anggota tim, lalu mengajukan sebagai koordinator. Dua cap
 * yang berbeda, dan yang kedua adalah pengajuan itu sendiri.
 */
export function statusParaf(arg: {
  pengampu: readonly PengampuParaf[];
  tandaTangan: readonly BarisTtd[];
  versi: number;
  /**
   * Sidik isi SEKARANG. Bila diberikan, paraf yang mencap isi yang sudah
   * berbeda tidak dihitung — dokumen boleh terus disunting selama masih draf,
   * dan paraf atas isi yang sudah berubah tidak menyatakan apa pun. Tanpa ini
   * seorang pengampu dapat memaraf rencananya sendiri, lalu rekannya
   * menggantinya, dan koordinator mengajukan sesuatu yang tidak pernah
   * disetujui siapa-siapa.
   */
  sidikSekarang?: string;
}): StatusParaf {
  const ronde = arg.tandaTangan.filter((t) => t.versi === arg.versi);
  const sudahParaf = new Set(
    ronde
      .filter((t) => t.peran === "PENGAMPU")
      .filter((t) => arg.sidikSekarang === undefined || t.sidik === arg.sidikSekarang)
      .map((t) => t.penggunaId),
  );

  const belum = arg.pengampu.filter((p) => !sudahParaf.has(p.penggunaId));
  const sudah = arg.pengampu.filter((p) => sudahParaf.has(p.penggunaId));

  return {
    belum,
    sudah,
    koordinatorSudah: ronde.some((t) => t.peran === "KOORDINATOR"),
    // Tim kosong TIDAK dianggap lengkap: RPKPS tanpa pengampu sudah punya
    // temuan pemblokirnya sendiri, dan menyebutnya "paraf lengkap" hanya
    // menyembunyikan yang satunya.
    lengkap: arg.pengampu.length > 0 && belum.length === 0,
  };
}

/**
 * Cap sebuah peran pada ronde berjalan, bila ada.
 *
 * Syaratnya sengaja hanya `versi` dan `peran`: pemanggil yang cuma butuh cap
 * waktu tidak perlu ikut memuat identitas penanda tangan hanya demi lolos tipe.
 */
export function capRonde<T extends { versi: number; peran: PeranTtdRingkas }>(
  tandaTangan: readonly T[],
  versi: number,
  peran: PeranTtdRingkas,
): T | null {
  return tandaTangan.find((t) => t.versi === versi && t.peran === peran) ?? null;
}

/**
 * Urutan rantai pengesahan, dan satu-satunya tempat urutan itu ditulis.
 *
 * Bukan sekadar selera tampilan: urutan inilah yang membuat halaman pengesahan
 * terbaca sebagai rantai — koordinator menandatangani a.n tim penyusun, Kaprodi
 * menyetujui, Penjaminan Mutu menyatakan sesuai standar. Membaliknya membuat
 * dokumen tampak disahkan lebih dulu lalu disetujui belakangan.
 *
 * `PENGAMPU` sengaja di luar daftar: paraf anggota tim mendahului rantai ini,
 * dan tempatnya kolom "Tanda Tangan" pada tabel tim, bukan blok pengesahan.
 */
export const RANTAI_PENGESAHAN = ["KOORDINATOR", "KAPRODI", "PENJAMINAN_MUTU"] as const;

export type PeranPengesah = (typeof RANTAI_PENGESAHAN)[number];

export interface SlotPengesah<T> {
  peran: PeranPengesah;
  /** `null` berarti belum ditandatangani — dan blok itu memang harus kosong. */
  cap: T | null;
}

/**
 * Ketiga cap rantai pengesahan pada satu ronde, selalu bertiga dan selalu
 * berurutan.
 *
 * Selalu bertiga karena yang KOSONG justru bagian yang paling perlu terbaca:
 * dokumen lama yang terbit sebelum rantai ini ada tidak diberi tanda tangan
 * susulan (docs/14 §5), dan blok kosonglah yang mengatakannya — bukan daftar
 * pendek yang menyamarkan ketiadaannya.
 */
export function rantaiPengesahan<T extends { versi: number; peran: PeranTtdRingkas }>(
  tandaTangan: readonly T[],
  versi: number,
): SlotPengesah<T>[] {
  return RANTAI_PENGESAHAN.map((peran) => ({
    peran,
    cap: capRonde(tandaTangan, versi, peran),
  }));
}
