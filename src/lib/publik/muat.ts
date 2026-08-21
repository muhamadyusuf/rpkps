import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { cairkanSnapshot, type IsiSnapshot } from "@/domain/rpkps/sidik";
import { dokumenPublik, type DokumenPublik } from "@/domain/rpkps/publik";
import type { SumberProyeksi } from "@/domain/rpkps/proyeksi";
import type { JenjangProdi } from "@/generated/prisma";

/**
 * Pintu tunggal ke data yang boleh dilihat tanpa login.
 *
 * Dua aturan yang tidak boleh dilanggar berkas ini:
 *
 * 1. **Hanya `status: "TERBIT"`.** Setiap kueri di sini menyaringnya. Draf
 *    dan dokumen yang sedang diajukan tidak pernah ikut, sekalipun alamatnya
 *    ditebak dengan benar.
 * 2. **Isi dokumen dibaca dari SALINAN BEKU**, bukan dari data langsung.
 *    `bekukanRpkps()` menyimpannya saat Kaprodi menyetujui. Kalau kurikulum
 *    disunting sesudahnya, halaman publik tetap menampilkan yang disahkan —
 *    persis seperti berkas DOCX yang ditandatangani. Tanpa salinan beku,
 *    halaman menjadi 404, tidak jatuh ke data langsung.
 */

export type ProdiPublik = {
  kode: string;
  nama: string;
  jenjang: JenjangProdi;
  jumlah: number;
};

export type ButirKatalog = {
  prodiKode: string;
  prodiNama: string;
  kode: string;
  nama: string;
  semester: number;
  sksTeori: number;
  sksPraktik: number;
  jumlahCpmk: number;
  tahunAkademik: string;
  versi: number;
};

export type RpkpsPublik = {
  id: string;
  versi: number;
  sidik: string;
  disahkanPada: Date;
  diubahPada: Date;
  prodi: { kode: string; nama: string; jenjang: JenjangProdi };
  kurikulum: { nama: string; tahun: number };
  tahunAkademik: string;
  dokumen: DokumenPublik;
  riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
  /** Tahun akademik lain yang RPKPS-nya juga sudah terbit, terbaru dulu. */
  versiLain: string[];
};

/** Penyaring bersama: satu-satunya sumber kebenaran "apa yang publik". */
const HANYA_TERBIT = { status: "TERBIT" } as const;

/**
 * Urutan "terbaru dulu" untuk tahun akademik. Enum semester diurutkan sesuai
 * deklarasinya di skema (GANJIL, GENAP, ANTARA), yang kebetulan juga urutan
 * kronologisnya dalam satu tahun ajaran.
 */
const TERBARU_DULU = [
  { tahunAkademik: { tahunMulai: "desc" } },
  { tahunAkademik: { semester: "desc" } },
] as const;

/**
 * Identitas institusi untuk kepala halaman, kaki halaman, dan deskripsi meta.
 *
 * Dibaca dari tabel `institusi`, bukan ditulis tetap di kode: satu pemasangan
 * melayani satu institusi, dan namanya sudah ada di sana. Menuliskannya di kode
 * berarti nama yang salah ikut tercetak di kartu pratinjau tautan.
 */
export const muatInstitusi = cache(async () => {
  const baris = await prisma.institusi.findFirst({
    select: { nama: true, namaSingkat: true, situs: true },
  });

  return (
    baris ?? { nama: "Institusi", namaSingkat: "", situs: null as string | null }
  );
});

export const angkaKatalog = cache(async () => {
  const [dokumen, mataKuliah, prodi, tahunAkademik] = await Promise.all([
    prisma.rpkps.count({ where: HANYA_TERBIT }),
    prisma.mataKuliah.count({ where: { rpkps: { some: HANYA_TERBIT } } }),
    prisma.prodi.count({
      where: {
        kurikulum: { some: { mataKuliah: { some: { rpkps: { some: HANYA_TERBIT } } } } },
      },
    }),
    prisma.tahunAkademik.count({ where: { rpkps: { some: HANYA_TERBIT } } }),
  ]);

  return { dokumen, mataKuliah, prodi, tahunAkademik };
});

