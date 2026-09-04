"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { segarkan } from "@/lib/bahasa/segarkan";
import { kamusAksi } from "@/lib/bahasa/server";
import { pesanZod } from "@/lib/bahasa/zod";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import { urlSitus } from "@/lib/publik/tautan";
import {
  BAWAAN_HARI_BERBAGI,
  MAKS_HARI_BERBAGI,
  MIN_HARI_BERBAGI,
  hitungKedaluwarsa,
  jepitHari,
} from "@/domain/rpkps/berbagi";

/**
 * Tautan pratinjau bertoken — docs/06 §4.2 (tahap B5).
 *
 * Yang dibagikan di sini adalah dokumen yang BELUM disahkan, kepada orang yang
 * tidak punya akun. Karena itu pembuatannya bukan hak setiap pengampu:
 * koordinator dan pengelola prodi yang memegang dokumen, bukan anggota tim.
 * Membagikan draf ke luar institusi adalah keputusan pemegang dokumen.
 *
 * Pencabutan tidak menghapus barisnya. Siapa membagikan apa kepada siapa
 * adalah justru jejak yang paling berguna saat ada pertanyaan.
 */

export type HasilBerbagi =
  | { ok: false; pesan: string }
  | { ok: true; pesan: string; url?: string };

const SkemaTautan = z.object({
  catatan: z.string().trim().max(200, "@aksi.periksa.catatanTautanPanjang").nullable(),
  hari: z
    .number()
    .int()
    .min(MIN_HARI_BERBAGI, "@aksi.periksa.hariTautanMinimal")
    .max(MAKS_HARI_BERBAGI, "@aksi.periksa.hariTautanMaksimal"),
});

export type MasukanTautan = z.input<typeof SkemaTautan>;

/**
 * Token: 32 bita acak kriptografis, base64url.
 *
 * Bukan cuid dan bukan uuid. Keduanya dirancang agar unik, bukan agar tidak
 * dapat ditebak — dan token inilah satu-satunya penjaga pintu ini.
 */
function tokenBaru(): string {
  return randomBytes(32).toString("base64url");
}

export async function buatTautanBerbagi(
  rpkpsId: string,
  masukan: MasukanTautan,
): Promise<HasilBerbagi> {
  const kam = await kamusAksi();
  const wenang = await wenangRpkps(rpkpsId);
  if (!wenang.boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!wenang.pengelola && !wenang.koordinator) {
    return { ok: false, pesan: kam.aksi.rpkps.hanyaPemegangBerbagi };
  }

  const parsed = SkemaTautan.safeParse(masukan);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const token = tokenBaru();
  await prisma.tautanBerbagi.create({
    data: {
      rpkpsId,
      token,
      catatan: parsed.data.catatan,
      kedaluwarsa: hitungKedaluwarsa(parsed.data.hari, new Date()),
      dibuatOlehId: wenang.sesi.id,
    },
  });

  await prisma.logAudit.create({
    data: {
      penggunaId: wenang.sesi.id,
      aksi: "RPKPS_TAUTAN_DIBUAT",
      entitas: "rpkps",
      entitasId: rpkpsId,
      // Tokennya TIDAK dicatat: log audit dibaca lebih banyak orang daripada
      // yang berhak membuka tautannya.
      ringkasan: `${wenang.sesi.email} membuat tautan pratinjau berlaku ${jepitHari(parsed.data.hari)} hari`,
    },
  });

  segarkan(`/rpkps/${rpkpsId}`);
  return {
    ok: true,
    pesan: kam.aksi.rpkps.tautanDibuat,
    url: `${urlSitus()}/id/pratinjau/${token}`,
  };
}

export async function cabutTautanBerbagi(tautanId: string): Promise<HasilBerbagi> {
  const kam = await kamusAksi();
  const tautan = await prisma.tautanBerbagi.findUnique({
    where: { id: tautanId },
    select: { id: true, rpkpsId: true, dicabutPada: true },
  });
  if (!tautan) return { ok: false, pesan: kam.aksi.takAda.tautan };

  const wenang = await wenangRpkps(tautan.rpkpsId);
  if (!wenang.boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!wenang.pengelola && !wenang.koordinator) {
    return { ok: false, pesan: kam.aksi.rpkps.hanyaPemegangBerbagi };
  }
  if (tautan.dicabutPada) return { ok: false, pesan: kam.aksi.rpkps.tautanSudahDicabut };

  await prisma.tautanBerbagi.update({
    where: { id: tautan.id },
    data: { dicabutPada: new Date() },
  });

  await prisma.logAudit.create({
    data: {
      penggunaId: wenang.sesi.id,
      aksi: "RPKPS_TAUTAN_DICABUT",
      entitas: "rpkps",
      entitasId: tautan.rpkpsId,
      ringkasan: `${wenang.sesi.email} mencabut sebuah tautan pratinjau`,
    },
  });

  segarkan(`/rpkps/${tautan.rpkpsId}`);
  return { ok: true, pesan: kam.aksi.rpkps.tautanDicabut };
}

export { BAWAAN_HARI_BERBAGI, MAKS_HARI_BERBAGI };
