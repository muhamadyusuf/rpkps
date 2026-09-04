/**
 * Model sunting SVG — docs/18.
 *
 * Mengurai SVG yang SUDAH lolos `periksaSvgAman` menjadi daftar simpul beserta
 * **posisi tiap nilai atribut di dalam string aslinya**, sehingga penyuntingan
 * dapat mengganti potongan itu saja.
 *
 * # Mengapa menyunting teks, bukan menyusun ulang pohon
 *
 * Menyusun ulang berarti setiap geseran satu kotak menulis ulang seluruh
 * berkas dengan format kita sendiri: urutan atribut berubah, indentasi hilang,
 * komentar penyusunnya lenyap. Dosen yang membuka tab "kode" setelah menggeser
 * satu elemen akan menemukan berkas yang tidak dikenalinya lagi — padahal yang
 * dilakukannya hanya memindahkan sebuah label dua sentimeter.
 *
 * Karena itu tiap `NilaiAtribut` membawa `awal` dan `akhir`, dan seluruh
 * operasi di berkas ini adalah penggantian potongan.
 *
 * Murni: tanpa DOM, tanpa Prisma. Pengurainya sengaja ketat dan menyerah
 * (mengembalikan daftar kosong) pada bentuk yang tidak dikenalinya — modul ini
 * bukan penjaga keamanan, dan tidak boleh menerima apa pun yang ditolak
 * `svg-aman.ts`.
 */

export interface NilaiAtribut {
  nilai: string;
  /** Indeks aksara pertama nilai di dalam SVG asli (di dalam tanda kutip). */
  awal: number;
  /** Indeks tepat setelah aksara terakhir nilai. */
  akhir: number;
}

export interface SimpulSvg {
  /** Urutan kemunculan; dipakai sebagai identitas selama satu sesi sunting. */
  indeks: number;
  tag: string;
  atribut: Map<string, NilaiAtribut>;
  /** Isi teks bagi `text`/`tspan`, beserta posisinya. */
  teks: NilaiAtribut | null;
}

export interface KotakSimpul {
  x: number;
  y: number;
  lebar: number;
  tinggi: number;
}

export interface ViewBox {
  x: number;
  y: number;
  lebar: number;
  tinggi: number;
}

/** Elemen yang punya geometri dan karena itu dapat disunting visual. */
const DAPAT_DISUNTING = new Set([
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "path",
]);

export function dapatDisunting(tag: string): boolean {
  return DAPAT_DISUNTING.has(tag);
}

// ─────────────────────────────────────────────────────────────
// PENGURAI
// ─────────────────────────────────────────────────────────────

export function uraiSvg(svg: string): SimpulSvg[] {
  const simpul: SimpulSvg[] = [];
  let i = 0;
  let indeks = 0;

  while (i < svg.length) {
    const buka = svg.indexOf("<", i);
    if (buka === -1) break;

    if (svg.startsWith("<!--", buka)) {
      const tutup = svg.indexOf("-->", buka + 4);
      if (tutup === -1) break;
      i = tutup + 3;
      continue;
    }
    if (svg.startsWith("<?", buka) || svg.startsWith("<!", buka)) {
      const tutup = svg.indexOf(">", buka);
      if (tutup === -1) break;
      i = tutup + 1;
      continue;
    }
    if (svg[buka + 1] === "/") {
      const tutup = svg.indexOf(">", buka);
      if (tutup === -1) break;
      i = tutup + 1;
      continue;
    }

    const tag = uraiTagBeroffset(svg, buka);
    if (!tag) break;

    const isi: SimpulSvg = {
      indeks: indeks++,
      tag: tag.nama,
      atribut: tag.atribut,
      teks: null,
    };

    // Isi teks hanya diambil bila elemennya benar-benar berisi teks polos.
    if (!tag.tunggal && (tag.nama === "text" || tag.nama === "tspan")) {
      const tutup = svg.indexOf(`</${tag.nama}`, tag.akhir);
      const berikutnya = svg.indexOf("<", tag.akhir);
      if (tutup !== -1 && tutup === berikutnya) {
        isi.teks = { nilai: svg.slice(tag.akhir, tutup), awal: tag.akhir, akhir: tutup };
      }
    }

    simpul.push(isi);
    i = tag.akhir;
  }

  return simpul;
}

