-- Rujukan ke identitas-itts (docs/26): data pegawai dibaca dari sana, bukan disalin.
--
-- HANYA MENAMBAH — tidak ada kolom yang dihapus atau diubah, jadi aman diterapkan
-- sebelum kode baru dan aman dibatalkan dengan men-deploy versi lama. Kolom
-- pribadi lama di `pengguna` (nama, gelar, nidn, nip, nik, telepon, foto_url)
-- baru dibuang pada tahap kontraksi terpisah (docs/26 §7), setelah pengisian
-- rujukan diverifikasi.
--
--   pengguna.identitas_akun_id   kunci ke Akun.id di identitas-itts (null = pengguna lokal)
--   pengguna.sinkron_pada        kapan peran turunannya terakhir disegarkan
--   penugasan_peran.sumber       LOKAL (admin RPKPS) | IDENTITAS (proyeksi dari jabatan)
--   prodi.identitas_unit_id      unit PRODI di identitas-itts yang sama dengan prodi ini
--
-- Penugasan yang sudah ada otomatis berstatus LOKAL (bawaan kolom).

-- CreateEnum
CREATE TYPE "SumberPenugasan" AS ENUM ('LOKAL', 'IDENTITAS');

-- AlterTable
ALTER TABLE "prodi" ADD COLUMN     "identitas_unit_id" TEXT;

-- AlterTable
ALTER TABLE "pengguna" ADD COLUMN     "identitas_akun_id" TEXT,
ADD COLUMN     "sinkron_pada" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "penugasan_peran" ADD COLUMN     "sumber" "SumberPenugasan" NOT NULL DEFAULT 'LOKAL';

-- CreateIndex
CREATE UNIQUE INDEX "prodi_identitas_unit_id_key" ON "prodi"("identitas_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_identitas_akun_id_key" ON "pengguna"("identitas_akun_id");

-- CreateIndex
CREATE INDEX "penugasan_peran_sumber_idx" ON "penugasan_peran"("sumber");

