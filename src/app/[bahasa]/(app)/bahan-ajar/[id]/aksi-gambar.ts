"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { segarkan } from "@/lib/bahasa/segarkan";
import { pesanZod } from "@/lib/bahasa/zod";
import { isi as sisip } from "@/lib/bahasa/teks";
import { GalatAi } from "@/lib/ai/galat";
import { susunDiagramBab, susunIlustrasiRaster } from "@/lib/ai/buku-ajar";
import { muatBuku } from "@/lib/bahan-ajar/muat";
import { wenangBuku } from "@/lib/bahan-ajar/wenang";
import { bacaDataUriPng, periksaBerkasGambar } from "@/domain/bahan-ajar/berkas-gambar";
import { BATAS_GAMBAR_BAB } from "@/domain/bahan-ajar/keluaran-diagram";
import { periksaGayaSvg } from "@/domain/bahan-ajar/gaya-svg";
import { periksaMermaid } from "@/domain/bahan-ajar/mermaid-aman";
import { periksaSvgAman } from "@/domain/bahan-ajar/svg-aman";
import type { DiagramSiap } from "@/domain/bahan-ajar/keluaran-diagram";
import type { TemuanBahanAjar } from "@/domain/bahan-ajar/tipe";

/**
 * Server Action gambar buku ajar — docs/17.
 *
 * # Kiriman peramban tidak dipercaya, termasuk kiriman peramban kita sendiri
 *
 * Diagram dirasterkan di peramban (docs/17 I3) dan kode SVG-nya sudah
 * diperiksa sebelum ditawarkan ke dosen. Keduanya TETAP diperiksa ulang di
 * sini: apa yang tiba adalah kiriman klien biasa, dan yang menulis ke basis
 * data adalah server. Lapis pertama sanitasi ada di sini, bukan di peramban
 * (docs/17 I2).
 */

export type Hasil = { ok: boolean; pesan: string };
export type HasilUsulDiagram = Hasil & {
  usul?: DiagramSiap[];
  catatan?: TemuanBahanAjar[];
};

async function bukuUntukTulis(bukuId: string) {
  const k = await kamusAksi();
  const w = await wenangBuku(bukuId);
  if (!w.ada) return { ok: false as const, pesan: k.aksi.takAda.bukuAjar, k };
  if (!w.bolehTulis) return { ok: false as const, pesan: k.aksi.wenang.tulisBukuAjar, k };

  const buku = await muatBuku(bukuId);
  if (!buku) return { ok: false as const, pesan: k.aksi.takAda.bukuAjar, k };
  return { ok: true as const, buku, penggunaId: w.sesi.id, k };
}

/** Judul subbab sebuah bab — dasar pencocokan `letak`. */
function subbabDari(uraian: string | null): string[] {
  if (!uraian) return [];
  return uraian
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b.length <= 90 && /^\d+(\.\d+)*\.?\s+\S/.test(b));
}

// ─────────────────────────────────────────────────────────────
// TAHAP AI — MENGUSULKAN, TIDAK MENYIMPAN
// ─────────────────────────────────────────────────────────────

/**
 * Menyusun usulan diagram untuk satu bab. TIDAK menyimpan apa pun.
 *
 * Penyimpanan menunggu dua hal yang hanya dapat terjadi di peramban:
 * dosen melihat gambarnya, dan gambarnya dirasterkan menjadi PNG. Menyimpan
 * lebih dulu berarti menyimpan diagram yang belum pernah dilihat siapa pun,
 * tanpa PNG yang justru wajib untuk dicetak.
 */
