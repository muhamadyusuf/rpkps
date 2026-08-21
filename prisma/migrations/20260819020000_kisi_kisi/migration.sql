-- CreateEnum
CREATE TYPE "JenisUjian" AS ENUM ('UTS', 'UAS');

-- CreateEnum
CREATE TYPE "BentukSoal" AS ENUM ('PILIHAN_GANDA', 'ESAI', 'URAIAN_SINGKAT', 'STUDI_KASUS', 'PRAKTIK', 'PROYEK', 'LISAN');

-- CreateTable
CREATE TABLE "kisi_kisi" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "jenis" "JenisUjian" NOT NULL,
    "total_skor" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "durasi_menit" INTEGER,
    "catatan" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kisi_kisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "butir_kisi_kisi" (
    "id" TEXT NOT NULL,
    "kisi_kisi_id" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL,
    "sub_cpmk_id" TEXT NOT NULL,
    "level_bloom" "LevelBloom" NOT NULL,
    "bentuk" "BentukSoal" NOT NULL DEFAULT 'ESAI',
    "jumlah_butir" INTEGER NOT NULL DEFAULT 1,
    "skor" DECIMAL(6,2) NOT NULL,
    "indikator" TEXT,

    CONSTRAINT "butir_kisi_kisi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kisi_kisi_rpkps_id_jenis_key" ON "kisi_kisi"("rpkps_id", "jenis");

-- CreateIndex
CREATE INDEX "butir_kisi_kisi_sub_cpmk_id_idx" ON "butir_kisi_kisi"("sub_cpmk_id");

-- CreateIndex
CREATE UNIQUE INDEX "butir_kisi_kisi_kisi_kisi_id_nomor_key" ON "butir_kisi_kisi"("kisi_kisi_id", "nomor");

-- AddForeignKey
ALTER TABLE "kisi_kisi" ADD CONSTRAINT "kisi_kisi_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "butir_kisi_kisi" ADD CONSTRAINT "butir_kisi_kisi_kisi_kisi_id_fkey" FOREIGN KEY ("kisi_kisi_id") REFERENCES "kisi_kisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "butir_kisi_kisi" ADD CONSTRAINT "butir_kisi_kisi_sub_cpmk_id_fkey" FOREIGN KEY ("sub_cpmk_id") REFERENCES "sub_cpmk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

