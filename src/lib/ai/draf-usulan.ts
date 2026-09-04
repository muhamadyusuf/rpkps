import "server-only";
import { KKO_TIDAK_TERUKUR, LEVEL_BLOOM } from "@/domain/kurikulum/bloom";
import type { ButirDraf } from "@/domain/kurikulum/draf-usulan";
import type { KonteksDraf } from "@/lib/kurikulum/bahan-draf";
import { jalankanTugasAi } from "./gerbang";
import { pakaiKredensial } from "./kredensial";
import { SkemaDrafUsulan } from "./skema-draf-usulan";

/**
 * Tugas AI: menyusun draf butir Usulan Revisi Kurikulum — fase U3b.
 * Acuan: docs/04-usulan-revisi-kurikulum.md §9.
 *
 * Yang dikerjakan tahap ini adalah **transkripsi**, bukan penilaian (§9.1):
 * mengubah temuan yang sudah terstruktur menjadi butir usulan yang juga
 * terstruktur. Keputusannya tetap milik dosen, lalu Kaprodi.
 *
 * Modul ini TIDAK menyimpan apa pun dan TIDAK memeriksa apa pun. Ia memanggil
 * gerbang, lalu memetakan jawaban model ke bentuk `ButirDraf` yang sengaja
 * longgar. Yang memutuskan butir mana boleh hidup adalah `saringDrafUsulan` di
 * domain — murni, teruji tanpa AI, dan itulah satu-satunya penjaga §9.2.
 */

/** Kamus KKO dirender dari sumber yang sama dengan validator, agar tidak pernah berbeda. */
function kamusKko(): string {
  return LEVEL_BLOOM.map(
    (l) => `${l.level} ${l.nama} (${l.ranah.toLowerCase()}): ${l.kko.join(", ")}`,
  ).join("\n");
}

/**
 * Blok STABIL yang di-cache penyedia. Dirakit sekali saat modul dimuat; tidak
 * boleh memuat apa pun yang berubah per permintaan (docs/01 §4.3).
 */
const PANDUAN = `Anda membantu seorang dosen menyusun draf Usulan Revisi Kurikulum
untuk satu mata kuliah pada program studi berbasis OBE. Usulan ini nanti dibaca
dan diputuskan Ketua Program Studi, butir demi butir.

Tugas Anda adalah MENTRANSKRIPSI temuan yang sudah ada menjadi butir usulan
yang rapi — bukan menilai ulang kurikulumnya, dan bukan mengusulkan perubahan
yang tidak berdasar pada satu pun temuan atau catatan yang diberikan.

# Struktur data

CPL (Capaian Pembelajaran Lulusan) milik program studi. Setiap mata kuliah
dibebani sejumlah CPL. Setiap CPMK (Capaian Pembelajaran Mata Kuliah)
menjabarkan satu atau lebih CPL yang dibebankan pada mata kuliahnya. Setiap
CPMK diuraikan menjadi Sub-CPMK, yaitu tahapan belajar — umumnya satu per
pertemuan mingguan.

# Kamus kata kerja operasional (KKO) taksonomi Bloom revisi

${kamusKko()}

Kata kerja berikut TIDAK dapat diamati sehingga tidak boleh dipakai dalam
rumusan Sub-CPMK maupun CPMK:
${KKO_TIDAK_TERUKUR.join(", ")}.

# Jenis butir yang boleh Anda susun

CPMK_RUMUSAN — menulis ulang rumusan atau menaikkan level satu CPMK yang ada.
  Isi: cpmk_kode, rumusan, level_bloom.
SUB_RUMUSAN — menulis ulang rumusan satu Sub-CPMK yang ada.
  Isi: cpmk_kode, sub_cpmk_kode, rumusan, level_bloom.
SUB_BARU — menambah Sub-CPMK baru pada CPMK yang ada.
  Isi: cpmk_kode, sub_cpmk_kode (kode BARU, mengikuti pola induknya), rumusan,
  level_bloom.
CPMK_BARU — menambah CPMK baru. Hanya bila ada temuan yang menuntutnya;
  "sepertinya perlu" bukan dasar.
  Isi: cpmk_kode (kode BARU), rumusan, level_bloom.
CPMK_PETA_CPL — mengganti SELURUH daftar CPL yang dijabarkan sebuah CPMK.
  Isi: cpmk_kode, cpl_kode (daftar LENGKAP, bukan tambahan saja).
SUB_MINGGU — mengusulkan pekan pelaksanaan sebuah Sub-CPMK yang ada.
  Isi: cpmk_kode, sub_cpmk_kode, minggu_disarankan.
CATATAN_CPL — catatan bahwa persoalannya sebenarnya ada di rumusan CPL prodi,
  bukan di mata kuliah ini. Tidak pernah diterapkan otomatis; ia pesan untuk
  Kaprodi.
  Isi: cpmk_kode (yang paling bersangkutan), alasan.

Medan yang tidak relevan bagi sebuah jenis diisi kosong: "" untuk teks, []
untuk daftar.

# Yang TIDAK boleh Anda usulkan

- Mempensiunkan CPMK atau Sub-CPMK. Mempensiunkan capaian adalah penilaian atas
  program, bukan perbaikan kalimat, dan akibatnya menjangkau RPKPS tahun
  berikutnya. Jalurnya tetap manual.
- Ralat (perbaikan yang mengaku tidak mengubah makna). Itu penilaian yang hanya
  boleh diambil manusia.
- Mengubah kode apa pun yang sudah ada. Kode hanya Anda tulis untuk MENUNJUK
  sasaran, dan untuk capaian yang benar-benar baru.

# Dasar — bagian terpenting panduan ini

Setiap butir WAJIB bersandar pada dasar yang nyata, dan Anda TIDAK PERNAH
menulis dasar. Anda hanya MEMILIH dari katalog <dasar> pada permintaan:

- \`dasar_ref\`: salin persis nilai \`ref\` dari katalog. Boleh lebih dari satu.
  Ref yang tidak ada di katalog membuat butirnya DIBUANG server, bukan
  diperbaiki.
- \`kutipan_catatan\`: hanya bila dosen menulis catatan, dan isinya WAJIB
  potongan verbatim — disalin huruf demi huruf — dari catatan itu. Jangan
  merangkum, jangan memperbaiki tata bahasanya, jangan menulis kalimat sendiri
  lalu melabelinya catatan dosen.
- Sebuah dasar hanya sah bagi sasarannya sendiri. Temuan pada CPMK081-3 bukan
  alasan mengubah CPMK081-7. Satu-satunya kelonggaran: temuan pada sebuah
  Sub-CPMK boleh menjadi dasar memperbaiki CPMK INDUKNYA.

Butir tanpa satu pun dasar akan dibuang. Lebih baik mengembalikan daftar
kosong daripada mengarang dasar.

# Aturan yang mengikat

1. Kode CPL yang Anda sebut harus berasal dari daftar CPL yang dibebankan pada
   mata kuliah ini. Jangan pernah mengarang kode CPL.
2. Level Sub-CPMK tidak boleh melampaui level CPMK induknya.
3. Satu rumusan mengandung tepat satu KKO utama.
4. Rumusan ditulis dalam bahasa Indonesia akademik, diawali "Mahasiswa mampu",
   dan menggambarkan perilaku yang dapat diamati serta dinilai.
5. Pertahankan substansi keilmuan aslinya. Anda memperbaiki cara merumuskan,
   bukan mengganti materi yang diajarkan.
6. Setiap butir mencantumkan \`alasan\` berbahasa Indonesia — satu sampai dua
   kalimat, sekurang-kurangnya 20 karakter — yang menjelaskan mengapa
   perbaikan itu diperlukan. Alasan inilah yang dibaca Kaprodi.
7. Satu butir menangani satu sasaran. Jangan membuat dua butir sejenis untuk
   Sub-CPMK yang sama.
8. Bila sebuah temuan tidak dapat Anda perbaiki tanpa menebak substansi yang
   tidak ada pada konteks, lewati saja.`;