export const daftarProdiPublik = cache(async (): Promise<ProdiPublik[]> => {
  const prodi = await prisma.prodi.findMany({
    where: {
      kurikulum: { some: { mataKuliah: { some: { rpkps: { some: HANYA_TERBIT } } } } },
    },
    orderBy: { kode: "asc" },
    select: {
      kode: true,
      nama: true,
      jenjang: true,
      kurikulum: {
        select: {
          mataKuliah: {
            where: { rpkps: { some: HANYA_TERBIT } },
            select: { id: true },
          },
        },
      },
    },
  });

  // Menghitung MATA KULIAH, bukan baris RPKPS: satu mata kuliah yang terbit
  // tiga tahun berturut-turut tetap satu kartu di katalog. Dijumlahkan di sini
  // karena Prisma tidak bisa `_count` relasi tiga tingkat dengan penyaring.
  return prodi.map((p) => ({
    kode: p.kode,
    nama: p.nama,
    jenjang: p.jenjang,
    jumlah: p.kurikulum.reduce((total, k) => total + k.mataKuliah.length, 0),
  }));
});

export const daftarTahunAkademikPublik = cache(async () => {
  return prisma.tahunAkademik.findMany({
    where: { rpkps: { some: HANYA_TERBIT } },
    orderBy: [{ tahunMulai: "desc" }, { semester: "desc" }],
    select: { kode: true },
  });
});

export type ProfilLulusanPublik = {
  kode: string;
  deskripsi: string;
  cpl: { kode: string; deskripsi: string }[];
};

/**
 * Profil lulusan satu program studi, untuk halaman katalog publik.
 *
 * Sumbernya kurikulum yang sedang BERLAKU — `ubahStatusKurikulum` menjamin
 * hanya ada satu per prodi. Bila belum ada yang diberlakukan, dipakai kurikulum
 * bertahun terbaru yang punya RPKPS terbit, supaya halaman prodi tetap bicara
 * meski status kurikulumnya belum dirapikan.
 *
 * Berbeda dari isi dokumen RPKPS, bagian ini dibaca dari data LANGSUNG, bukan
 * salinan beku: profil lulusan milik kurikulum, bukan milik satu mata kuliah,
 * dan tidak pernah ikut ditandatangani per RPKPS.
 */
export const profilLulusanProdi = cache(async function profilLulusanProdi(
  prodiKode: string,
): Promise<ProfilLulusanPublik[]> {
  const cocokProdi = {
    prodi: { kode: { equals: prodiKode, mode: "insensitive" as const } },
  };

  const kurikulum =
    (await prisma.kurikulum.findFirst({
      where: { ...cocokProdi, status: "BERLAKU" },
      orderBy: { tahun: "desc" },
      select: { id: true },
    })) ??
    (await prisma.kurikulum.findFirst({
      where: {
        ...cocokProdi,
        mataKuliah: { some: { rpkps: { some: HANYA_TERBIT } } },
      },
      orderBy: { tahun: "desc" },
      select: { id: true },
    }));

  if (!kurikulum) return [];

  const profil = await prisma.profilLulusan.findMany({
    where: { kurikulumId: kurikulum.id },
    orderBy: { urutan: "asc" },
    select: {
      kode: true,
      deskripsi: true,
      cpl: {
        select: { cpl: { select: { kode: true, deskripsi: true, urutan: true } } },
      },
    },
  });

  return profil.map((p) => ({
    kode: p.kode,
    deskripsi: p.deskripsi,
    cpl: p.cpl
      .map((x) => x.cpl)
      .sort((a, b) => a.urutan - b.urutan)
      .map(({ kode, deskripsi }) => ({ kode, deskripsi })),
  }));
});

export type SaringanKatalog = {
  prodi?: string;
  tahunAkademik?: string;
  semester?: number;
  cari?: string;
};

