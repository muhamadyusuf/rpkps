import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Penjaga kredensial SMTP — docs/10 §2.5.
 *
 * Alasannya sama dengan `src/lib/ai/kredensial.ts`: kredensial yang boleh
 * dibaca dari banyak tempat cepat atau lambat akan tercetak di salah satunya,
 * dan sandi yang sekali tertulis ke log atau ke basis data ada di cadangannya
 * selamanya. `tsc` tidak dapat melihat pelanggaran ini — keduanya `string`.
 */

const PENGIRIM = "src/lib/surel/pengirim.ts";

function berkasTs(dir: string): string[] {
  return readdirSync(dir).flatMap((nama) => {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) return berkasTs(jalur);
    return /\.tsx?$/.test(nama) ? [jalur] : [];
  });
}

describe("kredensial SMTP", () => {
  it("hanya dibaca di satu berkas", () => {
    const pelanggar = berkasTs("src")
      .filter((j) => j !== PENGIRIM && !j.endsWith("rahasia.test.ts"))
      .filter((j) => /SUREL_SMTP_(SANDI|PENGGUNA)/.test(readFileSync(j, "utf8")));
    assert.deepEqual(pelanggar, [], `env SMTP dibaca di luar ${PENGIRIM}`);
  });

  it("pengirim tidak pernah mencetak konfigurasinya", () => {
    const isi = readFileSync(PENGIRIM, "utf8");
    assert.ok(!/console\.(log|error|warn|info)/.test(isi), "pengirim menulis ke log");
  });

  it("penguras tidak pernah mencetak objek galat SMTP apa adanya", () => {
    /*
     * Pesan bawaan beberapa server SMTP memuat nama akun pengirim. Yang boleh
     * masuk log dari jalur KIRIM hanya id barisnya; pesannya disimpan setelah
     * disamarkan `ringkasGalat`.
     *
     * Yang diperiksa hanya jalur kirim — sampai pembukuan `tandai()`. Galat di
     * sana datang dari Prisma, bukan dari SMTP, dan membungkamnya justru
     * membuat kegagalan pembukuan tidak dapat ditelusuri sama sekali.
     */
    const isi = readFileSync("src/lib/surel/kuras.ts", "utf8");
    const batas = isi.indexOf("async function tandai(");
    assert.ok(batas > 0, "penanda batas jalur kirim tidak ditemukan");

    for (const baris of isi.slice(0, batas).split("\n")) {
      if (!baris.includes("console.error")) continue;
      assert.ok(
        !/console\.error\([^)]*\bgalat\b/.test(baris),
        `penguras mencetak galat mentah: ${baris.trim()}`,
      );
    }
  });

  it("sandi tidak pernah ikut ke kolom galat tanpa disamarkan", () => {
    const isi = readFileSync("src/lib/surel/kuras.ts", "utf8");
    assert.match(isi, /surelGalat: ringkasGalat\(/);
    assert.match(isi, /rahasiaSmtp\(\)/);
  });
});
