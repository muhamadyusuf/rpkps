/**
 * Kontrak jawaban API identitas-itts (identitas-itts docs/07) — sisi penerima.
 *
 * Jawaban jaringan adalah DATA TAK TEPERCAYA: tak ada `as` di sini. Setiap
 * pembaca memeriksa bentuknya dan mengembalikan `null` untuk yang cacat,
 * supaya satu baris rusak (atau penyedia yang keliru dikonfigurasi) tidak
 * menyusup jauh ke dalam keputusan wewenang.
 */

export type ProfilPegawai = {
  akunId: string;
  email: string;
  namaLengkap: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  nidn: string | null;
  nip: string | null;
  jenisPegawai: string;
  aktif: boolean;
  homebaseUnitId: string | null;
};

export type PeranDariIdentitas = {
  namaPeran: string;
  jabatan: { unit: { id: string; jenis: string } } | null;
};

/** Yang dibutuhkan untuk menurunkan peran seseorang. */
export type FaktaPegawai = {
  akunId: string;
  email: string;
  aktif: boolean;
  jenisPegawai: string;
  homebaseUnitId: string | null;
  peran: readonly PeranDariIdentitas[];
};

export type BarisDirektori = {
  akunId: string;
  email: string;
  jenisPegawai: string;
  aktif: boolean;
  homebaseUnitId: string | null;
};

type Objek = Record<string, unknown>;

const adalahObjek = (x: unknown): x is Objek => typeof x === "object" && x !== null && !Array.isArray(x);
const teks = (x: unknown): string | null => (typeof x === "string" && x.length > 0 && x.length <= 500 ? x : null);
const teksAtauNull = (x: unknown): string | null | undefined => (x === null ? null : teks(x) ?? undefined);

/** Satu profil dari `/api/v1/pegawai` atau `/cari`. */
export function uraiProfil(x: unknown): ProfilPegawai | null {
  if (!adalahObjek(x)) return null;
  const akunId = teks(x.akunId);
  const email = teks(x.email);
  const namaLengkap = teks(x.namaLengkap);
  const jenisPegawai = teks(x.jenisPegawai);
  const gelarDepan = teksAtauNull(x.gelarDepan);
  const gelarBelakang = teksAtauNull(x.gelarBelakang);
  const nidn = teksAtauNull(x.nidn);
  const nip = teksAtauNull(x.nip);
  if (!akunId || !email || !namaLengkap || !jenisPegawai) return null;
  if (typeof x.aktif !== "boolean") return null;
  if ([gelarDepan, gelarBelakang, nidn, nip].some((v) => v === undefined)) return null;

  let homebaseUnitId: string | null = null;
  if (x.homebase !== null && x.homebase !== undefined) {
    if (!adalahObjek(x.homebase)) return null;
    homebaseUnitId = teks(x.homebase.unitId);
    if (!homebaseUnitId) return null;
  }

  return {
    akunId,
    email: email.toLowerCase(),
    namaLengkap,
    gelarDepan: gelarDepan ?? null,
    gelarBelakang: gelarBelakang ?? null,
    nidn: nidn ?? null,
    nip: nip ?? null,
    jenisPegawai,
    aktif: x.aktif,
    homebaseUnitId,
  };
}

/** Jawaban `/api/v1/pegawai`: profil yang sah (baris cacat dibuang) dan kunci yang bukan pegawai. */
export function uraiBatchPegawai(x: unknown): { pegawai: ProfilPegawai[]; tidakDitemukan: string[] } | null {
  if (!adalahObjek(x) || !Array.isArray(x.pegawai) || !Array.isArray(x.tidakDitemukan)) return null;
  return {
    pegawai: x.pegawai.map(uraiProfil).filter((p): p is ProfilPegawai => p !== null),
    tidakDitemukan: x.tidakDitemukan.filter((k): k is string => typeof k === "string"),
  };
}

/** Jawaban `/api/v1/pegawai/cari`: profil yang sah (baris cacat dibuang). `null` = bentuk jawaban tak dikenal. */
export function uraiHasilCari(x: unknown): ProfilPegawai[] | null {
  if (!adalahObjek(x) || !Array.isArray(x.pegawai)) return null;
  return x.pegawai.map(uraiProfil).filter((p): p is ProfilPegawai => p !== null);
}

function uraiPeranDariIdentitas(x: unknown): PeranDariIdentitas | null {
  if (!adalahObjek(x)) return null;
  const namaPeran = teks(x.namaPeran);
  if (!namaPeran) return null;
  if (x.jabatan === null || x.jabatan === undefined) return { namaPeran, jabatan: null };
  if (!adalahObjek(x.jabatan) || !adalahObjek(x.jabatan.unit)) return null;
  const id = teks(x.jabatan.unit.id);
  const jenis = teks(x.jabatan.unit.jenis);
  if (!id || !jenis) return null;
  return { namaPeran, jabatan: { unit: { id, jenis } } };
}

