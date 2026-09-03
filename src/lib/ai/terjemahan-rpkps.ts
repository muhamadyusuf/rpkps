import "server-only";
import { z } from "zod";
import type { MedanTerjemahan } from "@/domain/rpkps/terjemahan";
import { medanKurang, saringHasilTerjemahan } from "@/domain/rpkps/terjemahan";
import { GalatAi } from "./galat";
import { jalankanTugasAi } from "./gerbang";
import type { PenyediaTerpilih } from "./klien";
import { pakaiKredensial } from "./kredensial";

/**
 * Tugas AI: menerjemahkan isi RPKPS ke bahasa Inggris.
 *
 * Aturan BYOK berlaku utuh (docs/08 §4): kredensial hanya lewat
 * `pakaiKredensial()`, dibuka SEKALI di awal lalu adapternya dipakai ulang
 * untuk seluruh gelombang. Satu tugas tetap satu kunci — berapa pun permintaan
 * jaringan yang dibutuhkannya di dalam.
 *
 * Hasilnya DRAF. Tidak ada yang ditulis ke basis data oleh berkas ini; dosen
 * meninjau lalu menerapkannya sendiri (docs/11 §8).
 */

const SkemaKeluaran = z.object({
  terjemahan: z.array(
    z.object({
      alamat: z.string(),
      teks: z.string(),
    }),
  ),
});

/**
 * Glosarium istilah OBE, dikunci.
 *
 * Tanpa ini satu dokumen akan memakai tiga istilah berbeda untuk CPMK di tiga
 * bagian — dan pembaca yang membandingkannya dengan naskah Indonesia tidak
 * dapat menelusuri mana yang mana.
 */
const GLOSARIUM = `CPL (Capaian Pembelajaran Lulusan) → Programme Learning Outcomes (CPL)
CPMK (Capaian Pembelajaran Mata Kuliah) → Course Learning Outcomes (CPMK)
Sub-CPMK → Lesson Learning Outcomes (Sub-CPMK)
sks → credit units
RPKPS → RPKPS (jangan diterjemahkan)
UTS → midterm exam
UAS → final exam
Tatap Muka (TM) → contact hours
Penugasan Terstruktur (PT) → structured assignment
Belajar Mandiri (BM) → independent study
Prodi / Program Studi → study programme
Kaprodi / Ketua Program Studi → Head of Study Programme
Penjaminan Mutu → Quality Assurance
Kisi-kisi → exam blueprint
Bahan kajian → body of knowledge
Profil lulusan → graduate profile`;

/**
 * Blok STABIL yang di-cache penyedia. Dirakit sekali saat modul dimuat; tidak
 * boleh memuat apa pun yang berubah per permintaan (docs/01 §4.3).
 */
const PANDUAN = `Anda menerjemahkan isi dokumen RPKPS (rencana pembelajaran semester)
sebuah perguruan tinggi Indonesia dari bahasa Indonesia ke bahasa Inggris
akademik.

Anda menerima daftar medan. Setiap medan punya ALAMAT dan TEKS. Kembalikan
terjemahan setiap medan beserta alamatnya yang sama persis.

# Glosarium — wajib dipakai

${GLOSARIUM}

# Aturan yang mengikat

1. Kembalikan ALAMAT persis seperti yang diberikan, termasuk bagian setelah
   tanda pagar bila ada (mis. \`…:subtopikEn#2\`). Jangan mengarang alamat dan
   jangan menggabungkan dua medan menjadi satu.
2. KELUARAN HARUS LENGKAP. Banyaknya objek yang Anda kembalikan wajib SAMA
   dengan banyaknya medan yang diminta — satu objek untuk setiap alamat, tidak
   satu pun dilewati. Medan yang pendek, yang berulang, yang hanya satu kata,
   yang terasa sepele, atau yang mirip dengan medan lain TETAP dikembalikan.
   Daftar yang lebih pendek daripada yang diminta dianggap gagal.
3. Terjemahkan HANYA teksnya. Jangan menambah penjelasan, catatan penerjemah,
   atau kalimat yang tidak ada di aslinya.
4. Pertahankan makna akademiknya. Anda menerjemahkan, bukan memperbaiki: kalau
   rumusan aslinya lemah, terjemahannya juga boleh lemah. Yang memperbaiki
   substansi adalah dosen, lewat penyuntingan biasa.
5. JANGAN menerjemahkan pengenal: kode mata kuliah (mis. TI214), kode CPL,
   CPMK, dan Sub-CPMK (mis. CPMK081-1), nomor pustaka, nama orang, gelar, NIDN,
   NIP, serta judul buku dan artikel pada daftar pustaka. Medan yang isinya
   hanya pengenal semacam itu tetap dikembalikan apa adanya — bukan dilewati.
6. Angka, satuan, dan persentase ditulis apa adanya.
7. Pertahankan bentuk teksnya: kalau aslinya satu frasa pendek, terjemahannya
   juga frasa pendek; kalau aslinya paragraf, tetap paragraf. Jangan mengubah
   daftar berpoin menjadi paragraf atau sebaliknya.
8. Gunakan ejaan Inggris yang konsisten di seluruh dokumen (British atau
   American, pilih satu dan pertahankan).
9. Bila sebuah teks sudah berbahasa Inggris, kembalikan apa adanya — tetap
   sebagai satu objek dengan alamatnya.
10. Jawablah ringkas: tanpa pengantar, tanpa penutup, hanya datanya.`;

