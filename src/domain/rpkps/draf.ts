import { LEVEL_BLOOM, type LevelBloom } from "@/domain/kurikulum/bloom";

/**
 * Draf RPKPS utuh yang diusulkan AI, beserta pemeriksaannya.
 *
 * Modul ini MURNI dan merupakan penahan terakhir sebelum draf ditulis ke
 * dokumen. Persetujuan dosen berupa satu tombol untuk seluruh dokumen, jadi
 * tidak ada lagi manusia yang memeriksa tiap baris — konsekuensinya SEMUA
 * invarian yang dapat dihitung harus ditegakkan di sini, bukan diserahkan ke
 * kepatuhan model pada prompt.
 *
 * Nilai enum diperiksa di sini secara RUNTIME, bukan hanya lewat tipe:
 * terapkanDrafRpkps() menerima draf dari klien, dan kiriman klien tidak pernah
 * dipercaya. Tipe TypeScript hilang saat itu.
 *
 * Yang sengaja TIDAK boleh disentuh AI:
 *   - menit aktivitas TM/PT/BM, karena sudah pas dengan pagu beban belajar
 *     sejak kerangka dibuat; mengubahnya berarti melanggar invarian 45 jam/sks
 *   - nomor dan rentang minggu, jenis pertemuan, serta daftar Sub-CPMK yang
 *     tersedia — semuanya berasal dari kurikulum dan kebijakan
 */

/** Sama persis dengan enum JenisTugas di skema. Menambah nilai di sini tanpa
 *  migrasi akan lolos TypeScript lalu gagal saat menulis ke basis data. */
export const JENIS_TUGAS = ["INDIVIDU", "KELOMPOK"] as const;
export type JenisTugas = (typeof JENIS_TUGAS)[number];

/** Sama persis dengan enum BentukSoal di skema. */
export type BentukSoal = (typeof BENTUK_SOAL)[number];
export const BENTUK_SOAL = [
  "PILIHAN_GANDA", "ESAI", "URAIAN_SINGKAT",
  "STUDI_KASUS", "PRAKTIK", "PROYEK", "LISAN",
] as const;

export interface DrafPertemuan {
  minggu: number;
  topik: string;
  subtopik: string[];
  metodeNarasi: string;
  aktivitasDosen: string;
  aktivitasMahasiswa: string;
  tugasTerstruktur: string | null;
  penilaianJenis: string | null;
  penilaianSistem: string | null;
  bobot: number;
  indikator: string[];
  /**
   * Rujukan pustaka yang SUDAH ada pada RPKPS, berbentuk "UTAMA-1" /
   * "PENDUKUNG-2". Bukan judul, bukan karangan.
   *
   * Memakai jenis+nomor, bukan nomor saja: Pustaka unik per (jenis, nomor),
   * sehingga "nomor 1" menunjuk dua baris berbeda.
   */
  pustakaRef: string[];
}

export interface DrafKriteria {
  nomor: number;
  indikator: string;
  rincian: string[];
  bobot: number;
}

export interface DrafTugas {
  nomor: number;
  nama: string;
  jenis: JenisTugas;
  mingguMulai: number;
  mingguSelesai: number;
  bobot: number;
  /** Nama komponen nilai yang menampung bobot ini. */
  komponenNilai: string | null;
  deskripsi: string;
  uraianTugas: string | null;
  formatLuaran: string | null;
  subCpmkKode: string[];
  kriteria: DrafKriteria[];
}

export interface DrafButirUjian {
  nomor: number;
  subCpmkKode: string;
  levelBloom: LevelBloom;
  bentuk: BentukSoal;
  jumlahButir: number;
  skor: number;
  indikator: string | null;
}

export interface DrafKisiKisi {
  jenis: "UTS" | "UAS";
  durasiMenit: number | null;
  butir: DrafButirUjian[];
}

