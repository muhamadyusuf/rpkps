import "server-only";
import {
  rapikanIsiBab,
  rapikanKelengkapan,
  rapikanSlide,
  type IsiBabSiap,
  type KelengkapanSiap,
  type SlideSiap,
} from "@/domain/bahan-ajar/keluaran";
import {
  rapikanDiagram,
  type DiagramSiap,
} from "@/domain/bahan-ajar/keluaran-diagram";
import { JENIS_MERMAID } from "@/domain/bahan-ajar/mermaid-aman";
import { PALET, TEBAL_GARIS, UKURAN_TEKS_MINIMAL } from "@/domain/bahan-ajar/gaya-svg";
import type { BahasaBuku, TemuanBahanAjar } from "@/domain/bahan-ajar/tipe";
import { GalatAi } from "./galat";
import { jalankanTugasAi } from "./gerbang";
import { pakaiKredensial } from "./kredensial";
import {
  SkemaBab,
  SkemaKelengkapan,
  SkemaKerangkaBuku,
  SkemaSlideBab,
  type KeluaranKerangkaBuku,
} from "./skema-buku";
import { SkemaDiagram } from "./skema-diagram";
import {
  SkemaSinopsis,
  SkemaSuntingBab,
  SkemaTinjauNaskah,
  type KeluaranSinopsis,
} from "./skema-sunting";
import { BATAS_KATA_KALIMAT, BATAS_KATA_PARAGRAF } from "@/domain/bahan-ajar/naskah";

/**
 * Tugas AI: menyusun buku ajar dari RPKPS — docs/16 §3.
 *
 * Empat tahap, dan tiga di antaranya dipanggil BERULANG:
 *
 *   1. BUKU_KERANGKA     sekali    judul buku dan peta bab
 *   2. BUKU_BAB          per bab   uraian, studi kasus, ringkasan, latihan
 *   3. BUKU_SLIDE        per bab   slide beserta catatan pembicara
 *   4. BUKU_KELENGKAPAN  sekali    prakata, pendahuluan, glosarium, biografi
 *   5. BUKU_DIAGRAM      per bab   diagram vektor sebagai KODE (docs/17)
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
 * Tahap 5: diagram bab — docs/17.
 *
 * Panduan terpanjang di berkas ini, dan panjangnya disengaja. Permintaan
 * dosennya berbunyi "gambarnya jangan terlihat seperti hasil AI", dan yang
 * membuat sebuah gambar terbaca begitu dapat disebut satu per satu: gradien,
 * bayangan, garis yang menebal-menipis, warna yang berganti-ganti, label
 * sekecil apa pun asal muat. Semuanya disebut di sini — dan semuanya juga
 * ditegakkan `periksaGayaSvg` di domain, karena panduan dapat dilanggar.
 */