interface TagTerurai {
  nama: string;
  tunggal: boolean;
  atribut: Map<string, NilaiAtribut>;
  akhir: number;
}

/** Sama bentuknya dengan pengurai `svg-aman.ts`, tetapi mencatat offset. */
function uraiTagBeroffset(s: string, mulai: number): TagTerurai | null {
  let i = mulai + 1;
  const awalNama = i;
  while (i < s.length && /[A-Za-z0-9:_-]/.test(s[i])) i++;
  const nama = s.slice(awalNama, i).toLowerCase();
  if (nama === "") return null;

  const atribut = new Map<string, NilaiAtribut>();

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;

    if (s[i] === ">") return { nama, tunggal: false, atribut, akhir: i + 1 };
    if (s[i] === "/" && s[i + 1] === ">") {
      return { nama, tunggal: true, atribut, akhir: i + 2 };
    }

    const awalAtr = i;
    while (i < s.length && !/[\s=/>]/.test(s[i])) i++;
    const namaAtr = s.slice(awalAtr, i).toLowerCase();
    if (namaAtr === "") return null;

    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "=") continue;
    i++;
    while (i < s.length && /\s/.test(s[i])) i++;

    const kutip = s[i];
    if (kutip !== '"' && kutip !== "'") return null;
    const tutup = s.indexOf(kutip, i + 1);
    if (tutup === -1) return null;

    atribut.set(namaAtr, { nilai: s.slice(i + 1, tutup), awal: i + 1, akhir: tutup });
    i = tutup + 1;
  }

  return null;
}

export function viewBoxDari(svg: string): ViewBox | null {
  const cocok = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!cocok) return null;
  const n = cocok[1].trim().split(/[\s,]+/).map(Number);
  if (n.length < 4 || n.some((x) => !Number.isFinite(x))) return null;
  return { x: n[0], y: n[1], lebar: n[2], tinggi: n[3] };
}

// ─────────────────────────────────────────────────────────────
// GEOMETRI
// ─────────────────────────────────────────────────────────────

function angka(s: SimpulSvg, nama: string, bawaan = 0): number {
  const nilai = Number(s.atribut.get(nama)?.nilai);
  return Number.isFinite(nilai) ? nilai : bawaan;
}

function titikDari(nilai: string): number[] {
  return nilai.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
}

/** Pergeseran yang sudah terpasang lewat `transform="translate(x,y)"`. */
function translasi(s: SimpulSvg): { x: number; y: number } {
  const t = s.atribut.get("transform")?.nilai ?? "";
  const cocok = t.match(/translate\(\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)?\s*\)/);
  if (!cocok) return { x: 0, y: 0 };
  return { x: Number(cocok[1]) || 0, y: Number(cocok[2] ?? 0) || 0 };
}

/**
 * Kotak pembatas sebuah simpul, dalam satuan viewBox.
 *
 * Untuk `text` ia TAKSIRAN: lebar sebuah tulisan hanya diketahui setelah
 * dirender dengan fontnya, dan kita tidak merendernya (docs/17 §5.2). Taksiran
 * 0,55 × ukuran huruf per aksara cukup untuk kotak seleksi yang dapat diklik;
 * ia tidak dipakai untuk apa pun yang tercetak.
 */
