import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Penjaga susunan menu tarik-turun.
 *
 * `DropdownMenuLabel` membungkus `Menu.GroupLabel` milik Base UI, yang mencari
 * `MenuGroupContext` untuk memasang `aria-labelledby`. Di luar
 * `DropdownMenuGroup` ia MELEMPAR — bukan gagal berkompilasi, bukan pula
 * tampil tanpa gaya: menu yang dibuka melempar galat dan halamannya jatuh ke
 * batas galat. Tipenya tidak dapat menangkapnya karena keduanya komponen yang
 * sah berdiri sendiri, dan tidak ada uji perenderan DOM di proyek ini yang
 * akan membuka menunya.
 *
 * Karena itu penjaganya tekstual, dan sengaja sederhana: ia menghitung
 * kedalaman `DropdownMenuGroup` sambil berjalan turun sebuah berkas.
 */

function berkasTsx(akar: string): string[] {
  const hasil: string[] = [];
  for (const nama of readdirSync(akar)) {
    const jalur = join(akar, nama);
    if (statSync(jalur).isDirectory()) hasil.push(...berkasTsx(jalur));
    else if (nama.endsWith(".tsx")) hasil.push(jalur);
  }
  return hasil;
}

/** Baris `<DropdownMenuLabel` yang berada di luar sebuah grup. */
function labelTanpaGrup(isi: string): number[] {
  const salah: number[] = [];
  let kedalaman = 0;
  isi.split("\n").forEach((baris, i) => {
    if (baris.includes("</DropdownMenuGroup>") || baris.includes("</DropdownMenuRadioGroup>")) {
      kedalaman -= 1;
    }
    if (baris.includes("<DropdownMenuLabel") && kedalaman <= 0) salah.push(i + 1);
    if (
      (baris.includes("<DropdownMenuGroup") || baris.includes("<DropdownMenuRadioGroup")) &&
      !baris.includes("</Dropdown")
    ) {
      kedalaman += 1;
    }
  });
  return salah;
}

describe("susunan menu tarik-turun", () => {
  it("setiap DropdownMenuLabel berada di dalam sebuah grup", () => {
    const pelanggar: string[] = [];
    for (const berkas of berkasTsx("src")) {
      // Definisi komponennya sendiri, bukan pemakaian.
      if (berkas.endsWith("dropdown-menu.tsx")) continue;
      const isi = readFileSync(berkas, "utf8");
      if (!isi.includes("<DropdownMenuLabel")) continue;
      for (const baris of labelTanpaGrup(isi)) pelanggar.push(`${berkas}:${baris}`);
    }
    assert.deepEqual(pelanggar, [], `di luar DropdownMenuGroup: ${pelanggar.join(", ")}`);
  });
});
