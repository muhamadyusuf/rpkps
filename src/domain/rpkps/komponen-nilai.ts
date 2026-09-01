/**
 * Menyusun rencana perubahan daftar komponen nilai tanpa kehilangan identitas
 * barisnya.
 *
 * Komponen nilai adalah buku besar bobot penilaian: `pertemuan` dan `tugas`
 * menunjuk ke sana lewat `komponen_nilai_id` yang ber-`onDelete: SetNull`.
 * Menyimpan daftar dengan cara menghapus semua lalu membuat ulang — cara yang
 * paling menggoda karena ringkas — memberi setiap komponen id baru, sehingga
 * SELURUH baris mingguan dan lembar tugas lepas dari komponennya secara diam.
 * Akibatnya `susunPetaAsesmen` melaporkan setiap asesmen "tidak masuk komponen
 * nilai mana pun" dan RPKPS yang tadinya sah menjadi tidak dapat diajukan,
 * padahal dosen hanya membetulkan satu angka.
 *
 * Karena itu perubahan daftar selalu berupa rencana: mana yang diperbarui,
 * mana yang benar-benar baru, dan mana yang memang dibuang.
 */

export type KomponenMasuk = {
  /** Id baris yang sedang disunting; null untuk baris yang baru ditambahkan. */
  id: string | null;
  nama: string;
  /**
   * Terjemahan tampilan. SENGAJA di luar pencocokan: baris dipasangkan lewat
   * `id` lalu `nama`, tidak pernah lewat `namaEn`. Menjadikannya bagian kunci
   * berarti menyunting terjemahan melepas seluruh tautan asesmen — persis
   * bencana yang berkas ini ada untuk mencegahnya (docs/11 §5.2).
   */
  namaEn: string | null;
  bobot: number;
};

export type KomponenAda = { id: string; nama: string };

export type BarisPerbarui = {
  id: string;
  nama: string;
  namaEn: string | null;
  bobot: number;
  urutan: number;
};
export type BarisTambah = { nama: string; namaEn: string | null; bobot: number; urutan: number };

export type RencanaKomponen = {
  perbarui: BarisPerbarui[];
  tambah: BarisTambah[];
  /** Id komponen yang hilang dari daftar — satu-satunya yang boleh dihapus. */
  hapus: string[];
  /**
   * Kunci kamus (`@…`) bila daftar masukan tidak sah; rencana lain diabaikan.
   * Kunci, bukan kalimat — domain tidak berbahasa (docs/11 §4.1).
   */
  galat: string | null;
};

/**
 * Baris tanpa nama dibuang diam-diam: itu baris kosong yang belum diisi, bukan
 * kesalahan. Nama berulang ditolak karena `@@unique([rpkpsId, nama])` menolak
 * juga, dan peta asesmen merujuk komponen lewat namanya.
 */
export function rencanakanKomponen(
  masuk: readonly KomponenMasuk[],
  ada: readonly KomponenAda[],
): RencanaKomponen {
  const kosong: RencanaKomponen = { perbarui: [], tambah: [], hapus: [], galat: null };

  const bersih = masuk
    .map((k) => ({
      id: k.id,
      nama: k.nama.trim(),
      namaEn: k.namaEn?.trim() || null,
      bobot: Number(k.bobot),
    }))
    .filter((k) => k.nama.length > 0 && Number.isFinite(k.bobot));

  const nama = bersih.map((k) => k.nama);
  if (new Set(nama).size !== nama.length) {
    return { ...kosong, galat: "@aksi.rpkps.komponenNamaBerulang" };
  }

  const idAda = new Set(ada.map((k) => k.id));
  const perNama = new Map(ada.map((k) => [k.nama, k.id]));

  const perbarui: BarisPerbarui[] = [];
  const tambah: BarisTambah[] = [];
  const terpakai = new Set<string>();

  bersih.forEach((k, urutan) => {
    // Pasangan lewat id lebih dulu: hanya id yang selamat dari penggantian nama.
    let id = k.id && idAda.has(k.id) && !terpakai.has(k.id) ? k.id : null;

    // Lalu lewat nama, supaya pemanggil yang tidak memegang id — penerapan draf
    // AI, impor — tetap memperbarui baris yang sama alih-alih membuatnya ulang.
    if (id === null) {
      const cocok = perNama.get(k.nama);
      if (cocok !== undefined && !terpakai.has(cocok)) id = cocok;
    }

    if (id === null) {
      tambah.push({ nama: k.nama, namaEn: k.namaEn, bobot: k.bobot, urutan });
      return;
    }
    terpakai.add(id);
    perbarui.push({ id, nama: k.nama, namaEn: k.namaEn, bobot: k.bobot, urutan });
  });

  return {
    perbarui,
    tambah,
    hapus: ada.map((k) => k.id).filter((id) => !terpakai.has(id)),
    galat: null,
  };
}

/**
 * Baris yang namanya berganti. Penggantian nama harus ditulis dua langkah —
 * nama sementara lebih dulu — supaya menukar nama dua komponen tidak menabrak
 * `@@unique([rpkpsId, nama])` di tengah transaksi.
 */
export function namaBerganti(
  perbarui: readonly BarisPerbarui[],
  ada: readonly KomponenAda[],
): BarisPerbarui[] {
  const lama = new Map(ada.map((k) => [k.id, k.nama]));
  return perbarui.filter((p) => lama.get(p.id) !== p.nama);
}