export function kotakSimpul(s: SimpulSvg): KotakSimpul | null {
  const t = translasi(s);
  const geser = (k: KotakSimpul): KotakSimpul => ({ ...k, x: k.x + t.x, y: k.y + t.y });

  switch (s.tag) {
    case "rect":
      return geser({
        x: angka(s, "x"),
        y: angka(s, "y"),
        lebar: angka(s, "width"),
        tinggi: angka(s, "height"),
      });
    case "circle": {
      const r = angka(s, "r");
      return geser({ x: angka(s, "cx") - r, y: angka(s, "cy") - r, lebar: 2 * r, tinggi: 2 * r });
    }
    case "ellipse": {
      const rx = angka(s, "rx");
      const ry = angka(s, "ry");
      return geser({
        x: angka(s, "cx") - rx,
        y: angka(s, "cy") - ry,
        lebar: 2 * rx,
        tinggi: 2 * ry,
      });
    }
    case "line": {
      const x1 = angka(s, "x1");
      const y1 = angka(s, "y1");
      const x2 = angka(s, "x2");
      const y2 = angka(s, "y2");
      return geser({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        lebar: Math.abs(x2 - x1),
        tinggi: Math.abs(y2 - y1),
      });
    }
    case "polyline":
    case "polygon": {
      const n = titikDari(s.atribut.get("points")?.nilai ?? "");
      if (n.length < 4) return null;
      const xs = n.filter((_, i) => i % 2 === 0);
      const ys = n.filter((_, i) => i % 2 === 1);
      return geser({
        x: Math.min(...xs),
        y: Math.min(...ys),
        lebar: Math.max(...xs) - Math.min(...xs),
        tinggi: Math.max(...ys) - Math.min(...ys),
      });
    }
    case "text":
    case "tspan": {
      const ukuran = angka(s, "font-size", 16);
      const panjang = (s.teks?.nilai ?? "").trim().length;
      const lebar = Math.max(ukuran, panjang * ukuran * 0.55);
      const anchor = s.atribut.get("text-anchor")?.nilai;
      const x = angka(s, "x");
      const kiri = anchor === "middle" ? x - lebar / 2 : anchor === "end" ? x - lebar : x;
      // `y` sebuah teks adalah garis alasnya, bukan tepi atasnya.
      return geser({ x: kiri, y: angka(s, "y") - ukuran * 0.8, lebar, tinggi: ukuran * 1.2 });
    }
    case "path": {
      const n = titikDari((s.atribut.get("d")?.nilai ?? "").replace(/[A-Za-z]/g, " "));
      if (n.length < 2) return null;
      const xs = n.filter((_, i) => i % 2 === 0);
      const ys = n.filter((_, i) => i % 2 === 1);
      return geser({
        x: Math.min(...xs),
        y: Math.min(...ys),
        lebar: Math.max(...xs) - Math.min(...xs),
        tinggi: Math.max(...ys) - Math.min(...ys),
      });
    }
    default:
      return null;
  }
}

/**
 * Simpul PALING ATAS pada sebuah titik.
 *
 * Yang belakangan digambar menutupi yang lebih dahulu, jadi penelusurannya
 * dari belakang. Elemen setipis garis diberi toleransi beberapa satuan —
 * tanpa itu, sebuah `line` praktis mustahil diklik.
 */