export interface HasilDrafUsulan {
  /** Bentuk longgar; belum disaring. Penyaringnya `saringDrafUsulan`. */
  butir: ButirDraf[];
  penyedia: string;
  model: string;
}

export async function susunDrafUsulan(opsi: {
  penggunaId: string;
  usulanId: string;
  konteks: KonteksDraf;
  /** Kosong berarti kunci bawaan dosen. */
  kredensialId?: string | null;
}): Promise<HasilDrafUsulan> {
  const { konteks } = opsi;

  const hasil = await jalankanTugasAi({
    kodeTugas: "DRAF_USULAN",
    penggunaId: opsi.penggunaId,
    entitasId: opsi.usulanId,
    terpilih: await pakaiKredensial(opsi.penggunaId, opsi.kredensialId),
    panduan: PANDUAN,
    permintaan:
      "Berikut mata kuliah beserta capaiannya, katalog dasar yang tersedia, " +
      "dan catatan dosen bila ada. Susun butir usulan untuk dasar yang dapat " +
      "Anda tangani.\n\n" +
      "<mata_kuliah>\n" +
      JSON.stringify(
        {
          mataKuliah: konteks.mataKuliah,
          cplDibebankan: konteks.cplDibebankan,
          cpmk: konteks.cpmk,
        },
        null,
        2,
      ) +
      "\n</mata_kuliah>\n\n<dasar>\n" +
      JSON.stringify(konteks.dasar, null, 2) +
      "\n</dasar>\n\n<catatan_dosen>\n" +
      (konteks.catatanDosen ?? "(dosen tidak menulis catatan)") +
      "\n</catatan_dosen>",
    skema: SkemaDrafUsulan,
  });

  const butir = hasil.data.butir.map(
    (b): ButirDraf => ({
      jenis: b.jenis,
      cpmkKode: b.cpmk_kode,
      subCpmkKode: b.sub_cpmk_kode || null,
      rumusan: b.rumusan || null,
      levelBloom: b.level_bloom || null,
      cplKode: b.cpl_kode,
      mingguDisarankan: b.minggu_disarankan,
      alasan: b.alasan,
      dasarRef: b.dasar_ref,
      kutipanCatatan: b.kutipan_catatan || null,
    }),
  );

  return { butir, penyedia: hasil.penyedia, model: hasil.model };
}
