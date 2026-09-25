import "server-only";
import { buatCache } from "@/domain/identitas/cache";
import { uraiBatchPegawai, uraiHasilCari, type ProfilPegawai } from "@/domain/identitas/kontrak";
import { GalatIdentitas, ambilDariIdentitas } from "@/lib/identitas/klien";

/**
 * Profil pegawai DIBACA dari identitas-itts, tidak disimpan di RPKPS (docs/26 §4).
 *
 * Kebijakannya:
 *   - Cache memori per-proses: segar 10 menit; setelah itu BASI (dipakai hanya
 *     bila identitas-itts tak terjangkau) sampai 24 jam; lebih tua dibuang.
 *   - Ambil BANYAK sekaligus (≤100 per panggilan) — setiap panggilan membayar
 *     `bcrypt` klien di identitas-itts (±60–100 ms), jadi satu panggilan per orang
 *     tidak dapat diterima.
 *   - Permintaan serentak untuk kunci yang sama menunggu satu panggilan yang sama.
 *   - `ambilProfil` TIDAK PERNAH melempar: halaman tetap terbuka saat
 *     identitas-itts padam. Yang tak terbaca dilaporkan di `takTerjangkau`.
 *   - `wajibProfil` untuk operasi HUKUM (tanda tangan, pengesahan, terbit): hanya data
 *     SEGAR yang diterima, dan yang tak terbaca menggagalkan operasinya.
 */

const TTL_MS = 10 * 60_000;
const BASI_MS = 24 * 60 * 60_000;
const MAKS_ENTRI = 5000;
const UKURAN_BATCH = 100;
/** Kunci yang dijawab "bukan pegawai" diingat sebentar supaya tak ditanyakan ulang di tiap halaman. */
const TTL_TAK_ADA_MS = 60_000;

const cache = buatCache<ProfilPegawai>({ ttlMs: TTL_MS, basiMs: BASI_MS, maks: MAKS_ENTRI });
const takAda = buatCache<true>({ ttlMs: TTL_TAK_ADA_MS, basiMs: 0, maks: MAKS_ENTRI });
const menunggu = new Map<string, Promise<void>>();

let logTerakhir = 0;
function catatGalat(g: unknown) {
  // Saat identitas-itts padam, setiap permintaan akan gagal; satu baris per menit cukup.
  const sekarang = Date.now();
  if (sekarang - logTerakhir < 60_000) return;
  logTerakhir = sekarang;
  console.error("[identitas] gagal mengambil profil pegawai:", g instanceof Error ? `${g.name}: ${g.message}` : "galat tak dikenal");
}

async function ambilSatuBatch(kunci: readonly string[]): Promise<void> {
  try {
    const isi = uraiBatchPegawai(await ambilDariIdentitas("/api/v1/pegawai", { akunId: kunci }));
    if (!isi) throw new GalatIdentitas("jawaban-cacat", "identitas-itts menjawab /api/v1/pegawai dengan bentuk tak dikenal");
    for (const p of isi.pegawai) cache.simpan(p.akunId, p);
    for (const id of isi.tidakDitemukan) takAda.simpan(id, true);
  } catch (galat) {
    catatGalat(galat);
  }
}

/** Mengambil kunci yang belum ada; kunci yang sedang diambil orang lain ditunggu, bukan diminta dua kali. */
async function isiDariIdentitas(kunci: readonly string[]): Promise<void> {
  const sudahJalan = kunci.flatMap((k) => (menunggu.has(k) ? [menunggu.get(k) as Promise<void>] : []));
  const baru = kunci.filter((k) => !menunggu.has(k));

  const janji: Promise<void>[] = [];
  for (let i = 0; i < baru.length; i += UKURAN_BATCH) {
    const bagian = baru.slice(i, i + UKURAN_BATCH);
    const p = ambilSatuBatch(bagian).finally(() => {
      for (const k of bagian) menunggu.delete(k);
    });
    for (const k of bagian) menunggu.set(k, p);
    janji.push(p);
  }
  await Promise.all([...sudahJalan, ...janji]);
}

