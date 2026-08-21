import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    // Migrasi memakai koneksi LANGSUNG (bukan pooler) dan tanpa
    // channel_binding, yang tidak didukung mesin migrasi Prisma.
    // Aplikasi tetap memakai DATABASE_URL yang ber-pooler.
    url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
    // Dipakai `prisma migrate diff --from-migrations` untuk memutar ulang
    // migrasi. Isi SHADOW_DATABASE_URL hanya saat membuat migrasi baru;
    // aplikasi tidak pernah menyentuhnya.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
