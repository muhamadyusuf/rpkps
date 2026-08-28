import { bulatkan } from "@/domain/beban-belajar/kalkulator";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";

/**
 * Peta asesmen kanonik — tahap E1 pada docs/05-evaluasi-ketercapaian-mk.md.
 *
 * Bobot penilaian tersebar di tiga tempat: baris tabel mingguan, lembar tugas,
 * dan butir kisi-kisi. Menjumlahkan ketiganya begitu saja menghasilkan bobot
 * di atas 100% dan angka ketercapaian yang mengada-ada. Modul ini menurunkan
 * SATU daftar asesmen dari ketiganya, dengan aturan yang deterministik, lalu
 * memeriksa bahwa daftar itu benar-benar dapat dipakai menghitung capaian.
 *
 * Aturan pokoknya (docs/05 §5.3):
 *
 *   1. `komponen_nilai` adalah buku besar bobot. Totalnya wajib 100%.
 *   2. Sebuah komponen dirinci oleh baris mingguan ATAU oleh lembar tugas —
 *      tidak pernah oleh keduanya. Bila baris mingguan sudah merincinya,
 *      lembar tugas dibaca sebagai *rencana* baris-baris itu, bukan sebagai
 *      bobot tambahan.
 *   3. Bobot tiap asesmen dibagi ke Sub-CPMK yang ditagihnya. Untuk ujian,
 *      pembagian mengikuti skor butir kisi-kisi bila ada; selebihnya rata.
 *
 * Hasilnya menjawab W7 pada docs/02 §2.2: tabel distribusi berhenti menjadi
 * kumpulan tanda √ dan menjadi angka yang dapat dihitung.
 *
 * Temuan di sini TIDAK memblokir penerbitan RPKPS — validator penerbitan
 * tetap `validasiRpkps`. Yang diblokirnya adalah pembukaan evaluasi (E3):
 * capaian tidak boleh dihitung di atas peta bobot yang belum tertutup.
 */

const TOLERANSI = 0.01;

export type AsalAsesmen = "MINGGUAN" | "UJIAN" | "TUGAS";

/** Cara bobot sebuah asesmen dibagi ke Sub-CPMK yang ditagihnya. */
export type CaraPembagian = "KISI_KISI" | "RATA" | "TIDAK_ADA";

export interface PertemuanPeta {
  minggu: number;
  jenis: "EFEKTIF" | "UTS" | "UAS";
  /** Kolom "Penilaian" pada tabel mingguan — dipakai sebagai nama asesmen. */
  penilaianJenis: string | null;
  bobot: number;
  /** Nama komponen nilai yang ditunjuk baris ini, null bila belum ditunjuk. */
  komponen: string | null;
  subCpmkKode: string[];
}

export interface TugasPeta {
  nomor: number;
  nama: string;
  bobot: number;
  komponen: string | null;
  mingguMulai: number;
  mingguSelesai: number;
  subCpmkKode: string[];
}

export interface KisiKisiPeta {
  jenis: "UTS" | "UAS";
  butir: { subCpmkKode: string; skor: number }[];
}

export interface CpmkPeta {
  kode: string;
  subCpmkKode: string[];
  cplKode: string[];
}

export interface SumberPeta {
  komponenNilai: { nama: string; bobot: number }[];
  pertemuan: PertemuanPeta[];
  tugas: TugasPeta[];
  kisiKisi: KisiKisiPeta[];
  cpmk: CpmkPeta[];
  /** Kode CPL yang dibebankan pada mata kuliah menurut matriks CPL×MK. */
  cplDibebankan: string[];
}

export interface BagianSubCpmk {
  kode: string;
  /** Bagian bobot asesmen yang jatuh ke Sub-CPMK ini, dalam persen nilai akhir. */
  bobot: number;
}

export interface Asesmen {
  /** Kode pendek yang stabil — kelak menjadi judul kolom pada berkas impor nilai. */
  kode: string;
  nama: string;
  asal: AsalAsesmen;
  komponen: string | null;
  bobot: number;
  minggu: number[];
  subCpmk: BagianSubCpmk[];
  pembagian: CaraPembagian;
}

