import { Prisma, type PrismaClient } from "@/generated/prisma";
import { uraiAlamat } from "@/domain/rpkps/terjemahan";
import { MEDAN_BOLEH } from "./medan-en";

/**
 * Penulisan kolom terjemahan isi RPKPS — lapisan basis data untuk
 * `terapkanTerjemahan` (docs/11 §8.6).
 *
 * Klien Prisma diterima sebagai PARAMETER, bukan diimpor dari `@/lib/prisma`,
 * mengikuti alasan yang sama seperti `nilai-inti.ts`: berkas ini berisi satu-
 * satunya SQL tulis-tangan di seluruh aplikasi, dan SQL tulis-tangan harus
 * dapat dijalankan uji integrasi terhadap Postgres sungguhan. `Prisma.raw`
 * tidak memvalidasi apa pun; yang salah baru terlihat saat dieksekusi.
 *
 * BANYAKNYA KUERI PER TRANSAKSI TIDAK BOLEH IKUT BESAR DOKUMEN. Sebuah RPKPS
 * penuh punya ratusan medan — 16 pertemuan saja sudah lebih dari seratus.
 * Versi pertama menulis satu `update` per medan di dalam satu transaksi, dan
 * itu melampaui batas waktu transaksi pada dokumen berukuran biasa: batasnya
 * dihitung sejak transaksi dibuka, bukan per kueri. Setelah dikelompokkan,
 * jumlah kueri terikat pada BANYAK KOLOM (paling banyak 20), bukan pada besar
 * dokumen.
 */

export type Klien = PrismaClient;

/** Satu kolom `*En` beserta baris-baris yang menerima terjemahannya. */
export interface KelompokTerjemahan {
  tabel: string;
  kolom: string;
  baris: { id: string; teks: string }[];
}

/**
 * Satu kolom `String[]` beserta larik UTUH yang menggantikannya.
 *
 * Bukan per elemen: `UPDATE … SET subtopik_en[3] = …` pada larik yang lebih
 * pendek diam-diam mengisi posisi sebelumnya dengan NULL, dan `String[]`
 * Prisma menolak membacanya kembali. Jadi lariknya disusun utuh di sini,
 * di atas larik yang sekarang, lalu ditulis sekali.
 */
export interface KelompokLarik {
  tabel: string;
  kolom: string;
  baris: { id: string; teks: string[] }[];
}

/**
 * Larik `*En` yang sekarang, dikunci `model:id:medan`.
 *
 * Datang dari RPKPS yang baru dimuat, dan panjangnya mengikuti larik
 * INDONESIA — itulah yang menentukan berapa elemen dokumen ini punya. Tanpa
 * dasar ini, menerapkan satu subtopik saja akan memangkas subtopik lain yang
 * sudah diterjemahkan lebih dulu.
 */
export type LarikSekarang = ReadonlyMap<string, readonly string[]>;

/**
 * Batas waktu transaksi. Setelah penulisannya dijamakkan, angka ini MARGIN —
 * bukan perbaikannya: ia menampung koneksi yang sedang lambat atau basis data
 * tanpa server yang baru bangun, bukan kueri per baris.
 */
const OPSI_TRANSAKSI = { timeout: 20_000, maxWait: 10_000 };

/**
 * Menyaring pilihan dosen menjadi kelompok tulis, dikelompokkan menurut
 * PASANGAN tabel+kolom.
 *
 * Dua pagar, dan keduanya perlu. `sah` berisi alamat yang benar-benar milik
 * RPKPS yang sedang dibuka — tanpa itu, sebuah alamat `pertemuan:<id milik
 * dokumen lain>:topikEn` akan menulis ke dokumen orang lain, sebab id baris
 * bersifat global. `MEDAN_BOLEH` membatasi kolom yang boleh disentuh — tanpa
 * itu, alamat kiriman peramban menjadi tulis-apa-saja-ke-mana-saja.
 */
