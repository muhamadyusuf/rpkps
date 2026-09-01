"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { JenjangProdi, SemesterTipe } from "@/generated/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";

export type HasilAksi = { ok: boolean; pesan: string };

const SkemaProdi = z.object({
  nama: z.string().trim().min(3, "@aksi.periksa.namaProdiMinimal"),
  kode: z
    .string()
    .trim()
    .min(2, "@aksi.periksa.kodeMinimal")
    .transform((v) => v.toUpperCase()),
  jenjang: z.enum(["D3", "D4", "S1", "S2", "S3", "PROFESI"]),
  gelar: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function tambahProdi(data: FormData): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const parsed = SkemaProdi.safeParse({
    nama: data.get("nama"),
    kode: data.get("kode"),
    jenjang: data.get("jenjang"),
    gelar: data.get("gelar"),
  });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const fakultas = await prisma.fakultas.findFirst({ select: { id: true } });
  if (!fakultas) {
    return {
      ok: false,
      pesan: kam.aksi.takAda.fakultas,
    };
  }

  try {
    await prisma.prodi.create({
      data: {
        ...parsed.data,
        jenjang: parsed.data.jenjang as JenjangProdi,
        fakultasId: fakultas.id,
      },
    });
  } catch (galat) {
    return {
      ok: false,
      pesan:
        galat instanceof Error && galat.message.includes("Unique constraint")
          ? sisip(kam.aksi.lain.kodeProdiTerpakai, { kode: parsed.data.kode })
          : kam.aksi.lain.gagalSimpanProdi,
    };
  }

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PRODI_DITAMBAHKAN",
      entitas: "prodi",
      ringkasan: `${sesi.email} menambahkan prodi ${parsed.data.kode}`,
    },
  });

  segarkan("/master/prodi");
  return { ok: true, pesan: kam.aksi.master.prodiDitambahkan };
}

export async function ubahAktifProdi(id: string, aktif: boolean): Promise<HasilAksi> {
  await wajibPeran("ADMIN");
  await prisma.prodi.update({ where: { id }, data: { aktif } });
  segarkan("/master/prodi");
  return { ok: true, pesan: aktif ? "Prodi diaktifkan." : "Prodi dinonaktifkan." };
}

const SkemaTahun = z.object({
  tahunMulai: z.coerce
    .number()
    .int()
    .min(2000, "@aksi.periksa.tahunTakMasukAkal")
    .max(2100, "@aksi.periksa.tahunTakMasukAkal"),
  semester: z.enum(["GANJIL", "GENAP", "ANTARA"]),
});

export async function tambahTahunAkademik(data: FormData): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const parsed = SkemaTahun.safeParse({
    tahunMulai: data.get("tahunMulai"),
    semester: data.get("semester"),
  });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const { tahunMulai, semester } = parsed.data;
  const kode = `${tahunMulai}/${tahunMulai + 1}-${semester}`;

  try {
    await prisma.tahunAkademik.create({
      data: {
        kode,
        tahunMulai,
        tahunSelesai: tahunMulai + 1,
        semester: semester as SemesterTipe,
      },
    });
  } catch (galat) {
    return {
      ok: false,
      pesan:
        galat instanceof Error && galat.message.includes("Unique constraint")
          ? sisip(kam.aksi.lain.tahunSudahAda, { kode })
          : kam.aksi.lain.gagalSimpanTahun,
    };
  }

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "TAHUN_AKADEMIK_DITAMBAHKAN",
      entitas: "tahun_akademik",
      ringkasan: `${sesi.email} menambahkan ${kode}`,
    },
  });

  segarkan("/master/tahun-akademik");
  return { ok: true, pesan: sisip(kam.aksi.master.taDitambahkan, { kode }) };
}

/** Hanya satu tahun akademik yang boleh aktif — sisanya dimatikan sekaligus. */
/**
 * Menetapkan salah satu dari TIGA tenggat semester (docs/14 §3.3):
 * penyusunan bagi dosen, review bagi Kaprodi, pengesahan bagi Penjaminan Mutu.
 *
 * Tenggat TIDAK mengunci apa pun: melewatinya tidak menutup penyuntingan,
 * tidak menolak pengajuan, dan tidak menolak pengesahan. Yang berubah hanya
 * urgensi pada antrian kerja dan daftar RPKPS — lihat `nilaiTenggatDokumen` di
 * src/domain/rpkps/tenggat.ts. Karena itu ia boleh dikosongkan lagi, dan
 * tanggal di masa lalu pun sah (semester yang sudah berjalan tetap perlu
 * ditandai terlambat).
 */
