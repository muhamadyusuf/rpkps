-- CreateEnum
CREATE TYPE "JenisNotifikasi" AS ENUM ('RPKPS_DIAJUKAN', 'RPKPS_DISETUJUI', 'RPKPS_DIREVISI', 'RPKPS_PENGAMPU', 'USULAN_DIAJUKAN', 'USULAN_DIPUTUSKAN');

-- AlterTable
ALTER TABLE "tahun_akademik" ADD COLUMN     "tenggat_rpkps" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notifikasi" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "jenis" "JenisNotifikasi" NOT NULL,
    "judul" TEXT NOT NULL,
    "ringkasan" TEXT NOT NULL,
    "tautan" TEXT,
    "entitas" TEXT,
    "entitas_id" TEXT,
    "dibaca_pada" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifikasi_pengguna_id_dibaca_pada_idx" ON "notifikasi"("pengguna_id", "dibaca_pada");

-- CreateIndex
CREATE INDEX "notifikasi_pengguna_id_dibuat_pada_idx" ON "notifikasi"("pengguna_id", "dibuat_pada");

-- AddForeignKey
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;
