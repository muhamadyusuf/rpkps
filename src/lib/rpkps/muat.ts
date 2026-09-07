import "server-only";
import { prisma } from "@/lib/prisma";
import { muatKebijakanDari } from "@/lib/rpkps/kebijakan-inti";

/**
 * Memuat kebijakan beban belajar yang berlaku. Bila belum ada di database,
 * dipakai bawaan SN-Dikti supaya kalkulator tetap jalan — tetapi halaman
 * pemanggil bertanggung jawab memberi tahu bahwa kebijakan belum dikunci.
 */
/** Kebijakan yang berlaku, memakai klien global. Lihat `kebijakan-inti.ts`. */
export async function muatKebijakan() {
  return muatKebijakanDari(prisma);
}

export type RpkpsLengkap = NonNullable<Awaited<ReturnType<typeof muatRpkps>>>;

/**
 * Kolom `*En` ikut dipilih di mana pun teksnya TERCETAK.
 *
 * `naskahEn` (`src/lib/dokumen/naskah-en.ts`) menaikkan tiap kolom `*En` ke
 * atas pasangan Indonesianya sebelum dokumen dicetak atau dipratinjau; kolom
 * yang tidak ikut terbaca di sini tidak pernah punya kesempatan naik, dan
 * gagalnya senyap — paragrafnya sekadar tetap berbahasa Indonesia. Menambahnya
 * di sini TIDAK menyentuh `proyeksiIsi()`, jadi sidik ruang pertama tidak
 * bergeser.
 */
export async function muatRpkps(id: string) {
  return prisma.rpkps.findUnique({
    where: { id },
    include: {
      tahunAkademik: true,
      mataKuliah: {
        include: {
          kurikulum: {
            select: {
              id: true,
              nama: true,
              tahun: true,
              prodiId: true,
              prodi: { select: { nama: true, namaEn: true, kode: true } },
            },
          },
          /*
           * `deskripsiEn` ikut karena `proyeksiIsiEn` membacanya: tanpa kolom
           * ini ia selalu jatuh ke cadangan bahasa Indonesia, dan CPL yang
           * sudah diterjemahkan di kurikulum tidak pernah sampai ke naskah
           * Inggris — tanpa galat, hanya paragraf yang tetap berbahasa
           * Indonesia. Ia TIDAK menyentuh `proyeksiIsi`, jadi sidik ruang
           * pertama tidak bergeser.
           */
          cpl: {
            include: {
              cpl: {
                select: { id: true, kode: true, deskripsi: true, deskripsiEn: true },
              },
            },
          },
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
      /**
       * Seluruh ronde ikut dimuat, bukan hanya yang berjalan: halaman dokumen
       * menampilkan riwayat tanda tangan, dan penyaringan per ronde dikerjakan
       * `statusParaf` yang murni.
       */
      tandaTangan: { orderBy: [{ versi: "desc" }, { ditandatanganiPada: "asc" }] },
      pustaka: { orderBy: [{ jenis: "asc" }, { nomor: "asc" }] },
      komponenNilai: { orderBy: { urutan: "asc" } },
      kisiKisi: {
        orderBy: { jenis: "asc" },
        include: {
          butir: {
            orderBy: { nomor: "asc" },
            include: {
              subCpmk: {
                select: { id: true, kode: true, rumusan: true, rumusanEn: true },
              },
            },
          },
        },
      },
      tugas: {
        orderBy: { nomor: "asc" },
        include: {
          subCpmk: { include: { subCpmk: { select: { id: true, kode: true } } } },
          kriteria: { orderBy: { nomor: "asc" } },
          linimasa: { orderBy: { minggu: "asc" } },
          komponenNilai: { select: { nama: true, namaEn: true } },
        },
      },
      pertemuan: {
        orderBy: { minggu: "asc" },
        include: {
          subCpmk: {
            include: {
              subCpmk: {
                select: { id: true, kode: true, rumusan: true, rumusanEn: true },
              },
            },
          },
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
