-- Wallpaper foto kampus untuk rupa iPad (docs/27 §4.4). Seluruhnya opsional:
-- tanpa foto, atau dengan `wallpaper_aktif = false`, aplikasi memakai gradien
-- bawaan. Tidak ada baris yang perlu diisi ulang.
ALTER TABLE "institusi" ADD COLUMN "wallpaper" BYTEA;
ALTER TABLE "institusi" ADD COLUMN "wallpaper_tipe" TEXT;
ALTER TABLE "institusi" ADD COLUMN "wallpaper_aktif" BOOLEAN NOT NULL DEFAULT false;
-- Cap versi tersendiri, bukan `diubah_pada` baris institusi: mengubah alamat
-- institusi tidak boleh membuat setiap peramban mengunduh ulang foto
-- beberapa megabita.
ALTER TABLE "institusi" ADD COLUMN "wallpaper_diubah" TIMESTAMP(3);