export async function daftarRpkpsPublik(
  saringan: SaringanKatalog = {},
): Promise<ButirKatalog[]> {
  const { prodi, tahunAkademik, semester, cari } = saringan;
  const kata = cari?.trim();

  const baris = await prisma.rpkps.findMany({
    where: {
      ...HANYA_TERBIT,
      ...(tahunAkademik
        ? { tahunAkademik: { kode: { equals: tahunAkademik, mode: "insensitive" } } }
        : {}),
      mataKuliah: {
        ...(semester ? { semester } : {}),
        ...(prodi
          ? { kurikulum: { prodi: { kode: { equals: prodi, mode: "insensitive" } } } }
          : {}),
        ...(kata
          ? {
              OR: [
                { kode: { contains: kata, mode: "insensitive" } },
                { nama: { contains: kata, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    // Terbaru dulu supaya penyaringan ganda di bawah menyisakan tahun akademik
    // termuda untuk tiap mata kuliah. Urutan tampilnya disusun ulang setelah itu.
    orderBy: [...TERBARU_DULU],
    select: {
      versi: true,
      tahunAkademik: { select: { kode: true } },
      mataKuliah: {
        select: {
          kode: true,
          nama: true,
          semester: true,
          sksTeori: true,
          sksPraktik: true,
          _count: { select: { cpmk: true } },
          kurikulum: { select: { prodi: { select: { kode: true, nama: true } } } },
        },
      },
    },
  });

  /**
   * Satu kartu per mata kuliah. Mata kuliah yang terbit tiga tahun berturut-
   * turut punya tiga baris RPKPS, tetapi alamat publiknya satu — yang lama
   * dijangkau lewat `?ta=`. Karena hasil sudah terurut terbaru dulu, cukup
   * mempertahankan kemunculan pertama.
   */
  const terlihat = new Set<string>();
  const butir: ButirKatalog[] = [];

  for (const r of baris) {
    const prodiKode = r.mataKuliah.kurikulum.prodi.kode;
    const kunci = `${prodiKode}/${r.mataKuliah.kode}`.toLowerCase();
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);

    butir.push({
      prodiKode,
      prodiNama: r.mataKuliah.kurikulum.prodi.nama,
      kode: r.mataKuliah.kode,
      nama: r.mataKuliah.nama,
      semester: r.mataKuliah.semester,
      sksTeori: r.mataKuliah.sksTeori,
      sksPraktik: r.mataKuliah.sksPraktik,
      jumlahCpmk: r.mataKuliah._count.cpmk,
      tahunAkademik: r.tahunAkademik.kode,
      versi: r.versi,
    });
  }

  return butir.sort(
    (a, b) => a.semester - b.semester || a.kode.localeCompare(b.kode, "id"),
  );
}

/** Enam pengesahan terakhir, untuk bagian "terbaru" di beranda. */
export const terakhirDisahkan = cache(async (jumlah = 6) => {
  const baris = await prisma.rpkpsSnapshot.findMany({
    where: { rpkps: HANYA_TERBIT },
    orderBy: { dibuatPada: "desc" },
    take: jumlah,
    select: {
      versi: true,
      sidik: true,
      dibuatPada: true,
      rpkps: {
        select: {
          tahunAkademik: { select: { kode: true } },
          mataKuliah: {
            select: {
              kode: true,
              nama: true,
              kurikulum: { select: { prodi: { select: { kode: true, nama: true } } } },
            },
          },
        },
      },
    },
  });

  return baris.map((s) => ({
    versi: s.versi,
    sidik: s.sidik,
    disahkanPada: s.dibuatPada,
    kode: s.rpkps.mataKuliah.kode,
    nama: s.rpkps.mataKuliah.nama,
    prodiKode: s.rpkps.mataKuliah.kurikulum.prodi.kode,
    prodiNama: s.rpkps.mataKuliah.kurikulum.prodi.nama,
    tahunAkademik: s.rpkps.tahunAkademik.kode,
  }));
});

/**
 * Menyelesaikan alamat `/katalog/{prodi}/{kode}` menjadi satu dokumen.
 *
 * Satu kode mata kuliah bisa hidup di dua kurikulum sekaligus (TI214 pada
 * kurikulum 2020 dan 2024) dan diterbitkan berulang tiap tahun akademik.
 * Tanpa `ta`, yang diambil adalah tahun akademik TERBARU; `ta` memilih yang
 * lain, dan seluruh pilihannya dikembalikan lewat `versiLain`.
 */
export const muatRpkpsPublik = cache(async function muatRpkpsPublik(
  prodiKode: string,
  mkKode: string,
  ta?: string,
): Promise<RpkpsPublik | null> {
  const cocokMk = {
    kode: { equals: mkKode, mode: "insensitive" as const },
    kurikulum: {
      prodi: { kode: { equals: prodiKode, mode: "insensitive" as const } },
    },
  };

  const rpkps = await prisma.rpkps.findFirst({
    where: {
      ...HANYA_TERBIT,
      mataKuliah: cocokMk,
      ...(ta ? { tahunAkademik: { kode: { equals: ta, mode: "insensitive" } } } : {}),
    },
    orderBy: [...TERBARU_DULU],
    select: {
      id: true,
      versi: true,
      diubahPada: true,
      tahunAkademik: { select: { kode: true } },
      mataKuliah: {
        select: {
          kurikulum: {
            select: {
              nama: true,
              tahun: true,
              prodi: { select: { kode: true, nama: true, jenjang: true } },
            },
          },
        },
      },
    },
  });
  if (!rpkps) return null;

  const snapshot = await prisma.rpkpsSnapshot.findUnique({
    where: { rpkpsId_versi: { rpkpsId: rpkps.id, versi: rpkps.versi } },
    select: { isi: true, sidik: true, dibuatPada: true },
  });
  // Terbit tanpa salinan beku berarti data tidak konsisten. Menampilkan data
  // langsung sebagai gantinya akan menerbitkan isi yang belum pernah disahkan.
  if (!snapshot) return null;

  const beku = cairkanSnapshot<SumberProyeksi>(snapshot.isi as unknown as IsiSnapshot);

  const semuaTa = await prisma.rpkps.findMany({
    where: { ...HANYA_TERBIT, mataKuliah: cocokMk },
    orderBy: [...TERBARU_DULU],
    select: { tahunAkademik: { select: { kode: true } } },
  });

  return {
    id: rpkps.id,
    versi: rpkps.versi,
    sidik: snapshot.sidik,
    disahkanPada: snapshot.dibuatPada,
    diubahPada: rpkps.diubahPada,
    prodi: rpkps.mataKuliah.kurikulum.prodi,
    kurikulum: {
      nama: rpkps.mataKuliah.kurikulum.nama,
      tahun: rpkps.mataKuliah.kurikulum.tahun,
    },
    tahunAkademik: rpkps.tahunAkademik.kode,
    dokumen: dokumenPublik(beku.rpkps),
    riwayat: beku.riwayat,
    versiLain: semuaTa.map((r) => r.tahunAkademik.kode),
  };
});

/** Semua alamat publik, untuk sitemap. */
export async function semuaAlamatPublik() {
  const baris = await prisma.rpkps.findMany({
    where: HANYA_TERBIT,
    orderBy: [...TERBARU_DULU],
    select: {
      diubahPada: true,
      mataKuliah: {
        select: {
          kode: true,
          kurikulum: { select: { prodi: { select: { kode: true } } } },
        },
      },
    },
  });

  // Satu alamat per (prodi, kode) — tahun akademik lama berbagi halaman yang
  // sama lewat `?ta=`, jadi tidak perlu didaftarkan terpisah ke mesin pencari.
  const terlihat = new Map<string, { prodi: string; kode: string; diubahPada: Date }>();
  for (const r of baris) {
    const prodi = r.mataKuliah.kurikulum.prodi.kode;
    const kunci = `${prodi}/${r.mataKuliah.kode}`.toLowerCase();
    if (!terlihat.has(kunci)) {
      terlihat.set(kunci, { prodi, kode: r.mataKuliah.kode, diubahPada: r.diubahPada });
    }
  }

  return [...terlihat.values()];
}
