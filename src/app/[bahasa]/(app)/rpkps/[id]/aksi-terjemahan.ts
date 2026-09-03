"use server";

import { prisma } from "@/lib/prisma";
import { segarkan } from "@/lib/bahasa/segarkan";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { GalatAi } from "@/lib/ai/galat";
import { terjemahkanRpkps } from "@/lib/ai/terjemahan-rpkps";
import { bolehSuntingIsi, pesanTerkunci, wenangRpkps } from "@/lib/rpkps/wenang";
import { muatRpkps, type RpkpsLengkap } from "@/lib/rpkps/muat";
import { medanRpkps } from "@/lib/rpkps/terjemahan";
import {
  kelompokkanTerjemahan,
  tulisTerjemahan,
  type LarikSekarang,
} from "@/lib/rpkps/terjemahan-tulis";
import { medanBelumDiterjemahkan, type MedanTerjemahan } from "@/domain/rpkps/terjemahan";

/**
 * Terjemahan berbantuan AI — tahap L7 pada docs/11 §8.
 *
 * Dua aksi terpisah, dan pemisahannya adalah intinya: `usulkanTerjemahan`
 * hanya MEMINTA dan mengembalikan draf; `terapkanTerjemahan` menulis apa yang
 * sudah ditinjau dosen. Tidak ada jalan dari model langsung ke basis data.
 *
 * Tidak ada terjemahan massal. Satu tombol, satu RPKPS, satu peninjauan —
 * dokumen yang tidak pernah dibaca manusia sebelum terbit adalah dokumen yang
 * tidak dapat dipertanggungjawabkan (docs/11 §10).
 */

export type Usul = {
  alamat: string;
  label: string;
  asal: string;
  teks: string;
};

export type HasilUsulTerjemahan =
  | { ok: false; pesan: string }
  | {
      ok: true;
      pesan: string;
      usul: Usul[];
      /**
       * Medan yang diminta tetapi tidak dijawab model sampai ronde terakhir.
       * Ditampilkan apa adanya: dosen yang menekan tombol berhak tahu bahwa
       * dokumennya belum tertutup, bukan menemukannya sendiri dari angka
       * kelengkapan yang tidak bergerak.
       */
      kurang: number;
      penyedia: string;
      model: string;
    };

async function pastikanWenang(rpkpsId: string) {
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  return { sesi, boleh, status, dapatDisunting: bolehSuntingIsi(status) };
}

export async function usulkanTerjemahan(
  rpkpsId: string,
  /** Kunci AI yang dipilih dosen; kosong berarti kunci bawaannya. */
  kredensialId?: string | null,
): Promise<HasilUsulTerjemahan> {
  const kam = await kamusAksi();
  const { boleh, dapatDisunting, status, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const rpkps = await muatRpkps(rpkpsId);
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const semua = medanRpkps(rpkps);
  const perlu = medanBelumDiterjemahkan(semua);
  if (perlu.length === 0) {
    return { ok: false, pesan: kam.aksi.terjemahan.sudahLengkap };
  }

  try {
    const hasil = await terjemahkanRpkps({
      penggunaId: sesi.id,
      entitasId: rpkpsId,
      medan: perlu,
      kredensialId,
    });

    const perAlamat = new Map(perlu.map((m) => [m.alamat, m]));
    const usul: Usul[] = hasil.diterima.flatMap((d) => {
      const m = perAlamat.get(d.alamat);
      return m ? [{ alamat: d.alamat, label: m.label, asal: m.asal, teks: d.teks }] : [];
    });

    return {
      ok: true,
      pesan:
        hasil.kurang.length === 0
          ? sisip(kam.aksi.terjemahan.selesaiPenuh, { jumlah: usul.length })
          : sisip(kam.aksi.terjemahan.selesai, {
              jumlah: usul.length,
              diminta: perlu.length,
              kurang: hasil.kurang.length,
            }),
      usul,
      kurang: hasil.kurang.length,
      penyedia: hasil.penyedia,
      model: hasil.model,
    };
  } catch (galat) {
    if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
    console.error("[rpkps] gagal menerjemahkan:", galat);
    return { ok: false, pesan: kam.aksi.terjemahan.gagal };
  }
}

/**
 * Larik `*En` yang sekarang, disesuaikan panjangnya dengan larik INDONESIA.
 *
 * Kolom `subtopik_en` dan `rincian_en` ditulis utuh, bukan per elemen (lihat
 * `terjemahan-tulis.ts`), jadi penulisannya butuh dasar. Dasarnya diambil dari
 * dokumen yang baru saja dimuat — bukan dari peramban — supaya menerapkan satu
 * subtopik tidak memangkas subtopik lain yang sudah diterjemahkan lebih dulu,
 * dan supaya larik hasil selalu sepanjang larik Indonesia.
 */
function larikSekarang(rpkps: RpkpsLengkap): LarikSekarang {
  const peta = new Map<string, string[]>();
  const isi = (kunci: string, asal: readonly string[], terjemahan: readonly string[]) => {
    peta.set(kunci, asal.map((_, i) => terjemahan[i] ?? ""));
  };

  for (const p of rpkps.pertemuan) {
    isi(`pertemuan:${p.id}:subtopikEn`, p.subtopik, p.subtopikEn);
  }
  for (const t of rpkps.tugas) {
    for (const kr of t.kriteria) {
      isi(`kriteriaTugas:${kr.id}:rincianEn`, kr.rincian, kr.rincianEn);
    }
  }
  return peta;
}

export type HasilTerapTerjemahan = { ok: boolean; pesan: string };

export async function terapkanTerjemahan(
  rpkpsId: string,
  pilihan: readonly { alamat: string; teks: string }[],
): Promise<HasilTerapTerjemahan> {
  const kam = await kamusAksi();
  const { boleh, dapatDisunting, status, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const rpkps = await muatRpkps(rpkpsId);
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  /*
   * Alamat disahkan terhadap dokumen INI, bukan sekadar terhadap bentuknya:
   * id baris bersifat global, sedangkan wewenang yang diperiksa di atas hanya
   * berlaku untuk RPKPS ini. Penyaringan dan pengelompokannya di
   * `kelompokkanTerjemahan`, berdampingan dengan SQL yang menulisnya.
   */
  const { kelompok, larik, jumlah } = kelompokkanTerjemahan(
    new Set(medanRpkps(rpkps).map((m) => m.alamat)),
    pilihan,
    larikSekarang(rpkps),
  );
  if (jumlah === 0) return { ok: false, pesan: kam.aksi.terjemahan.tidakAdaDipilih };

  await tulisTerjemahan(prisma, kelompok, larik);

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "RPKPS_DITERJEMAHKAN",
      entitas: "rpkps",
      entitasId: rpkpsId,
      ringkasan: `${sesi.email} menerapkan ${jumlah} terjemahan berbantuan AI`,
    },
  });

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan(`/rpkps/${rpkpsId}/mingguan`);
  segarkan(`/rpkps/${rpkpsId}/tugas`);
  return {
    ok: true,
    pesan: sisip(kam.aksi.terjemahan.diterapkan, { jumlah }),
  };
}

export type { MedanTerjemahan };
