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
  /**
   * Nama komponen nilai yang menampung bobot minggu ini.
   *
   * Wajib terisi bila `bobot` lebih dari nol. Tanpa ini baris mingguan masuk
   * ke dokumen sebagai "belum ditentukan", dan `susunPetaAsesmen` kehilangan
   * satu-satunya penanda bahwa komponen itu SUDAH dirinci baris mingguan —
   * sehingga seluruh lembar tugas terbaca sebagai bobot tambahan. Itulah asal
   * "total 200%" pada docs/12 §1.2.
   */
  komponenNilai: string | null;
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

/**
 * Bobot baris ujian pada tabel mingguan.
 *
 * Dipisahkan dari `DrafPertemuan` karena isi minggu ujian BUKAN urusan model:
 * topik, jenis, dan menit aktivitasnya sudah ditetapkan kerangka. Yang boleh
 * ditulis draf hanyalah dua hal yang memang tidak dapat ditentukan dari luar —
 * berapa bobot ujian itu, dan ke komponen mana ia masuk.
 *
 * Tanpa ini bobot UTS/UAS tetap nol seumur hidup draf, dan karena Sub-CPMK
 * ujian hidup di kisi-kisi — bukan menempel pada barisnya — seluruh Sub-CPMK
 * yang hanya diuji lewat ujian tidak pernah terukur (docs/12 §1.3).
 */
export interface DrafUjian {
  minggu: number;
  jenis: "UTS" | "UAS";
  bobot: number;
  komponenNilai: string | null;
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
  ujian: DrafUjian[];
  tugas: DrafTugas[];
  kisiKisi: DrafKisiKisi[];
}

/** Keadaan RPKPS yang sudah ada — batas yang tidak boleh dilanggar draf. */
export interface KonteksDraf {
  /** Minggu pertemuan EFEKTIF; hanya ini yang boleh diisi AI. */
  mingguEfektif: number[];
  /** Seluruh nomor minggu, termasuk minggu ujian. */
  semuaMinggu: number[];
  /** Baris ujian beserta jenisnya — satu-satunya minggu yang boleh masuk `ujian`. */
  mingguUjian: { minggu: number; jenis: "UTS" | "UAS" }[];
  subCpmkTersedia: string[];
  /**
   * Sub-CPMK yang dijadwalkan tiap minggu, dari kerangka.
   *
   * Dipakai dua kali: menolak bobot pada minggu yang tidak menjadwalkan
   * Sub-CPMK apa pun — bobot semacam itu tidak mengalir ke capaian mana pun —
   * dan memastikan setiap Sub-CPMK benar-benar terukur oleh sesuatu.
   */
  subCpmkPerMinggu: Record<number, string[]>;
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

