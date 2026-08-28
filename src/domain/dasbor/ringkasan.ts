import { bulatkan } from "@/domain/beban-belajar/kalkulator";

/**
 * Perhitungan ringkas untuk dasbor — tahap D1–D3 pada
 * docs/07-dasbor-peran.md.
 *
 * Berkas ini MURNI: tanpa Prisma, tanpa React. Semua angkanya turunan
 * sederhana dari hitungan baris yang sudah dikumpulkan lapisan `lib/dasbor`.
 *
 * Yang TIDAK boleh masuk ke sini: rumus capaian, bobot asesmen, dan beban
 * belajar. Ketiganya sudah punya mesinnya sendiri (`agregasiProdi`,
 * `susunPetaAsesmen`, kalkulator beban). Dasbor menampilkan hasilnya, tidak
 * pernah menghitung ulang — kalau dua halaman memberi angka berbeda untuk
 * hal yang sama, salah satunya berbohong dan pengguna tidak tahu yang mana.
 */

export type Nada = "netral" | "cahaya" | "sukses" | "peringatan" | "bahaya";

export interface Segmen {
  kunci: string;
  label: string;
  jumlah: number;
  nada: Nada;
}

export interface DefinisiSegmen {
  kunci: string;
  label: string;
  nada: Nada;
}

/**
 * Menghitung sebaran nilai menurut daftar segmen yang sudah ditentukan
 * urutannya. Segmen berjumlah nol TETAP dikembalikan: pada corong status,
 * "tidak ada satu pun yang terbit" adalah kabar, bukan ketiadaan kabar.
 */
export function sebaranStatus(
  nilai: readonly string[],
  definisi: readonly DefinisiSegmen[],
): Segmen[] {
  const hitung = new Map<string, number>();
  for (const n of nilai) hitung.set(n, (hitung.get(n) ?? 0) + 1);
  return definisi.map((d) => ({ ...d, jumlah: hitung.get(d.kunci) ?? 0 }));
}

/** Persen dengan pembagi nol yang aman. Pembagi nol = 0%, bukan NaN. */
export function persen(bagian: number, keseluruhan: number, desimal = 1): number {
  if (keseluruhan <= 0) return 0;
  return bulatkan((bagian / keseluruhan) * 100, desimal);
}

// ─────────────────────────────────────────────────────────────
// Tahap kelas — monitoring dosen (doc 07 §3.4)
// ─────────────────────────────────────────────────────────────

export type TahapKelas =
  | "TANPA_PESERTA"
  | "TANPA_ASESMEN"
  | "TANPA_NILAI"
  | "NILAI_SEBAGIAN"
  | "SIAP_HITUNG"
  | "DIHITUNG"
  | "DITUTUP";

export interface SumberTahapKelas {
  jumlahPeserta: number;
  /** Banyak asesmen pada peta kanonik kelas ini (`susunPetaAsesmen`). */
  jumlahAsesmen: number;
  /** Banyak baris `NilaiAsesmen` yang sudah terisi. */
  nilaiTerisi: number;
  statusEvaluasi: "DRAF" | "DIHITUNG" | "DITUTUP" | null;
}

export interface HasilTahapKelas {
  tahap: TahapKelas;
  label: string;
  nada: Nada;
  /** Persen sel nilai yang sudah terisi terhadap peserta × asesmen. */
  persenNilai: number;
  /** Urutan tahap untuk pengurutan daftar; makin kecil makin perlu ditengok. */
  urutan: number;
}

const TAHAP: Record<TahapKelas, { label: string; nada: Nada; urutan: number }> = {
  TANPA_PESERTA: { label: "Belum ada peserta", nada: "bahaya", urutan: 0 },
  TANPA_ASESMEN: { label: "Peta asesmen kosong", nada: "bahaya", urutan: 1 },
  TANPA_NILAI: { label: "Nilai belum masuk", nada: "peringatan", urutan: 2 },
  NILAI_SEBAGIAN: { label: "Nilai sebagian", nada: "peringatan", urutan: 3 },
  SIAP_HITUNG: { label: "Siap dihitung", nada: "cahaya", urutan: 4 },
  DIHITUNG: { label: "Sudah dihitung", nada: "cahaya", urutan: 5 },
  DITUTUP: { label: "Evaluasi ditutup", nada: "sukses", urutan: 6 },
};

/**
 * Tahap sebuah kelas dilihat dari kelengkapan nilainya, BUKAN dari tanggal.
 *
 * Urutan pemeriksaan disengaja: evaluasi yang sudah ditutup selalu menang,
 * karena setelah ditutup angkanya dibekukan dan tidak lagi bergantung pada
 * baris nilai yang mungkin masih disunting (doc 05 §5.5).
 */
