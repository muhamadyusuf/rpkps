"use server";

import { prisma } from "@/lib/prisma";
import { segarkan } from "@/lib/bahasa/segarkan";
import { punyaPeranDiProdi, wajibAktif } from "@/lib/otorisasi";
import { kirimNotifikasi } from "@/lib/notifikasi/kirim";
import { PILIH_RUJUKAN_PENGGUNA } from "@/domain/identitas/tampilan";
import { wajibTampilanDariRujukan } from "@/lib/pengguna/tampilan";
import { ProfilTidakTersedia } from "@/lib/identitas/pegawai";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
import { barisRiwayat } from "@/lib/rpkps/riwayat";
import {
  peristiwaSerahTerima,
  periksaCalonKoordinator,
  rencanakanSerahTerima,
} from "@/domain/kurikulum/koordinator";

/**
 * Penugasan dosen koordinator mata kuliah — docs/13.
 *
 * Berbeda dari serah terima per RPKPS (docs/06 §3.3) dalam dua hal yang
 * disengaja: yang boleh melakukannya hanya ADMIN dan Kaprodi dalam cakupan —
 * penugasan adalah keputusan jabatan, bukan kesepakatan antar dosen — dan
 * akibatnya menjangkau RPKPS tahun akademik itu bila sudah ada.
 */

export type Hasil = { ok: boolean; pesan: string };

const tolak = (kam: Kamus) => kam.aksi.lain.koordinatorDitolak;

/**
 * Wewenang menetapkan, ditimbang dari prodi PEMILIK KURIKULUM mata kuliah itu.
 *
 * GPM sengaja tidak ikut meski bercakupan institusi: perannya mengawasi mutu,
 * bukan membagi beban mengajar (docs/13 §2.2).
 */
async function pastikanPenetap(mataKuliahId: string) {
  const sesi = await wajibAktif();
  const mk = await prisma.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    select: {
      id: true,
      kode: true,
      nama: true,
      kurikulumId: true,
      kurikulum: { select: { prodiId: true } },
    },
  });
  if (!mk) return { sesi, mk: null, boleh: false as const };

  return {
    sesi,
    mk,
    boleh: punyaPeranDiProdi(sesi, mk.kurikulum.prodiId, "ADMIN", "KAPRODI"),
  };
}

function segarkanPenugasan(kurikulumId: string, mataKuliahId: string) {
  segarkan(
    `/kurikulum/${kurikulumId}/koordinator`,
    `/kurikulum/${kurikulumId}/mk/${mataKuliahId}`,
    `/kurikulum/${kurikulumId}`,
  );
}