/**
 * Besar gelombang per RONDE, dari yang paling longgar ke yang paling sempit.
 *
 * Sebuah RPKPS 16 minggu punya ratusan medan, dan mengirim semuanya dalam satu
 * permintaan adalah alasan utama terjemahan tidak pernah mencapai 100%: model
 * menjatuhkan sebagian medan tanpa memberi tanda apa pun — jawabannya sah
 * menurut skema, hanya lebih pendek — atau jawabannya terpotong di batas token
 * dan SELURUH pekerjaan hangus, termasuk yang sudah benar.
 *
 * Jadi permintaannya dipecah, dan yang belum terjawab dikirim ULANG dengan
 * gelombang yang lebih kecil. Ronde terakhir cukup kecil sehingga sebuah medan
 * yang berkali-kali dilewati pun akhirnya berangkat hampir sendirian.
 */
const UKURAN_RONDE = [40, 15, 6] as const;

/** Batas aksara sumber per gelombang, penjaga kedua untuk medan yang panjang. */
const BATAS_AKSARA = 9_000;

/** Gelombang yang berjalan bersamaan. Ditahan supaya kunci dosen tidak kena rate limit. */
const SEKALIGUS = 3;

export interface HasilTerjemahan {
  diterima: { alamat: string; teks: string }[];
  /** Alamat yang dikembalikan model tetapi tidak pernah diminta. */
  ditolak: string[];
  /** Alamat yang diminta tetapi tidak pernah dijawab, bahkan setelah ronde ulang. */
  kurang: string[];
  /** Banyaknya permintaan ke penyedia — untuk dosen yang menanggung tagihannya. */
  gelombang: number;
  /** Ditampilkan ke dosen supaya mutu terjemahan dapat dibandingkan antarpenyedia. */
  penyedia: string;
  model: string;
}

/**
 * Memecah medan menjadi gelombang: dibatasi banyak medan DAN banyak aksara.
 *
 * Satu medan yang sangat panjang (uraian tugas beberapa paragraf) dapat
 * menghabiskan anggaran token sendirian; membatasi jumlah medan saja tidak
 * menahannya.
 */
function pecahGelombang(
  medan: readonly MedanTerjemahan[],
  ukuran: number,
): MedanTerjemahan[][] {
  const gelombang: MedanTerjemahan[][] = [];
  let kini: MedanTerjemahan[] = [];
  let aksara = 0;

  for (const m of medan) {
    if (kini.length > 0 && (kini.length >= ukuran || aksara + m.asal.length > BATAS_AKSARA)) {
      gelombang.push(kini);
      kini = [];
      aksara = 0;
    }
    kini.push(m);
    aksara += m.asal.length;
  }
  if (kini.length > 0) gelombang.push(kini);
  return gelombang;
}

/**
 * Anggaran token keluaran satu gelombang.
 *
 * Terjemahan Inggris kira-kira sepanjang aslinya; sisanya struktur JSON —
 * alamat, tanda kutip, koma. Dilebihkan supaya jawaban tidak terpotong tepat
 * di medan terakhir, tetapi tetap berbatas supaya satu gelombang yang liar
 * tidak menghabiskan anggaran dosen.
 */
function anggaranToken(gelombang: readonly MedanTerjemahan[]): number {
  const aksara = gelombang.reduce((t, m) => t + m.asal.length + m.alamat.length, 0);
  return Math.min(16_000, Math.max(2_000, Math.ceil(aksara / 2) + gelombang.length * 60));
}

