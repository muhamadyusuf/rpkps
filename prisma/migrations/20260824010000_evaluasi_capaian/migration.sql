-- AlterEnum
ALTER TYPE "JenisDasar" ADD VALUE 'TEMUAN_EVALUASI';

-- CreateEnum
CREATE TYPE "StatusEvaluasi" AS ENUM ('DRAF', 'DIHITUNG', 'DITUTUP');

-- CreateEnum
CREATE TYPE "TingkatCapaian" AS ENUM ('SUB_CPMK', 'CPMK', 'CPL');

-- CreateEnum
CREATE TYPE "StatusVerifikasi" AS ENUM ('BELUM', 'TERCAPAI', 'TIDAK_TERCAPAI');

-- CreateTable
CREATE TABLE "evaluasi_mk" (
    "id" TEXT NOT NULL,
    "kelas_id" TEXT NOT NULL,
    "status" "StatusEvaluasi" NOT NULL DEFAULT 'DRAF',
    "versi" INTEGER NOT NULL DEFAULT 1,
    "ambang_kelulusan_mhs" DECIMAL(5,2) NOT NULL DEFAULT 55,
    "ambang_ketercapaian_mk" DECIMAL(5,2) NOT NULL DEFAULT 85,
    "catatan_proses" TEXT,
    "ditutup_oleh_id" TEXT,
    "ditutup_pada" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluasi_mk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hasil_capaian" (
    "id" TEXT NOT NULL,
    "evaluasi_id" TEXT NOT NULL,
    "tingkat" "TingkatCapaian" NOT NULL,
    "kode" TEXT NOT NULL,
    "rerata" DECIMAL(6,2),
    "persen_lulus" DECIMAL(5,2),
    "tercapai" BOOLEAN NOT NULL DEFAULT false,
    "pita" TEXT NOT NULL,
    "jumlah_dinilai" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hasil_capaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluasi_snapshot" (
    "id" TEXT NOT NULL,
    "evaluasi_id" TEXT NOT NULL,
    "versi" INTEGER NOT NULL,
    "isi" JSONB NOT NULL,
    "sidik" TEXT NOT NULL,
    "oleh_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluasi_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temuan_evaluasi" (
    "id" TEXT NOT NULL,
    "evaluasi_id" TEXT NOT NULL,
    "tingkat" "TingkatCapaian" NOT NULL,
    "kode" TEXT NOT NULL,
    "capaian_terukur" DECIMAL(5,2),
    "akar_masalah" TEXT NOT NULL,
    "tindakan" TEXT NOT NULL,
    "penanggung_jawab_id" TEXT,
    "ta_sasaran_id" TEXT,
    "status_verifikasi" "StatusVerifikasi" NOT NULL DEFAULT 'BELUM',
    "catatan_verifikasi" TEXT,
    "diverifikasi_pada" TIMESTAMP(3),
    "diverifikasi_oleh_id" TEXT,
    "usulan_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temuan_evaluasi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evaluasi_mk_kelas_id_key" ON "evaluasi_mk"("kelas_id");

-- CreateIndex
CREATE INDEX "evaluasi_mk_status_idx" ON "evaluasi_mk"("status");

-- CreateIndex
CREATE INDEX "hasil_capaian_evaluasi_id_idx" ON "hasil_capaian"("evaluasi_id");

-- CreateIndex
CREATE UNIQUE INDEX "hasil_capaian_evaluasi_id_tingkat_kode_key" ON "hasil_capaian"("evaluasi_id", "tingkat", "kode");

-- CreateIndex
CREATE INDEX "evaluasi_snapshot_evaluasi_id_idx" ON "evaluasi_snapshot"("evaluasi_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluasi_snapshot_evaluasi_id_versi_key" ON "evaluasi_snapshot"("evaluasi_id", "versi");

-- CreateIndex
CREATE INDEX "temuan_evaluasi_evaluasi_id_idx" ON "temuan_evaluasi"("evaluasi_id");

-- CreateIndex
CREATE INDEX "temuan_evaluasi_status_verifikasi_idx" ON "temuan_evaluasi"("status_verifikasi");

-- CreateIndex
CREATE UNIQUE INDEX "temuan_evaluasi_evaluasi_id_tingkat_kode_key" ON "temuan_evaluasi"("evaluasi_id", "tingkat", "kode");

-- AddForeignKey
ALTER TABLE "evaluasi_mk" ADD CONSTRAINT "evaluasi_mk_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluasi_mk" ADD CONSTRAINT "evaluasi_mk_ditutup_oleh_id_fkey" FOREIGN KEY ("ditutup_oleh_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hasil_capaian" ADD CONSTRAINT "hasil_capaian_evaluasi_id_fkey" FOREIGN KEY ("evaluasi_id") REFERENCES "evaluasi_mk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluasi_snapshot" ADD CONSTRAINT "evaluasi_snapshot_evaluasi_id_fkey" FOREIGN KEY ("evaluasi_id") REFERENCES "evaluasi_mk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temuan_evaluasi" ADD CONSTRAINT "temuan_evaluasi_evaluasi_id_fkey" FOREIGN KEY ("evaluasi_id") REFERENCES "evaluasi_mk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temuan_evaluasi" ADD CONSTRAINT "temuan_evaluasi_penanggung_jawab_id_fkey" FOREIGN KEY ("penanggung_jawab_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temuan_evaluasi" ADD CONSTRAINT "temuan_evaluasi_ta_sasaran_id_fkey" FOREIGN KEY ("ta_sasaran_id") REFERENCES "tahun_akademik"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temuan_evaluasi" ADD CONSTRAINT "temuan_evaluasi_diverifikasi_oleh_id_fkey" FOREIGN KEY ("diverifikasi_oleh_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temuan_evaluasi" ADD CONSTRAINT "temuan_evaluasi_usulan_id_fkey" FOREIGN KEY ("usulan_id") REFERENCES "usulan_revisi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
