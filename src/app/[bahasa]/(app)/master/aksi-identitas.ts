"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { segarkan } from "@/lib/bahasa/segarkan";
import { wajibAktif, wajibPeran, bolehSuntingIdentitasProdi } from "@/lib/otorisasi";
import { kamusAksi } from "@/lib/bahasa/server";
import { pesanZod } from "@/lib/bahasa/zod";
import { isi as sisip } from "@/lib/bahasa/teks";
import {
  BATAS_LOGO,
  BATAS_TEKS,
  periksaLogo,
  rapikanMisi,
  rapikanSitus,
  rapikanSurel,
  rapikanTelepon,
  type SebabTolakLogo,
} from "@/domain/kurikulum/identitas-prodi";
import type { HasilAksi } from "./aksi";

/**
 * Identitas program studi — logo, visi & misi, kontak. Acuan: docs/21.
 *
 * Terpisah dari `aksi.ts` karena gerbangnya berbeda: menambah prodi tetap
 * milik ADMIN, sedangkan identitasnya boleh disunting Kaprodi prodi itu
 * sendiri. Menumpangkannya pada berkas yang seluruh aksinya dibuka
 * `wajibPeran("ADMIN")` adalah cara termudah untuk suatu hari lupa bahwa
 * gerbangnya tidak sama.
 *
 * Keputusan siapa boleh apa TIDAK ditulis di sini: ia ada di
 * `bolehSuntingIdentitasProdi` (`src/domain/otorisasi.ts`), satu tempat, dapat
 * diuji tanpa cookie.
 */

const SkemaIdentitas = z.object({
  visi: z.string().trim().max(BATAS_TEKS.visi, "@aksi.periksa.visiPanjang"),
  visiEn: z.string().trim().max(BATAS_TEKS.visi, "@aksi.periksa.visiPanjang"),
  alamat: z.string().trim().max(BATAS_TEKS.alamat, "@aksi.periksa.alamatPanjang"),
  telepon: z.string().trim().max(BATAS_TEKS.telepon, "@aksi.periksa.teleponPanjang"),
  surel: z.string().trim().max(BATAS_TEKS.surel, "@aksi.periksa.surelPanjang"),
  situs: z.string().trim().max(BATAS_TEKS.situs, "@aksi.periksa.situsPanjang"),
});

/** Kosong berarti "dikosongkan", bukan "tidak diubah": borangnya utuh. */
function atauNull(teks: string): string | null {
  return teks.length > 0 ? teks : null;
}

/**
 * Gerbang bersama. Mengembalikan prodi yang sudah ditemukan, sehingga
 * pemanggil tidak membacanya untuk kedua kalinya ke basis data yang jauh.
 */
async function pastikanWenang(prodiId: string) {
  const kam = await kamusAksi();
  const sesi = await wajibAktif();
  const prodi = await prisma.prodi.findUnique({
    where: { id: prodiId },
    select: { id: true, kode: true },
  });
  if (!prodi) return { ok: false as const, pesan: kam.aksi.takAda.prodi, kam };
  if (!bolehSuntingIdentitasProdi(sesi, prodi.id)) {
    return { ok: false as const, pesan: kam.aksi.wenang.atasProdi, kam };
  }
  return { ok: true as const, sesi, prodi, kam };
}