export async function tetapkanKoordinatorMk(
  mataKuliahId: string,
  tahunAkademikId: string,
  penggunaId: string,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const { sesi, mk, boleh } = await pastikanPenetap(mataKuliahId);
  if (!mk) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };
  if (!boleh) return { ok: false, pesan: tolak(kam) };

  const [ta, calon, penugasanLama] = await Promise.all([
    prisma.tahunAkademik.findUnique({
      where: { id: tahunAkademikId },
      select: { id: true, kode: true },
    }),
    prisma.pengguna.findUnique({
      where: { id: penggunaId },
      select: {
        ...PILIH_RUJUKAN_PENGGUNA,
        status: true,
        penugasan: { select: { peran: true } },
      },
    }),
    prisma.koordinatorMk.findUnique({
      where: { mataKuliahId_tahunAkademikId: { mataKuliahId, tahunAkademikId } },
      select: { penggunaId: true, pengguna: { select: { email: true } } },
    }),
  ]);

  if (!ta) return { ok: false, pesan: kam.aksi.takAda.tahunAkademik };
  if (!calon) return { ok: false, pesan: kam.aksi.takAda.dosen };

  /**
   * RPKPS tahun akademik ini, bila sudah ada. Penugasan yang tidak menyentuhnya
   * hanyalah daftar kedua yang harus dijaga sinkron dengan tangan (docs/13 §2.3).
   */
  const rpkps = await prisma.rpkps.findFirst({
    where: { mataKuliahId, tahunAkademikId },
    select: {
      id: true,
      versi: true,
      status: true,
      pengampu: {
        select: {
          penggunaId: true,
          peran: true,
          pengguna: { select: PILIH_RUJUKAN_PENGGUNA },
        },
      },
    },
  });

  // Nama masuk `rpkps_riwayat` (catatan permanen), jadi HARUS dari data segar identitas-itts —
  // nama darurat dari surel tak boleh tertulis selamanya. Bila tak dapat dipastikan, aksi berhenti.
  let tampilan;
  try {
    tampilan = await wajibTampilanDariRujukan([calon, ...(rpkps?.pengampu.map((p) => p.pengguna) ?? [])]);
  } catch (galat) {
    if (galat instanceof ProfilTidakTersedia) return { ok: false, pesan: galat.message };
    throw galat;
  }
  const namaCalon = tampilan.get(calon.id)?.namaLengkap ?? calon.email;

  const kelayakan = periksaCalonKoordinator({
    nama: namaCalon,
    status: calon.status,
    peran: calon.penugasan.map((p) => p.peran),
  });
  if (!kelayakan.boleh) return { ok: false, pesan: kelayakan.alasan ?? kam.aksi.umum.masukanTidakSah };

  const kodeTa = ta.kode.replace("-", " ");

  if (penugasanLama?.penggunaId === penggunaId) {
    return { ok: false, pesan: sisip(kam.aksi.koordinator.sudahMemegang, { nama: namaCalon, mk: mk.kode, ta: kodeTa }) };
  }

  const rencana = rpkps
    ? rencanakanSerahTerima(
        rpkps.pengampu.map((p) => ({
          penggunaId: p.penggunaId,
          peran: p.peran,
          nama: tampilan.get(p.pengguna.id)?.namaLengkap ?? p.pengguna.email,
        })),
        penggunaId,
      )
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.koordinatorMk.upsert({
      where: { mataKuliahId_tahunAkademikId: { mataKuliahId, tahunAkademikId } },
      create: {
        mataKuliahId,
        tahunAkademikId,
        penggunaId,
        ditetapkanOlehId: sesi.id,
      },
      update: {
        penggunaId,
        ditetapkanOlehId: sesi.id,
      },
    });

    await tx.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "KOORDINATOR_MK_DITETAPKAN",
        entitas: "mata_kuliah",
        entitasId: mataKuliahId,
        // Pemegang lama ikut (sebagai surel) karena `@@unique` membuat penetapan ulang di tahun
        // akademik yang sama MENIMPA barisnya; di sinilah jejaknya (docs/13 §2.1). Surel, bukan
        // nama: jejak audit tidak menyimpan nama pegawai (docs/26) — namanya ada di identitas-itts.
        ringkasan: penugasanLama
          ? `${sesi.email} mengalihkan koordinasi ${mk.kode} ${kodeTa} dari ${penugasanLama.pengguna.email} kepada ${calon.email}`
          : `${sesi.email} menetapkan ${calon.email} sebagai koordinator ${mk.kode} ${kodeTa}`,
      },
    });

    if (!rpkps || !rencana || rencana.sudahKoordinator) return;

    if (rencana.perluDitambahkan) {
      const terakhir = await tx.rpkpsPengampu.aggregate({
        where: { rpkpsId: rpkps.id },
        _max: { urutan: true },
      });
      await tx.rpkpsPengampu.create({
        data: {
          rpkpsId: rpkps.id,
          penggunaId,
          peran: "ANGGOTA",
          urutan: (terakhir._max.urutan ?? -1) + 1,
        },
      });
    }

    // Yang lama TURUN, tidak dilepas: ia tetap bagian tim pengampu sampai ada
    // yang melepasnya (docs/06 §3.2).
    await tx.rpkpsPengampu.updateMany({
      where: { rpkpsId: rpkps.id, peran: "KOORDINATOR" },
      data: { peran: "ANGGOTA" },
    });
    await tx.rpkpsPengampu.update({
      where: { rpkpsId_penggunaId: { rpkpsId: rpkps.id, penggunaId } },
      data: { peran: "KOORDINATOR", urutan: 0 },
    });

    await tx.rpkpsRiwayat.create({
      data: {
        rpkpsId: rpkps.id,
        versi: rpkps.versi,
        status: rpkps.status,
        ...barisRiwayat(peristiwaSerahTerima(namaCalon, rencana.namaDiturunkan)),
        olehId: sesi.id,
      },
    });
  });

  await kirimNotifikasi(
    [penggunaId],
    {
      jenis: "KOORDINATOR_MK_DITETAPKAN",
      rpkpsId: rpkps?.id ?? null,
      kurikulumId: mk.kurikulumId,
      mataKuliahId,
      mk: `${mk.kode} ${mk.nama}`,
      ta: kodeTa,
      oleh: sesi.namaLengkap,
    },
    sesi.id,
  );

  segarkanPenugasan(mk.kurikulumId, mataKuliahId);
  if (rpkps) {
    segarkan(`/rpkps/${rpkps.id}`, "/rpkps");
  }

  /**
   * Pesannya menyebut apa yang IKUT terjadi pada RPKPS. Serah terima yang
   * berlangsung diam-diam adalah cara tercepat membuat Kaprodi mengira
   * dokumennya masih dipegang orang lama.
   */
  const ikut =
    rpkps && rencana && !rencana.sudahKoordinator
      ? ` Koordinasi RPKPS ${mk.kode} ${kodeTa} ikut diserahkan kepadanya.`
      : "";

  return { ok: true, pesan: sisip(kam.aksi.koordinator.memegang, { nama: namaCalon, mk: mk.kode, ta: kodeTa, ikut }) };
}

