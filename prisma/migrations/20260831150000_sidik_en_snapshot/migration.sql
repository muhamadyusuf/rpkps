-- Ruang sidik kedua untuk salinan beku (docs/11 §6.2).
--
-- Nullable dan tanpa backfill. `isi` dan `sidik` TIDAK tersentuh: menghitung
-- ulang sidik dokumen yang sudah ditandatangani akan meruntuhkan satu-satunya
-- bukti bahwa berkas yang dicetak hari ini sama dengan yang disahkan Kaprodi.
-- Dokumen yang terbit sebelum migrasi ini tetap `isi_en IS NULL`, dan halaman
-- /en/katalog menampilkan versi Indonesianya beserta keterangan.
ALTER TABLE "rpkps_snapshot" ADD COLUMN "isi_en" JSONB;
ALTER TABLE "rpkps_snapshot" ADD COLUMN "sidik_en" TEXT;
