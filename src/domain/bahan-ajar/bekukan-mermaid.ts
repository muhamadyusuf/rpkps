import { periksaGayaSvg } from "./gaya-svg";
import { periksaSvgAman } from "./svg-aman";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Membekukan keluaran Mermaid menjadi SVG yang dapat disunting — docs/18 §3.
 *
 * Mermaid menghitung tata letaknya sendiri, jadi tidak ada koordinat yang dapat
 * diseret. Pembekuan menukar tata letak otomatis itu dengan kemampuan
 * menyunting: sesudahnya diagram menjadi SVG biasa, dan menyusun ulang dari
 * kode Mermaid berarti membuang seluruh suntingan visualnya.
 *
 * # Mengapa keluaran Mermaid tidak dapat disimpan apa adanya
 *
 * Ia memuat blok `<style>`, dan `<style>` DITOLAK sanitasi kita (docs/17 §5.1):
 * ia menerima `url(...)` dan mengembalikan pengambilan sumber daya luar lewat
 * pintu belakang. Jadi gayanya harus dipindahkan ke atribut sebelum disimpan.
 *
 * Penjinakannya MURNI TEKS, tanpa DOM sama sekali. Menginlinekan gaya dengan
 * `getComputedStyle` menuntut SVG disisipkan ke dokumen — persis larangan
 * docs/17 I2. Bahwa markahnya kali ini berasal dari pustaka kita sendiri tidak
 * mengubah bentuk kodenya: yang tertinggal adalah jalur penyisipan yang siap
 * dipakai ulang oleh orang berikutnya untuk markah yang bukan milik kita.
 *
 * Konsekuensi yang diterima: rupa hasil beku tidak persis sama dengan
 * pratinjaunya — tetapi palet yang dipasang di sini sama dengan tema Mermaid
 * kita, sehingga bedanya tipis dan dosen melihat hasilnya sebelum menyimpan.
 */

const GARIS = "#111827";
const BANTU = "#6B7280";
const ISIAN = "#F3F4F6";
const FONT = "Times New Roman, Liberation Serif, serif";

export interface HasilBeku {
  ok: boolean;
  svg: string | null;
  temuan: TemuanBahanAjar[];
}

export function bekukanMermaid(svgMermaid: string): HasilBeku {
  let svg = svgMermaid.trim();

  // 1 · Blok <style> dibuang seluruhnya, beserta isinya.
  svg = svg.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // 2 · Ukuran tetap pada tag akar dibuang; viewBox yang menentukan.
  svg = svg.replace(/(<svg\b[^>]*?)\s(?:width|height)\s*=\s*"[^"]*"/gi, "$1");
  svg = svg.replace(/(<svg\b[^>]*?)\s(?:width|height)\s*=\s*"[^"]*"/gi, "$1");
  // Atribut `style` pada elemen mana pun ikut dibuang — ia ditolak sanitasi.
  svg = svg.replace(/\sstyle\s*=\s*"[^"]*"/gi, "");
  svg = svg.replace(/\sstyle\s*=\s*'[^']*'/gi, "");

  /*
   * 3 · Rupa dipasang eksplisit menurut JENIS elemen.
   *
   * Sesudah `<style>` hilang, elemen tanpa atribut rupa akan dirender dengan
   * bawaan SVG — isian hitam pekat. Yang dipasang di sini bukan tebakan
   * melainkan aturan tetap: bentuk mendapat isian dan garis buku, lintasan
   * mendapat garis bantu tanpa isian, teks mendapat warna dan font buku.
   */
  svg = svg.replace(
    /<(rect|circle|ellipse|polygon)\b([^>]*)>/gi,
    (_, tag: string, atr: string) =>
      `<${tag}${bersihkanRupa(atr)} fill="${ISIAN}" stroke="${GARIS}" stroke-width="1.5">`,
  );
  svg = svg.replace(
    /<(path|line|polyline)\b([^>]*)>/gi,
    (_, tag: string, atr: string) =>
      `<${tag}${bersihkanRupa(atr)} fill="none" stroke="${BANTU}" stroke-width="1.5">`,
  );
  svg = svg.replace(
    /<(text|tspan)\b([^>]*)>/gi,
    (_, tag: string, atr: string) =>
      `<${tag}${bersihkanRupa(atr)} fill="${GARIS}" font-family="${FONT}" font-size="14">`,
  );

  // 4 · Kelas Mermaid tidak berguna lagi setelah gayanya hilang.
  svg = svg.replace(/\sclass\s*=\s*"[^"]*"/gi, "");

  const aman = periksaSvgAman(svg);
  if (!aman.ok) return { ok: false, svg: null, temuan: aman.temuan };

  const gaya = periksaGayaSvg(svg);
  if (!gaya.ok) return { ok: false, svg: null, temuan: gaya.temuan };

  return { ok: true, svg: aman.svg, temuan: [] };
}

/**
 * Membuang atribut rupa yang lama supaya tidak muncul dua kali.
 *
 * Atribut ganda pada satu elemen bukan galat XML — yang PERTAMA yang berlaku
 * di sebagian besar pengurai, sehingga menambahkan `fill` baru di belakang
 * tanpa membuang yang lama akan diam-diam tidak berpengaruh apa-apa.
 */
function bersihkanRupa(atribut: string): string {
  return atribut
    .replace(
      /\s(?:fill|stroke|stroke-width|font-family|font-size|opacity|fill-opacity|stroke-opacity)\s*=\s*"[^"]*"/gi,
      "",
    )
    .replace(/\s*\/\s*$/, "")
    .replace(/\s+/g, " ")
    .trimEnd();
}
