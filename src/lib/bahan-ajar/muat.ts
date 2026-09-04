import "server-only";
import { prisma } from "@/lib/prisma";
import { sidikSumberBab } from "@/domain/bahan-ajar/sidik-sumber";
import type { BukuAjarInput, PertemuanUntukBab } from "@/domain/bahan-ajar/tipe";
import type { KonteksBab, KonteksBuku } from "@/lib/ai/buku-ajar";
import type { Prisma } from "@/generated/prisma";

/**
 * Pemuat buku ajar — docs/16.
 *
 * Satu tempat yang tahu bentuk barisnya, supaya halaman, Server Action, dan
 * pencetak berkas membaca dokumen yang sama. Semua kueri di sini memuat buku
 * BESERTA baris mingguan RPKPS-nya: tanpa itu sidik sumber tidak dapat
 * dihitung, dan bab yang rencananya sudah bergeser tidak akan pernah ketahuan.
 */

const PILIH_BUKU = {
  id: true,
  rpkpsId: true,
  bahasa: true,
  judul: true,
  subjudul: true,
  penulis: true,
  afiliasi: true,
  penerbit: true,
  kotaTerbit: true,
  tahunTerbit: true,
  edisi: true,
  isbn: true,
  hakCipta: true,
  prakata: true,
  pendahuluan: true,
  glosarium: true,
  biografi: true,
  sinopsis: true,
  kataKunci: true,
  sumber: true,
  diubahPada: true,
  bab: {
    orderBy: { nomor: "asc" },
    select: {
      id: true,
      nomor: true,
      judul: true,
      tujuan: true,
      alur: true,
      uraian: true,
      studiKasus: true,
      ringkasan: true,
      pertemuanId: true,
      sidikSumber: true,
      sumber: true,
      disuntingPada: true,
      diubahPada: true,
      latihan: {
        orderBy: { nomor: "asc" },
        select: { id: true, nomor: true, soal: true, kunci: true, bloom: true },
      },
      slide: {
        orderBy: { nomor: "asc" },
        select: { id: true, nomor: true, judul: true, butir: true, catatan: true },
      },
      pustaka: { select: { pustakaId: true } },
      /**
       * Bita PNG SENGAJA tidak ikut dimuat. Satu bab dapat memuat dua belas
       * gambar berukuran megabyte; menariknya ke setiap halaman berarti
       * mengirimkan belasan megabyte lewat muatan render hanya untuk
       * menampilkan daftar berjudul. Gambarnya diambil terpisah lewat
       * `/api/bahan-ajar/[id]/gambar/[gambarId]`.
       */
      gambar: {
        orderBy: { nomor: "asc" },
        select: {
          id: true,
          nomor: true,
          judul: true,
          altTeks: true,
          sumber: true,
          bentuk: true,
          kode: true,
          letak: true,
          lebarPx: true,
          tinggiPx: true,
        },
      },
    },
  },
  /**
   * Usulan penyuntingan yang masih TERBUKA. Yang sudah diputus tidak dimuat:
   * ia hanya berguna sebagai penjaga agar tinjauan ulang tidak menghidupkan
   * kembali usulan yang sudah ditolak, dan penjagaan itu terjadi di aksi —
   * bukan di layar.
   */
  usulan: {
    where: { status: "TERBUKA" as const },
    orderBy: [{ babId: "asc" as const }, { dibuatPada: "asc" as const }],
    select: {
      id: true,
      babId: true,
      jenis: true,
      kutipan: true,
      usul: true,
      alasan: true,
    },
  },
  rpkps: {
    select: {
      id: true,
      status: true,
      mataKuliah: {
        select: {
          kode: true,
          nama: true,
          namaEn: true,
          semester: true,
          sksTeori: true,
          sksPraktik: true,
          kurikulum: { select: { prodi: { select: { nama: true } } } },
        },
      },
      tahunAkademik: { select: { kode: true } },
      pustaka: {
        orderBy: [{ jenis: "asc" }, { nomor: "asc" }],
        select: { id: true, nomor: true, jenis: true, teks: true },
      },
      pertemuan: {
        orderBy: { minggu: "asc" },
        select: {
          id: true,
          minggu: true,
          jenis: true,
          topik: true,
          subtopik: true,
          indikator: { orderBy: { urutan: "asc" }, select: { teks: true } },
          subCpmk: {
            select: {
              subCpmk: { select: { kode: true, rumusan: true, levelBloom: true } },
            },
          },
          pustaka: { select: { pustaka: { select: { nomor: true } } } },
        },
      },
    },
  },
} satisfies Prisma.BukuAjarSelect;

export type BukuLengkap = Prisma.BukuAjarGetPayload<{ select: typeof PILIH_BUKU }>;
export type BabLengkap = BukuLengkap["bab"][number];
export type PertemuanMentah = BukuLengkap["rpkps"]["pertemuan"][number];

export function muatBuku(id: string): Promise<BukuLengkap | null> {
  return prisma.bukuAjar.findUnique({ where: { id }, select: PILIH_BUKU });
}

