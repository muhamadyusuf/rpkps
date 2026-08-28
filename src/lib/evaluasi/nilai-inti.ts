import type { PrismaClient } from "@/generated/prisma";
import type { BarisNilai } from "@/domain/evaluasi/nilai";

/**
 * Lapisan basis data untuk nilai kelas — doc 05 tahap E2.
 *
 * Klien Prisma diterima sebagai PARAMETER, bukan diimpor dari `@/lib/prisma`,
 * mengikuti alasan yang sama seperti `src/lib/kurikulum/usulan-inti.ts`:
 * penyimpanan nilai adalah bagian yang paling mudah rusak diam-diam — upsert
 * mahasiswa, peserta, dan skor di dalam satu transaksi — sehingga ia harus
 * dapat dijalankan uji integrasi terhadap Postgres sungguhan.
 */

export type Klien = PrismaClient;

export interface HasilSimpanNilai {
  /** Mahasiswa yang belum pernah tercatat di prodi ini. */
  mahasiswaBaru: number;
  /** Peserta yang baru masuk ke kelas ini. */
  pesertaBaru: number;
  skorDisimpan: number;
  skorDihapus: number;
}

export async function simpanNilaiKelas(
  klien: Klien,
  arg: {
    kelasId: string;
    prodiId: string;
    baris: readonly BarisNilai[];
    /** Hanya kolom yang benar-benar ada di berkas yang disentuh. */
    kolomDikenal: readonly string[];
  },
): Promise<HasilSimpanNilai> {
  const hasil: HasilSimpanNilai = {
    mahasiswaBaru: 0,
    pesertaBaru: 0,
    skorDisimpan: 0,
    skorDihapus: 0,
  };

  await klien.$transaction(async (tx) => {
    for (const b of arg.baris) {
      // Mahasiswa dibuat sambil jalan. Mewajibkan pendaftaran lebih dulu
      // adalah gesekan yang membuat modul analitik berakhir kosong
      // (docs/00 §7 — "data nilai per butir tidak pernah diisi").
      const ada = await tx.mahasiswa.findUnique({
        where: { prodiId_nim: { prodiId: arg.prodiId, nim: b.nim } },
        select: { id: true, angkatan: true },
      });

      let mahasiswaId: string;
      if (ada) {
        mahasiswaId = ada.id;
        // Angkatan hanya DIISI, tidak pernah ditimpa: berkas nilai bukan
        // sumber kebenaran data mahasiswa, ia hanya kebetulan membawanya.
        if (b.angkatan !== null && ada.angkatan === null) {
          await tx.mahasiswa.update({
            where: { id: mahasiswaId },
            data: { angkatan: b.angkatan },
          });
        }
      } else {
        const dibuat = await tx.mahasiswa.create({
          data: {
            prodiId: arg.prodiId,
            nim: b.nim,
            nama: b.nama || b.nim,
            angkatan: b.angkatan,
          },
          select: { id: true },
        });
        mahasiswaId = dibuat.id;
        hasil.mahasiswaBaru += 1;
      }

      const peserta = await tx.pesertaKelas.findUnique({
        where: { kelasId_mahasiswaId: { kelasId: arg.kelasId, mahasiswaId } },
        select: { id: true },
      });
      let pesertaId: string;
      if (peserta) {
        pesertaId = peserta.id;
      } else {
        const dibuat = await tx.pesertaKelas.create({
          data: { kelasId: arg.kelasId, mahasiswaId },
          select: { id: true },
        });
        pesertaId = dibuat.id;
        hasil.pesertaBaru += 1;
      }

      for (const kode of arg.kolomDikenal) {
        const skor = b.skor[kode];
        if (skor === null || skor === undefined) {
          // Sel yang dikosongkan berarti nilainya ditarik kembali, bukan nol.
          // Kolom yang tidak ada di berkas tidak disentuh sama sekali.
          const dihapus = await tx.nilaiAsesmen.deleteMany({
            where: { pesertaKelasId: pesertaId, asesmenKode: kode },
          });
          hasil.skorDihapus += dihapus.count;
          continue;
        }
        await tx.nilaiAsesmen.upsert({
          where: {
            pesertaKelasId_asesmenKode: { pesertaKelasId: pesertaId, asesmenKode: kode },
          },
          create: { pesertaKelasId: pesertaId, asesmenKode: kode, skor },
          update: { skor },
        });
        hasil.skorDisimpan += 1;
      }
    }
  });

  return hasil;
}

/**
 * Skor per butir ujian — bahan analisis butir (E6).
 *
 * Aturannya sama dengan skor asesmen: sel yang dikosongkan berarti nilainya
 * ditarik kembali, dan peserta yang tidak ada di berkas tidak disentuh.
 * Peserta yang belum terdaftar di kelas DILEWATI, bukan dibuat: lembar butir
 * adalah rincian dari lembar Nilai, bukan pintu masuk mahasiswa baru.
 */
export async function simpanSkorButir(
  klien: Klien,
  arg: {
    kelasId: string;
    /** nomor butir → id baris kisi-kisi. */
    butirId: ReadonlyMap<number, string>;
    peserta: readonly { nim: string; skor: Record<number, number | null> }[];
  },
): Promise<{ skorDisimpan: number; skorDihapus: number; nimTakDikenal: string[] }> {
  const daftar = await klien.pesertaKelas.findMany({
    where: { kelasId: arg.kelasId },
    select: { id: true, mahasiswa: { select: { nim: true } } },
  });
  const perNim = new Map(daftar.map((p) => [p.mahasiswa.nim, p.id]));

  let skorDisimpan = 0;
  let skorDihapus = 0;
  const nimTakDikenal: string[] = [];

  await klien.$transaction(async (tx) => {
    for (const p of arg.peserta) {
      const pesertaKelasId = perNim.get(p.nim);
      if (!pesertaKelasId) {
        nimTakDikenal.push(p.nim);
        continue;
      }

      for (const [nomor, butirKisiKisiId] of arg.butirId) {
        const skor = p.skor[nomor];
        if (skor === null || skor === undefined) {
          const dihapus = await tx.nilaiButir.deleteMany({
            where: { pesertaKelasId, butirKisiKisiId },
          });
          skorDihapus += dihapus.count;
          continue;
        }
        await tx.nilaiButir.upsert({
          where: { pesertaKelasId_butirKisiKisiId: { pesertaKelasId, butirKisiKisiId } },
          create: { pesertaKelasId, butirKisiKisiId, skor },
          update: { skor },
        });
        skorDisimpan += 1;
      }
    }
  });

  return { skorDisimpan, skorDihapus, nimTakDikenal };
}
