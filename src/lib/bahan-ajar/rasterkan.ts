/**
 * Rasterisasi diagram DI PERAMBAN — docs/17 I3 dan §5.2.
 *
 * Bukan modul server. Ia berjalan di peramban dosen, pada saat dosen
 * menyetujui sebuah diagram, dan dua sifatnya adalah alasan seluruh rancangan
 * ini memilih peramban alih-alih server:
 *
 * 1. **Font.** Server Linux tidak punya Times New Roman. Merasterkan di sana
 *    berarti font diganti diam-diam, label bergeser, dan tidak ada satu pun
 *    galat yang menyebutkannya. Di peramban dosen, yang dipakai adalah font
 *    yang sama dengan yang baru saja dilihatnya.
 * 2. **Kesetaraan.** Yang tercetak adalah hasil rasterisasi dari SVG yang
 *    sama, pada saat yang sama, di mesin yang sama dengan pratinjaunya.
 *
 * # Mengapa lewat `<img>`, bukan disisipkan ke halaman
 *
 * SVG yang digambar berasal dari model maupun dari berkas unggahan — data yang
 * tidak dipercaya. Di dalam `<img>`, skrip tidak dieksekusi dan rujukan luar
 * tidak diambil, apa pun yang lolos dari sanitasi server. Karena itu modul ini
 * TIDAK PERNAH memakai `innerHTML` maupun menyisipkan `<svg>` ke DOM.
 *
 * Konsekuensinya disengaja dan sudah ditegakkan `gaya-svg.ts`: webfont halaman
 * tidak ikut ke dalam `<img>`, jadi diagram wajib menyebut keluarga font
 * generik di ujung daftarnya.
 */

/** Lebar raster bawaan: 300 dpi pada lebar cetak B5 setelah tepi. */
export const LEBAR_RASTER = 1_600;

export interface HasilRaster {
  /** `data:image/png;base64,…` — bentuk yang dikirim ke Server Action. */
  dataUri: string;
  lebar: number;
  tinggi: number;
}

/** SVG sebagai `data:` URI yang aman dipasang pada `<img src>`. */
export function svgKeDataUri(svg: string): string {
  // `btoa` menolak aksara di luar Latin-1, dan label diagram berbahasa
  // Indonesia maupun Inggris tetap dapat memuat tanda kutip melengkung atau
  // em dash. Teksnya dikodekan ke UTF-8 lebih dulu.
  const utf8 = new TextEncoder().encode(svg);
  let biner = "";
  for (const b of utf8) biner += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(biner)}`;
}

/** Perbandingan sisi dari `viewBox`; dipakai menghitung tinggi raster. */
export function rasioViewBox(svg: string): number {
  const cocok = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!cocok) return 2;
  const [, , , w, h] = [0, ...cocok[1].trim().split(/[\s,]+/).map(Number)];
  return w > 0 && h > 0 ? w / h : 2;
}

/**
 * Menggambar SVG menjadi PNG.
 *
 * Melempar bila peramban menolak memuat gambarnya — yang berarti SVG-nya
 * rusak. Kegagalan itu HARUS terlihat: menyimpan diagram tanpa PNG akan
 * menghasilkan buku dengan bingkai kosong di tempat gambarnya.
 */
export async function rasterkanSvg(
  svg: string,
  lebarPx: number = LEBAR_RASTER,
): Promise<HasilRaster> {
  const rasio = rasioViewBox(svg);
  const lebar = Math.min(Math.round(lebarPx), 3_000);
  const tinggi = Math.max(1, Math.min(Math.round(lebar / rasio), 3_000));

  const gambar = new Image();
  gambar.decoding = "sync";
  gambar.src = svgKeDataUri(svg);

  await new Promise<void>((selesai, gagal) => {
    gambar.onload = () => selesai();
    gambar.onerror = () => gagal(new Error("SVG tidak dapat dimuat peramban."));
  });

  const kanvas = document.createElement("canvas");
  kanvas.width = lebar;
  kanvas.height = tinggi;

  const konteks = kanvas.getContext("2d");
  if (!konteks) throw new Error("Kanvas tidak tersedia.");

  // Latar putih, bukan transparan: PNG transparan yang ditempel ke halaman
  // Word bertema gelap akan tampil sebagai teks hitam di atas hitam.
  konteks.fillStyle = "#FFFFFF";
  konteks.fillRect(0, 0, lebar, tinggi);
  konteks.drawImage(gambar, 0, 0, lebar, tinggi);

  return { dataUri: kanvas.toDataURL("image/png"), lebar, tinggi };
}

/** Membaca berkas unggahan menjadi data URI PNG lewat kanvas yang sama. */
export async function rasterkanBerkas(berkas: File): Promise<HasilRaster> {
  const url = URL.createObjectURL(berkas);
  try {
    const gambar = new Image();
    gambar.src = url;
    await new Promise<void>((selesai, gagal) => {
      gambar.onload = () => selesai();
      gambar.onerror = () => gagal(new Error("Berkas tidak dapat dibaca sebagai gambar."));
    });

    // Gambar besar dikecilkan sampai batas cetak; yang kecil dibiarkan apa
    // adanya — memperbesarnya hanya menambah bita tanpa menambah rincian.
    const skala = Math.min(1, 3_000 / Math.max(gambar.naturalWidth, gambar.naturalHeight));
    const lebar = Math.max(1, Math.round(gambar.naturalWidth * skala));
    const tinggi = Math.max(1, Math.round(gambar.naturalHeight * skala));

    const kanvas = document.createElement("canvas");
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const konteks = kanvas.getContext("2d");
    if (!konteks) throw new Error("Kanvas tidak tersedia.");
    konteks.fillStyle = "#FFFFFF";
    konteks.fillRect(0, 0, lebar, tinggi);
    konteks.drawImage(gambar, 0, 0, lebar, tinggi);

    return { dataUri: kanvas.toDataURL("image/png"), lebar, tinggi };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Merender kode Mermaid menjadi SVG.
 *
 * Mermaid diimpor DINAMIS: pustakanya besar, dan hanya halaman bab yang
 * memerlukannya. Setelannya bukan hiasan —
 *
 * - `htmlLabels: false` wajib. Label `foreignObject` tidak dirender sama
 *   sekali di dalam `<img>`, sehingga diagramnya akan tercetak berisi kotak
 *   kosong tanpa satu pesan galat pun (docs/17 §4.3).
 * - `securityLevel: "strict"` mematikan tautan dan skrip di dalam diagram.
 * - Tema memakai palet buku, bukan bawaan Mermaid: warna diagram milik buku
 *   (docs/17 I7), dan itulah sebabnya `style`/`classDef` dari model ditolak.
 */
export async function renderMermaid(kode: string, id: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    theme: "base",
    fontFamily: "Times New Roman, Liberation Serif, serif",
    themeVariables: {
      background: "#FFFFFF",
      primaryColor: "#F3F4F6",
      primaryBorderColor: "#111827",
      primaryTextColor: "#111827",
      lineColor: "#6B7280",
      secondaryColor: "#F3F4F6",
      tertiaryColor: "#FFFFFF",
      fontSize: "14px",
    },
  });

  const { svg } = await mermaid.render(`mmd-${id}`, kode);
  return svg;
}
