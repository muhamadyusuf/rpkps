-- CreateTable
CREATE TABLE "rpkps_snapshot" (
    "id" TEXT NOT NULL,
    "rpkps_id" TEXT NOT NULL,
    "versi" INTEGER NOT NULL,
    "isi" JSONB NOT NULL,
    "sidik" TEXT NOT NULL,
    "oleh_id" TEXT,
    "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rpkps_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rpkps_snapshot_rpkps_id_idx" ON "rpkps_snapshot"("rpkps_id");

-- CreateIndex
CREATE UNIQUE INDEX "rpkps_snapshot_rpkps_id_versi_key" ON "rpkps_snapshot"("rpkps_id", "versi");

-- AddForeignKey
ALTER TABLE "rpkps_snapshot" ADD CONSTRAINT "rpkps_snapshot_rpkps_id_fkey" FOREIGN KEY ("rpkps_id") REFERENCES "rpkps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