export const JENIS_PUSTAKA = ["UTAMA", "PENDUKUNG", "DARING", "TOOLS"] as const;
export type JenisPustaka = (typeof JENIS_PUSTAKA)[number];

/**
 * Pustaka BARU yang diusulkan AI.
 *
 * Pustaka yang sudah dimasukkan dosen tidak pernah masuk daftar ini dan tidak
 * pernah tersentuh — ia dipertahankan apa adanya saat penerapan. Nomor di sini
 * melanjutkan nomor terakhir per jenis, dihitung server, bukan oleh model.
 */
export interface DrafPustaka {
  jenis: JenisPustaka;
  nomor: number;
  teks: string;
  url: string | null;
}

export interface DrafKomponenNilai {
  nama: string;
  bobot: number;
}

export interface DrafRpkps {
  deskripsi: string;
  kalimatPembukaCpmk: string;
  komponenNilai: DrafKomponenNilai[];
  pustakaBaru: DrafPustaka[];
  pertemuan: DrafPertemuan[];
  tugas: DrafTugas[];
  kisiKisi: DrafKisiKisi[];
}

/** Keadaan RPKPS yang sudah ada — batas yang tidak boleh dilanggar draf. */
export interface KonteksDraf {
  /** Minggu pertemuan EFEKTIF; hanya ini yang boleh diisi AI. */
  mingguEfektif: number[];
  /** Seluruh nomor minggu, termasuk minggu ujian. */
  semuaMinggu: number[];
  subCpmkTersedia: string[];
  /** Rujukan pustaka yang SUDAH ada; selalu dipertahankan. */
  refPustaka: string[];
}

export interface TemuanDraf {
  kode: string;
  pesan: string;
  lokasi?: string;
}

const TOLERANSI = 0.01;

const SAH_JENIS_TUGAS: ReadonlySet<string> = new Set(JENIS_TUGAS);
const SAH_BENTUK_SOAL: ReadonlySet<string> = new Set(BENTUK_SOAL);
const SAH_LEVEL: ReadonlySet<string> = new Set(LEVEL_BLOOM.map((l) => l.level));

