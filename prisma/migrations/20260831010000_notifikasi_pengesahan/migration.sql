-- Dua serah terima baru pada rantai pengesahan (docs/14 §4.2).
--
-- Berdiri sendiri, terpisah dari migrasi yang memakainya: PostgreSQL menolak
-- PEMAKAIAN nilai enum baru di dalam transaksi yang sama dengan
-- `ALTER TYPE … ADD VALUE`, dan penerap migrasi di `prisma/terapkan-migrasi.mts`
-- membungkus satu berkas = satu transaksi.

-- AlterEnum
ALTER TYPE "JenisNotifikasi" ADD VALUE 'RPKPS_MENUNGGU_PENGESAHAN';
ALTER TYPE "JenisNotifikasi" ADD VALUE 'RPKPS_DISAHKAN';