export interface KontribusiCpl {
  kode: string;
  /** Jumlah bobot seluruh CPMK yang menjabarkan CPL ini. */
  bobot: number;
  cpmk: { kode: string; bobot: number; kontribusi: number }[];
}

export interface PetaAsesmen {
  asesmen: Asesmen[];
  temuan: TemuanRpkps[];
  pemblokir: TemuanRpkps[];
  peringatan: TemuanRpkps[];
  /** true bila peta sudah cukup tertutup untuk dipakai menghitung capaian. */
  lolos: boolean;
  bobotSubCpmk: Record<string, number>;
  bobotCpmk: Record<string, number>;
  cpl: KontribusiCpl[];
  ringkasan: {
    totalBobot: number;
    jumlahAsesmen: number;
    subCpmkTerukur: number;
    subCpmkSeluruh: number;
    cplTerukur: number;
    cplDibebankan: number;
  };
}

interface Calon extends Asesmen {
  /** Sub-CPMK yang ditagih, sebelum bobotnya dibagi. */
  subKode: string[];
  jenisUjian: "UTS" | "UAS" | null;
}

export function susunPetaAsesmen(sumber: SumberPeta): PetaAsesmen {
  const temuan: TemuanRpkps[] = [];

  // ── 1 · Calon asesmen dari tabel mingguan ───────────────────────────
  const dariMingguan: Calon[] = [];
  const kodeTerpakai = new Set<string>();

  for (const p of sumber.pertemuan) {
    if (p.bobot <= TOLERANSI) continue;
    const ujian = p.jenis !== "EFEKTIF";

    let kode = ujian ? p.jenis : `M${p.minggu}`;
    if (kodeTerpakai.has(kode)) kode = `${kode}-M${p.minggu}`;
    kodeTerpakai.add(kode);

    dariMingguan.push({
      kode,
      nama:
        p.penilaianJenis?.trim() ||
        (ujian ? `Ujian ${p.jenis}` : `Penilaian minggu ${p.minggu}`),
      asal: ujian ? "UJIAN" : "MINGGUAN",
      komponen: p.komponen,
      bobot: p.bobot,
      minggu: [p.minggu],
      subCpmk: [],
      pembagian: "TIDAK_ADA",
      subKode: [...new Set(p.subCpmkKode)],
      jenisUjian: p.jenis === "EFEKTIF" ? null : p.jenis,
    });
  }

  // ── 2 · Komponen mana yang sudah dirinci tabel mingguan ─────────────
  const dirinciMingguan = new Map<string, number>();
  for (const c of dariMingguan) {
    if (c.komponen === null) continue;
    dirinciMingguan.set(c.komponen, (dirinciMingguan.get(c.komponen) ?? 0) + c.bobot);
  }

  // ── 3 · Lembar tugas: bobot tambahan, atau sekadar rencana? ─────────
  const dariTugas: Calon[] = [];
  const bobotTugasPerKomponen = new Map<string, number>();

  for (const t of sumber.tugas) {
    if (t.bobot <= TOLERANSI) continue;

    if (t.komponen !== null && dirinciMingguan.has(t.komponen)) {
      // Komponennya sudah dirinci baris mingguan. Menambahkan bobot tugas di
      // atasnya berarti menghitung tagihan yang sama dua kali.
      bobotTugasPerKomponen.set(
        t.komponen,
        (bobotTugasPerKomponen.get(t.komponen) ?? 0) + t.bobot,
      );
      continue;
    }

    const kode = `T${t.nomor}`;
    kodeTerpakai.add(kode);
    dariTugas.push({
      kode,
      nama: t.nama,
      asal: "TUGAS",
      komponen: t.komponen,
      bobot: t.bobot,
      minggu: rentangMinggu(t.mingguMulai, t.mingguSelesai),
      subCpmk: [],
      pembagian: "TIDAK_ADA",
      subKode: [...new Set(t.subCpmkKode)],
      jenisUjian: null,
    });
  }

  for (const [komponen, bobotTugas] of bobotTugasPerKomponen) {
    const bobotMingguan = dirinciMingguan.get(komponen) ?? 0;
    if (Math.abs(bobotTugas - bobotMingguan) > TOLERANSI) {
      temuan.push({
        kode: "PA-TUGAS-BEDA-BOBOT",
        tingkat: "PERINGATAN",
        pesan:
          `Lembar tugas pada komponen "${komponen}" menyebut bobot ${bulatkan(bobotTugas, 2)}%, ` +
          `sedangkan baris mingguan komponen itu berjumlah ${bulatkan(bobotMingguan, 2)}%.`,
        saran:
          "Bobot diambil dari baris mingguan. Samakan angkanya agar lembar tugas tidak menyesatkan.",
      });
    }
  }

  const calon = [...dariMingguan, ...dariTugas];

  // ── 4 · Tiap asesmen berbobot wajib menunjuk satu komponen ──────────
  for (const c of calon) {
    if (c.komponen === null) {
      temuan.push({
        kode: "PA-TANPA-KOMPONEN",
        tingkat: "PEMBLOKIR",
        pesan: `${c.kode} (${c.nama}) berbobot ${bulatkan(c.bobot, 2)}% tetapi tidak masuk komponen nilai mana pun.`,
        minggu: c.asal === "TUGAS" ? undefined : c.minggu[0],
        saran: "Tanpa komponen, bobotnya tidak dapat direkonsiliasi dan nilainya tidak dapat dikumpulkan.",
      });
    }
  }

  // ── 5 · Tiap komponen berbobot wajib dirinci, dan jumlahnya cocok ───
  const bobotPerKomponen = new Map<string, number>();
  for (const c of calon) {
    if (c.komponen === null) continue;
    bobotPerKomponen.set(c.komponen, (bobotPerKomponen.get(c.komponen) ?? 0) + c.bobot);
  }

  for (const k of sumber.komponenNilai) {
    if (k.bobot <= TOLERANSI) continue;
    const dirinci = bobotPerKomponen.get(k.nama);
    if (dirinci === undefined) {
      temuan.push({
        kode: "PA-KOMPONEN-TANPA-ASESMEN",
        tingkat: "PEMBLOKIR",
        pesan: `Komponen "${k.nama}" berbobot ${bulatkan(k.bobot, 2)}% tetapi tidak dirinci baris mingguan maupun lembar tugas.`,
        saran: "Komponen tanpa asesmen berarti ada nilai yang tidak pernah bisa dikumpulkan.",
      });
    } else if (Math.abs(dirinci - k.bobot) > TOLERANSI) {
      temuan.push({
        kode: "PA-KOMPONEN-TIDAK-COCOK",
        tingkat: "PEMBLOKIR",
        pesan:
          `Asesmen pada komponen "${k.nama}" berjumlah ${bulatkan(dirinci, 2)}%, ` +
          `sedangkan komponennya ${bulatkan(k.bobot, 2)}%.`,
      });
    }
  }

  const totalBobot = bulatkan(calon.reduce((s, c) => s + c.bobot, 0), 2);
  if (calon.length === 0) {
    temuan.push({
      kode: "PA-KOSONG",
      tingkat: "PEMBLOKIR",
      pesan: "Belum ada satu pun asesmen berbobot pada mata kuliah ini.",
    });
  } else if (Math.abs(totalBobot - 100) > TOLERANSI) {
    temuan.push({
      kode: "PA-TOTAL",
      tingkat: "PEMBLOKIR",
      pesan: `Seluruh asesmen berjumlah ${totalBobot}%, seharusnya 100%.`,
    });
  }

  // ── 6 · Membagi bobot tiap asesmen ke Sub-CPMK ──────────────────────
  const kisiPerJenis = new Map(sumber.kisiKisi.map((k) => [k.jenis, k]));

  for (const c of calon) {
    const kisi = c.jenisUjian ? kisiPerJenis.get(c.jenisUjian) : undefined;
    const totalSkor = kisi?.butir.reduce((s, b) => s + b.skor, 0) ?? 0;

    if (kisi && totalSkor > 0) {
      // Kisi-kisi menyatakan porsi tiap Sub-CPMK secara eksplisit — pakai itu.
      const per = new Map<string, number>();
      for (const b of kisi.butir) {
        per.set(b.subCpmkKode, (per.get(b.subCpmkKode) ?? 0) + b.skor);
      }
      c.subCpmk = [...per.entries()].map(([kode, skor]) => ({
        kode,
        bobot: bulatkan((skor / totalSkor) * c.bobot, 4),
      }));
      c.pembagian = "KISI_KISI";
      continue;
    }

    if (c.subKode.length === 0) {
      c.pembagian = "TIDAK_ADA";
      temuan.push({
        kode: "PA-ASESMEN-TANPA-SUB-CPMK",
        tingkat: "PEMBLOKIR",
        pesan: `${c.kode} (${c.nama}) berbobot ${bulatkan(c.bobot, 2)}% tetapi tidak menagih Sub-CPMK mana pun.`,
        minggu: c.asal === "TUGAS" ? undefined : c.minggu[0],
        saran: "Bobotnya tidak mengalir ke capaian mana pun — nilainya hanya jadi angka akhir.",
      });
      continue;
    }

    // Tanpa kisi-kisi, tidak ada dasar untuk membagi tidak rata.
    const bagian = c.bobot / c.subKode.length;
    c.subCpmk = c.subKode.map((kode) => ({ kode, bobot: bulatkan(bagian, 4) }));
    c.pembagian = "RATA";

    if (c.jenisUjian) {
      temuan.push({
        kode: "PA-UJIAN-TANPA-KISI-KISI",
        tingkat: "PERINGATAN",
        pesan: `Bobot ${c.kode} dibagi rata ke ${c.subKode.length} Sub-CPMK karena kisi-kisinya belum diisi.`,
        saran: "Kisi-kisi membuat porsi tiap Sub-CPMK mengikuti skor butir, bukan tebakan rata.",
      });
    }
  }

  // ── 7 · Agregasi Sub-CPMK → CPMK → CPL ──────────────────────────────
  const bobotSubCpmk: Record<string, number> = {};
  for (const c of calon) {
    for (const s of c.subCpmk) {
      bobotSubCpmk[s.kode] = bulatkan((bobotSubCpmk[s.kode] ?? 0) + s.bobot, 4);
    }
  }

  const bobotCpmk: Record<string, number> = {};
  const subCpmkSeluruh: string[] = [];
  for (const c of sumber.cpmk) {
    subCpmkSeluruh.push(...c.subCpmkKode);
    bobotCpmk[c.kode] = bulatkan(
      c.subCpmkKode.reduce((s, k) => s + (bobotSubCpmk[k] ?? 0), 0),
      4,
    );
  }

  const belumDinilai = subCpmkSeluruh.filter((k) => (bobotSubCpmk[k] ?? 0) <= TOLERANSI);
  if (belumDinilai.length > 0) {
    temuan.push({
      kode: "PA-SUB-CPMK-TANPA-BOBOT",
      tingkat: "PEMBLOKIR",
      pesan:
        `${belumDinilai.length} Sub-CPMK tidak mendapat bobot penilaian: ` +
        `${belumDinilai.slice(0, 5).join(", ")}${belumDinilai.length > 5 ? ", …" : ""}.`,
      saran: "Capaiannya tidak akan pernah terukur, sehingga CPL di atasnya ikut menggantung.",
    });
  }

  // Sub-CPMK yang dinilai tetapi bukan milik mata kuliah ini menandakan peta
  // yang bocor — lebih baik ketahuan di sini daripada muncul sebagai capaian.
  const setSeluruh = new Set(subCpmkSeluruh);
  for (const kode of Object.keys(bobotSubCpmk)) {
    if (!setSeluruh.has(kode)) {
      temuan.push({
        kode: "PA-SUB-CPMK-ASING",
        tingkat: "PEMBLOKIR",
        pesan: `Asesmen menagih ${kode}, yang bukan milik mata kuliah ini.`,
      });
    }
  }

  const cpl: KontribusiCpl[] = sumber.cplDibebankan.map((kodeCpl) => {
    const penjabar = sumber.cpmk.filter((c) => c.cplKode.includes(kodeCpl));
    const total = penjabar.reduce((s, c) => s + (bobotCpmk[c.kode] ?? 0), 0);
    return {
      kode: kodeCpl,
      bobot: bulatkan(total, 4),
      cpmk: penjabar.map((c) => ({
        kode: c.kode,
        bobot: bobotCpmk[c.kode] ?? 0,
        kontribusi: total > 0 ? bulatkan(((bobotCpmk[c.kode] ?? 0) / total) * 100, 2) : 0,
      })),
    };
  });

  const cplKosong = cpl.filter((c) => c.bobot <= TOLERANSI);
  if (cplKosong.length > 0) {
    temuan.push({
      kode: "PA-CPL-TANPA-BOBOT",
      tingkat: "PEMBLOKIR",
      pesan:
        `CPL ${cplKosong.map((c) => c.kode).join(", ")} dibebankan pada mata kuliah ini ` +
        `tetapi tidak pernah dinilai.`,
      saran:
        "Beban CPL tanpa asesmen adalah temuan B3 pada docs/02 §2.1 — janji kurikulum yang tak bisa dibuktikan.",
    });
  }

  const asesmen: Asesmen[] = calon.map(({ subKode: _s, jenisUjian: _j, ...a }) => a);
  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");

  return {
    asesmen,
    temuan,
    pemblokir,
    peringatan: temuan.filter((t) => t.tingkat === "PERINGATAN"),
    lolos: pemblokir.length === 0,
    bobotSubCpmk,
    bobotCpmk,
    cpl,
    ringkasan: {
      totalBobot,
      jumlahAsesmen: asesmen.length,
      subCpmkTerukur: subCpmkSeluruh.filter((k) => (bobotSubCpmk[k] ?? 0) > TOLERANSI).length,
      subCpmkSeluruh: subCpmkSeluruh.length,
      cplTerukur: cpl.filter((c) => c.bobot > TOLERANSI).length,
      cplDibebankan: sumber.cplDibebankan.length,
    },
  };
}

