import { daftarRingkas } from "@/domain/temuan";
import { deteksiKko } from "@/domain/kurikulum/bloom";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Pemeriksaan naskah yang dapat dihitung mesin — docs/19 §2.1.
 *
 * Semua yang ada di berkas ini deterministik, gratis, dan dapat diuji. Karena
 * itu ia TIDAK dikirim ke model (docs/19 E4): menyuruh dosen membayar token
 * untuk menghitung panjang kalimat berarti membayar untuk pekerjaan yang
 * jawabannya pasti — dan menerima jawaban yang kadang berbeda tiap kali
 * ditanya.
 *
 * Yang tersisa untuk model adalah yang menuntut PERTIMBANGAN: kalimat yang
 * membingungkan, penjelasan yang melompat, bab yang mengulang bab lain.
 *
 * Murni: tanpa Prisma, tanpa React.
 */

/** Kalimat lebih panjang dari ini menyulitkan pembaca semester tiga. */
export const BATAS_KATA_KALIMAT = 30;
/** Paragraf yang lebih tebal dari ini menuntut dibaca dua kali. */
export const BATAS_KATA_PARAGRAF = 150;
/** Istilah dianggap mapan setelah muncul sesering ini. */
const AMBANG_ISTILAH = 3;
/** Bab dianggap timpang bila panjangnya di luar rentang ini terhadap rata-rata. */
const TIMPANG_BAWAH = 0.4;
const TIMPANG_ATAS = 2.2;

export interface BabNaskah {
  nomor: number;
  judul: string;
  tujuan: string[];
  uraian: string | null;
  ringkasan: string | null;
  /** Nomor pustaka yang disitir bab ini. */
  sitiran: number[];
}

export interface NaskahBuku {
  bab: BabNaskah[];
  glosarium: { istilah: string; arti: string }[];
  pustaka: { nomor: number }[];
}

export interface HasilNaskah {
  temuan: TemuanBahanAjar[];
  ringkasan: {
    jumlahKata: number;
    /** Taksiran tebal, ±350 kata per halaman B5. Lihat `taksiranHalaman`. */
    taksiranHalaman: number;
    kalimatPanjang: number;
    paragrafPanjang: number;
  };
}

