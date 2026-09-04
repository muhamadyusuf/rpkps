-- Bahan Ajar: buku ajar per bab, slide, gambar, dan usulan penyuntingan
-- (docs/16 sampai docs/19).
--
-- Tujuh tabel ini sebelumnya hanya pernah masuk lewat `prisma db push`,
-- sehingga basis data yang dibangun dengan memutar ulang migrasi tidak
-- memilikinya sama sekali — dan tidak ada satu galat pun yang menandainya
-- sampai halaman Bahan Ajar dibuka.
--
-- Seluruh pernyataan ditulis IDEMPOTEN, dengan alasan yang sama seperti
-- `20260904000000_notifikasi_minta_paraf`: pemasangan yang objeknya sudah
-- terlanjur dibuat `db push` harus dapat menyusul riwayatnya tanpa gagal,
-- sedangkan basis data kosong tetap mendapat seluruh objeknya.
--
-- Aditif seluruhnya: tidak ada kolom RPKPS yang tersentuh. `gambar_bab.png`
-- bertipe BYTEA karena PNG adalah TURUNAN — sumber kebenaran diagram tetap
-- Mermaid/SVG pada kolom teks (docs/17).

DO $$ BEGIN
CREATE TYPE "SumberGambar" AS ENUM ('DIAGRAM_AI', 'UNGGAHAN', 'AI_RASTER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "BentukGambar" AS ENUM ('MERMAID', 'SVG', 'RASTER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "JenisUsulanSunting" AS ENUM ('BAHASA', 'ISTILAH', 'PENGULANGAN', 'TUJUAN', 'STRUKTUR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE TYPE "StatusUsulanSunting" AS ENUM ('TERBUKA', 'DITERIMA', 'DITOLAK', 'KEDALUWARSA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "buku_ajar" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "bahasa" "BahasaAntarmuka" NOT NULL DEFAULT 'id',
    "judul" TEXT NOT NULL,
    "subjudul" TEXT,
    "penulis" TEXT[],
    "afiliasi" TEXT,
    "penerbit" TEXT,
    "kota_terbit" TEXT,
    "tahun_terbit" INTEGER,
    "edisi" TEXT,
    "isbn" TEXT,
    "hak_cipta" TEXT,
    "prakata" TEXT,
    "pendahuluan" TEXT,
    "sinopsis" TEXT,
    "kata_kunci" TEXT[],
    "glosarium" JSONB,
    "biografi" TEXT,
    "sumber" "SumberIsi" NOT NULL DEFAULT 'AI',
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buku_ajar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bab_buku_ajar" (
    "id" TEXT NOT NULL,
    "buku_ajar_id" TEXT NOT NULL,
    "pertemuan_id" TEXT,
    "nomor" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "tujuan" TEXT[],
    "alur" TEXT,
    "uraian" TEXT,
    "studi_kasus" TEXT,
    "ringkasan" TEXT,
    "sidik_sumber" TEXT,
    "sumber" "SumberIsi" NOT NULL DEFAULT 'AI',
    "disunting_pada" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bab_buku_ajar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "latihan_bab" (
    "id" TEXT NOT NULL,
    "bab_id" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL,
    "soal" TEXT NOT NULL,
    "kunci" TEXT,
    "bloom" "LevelBloom",

    CONSTRAINT "latihan_bab_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "slide_bab" (
    "id" TEXT NOT NULL,
    "bab_id" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "butir" TEXT[],
    "catatan" TEXT,

    CONSTRAINT "slide_bab_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bab_pustaka" (
    "bab_id" TEXT NOT NULL,
    "pustaka_id" TEXT NOT NULL,

    CONSTRAINT "bab_pustaka_pkey" PRIMARY KEY ("bab_id","pustaka_id")
);

CREATE TABLE IF NOT EXISTS "gambar_bab" (
    "id" TEXT NOT NULL,
    "bab_id" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL,
    "judul" TEXT NOT NULL,
    "alt_teks" TEXT,
    "sumber" "SumberGambar" NOT NULL,
    "bentuk" "BentukGambar" NOT NULL,
    "kode" TEXT,
    "png" BYTEA NOT NULL,
    "lebar_px" INTEGER NOT NULL,
    "tinggi_px" INTEGER NOT NULL,
    "letak" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gambar_bab_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "usulan_sunting" (
    "id" TEXT NOT NULL,
    "buku_ajar_id" TEXT NOT NULL,
    "bab_id" TEXT,
    "jenis" "JenisUsulanSunting" NOT NULL,
    "kutipan" TEXT,
    "usul" TEXT NOT NULL,
    "alasan" TEXT NOT NULL,
    "status" "StatusUsulanSunting" NOT NULL DEFAULT 'TERBUKA',
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diputus_pada" TIMESTAMP(3),

    CONSTRAINT "usulan_sunting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "buku_ajar_rpkps_id_idx" ON "buku_ajar"("rpkps_id");

CREATE UNIQUE INDEX IF NOT EXISTS "buku_ajar_rpkps_id_bahasa_key" ON "buku_ajar"("rpkps_id", "bahasa");

CREATE INDEX IF NOT EXISTS "bab_buku_ajar_buku_ajar_id_idx" ON "bab_buku_ajar"("buku_ajar_id");

CREATE INDEX IF NOT EXISTS "bab_buku_ajar_pertemuan_id_idx" ON "bab_buku_ajar"("pertemuan_id");

CREATE UNIQUE INDEX IF NOT EXISTS "bab_buku_ajar_buku_ajar_id_nomor_key" ON "bab_buku_ajar"("buku_ajar_id", "nomor");

CREATE UNIQUE INDEX IF NOT EXISTS "latihan_bab_bab_id_nomor_key" ON "latihan_bab"("bab_id", "nomor");

CREATE UNIQUE INDEX IF NOT EXISTS "slide_bab_bab_id_nomor_key" ON "slide_bab"("bab_id", "nomor");

CREATE INDEX IF NOT EXISTS "gambar_bab_bab_id_idx" ON "gambar_bab"("bab_id");

CREATE UNIQUE INDEX IF NOT EXISTS "gambar_bab_bab_id_nomor_key" ON "gambar_bab"("bab_id", "nomor");

CREATE INDEX IF NOT EXISTS "usulan_sunting_buku_ajar_id_status_idx" ON "usulan_sunting"("buku_ajar_id", "status");

CREATE INDEX IF NOT EXISTS "usulan_sunting_bab_id_idx" ON "usulan_sunting"("bab_id");

DO $$ BEGIN
ALTER TABLE "buku_ajar" ADD CONSTRAINT "buku_ajar_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "bab_buku_ajar" ADD CONSTRAINT "bab_buku_ajar_buku_ajar_id_fkey" FOREIGN KEY ("buku_ajar_id") REFERENCES "buku_ajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "bab_buku_ajar" ADD CONSTRAINT "bab_buku_ajar_pertemuan_id_fkey" FOREIGN KEY ("pertemuan_id") REFERENCES "pertemuan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "latihan_bab" ADD CONSTRAINT "latihan_bab_bab_id_fkey" FOREIGN KEY ("bab_id") REFERENCES "bab_buku_ajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "slide_bab" ADD CONSTRAINT "slide_bab_bab_id_fkey" FOREIGN KEY ("bab_id") REFERENCES "bab_buku_ajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "bab_pustaka" ADD CONSTRAINT "bab_pustaka_bab_id_fkey" FOREIGN KEY ("bab_id") REFERENCES "bab_buku_ajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "bab_pustaka" ADD CONSTRAINT "bab_pustaka_pustaka_id_fkey" FOREIGN KEY ("pustaka_id") REFERENCES "pustaka"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "gambar_bab" ADD CONSTRAINT "gambar_bab_bab_id_fkey" FOREIGN KEY ("bab_id") REFERENCES "bab_buku_ajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "usulan_sunting" ADD CONSTRAINT "usulan_sunting_buku_ajar_id_fkey" FOREIGN KEY ("buku_ajar_id") REFERENCES "buku_ajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
ALTER TABLE "usulan_sunting" ADD CONSTRAINT "usulan_sunting_bab_id_fkey" FOREIGN KEY ("bab_id") REFERENCES "bab_buku_ajar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
