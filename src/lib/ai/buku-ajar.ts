import "server-only";
import {
  rapikanIsiBab,
  rapikanKelengkapan,
  rapikanSlide,
  type IsiBabSiap,
  type KelengkapanSiap,
  type SlideSiap,
} from "@/domain/bahan-ajar/keluaran";
import type { BahasaBuku, TemuanBahanAjar } from "@/domain/bahan-ajar/tipe";
import { jalankanTugasAi } from "./gerbang";
import { pakaiKredensial } from "./kredensial";
import {
  SkemaBab,
  SkemaKelengkapan,
  SkemaKerangkaBuku,
  SkemaSlideBab,
  type KeluaranKerangkaBuku,
} from "./skema-buku";

/**
 * Tugas AI: menyusun buku ajar dari RPKPS — docs/16 §3.
 *
 * Empat tahap, dan tiga di antaranya dipanggil BERULANG:
 *
 *   1. BUKU_KERANGKA     sekali    judul buku dan peta bab
 *   2. BUKU_BAB          per bab   uraian, studi kasus, ringkasan, latihan
 *   3. BUKU_SLIDE        per bab   slide beserta catatan pembicara
 *   4. BUKU_KELENGKAPAN  sekali    prakata, pendahuluan, glosarium, biografi
 *
 * # Mengapa satu panggilan per bab
 *
 * Satu bab buku ajar yang layak terbit adalah 3.000–6.000 token keluaran.
 * Empat belas bab sekaligus mustahil muat dan pasti berakhir `TERPOTONG` —
 * dengan seluruh anggaran hangus tanpa menghasilkan apa pun. Yang penting
 * bukan sekadar memecahnya, melainkan bahwa PEMANGGIL menyimpan tiap bab
 * begitu ia selesai: kegagalan di bab 9 tidak boleh menghanguskan bab 1–8.
 *
 * Karena itu modul ini sengaja TIDAK menyediakan "susun semua bab". Perulangan
 * itu milik antarmuka, yang memanggil `susunIsiBab` bab demi bab dan
 * menyimpannya satu per satu (docs/16 §3.2). Satu Server Action yang menunggu
 * empat belas panggilan akan menabrak batas waktu, dan dosen kehilangan
 * seluruh pekerjaan tanpa tahu sampai mana.
 *
 * # Kunci dosen
 *
 * Tiap tahap membuka kredensial SEKALI lewat `pakaiKredensial` lalu
 * meneruskannya ke gerbang — satu tugas, satu pembukaan. Tidak ada klien SDK
 * yang disimpan di variabel modul: kunci dosen berikutnya akan diabaikan dan
 * tagihannya salah alamat.
 */

/**
 * Blok STABIL yang di-cache penyedia — jangan sisipkan apa pun yang berubah.
 *
 * Dipakai sebagai awalan yang sama persis di keempat tahap. Satu byte yang
 * berbeda membatalkan cache, jadi bagian ini tidak menyebut mata kuliah, nama
 * dosen, bahasa, maupun tahap mana pun secara khusus.
 */
const PANDUAN_DASAR = `Anda menulis BUKU AJAR untuk mahasiswa program sarjana,
disusun dari Rencana Program dan Kegiatan Pembelajaran Semester (RPKPS) sebuah
mata kuliah. Buku ini akan dicetak dan didaftarkan ISBN, jadi tulisannya harus
berdiri sendiri: mahasiswa membacanya tanpa kehadiran dosen.

Anda menghasilkan DRAF. Dosen pengampu adalah PENULIS buku ini; namanya yang
tercetak di sampul, dan ia yang menyunting serta bertanggung jawab atas isi
akhirnya.

# Yang Anda tulis, dan yang bukan

Anda menulis PROSA yang menjelaskan. Bukan RPKPS, bukan silabus, bukan daftar
poin. Sebuah bab yang baik membuka dengan mengapa pokok ini penting,
menjelaskan konsepnya secara bertahap dengan contoh, lalu menutup dengan
ringkasan. Paragraf utuh, bukan butir-butir bertanda hubung.

# Yang sudah ditetapkan dan TIDAK boleh Anda ubah

- Judul bab dan urutannya. Keduanya berasal dari rencana mingguan RPKPS.
- Tujuan pembelajaran tiap bab. Berasal dari indikator dan Sub-CPMK pada buku
  kurikulum; Anda menulis isi yang MEMENUHI tujuan itu, bukan menggantinya.
- Daftar pustaka. Lihat aturan sitiran di bawah.

# Aturan sitiran — dibaca sebelum menulis satu kalimat pun

Anda diberi daftar pustaka RPKPS beserta NOMORNYA. Bila Anda merujuk sebuah
sumber, sebutkan nomornya pada medan sitiran. Anda TIDAK BOLEH:

- menyebut buku, jurnal, atau penulis yang tidak ada pada daftar itu;
- mengarang tahun terbit, nomor halaman, ISBN, atau DOI;
- menyalin utuh kalimat dari sumber mana pun.

Sitiran yang menunjuk nomor di luar daftar akan DIBUANG oleh sistem, dan bagian
teks yang bersandar padanya akan berdiri tanpa rujukan. Bila sebuah pokok
membutuhkan sumber yang tidak tersedia, tulislah pokok itu dengan penjelasan
Anda sendiri tanpa menyebut sumber apa pun.

# Kejujuran akademik

Buku ini akan beredar dengan nama seorang dosen sebagai penulisnya. Jangan
menuliskan apa pun yang Anda tidak yakini benar: angka statistik, kutipan
tokoh, nomor regulasi, standar industri, maupun sejarah suatu bidang. Bila
sebuah contoh perlu angka, buatlah contoh yang jelas-jelas ilustratif.

# Cara mengosongkan sebuah isian

Skema keluaran tidak mengenal null. Isian yang tidak berlaku diisi string
KOSONG (""). Jangan menuliskan kata "null", "-", "tidak ada", atau tanda apa
pun sebagai pengganti isi.`;

