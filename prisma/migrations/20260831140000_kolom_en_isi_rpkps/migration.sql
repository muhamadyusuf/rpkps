-- Kolom cermin berbahasa Inggris untuk isi RPKPS (docs/11 §5.1).
--
-- Semuanya NULLABLE dan TANPA backfill: terjemahan bersifat opsional, dan
-- tidak ada satu baris pun yang isinya diubah oleh migrasi ini. Dokumen yang
-- sudah terbit tidak tersentuh — sidiknya berdiri di atas `proyeksiIsi`, yang
-- tidak mengenal kolom-kolom ini (docs/11 §6.1).
--
-- `String[]` menjadi TEXT[] berdefault array kosong, mengikuti kolom
-- Indonesianya, supaya pembacaan tidak perlu menangani NULL untuk daftar.

ALTER TABLE "institusi" ADD COLUMN "nama_en" TEXT;
ALTER TABLE "fakultas"  ADD COLUMN "nama_en" TEXT;
ALTER TABLE "prodi"     ADD COLUMN "nama_en" TEXT;

ALTER TABLE "profil_lulusan" ADD COLUMN "deskripsi_en" TEXT;

ALTER TABLE "bahan_kajian" ADD COLUMN "nama_en" TEXT;
ALTER TABLE "bahan_kajian" ADD COLUMN "deskripsi_en" TEXT;

ALTER TABLE "mata_kuliah" ADD COLUMN "deskripsi_en" TEXT;

ALTER TABLE "rpkps" ADD COLUMN "deskripsi_en" TEXT;
ALTER TABLE "rpkps" ADD COLUMN "kalimat_pembuka_cpmk_en" TEXT;
ALTER TABLE "rpkps" ADD COLUMN "catatan_evaluasi_en" TEXT;

ALTER TABLE "pertemuan" ADD COLUMN "topik_en" TEXT;
ALTER TABLE "pertemuan" ADD COLUMN "subtopik_en" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "pertemuan" ADD COLUMN "metode_narasi_en" TEXT;
ALTER TABLE "pertemuan" ADD COLUMN "aktivitas_dosen_en" TEXT;
ALTER TABLE "pertemuan" ADD COLUMN "aktivitas_mahasiswa_en" TEXT;
ALTER TABLE "pertemuan" ADD COLUMN "tugas_terstruktur_en" TEXT;
ALTER TABLE "pertemuan" ADD COLUMN "penilaian_jenis_en" TEXT;
ALTER TABLE "pertemuan" ADD COLUMN "penilaian_sistem_en" TEXT;

-- `aktivitas_belajar.metode` tidak dicerminkan: kolom itu sendiri tidak
-- ditulis maupun dibaca di mana pun, jadi kembarannya tak akan pernah diisi.
ALTER TABLE "aktivitas_belajar" ADD COLUMN "nama_en" TEXT;

ALTER TABLE "indikator" ADD COLUMN "teks_en" TEXT;

ALTER TABLE "pertemuan_pustaka" ADD COLUMN "catatan_en" TEXT;

-- Di luar @@unique([rpkps_id, nama]): mengubah terjemahan tidak boleh
-- melepas tautan asesmen (docs/11 §5.2).
ALTER TABLE "komponen_nilai" ADD COLUMN "nama_en" TEXT;

ALTER TABLE "tugas" ADD COLUMN "nama_en" TEXT;
ALTER TABLE "tugas" ADD COLUMN "deskripsi_en" TEXT;
ALTER TABLE "tugas" ADD COLUMN "uraian_tugas_en" TEXT;
ALTER TABLE "tugas" ADD COLUMN "format_luaran_en" TEXT;
ALTER TABLE "tugas" ADD COLUMN "ketentuan_lain_en" TEXT;

ALTER TABLE "kriteria_tugas" ADD COLUMN "indikator_en" TEXT;
ALTER TABLE "kriteria_tugas" ADD COLUMN "rincian_en" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "linimasa_tugas" ADD COLUMN "tahapan_en" TEXT;
ALTER TABLE "linimasa_tugas" ADD COLUMN "aktivitas_en" TEXT;

ALTER TABLE "kisi_kisi" ADD COLUMN "catatan_en" TEXT;

ALTER TABLE "butir_kisi_kisi" ADD COLUMN "indikator_en" TEXT;
