-- Perangkap keamanan (docs/22): jejak penyentuh alamat umpan.
CREATE TYPE "StatusPerangkap" AS ENUM ('BARU', 'DITINJAU', 'DILAPORKAN', 'DIABAIKAN');

CREATE TABLE "perangkap_temuan" (
  "id"              TEXT NOT NULL,
  "ip"              TEXT NOT NULL,
  "rantai_ip"       TEXT,
  "jenis"           TEXT NOT NULL,
  "jalur"           TEXT NOT NULL,
  "metode"          TEXT NOT NULL,
  "kueri"           TEXT,
  "user_agent"      TEXT,
  "bahasa_peramban" TEXT,
  "rujukan"         TEXT,
  "sidik_perangkat" TEXT,
  "header"          JSONB,
  "kiriman"         JSONB,
  "negara"          TEXT,
  "kode_negara"     TEXT,
  "wilayah"         TEXT,
  "kota"            TEXT,
  "lintang"         DOUBLE PRECISION,
  "bujur"           DOUBLE PRECISION,
  "zona_waktu"      TEXT,
  "penyedia"        TEXT,
  "asn"             TEXT,
  "sumber_lokasi"   TEXT,
  "jumlah"          INTEGER NOT NULL DEFAULT 1,
  "pertama_pada"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "terakhir_pada"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"          "StatusPerangkap" NOT NULL DEFAULT 'BARU',
  "catatan"         TEXT,
  "ditinjau_oleh"   TEXT,
  "ditinjau_pada"   TIMESTAMP(3),
  CONSTRAINT "perangkap_temuan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "perangkap_temuan_ip_idx" ON "perangkap_temuan"("ip");
CREATE INDEX "perangkap_temuan_terakhir_pada_idx" ON "perangkap_temuan"("terakhir_pada");
CREATE INDEX "perangkap_temuan_status_terakhir_pada_idx" ON "perangkap_temuan"("status", "terakhir_pada");
CREATE INDEX "perangkap_temuan_sidik_perangkat_idx" ON "perangkap_temuan"("sidik_perangkat");
