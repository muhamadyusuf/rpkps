-- Notifikasi menyimpan peristiwanya, bukan kalimatnya (docs/11 §4.2).
-- Baris lama sengaja TIDAK ditulis ulang: kolomnya nullable, dan `judul`
-- serta `ringkasan` yang sudah tersimpan tetap dipakai sebagai cadangan.
ALTER TABLE "notifikasi" ADD COLUMN "data" JSONB;
