import { Prisma, type PrismaClient } from "@/generated/prisma";
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
): { kelompok: KelompokTerjemahan[]; jumlah: number } {
  const per = new Map<string, KelompokTerjemahan>();
  let jumlah = 0;

  for (const p of pilihan) {
    if (!sah.has(p.alamat)) continue;
    const [model, id, medan] = p.alamat.split(":");
    if (!model || !id || !medan) continue;
    const izin = MEDAN_BOLEH[model];
    const kolom = izin?.kolom[medan];
    if (!izin || !kolom) continue;
    const teks = p.teks.trim();
    if (teks.length === 0) continue;

    const kunci = `${izin.tabel}.${kolom}`;
    const grup = per.get(kunci) ?? { tabel: izin.tabel, kolom, baris: [] };
    grup.baris.push({ id, teks });
    per.set(kunci, grup);
    jumlah += 1;
  }

  return { kelompok: [...per.values()], jumlah };
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
): Promise<void> {
  if (kelompok.length === 0) return;

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
  }, OPSI_TRANSAKSI);
}
