/**
 * Penjaga "RPKPS tanpa data pegawai" (docs/26 §6) — memakai KOMPILATOR, bukan pencarian teks.
 *
 * Cara kerja: membuat salinan skema di mana model `Pengguna` TIDAK memiliki kolom data
 * pegawai (gelar_depan, gelar_belakang, nidn, nip, nik, telepon, foto_url), menghasilkan
 * klien Prisma ke folder sementara, lalu menjalankan `tsc` dengan `@/generated/prisma`
 * dialihkan ke klien itu. Setiap baris yang masih membaca/menulis kolom tersebut menjadi
 * galat tipe — persis keadaan setelah kontraksi (M5), tanpa menyentuh skema, klien, maupun
 * basis data yang sebenarnya.
 *
 *   npx tsx uji/periksa-tanpa-data-pegawai.mts           # 7 kolom pribadi
 *   npx tsx uji/periksa-tanpa-data-pegawai.mts --nama    # + `nama` diganti namanya (daftar kerja penuh)
 *
 * Keluar dengan kode 1 bila ada galat. Berkas sementara (`.tmp-tanpa-pegawai*`) dihapus.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const akar = process.cwd();
const sementara = join(akar, ".tmp-tanpa-pegawai");
const tsconfigSementara = join(akar, "tsconfig.tanpa-pegawai.tmp.json");
const denganNama = process.argv.includes("--nama");

/** Kolom pribadi yang harus lenyap dari `Pengguna` (dan dari seluruh kode yang membacanya). */
const KOLOM_PRIBADI = ["gelarDepan", "gelarBelakang", "nidn", "nip", "nik", "telepon", "fotoUrl"];

function ubahModelPengguna(skema: string): string {
  const mulai = skema.indexOf("model Pengguna {");
  if (mulai < 0) throw new Error("model Pengguna tidak ditemukan di prisma/schema.prisma");
  const akhir = skema.indexOf("\n}\n", mulai) + 3;
  const model = skema.slice(mulai, akhir);

  const baris = model.split("\n").filter((b) => {
    const nama = b.trim().split(/\s+/)[0];
    return !KOLOM_PRIBADI.includes(nama);
  });
  let hasil = baris.join("\n");
  if (denganNama) hasil = hasil.replace(/^(\s+)nama(\s+)String/m, "$1namaLokalDiganti$2String");

  return skema.slice(0, mulai) + hasil + skema.slice(akhir);
}

function bersihkan() {
  rmSync(sementara, { recursive: true, force: true });
  rmSync(tsconfigSementara, { force: true });
}

bersihkan();
try {
  mkdirSync(sementara, { recursive: true });
  let skema = readFileSync(join(akar, "prisma/schema.prisma"), "utf8");
  skema = ubahModelPengguna(skema).replace(/output\s*=\s*"[^"]*"/, 'output = "./klien"');
  writeFileSync(join(sementara, "schema.prisma"), skema);

  execFileSync("npx", ["prisma", "generate", "--schema", join(sementara, "schema.prisma")], { cwd: akar, stdio: "pipe" });

  writeFileSync(
    tsconfigSementara,
    JSON.stringify({
      extends: "./tsconfig.json",
      compilerOptions: {
        incremental: false,
        paths: {
          "@/generated/prisma": ["./.tmp-tanpa-pegawai/klien"],
          "@/generated/prisma/*": ["./.tmp-tanpa-pegawai/klien/*"],
          "@/*": ["./src/*"],
        },
      },
      include: ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "uji/**/*.ts", "uji/**/*.mts", "prisma/**/*.ts"],
    }),
  );

  const r = spawnSync("npx", ["tsc", "-p", tsconfigSementara, "--noEmit", "--pretty", "false"], { cwd: akar, encoding: "utf8" });
  const galat = (r.stdout + r.stderr).split("\n").filter((b) => /error TS\d+/.test(b));
  if (galat.length === 0) {
    console.log(`✔ Tidak ada kode yang membaca ${denganNama ? "nama/" : ""}data pegawai dari Pengguna.`);
  } else {
    console.log(`✖ ${galat.length} tempat masih membaca data pegawai dari Pengguna:\n`);
    for (const g of galat) console.log("  " + g.replace(akar + "/", "").slice(0, 230));
    process.exitCode = 1;
  }
} finally {
  bersihkan();
}
