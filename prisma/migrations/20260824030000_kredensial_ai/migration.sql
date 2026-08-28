-- CreateEnum
CREATE TYPE "PenyediaAi" AS ENUM ('ANTHROPIC', 'MISTRAL', 'GEMINI');

-- CreateTable
CREATE TABLE "kredensial_ai" (
    "id" TEXT NOT NULL,
    "pengguna_id" TEXT NOT NULL,
    "penyedia" "PenyediaAi" NOT NULL,
    "label" TEXT NOT NULL,
    "kunci_terenkripsi" BYTEA NOT NULL,
    "ekor" TEXT NOT NULL,
    "model" TEXT,
    "bawaan" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "terakhir_dipakai" TIMESTAMP(3),
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kredensial_ai_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kredensial_ai_pengguna_id_idx" ON "kredensial_ai"("pengguna_id");

-- CreateIndex
CREATE UNIQUE INDEX "kredensial_ai_pengguna_id_penyedia_label_key" ON "kredensial_ai"("pengguna_id", "penyedia", "label");

-- AddForeignKey
ALTER TABLE "kredensial_ai" ADD CONSTRAINT "kredensial_ai_pengguna_id_fkey" FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;
