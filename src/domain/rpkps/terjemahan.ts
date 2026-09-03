/**
 * Kelengkapan terjemahan sebuah RPKPS.
 *
 * Murni: menghitung berapa medan berisi yang sudah punya pasangan berbahasa
 * Inggris. Angka ini TIDAK pernah memblokir apa pun — terjemahan bersifat
 * opsional, dan menjadikannya syarat pengajuan berarti menahan dokumen yang
 * sepenuhnya sah karena sebuah fitur tambahan (docs/11 §5.6).
 *
 * Yang dihitung hanya medan yang ADA ISINYA di bahasa Indonesia: topik kosong
 * bukan pekerjaan terjemahan yang tertinggal, ia memang tidak ada.
 */

export interface PasanganTeks {
  asal: string | null | undefined;
  terjemahan: string | null | undefined;
}

export interface KelengkapanTerjemahan {
  /** Medan berisi yang punya pasangan Inggris. */
  terisi: number;
  /** Medan berisi seluruhnya — penyebutnya. */
  total: number;
  persen: number;
  /** Terjemahan sudah dimulai tetapi belum selesai. */
  sebagian: boolean;
}

const berisi = (v: string | null | undefined) => (v ?? "").trim().length > 0;

export function hitungKelengkapan(
  pasangan: readonly PasanganTeks[],
): KelengkapanTerjemahan {
  const perlu = pasangan.filter((p) => berisi(p.asal));
  const total = perlu.length;
  const terisi = perlu.filter((p) => berisi(p.terjemahan)).length;
  const persen = total === 0 ? 0 : Math.round((terisi / total) * 100);
  return { terisi, total, persen, sebagian: terisi > 0 && terisi < total };
}

/**
 * Satu medan teks yang dapat diterjemahkan, beserta ALAMATNYA.
 *
 * Alamat berbentuk `tabel:id:kolom` — mis. `pertemuan:ckq…:topikEn`. Ia harus
 * cukup untuk menulis hasilnya kembali tanpa menebak, dan cukup stabil untuk
 * bertahan selama dosen meninjau draf di layar. Id baris memenuhi keduanya;
 * urutan tidak, karena menyisipkan satu pertemuan menggeser seluruh sisanya.
 */
export interface MedanTerjemahan {
  alamat: string;
  /** Nama medan untuk ditampilkan saat meninjau, mis. "Minggu 3 · Topik". */
  label: string;
  asal: string;
  terjemahan: string | null;
}

/**
 * Pemisah indeks pada alamat medan LARIK — `pertemuan:<id>:subtopikEn#2`.
 *
 * `subtopik` dan `rincian` adalah `String[]`, jadi id baris saja belum cukup
 * untuk menunjuk satu teks. Indeksnya ikut ke alamat, dan penulisannya
 * menyusun ulang SELURUH larik dari larik yang sekarang (lihat
 * `terjemahan-tulis.ts`) — bukan menulis satu elemen di tempat, yang pada
 * Postgres akan meninggalkan lubang NULL di tengah larik.
 *
 * Tanpa ini kedua medan itu tidak pernah dapat diterjemahkan, sementara
 * `hitungKelengkapan` tetap menghitungnya — dan angka kelengkapan mentok di
 * bawah 100% tanpa ada yang dapat memperbaikinya (docs/11 §8.2).
 */
const PEMISAH_INDEKS = "#";

export interface AlamatMedan {
  model: string;
  id: string;
  medan: string;
  /** Null untuk kolom biasa; indeks elemen untuk kolom larik. */
  indeks: number | null;
}

/** Menyusun alamat medan. Satu-satunya tempat bentuknya ditulis. */
export function susunAlamat(
  model: string,
  id: string,
  medan: string,
  indeks?: number | null,
): string {
  const ekor = indeks == null ? "" : `${PEMISAH_INDEKS}${indeks}`;
  return `${model}:${id}:${medan}${ekor}`;
}

/**
 * Menguraikan alamat. Mengembalikan null bila bentuknya tidak dikenali —
 * alamat datang dari peramban, jadi yang tidak terurai dibuang, bukan ditebak.
 */
export function uraiAlamat(alamat: string): AlamatMedan | null {
  const [model, id, ekor, ...sisa] = alamat.split(":");
  if (!model || !id || !ekor || sisa.length > 0) return null;

  const pisah = ekor.indexOf(PEMISAH_INDEKS);
  if (pisah < 0) return { model, id, medan: ekor, indeks: null };

  const medan = ekor.slice(0, pisah);
  const angka = ekor.slice(pisah + 1);
  if (!medan || !/^\d+$/.test(angka)) return null;
  return { model, id, medan, indeks: Number(angka) };
}

/**
 * Medan yang diminta tetapi tidak dijawab model.
 *
 * Dipakai untuk RONDE ULANG: sebuah model yang menerima tiga ratus medan
 * sekaligus akan menjatuhkan sebagian tanpa memberi tanda apa pun — jawabannya
 * sah menurut skema, hanya lebih pendek. Yang tidak terjawab dikirim ulang,
 * bukan didiamkan (docs/11 §8.3).
 */
export function medanKurang(
  diminta: readonly MedanTerjemahan[],
  diterima: ReadonlySet<string>,
): MedanTerjemahan[] {
  return diminta.filter((m) => !diterima.has(m.alamat));
}

/** Medan yang belum punya terjemahan. Inilah yang dikirim ke model. */
export function medanBelumDiterjemahkan(
  medan: readonly MedanTerjemahan[],
): MedanTerjemahan[] {
  return medan.filter(
    (m) => m.asal.trim().length > 0 && (m.terjemahan ?? "").trim().length === 0,
  );
}

/**
 * Menyaring hasil model terhadap medan yang benar-benar diminta.
 *
 * Model boleh saja mengembalikan alamat yang tidak pernah dikirim — entah
 * karena mengarang, entah karena dosen menyunting dokumennya di tab lain
 * selama permintaan berjalan. Menuliskannya begitu saja berarti menulis ke
 * baris yang tidak dimaksudkan siapa pun.
 */
export function saringHasilTerjemahan(
  diminta: readonly MedanTerjemahan[],
  hasil: readonly { alamat: string; teks: string }[],
): { diterima: { alamat: string; teks: string }[]; ditolak: string[] } {
  const sah = new Map(diminta.map((m) => [m.alamat, m]));
  const diterima: { alamat: string; teks: string }[] = [];
  const ditolak: string[] = [];
  const terpakai = new Set<string>();

  for (const h of hasil) {
    const teks = h.teks.trim();
    if (!sah.has(h.alamat) || terpakai.has(h.alamat) || teks.length === 0) {
      ditolak.push(h.alamat);
      continue;
    }
    terpakai.add(h.alamat);
    diterima.push({ alamat: h.alamat, teks });
  }
  return { diterima, ditolak };
}