/** Tahap 1: peta bab. Belum ada satu kalimat isi pun. */
const PANDUAN_KERANGKA = `${PANDUAN_DASAR}

# TAHAP 1 DARI 4 — KERANGKA BUKU

Pada tahap ini Anda menetapkan judul buku dan memastikan peta babnya runtut.
Anda BELUM menulis isi bab mana pun.

- judul_buku: judul yang pantas untuk sampul buku ajar, bukan nama mata kuliah
  yang disalin apa adanya. Singkat, menyebut pokok bidangnya.
- subjudul: penjelas satu baris, mis. "Pendekatan Praktis untuk Mahasiswa
  Teknik Informatika". Isi "" bila judulnya sudah cukup berdiri sendiri.
- bab: SELURUH bab pada konteks, dengan nomor dan judul PERSIS seperti yang
  diberikan. Yang Anda tambahkan hanya "alur": satu kalimat tentang apa yang
  dikerjakan bab itu dalam keseluruhan buku, dan bagaimana ia bersandar pada
  bab sebelumnya. Kalimat inilah yang menjaga bab-bab tidak saling mengulang
  ketika ditulis satu per satu pada tahap berikutnya.

Jangan menambah, menghapus, menggabungkan, atau menomori ulang bab.`;

/** Tahap 2: satu bab utuh. Inti pekerjaan. */
const PANDUAN_BAB = `${PANDUAN_DASAR}

# TAHAP 2 DARI 4 — ISI SATU BAB

Anda menulis SATU bab, yang disebutkan pada konteks. Bab lain sudah atau akan
ditulis pada panggilan tersendiri; judul bab tetangga diberikan supaya Anda
tidak mengulang bahasan mereka.

- uraian: isi utama bab. Susun dalam 3–6 subbab bernomor "1.", "2.", dan
  seterusnya, masing-masing dibuka judul subbab pada barisnya sendiri lalu
  paragraf penjelasannya. Ikuti subtopik yang diberikan pada konteks bila ada.
  Setiap konsep yang diperkenalkan dijelaskan, bukan sekadar disebut; sertakan
  contoh terselesaikan bila pokoknya menuntut perhitungan atau prosedur.
  Panjang yang diharapkan 1.200–2.000 kata.
- studi_kasus: satu kasus yang menerapkan isi bab pada situasi nyata, beserta
  pembahasannya. Isi "" bila pokok bab ini tidak cocok distudikasuskan.
- ringkasan: 5–8 kalimat yang merangkum bab, ditulis sebagai paragraf, bukan
  daftar.
- latihan: 4–8 soal yang menguji tujuan pembelajaran bab ini. Tiap soal WAJIB
  disertai kunci atau rambu jawaban pada medan "kunci" — kunci disimpan
  terpisah dari soal, sehingga berkas untuk mahasiswa dapat dicetak tanpanya.
  Medan "bloom" diisi level taksonomi soal itu, dan tidak boleh melampaui level
  Sub-CPMK bab ini.
- sitiran: nomor pustaka yang benar-benar Anda rujuk di bab ini.

Tulis isi yang khas untuk pokok bab INI. Kalimat generik yang sama-sama cocok
untuk bab mana pun adalah tanda bab ini belum ditulis.`;

