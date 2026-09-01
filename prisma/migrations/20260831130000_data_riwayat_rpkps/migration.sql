-- Riwayat RPKPS menyimpan peristiwanya, bukan kalimatnya (docs/11 §4.2c).
-- Baris lama sengaja TIDAK ditulis ulang: kolomnya nullable, dan `deskripsi`
-- yang sudah tersimpan tetap dipakai sebagai cadangan. Hal yang sama berlaku
-- untuk riwayat yang sudah membeku di dalam rpkps_snapshot.isi.
ALTER TABLE "rpkps_riwayat" ADD COLUMN "data" JSONB;
