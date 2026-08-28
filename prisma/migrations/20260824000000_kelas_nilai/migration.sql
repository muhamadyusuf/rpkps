-- CreateTable
CREATE TABLE "kelas" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "dosen_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mahasiswa" (
    "id" TEXT NOT NULL,
    "prodi_id" TEXT NOT NULL,
    "nim" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "angkatan" INTEGER,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mahasiswa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peserta_kelas" (
    "id" TEXT NOT NULL,
    "kelas_id" TEXT NOT NULL,
    "mahasiswa_id" TEXT NOT NULL,

    CONSTRAINT "peserta_kelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nilai_asesmen" (
    "id" TEXT NOT NULL,
    "peserta_kelas_id" TEXT NOT NULL,
    "asesmen_kode" TEXT NOT NULL,
    "skor" DECIMAL(6,2) NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nilai_asesmen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kelas_rpkps_id_idx" ON "kelas"("rpkps_id");

-- CreateIndex
CREATE UNIQUE INDEX "kelas_rpkps_id_kode_key" ON "kelas"("rpkps_id", "kode");

-- CreateIndex
CREATE INDEX "mahasiswa_prodi_id_angkatan_idx" ON "mahasiswa"("prodi_id", "angkatan");

-- CreateIndex
CREATE UNIQUE INDEX "mahasiswa_prodi_id_nim_key" ON "mahasiswa"("prodi_id", "nim");

-- CreateIndex
CREATE INDEX "peserta_kelas_kelas_id_idx" ON "peserta_kelas"("kelas_id");

-- CreateIndex
CREATE UNIQUE INDEX "peserta_kelas_kelas_id_mahasiswa_id_key" ON "peserta_kelas"("kelas_id", "mahasiswa_id");

-- CreateIndex
CREATE INDEX "nilai_asesmen_peserta_kelas_id_idx" ON "nilai_asesmen"("peserta_kelas_id");

-- CreateIndex
CREATE UNIQUE INDEX "nilai_asesmen_peserta_kelas_id_asesmen_kode_key" ON "nilai_asesmen"("peserta_kelas_id", "asesmen_kode");

-- AddForeignKey
ALTER TABLE "kelas" ADD CONSTRAINT "kelas_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kelas" ADD CONSTRAINT "kelas_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_prodi_id_fkey" FOREIGN KEY ("prodi_id") REFERENCES "prodi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peserta_kelas" ADD CONSTRAINT "peserta_kelas_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peserta_kelas" ADD CONSTRAINT "peserta_kelas_mahasiswa_id_fkey" FOREIGN KEY ("mahasiswa_id") REFERENCES "mahasiswa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai_asesmen" ADD CONSTRAINT "nilai_asesmen_peserta_kelas_id_fkey" FOREIGN KEY ("peserta_kelas_id") REFERENCES "peserta_kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
