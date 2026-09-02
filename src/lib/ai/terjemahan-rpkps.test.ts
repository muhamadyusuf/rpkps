import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Penjaga BYOK untuk tugas terjemahan.
 *
 * Aturan docs/08 §4 tidak dapat diberikan tipe: sebuah tugas yang memanggil
 * SDK penyedia langsung, atau menyimpan kliennya pada variabel modul, tetap
 * lolos `tsc` — dan akibatnya baru terlihat pada tagihan dosen yang salah.
 */
const TUGAS = readFileSync("src/lib/ai/terjemahan-rpkps.ts", "utf8");
const AKSI = readFileSync(
  "src/app/[bahasa]/(app)/rpkps/[id]/aksi-terjemahan.ts",
  "utf8",
);
/**
 * Penulisannya tinggal di `src/lib/rpkps/` — SQL tulis-tangan harus dapat
 * diuji terhadap Postgres sungguhan, dan berkas `"use server"` tidak dapat
 * mengekspor apa pun selain fungsi async. Penjaganya ikut ke sana.
 */
const TULIS = readFileSync("src/lib/rpkps/terjemahan-tulis.ts", "utf8");
const MEDAN = readFileSync("src/lib/rpkps/medan-en.ts", "utf8");

/**
 * Kode tanpa komentar dan tanpa baris impor.
 *
 * Penjaga tekstual yang menghitung kemunculan harus melihat kode saja: sebuah
 * komentar yang MENJELASKAN mengapa sesuatu tidak dipakai akan dihitung
 * sebagai pemakaiannya, dan penjaganya berubah jadi larangan menulis
 * penjelasan.
 */
function kodeSaja(berkas: string): string {
  return berkas
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((b) => !b.trimStart().startsWith("//") && !b.startsWith("import "))
    .join("\n");
}

const TUGAS_KODE = kodeSaja(TUGAS);
const AKSI_KODE = kodeSaja(AKSI);

describe("BYOK pada tugas terjemahan", () => {
  it("kredensial hanya lewat pakaiKredensial", () => {
    assert.match(TUGAS, /terpilih: await pakaiKredensial\(/);
    // Tanpa cadangan ke env, ke kunci pengguna lain, atau ke penyedia lain.
    assert.ok(!/process\.env/.test(TUGAS_KODE), "tugas membaca env");
  });

  it("kunci dibuka SEKALI, bukan sekali per medan", () => {
    // Menerjemahkan tiga puluhan medan tetap satu tugas — bukan tiga puluhan.
    const jumlah = [...TUGAS_KODE.matchAll(/pakaiKredensial\(/g)].length;
    assert.equal(jumlah, 1, `pakaiKredensial dipanggil ${jumlah} kali`);
    assert.equal([...TUGAS_KODE.matchAll(/jalankanTugasAi\(/g)].length, 1);
  });

  it("tidak menyimpan klien SDK pada variabel modul", () => {
    // Kunci dosen berikutnya akan diabaikan dan tagihannya salah alamat.
    assert.ok(!/^(const|let)\s+\w*[Kk]lien\s*=/m.test(TUGAS));
    assert.ok(!/from "@anthropic-ai|from "openai|from "@google/.test(TUGAS));
  });

  it("glosarium ada di blok STABIL, bukan di permintaan", () => {
    // Blok stabil yang di-cache penyedia; satu byte berubah membatalkan
    // seluruh cache (docs/01 §4.3).
    const iPanduan = TUGAS.indexOf("const PANDUAN");
    const iGlosarium = TUGAS.indexOf("${GLOSARIUM}");
    assert.ok(iPanduan >= 0 && iGlosarium > iPanduan);
    assert.ok(!TUGAS.slice(TUGAS.indexOf("permintaan:")).includes("GLOSARIUM"));
  });
});

describe("penerapan terjemahan", () => {
  it("model tidak punya jalan langsung ke basis data", () => {
    // `usulkanTerjemahan` hanya meminta; yang menulis adalah
    // `terapkanTerjemahan`, setelah dosen mencentang.
    const usul = AKSI.slice(
      AKSI.indexOf("export async function usulkanTerjemahan"),
      AKSI.indexOf("export type HasilTerapTerjemahan"),
    );
    assert.ok(usul.length > 0, "penanda potongan usulkanTerjemahan tidak ketemu");
    assert.ok(!/prisma\.\w+\.(update|create|upsert|delete)/.test(usul));
    assert.ok(!/\$executeRaw|\$queryRaw/.test(usul));
  });

  it("hanya kolom *En pada tabel yang didaftarkan yang boleh ditulis", () => {
    // Alamat datang dari klien. Menguraikannya apa adanya menjadi
    // `UPDATE <tabel> SET <kolom>` adalah tulis-apa-saja-ke-mana-saja.
    assert.match(MEDAN, /export const MEDAN_BOLEH/);
    assert.match(TULIS, /const izin = MEDAN_BOLEH\[model\];/);
    assert.match(TULIS, /if \(!izin \|\| !kolom\) continue;/);

    // Nama tabel dan kolom masuk ke SQL lewat `Prisma.raw`, jadi keduanya
    // hanya boleh berasal dari daftar itu — tidak pernah dari alamat kiriman.
    for (const [, isi] of TULIS.matchAll(/Prisma\.raw\(([^)]*)\)/g)) {
      assert.match(isi, /grup\.(tabel|kolom)/, `Prisma.raw(${isi}) bukan dari daftar putih`);
    }
    // Isi daftarnya sendiri dicocokkan dengan schema.prisma di
    // `src/lib/rpkps/terjemahan-sql.test.ts`.
  });

  it("alamat disahkan terhadap dokumen ini, bukan sekadar bentuknya", () => {
    // Id baris bersifat global; wewenang yang diperiksa hanya berlaku untuk
    // RPKPS ini. Tanpa langkah ini sebuah alamat milik dokumen lain akan
    // ditulis begitu saja.
    assert.match(AKSI, /kelompokkanTerjemahan\(\s*new Set\(medanRpkps\(rpkps\)\.map/);
    assert.match(TULIS, /if \(!sah\.has\(p\.alamat\)\) continue;/);
  });

  it("tidak memakai simpanPertemuan / simpanTugas", () => {
    // Keduanya mengganti SELURUH isi baris; memakainya di sini berarti
    // menimpa suntingan Indonesia yang terjadi selama model bekerja.
    assert.ok(!/simpanPertemuan\(|simpanTugas\(/.test(AKSI_KODE));
    assert.ok(!/simpanPertemuan\(|simpanTugas\(/.test(kodeSaja(TULIS)));
  });

  it("penulisannya tidak satu kueri per medan", () => {
    // Batas waktu transaksi dihitung sejak transaksi dibuka, bukan per kueri:
    // satu `update` per medan melampauinya pada RPKPS berukuran biasa.
    // Kueri dikelompokkan per kolom, jadi jumlahnya tidak ikut besar dokumen.
    assert.match(TULIS, /FROM \(VALUES \$\{nilai\}\)/);
    assert.ok(
      !/for \(const \w+ of (tulis|pilihan)\)[\s\S]{0,200}\.update\(/.test(TULIS),
      "menulis satu update per medan",
    );
  });
});