export function tahapKelas(s: SumberTahapKelas): HasilTahapKelas {
  const sel = s.jumlahPeserta * s.jumlahAsesmen;
  const persenNilai = persen(Math.min(s.nilaiTerisi, sel), sel);

  const tahap: TahapKelas =
    s.statusEvaluasi === "DITUTUP"
      ? "DITUTUP"
      : s.jumlahPeserta === 0
        ? "TANPA_PESERTA"
        : s.jumlahAsesmen === 0
          ? "TANPA_ASESMEN"
          : s.statusEvaluasi === "DIHITUNG"
            ? "DIHITUNG"
            : persenNilai >= 100
              ? "SIAP_HITUNG"
              : s.nilaiTerisi === 0
                ? "TANPA_NILAI"
                : "NILAI_SEBAGIAN";

  return {
    tahap,
    persenNilai: tahap === "DITUTUP" ? 100 : persenNilai,
    ...TAHAP[tahap],
  };
}

// ─────────────────────────────────────────────────────────────
// Kelengkapan RPKPS — indikator, bukan putusan
// ─────────────────────────────────────────────────────────────

export interface SumberKelengkapan {
  pertemuanTotal: number;
  /** Pertemuan yang topiknya sudah diisi. */
  pertemuanBerisi: number;
  /** Total bobot komponen nilai; sah bila 100. */
  totalBobot: number;
  subCpmkTotal: number;
  /** Sub-CPMK yang sudah dijadwalkan ke sekurang-kurangnya satu pertemuan. */
  subCpmkTerjadwal: number;
  adaPustaka: boolean;
  adaTugas: boolean;
}

export interface HasilKelengkapan {
  persen: number;
  kurang: string[];
}

const TOLERANSI_BOBOT = 0.01;

/**
 * Batang kemajuan untuk daftar RPKPS milik dosen. Ini INDIKATOR, bukan
 * putusan sah-tidaknya dokumen: yang berwenang menyatakan sebuah RPKPS layak
 * diajukan tetap `validasiRpkps` di `src/domain/rpkps/validator.ts`. Angka di
 * sini hanya menjawab "sudah sejauh mana", supaya dosen tahu mana yang
 * pantas dibuka lebih dulu.
 */
export function kelengkapanRpkps(s: SumberKelengkapan): HasilKelengkapan {
  const kurang: string[] = [];

  const butir = [
    {
      lulus: s.pertemuanTotal > 0 && s.pertemuanBerisi >= s.pertemuanTotal,
      pesan:
        s.pertemuanTotal === 0
          ? "kerangka pertemuan belum dibuat"
          : `${s.pertemuanTotal - s.pertemuanBerisi} pertemuan belum bertopik`,
    },
    {
      lulus: Math.abs(s.totalBobot - 100) <= TOLERANSI_BOBOT,
      pesan: `bobot penilaian ${bulatkan(s.totalBobot, 2)}%, belum 100%`,
    },
    {
      lulus: s.subCpmkTotal > 0 && s.subCpmkTerjadwal >= s.subCpmkTotal,
      pesan:
        s.subCpmkTotal === 0
          ? "mata kuliah belum punya Sub-CPMK"
          : `${s.subCpmkTotal - s.subCpmkTerjadwal} Sub-CPMK belum terjadwal`,
    },
    { lulus: s.adaPustaka, pesan: "pustaka belum diisi" },
    { lulus: s.adaTugas, pesan: "belum ada lembar tugas" },
  ];

  for (const b of butir) if (!b.lulus) kurang.push(b.pesan);

  return {
    persen: persen(butir.filter((b) => b.lulus).length, butir.length, 0),
    kurang,
  };
}

// ─────────────────────────────────────────────────────────────
// Denyut aktivitas
// ─────────────────────────────────────────────────────────────

export interface TitikDenyut {
  /** "YYYY-MM-DD" menurut zona waktu setempat. */
  tanggal: string;
  jumlah: number;
}

/** Kunci hari menurut zona waktu setempat — bukan UTC, karena yang dibaca
 * pengguna adalah "hari ini di kampus", bukan hari di Greenwich. */
export function kunciHari(d: Date): string {
  const bulan = String(d.getMonth() + 1).padStart(2, "0");
  const hari = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${bulan}-${hari}`;
}

/**
 * Deret hitungan per hari untuk `hari` terakhir, berakhir pada `sekarang`.
 * Hari tanpa kejadian tetap muncul dengan nilai nol — celah pada deret
 * adalah informasi (tidak ada yang bekerja), bukan sesuatu untuk disembunyikan.
 */
export function denyutHarian(
  waktu: readonly Date[],
  hari: number,
  sekarang: Date,
): TitikDenyut[] {
  const hitung = new Map<string, number>();
  for (const w of waktu) {
    const k = kunciHari(w);
    hitung.set(k, (hitung.get(k) ?? 0) + 1);
  }

  const deret: TitikDenyut[] = [];
  for (let i = hari - 1; i >= 0; i--) {
    const d = new Date(
      sekarang.getFullYear(),
      sekarang.getMonth(),
      sekarang.getDate() - i,
    );
    const k = kunciHari(d);
    deret.push({ tanggal: k, jumlah: hitung.get(k) ?? 0 });
  }
  return deret;
}
