"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { segarkan } from "@/lib/bahasa/segarkan";
import { pesanZod } from "@/lib/bahasa/zod";
import { isi as sisip } from "@/lib/bahasa/teks";
import { rancangKerangkaBuku } from "@/domain/bahan-ajar/kerangka-buku";
import { wenangBuku, wenangBukuBaru } from "@/lib/bahan-ajar/wenang";
import { pertemuanDomain } from "@/lib/bahan-ajar/muat";

export type Hasil = { ok: boolean; pesan: string; id?: string };

const SkemaBuat = z.object({
  rpkpsId: z.string().min(1),
  bahasa: z.enum(["id", "en"]),
});

/**
 * Membuat buku ajar untuk sebuah RPKPS, beserta kerangka babnya.
 *
 * Bab dirancang di sini, bukan oleh AI: judul dan tujuan tiap bab berasal dari
 * baris mingguan RPKPS yang sudah ada (docs/16 §2.2). Yang dikerjakan AI
 * nanti adalah ISI bab — dan dengan bab yang sudah tercetak lebih dulu, dosen
 * dapat melihat seluruh peta buku sebelum membakar satu token pun.
 */
export async function buatBukuAjar(masukan: {
  rpkpsId: string;
  bahasa: "id" | "en";
}): Promise<Hasil> {
  const k = await kamusAksi();

  const parsed = SkemaBuat.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, k, k.aksi.umum.dataTidakValid) };
  }
  const { rpkpsId, bahasa } = parsed.data;

  const w = await wenangBukuBaru(rpkpsId);
  if (!w.ada) return { ok: false, pesan: k.aksi.takAda.rpkps };
  if (!w.bolehTulis) return { ok: false, pesan: k.aksi.wenang.tulisBukuAjar };

  const sudah = await prisma.bukuAjar.findUnique({
    where: { rpkpsId_bahasa: { rpkpsId, bahasa } },
    select: { id: true },
  });
  if (sudah) return { ok: true, pesan: k.aksi.bahanAjar.sudahAda, id: sudah.id };

  const rpkps = await prisma.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      mataKuliah: { select: { nama: true, namaEn: true } },
      pertemuan: {
        orderBy: { minggu: "asc" },
        select: {
          id: true,
          minggu: true,
          jenis: true,
          topik: true,
          subtopik: true,
          indikator: { orderBy: { urutan: "asc" }, select: { teks: true } },
          subCpmk: { select: { subCpmk: { select: { kode: true, rumusan: true } } } },
          pustaka: { select: { pustaka: { select: { nomor: true } } } },
        },
      },
    },
  });
  if (!rpkps) return { ok: false, pesan: k.aksi.takAda.rpkps };

  const { bab, dilewati } = rancangKerangkaBuku(pertemuanDomain(rpkps.pertemuan));

  // Buku tanpa satu bab pun tidak dapat dikerjakan siapa pun — termasuk AI.
  // Yang belum selesai adalah RPKPS-nya, dan pesannya menyebut itu.
  if (bab.length === 0) {
    return { ok: false, pesan: k.aksi.bahanAjar.rpkpsBelumSiap };
  }

  const buku = await prisma.bukuAjar.create({
    data: {
      rpkpsId,
      bahasa,
      // Judul awal adalah nama mata kuliah; tahap kerangka AI mengusulkan
      // judul yang lebih pantas untuk sampul, dan dosen memutuskan.
      judul:
        (bahasa === "en" ? rpkps.mataKuliah.namaEn : null) ?? rpkps.mataKuliah.nama,
      penulis: [],
      sumber: "KURIKULUM",
      bab: {
        create: bab.map((b) => ({
          nomor: b.nomor,
          judul: b.judul,
          tujuan: b.tujuan,
          pertemuanId: b.pertemuanId,
          sidikSumber: b.sidikSumber,
          sumber: "KURIKULUM" as const,
        })),
      },
    },
    select: { id: true },
  });

  segarkan("/bahan-ajar");
  segarkan(`/rpkps/${rpkpsId}`);

  return {
    ok: true,
    id: buku.id,
    pesan:
      dilewati.length === 0
        ? sisip(k.aksi.bahanAjar.dibuat, { jumlah: bab.length })
        : sisip(k.aksi.bahanAjar.dibuatSebagian, {
            jumlah: bab.length,
            dilewati: dilewati.join(", "),
          }),
  };
}

/** Menghapus buku ajar beserta seluruh babnya. Hanya pengampu. */
export async function hapusBukuAjar(bukuId: string): Promise<Hasil> {
  const k = await kamusAksi();
  const w = await wenangBuku(bukuId);
  if (!w.ada) return { ok: false, pesan: k.aksi.takAda.bukuAjar };
  if (!w.bolehTulis) return { ok: false, pesan: k.aksi.wenang.tulisBukuAjar };

  /*
   * Buku ajar boleh dihapus tanpa syarat, tidak seperti RPKPS. Ia bukan akar
   * cascade yang menjangkau salinan beku, nilai mahasiswa, maupun halaman
   * publik: yang ikut terhapus hanya bab, latihan, dan slidenya sendiri —
   * seluruhnya tulisan yang dapat disusun ulang.
   */
  await prisma.bukuAjar.delete({ where: { id: bukuId } });

  segarkan("/bahan-ajar");
  return { ok: true, pesan: k.aksi.bahanAjar.dihapus };
}
