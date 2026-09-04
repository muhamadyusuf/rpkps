import { daftarRingkas } from "@/domain/temuan";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Sanitasi SVG — docs/17 §5.1.
 *
 * SVG bukan format gambar yang polos. Ia dokumen XML yang dapat memuat
 * `<script>`, penangan `onload`, `<foreignObject>` berisi HTML, rujukan ke
 * alamat luar yang membocorkan siapa membuka dokumen, dan entitas eksternal
 * yang membaca berkas server. Berkas ini adalah lapis PERTAMA dari dua
 * (docs/17 I2); lapis keduanya adalah aturan bahwa gambar hanya dirender di
 * dalam `<img>`, tempat skrip tidak pernah dieksekusi.
 *
 * # Memeriksa, bukan membersihkan
 *
 * Modul ini MENOLAK, tidak menambal. SVG yang dibersihkan separuh menghasilkan
 * gambar yang salah — panah yang hilang, label yang lenyap — dan gambar yang
 * salah di buku ajar lebih buruk daripada tidak ada gambar. Karena itu
 * keluarannya adalah "lolos" atau "ditolak beserta alasannya", dan yang lolos
 * disimpan APA ADANYA. Tidak ada penulisan ulang, sehingga tidak ada celah
 * antara "yang diperiksa" dan "yang disimpan" — celah itulah yang membuat
 * sebagian besar sanitizer HTML dapat ditembus.
 *
 * # Daftar putih, bukan daftar hitam
 *
 * Yang tidak disebut di sini ditolak. Daftar hitam selalu ketinggalan satu
 * langkah dari orang yang mencarinya.
 *
 * Murni: tanpa DOM, tanpa Prisma, tanpa dependensi. Pengurainya ditulis
 * tangan justru karena itu — pengurai XML sungguhan menerima jauh lebih banyak
 * daripada yang kita inginkan.
 */

/** Elemen yang boleh muncul. `filter`, `image`, dan `style` sengaja TIDAK ada. */
const ELEMEN_BOLEH: ReadonlySet<string> = new Set([
  "svg",
  "g",
  "defs",
  "title",
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "marker",
  "symbol",
  "use",
  // Gradien LOLOS di sini karena ia bukan lubang keamanan — yang menolaknya
  // adalah cetakan gaya (`gaya-svg.ts`), dengan kalimat yang menyebut
  // alasannya. Memisahkan keduanya membuat pesan galatnya jujur: "berbahaya"
  // dan "tidak sesuai gaya buku" adalah dua hal yang berbeda.
  "lineargradient",
  "radialgradient",
  "stop",
]);

/**
 * Atribut yang boleh muncul, sebagai satu himpunan untuk seluruh elemen.
 *
 * Tidak dipecah per elemen dengan sengaja: yang menentukan keamanan bukan
 * "apakah `cx` sah pada `<rect>`" melainkan penangan peristiwa, rujukan luar,
 * dan `style`. Memecahnya per elemen menambah puluhan baris yang harus dijaga
 * tanpa menutup satu celah pun.
 */
const ATRIBUT_BOLEH: ReadonlySet<string> = new Set([
  // identitas dan tata letak
  "id", "class", "transform", "viewbox", "preserveaspectratio", "version",
  "xmlns", "xmlns:xlink",
  // geometri
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "d", "points", "dx", "dy",
  // marker
  "markerwidth", "markerheight", "refx", "refy", "orient", "markerunits",
  "marker-start", "marker-mid", "marker-end",
  // rupa
  "fill", "fill-rule", "fill-opacity",
  "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
  "opacity", "offset", "stop-color", "stop-opacity",
  // teks
  "font-family", "font-size", "font-weight", "font-style",
  "text-anchor", "dominant-baseline", "letter-spacing", "xml:space",
  // rujukan internal — nilainya diperiksa tersendiri
  "href", "xlink:href",
]);

/** Batas ukuran dan kerumitan; keduanya penjaga terhadap berkas yang meledak. */
const BATAS_AKSARA = 200_000;
const BATAS_ELEMEN = 3_000;
const BATAS_KEDALAMAN = 100;

