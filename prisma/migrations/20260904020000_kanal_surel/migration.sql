-- Kanal surel untuk notifikasi — docs/10 §2.5 (tahap N5).
--
-- Antriannya MENUMPANG tabel `notifikasi`, bukan tabel tersendiri: yang dikirim
-- adalah notifikasi yang sama, dan kalimatnya dirakit saat dikirim dalam bahasa
-- penerimanya. Dua tabel yang harus tetap sejalan hanya menambah satu tempat
-- lagi untuk menyimpang.
--
-- `CREATE TYPE` aman berada satu berkas dengan pemakaiannya; yang tidak boleh
-- satu transaksi adalah `ALTER TYPE … ADD VALUE` beserta pemakaian nilainya.
CREATE TYPE "StatusSurel" AS ENUM ('MENUNGGU', 'TERKIRIM', 'GAGAL', 'DILEWATI');

-- Bawaannya DILEWATI, bukan MENUNGGU: seluruh baris yang sudah ada ditulis
-- sebelum kanal ini ada, dan menyalakan migrasi ini tidak boleh mengirim surel
-- untuk peristiwa berbulan-bulan lalu.
ALTER TABLE "notifikasi" ADD COLUMN "surel_status" "StatusSurel" NOT NULL DEFAULT 'DILEWATI';
ALTER TABLE "notifikasi" ADD COLUMN "surel_percobaan" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "notifikasi" ADD COLUMN "surel_kirim_setelah" TIMESTAMP(3);
ALTER TABLE "notifikasi" ADD COLUMN "surel_terkirim_pada" TIMESTAMP(3);
ALTER TABLE "notifikasi" ADD COLUMN "surel_galat" TEXT;

CREATE INDEX "notifikasi_surel_status_surel_kirim_setelah_idx"
    ON "notifikasi"("surel_status", "surel_kirim_setelah");

-- Menyala secara bawaan: kanal ini ada justru karena alur kerja aplikasi
-- bersifat tarik, dan yang tidak pernah membuka dasbor adalah yang paling
-- perlu dikabari. Mematikannya tidak mematikan notifikasi dalam aplikasi.
ALTER TABLE "pengguna" ADD COLUMN "surel_notifikasi" BOOLEAN NOT NULL DEFAULT true;