const PANDUAN_DIAGRAM = `${PANDUAN_DASAR}

# TAHAP 5 DARI 5 — DIAGRAM SATU BAB

Isi bab sudah final dan diberikan kepada Anda. Susun 2-5 diagram yang
BENAR-BENAR MENJELASKAN isinya. Bab yang tidak menuntut gambar boleh Anda
kembalikan dengan daftar kosong — diagram yang dipaksakan lebih buruk daripada
halaman tanpa gambar, dan tidak ada yang menilai Anda dari jumlahnya.

Anda TIDAK menghasilkan gambar. Anda menulis KODE diagram, dan mesin yang
menggambarnya. Karena itu label pada diagram Anda adalah teks sungguhan yang
selalu terbaca — bukan bentuk yang menyerupai huruf.

# Memilih bentuk

Pakai MERMAID bila tata letaknya boleh dihitung mesin:
alur dan percabangan keputusan, diagram urutan, diagram keadaan, relasi
entitas, diagram kelas, garis waktu. Jenis yang boleh: ${JENIS_MERMAID.join(", ")}.

Pakai SVG bila POSISI membawa arti dan karena itu tidak boleh dihitung mesin:
struktur data berindeks (larik, tumpukan, antrean), pohon yang letak simpulnya
bermakna, sumbu koordinat dan grafik fungsi, diagram blok berskala, skema
teknis.

Memaksakan Mermaid pada hal yang posisinya bermakna menghasilkan graf yang
menjelaskan lebih sedikit daripada satu larik bernomor. Memaksakan SVG pada
alur bercabang menghasilkan label yang bertumpuk.

# Aturan Mermaid

- Jangan menulis arahan konfigurasi (%%{init: ...}%%). Temanya dipasang buku.
- Jangan menulis style, classDef, atau linkStyle. Warnanya milik buku.
- Jangan menulis click maupun tautan. Diagram cetak tidak diklik siapa pun.
- Jangan memakai markah HTML di dalam label. Ia tidak akan tampil sama sekali.

# Aturan SVG - CETAKAN GAYA

Setiap butir di bawah diperiksa mesin. Yang melanggar DIBUANG, bukan
diperbaiki, dan babnya kehilangan gambar itu.

- viewBox WAJIB, lebarnya 800 satuan. JANGAN menulis width maupun height pada
  tag svg - lebar cetak yang menentukan, bukan gambarnya.
- Tanpa gradien, tanpa filter, tanpa bayangan, tanpa transparansi. Ketiganya
  adalah rupa gambar bikinan mesin dan tidak menjelaskan apa pun yang tidak
  dapat dijelaskan garis serta isian rata.
- Warna HANYA dari palet ini: ${[...PALET].filter((w) => w.startsWith("#")).join(", ")},
  ditambah "none". Tidak ada warna lain, sedekat apa pun.
- Ketebalan garis HANYA ${[...TEBAL_GARIS].join(" atau ")}.
- Teks memakai font-family="Times New Roman, Liberation Serif, serif" dan
  font-size sekurang-kurangnya ${UKURAN_TEKS_MINIMAL}.
- Teks ditulis sebagai <text>, TIDAK PERNAH sebagai <foreignObject>. Label
  foreignObject tidak dirender sama sekali pada berkas cetak.
- Tidak ada <script>, <image>, <style>, animasi, maupun rujukan ke alamat luar.
- Susun tata letaknya sendiri dengan hati-hati: hitung lebar teks kira-kira 0,5
  kali font-size per aksara, dan pastikan tidak ada label yang bertumpuk atau
  keluar dari viewBox.

# Medan lain

- judul: keterangan gambar, satu frasa. Tanpa kata "Gambar" dan tanpa nomor -
  nomornya diberikan sistem.
- alt: satu kalimat yang menjelaskan isi gambar bagi pembaca yang tidak dapat
  melihatnya. Bukan pengulangan judul.
- letak: judul subbab tempat gambar itu berada, DISALIN PERSIS dari uraian bab.
  Yang tidak cocok akan jatuh ke akhir bab.`;

/**
 * Tahap penyuntingan naskah — docs/19.
 *
 * Model bekerja sebagai EDITOR, dan panduannya menyebut itu terang-terangan.
 * Yang membedakannya dari tahap penulisan bukan nada melainkan BENTUK
 * KELUARANNYA: skema hanya menerima pasangan kutipan–pengganti–alasan, jadi
 * "bab yang sudah saya perbaiki" tidak punya tempat untuk dituliskan.
 */