export function simpulPada(
  simpul: readonly SimpulSvg[],
  x: number,
  y: number,
  toleransi = 4,
): SimpulSvg | null {
  for (let i = simpul.length - 1; i >= 0; i--) {
    const s = simpul[i];
    if (!dapatDisunting(s.tag)) continue;
    const k = kotakSimpul(s);
    if (!k) continue;
    if (
      x >= k.x - toleransi &&
      x <= k.x + k.lebar + toleransi &&
      y >= k.y - toleransi &&
      y <= k.y + k.tinggi + toleransi
    ) {
      return s;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// SUNTINGAN — seluruhnya penggantian potongan teks
// ─────────────────────────────────────────────────────────────

/** Mengganti beberapa potongan sekaligus, dari belakang agar offset tetap sah. */
function gantiPotongan(
  svg: string,
  potongan: { awal: number; akhir: number; isi: string }[],
): string {
  let hasil = svg;
  for (const p of [...potongan].sort((a, b) => b.awal - a.awal)) {
    hasil = hasil.slice(0, p.awal) + p.isi + hasil.slice(p.akhir);
  }
  return hasil;
}

/** Angka dirapikan agar kode tidak dipenuhi 17 digit desimal. */
function rapi(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function gantiAngka(s: SimpulSvg, nama: string, ubah: (n: number) => number) {
  const atr = s.atribut.get(nama);
  if (!atr) return null;
  const nilai = Number(atr.nilai);
  if (!Number.isFinite(nilai)) return null;
  return { awal: atr.awal, akhir: atr.akhir, isi: rapi(ubah(nilai)) };
}

/** Menggeser sebuah simpul sejauh (dx, dy) dalam satuan viewBox. */
export function geserSimpul(
  svg: string,
  simpul: SimpulSvg,
  dx: number,
  dy: number,
): string {
  const potongan: { awal: number; akhir: number; isi: string }[] = [];
  const dorong = (p: ReturnType<typeof gantiAngka>) => {
    if (p) potongan.push(p);
  };

  switch (simpul.tag) {
    case "rect":
    case "text":
    case "tspan":
      dorong(gantiAngka(simpul, "x", (n) => n + dx));
      dorong(gantiAngka(simpul, "y", (n) => n + dy));
      break;
    case "circle":
    case "ellipse":
      dorong(gantiAngka(simpul, "cx", (n) => n + dx));
      dorong(gantiAngka(simpul, "cy", (n) => n + dy));
      break;
    case "line":
      dorong(gantiAngka(simpul, "x1", (n) => n + dx));
      dorong(gantiAngka(simpul, "y1", (n) => n + dy));
      dorong(gantiAngka(simpul, "x2", (n) => n + dx));
      dorong(gantiAngka(simpul, "y2", (n) => n + dy));
      break;
    case "polyline":
    case "polygon": {
      const atr = simpul.atribut.get("points");
      if (!atr) break;
      const n = titikDari(atr.nilai);
      const baru: string[] = [];
      for (let i = 0; i + 1 < n.length; i += 2) {
        baru.push(`${rapi(n[i] + dx)},${rapi(n[i + 1] + dy)}`);
      }
      potongan.push({ awal: atr.awal, akhir: atr.akhir, isi: baru.join(" ") });
      break;
    }
    case "path": {
      /*
       * `path` digeser lewat `transform`, bukan dengan menulis ulang `d`.
       * Menyunting `d` menuntut pengurai lintasan lengkap — termasuk perintah
       * relatif, busur, dan Bézier — dan satu kesalahan di sana mengubah
       * bentuk gambarnya, bukan sekadar posisinya.
       */
      const t = translasi(simpul);
      const baru = `translate(${rapi(t.x + dx)},${rapi(t.y + dy)})`;
      const atr = simpul.atribut.get("transform");
      if (!atr) return sisipkanAtribut(svg, simpul, "transform", baru);
      const lain = atr.nilai.replace(/translate\([^)]*\)/, "").trim();
      potongan.push({
        awal: atr.awal,
        akhir: atr.akhir,
        isi: lain ? `${baru} ${lain}` : baru,
      });
      break;
    }
    default:
      return svg;
  }

  return gantiPotongan(svg, potongan);
}

/** Mengubah ukuran sebuah simpul. Tidak semua jenis mendukungnya. */
export function ubahUkuranSimpul(
  svg: string,
  simpul: SimpulSvg,
  lebar: number,
  tinggi: number,
): string {
  const l = Math.max(1, lebar);
  const t = Math.max(1, tinggi);
  const potongan: { awal: number; akhir: number; isi: string }[] = [];
  const dorong = (p: ReturnType<typeof gantiAngka>) => {
    if (p) potongan.push(p);
  };

  switch (simpul.tag) {
    case "rect":
      dorong(gantiAngka(simpul, "width", () => l));
      dorong(gantiAngka(simpul, "height", () => t));
      break;
    case "circle":
      dorong(gantiAngka(simpul, "r", () => Math.max(1, Math.min(l, t) / 2)));
      break;
    case "ellipse":
      dorong(gantiAngka(simpul, "rx", () => l / 2));
      dorong(gantiAngka(simpul, "ry", () => t / 2));
      break;
    case "text":
    case "tspan": {
      // Teks tidak punya lebar sendiri; yang diubah adalah ukuran hurufnya.
      const ukuran = Math.max(12, Math.round(t / 1.2));
      const atr = simpul.atribut.get("font-size");
      if (!atr) return sisipkanAtribut(svg, simpul, "font-size", String(ukuran));
      potongan.push({ awal: atr.awal, akhir: atr.akhir, isi: String(ukuran) });
      break;
    }
    default:
      return svg;
  }

  return gantiPotongan(svg, potongan);
}

/** Mengganti isi teks sebuah `text`/`tspan`. */
export function ubahTeksSimpul(svg: string, simpul: SimpulSvg, teks: string): string {
  if (!simpul.teks) return svg;
  // Aksara yang bermakna di XML dilarikan; sisanya masuk apa adanya.
  const aman = teks.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return gantiPotongan(svg, [
    { awal: simpul.teks.awal, akhir: simpul.teks.akhir, isi: aman },
  ]);
}

/** Mengganti sebuah atribut rupa, atau menambahkannya bila belum ada. */
export function ubahAtributSimpul(
  svg: string,
  simpul: SimpulSvg,
  nama: string,
  nilai: string,
): string {
  const atr = simpul.atribut.get(nama);
  if (!atr) return sisipkanAtribut(svg, simpul, nama, nilai);
  return gantiPotongan(svg, [{ awal: atr.awal, akhir: atr.akhir, isi: nilai }]);
}

/** Menyisipkan atribut baru tepat setelah nama tag. */
function sisipkanAtribut(
  svg: string,
  simpul: SimpulSvg,
  nama: string,
  nilai: string,
): string {
  // Posisi tag dicari ulang: simpul menyimpan offset ATRIBUT, dan sebuah tag
  // tanpa atribut sama sekali tidak punya satu pun offset untuk bersandar.
  const posisi = posisiTag(svg, simpul.indeks);
  if (posisi === null) return svg;
  const sisip = posisi + 1 + simpul.tag.length;
  return `${svg.slice(0, sisip)} ${nama}="${nilai}"${svg.slice(sisip)}`;
}

/** Offset `<` sebuah simpul menurut urutan kemunculannya. */
function posisiTag(svg: string, indeks: number): number | null {
  let i = 0;
  let ke = 0;
  while (i < svg.length) {
    const buka = svg.indexOf("<", i);
    if (buka === -1) return null;
    if (svg.startsWith("<!--", buka)) {
      const tutup = svg.indexOf("-->", buka + 4);
      if (tutup === -1) return null;
      i = tutup + 3;
      continue;
    }
    if (svg.startsWith("<?", buka) || svg.startsWith("<!", buka) || svg[buka + 1] === "/") {
      const tutup = svg.indexOf(">", buka);
      if (tutup === -1) return null;
      i = tutup + 1;
      continue;
    }
    if (ke === indeks) return buka;
    ke++;
    const tag = uraiTagBeroffset(svg, buka);
    if (!tag) return null;
    i = tag.akhir;
  }
  return null;
}

/** Menghapus sebuah simpul beserta tag penutupnya bila ada. */
export function hapusSimpul(svg: string, simpul: SimpulSvg): string {
  const buka = posisiTag(svg, simpul.indeks);
  if (buka === null) return svg;

  const tag = uraiTagBeroffset(svg, buka);
  if (!tag) return svg;

  if (tag.tunggal) return svg.slice(0, buka) + svg.slice(tag.akhir);

  const penutup = svg.indexOf(`</${simpul.tag}`, tag.akhir);
  if (penutup === -1) return svg;
  const akhirPenutup = svg.indexOf(">", penutup);
  if (akhirPenutup === -1) return svg;

  return svg.slice(0, buka) + svg.slice(akhirPenutup + 1);
}