export async function usulkanDiagram(
  bukuId: string,
  nomorBab: number,
  kredensialId?: string | null,
): Promise<HasilUsulDiagram> {
  const siap = await bukuUntukTulis(bukuId);
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku, k } = siap;

  const bab = buku.bab.find((b) => b.nomor === nomorBab);
  if (!bab) return { ok: false, pesan: k.aksi.takAda.babBukuAjar };
  if (!bab.uraian?.trim()) {
    return { ok: false, pesan: sisip(k.aksi.bahanAjar.babBelumBerisi, { nomor: nomorBab }) };
  }

  try {
    const { hasil, catatan } = await susunDiagramBab({
      penggunaId: siap.penggunaId,
      bukuId,
      bahasa: buku.bahasa,
      bab: {
        nomor: bab.nomor,
        judul: bab.judul,
        tujuan: bab.tujuan,
        uraian: bab.uraian,
        subbab: subbabDari(bab.uraian),
      },
      kredensialId,
    });

    return {
      ok: true,
      pesan: sisip(k.aksi.bahanAjar.diagramTersusun, { jumlah: hasil.length }),
      usul: hasil,
      catatan,
    };
  } catch (galat) {
    if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
    console.error("[bahan-ajar] gagal menyusun diagram:", galat);
    return { ok: false, pesan: k.aksi.bahanAjar.gagalDiagram };
  }
}

export type HasilIlustrasi = Hasil & { png?: string; temuan?: TemuanBahanAjar[] };

/**
 * Mengusulkan satu ilustrasi raster — docs/17 §6. TIDAK menyimpan apa pun.
 *
 * Perintahnya ditulis DOSEN, bukan model: yang boleh diilustrasikan adalah
 * suasana dan metafora, dan hanya penulis buku yang tahu apakah sebuah bab
 * memerlukannya. PNG-nya dikembalikan sebagai data URI untuk dipratinjau, lalu
 * disimpan lewat `tambahGambar` dengan `sumber = AI_RASTER` — dan sejak itu ia
 * selalu tercetak berketerangan asal.
 */
export async function usulkanIlustrasi(
  bukuId: string,
  nomorBab: number,
  perintah: string,
  kredensialId?: string | null,
): Promise<HasilIlustrasi> {
  const siap = await bukuUntukTulis(bukuId);
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku, k } = siap;

  const bab = buku.bab.find((b) => b.nomor === nomorBab);
  if (!bab) return { ok: false, pesan: k.aksi.takAda.babBukuAjar };

  const teks = perintah.trim();
  if (teks.length < 10) return { ok: false, pesan: k.aksi.bahanAjar.perintahPendek };

  try {
    const { png } = await susunIlustrasiRaster({
      penggunaId: siap.penggunaId,
      bukuId,
      bahasa: buku.bahasa,
      perintah: teks,
      konteksBab: { nomor: bab.nomor, judul: bab.judul },
      kredensialId,
    });

    // Diperiksa di sini juga: yang kembali dari penyedia luar tidak lebih
    // dipercaya daripada yang kembali dari peramban.
    const berkas = periksaBerkasGambar(png);
    if (!berkas.ok) {
      return { ok: false, pesan: k.aksi.bahanAjar.gambarDitolak, temuan: berkas.temuan };
    }

    return {
      ok: true,
      pesan: k.aksi.bahanAjar.ilustrasiTersusun,
      png: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
    };
  } catch (galat) {
    // Kalimat GalatAi menyebut sebabnya — termasuk "penyedia ini tidak
    // menghasilkan gambar", yang justru keterangan paling berguna di sini.
    if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
    console.error("[bahan-ajar] gagal menyusun ilustrasi:", galat);
    return { ok: false, pesan: k.aksi.bahanAjar.gagalDiagram };
  }
}

// ─────────────────────────────────────────────────────────────
// PENYIMPANAN
// ─────────────────────────────────────────────────────────────

const SkemaGambar = z.object({
  judul: z.string().trim().min(2, "@aksi.periksa.judulGambarPendek").max(200),
  altTeks: z.string().trim().max(500).nullable(),
  letak: z.string().trim().max(200).nullable(),
  bentuk: z.enum(["MERMAID", "SVG", "RASTER"]),
  sumber: z.enum(["DIAGRAM_AI", "UNGGAHAN", "AI_RASTER"]),
  /** Mermaid atau SVG. Kosong hanya sah untuk gambar raster. */
  kode: z.string().max(200_000).nullable(),
  /** PNG hasil rasterisasi peramban, sebagai data URI. */
  png: z.string().max(6_000_000),
});

export type IsiGambar = z.infer<typeof SkemaGambar>;

/**
 * Memeriksa satu gambar kiriman peramban, lengkap: kode DAN bita PNG-nya.
 *
 * Dipakai penambahan maupun penyuntingan, sehingga tidak ada jalur masuk yang
 * memeriksa lebih longgar daripada yang lain.
 */
