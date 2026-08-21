import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { BENTUK_BAWAAN, KEBIJAKAN_BAWAAN } from "../src/domain/beban-belajar/kebijakan-bawaan";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Data awal: satu institusi (ITTS), satu fakultas, satu prodi, tahun akademik
 * berjalan, dan satu kebijakan beban belajar berstatus DRAF.
 *
 * Kebijakan sengaja DRAF, bukan BERLAKU. Angkanya masih bawaan SN-Dikti dan
 * harus dikonfirmasi Penjaminan Mutu ITTS lebih dulu — lihat docs/03 §6.
 */
async function main() {
  const institusi = await prisma.institusi.upsert({
    where: { id: "itts" },
    update: {},
    create: {
      id: "itts",
      nama: "Institut Teknologi Tangerang Selatan",
      namaSingkat: "ITTS",
      situs: "https://itts.ac.id",
    },
  });
  console.log(`✓ Institusi: ${institusi.namaSingkat}`);

  const fakultas = await prisma.fakultas.upsert({
    where: { kode: "FTI" },
    update: {},
    create: {
      kode: "FTI",
      nama: "Fakultas Teknologi Industri",
      institusiId: institusi.id,
    },
  });
  console.log(`✓ Fakultas: ${fakultas.kode}`);

  const prodi = await prisma.prodi.upsert({
    where: { kode: "TI" },
    update: {},
    create: {
      kode: "TI",
      nama: "Teknologi Informasi",
      jenjang: "S1",
      gelar: "S.Kom.",
      fakultasId: fakultas.id,
    },
  });
  console.log(`✓ Prodi: ${prodi.nama}`);

  for (const [kode, tahunMulai, semester, aktif] of [
    ["2025/2026-GANJIL", 2025, "GANJIL", false],
    ["2025/2026-GENAP", 2025, "GENAP", true],
  ] as const) {
    await prisma.tahunAkademik.upsert({
      where: { kode },
      update: {},
      create: {
        kode,
        tahunMulai,
        tahunSelesai: tahunMulai + 1,
        semester,
        aktif,
      },
    });
  }
  console.log("✓ Tahun akademik: 2025/2026 Ganjil & Genap (Genap aktif)");

  const adaKebijakan = await prisma.kebijakanBebanBelajar.findFirst({
    where: { institusiId: institusi.id },
  });

  if (adaKebijakan) {
    console.log("• Kebijakan beban belajar sudah ada, dilewati");
  } else {
    const kebijakan = await prisma.kebijakanBebanBelajar.create({
      data: {
        institusiId: institusi.id,
        nama: "Kebijakan Beban Belajar (bawaan SN-Dikti)",
        status: "DRAF",
        berlakuDari: new Date("2025-09-01"),
        mingguPerSemester: KEBIJAKAN_BAWAAN.mingguPerSemester,
        pertemuanEfektifTeori: KEBIJAKAN_BAWAAN.pertemuanEfektifTeori,
        pertemuanEfektifPraktik: KEBIJAKAN_BAWAAN.pertemuanEfektifPraktik,
        hitungMingguUjian: KEBIJAKAN_BAWAAN.hitungMingguUjian,
        menitTmPerUjian: KEBIJAKAN_BAWAAN.menitTmPerUjian,
        jamPerSksPerSemester: KEBIJAKAN_BAWAAN.jamPerSksPerSemester,
        toleransiSemesterPersen: KEBIJAKAN_BAWAAN.toleransiSemesterPersen,
        toleransiPertemuanPersen: KEBIJAKAN_BAWAAN.toleransiPertemuanPersen,
        catatan:
          "Angka bawaan SN-Dikti. Perlu dikonfirmasi Penjaminan Mutu ITTS " +
          "(6 pertanyaan di docs/03-kebijakan-beban-belajar.md §6) sebelum diberlakukan.",
        bentuk: {
          create: BENTUK_BAWAAN.map((b) => ({
            bentuk: b.bentuk,
            menitTmPerSks: b.tm,
            menitPtPerSks: b.pt,
            menitBmPerSks: b.bm,
            tmTerjadwal: b.tmTerjadwal,
            butuhRuangKhusus: b.butuhRuangKhusus,
          })),
        },
      },
    });
    console.log(`✓ Kebijakan beban belajar (DRAF) + ${BENTUK_BAWAAN.length} bentuk pembelajaran`);
    console.log(`  id: ${kebijakan.id}`);
  }

  console.log("\nSelesai. Pengguna pertama dibuat otomatis saat login Google");
  console.log("dan diberi peran ADMIN bila emailnya ada di ADMIN_BOOTSTRAP_EMAILS.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
