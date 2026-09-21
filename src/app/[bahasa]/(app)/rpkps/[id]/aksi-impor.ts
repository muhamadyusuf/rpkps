"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { prisma } from "@/lib/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { ringkasDraf } from "@/domain/rpkps/draf";
import { riwayat } from "@/domain/rpkps/riwayat";
import type { TemuanImpor } from "@/domain/rpkps/templat";
import { lajuImporTemplat } from "@/lib/keamanan/laju";
import { bolehSuntingIsi, pesanTerkunci, wenangRpkps } from "@/lib/rpkps/wenang";
import { bacaCapIsi, hitungTimpa, type RingkasTimpa } from "@/lib/rpkps/cap-isi";
import { analisisBerkas } from "@/lib/rpkps/impor-templat";
import { pesanGagalTulis } from "@/lib/rpkps/pesan-tulis";
import { barisRiwayat } from "@/lib/rpkps/riwayat";
import { ringkasTulis, selesaikanRujukan, tulisDraf } from "@/lib/rpkps/tulis-draf";

/**
 * Impor isi RPKPS dari template Excel (docs/23).
 *
 * Dua langkah, dan keduanya menganalisis BERKAS dari awal: pratinjau untuk
 * memperlihatkan temuan, penerapan untuk menulis. Penerapan tidak menerima
 * draf dari peramban — yang dipercaya hanya berkas yang dibaca ulang di server
 * (docs/23 T3), ditambah cap versi supaya suntingan rekan setim di sela
 * pratinjau dan penerapan tidak tertimpa diam-diam.
 */

/** Batas jumlah temuan yang dikirim ke peramban; yang di atasnya hanya dihitung. */
const MAKS_TEMUAN = 100;

export interface HasilPratinjauImpor {
  ok: boolean;
  pesan?: string;
  temuan: TemuanImpor[];
  /** Jumlah SELURUH temuan, termasuk yang tidak dikirim. */
  totalTemuan: number;
  ringkas?: ReturnType<typeof ringkasDraf>;
  timpa?: RingkasTimpa;
  /** Penanda versi isi dokumen saat berkas diperiksa; dikirim balik saat menerapkan. */
  cap?: string;
}

const gagal = (pesan: string): HasilPratinjauImpor => ({ ok: false, pesan, temuan: [], totalTemuan: 0 });

type Wenang =
  | { galat: string; kam: Awaited<ReturnType<typeof kamusAksi>> }
  | { galat: null; kam: Awaited<ReturnType<typeof kamusAksi>>; sesi: NonNullable<Awaited<ReturnType<typeof wenangRpkps>>["sesi"]> };

async function pastikanWenang(rpkpsId: string): Promise<Wenang> {
  const kam = await kamusAksi();
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  if (!boleh) return { kam, galat: kam.aksi.wenang.atasRpkps };
  if (!bolehSuntingIsi(status)) return { kam, galat: pesanTerkunci(status, kam) };
  if (!lajuImporTemplat.coba(sesi.id).boleh) return { kam, galat: kam.aksi.impor.terlaluBanyak };
  return { kam, sesi, galat: null };
}

function ambilBerkas(data: FormData): File | null {
  const b = data.get("berkas");
  return b instanceof File && b.size > 0 ? b : null;
}

/** Memeriksa berkas terhadap dokumen ini. Tidak menulis apa pun. */
export async function periksaImporTemplat(
  rpkpsId: string,
  data: FormData,
): Promise<HasilPratinjauImpor> {
  const w = await pastikanWenang(rpkpsId);
  if (w.galat !== null) return gagal(w.galat);

  const berkas = ambilBerkas(data);
  if (!berkas) return gagal(w.kam.aksi.impor.pilihBerkas);

  const a = await analisisBerkas(rpkpsId, berkas);
  if (!a.ok) return { ok: false, temuan: a.temuan, totalTemuan: a.temuan.length };

  const { hasil, k } = a;
  if (hasil.temuan.length > 0 || !hasil.draf) {
    return {
      ok: false,
      temuan: hasil.temuan.slice(0, MAKS_TEMUAN),
      totalTemuan: hasil.temuan.length,
    };
  }

  const [cap, timpa] = await Promise.all([bacaCapIsi(prisma, rpkpsId), hitungTimpa(prisma, rpkpsId, k)]);
  if (!cap) return gagal(w.kam.aksi.takAda.rpkps);

  return {
    ok: true,
    temuan: [],
    totalTemuan: 0,
    ringkas: ringkasDraf(hasil.draf),
    timpa,
    cap,
  };
}

