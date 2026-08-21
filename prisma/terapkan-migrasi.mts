import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import "dotenv/config";
import pg from "pg";

/**
 * Menerapkan migrasi Prisma lewat node-postgres.
 *
 * Dibutuhkan pada jaringan yang tidak dapat menjangkau IPv6: mesin migrasi
 * Prisma (Rust) memilih alamat AAAA lalu menggantung, sedangkan node-postgres
 * jatuh ke IPv4 dengan benar. Runtime aplikasi memang sudah memakai
 * node-postgres lewat @prisma/adapter-pg, jadi hanya CLI migrasi yang terdampak.
 *
 * Menulis riwayat ke tabel _prisma_migrations dengan bentuk yang sama seperti
 * `prisma migrate deploy`, sehingga `prisma migrate status` tetap konsisten
 * bila kelak dijalankan dari jaringan yang mendukung IPv6.
 */

const DIR = join(process.cwd(), "prisma", "migrations");

const TABEL_RIWAYAT = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  id                      VARCHAR(36) PRIMARY KEY NOT NULL,
  checksum                VARCHAR(64) NOT NULL,
  finished_at             TIMESTAMPTZ,
  migration_name          VARCHAR(255) NOT NULL,
  logs                    TEXT,
  rolled_back_at          TIMESTAMPTZ,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count     INTEGER NOT NULL DEFAULT 0
);`;

function daftarMigrasi(): { nama: string; sql: string; checksum: string }[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .flatMap((nama) => {
      const berkas = join(DIR, nama, "migration.sql");
      if (!existsSync(berkas)) return [];
      const sql = readFileSync(berkas, "utf8");
      return [{ nama, sql, checksum: createHash("sha256").update(sql).digest("hex") }];
    });
}

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL atau DIRECT_URL belum diisi.");

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(TABEL_RIWAYAT);

    const { rows } = await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
    );
    const sudah = new Set(rows.map((r) => r.migration_name));

    const semua = daftarMigrasi();
    const tertunda = semua.filter((m) => !sudah.has(m.nama));

    if (tertunda.length === 0) {
      console.log(`Tidak ada migrasi tertunda (${semua.length} sudah diterapkan).`);
      return;
    }

    for (const m of tertunda) {
      process.stdout.write(`  menerapkan ${m.nama} … `);
      // Satu migrasi = satu transaksi: gagal di tengah tidak meninggalkan
      // skema separuh jadi.
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), now(), 1)`,
          [crypto.randomUUID(), m.checksum, m.nama],
        );
        await client.query("COMMIT");
        console.log("selesai");
      } catch (galat) {
        await client.query("ROLLBACK");
        console.log("GAGAL");
        throw galat;
      }
    }

    console.log(`\n${tertunda.length} migrasi diterapkan.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("\nGagal menerapkan migrasi:", e instanceof Error ? e.message : e);
  process.exit(1);
});