export async function simpanIdentitasProdi(
  prodiId: string,
  data: FormData,
): Promise<HasilAksi> {
  const gerbang = await pastikanWenang(prodiId);
  if (!gerbang.ok) return { ok: false, pesan: gerbang.pesan };
  const { sesi, prodi, kam } = gerbang;

  const parsed = SkemaIdentitas.safeParse({
    visi: data.get("visi") ?? "",
    visiEn: data.get("visiEn") ?? "",
    alamat: data.get("alamat") ?? "",
    telepon: data.get("telepon") ?? "",
    surel: data.get("surel") ?? "",
    situs: data.get("situs") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  /*
   * Kontak dirapikan domain, dan yang tidak lolos DITOLAK — bukan disimpan
   * apa adanya. Nilai `situs` berakhir sebagai `href` di katalog publik, dan
   * sebuah `javascript:` yang lolos ke sana adalah celah yang dipasang tangan
   * sendiri.
   */
  const telepon = parsed.data.telepon ? rapikanTelepon(parsed.data.telepon) : null;
  if (parsed.data.telepon && !telepon) {
    return { ok: false, pesan: kam.aksi.identitas.teleponTidakSah };
  }
  const surel = parsed.data.surel ? rapikanSurel(parsed.data.surel) : null;
  if (parsed.data.surel && !surel) {
    return { ok: false, pesan: kam.aksi.identitas.surelTidakSah };
  }
  const situs = parsed.data.situs ? rapikanSitus(parsed.data.situs) : null;
  if (parsed.data.situs && !situs) {
    return { ok: false, pesan: kam.aksi.identitas.situsTidakSah };
  }

  /*
   * Larik misi ditulis UTUH di atas larik yang sekarang. `SET misi[i] = …`
   * meninggalkan NULL yang tidak dapat dibaca `String[]` Prisma (docs/11 §8.6),
   * dan nomor cetak sebuah butir adalah posisinya — butir kosong yang
   * tertinggal di tengah menjadi "Misi 3" yang tidak berbunyi apa-apa.
   */
  const misi = rapikanMisi(data.getAll("misi").map(String));
  const misiEn = rapikanMisi(data.getAll("misiEn").map(String));

  await prisma.$transaction([
    prisma.prodi.update({
      where: { id: prodi.id },
      data: {
        visi: atauNull(parsed.data.visi),
        visiEn: atauNull(parsed.data.visiEn),
        misi,
        misiEn,
        alamat: atauNull(parsed.data.alamat),
        telepon,
        surel,
        situs,
      },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "PRODI_IDENTITAS_DIUBAH",
        entitas: "prodi",
        entitasId: prodi.id,
        // Jejak audit tetap bahasa Indonesia selamanya (docs/11 §4.2).
        ringkasan: `${sesi.email} mengubah identitas prodi ${prodi.kode}`,
      },
    }),
  ]);

  await segarkanIdentitas(prodi.id, prodi.kode);
  return { ok: true, pesan: kam.aksi.identitas.tersimpan };
}

/* ── Lambang ─────────────────────────────────────────────────────────── */

const KUNCI_TOLAK: Record<SebabTolakLogo, keyof Awaited<ReturnType<typeof kamusAksi>>["aksi"]["identitas"]> =
  {
    kosong: "logoKosong",
    terlaluBesar: "logoTerlaluBesar",
    bukanGambar: "logoBukanGambar",
    terlaluKecil: "logoTerlaluKecil",
    terlaluLebar: "logoTerlaluLebar",
  };

/**
 * Menimbang berkas unggahan.
 *
 * Jenisnya diputuskan dari BITA, bukan dari `berkas.type` — `Content-Type`
 * sebuah unggahan datang dari peramban dan dapat dikarang. Aturannya sendiri
 * murni dan teruji di `domain/kurikulum/identitas-prodi.ts`; yang dikerjakan
 * di sini hanya membaca bitanya dan menerjemahkan sebab penolakannya.
 */
async function timbangUnggahan(
  berkas: FormDataEntryValue | null,
  kam: Awaited<ReturnType<typeof kamusAksi>>,
) {
  if (!(berkas instanceof File) || berkas.size === 0) {
    return { ok: false as const, pesan: kam.aksi.identitas.logoKosong };
  }
  // Dibaca setelah ukurannya disaring supaya berkas 200 MB tidak pernah
  // sampai ke memori hanya untuk ditolak sesudahnya.
  if (berkas.size > BATAS_LOGO.bita) {
    return {
      ok: false as const,
      pesan: sisip(kam.aksi.identitas.logoTerlaluBesar, {
        maks: Math.round(BATAS_LOGO.bita / 1024),
      }),
    };
  }

  const bita = new Uint8Array(await berkas.arrayBuffer());
  const hasil = periksaLogo(bita);
  if (!hasil.ok) {
    const pola = kam.aksi.identitas[KUNCI_TOLAK[hasil.sebab]];
    return {
      ok: false as const,
      pesan: sisip(pola, {
        maks: Math.round(BATAS_LOGO.bita / 1024),
        min: BATAS_LOGO.pxMinimal,
        maksPx: BATAS_LOGO.pxMaksimal,
      }),
    };
  }
  return { ok: true as const, bita, logo: hasil.logo };
}

export async function unggahLogoProdi(
  prodiId: string,
  data: FormData,
): Promise<HasilAksi> {
  const gerbang = await pastikanWenang(prodiId);
  if (!gerbang.ok) return { ok: false, pesan: gerbang.pesan };
  const { sesi, prodi, kam } = gerbang;

  const timbang = await timbangUnggahan(data.get("logo"), kam);
  if (!timbang.ok) return { ok: false, pesan: timbang.pesan };

  await prisma.$transaction([
    prisma.prodi.update({
      where: { id: prodi.id },
      data: {
        logo: Buffer.from(timbang.bita),
        logoTipe: timbang.logo.tipe,
        logoLebar: timbang.logo.lebar,
        logoTinggi: timbang.logo.tinggi,
      },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "PRODI_LOGO_DIUBAH",
        entitas: "prodi",
        entitasId: prodi.id,
        ringkasan: `${sesi.email} mengganti logo prodi ${prodi.kode}`,
      },
    }),
  ]);

  await segarkanIdentitas(prodi.id, prodi.kode);
  return { ok: true, pesan: kam.aksi.identitas.logoTersimpan };
}