/**
 * Baris mingguan RPKPS dalam bentuk domain — dasar bab dan sidik sumbernya.
 *
 * Menerima LARIK barisnya, bukan bukunya: pembuatan buku memanggil ini sebelum
 * ada satu baris `buku_ajar` pun.
 */
export function pertemuanDomain(
  pertemuan: readonly PertemuanMentah[],
): PertemuanUntukBab[] {
  return pertemuan.map((p) => ({
    id: p.id,
    minggu: p.minggu,
    jenis: p.jenis,
    topik: p.topik,
    subtopik: p.subtopik,
    indikator: p.indikator.map((i) => i.teks),
    subCpmk: p.subCpmk.map((s) => ({ kode: s.subCpmk.kode, rumusan: s.subCpmk.rumusan })),
    nomorPustaka: p.pustaka.map((x) => x.pustaka.nomor),
  }));
}

/**
 * Sidik rencana SAAT INI untuk tiap baris mingguan.
 *
 * Dibandingkan dengan `bab.sidikSumber` untuk menandai bab yang rencananya
 * sudah bergerak. Baris yang sudah dihapus tidak ada di peta ini, dan itulah
 * yang membedakan "bergeser" dari "kehilangan minggu".
 */
export function sidikSekarang(buku: BukuLengkap): Map<string, string> {
  return new Map(pertemuanDomain(buku.rpkps.pertemuan).map((p) => [p.id, sidikSumberBab(p)]));
}

/** Bentuk yang dibaca `periksaBukuAjar`. */
export function keInputPemeriksaan(buku: BukuLengkap): BukuAjarInput {
  const sidik = sidikSekarang(buku);
  const nomorPustaka = new Map(buku.rpkps.pustaka.map((p) => [p.id, p.nomor]));

  return {
    bahasa: buku.bahasa,
    judul: buku.judul,
    penulis: buku.penulis,
    penerbit: buku.penerbit,
    tahunTerbit: buku.tahunTerbit,
    isbn: buku.isbn,
    prakata: buku.prakata,
    nomorPustakaTersedia: [...nomorPustaka.values()],
    bab: buku.bab.map((b) => ({
      nomor: b.nomor,
      judul: b.judul,
      tujuan: b.tujuan,
      uraian: b.uraian,
      studiKasus: b.studiKasus,
      ringkasan: b.ringkasan,
      latihan: b.latihan.map((l) => ({ nomor: l.nomor, soal: l.soal, kunci: l.kunci })),
      jumlahSlide: b.slide.length,
      sitiran: b.pustaka
        .map((x) => nomorPustaka.get(x.pustakaId))
        .filter((n): n is number => n !== undefined),
      sidikSumber: b.sidikSumber,
      sidikSekarang: b.pertemuanId ? (sidik.get(b.pertemuanId) ?? null) : null,
      punyaMinggu: b.pertemuanId !== null && sidik.has(b.pertemuanId),
      disunting: b.disuntingPada !== null,
    })),
  };
}

// ─────────────────────────────────────────────────────────────
// KONTEKS UNTUK MODEL
// ─────────────────────────────────────────────────────────────

export function konteksBuku(buku: BukuLengkap): KonteksBuku {
  const mk = buku.rpkps.mataKuliah;
  return {
    bahasa: buku.bahasa,
    mataKuliah: {
      kode: mk.kode,
      // Nama Indonesia selalu, juga untuk buku berbahasa Inggris: yang
      // diterjemahkan model adalah tulisannya, bukan identitas mata kuliahnya.
      nama: mk.nama,
      sks: mk.sksTeori + mk.sksPraktik,
      semester: mk.semester,
    },
    prodi: mk.kurikulum.prodi.nama,
    pustaka: buku.rpkps.pustaka.map((p) => ({
      nomor: p.nomor,
      jenis: p.jenis,
      teks: p.teks,
    })),
    bab: buku.bab.map((b) => ({ nomor: b.nomor, judul: b.judul, tujuan: b.tujuan })),
  };
}

/**
 * Konteks satu bab. Judul bab tetangga ikut dikirim supaya bab yang ditulis
 * satu per satu tidak saling mengulang — itulah gunanya menulis bertahap
 * dengan peta bab yang sudah ditetapkan lebih dulu.
 */
export function konteksBab(buku: BukuLengkap, bab: BabLengkap): KonteksBab {
  const pertemuan = buku.rpkps.pertemuan.find((p) => p.id === bab.pertemuanId);
  const urut = buku.bab.findIndex((b) => b.id === bab.id);

  return {
    nomor: bab.nomor,
    judul: bab.judul,
    minggu: pertemuan?.minggu ?? bab.nomor,
    tujuan: bab.tujuan,
    subtopik: pertemuan?.subtopik ?? [],
    subCpmk:
      pertemuan?.subCpmk.map((s) => ({
        kode: s.subCpmk.kode,
        rumusan: s.subCpmk.rumusan,
        bloom: s.subCpmk.levelBloom ?? undefined,
      })) ?? [],
    judulBabSebelum: urut > 0 ? buku.bab[urut - 1].judul : undefined,
    judulBabSesudah: urut < buku.bab.length - 1 ? buku.bab[urut + 1].judul : undefined,
  };
}