/** Tahap 3: slide, disusun dari bab yang sudah final. */
const PANDUAN_SLIDE = `${PANDUAN_DASAR}

# TAHAP 3 DARI 4 — SLIDE SATU BAB

Isi bab sudah final dan diberikan kepada Anda. Ubah menjadi bahan presentasi
kuliah untuk satu pertemuan.

- 8–15 slide, berurutan: pembuka (judul dan tujuan), isi mengikuti subbab, lalu
  penutup berisi ringkasan dan latihan.
- judul: judul slide, singkat.
- butir: 3–5 butir per slide, masing-masing satu baris pendek. Slide bukan
  tempat paragraf; yang panjang masuk ke catatan.
- catatan: apa yang dosen katakan saat slide itu tampil, 2–4 kalimat. Ini
  menjadi catatan pembicara dan TIDAK tercetak di badan slide.

Jangan memperkenalkan konsep yang tidak ada di bab. Slide adalah ringkasan
bahan yang sama, bukan bahan baru.`;

/** Tahap 4: kelengkapan, hanya mungkin setelah seluruh bab ada. */
const PANDUAN_KELENGKAPAN = `${PANDUAN_DASAR}

# TAHAP 4 DARI 4 — KELENGKAPAN BUKU

Seluruh bab sudah ditulis. Anda diberi judul dan RINGKASAN tiap bab — bukan isi
penuhnya — dan menyusun bagian yang mengikat buku menjadi satu.

- prakata: 3–5 paragraf. Untuk siapa buku ini ditulis, apa yang diandaikan
  sudah dikuasai pembaca, bagaimana buku ini disusun, dan bagaimana sebaiknya
  dibaca. Ditulis dengan suara PENULIS buku, bukan suara pihak ketiga.
- pendahuluan: bab pembuka yang memperkenalkan bidangnya secara utuh dan
  menempatkan bab-bab berikutnya di dalamnya, 600–1.000 kata.
- glosarium: 15–30 istilah penting yang benar-benar muncul di dalam bab-bab,
  masing-masing dengan penjelasan satu sampai dua kalimat. Jangan memasukkan
  istilah yang tidak dibahas buku ini.
- biografi: 2–4 kalimat kerangka biografi penulis yang akan DISUNTING dosen —
  bidang keahlian dan pengampuan mata kuliah ini. JANGAN mengarang gelar,
  riwayat pendidikan, jabatan, penghargaan, atau angka pengalaman.

Anda TIDAK menuliskan penerbit, tahun terbit, edisi, nomor ISBN, maupun
kalimat hak cipta. Itu diisi dosen, dan nomor yang salah akan ikut beredar
bersama bukunya.`;

/**
 * Anggaran keluaran tiap tahap.
 *
 * Diturunkan dari kebutuhan nyata: satu bab 1.200–2.000 kata prosa Indonesia
 * berkisar 3.000–5.000 token, ditambah latihan beserta kuncinya dan ruang
 * untuk token penalaran yang ikut ditagih sebagai keluaran.
 */
const ANGGARAN = {
  kerangka: 4_000,
  bab: 12_000,
  slide: 5_000,
  kelengkapan: 8_000,
} as const;

const NAMA_BAHASA: Record<BahasaBuku, string> = {
  id: "bahasa Indonesia akademik",
  en: "bahasa Inggris akademik",
};

/**
 * Perintah bahasa hidup di blok BERUBAH, bukan di panduan.
 *
 * Menyisipkannya ke `PANDUAN_DASAR` akan melahirkan dua varian blok stabil dan
 * membelah cache prompt tanpa alasan.
 */
function arahanBahasa(bahasa: BahasaBuku): string {
  return `Tulis seluruh keluaran dalam ${NAMA_BAHASA[bahasa]}.`;
}

function bungkus(nama: string, isi: unknown): string {
  return `<${nama}>\n${JSON.stringify(isi, null, 2)}\n</${nama}>`;
}

// ─────────────────────────────────────────────────────────────
// KONTEKS
// ─────────────────────────────────────────────────────────────

export interface KonteksBuku {
  bahasa: BahasaBuku;
  mataKuliah: { kode: string; nama: string; sks: number; semester: number };
  prodi: string;
  /** Pustaka RPKPS beserta nomornya — satu-satunya sumber sitiran yang sah. */
  pustaka: { nomor: number; jenis: string; teks: string }[];
  bab: { nomor: number; judul: string; tujuan: string[] }[];
}

export interface KonteksBab {
  nomor: number;
  judul: string;
  minggu: number;
  tujuan: string[];
  subtopik: string[];
  subCpmk: { kode: string; rumusan: string; bloom?: string }[];
  alur?: string;
  judulBabSebelum?: string;
  judulBabSesudah?: string;
}

export interface HasilTugasBuku<T> {
  hasil: T;
  /** Perbaikan deterministik atas keluaran model; kosong berarti tidak ada. */
  catatan: TemuanBahanAjar[];
  penyedia: string;
  model: string;
}