export function kelompokkanTerjemahan(
  sah: ReadonlySet<string>,
  pilihan: readonly { alamat: string; teks: string }[],
  /** Larik `*En` yang sekarang — wajib bila ada alamat berindeks di pilihan. */
  larikSekarang: LarikSekarang = new Map(),
): { kelompok: KelompokTerjemahan[]; larik: KelompokLarik[]; jumlah: number } {
  const per = new Map<string, KelompokTerjemahan>();
  /** Kunci `tabel.kolom` → id baris → larik yang sedang disusun. */
  const perLarik = new Map<string, { tabel: string; kolom: string; baris: Map<string, string[]> }>();
  let jumlah = 0;

  for (const p of pilihan) {
    if (!sah.has(p.alamat)) continue;
    const alamat = uraiAlamat(p.alamat);
    if (!alamat) continue;
    const izin = MEDAN_BOLEH[alamat.model];
    if (!izin) continue;
    const teks = p.teks.trim();
    if (teks.length === 0) continue;

    if (alamat.indeks == null) {
      const kolom = izin.kolom[alamat.medan];
      if (!kolom) continue;
      const kunci = `${izin.tabel}.${kolom}`;
      const grup = per.get(kunci) ?? { tabel: izin.tabel, kolom, baris: [] };
      grup.baris.push({ id: alamat.id, teks });
      per.set(kunci, grup);
      jumlah += 1;
      continue;
    }

    const kolom = izin.larik?.[alamat.medan];
    if (!kolom) continue;
    /*
     * Dasarnya larik yang sekarang, bukan larik kosong: dosen boleh menerapkan
     * satu elemen saja, dan elemen lain yang sudah diterjemahkan harus tetap
     * ada. Tanpa dasar itu — atau bila indeksnya di luar jangkauan larik
     * Indonesia — pilihan ini dilewati, bukan ditulis ke posisi karangan.
     */
    const dasar = larikSekarang.get(`${alamat.model}:${alamat.id}:${alamat.medan}`);
    if (!dasar || alamat.indeks >= dasar.length) continue;

    const kunci = `${izin.tabel}.${kolom}`;
    const grup = perLarik.get(kunci) ?? { tabel: izin.tabel, kolom, baris: new Map() };
    const nilai = grup.baris.get(alamat.id) ?? [...dasar];
    nilai[alamat.indeks] = teks;
    grup.baris.set(alamat.id, nilai);
    perLarik.set(kunci, grup);
    jumlah += 1;
  }

  return {
    kelompok: [...per.values()],
    larik: [...perLarik.values()].map((g) => ({
      tabel: g.tabel,
      kolom: g.kolom,
      baris: [...g.baris].map(([id, teks]) => ({ id, teks })),
    })),
    jumlah,
  };
}

/**
 * Menulis kelompok terjemahan dalam satu transaksi.
 *
 * Hanya kolom `*En` yang disentuh, dan hanya kolom itu. Sengaja BUKAN lewat
 * `simpanPertemuan`/`simpanTugas`: keduanya mengganti seluruh isi baris, dan
 * memakainya di sini berarti menulis ulang isi Indonesia dari data yang
 * dibaca beberapa detik lalu — menimpa suntingan rekan setim yang terjadi
 * selagi model bekerja. Arah sebaliknya aman: menulis kolom terjemahan saja
 * tidak dapat menghapus apa pun yang lain (docs/11 §5.3).
 */
export async function tulisTerjemahan(
  klien: Klien,
  kelompok: readonly KelompokTerjemahan[],
  larik: readonly KelompokLarik[] = [],
): Promise<void> {
  if (kelompok.length === 0 && larik.length === 0) return;

  await klien.$transaction(async (tx) => {
    for (const grup of kelompok) {
      /*
       * Satu `UPDATE … FROM (VALUES …)` per kolom. Nama tabel dan kolom masuk
       * lewat `Prisma.raw` — keduanya berasal dari `MEDAN_BOLEH`, konstanta di
       * repositori ini, tidak pernah dari peramban. Id dan teks tetap
       * parameter terikat.
       *
       * Cast `::text` bukan hiasan: parameter di dalam `VALUES` sampai ke
       * Postgres bertipe unknown, dan tanpa penegasan tipe pembandingnya
       * ditolak dengan "could not determine data type".
       */
      const nilai = Prisma.join(
        grup.baris.map((b) => Prisma.sql`(${b.id}::text, ${b.teks}::text)`),
      );
      await tx.$executeRaw`
        UPDATE ${Prisma.raw(`"${grup.tabel}"`)} AS t
        SET ${Prisma.raw(`"${grup.kolom}"`)} = v.teks
        FROM (VALUES ${nilai}) AS v(id, teks)
        WHERE t.id = v.id
      `;
    }

    for (const grup of larik) {
      // Bentuknya sama, hanya tipe nilainya `text[]`. Cast-nya tetap wajib
      // dengan alasan yang sama: parameter di dalam `VALUES` sampai ke
      // Postgres bertipe unknown.
      const nilai = Prisma.join(
        grup.baris.map((b) => Prisma.sql`(${b.id}::text, ${b.teks}::text[])`),
      );
      await tx.$executeRaw`
        UPDATE ${Prisma.raw(`"${grup.tabel}"`)} AS t
        SET ${Prisma.raw(`"${grup.kolom}"`)} = v.teks
        FROM (VALUES ${nilai}) AS v(id, teks)
        WHERE t.id = v.id
      `;
    }
  }, OPSI_TRANSAKSI);
}
