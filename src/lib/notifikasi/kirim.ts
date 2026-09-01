import "server-only";
import { prisma } from "@/lib/prisma";
import { susunNotifikasi, type Peristiwa } from "@/domain/notifikasi/pesan";
import { teksNotifikasi } from "@/lib/bahasa/notifikasi";
import { id } from "@/kamus/id";

/** Cadangan kosong: kunci yang baru saja disusun pasti ada di kamus. */
const KOSONG = { judul: "", ringkasan: "" };

/**
 * Pengiriman notifikasi dalam aplikasi.
 *
 * Tiga aturan yang menjaga daftar ini tetap layak dibaca:
 *
 *   1. Pelaku tidak dikabari perbuatannya sendiri. Kaprodi yang baru menekan
 *      "setujui" tidak perlu diberi tahu bahwa RPKPS itu disetujui.
 *   2. Gagal mengirim tidak boleh menggagalkan pekerjaan. Notifikasi adalah
 *      layanan tambahan di atas aksi yang sudah berhasil — sama seperti
 *      pencatatan pemakaian AI di `lib/ai/gerbang.ts`.
 *   3. Pengiriman berada DI LUAR transaksi aksi. Kabar tentang perubahan yang
 *      kemudian dibatalkan lebih buruk daripada tidak ada kabar.
 */

export async function kirimNotifikasi(
  penerima: readonly string[],
  peristiwa: Peristiwa,
  pelakuId?: string | null,
): Promise<number> {
  const tujuan = [...new Set(penerima)].filter((id) => id !== pelakuId);
  if (tujuan.length === 0) return 0;

  const isi = susunNotifikasi(peristiwa);

  try {
    const hasil = await prisma.notifikasi.createMany({
      data: tujuan.map((penggunaId) => ({
        penggunaId,
        jenis: isi.jenis,
        data: { kunci: isi.kunci, params: isi.params },
        // Cadangan bahasa Indonesia, ditulis bersama datanya: bila suatu saat
        // sebuah kunci hilang dari kamus, notifikasi lama tetap punya isi.
        ...teksNotifikasi({ kunci: isi.kunci, params: isi.params }, KOSONG, id),
        tautan: isi.tautan,
        entitas: isi.entitas,
        entitasId: isi.entitasId,
      })),
    });
    return hasil.count;
  } catch (galat) {
    console.error("[notifikasi] gagal mengirim:", galat);
    return 0;
  }
}

/**
 * Pemegang wewenang atas dokumen sebuah prodi: Kaprodi prodi itu, ditambah
 * penjaminan mutu.
 *
 * ADMIN sengaja TIDAK ikut. Cakupannya seluruh institusi, jadi ia akan menerima
 * setiap pengajuan dari setiap prodi — dan daftar yang selalu penuh berhenti
 * dibaca. Antrian kerja di dasbor tetap menampilkannya.
 */
export async function penerimaPengelola(prodiId: string): Promise<string[]> {
  const baris = await prisma.penugasanPeran.findMany({
    where: {
      peran: { in: ["KAPRODI", "GPM"] },
      OR: [{ prodiId }, { prodiId: null }],
      pengguna: { status: "AKTIF" },
    },
    select: { penggunaId: true },
  });
  return [...new Set(baris.map((b) => b.penggunaId))];
}

/** Seluruh pengampu sebuah RPKPS — koordinator maupun anggota. */
export async function penerimaPengampu(rpkpsId: string): Promise<string[]> {
  const baris = await prisma.rpkpsPengampu.findMany({
    where: { rpkpsId, pengguna: { status: "AKTIF" } },
    select: { penggunaId: true },
  });
  return [...new Set(baris.map((b) => b.penggunaId))];
}

/**
 * Pemegang peran penjaminan mutu — penanda tangan cap terakhir pada rantai
 * pengesahan. Cakupannya institusi, jadi tidak ada penyaringan prodi: siapa pun
 * pemegang GPM boleh mengesahkan, dan namanya yang tercetak (docs/14 §2.7).
 */
export async function penerimaPenjaminanMutu(): Promise<string[]> {
  const baris = await prisma.penugasanPeran.findMany({
    where: { peran: "GPM", pengguna: { status: "AKTIF" } },
    select: { penggunaId: true },
  });
  return [...new Set(baris.map((b) => b.penggunaId))];
}

/** Kaprodi prodi tertentu saja — tanpa penjaminan mutu. */
export async function penerimaKaprodi(prodiId: string): Promise<string[]> {
  const baris = await prisma.penugasanPeran.findMany({
    where: { peran: "KAPRODI", prodiId, pengguna: { status: "AKTIF" } },
    select: { penggunaId: true },
  });
  return [...new Set(baris.map((b) => b.penggunaId))];
}