/** Entitas XML yang dikenal. Selain ini ditolak — termasuk entitas karangan. */
const ENTITAS = /&(?:amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g;

export interface HasilSvgAman {
  ok: boolean;
  temuan: TemuanBahanAjar[];
  /** SVG apa adanya bila lolos — tidak pernah ditulis ulang. */
  svg: string | null;
}

export function periksaSvgAman(sumber: string): HasilSvgAman {
  const temuan: TemuanBahanAjar[] = [];
  const tolak = (kode: string, params?: TemuanBahanAjar["params"]) => {
    temuan.push({ kode, tingkat: "PEMBLOKIR", ...(params ? { params } : {}) });
  };

  /*
   * Ukuran diperiksa pada kiriman MENTAH, sebelum dirapikan. Berkas sepuluh
   * megabyte yang isinya spasi tetap sepuluh megabyte yang harus dibaca,
   * disalin, dan dikirim; menilainya setelah `trim()` berarti mengerjakan
   * seluruh pekerjaan itu lebih dulu, lalu menyatakannya kecil.
   */
  if (sumber.length > BATAS_AKSARA) {
    tolak("IL-SVG-TERLALU-BESAR", { n: BATAS_AKSARA });
    return { ok: false, temuan, svg: null };
  }

  const svg = sumber.trim();
  if (svg.length === 0) {
    tolak("IL-SVG-TERLALU-BESAR", { n: BATAS_AKSARA });
    return { ok: false, temuan, svg: null };
  }

  /*
   * DOCTYPE dan deklarasi entitas ditolak sebelum satu tag pun diurai. Inilah
   * jalur "billion laughs" (entitas yang memuat dirinya sendiri berlipat
   * ganda sampai memori habis) dan pembacaan berkas server lewat entitas
   * eksternal. Keduanya tidak punya kegunaan sah dalam sebuah diagram.
   */
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(svg)) {
    tolak("IL-SVG-DOCTYPE");
    return { ok: false, temuan, svg: null };
  }

  const elemenAsing = new Set<string>();
  const atributAsing = new Set<string>();
  const rujukanLuar = new Set<string>();
  let jumlahElemen = 0;
  let kedalaman = 0;
  let kedalamanMaks = 0;
  let akar: string | null = null;
  let akarPunyaViewBox = false;
  const tumpukan: string[] = [];

  let i = 0;
  while (i < svg.length) {
    const buka = svg.indexOf("<", i);
    if (buka === -1) {
      periksaTeks(svg.slice(i), tolak);
      break;
    }

    periksaTeks(svg.slice(i, buka), tolak);

    // Komentar: dilewati utuh. Isinya tidak pernah dirender.
    if (svg.startsWith("<!--", buka)) {
      const tutup = svg.indexOf("-->", buka + 4);
      if (tutup === -1) {
        tolak("IL-SVG-RUSAK");
        return { ok: false, temuan, svg: null };
      }
      i = tutup + 3;
      continue;
    }

    // `<![CDATA[`, `<!ANYTHING`: tidak ada gunanya pada diagram, dan CDATA
    // adalah tempat favorit menyembunyikan muatan.
    if (svg.startsWith("<!", buka)) {
      tolak("IL-SVG-DOCTYPE");
      return { ok: false, temuan, svg: null };
    }

    // Instruksi pemrosesan: hanya deklarasi XML di awal berkas.
    if (svg.startsWith("<?", buka)) {
      const tutup = svg.indexOf("?>", buka + 2);
      const deklarasiAwal = buka === 0 && /^<\?xml[\s?]/i.test(svg.slice(buka));
      if (tutup === -1 || !deklarasiAwal) {
        tolak("IL-SVG-INSTRUKSI");
        return { ok: false, temuan, svg: null };
      }
      i = tutup + 2;
      continue;
    }

    const tag = uraiTag(svg, buka);
    if (!tag) {
      tolak("IL-SVG-RUSAK");
      return { ok: false, temuan, svg: null };
    }
    i = tag.akhir;

    if (tag.penutup) {
      const dibuka = tumpukan.pop();
      if (dibuka !== tag.nama) {
        tolak("IL-SVG-RUSAK");
        return { ok: false, temuan, svg: null };
      }
      kedalaman--;
      continue;
    }

    jumlahElemen++;
    if (jumlahElemen > BATAS_ELEMEN) {
      tolak("IL-SVG-TERLALU-RUMIT", { n: BATAS_ELEMEN });
      return { ok: false, temuan, svg: null };
    }

    if (akar === null) {
      akar = tag.nama;
      akarPunyaViewBox = tag.atribut.some(([nama]) => nama === "viewbox");
    }

    if (!ELEMEN_BOLEH.has(tag.nama)) elemenAsing.add(tag.nama);

    for (const [nama, nilai] of tag.atribut) {
      /*
       * Penangan peristiwa diperiksa TERSENDIRI meski daftar putih sudah
       * menolaknya. Alasannya kejelasan pesan: "onclick tidak diizinkan"
       * memberi tahu penulis apa yang harus dibuang, sedangkan "atribut tidak
       * dikenal" membuatnya menebak.
       */
      if (nama.startsWith("on")) {
        atributAsing.add(nama);
        continue;
      }
      if (!ATRIBUT_BOLEH.has(nama)) {
        atributAsing.add(nama);
        continue;
      }
      if (nama === "href" || nama === "xlink:href") {
        // Hanya fragmen dalam berkas yang sama. Alamat luar membocorkan
        // siapa membuka dokumen, dan dapat berganti isi setelah disetujui.
        if (!nilai.trim().startsWith("#")) rujukanLuar.add(nilai.trim().slice(0, 60));
        continue;
      }
      const nilaiRingkas = nilai.replace(/\s+/g, "").toLowerCase();
      if (
        nilaiRingkas.includes("javascript:") ||
        nilaiRingkas.includes("data:") ||
        nilaiRingkas.includes("url(http") ||
        nilaiRingkas.includes("url(//") ||
        nilaiRingkas.includes("&#")
      ) {
        rujukanLuar.add(`${nama}=${nilai.trim().slice(0, 40)}`);
      }
      periksaTeks(nilai, tolak);
    }

    if (!tag.tunggal) {
      tumpukan.push(tag.nama);
      kedalaman++;
      kedalamanMaks = Math.max(kedalamanMaks, kedalaman);
      if (kedalamanMaks > BATAS_KEDALAMAN) {
        tolak("IL-SVG-TERLALU-RUMIT", { n: BATAS_ELEMEN });
        return { ok: false, temuan, svg: null };
      }
    }
  }

  if (tumpukan.length > 0) tolak("IL-SVG-RUSAK");
  if (akar !== "svg") tolak("IL-SVG-BUKAN-SVG");
  else if (!akarPunyaViewBox) tolak("IL-SVG-TANPA-VIEWBOX");

  if (elemenAsing.size > 0) {
    tolak("IL-SVG-ELEMEN-TERLARANG", {
      jumlah: elemenAsing.size,
      daftar: daftarRingkas([...elemenAsing].sort()),
    });
  }
  if (atributAsing.size > 0) {
    tolak("IL-SVG-ATRIBUT-TERLARANG", {
      jumlah: atributAsing.size,
      daftar: daftarRingkas([...atributAsing].sort()),
    });
  }
  if (rujukanLuar.size > 0) {
    tolak("IL-SVG-RUJUKAN-LUAR", {
      jumlah: rujukanLuar.size,
      daftar: daftarRingkas([...rujukanLuar].sort()),
    });
  }

  return temuan.length === 0
    ? { ok: true, temuan, svg }
    : { ok: false, temuan, svg: null };
}

