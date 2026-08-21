-- AlterTable
ALTER TABLE "pertemuan" ADD COLUMN "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM';

-- AlterTable
ALTER TABLE "tugas" ADD COLUMN "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM';

-- AlterTable
ALTER TABLE "kisi_kisi" ADD COLUMN "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM';
