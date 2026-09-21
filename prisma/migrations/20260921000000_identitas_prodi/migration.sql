-- Identitas program studi (docs/21): logo, visi & misi, alamat, telepon,
-- surel, situs. Seluruhnya opsional; tidak ada baris yang perlu diisi ulang.

-- Logo institusi disimpan sebagai bita, bukan alamat. `logo_url` belum pernah
-- diisi maupun dibaca satu baris kode pun, jadi ia dibuang, bukan dimigrasikan.
ALTER TABLE "institusi" DROP COLUMN IF EXISTS "logo_url";
ALTER TABLE "institusi" ADD COLUMN "logo" BYTEA;
ALTER TABLE "institusi" ADD COLUMN "logo_tipe" TEXT;
ALTER TABLE "institusi" ADD COLUMN "logo_lebar" INTEGER;
ALTER TABLE "institusi" ADD COLUMN "logo_tinggi" INTEGER;

ALTER TABLE "prodi" ADD COLUMN "visi" TEXT;
ALTER TABLE "prodi" ADD COLUMN "visi_en" TEXT;
-- Larik tanpa NULL: kosong berarti belum diisi, bukan "tidak diketahui".
ALTER TABLE "prodi" ADD COLUMN "misi" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "prodi" ADD COLUMN "misi_en" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "prodi" ADD COLUMN "alamat" TEXT;
ALTER TABLE "prodi" ADD COLUMN "telepon" TEXT;
ALTER TABLE "prodi" ADD COLUMN "surel" TEXT;
ALTER TABLE "prodi" ADD COLUMN "situs" TEXT;
ALTER TABLE "prodi" ADD COLUMN "logo" BYTEA;
ALTER TABLE "prodi" ADD COLUMN "logo_tipe" TEXT;
ALTER TABLE "prodi" ADD COLUMN "logo_lebar" INTEGER;
ALTER TABLE "prodi" ADD COLUMN "logo_tinggi" INTEGER;

-- Menggantikan konstanta SITUS_PRODI di src/lib/publik/tautan.ts, yang dihapus
-- bersama migrasi ini. Dua daftar yang tidak sinkron lebih buruk dari satu.
UPDATE "prodi" SET "situs" = 'https://ti.itts.ac.id' WHERE "kode" = 'TI' AND "situs" IS NULL;
