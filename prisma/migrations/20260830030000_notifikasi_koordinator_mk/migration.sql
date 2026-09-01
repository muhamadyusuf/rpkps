-- Jenis notifikasi untuk penugasan koordinator mata kuliah (docs/13 §2.3).
--
-- Berdiri sendiri sebagai satu migrasi, terpisah dari tabel `koordinator_mk`
-- yang memakainya: PostgreSQL menolak PEMAKAIAN nilai enum baru di dalam
-- transaksi yang sama dengan `ALTER TYPE … ADD VALUE`, dan penerap migrasi di
-- `prisma/terapkan-migrasi.mts` membungkus satu berkas = satu transaksi.

-- AlterEnum
ALTER TYPE "JenisNotifikasi" ADD VALUE 'KOORDINATOR_MK_DITETAPKAN';