  /**
   * Setiap baris mingguan berbobot wajib menunjuk komponen nilai yang ada.
   *
   * Inilah pemeriksaan yang dulu tidak ada sama sekali, dan ketiadaannya yang
   * melahirkan seluruh temuan pada docs/12 §1. `alokasikanAsesmen` seharusnya
   * sudah menutupnya sebelum draf sampai ke sini; kalau temuan ini menyala,
   * yang bocor adalah alokasinya, bukan dosennya.
   */
  const periksaKomponen = (nama: string | null, label: string, di: string) => {
    if (nama === null || nama.trim().length === 0) {
      temuan.push({
        kode: "D-MINGGU-TANPA-KOMPONEN",
        pesan: `${label} berbobot nilai tetapi tidak masuk komponen nilai mana pun.`,
        lokasi: di,
      });
    } else if (!namaKomponen.has(nama)) {
      temuan.push({
        kode: "D-MINGGU-KOMPONEN-ASING",
        pesan: `${label} menunjuk komponen "${nama}", yang tidak ada pada daftar komponen nilai.`,
        lokasi: di,
      });
    }
  };

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
    if (p.bobot > TOLERANSI) {
      periksaKomponen(p.komponenNilai, `Minggu ${p.minggu}`, di);
      if ((konteks.subCpmkPerMinggu[p.minggu] ?? []).length === 0) {
        temuan.push({
          kode: "D-MINGGU-BERBOBOT-TANPA-SUB-CPMK",
          pesan:
            "Minggu ini diberi bobot tetapi tidak menjadwalkan Sub-CPMK, " +
            "sehingga bobotnya tidak mengalir ke capaian mana pun.",
          lokasi: di,
        });
      }
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

  // ── Baris ujian: hanya bobot dan komponennya yang boleh datang dari AI ─
  const jenisUjian = new Map(konteks.mingguUjian.map((u) => [u.minggu, u.jenis]));
  const kisiBerisi = new Set(
    draf.kisiKisi.filter((k) => k.butir.length > 0).map((k) => k.jenis),
  );
  const ujianTerlihat = new Set<number>();
  for (const u of draf.ujian) {
    const di = `minggu ${u.minggu}`;
    if (jenisUjian.get(u.minggu) !== u.jenis) {
      temuan.push({
        kode: "D-UJIAN-BUKAN-MINGGU-UJIAN",
        pesan: `Minggu ${u.minggu} bukan baris ujian ${u.jenis} pada RPKPS ini.`,
        lokasi: di,
      });
      continue;
    }
    if (ujianTerlihat.has(u.minggu)) {
      temuan.push({ kode: "D-UJIAN-GANDA", pesan: `Minggu ${u.minggu} muncul dua kali.`, lokasi: di });
      continue;
    }
    ujianTerlihat.add(u.minggu);

    if (u.bobot > TOLERANSI) {
      periksaKomponen(u.komponenNilai, `Baris ${u.jenis}`, di);
      // Baris ujian tidak menempel Sub-CPMK; yang mengukur adalah kisi-kisinya.
      if (!kisiBerisi.has(u.jenis)) {
        temuan.push({
          kode: "D-UJIAN-BERBOBOT-TANPA-KISI",
          pesan:
            `Baris ${u.jenis} diberi bobot ${bulat(u.bobot)}% tetapi kisi-kisi ${u.jenis} ` +
            "tidak berisi butir, sehingga bobot itu tidak mengukur Sub-CPMK mana pun.",
          lokasi: di,
        });
      }
    }
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
  // Baris ujian ikut dijumlahkan: sejak draf boleh memberi bobot pada UTS/UAS,
  // "bobot mingguan" berarti seluruh tabel, persis seperti B1 pada validator.
  const bobotMingguan = bulat(
    draf.pertemuan.reduce((s, p) => s + p.bobot, 0) +
      draf.ujian.reduce((s, u) => s + u.bobot, 0),
  );
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
  // Rekonsiliasi tidak berhenti pada dua total yang sama-sama 100. Sejak tiap
  // baris menyebut komponennya, yang harus cocok adalah TIAP komponen dengan
  // baris yang merincinya — itulah yang membuat `PA-KOMPONEN-TIDAK-COCOK` dan
  // `PA-KOMPONEN-TANPA-ASESMEN` tidak mungkin muncul pada dokumen hasil draf.
  const dirinci = new Map<string, number>();
  const barisBerbobot: { komponen: string | null; bobot: number }[] = [
    ...draf.pertemuan.map((p) => ({ komponen: p.komponenNilai, bobot: p.bobot })),
    ...draf.ujian.map((u) => ({ komponen: u.komponenNilai, bobot: u.bobot })),
  ];
  for (const b of barisBerbobot) {
    if (b.bobot <= TOLERANSI || b.komponen === null) continue;
    dirinci.set(b.komponen, (dirinci.get(b.komponen) ?? 0) + b.bobot);
  }
  for (const k of draf.komponenNilai) {
    if (k.bobot <= TOLERANSI) continue;
    const jumlah = dirinci.get(k.nama);
    if (jumlah === undefined) {
      temuan.push({
        kode: "D-KOMPONEN-TANPA-ASESMEN",
        pesan:
          `Komponen "${k.nama}" berbobot ${bulat(k.bobot)}% tetapi tidak dirinci baris ` +
          "mingguan mana pun, sehingga nilainya tidak akan pernah dapat dikumpulkan.",
      });
    } else if (Math.abs(bulat(jumlah) - bulat(k.bobot)) > TOLERANSI) {
      temuan.push({
        kode: "D-KOMPONEN-TIDAK-COCOK",
        pesan:
          `Baris mingguan pada komponen "${k.nama}" berjumlah ${bulat(jumlah)}%, ` +
          `sedangkan komponennya ${bulat(k.bobot)}%.`,
      });
    }
  }

  // ── Setiap Sub-CPMK harus benar-benar terukur ────────────────────────
  // Satu-satunya temuan di berkas ini yang TIDAK punya tambalan otomatis:
  // menambalnya berarti mengarang butir ujian, dan butir ujian karangan server
  // lebih buruk daripada draf yang ditolak dengan alasan jelas (docs/12 §3.4).
  const terukur = new Set<string>();
  for (const p of draf.pertemuan) {
    if (p.bobot <= TOLERANSI) continue;
    for (const kode of konteks.subCpmkPerMinggu[p.minggu] ?? []) terukur.add(kode);
  }
  for (const u of draf.ujian) {
    if (u.bobot <= TOLERANSI) continue;
    for (const k of draf.kisiKisi) {
      if (k.jenis !== u.jenis) continue;
      for (const b of k.butir) if (b.skor > 0) terukur.add(b.subCpmkKode);
    }
  }
  const takTerukur = konteks.subCpmkTersedia.filter((k) => !terukur.has(k));
  if (takTerukur.length > 0) {
    temuan.push({
      kode: "D-SUB-CPMK-TIDAK-TERUKUR",
      pesan:
        `${takTerukur.length} Sub-CPMK tidak diukur oleh satu pun asesmen berbobot: ` +
        `${takTerukur.slice(0, 5).join(", ")}${takTerukur.length > 5 ? ", …" : ""}. ` +
        "Jadwalkan pada minggu berbobot, atau ujikan lewat kisi-kisi UTS/UAS.",
    });
  }

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
    bobotMingguan: bulat(
      draf.pertemuan.reduce((s, p) => s + p.bobot, 0) +
        draf.ujian.reduce((s, u) => s + u.bobot, 0),
    ),
  };
}
