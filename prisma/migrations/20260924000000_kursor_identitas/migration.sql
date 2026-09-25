-- Pelaporan aktivitas ke identitas-itts (docs/24): sampai mana rpkps_riwayat
-- dan tanda_tangan_rpkps sudah terbaca.
CREATE TABLE "kursor_identitas" (
    "sumber" TEXT NOT NULL,
    "pada" TIMESTAMP(3) NOT NULL,
    "id_terakhir" TEXT NOT NULL,
    "isi_mundur_selesai" BOOLEAN NOT NULL DEFAULT false,
    "diubah_pada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kursor_identitas_pkey" PRIMARY KEY ("sumber")
);
