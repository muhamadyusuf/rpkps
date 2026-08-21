import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

// PGlite melayani satu koneksi pada satu waktu, jadi pool dibatasi ke 1.
const adapter = new PrismaPg({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:5433/postgres",
  max: 1,
  idleTimeoutMillis: 0,
});
export const prisma = new PrismaClient({ adapter });