const PANDUAN_SUNTING = `${PANDUAN_DASAR}

# TAHAP PENYUNTINGAN — ANDA EDITOR, BUKAN PENULIS

Naskah bab sudah ada. Anda TIDAK menulis ulang dan TIDAK menambah isi baru.
Yang Anda lakukan persis pekerjaan editor naskah: menunjuk potongan tertentu,
mengusulkan penggantinya, dan menyebut alasannya. Dosen yang memutuskan.

Untuk tiap usulan:

- kutipan: SALIN PERSIS potongan dari uraian bab, apa adanya, termasuk tanda
  bacanya. Bila kutipan Anda tidak dapat ditemukan kembali di dalam naskah,
  usulan itu tidak dapat diterapkan dan terbuang percuma. Salin satu kalimat
  utuh, bukan sepotong frasa yang muncul di banyak tempat.
- usul: penggantinya. Kosongkan HANYA bila potongan itu sebaiknya dihapus.
- alasan: satu kalimat, menyebut APA yang diperbaiki. "Lebih baik" bukan
  alasan; "kalimat 40 kata dipecah menjadi dua" adalah alasan.
- jenis: BAHASA, ISTILAH, PENGULANGAN, TUJUAN, atau STRUKTUR.

# Yang layak diusulkan

- Kalimat yang membingungkan, berbelit, atau bermakna ganda.
- Istilah yang berganti-ganti untuk satu konsep yang sama.
- Penjelasan yang melompat: kesimpulan tanpa langkah yang menuju ke sana.
- Bagian yang tidak menopang satu pun tujuan pembelajaran bab ini.
- Kalimat lebih dari ${BATAS_KATA_KALIMAT} kata dan paragraf lebih dari
  ${BATAS_KATA_PARAGRAF} kata — TETAPI hanya bila panjangnya memang
  menyulitkan; panjang saja sudah dihitung mesin dan tidak perlu Anda laporkan.

# Yang TIDAK layak diusulkan

- Perubahan selera: sinonim yang sama baiknya, susunan kalimat yang sama
  jelasnya. Setiap usulan menuntut waktu baca dosen; usulan yang tidak
  memperbaiki apa pun membuatnya berhenti membaca sisanya.
- Menambah pokok bahasan baru, contoh baru, atau sumber baru. Itu penulisan.
- Mengubah rumusan tujuan pembelajaran. Tujuan berasal dari buku kurikulum.
- Perbaikan yang sudah dikerjakan mesin: panjang kalimat, ejaan istilah yang
  tidak seragam, dan kata kerja tujuan yang tidak muncul di uraian.

Delapan usulan yang benar-benar memperbaiki lebih berguna daripada tiga puluh
yang harus disaring sendiri oleh dosen. Bab yang memang sudah baik boleh Anda
kembalikan dengan daftar kosong.`;

/** Tinjauan lintas bab: pekerjaan yang tidak dapat dilihat dari satu bab. */
const PANDUAN_TINJAU = `${PANDUAN_DASAR}

# TAHAP TINJAUAN NASKAH — SELURUH BUKU SEKALIGUS

Anda diberi judul dan RINGKASAN tiap bab beserta daftar istilah yang dipakai.
Yang Anda cari hanya hal-hal yang MUSTAHIL terlihat dari satu bab saja:

- Pengulangan: dua bab menjelaskan pokok yang sama dari awal.
- Lompatan urutan: sebuah istilah dipakai jauh sebelum bab yang
  mendefinisikannya.
- Istilah yang sebaiknya diseragamkan di seluruh buku, beserta bentuk mana
  yang sebaiknya dipakai.
- Bab yang urutannya lebih masuk akal bila dipindahkan.

Sebutkan nomor bab yang paling bersangkutan; isi 0 bila temuannya menyangkut
seluruh buku. Anda TIDAK mengutip kalimat pada tahap ini — Anda hanya melihat
ringkasan, dan mengarang kutipan berarti mengarang naskah.

Jangan melaporkan hal yang hanya dapat dinilai dari naskah penuh, dan jangan
mengulang temuan yang sama untuk beberapa bab sekaligus.`;

