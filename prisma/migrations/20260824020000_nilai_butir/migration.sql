-- CreateTable
CREATE TABLE "nilai_butir" (
    "id" TEXT NOT NULL,
    "peserta_kelas_id" TEXT NOT NULL,
    "butir_kisi_kisi_id" TEXT NOT NULL,
    "skor" DECIMAL(6,2) NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nilai_butir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nilai_butir_butir_kisi_kisi_id_idx" ON "nilai_butir"("butir_kisi_kisi_id");

-- CreateIndex
CREATE UNIQUE INDEX "nilai_butir_peserta_kelas_id_butir_kisi_kisi_id_key" ON "nilai_butir"("peserta_kelas_id", "butir_kisi_kisi_id");

-- AddForeignKey
ALTER TABLE "nilai_butir" ADD CONSTRAINT "nilai_butir_peserta_kelas_id_fkey" FOREIGN KEY ("peserta_kelas_id") REFERENCES "peserta_kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai_butir" ADD CONSTRAINT "nilai_butir_butir_kisi_kisi_id_fkey" FOREIGN KEY ("butir_kisi_kisi_id") REFERENCES "butir_kisi_kisi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
