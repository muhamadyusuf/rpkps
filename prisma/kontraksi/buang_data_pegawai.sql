-- Kontraksi data pegawai (docs/26 §7) — DIJALANKAN PENGGUNA, BUKAN otomatis.
--
-- Berkas ini SENGAJA TIDAK ada di `prisma/migrations/`: `npm run db:migrate:pg` menerapkan
-- SEMUA migrasi di sana, dan kontraksi tidak boleh ikut terterap bersama migrasi "expand"
-- (`20260925000000_rujukan_identitas`). Pindahkan ke `prisma/migrations/<stempel>_buang_data_pegawai/
-- migration.sql` HANYA pada langkah 6 runbook (docs/26 §7), setelah prasyaratnya terpenuhi.
--
-- MENGHAPUS DATA — TIDAK BISA DIBATALKAN. Cadangkan basis data dulu (branch/snapshot Neon).
--
-- Yang dilakukan:
--   1. `nama` pegawai bertaut (identitas_akun_id terisi) diganti penampung dari surel. Kolom
--      `nama` tetap NOT NULL karena dipakai pengguna LOKAL (asesor, mahasiswa).
--   2. Tujuh kolom pribadi dibuang dari `pengguna`. Indeks unik atas nidn/nip/nik ikut lenyap.
--
-- TIDAK menyentuh catatan permanen, yang memang menyimpan nama sebagai bukti:
--   rpkps_snapshot.isi, tanda_tangan_rpkps.nama/identitas, rpkps_riwayat.data, log_audit.ringkasan.

BEGIN;

UPDATE "pengguna"
SET "nama" = split_part("email", '@', 1)
WHERE "identitas_akun_id" IS NOT NULL;

ALTER TABLE "pengguna"
  DROP COLUMN "gelar_depan",
  DROP COLUMN "gelar_belakang",
  DROP COLUMN "nidn",
  DROP COLUMN "nip",
  DROP COLUMN "nik",
  DROP COLUMN "telepon",
  DROP COLUMN "foto_url";

COMMIT;
