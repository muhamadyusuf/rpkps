/**
 * Lokasi dari alamat IP — dua sumber, keduanya PERKIRAAN tingkat kota.
 *
 * IP bukan GPS. Ketelitiannya kota, kadang hanya provinsi, dan untuk jaringan
 * seluler atau VPN yang ditunjuk adalah lokasi gerbang penyedia, bukan orangnya.
 * Karena itu tampilan admin wajib menyebut "perkiraan", dan koordinatnya tidak
 * pernah disajikan seolah titik rumah seseorang.
 */

export type LokasiIp = {
  negara: string | null;
  kodeNegara: string | null;
  wilayah: string | null;
  kota: string | null;
  lintang: number | null;
  bujur: number | null;
  zonaWaktu: string | null;
  penyedia: string | null;
  asn: string | null;
  sumber: "VERCEL" | "IPWHO";
};

function angka(nilai: unknown): number | null {
  const n = typeof nilai === "string" ? Number(nilai) : nilai;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function teks(nilai: unknown, maks = 120): string | null {
  return typeof nilai === "string" && nilai.trim() ? nilai.trim().slice(0, maks) : null;
}

function jepitKoordinat(lintang: number | null, bujur: number | null) {
  const sah =
    lintang !== null && bujur !== null && Math.abs(lintang) <= 90 && Math.abs(bujur) <= 180;
  return sah ? { lintang, bujur } : { lintang: null, bujur: null };
}

/**
 * Kepala geolokasi yang dipasang Vercel. Gratis dan tanpa panggilan keluar,
 * jadi dicoba lebih dulu. Nama kota datang dalam bentuk URL-encoded.
 */
export function lokasiDariKepala(kepala: { get(nama: string): string | null }): LokasiIp | null {
  const kode = teks(kepala.get("x-vercel-ip-country"), 2);
  if (!kode) return null;

  let kota: string | null = null;
  const mentah = kepala.get("x-vercel-ip-city");
  if (mentah) {
    try {
      kota = teks(decodeURIComponent(mentah));
    } catch {
      kota = teks(mentah);
    }
  }
  const { lintang, bujur } = jepitKoordinat(
    angka(kepala.get("x-vercel-ip-latitude")),
    angka(kepala.get("x-vercel-ip-longitude")),
  );

  return {
    negara: null,
    kodeNegara: kode.toUpperCase(),
    wilayah: teks(kepala.get("x-vercel-ip-country-region")),
    kota,
    lintang,
    bujur,
    zonaWaktu: teks(kepala.get("x-vercel-ip-timezone")),
    penyedia: null,
    asn: null,
    sumber: "VERCEL",
  };
}

/** Menafsirkan jawaban ipwho.is. Jawaban gagal, atau bentuk tak dikenal, menjadi `null`. */
export function tafsirIpwho(badan: unknown): LokasiIp | null {
  if (!badan || typeof badan !== "object") return null;
  const b = badan as Record<string, unknown>;
  if (b.success !== true) return null;

  const koneksi =
    b.connection && typeof b.connection === "object"
      ? (b.connection as Record<string, unknown>)
      : {};
  const zona =
    b.timezone && typeof b.timezone === "object"
      ? (b.timezone as Record<string, unknown>)
      : {};
  const asn = angka(koneksi.asn);
  const { lintang, bujur } = jepitKoordinat(angka(b.latitude), angka(b.longitude));

  return {
    negara: teks(b.country),
    kodeNegara: teks(b.country_code, 2)?.toUpperCase() ?? null,
    wilayah: teks(b.region),
    kota: teks(b.city),
    lintang,
    bujur,
    zonaWaktu: teks(zona.id),
    penyedia: teks(koneksi.isp) ?? teks(koneksi.org),
    asn: asn === null ? null : `AS${asn}`,
    sumber: "IPWHO",
  };
}

/** Tautan peta untuk koordinat perkiraan; `null` bila koordinatnya tidak ada. */
export function tautanPeta(lintang: number | null, bujur: number | null): string | null {
  if (lintang === null || bujur === null) return null;
  return `https://www.openstreetmap.org/?mlat=${lintang}&mlon=${bujur}#map=10/${lintang}/${bujur}`;
}
