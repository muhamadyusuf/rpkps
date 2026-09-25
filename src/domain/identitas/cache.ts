/**
 * Cache memori berbatas untuk profil pegawai yang dibaca dari identitas-itts
 * (docs/26 §4) — murni: jam disuntikkan, tak ada jaringan, sehingga kebijakannya
 * dapat diuji.
 *
 * Tiga umur, dua batas:
 *   - SEGAR   (≤ ttlMs)        dipakai tanpa bertanya ke identitas-itts.
 *   - BASI    (ttlMs..+basiMs) dipakai HANYA bila identitas-itts tak terjangkau.
 *   - MATI    (lebih tua)      dibuang; tak ada yang boleh menebak dari data setua itu.
 *   - `maks`  entri; yang tertua (paling lama tak dipakai) dibuang lebih dulu.
 *
 * Cache ini per-proses (per instans serverless): dingin pada instans baru. Itu
 * disengaja — data pegawai tidak dipersistenkan di RPKPS, bahkan sementara.
 */

export type OpsiCache = {
  ttlMs: number;
  basiMs: number;
  maks: number;
  sekarang?: () => number;
};

export type HasilCache<T> = { nilai: T; segar: boolean };

export type Cache<T> = {
  ambil(kunci: string): HasilCache<T> | null;
  simpan(kunci: string, nilai: T): void;
  hapus(kunci: string): void;
  kosongkan(): void;
  ukuran(): number;
};

export function buatCache<T>(opsi: OpsiCache): Cache<T> {
  const sekarang = opsi.sekarang ?? Date.now;
  // Map menjaga urutan penyisipan: entri pertama = paling lama tak dipakai.
  const isi = new Map<string, { nilai: T; pada: number }>();

  return {
    ambil(kunci) {
      const e = isi.get(kunci);
      if (!e) return null;
      const umur = sekarang() - e.pada;
      if (umur > opsi.ttlMs + opsi.basiMs) {
        isi.delete(kunci);
        return null;
      }
      // Dipakai → pindah ke ujung "terbaru dipakai" tanpa mengubah umur datanya.
      isi.delete(kunci);
      isi.set(kunci, e);
      return { nilai: e.nilai, segar: umur <= opsi.ttlMs };
    },
    simpan(kunci, nilai) {
      isi.delete(kunci);
      isi.set(kunci, { nilai, pada: sekarang() });
      while (isi.size > opsi.maks) {
        const tertua = isi.keys().next().value;
        if (tertua === undefined) break;
        isi.delete(tertua);
      }
    },
    hapus: (kunci) => void isi.delete(kunci),
    kosongkan: () => isi.clear(),
    ukuran: () => isi.size,
  };
}
