/**
 * Aturan antrian kirim surel — docs/10 §2.5 (tahap N5).
 *
 * Murni: tanpa Prisma, tanpa SMTP, tanpa "sekarang" yang tersembunyi. Yang
 * diputuskan di sini adalah tiga hal yang paling mahal bila salah — kapan
 * sebuah baris boleh dicoba, berapa lama menunggu setelah gagal, dan kapan
 * berhenti mencoba.
 *
 * Prinsip yang menaungi semuanya: **kanal luar yang gagal tidak boleh
 * menghilangkan kabarnya.** Notifikasi dalam aplikasi tetap ada apa pun yang
 * terjadi di sini; surel adalah lapisan tambahan di atasnya, bukan
 * penggantinya.
 */

export type StatusSurel = "MENUNGGU" | "TERKIRIM" | "GAGAL" | "DILEWATI";

/**
 * Batas percobaan. Lima kali dengan jeda yang menaik menutupi gangguan SMTP
 * sehari penuh; selebihnya bukan gangguan sementara lagi, dan mencoba terus
 * hanya menahan antrian di belakangnya.
 */
export const MAKS_PERCOBAAN_SUREL = 5;

const MENIT = 60_000;

/**
 * Jeda mundur setelah percobaan ke-n gagal: 1 menit, 5, 25, 2 jam, 10 jam.
 *
 * Menaik tajam dan sengaja: kegagalan SMTP hampir selalu satu dari dua hal —
 * gangguan sesaat yang pulih dalam hitungan menit, atau kredensial/kuota yang
 * tidak akan pulih sampai ada manusia yang menyentuhnya. Jeda yang menaik
 * melayani keduanya tanpa membanjiri penyedia.
 */
export function jedaBerikutnya(percobaan: number): number {
  const n = Math.max(1, Math.trunc(percobaan));
  return Math.round(MENIT * 5 ** (n - 1));
}

export function jadwalUlang(percobaan: number, sekarang: Date): Date {
  return new Date(sekarang.getTime() + jedaBerikutnya(percobaan));
}

export type PutusanSurel = "KIRIM" | "TUNGGU" | "SELESAI" | "MENYERAH";

/**
 * Apa yang harus dilakukan terhadap satu baris antrian.
 *
 * `MENYERAH` dipisahkan dari `TUNGGU` karena keduanya sama-sama "jangan kirim
 * sekarang", tetapi hanya yang pertama yang harus ditandai GAGAL — baris yang
 * hanya sedang menunggu jedanya tidak boleh ikut dimatikan.
 */
export function putusanSurel(
  baris: {
    status: StatusSurel;
    percobaan: number;
    kirimSetelah: Date | null;
  },
  sekarang: Date,
): PutusanSurel {
  if (baris.status !== "MENUNGGU") return "SELESAI";
  if (baris.percobaan >= MAKS_PERCOBAAN_SUREL) return "MENYERAH";
  if (baris.kirimSetelah !== null && baris.kirimSetelah.getTime() > sekarang.getTime()) {
    return "TUNGGU";
  }
  return "KIRIM";
}

/**
 * Boleh dikirimi surel?
 *
 * Empat syarat, dan tidak satu pun boleh dilewati:
 *  - kanalnya menyala (kredensial SMTP ada);
 *  - orangnya belum menolak surel;
 *  - alamatnya ada dan berbentuk alamat;
 *  - akunnya masih AKTIF — mengirimi orang yang sudah dinonaktifkan berarti
 *    kabar tentang dokumen yang tidak lagi dapat ia buka.
 */
export function bolehDisurel(arg: {
  kanalMenyala: boolean;
  surelNotifikasi: boolean;
  email: string | null | undefined;
  statusAkun: string;
}): boolean {
  if (!arg.kanalMenyala || !arg.surelNotifikasi) return false;
  if (arg.statusAkun !== "AKTIF") return false;
  return alamatSah(arg.email);
}

/**
 * Pemeriksaan alamat seadanya, dan memang tidak perlu lebih.
 *
 * Yang menentukan sah atau tidaknya sebuah alamat adalah server penerima;
 * pemeriksaan di sini hanya menyaring yang jelas bukan alamat supaya antrian
 * tidak berisi baris yang pasti gagal lima kali.
 */
export function alamatSah(email: string | null | undefined): boolean {
  if (!email) return false;
  const bersih = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bersih);
}

/**
 * Pesan galat yang layak disimpan.
 *
 * Dipendekkan, dan dibersihkan dari alamat pengguna SMTP: pesan bawaan
 * beberapa server memuat nama akun pengirim, dan kolom ini dibaca dari halaman
 * admin. Kredensial tidak pernah masuk ke sini — begitu ia tertulis sekali di
 * basis data, ia ada di cadangan basis data selamanya.
 */
export function ringkasGalat(pesan: string, samarkan: readonly string[] = []): string {
  let bersih = pesan.replace(/\s+/g, " ").trim();
  for (const rahasia of samarkan) {
    if (rahasia.trim().length > 0) bersih = bersih.split(rahasia).join("···");
  }
  return bersih.length <= 300 ? bersih : `${bersih.slice(0, 299)}…`;
}