/** Kata dalam sebuah teks; tanda baca tidak dihitung sebagai kata. */
export function hitungKata(teks: string): number {
  return (teks.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
}

/**
 * Taksiran tebal naskah.
 *
 * Angka 350 kata per halaman adalah taksiran untuk B5 berhuruf 11pt dengan
 * tepi yang kita pakai. Ia TAKSIRAN, dan disebut begitu di layar: tebal
 * sesungguhnya baru diketahui setelah ditata, dan gambar maupun halaman awal
 * ikut menggeser angkanya.
 */
export function taksiranHalaman(jumlahKata: number): number {
  return Math.max(1, Math.ceil(jumlahKata / 350));
}

/** Memecah teks menjadi kalimat. Tanda titik pada singkatan ikut terpotong. */
function kalimatDari(teks: string): string[] {
  return teks
    .split(/(?<=[.!?])\s+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function paragrafDari(uraian: string): string[] {
  return uraian
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function periksaNaskah(buku: NaskahBuku): HasilNaskah {
  const temuan: TemuanBahanAjar[] = [];
  const tandai = (
    kode: string,
    params?: TemuanBahanAjar["params"],
    bab?: number,
  ) => {
    temuan.push({ kode, tingkat: "PERINGATAN", ...(params ? { params } : {}), bab });
  };

  let jumlahKata = 0;
  let kalimatPanjang = 0;
  let paragrafPanjang = 0;
  const panjangBab = new Map<number, number>();

  for (const bab of buku.bab) {
    const uraian = bab.uraian ?? "";
    const kata = hitungKata(uraian);
    jumlahKata += kata;
    panjangBab.set(bab.nomor, kata);

    const panjangKalimat: string[] = [];
    for (const paragraf of paragrafDari(uraian)) {
      if (hitungKata(paragraf) > BATAS_KATA_PARAGRAF) paragrafPanjang++;
      for (const kalimat of kalimatDari(paragraf)) {
        if (hitungKata(kalimat) > BATAS_KATA_KALIMAT) {
          kalimatPanjang++;
          // Potongan awalnya cukup untuk menemukannya kembali di naskah.
          if (panjangKalimat.length < 3) panjangKalimat.push(potong(kalimat));
        }
      }
    }

    if (panjangKalimat.length > 0) {
      tandai(
        "NS-KALIMAT-PANJANG",
        { n: BATAS_KATA_KALIMAT, daftar: daftarRingkas(panjangKalimat, 3) },
        bab.nomor,
      );
    }

    // ── Tujuan yang tidak tersentuh uraian ────────────────────────────
    /*
     * Pemeriksaan paling khas OBE di seluruh aplikasi. Bab yang menjanjikan
     * "mahasiswa mampu MENGHITUNG kompleksitas" tetapi tidak pernah menghitung
     * apa pun tidak melanggar satu aturan tata bahasa pun — ia hanya gagal
     * mengajar apa yang dijanjikannya, dan itu tidak terlihat oleh siapa pun
     * yang membaca babnya sepotong-sepotong.
     */
    const tujuanLuput: string[] = [];
    const isiBab = `${uraian}\n${bab.ringkasan ?? ""}`.toLocaleLowerCase("id");
    for (const tujuan of bab.tujuan) {
      const kko = deteksiKko(tujuan);
      if (!kko) continue;
      // Kata dasar dicari, bukan bentuk berimbuhannya: "menghitung" pada
      // tujuan sering muncul sebagai "dihitung" atau "perhitungan" di uraian.
      const dasar = akarKko(kko.kko);
      if (!isiBab.includes(dasar)) tujuanLuput.push(kko.kko);
    }
    if (tujuanLuput.length > 0) {
      tandai(
        "NS-TUJUAN-TAK-TERSENTUH",
        { jumlah: tujuanLuput.length, daftar: daftarRingkas(tujuanLuput) },
        bab.nomor,
      );
    }

    if (uraian.trim() !== "" && bab.sitiran.length === 0) {
      tandai("NS-BAB-TANPA-SITIRAN", undefined, bab.nomor);
    }
  }

  if (paragrafPanjang > 0) {
    tandai("NS-PARAGRAF-PANJANG", { jumlah: paragrafPanjang, n: BATAS_KATA_PARAGRAF });
  }

  // ── Bab yang timpang panjangnya ─────────────────────────────────────
  const berisi = [...panjangBab.entries()].filter(([, kata]) => kata > 0);
  if (berisi.length >= 3) {
    const rata = berisi.reduce((s, [, k]) => s + k, 0) / berisi.length;
    const timpang = berisi
      .filter(([, k]) => k < rata * TIMPANG_BAWAH || k > rata * TIMPANG_ATAS)
      .map(([nomor]) => String(nomor));
    if (timpang.length > 0) {
      tandai("NS-BAB-TIMPANG", { daftar: daftarRingkas(timpang) });
    }
  }

  // ── Ejaan istilah yang tidak seragam ────────────────────────────────
  const takSeragam = istilahTakSeragam(buku.bab.map((b) => b.uraian ?? "").join("\n"));
  if (takSeragam.length > 0) {
    tandai("NS-ISTILAH-TAK-SERAGAM", {
      jumlah: takSeragam.length,
      daftar: daftarRingkas(takSeragam.map((v) => v.join(" / ")), 3),
    });
  }

  // ── Pustaka dan glosarium ───────────────────────────────────────────
  const disitir = new Set(buku.bab.flatMap((b) => b.sitiran));
  const menganggur = buku.pustaka.filter((p) => !disitir.has(p.nomor)).map((p) => String(p.nomor));
  if (menganggur.length > 0) {
    tandai("NS-PUSTAKA-TAK-DISITIR", {
      jumlah: menganggur.length,
      daftar: daftarRingkas(menganggur),
    });
  }

  const seluruhIsi = buku.bab
    .map((b) => `${b.uraian ?? ""} ${b.ringkasan ?? ""}`)
    .join("\n")
    .toLocaleLowerCase("id");
  const takDipakai = buku.glosarium
    .filter((g) => !seluruhIsi.includes(g.istilah.toLocaleLowerCase("id")))
    .map((g) => g.istilah);
  if (takDipakai.length > 0) {
    tandai("NS-GLOSARIUM-TAK-DIPAKAI", {
      jumlah: takDipakai.length,
      daftar: daftarRingkas(takDipakai),
    });
  }

  return {
    temuan,
    ringkasan: {
      jumlahKata,
      taksiranHalaman: taksiranHalaman(jumlahKata),
      kalimatPanjang,
      paragrafPanjang,
    },
  };
}

/**
 * Istilah yang ditulis beberapa cara: beda huruf besar, tanda hubung, atau
 * spasi.
 *
 * Dicari dengan menormalkan setiap kata lalu mengumpulkan bentuk permukaannya.
 * Hanya kata yang sudah muncul beberapa kali yang dinilai — sebuah kata yang
 * muncul sekali di awal kalimat dan sekali di tengah bukan ketidakseragaman,
 * melainkan tata tulis biasa.
 */
export function istilahTakSeragam(teks: string): string[][] {
  const bentuk = new Map<string, Map<string, number>>();

  for (const kata of teks.match(/[\p{L}][\p{L}\p{N}-]{3,}/gu) ?? []) {
    const kunci = kata.toLocaleLowerCase("id").replace(/-/g, "");
    const daftar = bentuk.get(kunci) ?? new Map<string, number>();
    daftar.set(kata, (daftar.get(kata) ?? 0) + 1);
    bentuk.set(kunci, daftar);
  }

  const hasil: string[][] = [];
  for (const daftar of bentuk.values()) {
    const total = [...daftar.values()].reduce((a, b) => a + b, 0);
    if (daftar.size < 2 || total < AMBANG_ISTILAH) continue;

    /*
     * Perbedaan yang HANYA huruf besar di awal kata diabaikan: itu awal
     * kalimat, bukan istilah yang tidak seragam. Yang dilaporkan adalah
     * perbedaan yang tersisa sesudah huruf pertama disamakan.
     */
    const varian = [...daftar.keys()];
    const tanpaAwal = new Set(varian.map((v) => v.charAt(0).toLowerCase() + v.slice(1)));
    if (tanpaAwal.size < 2) continue;

    hasil.push(varian.sort());
  }

  return hasil.slice(0, 20);
}

/**
 * Akar sebuah kata kerja operasional.
 *
 * "menghitung" dicari sebagai "hitung" supaya "dihitung", "perhitungan", dan
 * "menghitungnya" ikut terhitung. Peluruhan bahasa Indonesia jauh lebih rumit
 * daripada ini, dan itu disengaja: yang dicari bukan analisis morfologi
 * melainkan petunjuk bahwa pokoknya memang dibahas. Salah kira di sini
 * menghasilkan satu peringatan yang dapat diabaikan dosen, bukan naskah yang
 * rusak.
 */
function akarKko(kko: string): string {
  const k = kko.toLocaleLowerCase("id");
  const tanpaAwalan = k
    .replace(/^meng(?=[aiueogh])/, "")
    .replace(/^meny(?=[aiueo])/, "s")
    .replace(/^mem(?=[aiueo])/, "")
    .replace(/^men(?=[aiueo])/, "")
    .replace(/^me(?:m|n|ng|ny)?/, "")
    .replace(/^ber/, "")
    .replace(/^ter/, "");
  const inti = tanpaAwalan.replace(/kan$/, "").replace(/i$/, "");
  // Terlalu pendek berarti peluruhannya keliru; pakai kata aslinya.
  return inti.length >= 4 ? inti : k;
}

function potong(teks: string, maks = 60): string {
  return teks.length <= maks ? teks : `${teks.slice(0, maks).trimEnd()}…`;
}
