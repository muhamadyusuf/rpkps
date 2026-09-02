import "server-only";
import { z } from "zod";
import type { MedanTerjemahan } from "@/domain/rpkps/terjemahan";
import { saringHasilTerjemahan } from "@/domain/rpkps/terjemahan";
import { jalankanTugasAi } from "./gerbang";
import { pakaiKredensial } from "./kredensial";

/**
 * Tugas AI: menerjemahkan isi RPKPS ke bahasa Inggris.
 *
 * Aturan BYOK berlaku utuh (docs/08 §4): kredensial hanya lewat
 * `pakaiKredensial()`, dibuka SEKALI lalu adapternya diteruskan ke gerbang.
 * Menerjemahkan tiga puluhan medan tetap SATU tugas — bukan tiga puluhan.
 * Selain soal biaya, satu permintaan juga yang membuat istilah konsisten:
 * model melihat seluruh dokumen sekaligus, bukan potongan lepas.
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

1. Kembalikan ALAMAT persis seperti yang diberikan. Jangan mengarang alamat,
   jangan menggabungkan dua medan, jangan melewatkan satu pun.
2. Terjemahkan HANYA teksnya. Jangan menambah penjelasan, catatan penerjemah,
   atau kalimat yang tidak ada di aslinya.
3. Pertahankan makna akademiknya. Anda menerjemahkan, bukan memperbaiki: kalau
   rumusan aslinya lemah, terjemahannya juga boleh lemah. Yang memperbaiki
   substansi adalah dosen, lewat penyuntingan biasa.
4. JANGAN menerjemahkan pengenal: kode mata kuliah (mis. TI214), kode CPL,
   CPMK, dan Sub-CPMK (mis. CPMK081-1), nomor pustaka, nama orang, gelar, NIDN,
   NIP, serta judul buku dan artikel pada daftar pustaka.
5. Angka, satuan, dan persentase ditulis apa adanya.
6. Pertahankan bentuk teksnya: kalau aslinya satu frasa pendek, terjemahannya
   juga frasa pendek; kalau aslinya paragraf, tetap paragraf. Jangan mengubah
   daftar berpoin menjadi paragraf atau sebaliknya.
7. Gunakan ejaan Inggris yang konsisten di seluruh dokumen (British atau
   American, pilih satu dan pertahankan).
8. Bila sebuah teks sudah berbahasa Inggris, kembalikan apa adanya.`;

export interface HasilTerjemahan {
  diterima: { alamat: string; teks: string }[];
  /** Alamat yang dikembalikan model tetapi tidak pernah diminta. */
  ditolak: string[];
  /** Ditampilkan ke dosen supaya mutu terjemahan dapat dibandingkan antarpenyedia. */
  penyedia: string;
  model: string;
}

export async function terjemahkanRpkps(opsi: {
  penggunaId: string;
  entitasId: string;
  medan: readonly MedanTerjemahan[];
  /** Kosong berarti kunci bawaan dosen. */
  kredensialId?: string | null;
}): Promise<HasilTerjemahan> {
  const hasil = await jalankanTugasAi({
    kodeTugas: "TERJEMAHAN_RPKPS",
    penggunaId: opsi.penggunaId,
    entitasId: opsi.entitasId,
    terpilih: await pakaiKredensial(opsi.penggunaId, opsi.kredensialId),
    panduan: PANDUAN,
    permintaan:
      "Terjemahkan setiap medan berikut ke bahasa Inggris.\n\n" +
      "<medan>\n" +
      JSON.stringify(
        opsi.medan.map((m) => ({ alamat: m.alamat, teks: m.asal })),
        null,
        2,
      ) +
      "\n</medan>",
    skema: SkemaKeluaran,
    // Terjemahan sepanjang aslinya, ditambah ruang untuk struktur JSON-nya.
    maxTokens: 16000,
  });

  const { diterima, ditolak } = saringHasilTerjemahan(opsi.medan, hasil.data.terjemahan);
  return { diterima, ditolak, penyedia: hasil.penyedia, model: hasil.model };
}
