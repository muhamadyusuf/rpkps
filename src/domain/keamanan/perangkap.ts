import { createHash } from "node:crypto";

/**
 * Perangkap — alamat umpan yang TIDAK PERNAH dikunjungi pengguna sah (docs/22).
 *
 * Aplikasi ini tidak memiliki satu pun alamat `.php`, `/wp-admin`, `/.env`,
 * maupun `/phpmyadmin`. Karena itu siapa pun yang membukanya sedang
 * memindai, bukan bekerja — dan itulah yang membuat sinyalnya bersih: tidak
 * ada positif palsu yang harus disaring dari orang yang salah ketik.
 *
 * Alamat dicocokkan di sini, murni. Pencatatannya tidak: proxy hanya
 * mengalihkan, dan penulisan ke basis data terjadi di rute umpan.
 */

export type JenisUmpan =
  | "WORDPRESS"
  | "PANEL_ADMIN"
  | "ADMIN_DATABASE"
  | "BERKAS_RAHASIA"
  | "BERKAS_CADANGAN"
  | "SKRIP_ASING"
  | "INFRASTRUKTUR";

export const SEMUA_JENIS_UMPAN: readonly JenisUmpan[] = [
  "WORDPRESS",
  "PANEL_ADMIN",
  "ADMIN_DATABASE",
  "BERKAS_RAHASIA",
  "BERKAS_CADANGAN",
  "SKRIP_ASING",
  "INFRASTRUKTUR",
];

type Aturan = { jenis: JenisUmpan; pola: RegExp };

/**
 * Urutannya penting: yang pertama cocok menang, jadi yang paling spesifik di
 * atas. Semua pola dicocokkan terhadap alamat huruf kecil TANPA awalan bahasa.
 */
const ATURAN: readonly Aturan[] = [
  { jenis: "WORDPRESS", pola: /^\/(wp-(login|admin|content|includes|json|cron|config)|xmlrpc\.php|wordpress)(\/|\.|$)/ },
  { jenis: "ADMIN_DATABASE", pola: /^\/(phpmyadmin|pma|myadmin|mysql|adminer|dbadmin|sqladmin)(\/|\.|$)/ },
  { jenis: "BERKAS_RAHASIA", pola: /(^|\/)\.(env|git|svn|hg|aws|ssh|htaccess|htpasswd|npmrc|docker|kube)(\/|\.|$)/ },
  { jenis: "BERKAS_RAHASIA", pola: /(^|\/)(id_rsa|id_ed25519|credentials\.json|secrets?\.(json|ya?ml)|firebase-adminsdk[^/]*\.json|serviceaccount[^/]*\.json)$/ },
  { jenis: "BERKAS_CADANGAN", pola: /\.(sql|bak|old|orig|swp|dump|tar|tgz|gz|zip|rar|7z)$/ },
  { jenis: "BERKAS_CADANGAN", pola: /^\/(backup|backups|dump|db|database)(\/|\.|$)/ },
  { jenis: "PANEL_ADMIN", pola: /^\/(admin|administrator|adminpanel|admin-panel|cpanel|manager|webadmin|siteadmin|backend|login|signin)(\/|\.|$)/ },
  { jenis: "PANEL_ADMIN", pola: /^\/api\/(admin|v\d+\/admin|debug|internal|private)(\/|$)/ },
  { jenis: "INFRASTRUKTUR", pola: /^\/(server-status|server-info|actuator|jenkins|solr|console|cgi-bin|boaform|hnap1|vendor|telescope|_profiler|_debug|debug|phpinfo)(\/|\.|$)/ },
  // Skrip milik pustaka yang tidak kita pakai. Aplikasi ini murni Next.js.
  { jenis: "SKRIP_ASING", pola: /\.(php\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|cfm)$/ },
];

/**
 * Jenis umpan untuk sebuah alamat, atau `null` bila alamat itu sah.
 *
 * `tanpaBahasa` sudah dilepas awalan `/id` atau `/en`-nya. Alamat dinormalkan
 * lebih dulu — huruf kecil, `//` dilipat, `%2e` diurai — karena pemindai justru
 * memakai bentuk yang aneh supaya lolos dari pencocokan naif.
 */
export function jenisUmpan(tanpaBahasa: string): JenisUmpan | null {
  const alamat = normalkanJalur(tanpaBahasa);
  for (const { jenis, pola } of ATURAN) {
    if (pola.test(alamat)) return jenis;
  }
  return null;
}