export type HasilTerapImpor = { ok: boolean; pesan: string };

/** Sentinel cap versi; bukan galat basis data, jadi tidak lewat `pesanGagalTulis`. */
class DokumenBerubah extends Error {}

/**
 * Menulis isi berkas ke dokumen setelah dosen menyetujui.
 *
 * Berkas dianalisis ULANG di sini; `cap` hanya penanda bahwa dokumen tidak
 * berubah sejak berkas diperiksa, dan dibandingkan lagi DI DALAM transaksi.
 */
export async function terapkanImporTemplat(
  rpkpsId: string,
  data: FormData,
): Promise<HasilTerapImpor> {
  const w = await pastikanWenang(rpkpsId);
  if (w.galat !== null) return { ok: false, pesan: w.galat };
  const { kam, sesi } = w;

  const berkas = ambilBerkas(data);
  if (!berkas) return { ok: false, pesan: kam.aksi.impor.pilihBerkas };
  const cap = String(data.get("cap") ?? "");

  const a = await analisisBerkas(rpkpsId, berkas);
  if (!a.ok || a.hasil.temuan.length > 0 || !a.hasil.draf) {
    const jumlah = a.ok ? a.hasil.temuan.length : a.temuan.length;
    return { ok: false, pesan: sisip(kam.aksi.impor.masihTemuan, { jumlah }) };
  }
  const { k, hasil, sidikBerkas } = a;
  const draf = hasil.draf;
  if (!draf) return { ok: false, pesan: kam.aksi.impor.pilihBerkas };

  const { hilang, rencana } = selesaikanRujukan(
    k.pertemuan,
    k.mataKuliah.cpmk.flatMap((c) => c.subCpmk),
    draf,
  );
  if (hilang.length > 0) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.lain.drafRujukanHilang, {
        n: hilang.length,
        daftar: `${hilang.slice(0, 5).join(", ")}${hilang.length > 5 ? ", …" : ""}`,
      }),
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Cap dibaca DI DALAM transaksi. Jendela antara pembacaan ini dan
        // penulisan di bawahnya tidak nol — penyunting lain menulis ke baris
        // yang berbeda dan tidak menunggu kita — tetapi ia berukuran
        // milidetik, bukan menit seperti jarak pratinjau ke persetujuan.
        if ((await bacaCapIsi(tx, rpkpsId)) !== cap) throw new DokumenBerubah();

        // `sumber` KURIKULUM = "ditulis manusia" (nilai bawaan kolom). Isi dari
        // berkas adalah tulisan dosen; lencana AI di sini akan menyesatkan.
        await tulisDraf(tx, rpkpsId, draf, rencana, "KURIKULUM");

        const ringkas = ringkasTulis(draf);
        await tx.rpkpsRiwayat.create({
          data: {
            rpkpsId,
            versi: 1,
            status: "DRAF",
            ...barisRiwayat(riwayat("IMPOR_TEMPLAT_DITERAPKAN", { oleh: sesi.email, ringkas })),
            olehId: sesi.id,
          },
        });
        // Nama dan SIDIK berkas, bukan isinya: bukti berkas apa yang diterapkan
        // tanpa menyalin sel-sel dosen ke jejak audit.
        await tx.logAudit.create({
          data: {
            penggunaId: sesi.id,
            aksi: "RPKPS_IMPOR_DITERAPKAN",
            entitas: "rpkps",
            entitasId: rpkpsId,
            ringkasan: `${sesi.email} mengimpor isi dari template — ${ringkas}`,
            data: { berkas: berkas.name.slice(0, 200), sha256: sidikBerkas, ukuran: berkas.size },
          },
        });
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
  } catch (galat) {
    if (galat instanceof DokumenBerubah) return { ok: false, pesan: kam.aksi.impor.dokumenBerubah };
    console.error("[rpkps] gagal menerapkan impor template:", galat);
    return { ok: false, pesan: pesanGagalTulis(galat, kam) };
  }

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan(`/rpkps/${rpkpsId}/mingguan`);
  segarkan(`/rpkps/${rpkpsId}/tugas`);
  segarkan(`/rpkps/${rpkpsId}/kisi-kisi`);
  return { ok: true, pesan: kam.aksi.impor.diterapkan };
}