export type HasilProfil = {
  profil: Map<string, ProfilPegawai>;
  /** identitas-itts menjawab: bukan pegawai (lagi). */
  tidakDitemukan: Set<string>;
  /** Tak dapat dibaca sama sekali: identitas-itts tak terjangkau DAN tak ada cache yang boleh dipakai. */
  takTerjangkau: Set<string>;
};

export async function ambilProfil(akunIds: readonly string[], opsi: { segar?: boolean } = {}): Promise<HasilProfil> {
  const hasil: HasilProfil = { profil: new Map(), tidakDitemukan: new Set(), takTerjangkau: new Set() };
  const basi = new Map<string, ProfilPegawai>();
  const perlu: string[] = [];

  for (const id of new Set(akunIds)) {
    if (takAda.ambil(id)) {
      hasil.tidakDitemukan.add(id);
      continue;
    }
    const c = cache.ambil(id);
    if (c?.segar) {
      hasil.profil.set(id, c.nilai);
      continue;
    }
    if (c && !opsi.segar) basi.set(id, c.nilai);
    perlu.push(id);
  }

  if (perlu.length > 0) await isiDariIdentitas(perlu);

  for (const id of perlu) {
    const c = cache.ambil(id);
    if (c?.segar) hasil.profil.set(id, c.nilai);
    else if (takAda.ambil(id)) hasil.tidakDitemukan.add(id);
    else if (basi.has(id)) hasil.profil.set(id, basi.get(id) as ProfilPegawai);
    else hasil.takTerjangkau.add(id);
  }
  return hasil;
}

/** Operasi hukum tak dapat dilanjutkan tanpa data pegawai yang pasti. Pesannya aman ditampilkan. */
export class ProfilTidakTersedia extends Error {
  constructor(readonly akunIds: readonly string[]) {
    super("Data pegawai tidak dapat dipastikan dari identitas-itts saat ini. Coba lagi sebentar lagi.");
    this.name = "ProfilTidakTersedia";
  }
}

/**
 * Profil SEGAR untuk semua kunci, atau melempar {@link ProfilTidakTersedia}. Untuk tanda tangan,
 * pengesahan, dan penerbitan: yang tercetak di dokumen resmi tidak boleh berasal dari tebakan
 * atau data yang mungkin sudah berubah.
 */
export async function wajibProfil(akunIds: readonly string[]): Promise<Map<string, ProfilPegawai>> {
  const h = await ambilProfil(akunIds, { segar: true });
  const hilang = [...new Set(akunIds)].filter((id) => !h.profil.has(id));
  if (hilang.length > 0) throw new ProfilTidakTersedia(hilang);
  return h.profil;
}

/** Membuang satu profil dari cache — untuk pembatalan lewat webhook kelak, dan untuk uji. */
export function lupakanProfil(akunId: string): void {
  cache.hapus(akunId);
  takAda.hapus(akunId);
}

/**
 * Mencari pegawai di identitas-itts (nama, surel, NIDN, NIP; ≤20 hasil) — untuk pemilih dan
 * pencarian di /pengguna. TIDAK menelan galat: pencarian yang gagal harus terlihat gagal, bukan
 * tampak "tidak ada yang cocok". Hasilnya sekaligus mengisi cache profil.
 */
export async function cariPegawai(kata: string): Promise<ProfilPegawai[]> {
  const q = kata.trim().slice(0, 100);
  if (q.length < 2) return [];
  const hasil = uraiHasilCari(await ambilDariIdentitas("/api/v1/pegawai/cari", { q }));
  if (!hasil) throw new GalatIdentitas("jawaban-cacat", "identitas-itts menjawab /api/v1/pegawai/cari dengan bentuk tak dikenal");
  for (const p of hasil) cache.simpan(p.akunId, p);
  return hasil;
}