/** Sinopsis sampul belakang dan kata kunci — bahan penerbit. */
const PANDUAN_SINOPSIS = `${PANDUAN_DASAR}

# SINOPSIS SAMPUL BELAKANG

Susun satu paragraf 80-120 kata yang dibaca calon pembaca di belakang sampul:
untuk siapa buku ini, apa yang dibahasnya, dan apa yang akan dikuasai
pembacanya setelah menuntaskannya. Menjelaskan, bukan memuji — hindari kata
seperti "komprehensif", "terlengkap", dan "wajib dimiliki".

Tambahkan 5-8 kata kunci: istilah bidang yang benar-benar dibahas buku ini,
yang akan dipakai orang untuk menemukannya di katalog perpustakaan.

Anda TIDAK menuliskan penerbit, tahun terbit, ISBN, maupun harga.`;

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
  // Kode SVG boros token: satu diagram sedang berkisar 1.500 token, dan
  // limanya sudah mendekati anggaran ini.
  diagram: 10_000,
  // Penyuntingan mengembalikan kutipan BESERTA penggantinya, jadi tiap usulan
  // menghabiskan dua kali panjang potongannya.
  sunting: 8_000,
  tinjau: 6_000,
  sinopsis: 2_000,
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

export async function susunDiagramBab(opsi: {
  penggunaId: string;
  bukuId: string;
  bahasa: BahasaBuku;
  bab: {
    nomor: number;
    judul: string;
    tujuan: string[];
    uraian: string;
    /** Judul subbab yang ada di bab ini; `letak` harus salah satunya. */
    subbab: string[];
  };
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<DiagramSiap[]>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId,
    terpilih,
    kodeTugas: "BUKU_DIAGRAM",
    panduan: PANDUAN_DIAGRAM,
    permintaan: [
      `Susun diagram untuk bab ${opsi.bab.nomor}.`,
      arahanBahasa(opsi.bahasa),
      bungkus("bab", opsi.bab),
    ].join("\n\n"),
    skema: SkemaDiagram,
    maxTokens: ANGGARAN.diagram,
  });

  /*
   * Diagram yang tidak lolos DIBUANG di domain, tidak ditambal. Menambal SVG
   * berarti menulis ulang gambar sampai ia lolos pemeriksaan, dan hasilnya
   * gambar yang tidak pernah dilihat siapa pun sebelum tercetak.
   */
  const { hasil, catatan } = rapikanDiagram(jawaban.data.gambar, {
    bab: opsi.bab.nomor,
  });

  return { hasil, catatan, penyedia: jawaban.penyedia, model: jawaban.model };
}

export interface UsulanSuntingAi {
  /** Kutipan persis dari uraian; null untuk temuan lintas bab. */
  kutipan: string | null;
  usul: string;
  alasan: string;
  jenis: "BAHASA" | "ISTILAH" | "PENGULANGAN" | "TUJUAN" | "STRUKTUR";
  /** Nomor bab; null bila menyangkut seluruh buku. */
  bab: number | null;
}

/**
 * Menyunting satu bab — docs/19 §2.2.
 *
 * Mengembalikan USULAN, tidak pernah naskah. Kutipan yang tidak dapat
 * ditemukan kembali di dalam uraian DIBUANG di sini: usulan yang tidak dapat
 * diterapkan hanya menghabiskan waktu baca dosen, dan yang paling sering
 * menyebabkannya adalah model yang merapikan kutipannya sendiri sambil
 * menyalin.
 */
