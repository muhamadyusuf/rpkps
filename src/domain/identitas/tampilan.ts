import type { ProfilPegawai } from "./kontrak";

/**
 * Bagaimana seseorang TAMPIL di RPKPS (docs/26) — dari mana pun datanya.
 *
 * Halaman, kop dokumen, dan daftar pengampu bertanya "siapa orang ini" lewat
 * bentuk ini; mereka tidak perlu tahu apakah jawabannya datang dari
 * identitas-itts (pegawai), dari profil lokal (asesor/mahasiswa), atau tak
 * tersedia sama sekali.
 */
export type Tampilan = {
  /** Nama saja, tanpa gelar — untuk pengurutan dan inisial. Sama dengan kolom `nama` lama. */
  nama: string;
  /** Gelar dipisah supaya kode lama yang menerima {nama, gelarDepan, gelarBelakang} tak perlu berubah bentuk. */
  gelarDepan: string | null;
  gelarBelakang: string | null;
  /** Nama dengan gelar, untuk dicetak: "Dr. Siti Aminah, M.Kom.". */
  namaLengkap: string;
  nidn: string | null;
  nip: string | null;
  /**
   * IDENTITAS = segar/basi dari identitas-itts; LOKAL = profil lokal;
   * TAK_DIKETAHUI = pegawai yang datanya tak dapat dibaca saat ini (nama
   * darurat dari surel). Operasi HUKUM (tanda tangan, pengesahan, terbit)
   * wajib menolak TAK_DIKETAHUI.
   */
  sumber: "IDENTITAS" | "LOKAL" | "TAK_DIKETAHUI";
};

/**
 * Nama dengan gelar, dalam penulisan identitas-itts (`namaBergelar`): "Dr. Siti Aminah, M.Kom.".
 * Satu bentuk untuk seluruh RPKPS (`namaLengkapPengampu` mendelegasikan ke sini). Gelar belakang
 * yang dulu tersimpan dengan koma di depan (", M.Kom.") tidak diberi koma kedua.
 */
export function gabungNama(p: { nama: string; gelarDepan: string | null; gelarBelakang: string | null }): string {
  const depan = p.gelarDepan?.trim();
  const belakang = p.gelarBelakang?.trim().replace(/^,\s*/, "");
  return `${depan ? `${depan} ` : ""}${p.nama}${belakang ? `, ${belakang}` : ""}`;
}

export function tampilanDariProfil(p: ProfilPegawai): Tampilan {
  return {
    nama: p.namaLengkap,
    gelarDepan: p.gelarDepan,
    gelarBelakang: p.gelarBelakang,
    namaLengkap: gabungNama({ nama: p.namaLengkap, gelarDepan: p.gelarDepan, gelarBelakang: p.gelarBelakang }),
    nidn: p.nidn,
    nip: p.nip,
    sumber: "IDENTITAS",
  };
}

/** Pengguna LOKAL (bukan pegawai): hanya nama. Tak ada gelar, NIDN, atau NIP untuk dikarang. */
export function tampilanLokal(nama: string): Tampilan {
  return { nama, gelarDepan: null, gelarBelakang: null, namaLengkap: nama, nidn: null, nip: null, sumber: "LOKAL" };
}

/**
 * Pegawai yang datanya tak terbaca (identitas-itts padam DAN tak ada cache).
 * Nama darurat dari bagian depan surel — cukup untuk tampilan, TIDAK cukup untuk dokumen.
 */
export function tampilanTakDiketahui(email: string): Tampilan {
  const nama = email.split("@")[0] || email;
  return { nama, gelarDepan: null, gelarBelakang: null, namaLengkap: nama, nidn: null, nip: null, sumber: "TAK_DIKETAHUI" };
}

/**
 * Menyusun tampilan sejumlah pengguna dari baris RPKPS + profil yang dibaca dari
 * identitas-itts. Murni — tak ada jaringan, sehingga aturannya dapat diuji:
 *
 *   - tak bertaut (`identitasAkunId` null)      → LOKAL: hanya `nama`;
 *   - bertaut dan profilnya terbaca              → IDENTITAS;
 *   - bertaut tetapi TIDAK terbaca (padam) atau bukan pegawai lagi → TAK_DIKETAHUI,
 *     bernama darurat dari surel. Nama lokal di kolom `nama` SENGAJA tidak dipakai
 *     sebagai cadangan: untuk pegawai itu kolom lama yang akan dibuang (docs/26 §7),
 *     dan menampilkannya diam-diam membuat data yang sudah usang tampak sah.
 */
export function susunTampilan(
  pengguna: readonly { id: string; email: string; nama: string; identitasAkunId: string | null }[],
  profil: ReadonlyMap<string, ProfilPegawai>,
): Map<string, Tampilan> {
  const hasil = new Map<string, Tampilan>();
  for (const p of pengguna) {
    if (p.identitasAkunId === null) {
      hasil.set(p.id, tampilanLokal(p.nama));
      continue;
    }
    const pr = profil.get(p.identitasAkunId);
    hasil.set(p.id, pr ? tampilanDariProfil(pr) : tampilanTakDiketahui(p.email));
  }
  return hasil;
}

/**
 * Kolom `Pengguna` yang BOLEH dibaca siapa pun untuk menampilkan seseorang: kunci ke
 * identitas-itts plus `nama` — yang hanya bermakna bagi pengguna LOKAL. Pakai ini di
 * `select` alih-alih menulis `nama/gelarDepan/nidn/...` (kolom pribadi itu akan dibuang;
 * `uji/periksa-tanpa-data-pegawai.mts` menjaganya).
 */
export const PILIH_RUJUKAN_PENGGUNA = { id: true, email: true, nama: true, identitasAkunId: true } as const;

export type RujukanPengguna = { id: string; email: string; nama: string; identitasAkunId: string | null };

/**
 * Bentuk yang selama ini dipakai domain RPKPS untuk seorang pengguna:
 * `{nama, gelarDepan, gelarBelakang, nidn, nip}` (mis. `namaLengkapPengampu`, `keRpkpsInput`,
 * `proyeksiIsi`). Nilainya kini datang dari identitas-itts, bentuknya SAMA — sehingga domain
 * (dan sidik SHA-256 yang bergantung padanya) tak perlu diubah.
 */
export type DataPengguna = Pick<Tampilan, "nama" | "gelarDepan" | "gelarBelakang" | "nidn" | "nip">;

export function dataPengguna(t: Tampilan): DataPengguna {
  return { nama: t.nama, gelarDepan: t.gelarDepan, gelarBelakang: t.gelarBelakang, nidn: t.nidn, nip: t.nip };
}
