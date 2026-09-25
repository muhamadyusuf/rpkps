-- Wallpaper foto kampus dilepas (docs/28 §9.1): rupa Pengaturan tidak punya
-- layar kunci maupun layar utama tempat ia tampil. Kolomnya ditambahkan
-- 20260925010000_wallpaper_institusi pada hari yang sama dan belum pernah
-- berisi foto.
ALTER TABLE "institusi" DROP COLUMN IF EXISTS "wallpaper";
ALTER TABLE "institusi" DROP COLUMN IF EXISTS "wallpaper_tipe";
ALTER TABLE "institusi" DROP COLUMN IF EXISTS "wallpaper_aktif";
ALTER TABLE "institusi" DROP COLUMN IF EXISTS "wallpaper_diubah";
