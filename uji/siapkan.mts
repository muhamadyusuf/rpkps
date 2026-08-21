import { readFileSync } from "node:fs";
import pg from "pg";

const url = "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
const client = new pg.Client({ connectionString: url });
await client.connect();

const sql = readFileSync("uji/skema.sql", "utf8");
await client.query(sql);
// Indeks partial untuk peran bercakupan institusi (migrasi manual F0)
await client.query(readFileSync(
  "prisma/migrations/20260816000000_penugasan_peran_null_unik/migration.sql", "utf8"));

const { rows } = await client.query(
  "select count(*)::int as n from information_schema.tables where table_schema='public'",
);
console.log("tabel terbentuk:", rows[0].n);
await client.end();