/** Satu permintaan ke penyedia, sudah disaring terhadap medan yang dikirim. */
async function mintaGelombang(
  terpilih: PenyediaTerpilih,
  opsi: { penggunaId: string; entitasId: string },
  gelombang: readonly MedanTerjemahan[],
): Promise<{ diterima: { alamat: string; teks: string }[]; ditolak: string[] }> {
  const hasil = await jalankanTugasAi({
    kodeTugas: "TERJEMAHAN_RPKPS",
    penggunaId: opsi.penggunaId,
    entitasId: opsi.entitasId,
    terpilih,
    panduan: PANDUAN,
    permintaan:
      `Terjemahkan ${gelombang.length} medan berikut ke bahasa Inggris. ` +
      `Kembalikan TEPAT ${gelombang.length} objek — satu untuk setiap alamat.\n\n` +
      "<medan>\n" +
      JSON.stringify(
        gelombang.map((m) => ({ alamat: m.alamat, teks: m.asal })),
        null,
        2,
      ) +
      "\n</medan>",
    skema: SkemaKeluaran,
    maxTokens: anggaranToken(gelombang),
  });

  return saringHasilTerjemahan(gelombang, hasil.data.terjemahan);
}

/** Menjalankan gelombang beberapa sekaligus, tanpa membanjiri kunci dosen. */
async function jalankanBerbatas<T>(
  tugas: readonly (() => Promise<T>)[],
  sekaligus: number,
): Promise<T[]> {
  const hasil: T[] = new Array(tugas.length);
  let berikut = 0;

  const pekerja = async () => {
    for (;;) {
      const i = berikut++;
      if (i >= tugas.length) return;
      hasil[i] = await tugas[i]();
    }
  };

  await Promise.all(Array.from({ length: Math.min(sekaligus, tugas.length) }, pekerja));
  return hasil;
}

export async function terjemahkanRpkps(opsi: {
  penggunaId: string;
  entitasId: string;
  medan: readonly MedanTerjemahan[];
  /** Kosong berarti kunci bawaan dosen. */
  kredensialId?: string | null;
}): Promise<HasilTerjemahan> {
  /*
   * SEKALI untuk seluruh tugas, sebelum gelombang mana pun berangkat. Membuka
   * kunci di dalam perulangan berarti mendekripsinya berkali-kali, dan membuka
   * peluang gelombang kedua memakai kredensial berbeda dari gelombang pertama
   * bila dosen menggantinya di tengah jalan (docs/08 §4).
   */
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);

  const diterima = new Map<string, string>();
  const ditolak: string[] = [];
  let gelombangTerpakai = 0;
  let galatPertama: unknown = null;

  let sisa = [...opsi.medan];
  for (const ukuran of UKURAN_RONDE) {
    if (sisa.length === 0) break;

    const gelombang = pecahGelombang(sisa, ukuran);
    gelombangTerpakai += gelombang.length;

    /*
     * Kegagalan satu gelombang tidak menggagalkan yang lain: medan di dalamnya
     * kembali menjadi sisa dan berangkat lagi pada ronde berikutnya. Kunci yang
     * salah atau kuota habis akan menggagalkan SEMUANYA, dan itu ditangani di
     * bawah — dengan melempar galat aslinya, bukan "0 dari 300 diterjemahkan".
     */
    const balasan = await jalankanBerbatas(
      gelombang.map((g) => async () => {
        try {
          return await mintaGelombang(terpilih, opsi, g);
        } catch (galat) {
          galatPertama ??= galat;
          return null;
        }
      }),
      SEKALIGUS,
    );

    for (const b of balasan) {
      if (!b) continue;
      for (const d of b.diterima) if (!diterima.has(d.alamat)) diterima.set(d.alamat, d.teks);
      ditolak.push(...b.ditolak);
    }

    sisa = medanKurang(sisa, new Set(diterima.keys()));
  }

  // Tidak ada satu pun yang berhasil: yang salah adalah kuncinya, bukan
  // dokumennya. Dosen berhak melihat pesan penyedia, bukan "0 medan".
  if (diterima.size === 0 && galatPertama != null) throw galatPertama;
  if (diterima.size === 0) {
    throw new GalatAi("Model tidak mengembalikan satu pun terjemahan. Coba lagi.");
  }

  return {
    diterima: opsi.medan.flatMap((m) => {
      const teks = diterima.get(m.alamat);
      return teks == null ? [] : [{ alamat: m.alamat, teks }];
    }),
    ditolak,
    kurang: sisa.map((m) => m.alamat),
    gelombang: gelombangTerpakai,
    penyedia: terpilih.penyedia.kode,
    model: terpilih.model,
  };
}
