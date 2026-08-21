import { proyeksiIsi, type SumberProyeksi } from "./proyeksi";

/**
 * Bentuk RPKPS yang boleh dilihat siapa pun, tanpa login.
 *
 * Dibangun DI ATAS `proyeksiIsi`, bukan dengan menyaring field satu per satu.
 * Proyeksi itu sudah dirancang hanya memuat hal yang TERCETAK — tanpa id,
 * tanpa cap waktu, tanpa email, tanpa `penggunaId` — karena kalau tidak,
 * sidik dokumen berubah setiap kali sebuah baris disentuh.
 *
 * Konsekuensinya menguntungkan di sini: kebocoran data jadi mustahil secara
 * struktural. Apa pun yang tidak lolos ke proyeksi tidak akan pernah sampai ke
 * halaman publik, termasuk field baru yang ditambahkan ke skema nanti — field
 * itu harus ditulis eksplisit di `proyeksiIsi` sebelum bisa tampil.
 *
 * Satu-satunya yang DIBUANG dari proyeksi adalah kisi-kisi ujian: sebaran butir
 * soal per Sub-CPMK dan level Bloom adalah bahan penyusunan ujian, bukan
 * informasi yang perlu dibaca calon mahasiswa. Ia tetap tercetak di DOCX resmi
 * yang ditandatangani.
 */
export type DokumenPublik = Omit<ReturnType<typeof proyeksiIsi>, "kisiKisi">;

export function dokumenPublik(r: SumberProyeksi): DokumenPublik {
  const { kisiKisi: _kisiKisi, ...sisa } = proyeksiIsi(r);
  return sisa;
}

/**
 * Sub-CPMK dari seluruh CPMK, diratakan dan diindeks per kode.
 *
 * Tabel mingguan hanya menyimpan KODE Sub-CPMK (mis. "Sub-CPMK-3"); rumusannya
 * ada di bagian B. Peta ini yang menyambung keduanya sehingga pembaca tidak
 * perlu bolak-balik ke atas halaman.
 */
export function petaSubCpmk(
  dok: Pick<DokumenPublik, "cpmk">,
): Map<string, { kode: string; rumusan: string; levelBloom: string | null }> {
  return new Map(
    dok.cpmk.flatMap((c) => c.subCpmk.map((s) => [s.kode, s] as const)),
  );
}

/** Pustaka dikelompokkan per jenis, urutan nomor dipertahankan. */
export function pustakaPerJenis(dok: Pick<DokumenPublik, "pustaka">) {
  const kelompok = new Map<string, DokumenPublik["pustaka"]>();
  for (const p of dok.pustaka) {
    const daftar = kelompok.get(p.jenis);
    if (daftar) daftar.push(p);
    else kelompok.set(p.jenis, [p]);
  }
  return [...kelompok.entries()];
}

/** "3 sks (2T+1P)" — dipakai di kartu katalog maupun kepala dokumen. */
export function ringkasSks(mk: { sksTeori: number; sksPraktik: number }): string {
  const total = mk.sksTeori + mk.sksPraktik;
  if (mk.sksPraktik === 0) return `${total} sks`;
  return `${total} sks (${mk.sksTeori}T+${mk.sksPraktik}P)`;
}

/** "2025/2026-GENAP" → "2025/2026 Genap". */
export function labelTahunAkademik(kode: string): string {
  const [tahun, semester] = kode.split("-");
  if (!semester) return kode;
  return `${tahun} ${semester.charAt(0).toUpperCase()}${semester.slice(1).toLowerCase()}`;
}
