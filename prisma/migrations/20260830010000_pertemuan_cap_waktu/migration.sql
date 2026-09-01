-- AlterTable
-- Baris yang sudah ada diberi cap waktu saat migrasi dijalankan. `diubah_pada`
-- diisi lewat DEFAULT sementara lalu defaultnya dilepas kembali: nilainya
-- selanjutnya selalu ditulis Prisma (`@updatedAt`), bukan oleh database.
ALTER TABLE "pertemuan" ADD COLUMN     "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "diubah_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "pertemuan" ALTER COLUMN "diubah_pada" DROP DEFAULT;
