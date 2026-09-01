import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Unit penyelenggara — fakultas dan program studi — sebagai penyaring daftar.
 *
 * ADMIN, GPM, dan asesor bercakupan institusi: daftar kurikulum dan daftar
 * RPKPS yang mereka buka memuat seluruh prodi sekaligus. Tanpa penyaring,
 * satu-satunya cara menemukan "kurikulum Teknologi Informasi" adalah membaca
 * seluruh halaman. Karena itu pilihannya datang dari BASIS DATA, bukan dari
 * daftar tetap: fakultas dan prodi bertambah, dan daftar tetap akan basi.
 *
 * Kunci penyaringnya adalah `kode`, bukan id: alamat hasil saringan sering
 * ditempelkan ke pesan ("lihat /kurikulum?prodi=TI"), dan cuid tidak dapat
 * dibaca siapa pun. Penerjemahan kode → id dikerjakan `prodiTersaring` dari
 * daftar yang SUDAH dibatasi cakupan, sehingga kode di luar wewenang pengguna
 * tidak pernah menjadi id yang lolos ke kueri.
 */

export type SaringanUnit = { fakultas?: string; prodi?: string };

export type ProdiUnit = {
  id: string;
  kode: string;
  nama: string;
  /** Kode fakultas induk — penghubung ke pilihan fakultas di antarmuka. */
  fakultas: string;
};

export type UnitTersedia = {
  fakultas: { kode: string; nama: string; institusi: string }[];
  prodi: ProdiUnit[];
};

export function bacaSaringanUnit(
  mentah: Record<string, string | string[] | undefined>,
): SaringanUnit {
  const fakultas = satu(mentah.fakultas);
  const prodi = satu(mentah.prodi);
  return {
    ...(fakultas ? { fakultas } : {}),
    ...(prodi ? { prodi } : {}),
  };
}

function satu(nilai: string | string[] | undefined): string | undefined {
  const teks = Array.isArray(nilai) ? nilai[0] : nilai;
  const bersih = teks?.trim().slice(0, 64);
  return bersih ? bersih : undefined;
}

/**
 * Fakultas dan prodi yang boleh dilihat pengguna ini.
 *
 * `cakupan === null` berarti cakupan institusi. Prodi nonaktif tetap ikut:
 * daftarnya menyaring data yang SUDAH ada, dan kurikulum prodi yang ditutup
 * tetap harus dapat ditemukan kembali.
 */
export async function muatUnit(cakupan: string[] | null): Promise<UnitTersedia> {
  const daftar = await prisma.prodi.findMany({
    where: cakupan === null ? {} : { id: { in: cakupan } },
    orderBy: [{ fakultas: { nama: "asc" } }, { nama: "asc" }],
    select: {
      id: true,
      kode: true,
      nama: true,
      // Nama institusi ikut supaya kop lembar peta — tiga tingkat unit, sama
      // seperti lembar struktur kurikulum yang dicetak prodi — tidak menuntut
      // kueri kedua di setiap halaman yang memakainya.
      fakultas: {
        select: { kode: true, nama: true, institusi: { select: { nama: true } } },
      },
    },
  });

  const fakultas = new Map<string, { nama: string; institusi: string }>();
  for (const p of daftar) {
    fakultas.set(p.fakultas.kode, {
      nama: p.fakultas.nama,
      institusi: p.fakultas.institusi.nama,
    });
  }

  return {
    fakultas: [...fakultas].map(([kode, f]) => ({ kode, ...f })),
    prodi: daftar.map((p) => ({
      id: p.id,
      kode: p.kode,
      nama: p.nama,
      fakultas: p.fakultas.kode,
    })),
  };
}

/**
 * Id prodi yang lolos saringan, atau `null` bila tidak ada saringan sama
 * sekali — pemanggil lalu memakai cakupannya sendiri.
 *
 * Kode yang tidak dikenal menghasilkan larik KOSONG, bukan `null`: memilih
 * prodi yang tidak ada harus berarti "tidak ada hasil", bukan diam-diam
 * berubah menjadi "tampilkan semua".
 */
export function prodiTersaring(
  unit: UnitTersedia,
  saringan: SaringanUnit,
): string[] | null {
  if (!saringan.fakultas && !saringan.prodi) return null;

  return unit.prodi
    .filter(
      (p) =>
        (saringan.fakultas === undefined || p.fakultas === saringan.fakultas) &&
        (saringan.prodi === undefined || p.kode === saringan.prodi),
    )
    .map((p) => p.id);
}

/**
 * Kop lembar peta: nama prodi, fakultas, dan institusinya.
 *
 * Hanya ada bila daftarnya memang menyempit ke SATU prodi. Kop menyebut satu
 * unit penyelenggara; memasangnya di atas daftar lintas prodi — yang dilihat
 * ADMIN dan GPM sebelum menyaring — berarti lembar itu menyatakan sesuatu yang
 * tidak benar tentang setengah barisnya.
 */
export function kopUnit(
  unit: UnitTersedia,
  prodiId: string | null,
): { prodi: string; fakultas: string; institusi: string } | null {
  if (!prodiId) return null;

  const prodi = unit.prodi.find((p) => p.id === prodiId);
  if (!prodi) return null;

  const fakultas = unit.fakultas.find((f) => f.kode === prodi.fakultas);
  if (!fakultas) return null;

  return { prodi: prodi.nama, fakultas: fakultas.nama, institusi: fakultas.institusi };
}

/**
 * Satu-satunya prodi yang sedang ditampilkan, atau null bila daftarnya masih
 * lintas prodi. Saringan yang dipilih pengguna lebih dulu; kalau tidak ada,
 * cakupan penugasannya sendiri — Kaprodi satu prodi tidak perlu menyaring
 * apa pun untuk mendapatkan lembar berkop.
 */
export function prodiTunggal(
  terpilih: string[] | null,
  cakupan: string[] | null,
): string | null {
  if (terpilih !== null) return terpilih.length === 1 ? terpilih[0] : null;
  return cakupan !== null && cakupan.length === 1 ? cakupan[0] : null;
}
