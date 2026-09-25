import "server-only";
import { prisma } from "@/lib/prisma";
import { PILIH_RUJUKAN_PENGGUNA, susunTampilan, type RujukanPengguna, type Tampilan } from "@/domain/identitas/tampilan";
import { ambilProfil, ProfilTidakTersedia } from "@/lib/identitas/pegawai";

/**
 * "Siapa orang ini" untuk halaman, kop dokumen, dan daftar pengampu (docs/26 §4).
 *
 * Pegawai dibaca dari identitas-itts (batch + cache); pengguna LOKAL dari kolom
 * `nama`. Pola pemakaiannya:
 *
 *   1. Kueri Prisma memuat baris `pengguna` dengan `PILIH_RUJUKAN_PENGGUNA`
 *      (id, surel, nama, identitasAkunId) — BUKAN nama/gelar/NIDN, yang tak lagi
 *      disimpan di sini.
 *   2. Kumpulkan SEMUA rujukan yang dibutuhkan halaman/aksi itu, lalu panggil
 *      `tampilanDariRujukan` SEKALI — satu panggilan ke identitas-itts, bukan N.
 *   3. Pakai `Map<penggunaId, Tampilan>` hasilnya.
 *
 * `tampilanDariRujukan` tidak pernah melempar karena identitas-itts: yang tak
 * terbaca menjadi TAK_DIKETAHUI (bernama darurat dari surel). Untuk dokumen resmi
 * pakai `wajibTampilanDariRujukan`.
 */

/** Dari baris `pengguna` yang SUDAH dimuat pemanggil (tanpa kueri tambahan). */
export async function tampilanDariRujukan(
  baris: readonly RujukanPengguna[],
  opsi: { segar?: boolean } = {},
): Promise<Map<string, Tampilan>> {
  const unik = [...new Map(baris.map((b) => [b.id, b])).values()];
  if (unik.length === 0) return new Map();

  const akunIds = unik.flatMap((b) => (b.identitasAkunId ? [b.identitasAkunId] : []));
  const { profil } = akunIds.length > 0 ? await ambilProfil(akunIds, opsi) : { profil: new Map() };
  return susunTampilan(unik, profil);
}

/**
 * Untuk operasi HUKUM (tanda tangan, pengesahan, terbit): hanya data SEGAR, dan
 * melempar {@link ProfilTidakTersedia} bila ada pegawai yang tak dapat dipastikan.
 * Yang tercetak di dokumen resmi tidak boleh berasal dari tebakan atau data basi.
 */
export async function wajibTampilanDariRujukan(baris: readonly RujukanPengguna[]): Promise<Map<string, Tampilan>> {
  const t = await tampilanDariRujukan(baris, { segar: true });
  const hilang = [...t.entries()].filter(([, v]) => v.sumber === "TAK_DIKETAHUI").map(([id]) => id);
  if (hilang.length > 0) throw new ProfilTidakTersedia(hilang);
  return t;
}

/** Dari id pengguna saja (satu kueri tambahan untuk memuat rujukannya). */
export async function muatTampilan(penggunaIds: readonly string[]): Promise<Map<string, Tampilan>> {
  const ids = [...new Set(penggunaIds)];
  if (ids.length === 0) return new Map();
  const baris = await prisma.pengguna.findMany({ where: { id: { in: ids } }, select: PILIH_RUJUKAN_PENGGUNA });
  return tampilanDariRujukan(baris);
}

export async function wajibTampilan(penggunaIds: readonly string[]): Promise<Map<string, Tampilan>> {
  const ids = [...new Set(penggunaIds)];
  if (ids.length === 0) return new Map();
  const baris = await prisma.pengguna.findMany({ where: { id: { in: ids } }, select: PILIH_RUJUKAN_PENGGUNA });
  return wajibTampilanDariRujukan(baris);
}

export type BarisRujukan = RujukanPengguna | null | undefined;

/**
 * Pembantu untuk halaman/berkas yang hanya butuh MENAMPILKAN nama di beberapa tempat:
 * kumpulkan semua rujukan (yang null/undefined diabaikan), tunggu SATU pembacaan dari
 * identitas-itts, lalu pakai fungsi hasilnya di tempat masing-masing.
 *
 *   const nama = await pencariNama(kelas.dosen, evaluasi?.ditutupOleh, ...temuan.map((t) => t.penanggungJawab));
 *   … nama(kelas.dosen)   // "Siti Aminah" — nama saja, tanpa gelar, seperti kolom `nama` dulu
 *
 * Yang tak terbaca dari identitas-itts tampil sebagai nama darurat (bagian depan surel).
 */
export async function pencariNama(...baris: BarisRujukan[]): Promise<(b: BarisRujukan) => string | null> {
  const ada = baris.filter((b): b is RujukanPengguna => !!b);
  const tampilan = await tampilanDariRujukan(ada);
  return (b) => (b ? (tampilan.get(b.id)?.nama ?? b.email) : null);
}

/**
 * Seperti {@link pencariNama}, tetapi untuk nama yang akan DITULIS ke catatan permanen (salinan
 * beku, riwayat): hanya data SEGAR, dan melempar {@link ProfilTidakTersedia} bila ada yang tak pasti.
 */
export async function wajibPencariNama(...baris: BarisRujukan[]): Promise<(b: BarisRujukan) => string | null> {
  const ada = baris.filter((b): b is RujukanPengguna => !!b);
  const tampilan = await wajibTampilanDariRujukan(ada);
  return (b) => (b ? (tampilan.get(b.id)?.nama ?? b.email) : null);
}