/**
 * Jawaban `/api/v1/status-pegawai` (diperluas). `null` = jawaban tak dapat
 * dipercaya. `{terdaftar:false}` = BUKAN pegawai — itu jawaban yang sah.
 */
export type StatusPegawaiJawaban =
  | { terdaftar: false }
  | { terdaftar: true; aktif: false; nama: string | null }
  | ({ terdaftar: true; aktif: true; nama: string | null } & Omit<FaktaPegawai, "aktif" | "email">);

/**
 * Bagian LAMA jawaban `status-pegawai` (terdaftar, aktif, nama) — yang dipakai
 * GERBANG. Dipisah dari {@link uraiStatusPegawai} supaya gerbang tetap bekerja
 * terhadap identitas-itts yang belum dimutakhirkan (perluasan `akunId`/`peran`
 * belum ada): kegagalan membaca perluasan tidak boleh menjadi kegagalan gerbang.
 */
export function uraiStatusDasar(x: unknown): { terdaftar: boolean; aktif: boolean; nama: string | null } | null {
  if (!adalahObjek(x) || typeof x.terdaftar !== "boolean" || typeof x.aktif !== "boolean") return null;
  const nama = teksAtauNull(x.nama);
  if (nama === undefined) return null;
  return { terdaftar: x.terdaftar, aktif: x.aktif, nama };
}

export function uraiStatusPegawai(x: unknown): StatusPegawaiJawaban | null {
  if (!adalahObjek(x) || typeof x.terdaftar !== "boolean") return null;
  if (!x.terdaftar) return { terdaftar: false };
  if (typeof x.aktif !== "boolean") return null;
  const nama = teksAtauNull(x.nama);
  if (nama === undefined) return null;
  if (!x.aktif) return { terdaftar: true, aktif: false, nama };

  const akunId = teks(x.akunId);
  const jenisPegawai = teks(x.jenisPegawai);
  const homebase = teksAtauNull(x.homebaseUnitId ?? null);
  if (!akunId || !jenisPegawai || homebase === undefined || !Array.isArray(x.peran)) return null;
  const peran = x.peran.map(uraiPeranDariIdentitas);
  if (peran.some((p) => p === null)) return null;

  return {
    terdaftar: true,
    aktif: true,
    nama,
    akunId,
    jenisPegawai,
    homebaseUnitId: homebase,
    peran: peran as PeranDariIdentitas[],
  };
}

export function uraiBarisDirektori(x: unknown): BarisDirektori | null {
  if (!adalahObjek(x)) return null;
  const akunId = teks(x.akunId);
  const email = teks(x.email);
  const jenisPegawai = teks(x.jenisPegawai);
  const homebase = teksAtauNull(x.homebaseUnitId);
  if (!akunId || !email || !jenisPegawai || typeof x.aktif !== "boolean" || homebase === undefined) return null;
  return { akunId, email: email.toLowerCase(), jenisPegawai, aktif: x.aktif, homebaseUnitId: homebase };
}

/** Satu halaman `/api/v1/pegawai/direktori`. Baris cacat dicatat jumlahnya, bukan dibiarkan diam-diam. */
export function uraiHalamanDirektori(x: unknown): { pegawai: BarisDirektori[]; berikutnya: string | null; cacat: number } | null {
  if (!adalahObjek(x) || !Array.isArray(x.pegawai)) return null;
  if (x.berikutnya !== null && teks(x.berikutnya) === null) return null;
  const baris = x.pegawai.map(uraiBarisDirektori);
  return {
    pegawai: baris.filter((b): b is BarisDirektori => b !== null),
    berikutnya: x.berikutnya as string | null,
    cacat: baris.filter((b) => b === null).length,
  };
}

export type PeranAplikasi = {
  namaPeran: string;
  jabatan: { unit: { id: string; jenis: string } } | null;
  pemegang: { akunId: string; email: string; aktif: boolean }[];
};

/** Jawaban `/api/v1/peran-aplikasi`. */
export function uraiPeranAplikasi(x: unknown): PeranAplikasi[] | null {
  if (!adalahObjek(x) || !Array.isArray(x.peran)) return null;
  const hasil: PeranAplikasi[] = [];
  for (const p of x.peran) {
    const dasar = uraiPeranDariIdentitas(p);
    if (!dasar || !adalahObjek(p) || !Array.isArray(p.pemegang)) return null;
    const pemegang: PeranAplikasi["pemegang"] = [];
    for (const h of p.pemegang) {
      if (!adalahObjek(h)) return null;
      const akunId = teks(h.akunId);
      const email = teks(h.email);
      if (!akunId || !email || typeof h.aktif !== "boolean") return null;
      pemegang.push({ akunId, email: email.toLowerCase(), aktif: h.aktif });
    }
    hasil.push({ ...dasar, pemegang });
  }
  return hasil;
}