export function normalkanJalur(jalur: string): string {
  let hasil = jalur;
  try {
    hasil = decodeURIComponent(jalur);
  } catch {
    // Urai-persen yang rusak adalah ciri pemindai; pakai apa adanya.
  }
  return hasil.toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

/** Alamat yang menampilkan formulir masuk palsu: yang dicari adalah kredensial. */
export function adalahUmpanMasuk(jenis: JenisUmpan, tanpaBahasa: string): boolean {
  if (jenis === "ADMIN_DATABASE") return true;
  if (jenis === "WORDPRESS") return /wp-login|wp-admin/.test(normalkanJalur(tanpaBahasa));
  if (jenis === "PANEL_ADMIN") return true;
  return false;
}

// ── Ringkasan kiriman ────────────────────────────────────────────────────────

const KOLOM_PENGGUNA = /^(log|user|username|usr|uname|email|login|uid|userid|user_login|admin|akun)$/i;
const KOLOM_RAHASIA = /pass|pwd|sandi|secret|token|kunci|otp|pin$/i;
const MAKS_CUPLIKAN = 1000;

export type RingkasanKiriman = {
  /** Nama kolom yang dikirim, untuk mengenali perkakas pemindainya. */
  kolom: string[];
  /** Nama pengguna yang dicoba — ini milik penyerang, bukan pengguna kita. */
  pengguna?: string;
  /** Hanya PANJANG sandi. Sandinya sendiri tidak pernah disimpan. */
  panjangSandi?: number;
  /** Badan yang tidak berbentuk kolom, dipotong. Tanpa kolom rahasia. */
  cuplikan?: string;
};

function tafsirKolom(jenisIsi: string, teks: string): Record<string, unknown> | null {
  const tipe = jenisIsi.toLowerCase();
  try {
    if (tipe.includes("application/json")) {
      const nilai: unknown = JSON.parse(teks);
      return nilai && typeof nilai === "object" && !Array.isArray(nilai)
        ? (nilai as Record<string, unknown>)
        : null;
    }
    if (tipe.includes("application/x-www-form-urlencoded")) {
      return Object.fromEntries(new URLSearchParams(teks));
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Meringkas badan kiriman TANPA menyimpan rahasianya.
 *
 * Penyerang yang menebak sandi mengirim sandi tebakan, dan sandi tebakan
 * sering kali adalah sandi sungguhan milik orang lain yang bocor dari tempat
 * lain. Menyimpannya membuat basis data ini menjadi kumpulan kredensial curian
 * — dan cadangannya hidup selamanya. Panjangnya cukup untuk membedakan
 * tebakan acak dari isian otomatis.
 */
export function ringkasKiriman(jenisIsi: string, teks: string): RingkasanKiriman | null {
  if (!teks) return null;
  const kolom = tafsirKolom(jenisIsi, teks);

  if (!kolom) {
    // Bentuk tak dikenal: cuplikan mentah bisa memuat kredensial di sembarang
    // posisi, jadi dibuang bila ada kata rahasia — payload eksploit tidak
    // memuatnya dan tetap berharga sebagai bukti.
    if (KOLOM_RAHASIA.test(teks)) return { kolom: [], cuplikan: "[disamarkan: memuat kolom rahasia]" };
    return { kolom: [], cuplikan: teks.slice(0, MAKS_CUPLIKAN) };
  }

  const hasil: RingkasanKiriman = { kolom: Object.keys(kolom).slice(0, 30) };
  for (const [nama, nilai] of Object.entries(kolom)) {
    const teksNilai = typeof nilai === "string" ? nilai : String(nilai ?? "");
    if (KOLOM_RAHASIA.test(nama)) {
      hasil.panjangSandi = Math.max(hasil.panjangSandi ?? 0, teksNilai.length);
    } else if (KOLOM_PENGGUNA.test(nama) && hasil.pengguna === undefined) {
      hasil.pengguna = teksNilai.slice(0, 120);
    }
  }
  return hasil;
}

// ── Sidik perangkat ─────────────────────────────────────────────────────────

/**
 * Sidik kasar peramban/perkakas: sama untuk pelaku yang sama walau IP-nya
 * berganti. Bukan bukti identitas — dua orang dengan peramban yang sama
 * berbagi sidik — tetapi cukup untuk mengelompokkan serangan yang berpindah
 * IP lewat proksi. Empat belas heksa saja: ini pengelompok, bukan kunci.
 */
export function sidikPerangkat(kepala: {
  get(nama: string): string | null;
}): string {
  const bahan = [
    "user-agent",
    "accept-language",
    "accept-encoding",
    "accept",
    "sec-ch-ua",
    "sec-ch-ua-platform",
    "sec-ch-ua-mobile",
  ]
    .map((n) => kepala.get(n) ?? "")
    .join("|");
  return createHash("sha256").update(bahan).digest("hex").slice(0, 14);
}

/** Kepala yang layak disimpan sebagai bukti. Cookie dan Authorization TIDAK termasuk. */
export const KEPALA_BUKTI = [
  "user-agent",
  "accept",
  "accept-language",
  "accept-encoding",
  "referer",
  "origin",
  "host",
  "content-type",
  "content-length",
  "sec-ch-ua",
  "sec-ch-ua-platform",
  "sec-ch-ua-mobile",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "x-forwarded-for",
  "x-forwarded-proto",
  "via",
  "dnt",
] as const;

export function kumpulkanKepala(kepala: { get(nama: string): string | null }): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const nama of KEPALA_BUKTI) {
    const nilai = kepala.get(nama);
    if (nilai) hasil[nama] = nilai.slice(0, 400);
  }
  return hasil;
}