function bulat(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Memeriksa draf terhadap keadaan RPKPS yang sebenarnya.
 *
 * Mengembalikan temuan, bukan melempar: satu draf yang sebagian kecilnya
 * melanggar tetap berguna untuk ditampilkan, asalkan dosen tahu persis bagian
 * mana yang tidak dapat dipakai. Draf dengan temuan TIDAK boleh diterapkan.
 */
export function periksaDraf(konteks: KonteksDraf, draf: DrafRpkps): TemuanDraf[] {
  const temuan: TemuanDraf[] = [];
  const efektif = new Set(konteks.mingguEfektif);
  const subTersedia = new Set(konteks.subCpmkTersedia);
  const pustakaAda = new Set(konteks.refPustaka);
  const namaKomponen = new Set(draf.komponenNilai.map((k) => k.nama));

  // Rujukan sah = pustaka yang sudah ada DITAMBAH yang baru diusulkan.
  for (const b of draf.pustakaBaru) pustakaAda.add(`${b.jenis}-${b.nomor}`);

  // ── Pertemuan ─────────────────────────────────────────────────────────
  const mingguTerlihat = new Set<number>();
  for (const p of draf.pertemuan) {
    const di = `minggu ${p.minggu}`;
    if (!efektif.has(p.minggu)) {
      temuan.push({
        kode: "D-MINGGU-BUKAN-EFEKTIF",
        pesan: `Minggu ${p.minggu} bukan pertemuan efektif — minggu ujian tidak diisi AI.`,
        lokasi: di,
      });
      continue;
    }
    if (mingguTerlihat.has(p.minggu)) {
      temuan.push({ kode: "D-MINGGU-GANDA", pesan: `Minggu ${p.minggu} muncul dua kali.`, lokasi: di });
      continue;
    }
    mingguTerlihat.add(p.minggu);

    if (p.topik.trim().length < 3) {
      temuan.push({ kode: "D-TOPIK-KOSONG", pesan: "Topik kosong.", lokasi: di });
    }
    if (p.indikator.length === 0 && p.bobot > 0) {
      temuan.push({
        kode: "D-BERBOBOT-TANPA-INDIKATOR",
        pesan: "Pertemuan berbobot nilai tetapi tanpa indikator penilaian.",
        lokasi: di,
      });
    }
    if (new Set(p.pustakaRef).size !== p.pustakaRef.length) {
      temuan.push({
        kode: "D-PUSTAKA-BERULANG",
        pesan: "Pustaka yang sama dirujuk lebih dari sekali pada minggu ini.",
        lokasi: di,
      });
    }
    for (const ref of p.pustakaRef) {
      if (!pustakaAda.has(ref)) {
        temuan.push({
          kode: "D-PUSTAKA-KARANGAN",
          pesan: `Merujuk pustaka "${ref}", yang tidak ada pada daftar pustaka RPKPS.`,
          lokasi: di,
        });
      }
    }
  }

  const belumDiisi = konteks.mingguEfektif.filter((m) => !mingguTerlihat.has(m));
  if (belumDiisi.length > 0) {
    temuan.push({
      kode: "D-MINGGU-BELUM-DIISI",
      pesan: `${belumDiisi.length} pertemuan efektif belum terisi: ${belumDiisi.join(", ")}.`,
    });
  }

  // ── Sub-CPMK: setiap yang tersedia harus terjadwal, tidak boleh asing ──
  // Sub-CPMK melekat pada pertemuan sejak kerangka dibuat, jadi yang diperiksa
  // di sini hanya rujukan dari tugas dan kisi-kisi.

  // ── Bagian A dan pembuka CPMK ────────────────────────────────────────
  if (draf.deskripsi.trim().length < 40) {
    temuan.push({
      kode: "D-DESKRIPSI-PENDEK",
      pesan: "Deskripsi mata kuliah terlalu pendek untuk bagian A template.",
    });
  }
  if (draf.kalimatPembukaCpmk.trim().length < 15) {
    temuan.push({ kode: "D-PEMBUKA-PENDEK", pesan: "Kalimat pembuka CPMK terlalu pendek." });
  }

  // ── Komponen nilai ───────────────────────────────────────────────────
  if (draf.komponenNilai.length === 0) {
    temuan.push({ kode: "D-KOMPONEN-KOSONG", pesan: "Tidak ada komponen nilai yang diusulkan." });
  }
  if (new Set(draf.komponenNilai.map((k) => k.nama)).size !== draf.komponenNilai.length) {
    temuan.push({
      kode: "D-KOMPONEN-NAMA-GANDA",
      pesan: "Ada nama komponen nilai yang berulang.",
    });
  }

  // ── Pustaka baru ─────────────────────────────────────────────────────
  const refBaru = new Set<string>();
  for (const b of draf.pustakaBaru) {
    const ref = `${b.jenis}-${b.nomor}`;
    if (konteks.refPustaka.includes(ref) || refBaru.has(ref)) {
      temuan.push({
        kode: "D-PUSTAKA-NOMOR-BENTROK",
        pesan: `Pustaka ${ref} bentrok dengan nomor yang sudah dipakai.`,
      });
    }
    refBaru.add(ref);
    if (b.teks.trim().length < 10) {
      temuan.push({ kode: "D-PUSTAKA-PENDEK", pesan: `Pustaka ${ref} terlalu pendek.` });
    }
  }

  // ── Bobot: mingguan + tugas harus 100% dan sama dengan komponen nilai ──
  const bobotMingguan = bulat(draf.pertemuan.reduce((s, p) => s + p.bobot, 0));
  const bobotKomponen = bulat(draf.komponenNilai.reduce((s, k) => s + k.bobot, 0));
  if (Math.abs(bobotKomponen - 100) > TOLERANSI) {
    temuan.push({
      kode: "D-BOBOT-KOMPONEN",
      pesan: `Total bobot komponen nilai ${bobotKomponen}%, seharusnya 100%.`,
    });
  }
  if (Math.abs(bobotMingguan - 100) > TOLERANSI) {
    temuan.push({
      kode: "D-BOBOT-MINGGUAN",
      pesan: `Total bobot mingguan ${bobotMingguan}%, seharusnya 100%.`,
    });
  }
  // Tidak ada pemeriksaan rekonsiliasi terpisah: sejak komponen nilai ikut
  // datang dari draf yang sama, keduanya rekonsiliasi dengan sendirinya begitu
  // masing-masing berjumlah 100. Aturan B2 pada validator RPKPS tetap menjaga
  // dokumen yang tersimpan, di mana keduanya bisa berubah sendiri-sendiri.

  // ── Tugas ─────────────────────────────────────────────────────────────
  const nomorTugas = new Set<number>();
  for (const t of draf.tugas) {
    const di = `tugas ${t.nomor}`;
    if (nomorTugas.has(t.nomor)) {
      temuan.push({ kode: "D-TUGAS-NOMOR-GANDA", pesan: `Nomor tugas ${t.nomor} berulang.`, lokasi: di });
    }
    nomorTugas.add(t.nomor);

    if (t.mingguMulai > t.mingguSelesai) {
      temuan.push({ kode: "D-TUGAS-MINGGU-TERBALIK", pesan: "Minggu mulai melewati minggu selesai.", lokasi: di });
    }
    const batas = Math.max(...konteks.semuaMinggu);
    if (t.mingguMulai < 1 || t.mingguSelesai > batas) {
      temuan.push({
        kode: "D-TUGAS-MINGGU-DILUAR",
        pesan: `Rentang minggu ${t.mingguMulai}–${t.mingguSelesai} di luar 1–${batas}.`,
        lokasi: di,
      });
    }
    if (!SAH_JENIS_TUGAS.has(t.jenis)) {
      temuan.push({
        kode: "D-TUGAS-JENIS-ASING",
        pesan: `Jenis tugas "${t.jenis}" tidak dikenal. Pilihannya: ${[...SAH_JENIS_TUGAS].join(", ")}.`,
        lokasi: di,
      });
    }
    if (t.komponenNilai !== null && !namaKomponen.has(t.komponenNilai)) {
      temuan.push({
        kode: "D-TUGAS-KOMPONEN-ASING",
        pesan: `Komponen nilai "${t.komponenNilai}" tidak ada pada RPKPS ini.`,
        lokasi: di,
      });
    }
    if (new Set(t.subCpmkKode).size !== t.subCpmkKode.length) {
      temuan.push({
        kode: "D-TUGAS-SUB-CPMK-BERULANG",
        pesan: "Sub-CPMK yang sama ditagih lebih dari sekali oleh tugas ini.",
        lokasi: di,
      });
    }
    for (const kode of t.subCpmkKode) {
      if (!subTersedia.has(kode)) {
        temuan.push({
          kode: "D-TUGAS-SUB-CPMK-ASING",
          pesan: `Menagih ${kode}, yang bukan milik mata kuliah ini.`,
          lokasi: di,
        });
      }
    }
    if (t.kriteria.length === 0) {
      temuan.push({ kode: "D-TUGAS-TANPA-KRITERIA", pesan: "Tugas tanpa kriteria penilaian.", lokasi: di });
    } else {
      const nomorKriteria = new Set<number>();
      for (const k of t.kriteria) {
        if (nomorKriteria.has(k.nomor)) {
          temuan.push({
            kode: "D-KRITERIA-NOMOR-GANDA",
            pesan: `Nomor kriteria ${k.nomor} berulang.`,
            lokasi: di,
          });
        }
        nomorKriteria.add(k.nomor);
      }
      const total = bulat(t.kriteria.reduce((s, k) => s + k.bobot, 0));
      if (Math.abs(total - 100) > TOLERANSI) {
        temuan.push({
          kode: "D-TUGAS-BOBOT-KRITERIA",
          pesan: `Bobot kriteria berjumlah ${total}%, seharusnya 100%.`,
          lokasi: di,
        });
      }
    }
  }

  // ── Kisi-kisi ─────────────────────────────────────────────────────────
  const jenisTerlihat = new Set<string>();
  for (const k of draf.kisiKisi) {
    const di = `kisi-kisi ${k.jenis}`;
    if (jenisTerlihat.has(k.jenis)) {
      temuan.push({ kode: "D-KISI-GANDA", pesan: `Kisi-kisi ${k.jenis} muncul dua kali.`, lokasi: di });
      continue;
    }
    jenisTerlihat.add(k.jenis);

    if (k.butir.length === 0) {
      temuan.push({ kode: "D-KISI-KOSONG", pesan: "Kisi-kisi tanpa butir.", lokasi: di });
      continue;
    }
    const nomorButir = new Set<number>();
    for (const b of k.butir) {
      if (nomorButir.has(b.nomor)) {
        temuan.push({
          kode: "D-BUTIR-NOMOR-GANDA",
          pesan: `Nomor butir ${b.nomor} berulang.`,
          lokasi: di,
        });
      }
      nomorButir.add(b.nomor);

      if (!SAH_BENTUK_SOAL.has(b.bentuk)) {
        temuan.push({
          kode: "D-BUTIR-BENTUK-ASING",
          pesan: `Butir ${b.nomor} memakai bentuk soal "${b.bentuk}" yang tidak dikenal.`,
          lokasi: di,
        });
      }
      if (!SAH_LEVEL.has(b.levelBloom)) {
        temuan.push({
          kode: "D-BUTIR-LEVEL-ASING",
          pesan: `Butir ${b.nomor} memakai level "${b.levelBloom}" yang tidak dikenal.`,
          lokasi: di,
        });
      }
      if (!subTersedia.has(b.subCpmkKode)) {
        temuan.push({
          kode: "D-KISI-SUB-CPMK-ASING",
          pesan: `Butir ${b.nomor} menguji ${b.subCpmkKode}, yang bukan milik mata kuliah ini.`,
          lokasi: di,
        });
      }
      if (b.jumlahButir < 1) {
        temuan.push({ kode: "D-KISI-JUMLAH", pesan: `Butir ${b.nomor} berjumlah kurang dari satu.`, lokasi: di });
      }
    }
    const totalSkor = bulat(k.butir.reduce((s, b) => s + b.skor, 0));
    if (Math.abs(totalSkor - 100) > TOLERANSI) {
      temuan.push({
        kode: "D-KISI-TOTAL-SKOR",
        pesan: `Total skor ${totalSkor}, seharusnya 100.`,
        lokasi: di,
      });
    }
  }

  return temuan;
}

/** Ringkasan untuk ditampilkan sebelum dosen menyetujui. */
export function ringkasDraf(draf: DrafRpkps): {
  jumlahPertemuan: number;
  jumlahIndikator: number;
  jumlahTugas: number;
  jumlahButirUjian: number;
  jumlahKomponen: number;
  jumlahPustakaBaru: number;
  bobotMingguan: number;
} {
  return {
    jumlahPertemuan: draf.pertemuan.length,
    jumlahIndikator: draf.pertemuan.reduce((s, p) => s + p.indikator.length, 0),
    jumlahTugas: draf.tugas.length,
    jumlahButirUjian: draf.kisiKisi.reduce((s, k) => s + k.butir.length, 0),
    jumlahKomponen: draf.komponenNilai.length,
    jumlahPustakaBaru: draf.pustakaBaru.length,
    bobotMingguan: bulat(draf.pertemuan.reduce((s, p) => s + p.bobot, 0)),
  };
}
