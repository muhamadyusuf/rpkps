import { daftarRingkas } from "@/domain/temuan";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Cetakan gaya diagram — docs/17 §4.3.
 *
 * Inilah bagian yang menjawab permintaan "jangan terlihat seperti hasil AI".
 * Yang membuat sebuah gambar terbaca sebagai keluaran mesin bukan sekadar
 * isinya, melainkan RUPANYA: gradien plastik, bayangan yang tidak konsisten
 * arahnya, garis yang menebal-menipis tanpa alasan, warna yang berganti-ganti,
 * dan label sekecil apa pun asal muat. Semuanya dapat disebut satu per satu,
 * dan karena dapat disebut, semuanya dapat ditolak kode — bukan diserahkan
 * pada kepatuhan model terhadap panduan.
 *
 * Terpisah dari `svg-aman.ts` dengan sengaja. Yang di sana soal KEAMANAN, yang
 * di sini soal RUPA, dan pesannya harus jujur membedakan keduanya: "berbahaya"
 * dan "tidak sesuai gaya buku" menuntut perbaikan yang berbeda.
 *
 * Murni: tanpa DOM. Pemeriksaannya berjalan di atas SVG yang SUDAH lolos
 * `periksaSvgAman`, jadi bentuknya sudah dapat dipercaya.
 */

/** Palet tertutup. Di luar ini ditolak, termasuk warna yang "mirip". */
export const PALET: ReadonlySet<string> = new Set([
  "#111827", // garis dan teks
  "#6b7280", // garis bantu
  "#1d4ed8", // satu-satunya aksen
  "#f3f4f6", // isian muda
  "#ffffff",
  "#fff",
  "white",
  "none",
  "currentcolor",
]);

/** Dua ketebalan garis: biasa dan penekan. Tidak ada yang ketiga. */
export const TEBAL_GARIS: ReadonlySet<string> = new Set(["1.5", "2.5"]);

/** Ukuran huruf terkecil yang masih terbaca pada cetakan B5. */
export const UKURAN_TEKS_MINIMAL = 12;

export interface HasilGayaSvg {
  ok: boolean;
  temuan: TemuanBahanAjar[];
}

export function periksaGayaSvg(svg: string): HasilGayaSvg {
  const temuan: TemuanBahanAjar[] = [];
  const tolak = (kode: string, params?: TemuanBahanAjar["params"]) => {
    temuan.push({ kode, tingkat: "PEMBLOKIR", ...(params ? { params } : {}) });
  };

  const atribut = [...svg.matchAll(/([A-Za-z:-]+)\s*=\s*"([^"]*)"|([A-Za-z:-]+)\s*=\s*'([^']*)'/g)]
    .map((m) => [(m[1] ?? m[3]).toLowerCase(), m[2] ?? m[4]] as const);

  // ── Gradien ─────────────────────────────────────────────────────────
  // Tanda tangan visual paling khas gambar bikinan mesin, dan tidak pernah
  // menjelaskan apa pun yang tidak dapat dijelaskan garis dan isian rata.
  if (/<(linear|radial)gradient/i.test(svg)) tolak("IL-GAYA-GRADIEN");
  else if (atribut.some(([n, v]) => (n === "fill" || n === "stroke") && /url\(/i.test(v))) {
    tolak("IL-GAYA-GRADIEN");
  }

  // ── Transparansi ────────────────────────────────────────────────────
  const tembus = atribut.filter(
    ([n, v]) =>
      (n === "opacity" || n === "fill-opacity" || n === "stroke-opacity") &&
      Number(v) < 1 &&
      v.trim() !== "",
  );
  if (tembus.length > 0) tolak("IL-GAYA-TEMBUS", { jumlah: tembus.length });

  // ── Warna ───────────────────────────────────────────────────────────
  const warnaAsing = new Set<string>();
  for (const [nama, nilai] of atribut) {
    if (nama !== "fill" && nama !== "stroke" && nama !== "stop-color") continue;
    const warna = nilai.trim().toLowerCase();
    if (warna === "") continue;
    if (!PALET.has(warna)) warnaAsing.add(nilai.trim());
  }
  if (warnaAsing.size > 0) {
    tolak("IL-GAYA-WARNA-ASING", {
      jumlah: warnaAsing.size,
      daftar: daftarRingkas([...warnaAsing].sort()),
    });
  }

  // ── Ketebalan garis ─────────────────────────────────────────────────
  const tebalAsing = new Set<string>();
  for (const [nama, nilai] of atribut) {
    if (nama !== "stroke-width") continue;
    const tebal = nilai.trim();
    if (!TEBAL_GARIS.has(tebal)) tebalAsing.add(tebal);
  }
  if (tebalAsing.size > 0) {
    tolak("IL-GAYA-GARIS", {
      daftar: daftarRingkas([...tebalAsing].sort()),
    });
  }

  // ── Teks ────────────────────────────────────────────────────────────
  const terlaluKecil = atribut
    .filter(([n, v]) => n === "font-size" && Number.parseFloat(v) < UKURAN_TEKS_MINIMAL)
    .map(([, v]) => v.trim());
  if (terlaluKecil.length > 0) {
    tolak("IL-GAYA-TEKS-KECIL", { n: UKURAN_TEKS_MINIMAL });
  }

  /*
   * Font wajib berujung `serif`. Bukan soal selera: gambar dirender di dalam
   * `<img>`, tempat webfont halaman TIDAK ikut (docs/17 §5.2). Nama font yang
   * tidak ada di mesin pembaca akan diganti diam-diam oleh font bawaannya, dan
   * satu-satunya cara mengendalikan penggantian itu adalah menyebut keluarga
   * generiknya di ujung daftar.
   */
  const fontAsing = new Set<string>();
  for (const [nama, nilai] of atribut) {
    if (nama !== "font-family") continue;
    if (!/serif\s*$/i.test(nilai.trim())) fontAsing.add(nilai.trim().slice(0, 40));
  }
  if (fontAsing.size > 0) {
    tolak("IL-GAYA-FONT-ASING", { daftar: daftarRingkas([...fontAsing].sort()) });
  }

  // ── Ukuran tetap pada akar ──────────────────────────────────────────
  // `width`/`height` tetap membuat gambar memaksakan ukurannya sendiri pada
  // halaman. Yang dipakai adalah `viewBox`, sehingga lebar cetak yang
  // menentukan — bukan sebaliknya.
  const tagAkar = svg.slice(svg.indexOf("<svg"), svg.indexOf(">", svg.indexOf("<svg")) + 1);
  if (/\s(width|height)\s*=/i.test(tagAkar)) tolak("IL-GAYA-UKURAN-TETAP");

  return { ok: temuan.length === 0, temuan };
}