export async function suntingBab(opsi: {
  penggunaId: string;
  bukuId: string;
  bahasa: BahasaBuku;
  bab: { nomor: number; judul: string; tujuan: string[]; uraian: string };
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<UsulanSuntingAi[]>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId,
    terpilih,
    kodeTugas: "SUNTING_BAB",
    panduan: PANDUAN_SUNTING,
    permintaan: [
      `Sunting bab ${opsi.bab.nomor}.`,
      arahanBahasa(opsi.bahasa),
      bungkus("bab", opsi.bab),
    ].join("\n\n"),
    skema: SkemaSuntingBab,
    maxTokens: ANGGARAN.sunting,
  });

  const hasil: UsulanSuntingAi[] = [];
  let takDitemukan = 0;

  for (const u of jawaban.data.usulan) {
    const kutipan = u.kutipan.trim();
    const alasan = u.alasan.trim();
    if (!kutipan || !alasan) continue;
    if (!opsi.bab.uraian.includes(kutipan)) {
      takDitemukan++;
      continue;
    }
    hasil.push({ kutipan, usul: u.usul.trim(), alasan, jenis: u.jenis, bab: opsi.bab.nomor });
  }

  const catatan: TemuanBahanAjar[] =
    takDitemukan > 0
      ? [
          {
            kode: "SU-KUTIPAN-TAK-DITEMUKAN",
            tingkat: "INFO",
            params: { jumlah: takDitemukan },
            bab: opsi.bab.nomor,
          },
        ]
      : [];

  return { hasil, catatan, penyedia: jawaban.penyedia, model: jawaban.model };
}

/** Tinjauan lintas bab, dari RINGKASAN — bukan naskah penuh (docs/19 §2.2). */
export async function tinjauNaskah(opsi: {
  penggunaId: string;
  bukuId: string;
  bahasa: BahasaBuku;
  judulBuku: string;
  bab: { nomor: number; judul: string; ringkasan: string; istilah: string[] }[];
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<UsulanSuntingAi[]>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId,
    terpilih,
    kodeTugas: "TINJAU_NASKAH",
    panduan: PANDUAN_TINJAU,
    permintaan: [
      `Tinjau naskah buku "${opsi.judulBuku}".`,
      arahanBahasa(opsi.bahasa),
      bungkus("bab", opsi.bab),
    ].join("\n\n"),
    skema: SkemaTinjauNaskah,
    maxTokens: ANGGARAN.tinjau,
  });

  const nomorSah = new Set(opsi.bab.map((b) => b.nomor));
  const hasil: UsulanSuntingAi[] = jawaban.data.temuan
    .filter((t) => t.usul.trim() && t.alasan.trim())
    .map((t) => ({
      kutipan: null,
      usul: t.usul.trim(),
      alasan: t.alasan.trim(),
      jenis: t.jenis,
      // Nomor bab yang tidak ada di buku diperlakukan sebagai temuan
      // seluruh buku, bukan dibuang: isinya tetap dapat berguna.
      bab: nomorSah.has(t.bab) ? t.bab : null,
    }));

  return { hasil, catatan: [], penyedia: jawaban.penyedia, model: jawaban.model };
}

/** Sinopsis sampul belakang beserta kata kuncinya — docs/19 §4.1. */
export async function susunSinopsis(opsi: {
  penggunaId: string;
  bukuId: string;
  konteks: KonteksBuku;
  ringkasanBab: { nomor: number; judul: string; ringkasan: string }[];
  kredensialId?: string | null;
}): Promise<HasilTugasBuku<KeluaranSinopsis>> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const jawaban = await jalankanTugasAi({
    penggunaId: opsi.penggunaId,
    entitasId: opsi.bukuId,
    terpilih,
    kodeTugas: "BUKU_SINOPSIS",
    panduan: PANDUAN_SINOPSIS,
    permintaan: [
      "Susun sinopsis sampul belakang untuk buku berikut.",
      arahanBahasa(opsi.konteks.bahasa),
      bungkus("buku", ringkasBuku(opsi.konteks)),
      bungkus("bab", opsi.ringkasanBab),
    ].join("\n\n"),
    skema: SkemaSinopsis,
    maxTokens: ANGGARAN.sinopsis,
  });

  return {
    hasil: {
      sinopsis: jawaban.data.sinopsis.trim(),
      kata_kunci: jawaban.data.kata_kunci
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8),
    },
    catatan: [],
    penyedia: jawaban.penyedia,
    model: jawaban.model,
  };
}

