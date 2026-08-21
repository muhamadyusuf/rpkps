import "server-only";
import { prisma } from "@/lib/prisma";
import { KEBIJAKAN_BAWAAN } from "@/domain/beban-belajar/kebijakan-bawaan";
import type { Kebijakan } from "@/domain/beban-belajar/tipe";

/**
 * Memuat kebijakan beban belajar yang berlaku. Bila belum ada di database,
 * dipakai bawaan SN-Dikti supaya kalkulator tetap jalan — tetapi halaman
 * pemanggil bertanggung jawab memberi tahu bahwa kebijakan belum dikunci.
 */
export async function muatKebijakan(): Promise<{ kebijakan: Kebijakan; dariDatabase: boolean }> {
  const baris = await prisma.kebijakanBebanBelajar.findFirst({
    orderBy: [{ status: "asc" }, { dibuatPada: "desc" }],
    include: { bentuk: true },
  });

  if (!baris || baris.bentuk.length === 0) {
    return { kebijakan: KEBIJAKAN_BAWAAN, dariDatabase: false };
  }

  return {
    dariDatabase: true,
    kebijakan: {
      mingguPerSemester: baris.mingguPerSemester,
      pertemuanEfektifTeori: baris.pertemuanEfektifTeori,
      pertemuanEfektifPraktik: baris.pertemuanEfektifPraktik,
      hitungMingguUjian: baris.hitungMingguUjian,
      menitTmPerUjian: baris.menitTmPerUjian,
      jamPerSksPerSemester: Number(baris.jamPerSksPerSemester),
      toleransiSemesterPersen: Number(baris.toleransiSemesterPersen),
      toleransiPertemuanPersen: Number(baris.toleransiPertemuanPersen),
      bentuk: baris.bentuk.map((b) => ({
        bentuk: b.bentuk,
        tm: b.menitTmPerSks,
        pt: b.menitPtPerSks,
        bm: b.menitBmPerSks,
        tmTerjadwal: b.tmTerjadwal,
        butuhRuangKhusus: b.butuhRuangKhusus,
      })),
    },
  };
}

export type RpkpsLengkap = NonNullable<Awaited<ReturnType<typeof muatRpkps>>>;

export async function muatRpkps(id: string) {
  return prisma.rpkps.findUnique({
    where: { id },
    include: {
      tahunAkademik: true,
      mataKuliah: {
        include: {
          kurikulum: {
            select: { id: true, nama: true, tahun: true, prodiId: true, prodi: { select: { nama: true, kode: true } } },
          },
          cpl: { include: { cpl: { select: { id: true, kode: true, deskripsi: true } } } },
          cpmk: {
            orderBy: { urutan: "asc" },
            include: {
              cpl: { include: { cpl: { select: { kode: true } } } },
              subCpmk: { orderBy: { urutan: "asc" } },
            },
          },
        },
      },
      pengampu: {
        orderBy: { urutan: "asc" },
        include: {
          pengguna: {
            select: { id: true, nama: true, gelarDepan: true, gelarBelakang: true, nidn: true, nip: true },
          },
        },
      },
      pustaka: { orderBy: [{ jenis: "asc" }, { nomor: "asc" }] },
      komponenNilai: { orderBy: { urutan: "asc" } },
      kisiKisi: {
        orderBy: { jenis: "asc" },
        include: {
          butir: {
            orderBy: { nomor: "asc" },
            include: { subCpmk: { select: { id: true, kode: true, rumusan: true } } },
          },
        },
      },
      tugas: {
        orderBy: { nomor: "asc" },
        include: {
          subCpmk: { include: { subCpmk: { select: { id: true, kode: true } } } },
          kriteria: { orderBy: { nomor: "asc" } },
          linimasa: { orderBy: { minggu: "asc" } },
          komponenNilai: { select: { nama: true } },
        },
      },
      pertemuan: {
        orderBy: { minggu: "asc" },
        include: {
          subCpmk: { include: { subCpmk: { select: { id: true, kode: true, rumusan: true } } } },
          aktivitas: { orderBy: { urutan: "asc" } },
          indikator: { orderBy: { urutan: "asc" } },
          pustaka: { include: { pustaka: { select: { nomor: true, jenis: true } } } },
        },
      },
    },
  });
}

// keRpkpsInput dipindahkan ke src/domain/rpkps/pemetaan.ts karena murni.
export { keRpkpsInput } from "@/domain/rpkps/pemetaan";

export { namaLengkapPengampu } from "@/domain/rpkps/pemetaan";

/**
 * Menyaring id Sub-CPMK kiriman klien, menyisakan yang benar-benar milik mata
 * kuliah RPKPS ini.
 *
 * Rantai kepemilikannya berjenjang: RPKPS → MataKuliah → CPMK → Sub-CPMK.
 * Tanpa penyaringan ini, id Sub-CPMK dari mata kuliah — bahkan prodi — lain
 * bisa ditempelkan ke pertemuan, tugas, atau kisi-kisi. Mengembalikan yang
 * ASING, bukan sekadar boolean, supaya pesan galat dapat menyebut penyebabnya.
 */
export async function saringSubCpmkMilikRpkps(
  rpkpsId: string,
  subCpmkId: readonly string[],
): Promise<{ sah: string[]; asing: string[] }> {
  const diminta = [...new Set(subCpmkId)];
  if (diminta.length === 0) return { sah: [], asing: [] };

  const baris = await prisma.subCpmk.findMany({
    where: {
      id: { in: diminta },
      cpmk: { mataKuliah: { rpkps: { some: { id: rpkpsId } } } },
    },
    select: { id: true },
  });

  const sah = new Set(baris.map((b) => b.id));
  return {
    sah: diminta.filter((id) => sah.has(id)),
    asing: diminta.filter((id) => !sah.has(id)),
  };
}
