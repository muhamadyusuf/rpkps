-- Melengkapi @@unique([pengguna_id, peran, prodi_id]).
--
-- Pada Postgres, dua baris dengan prodi_id NULL dianggap TIDAK sama, sehingga
-- constraint unik bawaan tidak mencegah satu pengguna mendapat peran
-- bercakupan institusi (ADMIN, GPM) berkali-kali. Indeks partial di bawah
-- menutup celah itu.
CREATE UNIQUE INDEX IF NOT EXISTS "penugasan_peran_institusi_unik"
  ON "penugasan_peran" ("pengguna_id", "peran")
  WHERE "prodi_id" IS NULL;