function periksaKiriman(
  d: IsiGambar,
):
  | { ok: true; png: Uint8Array<ArrayBuffer>; lebar: number; tinggi: number }
  | { ok: false; temuan: TemuanBahanAjar[] } {
  if (d.bentuk === "SVG") {
    const kode = d.kode ?? "";
    const aman = periksaSvgAman(kode);
    if (!aman.ok) return { ok: false, temuan: aman.temuan };
    const gaya = periksaGayaSvg(kode);
    if (!gaya.ok) return { ok: false, temuan: gaya.temuan };
  } else if (d.bentuk === "MERMAID") {
    const mmd = periksaMermaid(d.kode ?? "");
    if (!mmd.ok) return { ok: false, temuan: mmd.temuan };
  }

  const bita = bacaDataUriPng(d.png);
  if (!bita) {
    return { ok: false, temuan: [{ kode: "IL-BERKAS-BUKAN-GAMBAR", tingkat: "PEMBLOKIR" }] };
  }
  const berkas = periksaBerkasGambar(bita);
  if (!berkas.ok) return { ok: false, temuan: berkas.temuan };

  return { ok: true, png: bita, lebar: berkas.lebar!, tinggi: berkas.tinggi! };
}

export type HasilGambar = Hasil & { temuan?: TemuanBahanAjar[]; id?: string };

/** Menambahkan satu gambar ke sebuah bab. */
export async function tambahGambar(
  bukuId: string,
  nomorBab: number,
  isi: IsiGambar,
): Promise<HasilGambar> {
  const siap = await bukuUntukTulis(bukuId);
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku, k } = siap;

  const parsed = SkemaGambar.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, k, k.aksi.umum.dataTidakValid) };
  }

  const bab = buku.bab.find((b) => b.nomor === nomorBab);
  if (!bab) return { ok: false, pesan: k.aksi.takAda.babBukuAjar };
  if (bab.gambar.length >= BATAS_GAMBAR_BAB) {
    return {
      ok: false,
      pesan: sisip(k.aksi.bahanAjar.gambarPenuh, { n: BATAS_GAMBAR_BAB }),
    };
  }

  const periksa = periksaKiriman(parsed.data);
  if (!periksa.ok) {
    return { ok: false, pesan: k.aksi.bahanAjar.gambarDitolak, temuan: periksa.temuan };
  }

  const baris = await prisma.gambarBab.create({
    data: {
      babId: bab.id,
      // Nomor diberikan server, berurut setelah yang sudah ada.
      nomor: (bab.gambar.at(-1)?.nomor ?? 0) + 1,
      judul: parsed.data.judul,
      altTeks: parsed.data.altTeks,
      letak: parsed.data.letak,
      sumber: parsed.data.sumber,
      bentuk: parsed.data.bentuk,
      kode: parsed.data.bentuk === "RASTER" ? null : parsed.data.kode,
      png: periksa.png,
      lebarPx: periksa.lebar,
      tinggiPx: periksa.tinggi,
    },
    select: { id: true },
  });

  segarkan(`/bahan-ajar/${bukuId}/bab/${nomorBab}`);
  return { ok: true, pesan: k.aksi.bahanAjar.gambarTersimpan, id: baris.id };
}

