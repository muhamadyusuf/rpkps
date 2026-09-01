-- Rantai pengesahan dan tiga tenggat (docs/14-tenggat-dan-rantai-pengesahan.md).
--
-- Dua hal yang saling mengunci. Tenggat tanpa rantai mengukur tahap yang tidak
-- ada; rantai tanpa tenggat mengulang masalah yang sama — dokumen menganggur di
-- meja seseorang tanpa ada yang tahu sudah berapa lama.

-- ── Tiga tenggat pada tahun akademik ────────────────────────────────────────
-- `tenggat_rpkps` DIGANTI NAMA, bukan dibuang lalu dibuat ulang: tanggal yang
-- sudah diisi Admin untuk semester berjalan harus tetap ada setelah migrasi.
ALTER TABLE "tahun_akademik" RENAME COLUMN "tenggat_rpkps" TO "tenggat_penyusunan";

ALTER TABLE "tahun_akademik" ADD COLUMN "tenggat_review" TIMESTAMP(3);
ALTER TABLE "tahun_akademik" ADD COLUMN "tenggat_pengesahan" TIMESTAMP(3);
ALTER TABLE "tahun_akademik" ADD COLUMN "jaminan_hari_putusan" INTEGER NOT NULL DEFAULT 7;

-- ── Rantai tanda tangan ─────────────────────────────────────────────────────
CREATE TYPE "PeranTtd" AS ENUM ('PENGAMPU', 'KOORDINATOR', 'KAPRODI', 'PENJAMINAN_MUTU');

CREATE TABLE "tanda_tangan_rpkps" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "versi" INTEGER NOT NULL,
    "peran" "PeranTtd" NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "identitas" TEXT,
    "sidik" TEXT NOT NULL,
    "ditandatangani_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tanda_tangan_rpkps_pkey" PRIMARY KEY ("id")
);

-- Satu orang satu cap per ronde. Ronde (`versi`) ikut kunci karena pengembalian
-- untuk revisi menaikkan versi dan menuntut tanda tangan ulang dari semua orang.
CREATE UNIQUE INDEX "tanda_tangan_rpkps_rpkps_id_versi_peran_pengguna_id_key" ON "tanda_tangan_rpkps"("rpkps_id", "versi", "peran", "pengguna_id");

CREATE INDEX "tanda_tangan_rpkps_rpkps_id_versi_idx" ON "tanda_tangan_rpkps"("rpkps_id", "versi");

ALTER TABLE "tanda_tangan_rpkps" ADD CONSTRAINT "tanda_tangan_rpkps_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT: penanda tangan dokumen resmi tidak boleh lenyap dari basis data.
ALTER TABLE "tanda_tangan_rpkps" ADD CONSTRAINT "tanda_tangan_rpkps_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dokumen yang terlanjur TERBIT sebelum migrasi ini TIDAK diberi tanda tangan
-- susulan. Mengarang baris untuk orang yang tidak pernah menekan tombolnya
-- adalah persis hal yang dicegah seluruh rancangan ini; blok tanda tangannya
-- tetap kosong seperti sebelumnya.