// ─────────────────────────────────────────────────────────────
// TAHAP
// ─────────────────────────────────────────────────────────────

export async function susunKerangkaBuku(opsi: {
  penggunaId: string;
  bukuId?: string;
  rpkpsId: string;
  konteks: KonteksBuku;
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<KeluaranKerangkaBuku>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId ?? opsi.rpkpsId,
    terpilih,
    kodeTugas: "BUKU_KERANGKA",
    panduan: PANDUAN_KERANGKA,
    permintaan: [
      "Susun kerangka buku ajar untuk mata kuliah berikut.",
      arahanBahasa(opsi.konteks.bahasa),
      bungkus("buku", opsi.konteks),
    ].join("\n\n"),
    skema: SkemaKerangkaBuku,
    maxTokens: ANGGARAN.kerangka,
  });

  return {
    hasil: jawaban.data,
    catatan: [],
    penyedia: jawaban.penyedia,
    model: jawaban.model,
  };
}

export async function susunIsiBab(opsi: {
  penggunaId: string;
  bukuId: string;
  konteks: KonteksBuku;
  bab: KonteksBab;
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<IsiBabSiap>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId,
    terpilih,
    kodeTugas: "BUKU_BAB",
    panduan: PANDUAN_BAB,
    permintaan: [
      `Tulis bab ${opsi.bab.nomor} dari buku berikut.`,
      arahanBahasa(opsi.konteks.bahasa),
      bungkus("buku", ringkasBuku(opsi.konteks)),
      bungkus("bab", opsi.bab),
      bungkus("pustaka", opsi.konteks.pustaka),
    ].join("\n\n"),
    skema: SkemaBab,
    maxTokens: ANGGARAN.bab,
  });

  const { hasil, catatan } = rapikanIsiBab(jawaban.data, {
    nomorPustakaTersedia: opsi.konteks.pustaka.map((p) => p.nomor),
    bab: opsi.bab.nomor,
  });

  return { hasil, catatan, penyedia: jawaban.penyedia, model: jawaban.model };
}

export async function susunSlideBab(opsi: {
  penggunaId: string;
  bukuId: string;
  bahasa: BahasaBuku;
  bab: {
    nomor: number;
    judul: string;
    tujuan: string[];
    uraian: string;
    ringkasan: string | null;
  };
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<SlideSiap[]>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId,
    terpilih,
    kodeTugas: "BUKU_SLIDE",
    panduan: PANDUAN_SLIDE,
    permintaan: [
      `Susun slide untuk bab ${opsi.bab.nomor}.`,
      arahanBahasa(opsi.bahasa),
      bungkus("bab", opsi.bab),
    ].join("\n\n"),
    skema: SkemaSlideBab,
    maxTokens: ANGGARAN.slide,
  });

  const { hasil, catatan } = rapikanSlide(jawaban.data.slide, { bab: opsi.bab.nomor });
  return { hasil, catatan, penyedia: jawaban.penyedia, model: jawaban.model };
}

export async function susunKelengkapan(opsi: {
  penggunaId: string;
  bukuId: string;
  konteks: KonteksBuku;
  /** Judul dan RINGKASAN tiap bab — bukan isi penuhnya. Lihat docs/16 §3.4. */
  ringkasanBab: { nomor: number; judul: string; ringkasan: string }[];
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<KelengkapanSiap>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId,
    terpilih,
    kodeTugas: "BUKU_KELENGKAPAN",
    panduan: PANDUAN_KELENGKAPAN,
    permintaan: [
      "Susun kelengkapan buku berikut. Seluruh babnya sudah ditulis.",
      arahanBahasa(opsi.konteks.bahasa),
      bungkus("buku", ringkasBuku(opsi.konteks)),
      bungkus("bab", opsi.ringkasanBab),
    ].join("\n\n"),
    skema: SkemaKelengkapan,
    maxTokens: ANGGARAN.kelengkapan,
  });

  const { hasil, catatan } = rapikanKelengkapan(jawaban.data);
  return { hasil, catatan, penyedia: jawaban.penyedia, model: jawaban.model };
}

/**
 * Konteks buku tanpa daftar pustaka dan tanpa tujuan tiap bab.
 *
 * Dipakai tahap yang sudah menerima keduanya lewat blok tersendiri. Mengirim
 * dua salinan daftar yang sama menaikkan ongkos masukan tiap bab — empat belas
 * kali untuk satu buku — tanpa menambah satu keterangan pun.
 */
function ringkasBuku(k: KonteksBuku) {
  return {
    mataKuliah: k.mataKuliah,
    prodi: k.prodi,
    bab: k.bab.map((b) => ({ nomor: b.nomor, judul: b.judul })),
  };
}
