-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JenjangProdi" AS ENUM ('D3', 'D4', 'S1', 'S2', 'S3', 'PROFESI');

-- CreateEnum
CREATE TYPE "SemesterTipe" AS ENUM ('GANJIL', 'GENAP', 'ANTARA');

-- CreateEnum
CREATE TYPE "StatusPengguna" AS ENUM ('AKTIF', 'NONAKTIF', 'MENUNGGU_VERIFIKASI');

-- CreateEnum
CREATE TYPE "Peran" AS ENUM ('ADMIN', 'KAPRODI', 'GPM', 'KOORDINATOR_MK', 'DOSEN', 'MAHASISWA', 'ASESOR');

-- CreateEnum
CREATE TYPE "StatusKebijakan" AS ENUM ('DRAF', 'BERLAKU', 'ARSIP');

-- CreateEnum
CREATE TYPE "BentukPembelajaran" AS ENUM ('KULIAH', 'RESPONSI', 'TUTORIAL', 'SEMINAR', 'PRAKTIKUM', 'PRAKTIK_STUDIO', 'PRAKTIK_BENGKEL', 'PRAKTIK_LAPANGAN', 'PENELITIAN', 'PKM', 'KKN');

-- CreateEnum
CREATE TYPE "StatusKurikulum" AS ENUM ('DRAF', 'BERLAKU', 'ARSIP');

-- CreateEnum
CREATE TYPE "RanahCpl" AS ENUM ('SIKAP', 'PENGETAHUAN', 'KETERAMPILAN_UMUM', 'KETERAMPILAN_KHUSUS');

-- CreateEnum
CREATE TYPE "StatusMataKuliah" AS ENUM ('WAJIB', 'PILIHAN', 'WAJIB_UMUM');

-- CreateEnum
CREATE TYPE "JenisPrasyarat" AS ENUM ('PRASYARAT', 'BERSAMAAN');