/**
 * Melepas penugasan.
 *
 * Sengaja TIDAK menurunkan koordinator RPKPS yang sudah berjalan (docs/13
 * §2.3): menetapkan adalah pernyataan tentang siapa yang bertanggung jawab,
 * sedangkan melepas hanya menyatakan penugasan itu tidak lagi tercatat — dan
 * RPKPS tanpa penanggung jawab justru keadaan yang docs/06 §3.2 cegah.
 */
export async function lepasKoordinatorMk(
  mataKuliahId: string,
  tahunAkademikId: string,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const { sesi, mk, boleh } = await pastikanPenetap(mataKuliahId);
  if (!mk) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };
  if (!boleh) return { ok: false, pesan: tolak(kam) };

  const baris = await prisma.koordinatorMk.findUnique({
    where: { mataKuliahId_tahunAkademikId: { mataKuliahId, tahunAkademikId } },
    select: {
      pengguna: { select: { email: true } },
      tahunAkademik: { select: { kode: true } },
    },
  });
  if (!baris) return { ok: false, pesan: kam.aksi.koordinator.belumDitugaskan };

  const kodeTa = baris.tahunAkademik.kode.replace("-", " ");

  await prisma.$transaction([
    prisma.koordinatorMk.delete({
      where: { mataKuliahId_tahunAkademikId: { mataKuliahId, tahunAkademikId } },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "KOORDINATOR_MK_DILEPAS",
        entitas: "mata_kuliah",
        entitasId: mataKuliahId,
        // Surel, bukan nama: jejak audit tidak menyimpan nama pegawai (docs/26).
        ringkasan: `${sesi.email} melepas ${baris.pengguna.email} dari koordinasi ${mk.kode} ${kodeTa}`,
      },
    }),
  ]);

  segarkanPenugasan(mk.kurikulumId, mataKuliahId);
  return {
    ok: true,
    pesan: sisip(kam.aksi.koordinator.dilepas, { mk: mk.kode, ta: kodeTa }),
  };
}
