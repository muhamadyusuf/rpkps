-- CreateEnum
CREATE TYPE "SumberIsi" AS ENUM ('KURIKULUM', 'AI');

-- AlterTable
ALTER TABLE "cpmk" ADD COLUMN "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM';

-- AlterTable
ALTER TABLE "sub_cpmk" ADD COLUMN "sumber" "SumberIsi" NOT NULL DEFAULT 'KURIKULUM';
