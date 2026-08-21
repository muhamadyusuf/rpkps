-- CreateEnum
CREATE TYPE "JenisTugas" AS ENUM ('INDIVIDU', 'KELOMPOK');

-- CreateTable
CREATE TABLE "tugas" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" "JenisTugas" NOT NULL DEFAULT 'INDIVIDU',
    "minggu_mulai" INTEGER NOT NULL,
    "minggu_selesai" INTEGER NOT NULL,
    "komponen_nilai_id" TEXT,
    "bobot" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "deskripsi" TEXT NOT NULL,
    "uraian_tugas" TEXT,
    "format_luaran" TEXT,
    "ketentuan_lain" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tugas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tugas_sub_cpmk" (
    "tugas_id" TEXT NOT NULL,
    "sub_cpmk_id" TEXT NOT NULL,

    CONSTRAINT "tugas_sub_cpmk_pkey" PRIMARY KEY ("tugas_id","sub_cpmk_id")
);

-- CreateTable
CREATE TABLE "kriteria_tugas" (
    "id" TEXT NOT NULL,
    "tugas_id" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL,
    "indikator" TEXT NOT NULL,
    "rincian" TEXT[],
    "bobot" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "kriteria_tugas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linimasa_tugas" (
    "id" TEXT NOT NULL,
    "tugas_id" TEXT NOT NULL,
    "minggu" INTEGER NOT NULL,
    "tahapan" TEXT NOT NULL,
    "aktivitas" TEXT NOT NULL,

    CONSTRAINT "linimasa_tugas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tugas_rpkps_id_idx" ON "tugas"("rpkps_id");

-- CreateIndex
CREATE UNIQUE INDEX "tugas_rpkps_id_nomor_key" ON "tugas"("rpkps_id", "nomor");

-- CreateIndex
CREATE UNIQUE INDEX "kriteria_tugas_tugas_id_nomor_key" ON "kriteria_tugas"("tugas_id", "nomor");

-- CreateIndex
CREATE UNIQUE INDEX "linimasa_tugas_tugas_id_minggu_key" ON "linimasa_tugas"("tugas_id", "minggu");

-- AddForeignKey
ALTER TABLE "tugas" ADD CONSTRAINT "tugas_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tugas" ADD CONSTRAINT "tugas_komponen_nilai_id_fkey" FOREIGN KEY ("komponen_nilai_id") REFERENCES "komponen_nilai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tugas_sub_cpmk" ADD CONSTRAINT "tugas_sub_cpmk_tugas_id_fkey" FOREIGN KEY ("tugas_id") REFERENCES "tugas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tugas_sub_cpmk" ADD CONSTRAINT "tugas_sub_cpmk_sub_cpmk_id_fkey" FOREIGN KEY ("sub_cpmk_id") REFERENCES "sub_cpmk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kriteria_tugas" ADD CONSTRAINT "kriteria_tugas_tugas_id_fkey" FOREIGN KEY ("tugas_id") REFERENCES "tugas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linimasa_tugas" ADD CONSTRAINT "linimasa_tugas_tugas_id_fkey" FOREIGN KEY ("tugas_id") REFERENCES "tugas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