/**
 * Komponen nilai → kode Sub-CPMK yang benar-benar dinilai lewat komponen itu.
 *
 * Inilah isi tabel distribusi penilaian pada bagian E dokumen ITTS. Sebelum
 * ada peta asesmen, tanda √ diturunkan langsung dari `pertemuan.subCpmk`,
 * sehingga kolom UTS dan UAS selalu kosong: baris ujian pada tabel mingguan
 * memang tidak menempel Sub-CPMK — Sub-CPMK ujian hidup di kisi-kisi. Akibatnya
 * dokumen menyatakan bahwa ujian tidak mengukur capaian apa pun.
 *
 * Lewat peta, sumber tanda √ menjadi seragam: dari mana pun bobot sebuah
 * komponen dirinci — baris mingguan, lembar tugas, atau butir kisi-kisi —
 * Sub-CPMK yang ditagihnya sampai ke tabel yang sama.
 */
export function petaKomponenSubCpmk(
  peta: Pick<PetaAsesmen, "asesmen">,
): Map<string, Set<string>> {
  const hasil = new Map<string, Set<string>>();
  for (const a of peta.asesmen) {
    if (a.komponen === null) continue;
    const set = hasil.get(a.komponen) ?? new Set<string>();
    for (const s of a.subCpmk) {
      if (s.bobot > 0) set.add(s.kode);
    }
    hasil.set(a.komponen, set);
  }
  return hasil;
}

function rentangMinggu(mulai: number, selesai: number): number[] {
  if (selesai < mulai) return [mulai];
  return Array.from({ length: selesai - mulai + 1 }, (_, i) => mulai + i);
}
