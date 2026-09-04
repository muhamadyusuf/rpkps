-- Tautan pratinjau bertoken untuk dokumen yang belum disahkan
-- (docs/06 §4.2, tahap B5).
--
-- Pintu kedua tanpa login. Ia membaca data LANGSUNG, bukan salinan beku, dan
-- karena itu ia berdiri di berkas pemuatnya sendiri (`src/lib/berbagi/muat.ts`)
-- yang tidak pernah dipanggil pemuat katalog — begitu pula sebaliknya (§4.3).
CREATE TABLE "tautan_berbagi" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "catatan" TEXT,
    -- NOT NULL: tautan tanpa kedaluwarsa adalah tautan yang bocor selamanya.
    "kedaluwarsa" TIMESTAMP(3) NOT NULL,
    "dicabut_pada" TIMESTAMP(3),
    "jumlah_akses" INTEGER NOT NULL DEFAULT 0,
    "terakhir_akses" TIMESTAMP(3),
    "dibuat_oleh_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tautan_berbagi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tautan_berbagi_token_key" ON "tautan_berbagi"("token");
CREATE INDEX "tautan_berbagi_rpkps_id_idx" ON "tautan_berbagi"("rpkps_id");

ALTER TABLE "tautan_berbagi" ADD CONSTRAINT "tautan_berbagi_rpkps_id_fkey"
    FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SetNull, bukan Cascade: pembuat yang dihapus tidak boleh melenyapkan jejak
-- tautan yang mungkin masih hidup di luar sana.
ALTER TABLE "tautan_berbagi" ADD CONSTRAINT "tautan_berbagi_dibuat_oleh_id_fkey"
    FOREIGN KEY ("dibuat_oleh_id") REFERENCES "pengguna"("id") ON DELETE SET NULL ON UPDATE CASCADE;
