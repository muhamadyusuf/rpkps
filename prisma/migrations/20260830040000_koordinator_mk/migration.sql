-- Tabel penugasan koordinator mata kuliah (docs/13-penugasan-koordinator-mk.md §2.1).
--
-- Terikat tahun akademik, bukan kolom pada `mata_kuliah`: pemegang MK berganti
-- tiap semester, dan satu kolom berarti pergantian menimpa pemegang sebelumnya.
-- @@unique([mata_kuliah_id, tahun_akademik_id]) menjaga "satu MK satu pemegang
-- per tahun akademik"; tahun berikutnya adalah baris baru, dan yang lama tidak
-- disentuh — itulah riwayatnya.

-- CreateTable
CREATE TABLE "koordinator_mk" (
    "id" TEXT NOT NULL,
    "mata_kuliah_id" TEXT NOT NULL,
    "tahun_akademik_id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "ditetapkan_oleh_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "koordinator_mk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "koordinator_mk_mata_kuliah_id_tahun_akademik_id_key" ON "koordinator_mk"("mata_kuliah_id", "tahun_akademik_id");

-- CreateIndex
CREATE INDEX "koordinator_mk_tahun_akademik_id_idx" ON "koordinator_mk"("tahun_akademik_id");

-- CreateIndex
CREATE INDEX "koordinator_mk_pengguna_id_tahun_akademik_id_idx" ON "koordinator_mk"("pengguna_id", "tahun_akademik_id");

-- AddForeignKey
ALTER TABLE "koordinator_mk" ADD CONSTRAINT "koordinator_mk_mata_kuliah_id_fkey" FOREIGN KEY ("mata_kuliah_id") REFERENCES "mata_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "koordinator_mk" ADD CONSTRAINT "koordinator_mk_tahun_akademik_id_fkey" FOREIGN KEY ("tahun_akademik_id") REFERENCES "tahun_akademik"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "koordinator_mk" ADD CONSTRAINT "koordinator_mk_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "koordinator_mk" ADD CONSTRAINT "koordinator_mk_ditetapkan_oleh_id_fkey" FOREIGN KEY ("ditetapkan_oleh_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
