import "server-only";
import { segarkan } from "@/lib/bahasa/segarkan";
import { kamusAksi } from "@/lib/bahasa/server";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibPeran } from "@/lib/otorisasi";
import { bolehSuntingKurikulum, type Kelayakan } from "@/domain/kurikulum/sunting";
import * as inti from "./sunting-inti";

/**
 * Pembungkus gerbang penyuntingan kurikulum untuk aplikasi. Acuan: docs/15 §5.
 *
 * Sensusnya ada di `sunting-inti.ts`, yang menerima klien Prisma sebagai
 * parameter agar dapat diuji terhadap Postgres tertanam. Berkas ini
 * mengikatnya ke klien aplikasi dan menyatukan tiga hal yang berulang di tiap
 * aksi: wewenang, pencatatan audit, dan penyegaran cache.
 *
 * Dipisahkan dari berkas aksi supaya `aksi-cpl.ts`, `aksi-mk.ts`, dan
 * `aksi-cpmk.ts` tidak menyalin ulang aturan yang sama — pola kegagalan yang
 * persis pernah terjadi pada `bolehSuntingIsi` RPKPS, yang tersalin di tiga
 * berkas lalu hilang sama sekali di berkas keempat.
 */

export type Sesi = Awaited<ReturnType<typeof wajibPeran>>;

export type Wenang =
  | { ok: true; sesi: Sesi; kurikulumId: string }
  | { ok: false; pesan: string };

/** Menggabungkan alasan sebuah `Kelayakan` menjadi satu kalimat untuk toast. */
export function pesanKelayakan(kelayakan: Kelayakan): string {
  return kelayakan.alasan.join(" ");
}

/**
 * Wewenang atas kurikulum + gerbang G1.
 *
 * Sesinya ikut dikembalikan supaya pencatatan audit tidak perlu memverifikasi
 * cookie untuk kedua kalinya — pola yang sama dengan `pastikanWenang` pada
 * `aksi-profil.ts`. Yang berbeda hanya gerbangnya: profil lulusan boleh
 * disunting saat BERLAKU, lapisan ini tidak (docs/15 §2.1).
 */
export async function pastikanWenangSunting(kurikulumId: string): Promise<Wenang> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id: kurikulumId },
    select: { prodiId: true, status: true },
  });
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }

  const gerbang = bolehSuntingKurikulum(kurikulum.status);
  if (!gerbang.boleh) return { ok: false, pesan: pesanKelayakan(gerbang) };

  return { ok: true, sesi, kurikulumId };
}

/* ------------------------------------------------------------------ */
/* Sensus — bahan putusan G2                                          */
/* ------------------------------------------------------------------ */

export async function sensusMataKuliah(mataKuliahId: string) {
  return inti.sensusMataKuliah(prisma, mataKuliahId);
}

export async function sensusSubCpmk(subCpmkId: string) {
  return inti.sensusSubCpmk(prisma, subCpmkId);
}

export async function sensusCpmk(cpmkId: string) {
  return inti.sensusCpmk(prisma, cpmkId);
}

export async function sensusCpl(cplId: string) {
  return inti.sensusCpl(prisma, cplId);
}

export async function sensusKurikulum(kurikulumId: string) {
  return inti.sensusKurikulum(prisma, kurikulumId);
}

export async function setelMatriksCplMk(mataKuliahId: string, idSah: string[]) {
  return inti.setelMatriksCplMk(prisma, mataKuliahId, idSah);
}

/* ------------------------------------------------------------------ */
/* Efek samping bersama                                               */
/* ------------------------------------------------------------------ */

export async function catatSunting(
  sesi: Sesi,
  kurikulumId: string,
  ringkasan: string,
): Promise<void> {
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "KURIKULUM_DISUNTING",
      entitas: "kurikulum",
      entitasId: kurikulumId,
      ringkasan: `${sesi.email} ${ringkasan}`,
    },
  });
}

/**
 * Menyegarkan halaman kurikulum, dan halaman mata kuliah bila disebut.
 *
 * Selalu lewat `segarkan`, tidak pernah `revalidatePath`: setelah alamat
 * berawalan bahasa, `revalidatePath("/kurikulum")` tidak cocok dengan halaman
 * mana pun dan gagal tanpa satu pesan pun.
 */
export function segarkanKurikulum(kurikulumId: string, mataKuliahId?: string): void {
  segarkan("/kurikulum", `/kurikulum/${kurikulumId}`);
  if (mataKuliahId) segarkan(`/kurikulum/${kurikulumId}/mk/${mataKuliahId}`);
}

/** Urutan berikutnya pada sebuah daftar bersaudara. */
export function urutanBerikutnya(terakhir: { urutan: number } | null): number {
  // Menyusul yang TERAKHIR, bukan dihitung dari jumlah baris: menghapus satu
  // baris di tengah membuat jumlah dan urutan tertinggi tidak lagi sama.
  return (terakhir?.urutan ?? -1) + 1;
}
