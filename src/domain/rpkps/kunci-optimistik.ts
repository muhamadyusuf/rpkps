/**
 * Kunci optimistik untuk baris yang disunting bersama.
 *
 * RPKPS memang dirancang untuk dipegang lebih dari satu orang: tim pengampu,
 * koordinator, ditambah Kaprodi yang boleh menyunting dokumen prodinya. Setiap
 * penyunting menyimpan SELURUH isi barisnya sekaligus, jadi dua orang yang
 * membuka minggu yang sama akan saling menimpa tanpa gejala apa pun — yang
 * menyimpan belakangan menang, dan yang lebih dahulu tidak pernah tahu
 * tulisannya hilang.
 *
 * Yang dipakai sebagai penanda versi adalah `diubahPada` baris itu sendiri.
 * Tidak ada kolom versi tersendiri: cap waktu sudah ditulis Prisma lewat
 * `@updatedAt` pada setiap penyimpanan, dan satu sumber kebenaran lebih baik
 * daripada dua yang harus dijaga tetap sejalan.
 *
 * Perbandingannya murni; penegakannya ada di `where` klausa `updateMany`
 * (lihat `simpanPertemuan`), supaya periksa-lalu-tulis tidak terpisah menjadi
 * dua langkah yang bisa disela.
 */

export type HasilKesegaran = { segar: true; cap: Date } | { segar: false; pesan: string };

/**
 * @param capKlien cap waktu yang dibawa penyunting, dalam bentuk ISO
 * @param sebutan nama baris untuk pesan, mis. "Minggu 5" atau "Tugas 2"
 */
export function periksaKesegaran(
  capKlien: string | null | undefined,
  sebutan: string,
): HasilKesegaran {
  if (!capKlien) {
    return {
      segar: false,
      pesan: `${sebutan} dibuka sebelum pemeriksaan versi ada. Muat ulang halaman lebih dulu.`,
    };
  }

  const cap = new Date(capKlien);
  if (Number.isNaN(cap.getTime())) {
    return { segar: false, pesan: `Penanda versi ${sebutan} tidak sah. Muat ulang halaman.` };
  }

  return { segar: true, cap };
}

/** Pesan tunggal saat penyimpanan kalah balapan; dipakai semua penyunting. */
export function pesanTertimpa(sebutan: string): string {
  return (
    `${sebutan} sudah diubah orang lain sejak halaman ini dibuka. ` +
    `Tidak ada yang ditimpa — muat ulang halaman, lalu terapkan kembali perubahan Anda.`
  );
}
