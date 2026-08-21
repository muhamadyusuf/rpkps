import "dotenv/config";
import pg from "pg";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const t = await c.query(
  "select count(*)::int n from information_schema.tables where table_schema='public'",
);
const m = await c.query('select migration_name from "_prisma_migrations" order by started_at');
const idx = await c.query(
  "select 1 from pg_indexes where tablename='penugasan_peran' and indexname='penugasan_peran_institusi_unik'",
);
const seed = await c.query("select nama from institusi limit 1");
console.log("DATABASE");
console.log("  tabel                :", t.rows[0].n);
console.log("  migrasi tercatat     :", m.rows.map((r) => r.migration_name).join(", "));
console.log("  indeks partial peran :", idx.rowCount ? "ada" : "TIDAK ADA");
console.log("  data awal            :", seed.rows[0]?.nama ?? "(kosong)");
await c.end();

console.log("\nFIREBASE ADMIN (kredensial server)");
try {
  const app = initializeApp(
    {
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    },
    "periksa",
  );
  const daftar = await getAuth(app).listUsers(1);
  console.log("  inisialisasi         : berhasil");
  console.log("  panggilan Admin API  : berhasil");
  console.log("  jumlah pengguna      :", daftar.users.length);
} catch (e) {
  console.log("  GAGAL:", e instanceof Error ? e.message.slice(0, 160) : e);
}