export async function hapusLogoProdi(prodiId: string): Promise<HasilAksi> {
  const gerbang = await pastikanWenang(prodiId);
  if (!gerbang.ok) return { ok: false, pesan: gerbang.pesan };
  const { sesi, prodi, kam } = gerbang;

  await prisma.$transaction([
    prisma.prodi.update({
      where: { id: prodi.id },
      data: { logo: null, logoTipe: null, logoLebar: null, logoTinggi: null },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "PRODI_LOGO_DIHAPUS",
        entitas: "prodi",
        entitasId: prodi.id,
        ringkasan: `${sesi.email} menghapus logo prodi ${prodi.kode}`,
      },
    }),
  ]);

  await segarkanIdentitas(prodi.id, prodi.kode);
  return { ok: true, pesan: kam.aksi.identitas.logoDihapus };
}

/**
 * Lambang institusi. ADMIN saja: ia bukan milik satu prodi, dan seluruh berkas
 * cetak seluruh prodi memakainya.
 */
export async function unggahLogoInstitusi(data: FormData): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const institusi = await prisma.institusi.findFirst({ select: { id: true } });
  if (!institusi) return { ok: false, pesan: kam.aksi.takAda.institusi };

  const timbang = await timbangUnggahan(data.get("logo"), kam);
  if (!timbang.ok) return { ok: false, pesan: timbang.pesan };

  await prisma.$transaction([
    prisma.institusi.update({
      where: { id: institusi.id },
      data: {
        logo: Buffer.from(timbang.bita),
        logoTipe: timbang.logo.tipe,
        logoLebar: timbang.logo.lebar,
        logoTinggi: timbang.logo.tinggi,
      },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "INSTITUSI_LOGO_DIUBAH",
        entitas: "institusi",
        entitasId: institusi.id,
        ringkasan: `${sesi.email} mengganti logo institusi`,
      },
    }),
  ]);

  segarkan("/master/prodi");
  return { ok: true, pesan: kam.aksi.identitas.logoTersimpan };
}

export async function hapusLogoInstitusi(): Promise<HasilAksi> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN");

  const institusi = await prisma.institusi.findFirst({ select: { id: true } });
  if (!institusi) return { ok: false, pesan: kam.aksi.takAda.institusi };

  await prisma.$transaction([
    prisma.institusi.update({
      where: { id: institusi.id },
      data: { logo: null, logoTipe: null, logoLebar: null, logoTinggi: null },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "INSTITUSI_LOGO_DIHAPUS",
        entitas: "institusi",
        entitasId: institusi.id,
        ringkasan: `${sesi.email} menghapus logo institusi`,
      },
    }),
  ]);

  segarkan("/master/prodi");
  return { ok: true, pesan: kam.aksi.identitas.logoDihapus };
}

/**
 * Halaman yang ikut basi saat identitas berubah. Katalog publik ikut karena
 * kop dan bagian Visi & Misi dibaca dari sana — dan `segarkan`, bukan
 * `revalidatePath`, karena setiap alamat berawalan bahasa.
 */
async function segarkanIdentitas(prodiId: string, kode: string) {
  segarkan("/master/prodi");
  segarkan(`/master/prodi/${prodiId}`);
  segarkan("/katalog");
  segarkan(`/katalog/${kode.toLowerCase()}`);
}