/** Entitas karangan pada teks maupun nilai atribut. */
function periksaTeks(teks: string, tolak: (kode: string) => void) {
  if (!teks.includes("&")) return;
  const sisa = teks.replace(ENTITAS, "");
  if (sisa.includes("&")) tolak("IL-SVG-ENTITAS");
}

interface Tag {
  nama: string;
  penutup: boolean;
  tunggal: boolean;
  /** Pasangan [nama huruf kecil, nilai apa adanya]. */
  atribut: [string, string][];
  akhir: number;
}

/**
 * Mengurai satu tag mulai dari posisi `<`.
 *
 * Ditulis tangan karena `>` di dalam nilai atribut tidak boleh mengakhiri tag
 * — dan justru di situlah pemindai berbasis regex (`/<[^>]*>/`) dapat
 * dikelabui: satu `>` di dalam tanda kutip membuat sisa dokumen terbaca
 * sebagai teks biasa, sehingga elemen berbahaya sesudahnya tidak pernah
 * diperiksa.
 */
function uraiTag(s: string, mulai: number): Tag | null {
  let i = mulai + 1;
  const penutup = s[i] === "/";
  if (penutup) i++;

  const awalNama = i;
  while (i < s.length && /[A-Za-z0-9:_-]/.test(s[i])) i++;
  const nama = s.slice(awalNama, i).toLowerCase();
  if (nama === "") return null;

  const atribut: [string, string][] = [];

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;

    if (s[i] === ">") return { nama, penutup, tunggal: false, atribut, akhir: i + 1 };
    if (s[i] === "/" && s[i + 1] === ">") {
      return { nama, penutup, tunggal: true, atribut, akhir: i + 2 };
    }

    const awalAtr = i;
    while (i < s.length && !/[\s=/>]/.test(s[i])) i++;
    const namaAtr = s.slice(awalAtr, i).toLowerCase();
    if (namaAtr === "") return null;

    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "=") {
      // Atribut tanpa nilai. Sah dalam HTML, tidak berarti apa-apa dalam SVG,
      // dan tetap dicatat supaya daftar putih menilainya.
      atribut.push([namaAtr, ""]);
      continue;
    }
    i++;
    while (i < s.length && /\s/.test(s[i])) i++;

    const kutip = s[i];
    // Nilai tanpa tanda kutip ditolak: ia membuat batas atribut bergantung
    // pada spasi, dan itu sumber ketidaksepakatan antara pengurai kita dan
    // pengurai peramban.
    if (kutip !== '"' && kutip !== "'") return null;
    const tutup = s.indexOf(kutip, i + 1);
    if (tutup === -1) return null;
    atribut.push([namaAtr, s.slice(i + 1, tutup)]);
    i = tutup + 1;
  }

  return null;
}