/** Menyimpan suntingan satu gambar, beserta PNG-nya yang dirasterkan ulang. */
export async function simpanGambar(
  bukuId: string,
  gambarId: string,
  isi: IsiGambar,
): Promise<HasilGambar> {
  const siap = await bukuUntukTulis(bukuId);
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku, k } = siap;

  const parsed = SkemaGambar.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, k, k.aksi.umum.dataTidakValid) };
  }

  // Kepemilikan diperiksa lewat buku yang sudah dimuat, bukan dengan
  // mempercayai id kiriman: id gambar bersifat global, dan wewenang yang
  // sudah diperiksa hanya berlaku untuk buku INI.
  const bab = buku.bab.find((b) => b.gambar.some((g) => g.id === gambarId));
  if (!bab) return { ok: false, pesan: k.aksi.takAda.gambar };

  const periksa = periksaKiriman(parsed.data);
  if (!periksa.ok) {
    return { ok: false, pesan: k.aksi.bahanAjar.gambarDitolak, temuan: periksa.temuan };
  }

  await prisma.gambarBab.update({
    where: { id: gambarId },
    data: {
      judul: parsed.data.judul,
      altTeks: parsed.data.altTeks,
      letak: parsed.data.letak,
      /*
       * `bentuk` ikut ditulis: membekukan diagram Mermaid mengubahnya menjadi
       * SVG (docs/18 §3), dan baris yang bentuknya tertinggal akan dibaca
       * sebagai Mermaid — lalu gagal dirender oleh kode SVG-nya sendiri.
       *
       * `sumber` justru TIDAK: ia menyatakan asal-usul gambar, dan menyunting
       * sebuah ilustrasi AI tidak mengubah kenyataan bahwa ia dihasilkan
       * model. Keterangan asalnya harus tetap tercetak (docs/17 I5).
       */
      bentuk: parsed.data.bentuk,
      kode: parsed.data.bentuk === "RASTER" ? null : parsed.data.kode,
      png: periksa.png,
      lebarPx: periksa.lebar,
      tinggiPx: periksa.tinggi,
    },
  });

  segarkan(`/bahan-ajar/${bukuId}/bab/${bab.nomor}`);
  return { ok: true, pesan: k.aksi.bahanAjar.gambarTersimpan, id: gambarId };
}

export async function hapusGambar(bukuId: string, gambarId: string): Promise<Hasil> {
  const siap = await bukuUntukTulis(bukuId);
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku, k } = siap;

  const bab = buku.bab.find((b) => b.gambar.some((g) => g.id === gambarId));
  if (!bab) return { ok: false, pesan: k.aksi.takAda.gambar };

  await prisma.$transaction(async (tx) => {
    await tx.gambarBab.delete({ where: { id: gambarId } });
    // Nomor dirapatkan kembali supaya tidak berlubang. Penomoran cetak
    // ("Gambar 3.2") diturunkan dari urutan cetak, tetapi daftar di layar
    // membaca kolom ini.
    const sisa = bab.gambar.filter((g) => g.id !== gambarId);
    for (const [i, g] of sisa.entries()) {
      if (g.nomor !== i + 1) {
        await tx.gambarBab.update({ where: { id: g.id }, data: { nomor: i + 1 } });
      }
    }
  });

  segarkan(`/bahan-ajar/${bukuId}/bab/${bab.nomor}`);
  return { ok: true, pesan: k.aksi.bahanAjar.gambarDihapus };
}

/** Menukar sebuah gambar dengan tetangganya. */
export async function geserGambar(
  bukuId: string,
  gambarId: string,
  arah: "naik" | "turun",
): Promise<Hasil> {
  const siap = await bukuUntukTulis(bukuId);
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku, k } = siap;

  const bab = buku.bab.find((b) => b.gambar.some((g) => g.id === gambarId));
  if (!bab) return { ok: false, pesan: k.aksi.takAda.gambar };

  const i = bab.gambar.findIndex((g) => g.id === gambarId);
  const j = arah === "naik" ? i - 1 : i + 1;
  if (j < 0 || j >= bab.gambar.length) return { ok: true, pesan: k.aksi.umum.tersimpan };

  const a = bab.gambar[i];
  const b = bab.gambar[j];

  /*
   * Tiga langkah, bukan dua: `@@unique([babId, nomor])` menolak dua baris
   * bernomor sama walau hanya sesaat di tengah transaksi. Nomor sementara
   * negatif tidak pernah dapat bertabrakan dengan nomor sah mana pun.
   */
  await prisma.$transaction([
    prisma.gambarBab.update({ where: { id: a.id }, data: { nomor: -1 } }),
    prisma.gambarBab.update({ where: { id: b.id }, data: { nomor: a.nomor } }),
    prisma.gambarBab.update({ where: { id: a.id }, data: { nomor: b.nomor } }),
  ]);

  segarkan(`/bahan-ajar/${bukuId}/bab/${bab.nomor}`);
  return { ok: true, pesan: k.aksi.umum.tersimpan };
}
