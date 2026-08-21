-- AlterTable
ALTER TABLE "pustaka" ADD COLUMN "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM';

-- AlterTable
ALTER TABLE "komponen_nilai" ADD COLUMN "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM';
