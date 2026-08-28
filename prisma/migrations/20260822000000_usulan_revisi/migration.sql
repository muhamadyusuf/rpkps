-- CreateEnum
CREATE TYPE "StatusUsulan" AS ENUM ('DRAF', 'DIAJUKAN', 'DIREVISI', 'DISETUJUI', 'DITERAPKAN', 'DITOLAK', 'DITARIK');

-- CreateEnum
CREATE TYPE "StatusButir" AS ENUM ('BARU', 'DITERIMA', 'DISESUAIKAN', 'DITOLAK');

-- CreateEnum
CREATE TYPE "JenisButir" AS ENUM ('CPMK_BARU', 'CPMK_RUMUSAN', 'CPMK_PETA_CPL', 'CPMK_PENSIUN', 'SUB_BARU', 'SUB_RUMUSAN', 'SUB_MINGGU', 'SUB_PENSIUN', 'CATATAN_CPL');

-- CreateEnum
CREATE TYPE "JenisDasar" AS ENUM ('TEMUAN_VALIDATOR', 'SINYAL_INDUSTRI', 'MASUKAN_DUDI', 'TRACER', 'CATATAN_DOSEN');

-- AlterTable
ALTER TABLE "cpmk" ADD COLUMN     "pensiun_sejak_ta_id" TEXT;

-- AlterTable
ALTER TABLE "kurikulum" ADD COLUMN     "revisi" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sub_cpmk" ADD COLUMN     "pensiun_sejak_ta_id" TEXT;

