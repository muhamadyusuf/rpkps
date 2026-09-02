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
