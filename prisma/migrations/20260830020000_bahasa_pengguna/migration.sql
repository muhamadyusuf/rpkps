-- Preferensi bahasa antarmuka per pengguna (docs/11-dwibahasa.md §2.2).
--
-- Nilai enum sengaja huruf kecil: sama persis dengan ruas alamat (/id, /en)
-- dan cookie `bahasa`, sehingga tidak ada konversi bentuk di antara ketiganya.

-- CreateEnum
CREATE TYPE "BahasaAntarmuka" AS ENUM ('id', 'en');

-- AlterTable
ALTER TABLE "pengguna" ADD COLUMN     "bahasa" "BahasaAntarmuka" NOT NULL DEFAULT 'id';