export type JenisTenggat = "PENYUSUNAN" | "REVIEW" | "PENGESAHAN";

const KOLOM_TENGGAT = {
  PENYUSUNAN: "tenggatPenyusunan",
  REVIEW: "tenggatReview",
  PENGESAHAN: "tenggatPengesahan",
} as const;

const SEBUTAN_TENGGAT = {
  PENYUSUNAN: "penyusunan",
  REVIEW: "review",
  PENGESAHAN: "pengesahan",
} as const;

export async function aturTenggat(
  id: string,
  jenis: JenisTenggat,
  tanggal: string | null,
): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  let tenggat: Date | null = null;
  if (tanggal && tanggal.trim().length > 0) {
    // Batas dibaca sebagai AKHIR hari itu: "31 Agustus" berarti sampai 31
    // Agustus lewat, bukan sampai tengah malam menjelang tanggal itu.
    const t = new Date(`${tanggal}T23:59:59`);
    if (Number.isNaN(t.getTime())) return { ok: false, pesan: kam.aksi.umum.tanggalTidakSah };
    tenggat = t;
  }

  const tahun = await prisma.tahunAkademik.findUnique({
    where: { id },
    select: { tenggatPenyusunan: true, tenggatReview: true, tenggatPengesahan: true },
  });
  if (!tahun) return { ok: false, pesan: kam.aksi.takAda.tahunAkademik };

  /**
   * Urutannya harus menaik. Tenggat review yang jatuh sebelum tenggat
   * penyusunan menuntut Kaprodi memutuskan dokumen yang belum boleh diajukan —
   * dan yang salah di situ jadwalnya, bukan orangnya.
   */
  const calon = { ...tahun, [KOLOM_TENGGAT[jenis]]: tenggat };
  const urut: [string, Date | null][] = [
    ["penyusunan", calon.tenggatPenyusunan],
    ["review", calon.tenggatReview],
    ["pengesahan", calon.tenggatPengesahan],
  ];
  const terisi = urut.filter((u): u is [string, Date] => u[1] !== null);
  for (let i = 1; i < terisi.length; i++) {
    if (terisi[i]![1] < terisi[i - 1]![1]) {
      return {
        ok: false,
        pesan: sisip(kam.aksi.master.tenggatUrutan, { kedua: terisi[i]![0], pertama: terisi[i - 1]![0] }),
      };
    }
  }

  await prisma.$transaction([
    prisma.tahunAkademik.update({
      where: { id },
      data: { [KOLOM_TENGGAT[jenis]]: tenggat },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "TENGGAT_RPKPS_DIATUR",
        entitas: "tahun_akademik",
        entitasId: id,
        ringkasan: tenggat
          ? `${sesi.email} menetapkan tenggat ${SEBUTAN_TENGGAT[jenis]} ${tenggat.toISOString().slice(0, 10)}`
          : `${sesi.email} menghapus tenggat ${SEBUTAN_TENGGAT[jenis]}`,
      },
    }),
  ]);

  segarkan("/master/tahun-akademik");
  segarkan("/dashboard");
  segarkan("/rpkps");
  return { ok: true, pesan: tenggat ? "Tenggat disimpan." : "Tenggat dihapus." };
}

export async function aktifkanTahunAkademik(id: string): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  await prisma.$transaction([
    prisma.tahunAkademik.updateMany({
      where: { aktif: true, id: { not: id } },
      data: { aktif: false },
    }),
    prisma.tahunAkademik.update({ where: { id }, data: { aktif: true } }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "TAHUN_AKADEMIK_DIAKTIFKAN",
        entitas: "tahun_akademik",
        entitasId: id,
        ringkasan: `${sesi.email} mengaktifkan tahun akademik`,
      },
    }),
  ]);

  segarkan("/master/tahun-akademik");
  segarkan("/dashboard");
  return { ok: true, pesan: kam.aksi.master.taDiaktifkan };
}