-- CreateEnum
CREATE TYPE "LevelBloom" AS ENUM ('C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'A1', 'A2', 'A3', 'A4', 'A5', 'P1', 'P2', 'P3', 'P4', 'P5');

-- CreateEnum
CREATE TYPE "StatusRpkps" AS ENUM ('DRAF', 'DIAJUKAN', 'DIREVISI', 'DISETUJUI', 'TERBIT', 'ARSIP');

-- CreateEnum
CREATE TYPE "PeranPengampu" AS ENUM ('KOORDINATOR', 'ANGGOTA');

-- CreateEnum
CREATE TYPE "JenisPustaka" AS ENUM ('UTAMA', 'PENDUKUNG', 'DARING', 'TOOLS');

-- CreateEnum
CREATE TYPE "JenisPertemuan" AS ENUM ('EFEKTIF', 'UTS', 'UAS');

-- CreateEnum
CREATE TYPE "KategoriWaktu" AS ENUM ('TM', 'PT', 'BM');

-- CreateEnum
CREATE TYPE "ModePembelajaran" AS ENUM ('LURING', 'DARING_SINKRON', 'DARING_ASINKRON');

-- CreateTable
CREATE TABLE "institusi" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nama_singkat" TEXT NOT NULL,
    "kode_pt" TEXT,
    "alamat" TEXT,
    "situs" TEXT,
    "logo_url" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institusi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fakultas" (
    "id" TEXT NOT NULL,
    "institusi_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fakultas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prodi" (
    "id" TEXT NOT NULL,
    "fakultas_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "jenjang" "JenjangProdi" NOT NULL DEFAULT 'S1',
    "gelar" TEXT,
    "akreditasi" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prodi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tahun_akademik" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "tahun_mulai" INTEGER NOT NULL,
    "tahun_selesai" INTEGER NOT NULL,
    "semester" "SemesterTipe" NOT NULL,
    "tanggal_mulai" TIMESTAMP(3),
    "tanggal_akhir" TIMESTAMP(3),
    "aktif" BOOLEAN NOT NULL DEFAULT false,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tahun_akademik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengguna" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "gelar_depan" TEXT,
    "gelar_belakang" TEXT,
    "nidn" TEXT,
    "nip" TEXT,
    "nik" TEXT,
    "telepon" TEXT,
    "foto_url" TEXT,
    "status" "StatusPengguna" NOT NULL DEFAULT 'MENUNGGU_VERIFIKASI',
    "terakhir_masuk" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pengguna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penugasan_peran" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "peran" "Peran" NOT NULL,
    "prodi_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penugasan_peran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kebijakan_beban_belajar" (
    "id" TEXT NOT NULL,
    "institusi_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "status" "StatusKebijakan" NOT NULL DEFAULT 'DRAF',
    "berlaku_dari" TIMESTAMP(3) NOT NULL,
    "berlaku_sampai" TIMESTAMP(3),
    "minggu_per_semester" INTEGER NOT NULL DEFAULT 16,
    "pertemuan_efektif_teori" INTEGER NOT NULL DEFAULT 14,
    "pertemuan_efektif_praktik" INTEGER NOT NULL DEFAULT 14,
    "hitung_minggu_ujian" BOOLEAN NOT NULL DEFAULT true,
    "menit_tm_per_ujian" INTEGER NOT NULL DEFAULT 120,
    "jam_per_sks_per_semester" DECIMAL(5,2) NOT NULL DEFAULT 45,
    "toleransi_semester_persen" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "toleransi_pertemuan_persen" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "catatan" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kebijakan_beban_belajar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kebijakan_bentuk" (
    "id" TEXT NOT NULL,
    "kebijakan_id" TEXT NOT NULL,
    "bentuk" "BentukPembelajaran" NOT NULL,
    "menit_tm_per_sks" INTEGER NOT NULL,
    "menit_pt_per_sks" INTEGER NOT NULL,
    "menit_bm_per_sks" INTEGER NOT NULL,
    "tm_terjadwal" BOOLEAN NOT NULL DEFAULT true,
    "butuh_ruang_khusus" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "kebijakan_bentuk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_audit" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitas_id" TEXT,
    "ringkasan" TEXT,
    "data" JSONB,
    "ip" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kurikulum" (
    "id" TEXT NOT NULL,
    "prodi_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tahun" INTEGER NOT NULL,
    "status" "StatusKurikulum" NOT NULL DEFAULT 'DRAF',
    "berlaku_dari" TIMESTAMP(3),
    "catatan" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kurikulum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profil_lulusan" (
    "id" TEXT NOT NULL,
    "kurikulum_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "profil_lulusan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpl" (
    "id" TEXT NOT NULL,
    "kurikulum_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "deskripsi_en" TEXT,
    "ranah" "RanahCpl" NOT NULL DEFAULT 'KETERAMPILAN_KHUSUS',
    "tingkat_kkni" INTEGER,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cpl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpl_profil_lulusan" (
    "cpl_id" TEXT NOT NULL,
    "profil_lulusan_id" TEXT NOT NULL,

    CONSTRAINT "cpl_profil_lulusan_pkey" PRIMARY KEY ("cpl_id","profil_lulusan_id")
);

-- CreateTable
CREATE TABLE "bahan_kajian" (
    "id" TEXT NOT NULL,
    "kurikulum_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "deskripsi" TEXT,

    CONSTRAINT "bahan_kajian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mata_kuliah" (
    "id" TEXT NOT NULL,
    "kurikulum_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nama_en" TEXT,
    "deskripsi" TEXT,
    "semester" INTEGER NOT NULL,
    "status" "StatusMataKuliah" NOT NULL DEFAULT 'WAJIB',
    "sks_teori" INTEGER NOT NULL,
    "sks_praktik" INTEGER NOT NULL DEFAULT 0,
    "bentuk_teori" "BentukPembelajaran" NOT NULL DEFAULT 'KULIAH',
    "bentuk_praktik" "BentukPembelajaran" NOT NULL DEFAULT 'PRAKTIKUM',
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mata_kuliah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mk_prasyarat" (
    "id" TEXT NOT NULL,
    "mata_kuliah_id" TEXT NOT NULL,
    "prasyarat_mk_id" TEXT NOT NULL,
    "jenis" "JenisPrasyarat" NOT NULL DEFAULT 'PRASYARAT',

    CONSTRAINT "mk_prasyarat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriks_cpl_mk" (
    "cpl_id" TEXT NOT NULL,
    "mata_kuliah_id" TEXT NOT NULL,

    CONSTRAINT "matriks_cpl_mk_pkey" PRIMARY KEY ("cpl_id","mata_kuliah_id")
);

-- CreateTable
CREATE TABLE "cpmk" (
    "id" TEXT NOT NULL,
    "mata_kuliah_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "rumusan" TEXT NOT NULL,
    "rumusan_en" TEXT,
    "level_bloom" "LevelBloom",
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cpmk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peta_cpmk_cpl" (
    "cpmk_id" TEXT NOT NULL,
    "cpl_id" TEXT NOT NULL,

    CONSTRAINT "peta_cpmk_cpl_pkey" PRIMARY KEY ("cpmk_id","cpl_id")
);

-- CreateTable
CREATE TABLE "sub_cpmk" (
    "id" TEXT NOT NULL,
    "cpmk_id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "rumusan" TEXT NOT NULL,
    "rumusan_en" TEXT,
    "level_bloom" "LevelBloom",
    "kko" TEXT,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "minggu_disarankan" INTEGER[],

    CONSTRAINT "sub_cpmk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpkps" (
    "id" TEXT NOT NULL,
    "mata_kuliah_id" TEXT NOT NULL,
    "tahun_akademik_id" TEXT NOT NULL,
    "status" "StatusRpkps" NOT NULL DEFAULT 'DRAF',
    "versi" INTEGER NOT NULL DEFAULT 1,
    "deskripsi" TEXT,
    "kalimat_pembuka_cpmk" TEXT,
    "ambang_kelulusan_mhs" DECIMAL(5,2) NOT NULL DEFAULT 55,
    "ambang_ketercapaian_mk" DECIMAL(5,2) NOT NULL DEFAULT 85,
    "minimal_kehadiran_persen" INTEGER NOT NULL DEFAULT 80,
    "catatan_evaluasi" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rpkps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpkps_pengampu" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "peran" "PeranPengampu" NOT NULL DEFAULT 'ANGGOTA',
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rpkps_pengampu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pustaka" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "jenis" "JenisPustaka" NOT NULL DEFAULT 'UTAMA',
    "nomor" INTEGER NOT NULL,
    "teks" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "pustaka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pertemuan" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "minggu" INTEGER NOT NULL,
    "jenis" "JenisPertemuan" NOT NULL DEFAULT 'EFEKTIF',
    "topik" TEXT,
    "subtopik" TEXT[],
    "metode_narasi" TEXT,
    "aktivitas_dosen" TEXT,
    "aktivitas_mahasiswa" TEXT,
    "tugas_terstruktur" TEXT,
    "penilaian_jenis" TEXT,
    "penilaian_sistem" TEXT,
    "bobot" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "komponen_nilai_id" TEXT,

    CONSTRAINT "pertemuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pertemuan_sub_cpmk" (
    "pertemuan_id" TEXT NOT NULL,
    "sub_cpmk_id" TEXT NOT NULL,

    CONSTRAINT "pertemuan_sub_cpmk_pkey" PRIMARY KEY ("pertemuan_id","sub_cpmk_id")
);

-- CreateTable
CREATE TABLE "aktivitas_belajar" (
    "id" TEXT NOT NULL,
    "pertemuan_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kategori" "KategoriWaktu" NOT NULL,
    "mode" "ModePembelajaran" NOT NULL DEFAULT 'LURING',
    "metode" TEXT,
    "menit" INTEGER NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "aktivitas_belajar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indikator" (
    "id" TEXT NOT NULL,
    "pertemuan_id" TEXT NOT NULL,
    "teks" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "indikator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pertemuan_pustaka" (
    "pertemuan_id" TEXT NOT NULL,
    "pustaka_id" TEXT NOT NULL,
    "catatan" TEXT,

    CONSTRAINT "pertemuan_pustaka_pkey" PRIMARY KEY ("pertemuan_id","pustaka_id")
);

-- CreateTable
CREATE TABLE "komponen_nilai" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "bobot" DECIMAL(5,2) NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "komponen_nilai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpkps_riwayat" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "versi" INTEGER NOT NULL,
    "status" "StatusRpkps" NOT NULL,
    "deskripsi" TEXT NOT NULL,
    "oleh_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rpkps_riwayat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fakultas_kode_key" ON "fakultas"("kode");

-- CreateIndex
CREATE INDEX "fakultas_institusi_id_idx" ON "fakultas"("institusi_id");

-- CreateIndex
CREATE UNIQUE INDEX "prodi_kode_key" ON "prodi"("kode");

-- CreateIndex
CREATE INDEX "prodi_fakultas_id_idx" ON "prodi"("fakultas_id");

-- CreateIndex
CREATE UNIQUE INDEX "tahun_akademik_kode_key" ON "tahun_akademik"("kode");

-- CreateIndex
CREATE INDEX "tahun_akademik_aktif_idx" ON "tahun_akademik"("aktif");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_firebase_uid_key" ON "pengguna"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_email_key" ON "pengguna"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_nidn_key" ON "pengguna"("nidn");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_nip_key" ON "pengguna"("nip");

-- CreateIndex
CREATE UNIQUE INDEX "pengguna_nik_key" ON "pengguna"("nik");

-- CreateIndex
CREATE INDEX "pengguna_status_idx" ON "pengguna"("status");

-- CreateIndex
CREATE INDEX "penugasan_peran_pengguna_id_idx" ON "penugasan_peran"("pengguna_id");

-- CreateIndex
CREATE INDEX "penugasan_peran_prodi_id_idx" ON "penugasan_peran"("prodi_id");

-- CreateIndex
CREATE UNIQUE INDEX "penugasan_peran_pengguna_id_peran_prodi_id_key" ON "penugasan_peran"("pengguna_id", "peran", "prodi_id");

-- CreateIndex
CREATE INDEX "kebijakan_beban_belajar_institusi_id_status_idx" ON "kebijakan_beban_belajar"("institusi_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kebijakan_bentuk_kebijakan_id_bentuk_key" ON "kebijakan_bentuk"("kebijakan_id", "bentuk");

-- CreateIndex
CREATE INDEX "log_audit_entitas_entitas_id_idx" ON "log_audit"("entitas", "entitas_id");

-- CreateIndex
CREATE INDEX "log_audit_pengguna_id_idx" ON "log_audit"("pengguna_id");

-- CreateIndex
CREATE INDEX "log_audit_dibuat_pada_idx" ON "log_audit"("dibuat_pada");

-- CreateIndex
CREATE INDEX "kurikulum_prodi_id_status_idx" ON "kurikulum"("prodi_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "kurikulum_prodi_id_tahun_key" ON "kurikulum"("prodi_id", "tahun");

-- CreateIndex
CREATE UNIQUE INDEX "profil_lulusan_kurikulum_id_kode_key" ON "profil_lulusan"("kurikulum_id", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "cpl_kurikulum_id_kode_key" ON "cpl"("kurikulum_id", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "bahan_kajian_kurikulum_id_kode_key" ON "bahan_kajian"("kurikulum_id", "kode");

-- CreateIndex
CREATE INDEX "mata_kuliah_kurikulum_id_semester_idx" ON "mata_kuliah"("kurikulum_id", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "mata_kuliah_kurikulum_id_kode_key" ON "mata_kuliah"("kurikulum_id", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "mk_prasyarat_mata_kuliah_id_prasyarat_mk_id_key" ON "mk_prasyarat"("mata_kuliah_id", "prasyarat_mk_id");

-- CreateIndex
CREATE UNIQUE INDEX "cpmk_mata_kuliah_id_kode_key" ON "cpmk"("mata_kuliah_id", "kode");

-- CreateIndex
CREATE UNIQUE INDEX "sub_cpmk_cpmk_id_kode_key" ON "sub_cpmk"("cpmk_id", "kode");

-- CreateIndex
CREATE INDEX "rpkps_status_idx" ON "rpkps"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rpkps_mata_kuliah_id_tahun_akademik_id_key" ON "rpkps"("mata_kuliah_id", "tahun_akademik_id");

-- CreateIndex
CREATE UNIQUE INDEX "rpkps_pengampu_rpkps_id_pengguna_id_key" ON "rpkps_pengampu"("rpkps_id", "pengguna_id");

-- CreateIndex
CREATE UNIQUE INDEX "pustaka_rpkps_id_jenis_nomor_key" ON "pustaka"("rpkps_id", "jenis", "nomor");

-- CreateIndex
CREATE INDEX "pertemuan_rpkps_id_idx" ON "pertemuan"("rpkps_id");

-- CreateIndex
CREATE UNIQUE INDEX "pertemuan_rpkps_id_minggu_key" ON "pertemuan"("rpkps_id", "minggu");

-- CreateIndex
CREATE INDEX "aktivitas_belajar_pertemuan_id_idx" ON "aktivitas_belajar"("pertemuan_id");

-- CreateIndex
CREATE INDEX "indikator_pertemuan_id_idx" ON "indikator"("pertemuan_id");

-- CreateIndex
CREATE UNIQUE INDEX "komponen_nilai_rpkps_id_nama_key" ON "komponen_nilai"("rpkps_id", "nama");

-- CreateIndex
CREATE INDEX "rpkps_riwayat_rpkps_id_idx" ON "rpkps_riwayat"("rpkps_id");

-- AddForeignKey
ALTER TABLE "fakultas" ADD CONSTRAINT "fakultas_institusi_id_fkey" FOREIGN KEY ("institusi_id") REFERENCES "institusi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prodi" ADD CONSTRAINT "prodi_fakultas_id_fkey" FOREIGN KEY ("fakultas_id") REFERENCES "fakultas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_peran" ADD CONSTRAINT "penugasan_peran_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penugasan_peran" ADD CONSTRAINT "penugasan_peran_prodi_id_fkey" FOREIGN KEY ("prodi_id") REFERENCES "prodi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kebijakan_beban_belajar" ADD CONSTRAINT "kebijakan_beban_belajar_institusi_id_fkey" FOREIGN KEY ("institusi_id") REFERENCES "institusi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kebijakan_bentuk" ADD CONSTRAINT "kebijakan_bentuk_kebijakan_id_fkey" FOREIGN KEY ("kebijakan_id") REFERENCES "kebijakan_beban_belajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_audit" ADD CONSTRAINT "log_audit_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kurikulum" ADD CONSTRAINT "kurikulum_prodi_id_fkey" FOREIGN KEY ("prodi_id") REFERENCES "prodi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profil_lulusan" ADD CONSTRAINT "profil_lulusan_kurikulum_id_fkey" FOREIGN KEY ("kurikulum_id") REFERENCES "kurikulum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpl" ADD CONSTRAINT "cpl_kurikulum_id_fkey" FOREIGN KEY ("kurikulum_id") REFERENCES "kurikulum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpl_profil_lulusan" ADD CONSTRAINT "cpl_profil_lulusan_cpl_id_fkey" FOREIGN KEY ("cpl_id") REFERENCES "cpl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpl_profil_lulusan" ADD CONSTRAINT "cpl_profil_lulusan_profil_lulusan_id_fkey" FOREIGN KEY ("profil_lulusan_id") REFERENCES "profil_lulusan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bahan_kajian" ADD CONSTRAINT "bahan_kajian_kurikulum_id_fkey" FOREIGN KEY ("kurikulum_id") REFERENCES "kurikulum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mata_kuliah" ADD CONSTRAINT "mata_kuliah_kurikulum_id_fkey" FOREIGN KEY ("kurikulum_id") REFERENCES "kurikulum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mk_prasyarat" ADD CONSTRAINT "mk_prasyarat_mata_kuliah_id_fkey" FOREIGN KEY ("mata_kuliah_id") REFERENCES "mata_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mk_prasyarat" ADD CONSTRAINT "mk_prasyarat_prasyarat_mk_id_fkey" FOREIGN KEY ("prasyarat_mk_id") REFERENCES "mata_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriks_cpl_mk" ADD CONSTRAINT "matriks_cpl_mk_cpl_id_fkey" FOREIGN KEY ("cpl_id") REFERENCES "cpl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriks_cpl_mk" ADD CONSTRAINT "matriks_cpl_mk_mata_kuliah_id_fkey" FOREIGN KEY ("mata_kuliah_id") REFERENCES "mata_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpmk" ADD CONSTRAINT "cpmk_mata_kuliah_id_fkey" FOREIGN KEY ("mata_kuliah_id") REFERENCES "mata_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peta_cpmk_cpl" ADD CONSTRAINT "peta_cpmk_cpl_cpmk_id_fkey" FOREIGN KEY ("cpmk_id") REFERENCES "cpmk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peta_cpmk_cpl" ADD CONSTRAINT "peta_cpmk_cpl_cpl_id_fkey" FOREIGN KEY ("cpl_id") REFERENCES "cpl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_cpmk" ADD CONSTRAINT "sub_cpmk_cpmk_id_fkey" FOREIGN KEY ("cpmk_id") REFERENCES "cpmk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpkps" ADD CONSTRAINT "rpkps_mata_kuliah_id_fkey" FOREIGN KEY ("mata_kuliah_id") REFERENCES "mata_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpkps" ADD CONSTRAINT "rpkps_tahun_akademik_id_fkey" FOREIGN KEY ("tahun_akademik_id") REFERENCES "tahun_akademik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpkps_pengampu" ADD CONSTRAINT "rpkps_pengampu_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpkps_pengampu" ADD CONSTRAINT "rpkps_pengampu_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pustaka" ADD CONSTRAINT "pustaka_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan" ADD CONSTRAINT "pertemuan_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan" ADD CONSTRAINT "pertemuan_komponen_nilai_id_fkey" FOREIGN KEY ("komponen_nilai_id") REFERENCES "komponen_nilai"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan_sub_cpmk" ADD CONSTRAINT "pertemuan_sub_cpmk_pertemuan_id_fkey" FOREIGN KEY ("pertemuan_id") REFERENCES "pertemuan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan_sub_cpmk" ADD CONSTRAINT "pertemuan_sub_cpmk_sub_cpmk_id_fkey" FOREIGN KEY ("sub_cpmk_id") REFERENCES "sub_cpmk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aktivitas_belajar" ADD CONSTRAINT "aktivitas_belajar_pertemuan_id_fkey" FOREIGN KEY ("pertemuan_id") REFERENCES "pertemuan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indikator" ADD CONSTRAINT "indikator_pertemuan_id_fkey" FOREIGN KEY ("pertemuan_id") REFERENCES "pertemuan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan_pustaka" ADD CONSTRAINT "pertemuan_pustaka_pertemuan_id_fkey" FOREIGN KEY ("pertemuan_id") REFERENCES "pertemuan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan_pustaka" ADD CONSTRAINT "pertemuan_pustaka_pustaka_id_fkey" FOREIGN KEY ("pustaka_id") REFERENCES "pustaka"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "komponen_nilai" ADD CONSTRAINT "komponen_nilai_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpkps_riwayat" ADD CONSTRAINT "rpkps_riwayat_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