/**
 * Ilustrasi raster — docs/17 §6.
 *
 * Bukan jalur utama, dan syaratnya disebut terang-terangan:
 *
 * - **Hanya penyedia yang mendukung.** `gambar()` opsional pada antarmuka
 *   `Penyedia`; ketiadaannya menghasilkan kalimat yang menyebut sebabnya,
 *   BUKAN pergantian ke penyedia lain. Kunci milik dosen tidak boleh dipakai
 *   membayar layanan yang tidak dipilihnya.
 * - **Tidak untuk apa pun yang faktual.** Larangannya ada di perintah yang
 *   dikirim, dan alasannya bukan kehati-hatian berlebihan: model penghasil
 *   gambar tidak tahu apa-apa tentang alat yang digambarnya, dan buku ajar
 *   yang menggambarkan alat secara keliru mengajarkan hal yang keliru.
 * - **Selalu berketerangan.** Pemanggil menyimpannya dengan `sumber =
 *   AI_RASTER`, dan pencetak membubuhkan keterangan asalnya di bawah gambar.
 */
export async function susunIlustrasiRaster(opsi: {
  penggunaId: string;
  bukuId: string;
  bahasa: BahasaBuku;
  /** Apa yang hendak digambarkan, ditulis dosen sendiri. */
  perintah: string;
  konteksBab: { nomor: number; judul: string };
  kredensialId?: string | null;
}): Promise<{ png: Uint8Array; penyedia: string; model: string }> {
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  if (!terpilih.penyedia.gambar || !terpilih.penyedia.modelGambarBawaan) {
    throw new GalatAi(
      `Penyedia ${terpilih.penyedia.kode} tidak menghasilkan gambar. ` +
        "Fitur ini hanya tersedia pada kunci Gemini; kunci Anda yang lain tetap " +
        "dapat menyusun diagram, yang justru bentuk gambar yang dianjurkan untuk buku ajar.",
    );
  }

  const model = terpilih.penyedia.modelGambarBawaan;
  const mulai = Date.now();

  const perintah = [
    `Ilustrasi untuk buku ajar, bab ${opsi.konteksBab.nomor} "${opsi.konteksBab.judul}".`,
    opsi.perintah.trim(),
    "Gambar bergaya ilustrasi buku yang tenang: garis bersih, warna terbatas, tanpa teks apa pun di dalam gambar.",
    "JANGAN menggambarkan diagram, grafik, peta, anatomi, skema alat, atau apa pun yang pembaca akan anggap sebagai keterangan teknis.",
  ].join("\n\n");

  const jawaban = await terpilih.penyedia.gambar({ model, perintah });

  await catatPemakaianGambar(opsi.penggunaId, opsi.bukuId, terpilih, model, Date.now() - mulai);

  return { png: jawaban.png, penyedia: terpilih.penyedia.kode, model };
}

/**
 * Mencatat pemakaian gambar ke log audit.
 *
 * `jalankanTugasAi` tidak dapat dipakai: gerbang itu seluruhnya bertumpu pada
 * keluaran terstruktur, sedangkan yang kembali di sini adalah bita. Yang
 * dicatat tetap sama — siapa memanggil apa, dengan kunci dan penyedia mana.
 */
async function catatPemakaianGambar(
  penggunaId: string,
  bukuId: string,
  terpilih: { penyedia: { kode: string }; kredensialId: string },
  model: string,
  latensiMs: number,
) {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.logAudit.create({
      data: {
        penggunaId,
        aksi: "AI_BUKU_ILUSTRASI",
        entitas: "ai",
        entitasId: bukuId,
        ringkasan: `${terpilih.penyedia.kode}/${model} · ${latensiMs} ms`,
        data: {
          penyedia: terpilih.penyedia.kode,
          model,
          kredensialId: terpilih.kredensialId,
          latensiMs,
        },
      },
    });
  } catch (galat) {
    console.error("[ai] gagal mencatat pemakaian gambar:", galat);
  }
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