-- CreateTable
CREATE TABLE "usulan_revisi" (
    "id" TEXT NOT NULL,
    "kurikulum_id" TEXT NOT NULL,
    "mata_kuliah_id" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "latar" TEXT NOT NULL,
    "status" "StatusUsulan" NOT NULL DEFAULT 'DRAF',
    "jalur_ralat" BOOLEAN NOT NULL DEFAULT false,
    "diajukan_oleh_id" TEXT NOT NULL,
    "diajukan_pada" TIMESTAMP(3),
    "diputuskan_oleh_id" TEXT,
    "diputuskan_pada" TIMESTAMP(3),
    "catatan_pemutus" TEXT,
    "berlaku_mulai_ta_id" TEXT,
    "diterapkan_pada" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usulan_revisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "butir_usulan" (
    "id" TEXT NOT NULL,
    "usulan_id" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "jenis" "JenisButir" NOT NULL,
    "status" "StatusButir" NOT NULL DEFAULT 'BARU',
    "cpmk_kode" TEXT NOT NULL,
    "sub_cpmk_kode" TEXT,
    "rumusan" TEXT,
    "rumusan_en" TEXT,
    "level_bloom" "LevelBloom",
    "kko" TEXT,
    "cpl_kode" TEXT[],
    "minggu_disarankan" INTEGER[],
    "alasan" TEXT NOT NULL,
    "catatan_pemutus" TEXT,
    "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM',
    "cpmk_id" TEXT,
    "sub_cpmk_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "butir_usulan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dasar_butir" (
    "id" TEXT NOT NULL,
    "butir_id" TEXT NOT NULL,
    "jenis" "JenisDasar" NOT NULL,
    "ref" TEXT,
    "kutipan" TEXT NOT NULL,

    CONSTRAINT "dasar_butir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catatan_usulan" (
    "id" TEXT NOT NULL,
    "usulan_id" TEXT NOT NULL,
    "oleh_id" TEXT,
    "isi" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catatan_usulan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisi_kurikulum" (
    "id" TEXT NOT NULL,
    "kurikulum_id" TEXT NOT NULL,
    "revisi_ke" INTEGER NOT NULL,
    "usulan_id" TEXT NOT NULL,
    "ringkasan" TEXT NOT NULL,
    "disahkan_sendiri" BOOLEAN NOT NULL DEFAULT false,
    "oleh_id" TEXT,
    "berlaku_mulai_ta_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisi_kurikulum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usulan_revisi_kurikulum_id_status_idx" ON "usulan_revisi"("kurikulum_id", "status");

-- CreateIndex
CREATE INDEX "usulan_revisi_mata_kuliah_id_idx" ON "usulan_revisi"("mata_kuliah_id");

-- CreateIndex
CREATE INDEX "usulan_revisi_status_idx" ON "usulan_revisi"("status");

-- CreateIndex
CREATE INDEX "butir_usulan_usulan_id_idx" ON "butir_usulan"("usulan_id");

-- CreateIndex
CREATE INDEX "dasar_butir_butir_id_idx" ON "dasar_butir"("butir_id");

-- CreateIndex
CREATE INDEX "catatan_usulan_usulan_id_idx" ON "catatan_usulan"("usulan_id");

-- CreateIndex
CREATE UNIQUE INDEX "revisi_kurikulum_usulan_id_key" ON "revisi_kurikulum"("usulan_id");

-- CreateIndex
CREATE INDEX "revisi_kurikulum_kurikulum_id_idx" ON "revisi_kurikulum"("kurikulum_id");

-- CreateIndex
CREATE UNIQUE INDEX "revisi_kurikulum_kurikulum_id_revisi_ke_key" ON "revisi_kurikulum"("kurikulum_id", "revisi_ke");

-- AddForeignKey
ALTER TABLE "cpmk" ADD CONSTRAINT "cpmk_pensiun_sejak_ta_id_fkey" FOREIGN KEY ("pensiun_sejak_ta_id") REFERENCES "tahun_akademik"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_cpmk" ADD CONSTRAINT "sub_cpmk_pensiun_sejak_ta_id_fkey" FOREIGN KEY ("pensiun_sejak_ta_id") REFERENCES "tahun_akademik"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usulan_revisi" ADD CONSTRAINT "usulan_revisi_kurikulum_id_fkey" FOREIGN KEY ("kurikulum_id") REFERENCES "kurikulum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usulan_revisi" ADD CONSTRAINT "usulan_revisi_mata_kuliah_id_fkey" FOREIGN KEY ("mata_kuliah_id") REFERENCES "mata_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usulan_revisi" ADD CONSTRAINT "usulan_revisi_diajukan_oleh_id_fkey" FOREIGN KEY ("diajukan_oleh_id") REFERENCES "pengguna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usulan_revisi" ADD CONSTRAINT "usulan_revisi_diputuskan_oleh_id_fkey" FOREIGN KEY ("diputuskan_oleh_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usulan_revisi" ADD CONSTRAINT "usulan_revisi_berlaku_mulai_ta_id_fkey" FOREIGN KEY ("berlaku_mulai_ta_id") REFERENCES "tahun_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "butir_usulan" ADD CONSTRAINT "butir_usulan_usulan_id_fkey" FOREIGN KEY ("usulan_id") REFERENCES "usulan_revisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "butir_usulan" ADD CONSTRAINT "butir_usulan_cpmk_id_fkey" FOREIGN KEY ("cpmk_id") REFERENCES "cpmk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "butir_usulan" ADD CONSTRAINT "butir_usulan_sub_cpmk_id_fkey" FOREIGN KEY ("sub_cpmk_id") REFERENCES "sub_cpmk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dasar_butir" ADD CONSTRAINT "dasar_butir_butir_id_fkey" FOREIGN KEY ("butir_id") REFERENCES "butir_usulan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catatan_usulan" ADD CONSTRAINT "catatan_usulan_usulan_id_fkey" FOREIGN KEY ("usulan_id") REFERENCES "usulan_revisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catatan_usulan" ADD CONSTRAINT "catatan_usulan_oleh_id_fkey" FOREIGN KEY ("oleh_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_kurikulum" ADD CONSTRAINT "revisi_kurikulum_kurikulum_id_fkey" FOREIGN KEY ("kurikulum_id") REFERENCES "kurikulum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_kurikulum" ADD CONSTRAINT "revisi_kurikulum_usulan_id_fkey" FOREIGN KEY ("usulan_id") REFERENCES "usulan_revisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_kurikulum" ADD CONSTRAINT "revisi_kurikulum_oleh_id_fkey" FOREIGN KEY ("oleh_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisi_kurikulum" ADD CONSTRAINT "revisi_kurikulum_berlaku_mulai_ta_id_fkey" FOREIGN KEY ("berlaku_mulai_ta_id") REFERENCES "tahun_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

