"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { wajibPeran, cakupanProdi } from "@/lib/otorisasi";
import { bacaBerkasKurikulum } from "@/lib/kurikulum/excel";
import { rakitKurikulum, type GalatBaris } from "@/domain/kurikulum/berkas";
import { validasiKurikulum, type HasilValidasiKurikulum } from "@/domain/kurikulum/validator";
import type { KurikulumInput } from "@/domain/kurikulum/tipe";
import type { LevelBloom, SumberIsi } from "@/generated/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import type { Kamus } from "@/kamus";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";
import {
  PESAN_KLIEN_BASI,
  intiPesanPrisma,
  klienBasi,
  kodePrisma,
} from "@/lib/galat-prisma";
import { catatSunting, sensusKurikulum } from "@/lib/kurikulum/sunting";
import { muatKurikulumInput } from "@/lib/kurikulum/usulan";

const UKURAN_MAKS = 5 * 1024 * 1024; // 5 MB

/// Jejak asal isi. Rumusan yang diterima dari usulan AI ditandai supaya
/// pertanyaan asesor "bagian mana yang dihasilkan AI" punya jawaban.
function sumber(sumberAi: boolean | undefined): SumberIsi {
  return sumberAi ? "AI" : "KURIKULUM";
}

/// Menghitung berapa rumusan dalam kurikulum yang berasal dari usulan AI.
function hitungDariAi(kurikulum: KurikulumInput): number {
  return kurikulum.mataKuliah.reduce(
    (total, mk) =>
      total +
      mk.cpmk.reduce(
        (n, c) => n + (c.sumberAi ? 1 : 0) + c.subCpmk.filter((s) => s.sumberAi).length,
        0,
      ),
    0,
  );
}

export interface HasilPraTinjau {
  ok: boolean;
  pesan?: string;
  kurikulum?: KurikulumInput;
  galat?: GalatBaris[];
  validasi?: HasilValidasiKurikulum;
}

/** Membaca berkas dan memvalidasinya TANPA menyimpan apa pun. */
export async function praTinjauImpor(data: FormData): Promise<HasilPraTinjau> {
  const kam = await kamusAksi();
  await wajibPeran("ADMIN", "KAPRODI");

  const berkas = data.get("berkas");
  const nama = String(data.get("nama") ?? "").trim();
  const tahun = Number(data.get("tahun"));

  if (!(berkas instanceof File) || berkas.size === 0) {
    return { ok: false, pesan: kam.aksi.berkas.pilihExcel };
  }
  if (berkas.size > UKURAN_MAKS) {
    return { ok: false, pesan: kam.aksi.berkas.ukuranMelebihi5mb };
  }
  if (!berkas.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, pesan: kam.aksi.berkas.harusXlsx };
  }
  if (nama.length < 3) return { ok: false, pesan: kam.aksi.kurikulum.namaMin };
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    return { ok: false, pesan: kam.aksi.kurikulum.tahunTidakMasukAkal };
  }

  let isi;
  try {
    isi = await bacaBerkasKurikulum(await berkas.arrayBuffer());
  } catch {
    return {
      ok: false,
      pesan: kam.aksi.berkas.takTerbaca,
    };
  }

  if (isi.cpl.length === 0 && isi.mk.length === 0) {
    return {
      ok: false,
      pesan: kam.aksi.lain.imporLembarKosong,
    };
  }

  const { kurikulum, galat } = rakitKurikulum(isi, { nama, tahun });
  return { ok: true, kurikulum, galat, validasi: validasiKurikulum(kurikulum) };
}

const SkemaSimpan = z.object({
  prodiId: z.string().min(1),
  nama: z.string().trim().min(3),
  tahun: z.number().int().min(2000).max(2100),
});

export interface HasilSimpan {
  ok: boolean;
  pesan: string;
  kurikulumId?: string;
}

/**
 * Menyimpan kurikulum hasil impor sebagai versi DRAF baru.
 *
 * Divalidasi ULANG di sini, bukan sekadar percaya pada hasil pratinjau —
 * data yang dikirim klien tidak boleh dipercaya begitu saja.
 */
export async function simpanImpor(
  prodiId: string,
  meta: { nama: string; tahun: number },
  kurikulum: KurikulumInput,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const parsed = SkemaSimpan.safeParse({ prodiId, ...meta });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }

  const validasi = validasiKurikulum(kurikulum);
  if (!validasi.lolos) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.berkas.pemblokirUnggahUlang, { jumlah: validasi.pemblokir.length }),
    };
  }

  const bentrok = await prisma.kurikulum.findFirst({
    where: { prodiId, tahun: meta.tahun },
    select: { id: true },
  });
  if (bentrok) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.kurikulum.tahunSudahAda, { tahun: meta.tahun }),
    };
  }

  const dariAi = hitungDariAi(kurikulum);

  try {
    const kurikulumId = await prisma.$transaction(async (tx) => {
      const baru = await tx.kurikulum.create({
        data: {
          prodiId,
          nama: meta.nama,
          tahun: meta.tahun,
          status: "DRAF",
          catatan: `Diimpor oleh ${sesi.email}`,
        },
        select: { id: true },
      });

      // Semua baris ditulis per LAPISAN dengan createMany, bukan satu per satu.
      // Kurikulum sungguhan berisi ratusan CPMK dan Sub-CPMK; menulisnya satu
      // per satu berarti ratusan bolak-balik ke basis data di dalam satu
      // transaksi, dan itu melewati batas waktu transaksi sebelum selesai.
      // createMany tidak mengembalikan id, jadi tiap lapisan dibaca ulang
      // sekali untuk memetakan kode ke id.

      // Profil lulusan ditulis lebih dulu karena CPL menunjuk balik ke sini.
      const profilLulusan = kurikulum.profilLulusan ?? [];
      await tx.profilLulusan.createMany({
        data: profilLulusan.map((p, i) => ({
          kurikulumId: baru.id,
          kode: p.kode,
          deskripsi: p.deskripsi,
          urutan: i,
        })),
      });
      const petaPl = new Map(
        (
          await tx.profilLulusan.findMany({
            where: { kurikulumId: baru.id },
            select: { id: true, kode: true },
          })
        ).map((p) => [p.kode, p.id]),
      );

      await tx.cpl.createMany({
        data: kurikulum.cpl.map((c, i) => ({
          kurikulumId: baru.id,
          kode: c.kode,
          deskripsi: c.deskripsi,
          tingkatKkni: c.tingkatKkni ?? null,
          urutan: i,
        })),
      });
      const petaCpl = new Map(
        (
          await tx.cpl.findMany({
            where: { kurikulumId: baru.id },
            select: { id: true, kode: true },
          })
        ).map((c) => [c.kode, c.id]),
      );

      await tx.cplProfilLulusan.createMany({
        data: kurikulum.cpl.flatMap((c) =>
          (c.profilLulusanKode ?? [])
            .map((k) => petaPl.get(k))
            .filter((id): id is string => Boolean(id))
            .map((profilLulusanId) => ({ cplId: petaCpl.get(c.kode)!, profilLulusanId })),
        ),
      });

      await tx.mataKuliah.createMany({
        data: kurikulum.mataKuliah.map((mk) => ({
          kurikulumId: baru.id,
          kode: mk.kode,
          nama: mk.nama,
          semester: mk.semester,
          sksTeori: mk.sksTeori,
          sksPraktik: mk.sksPraktik,
        })),
      });
      const petaMk = new Map(
        (
          await tx.mataKuliah.findMany({
            where: { kurikulumId: baru.id },
            select: { id: true, kode: true },
          })
        ).map((m) => [m.kode, m.id]),
      );

      await tx.matriksCplMk.createMany({
        data: kurikulum.mataKuliah.flatMap((mk) =>
          mk.cplKode
            .map((k) => petaCpl.get(k))
            .filter((id): id is string => Boolean(id))
            .map((cplId) => ({ cplId, mataKuliahId: petaMk.get(mk.kode)! })),
        ),
      });

      await tx.cpmk.createMany({
        data: kurikulum.mataKuliah.flatMap((mk) =>
          mk.cpmk.map((c, j) => ({
            mataKuliahId: petaMk.get(mk.kode)!,
            kode: c.kode,
            rumusan: c.rumusan,
            levelBloom: (c.levelBloom as LevelBloom | null) ?? null,
            urutan: j,
            sumber: sumber(c.sumberAi),
          })),
        ),
      });
      // Kode CPMK hanya unik DI DALAM satu mata kuliah, jadi kuncinya gabungan.
      const petaCpmk = new Map(
        (
          await tx.cpmk.findMany({
            where: { mataKuliah: { kurikulumId: baru.id } },
            select: { id: true, kode: true, mataKuliahId: true },
          })
        ).map((c) => [`${c.mataKuliahId}\u0000${c.kode}`, c.id]),
      );
      const idCpmk = (mkKode: string, cpmkKode: string) =>
        petaCpmk.get(`${petaMk.get(mkKode)}\u0000${cpmkKode}`)!;

      await tx.petaCpmkCpl.createMany({
        data: kurikulum.mataKuliah.flatMap((mk) =>
          mk.cpmk.flatMap((c) =>
            c.cplKode
              .map((k) => petaCpl.get(k))
              .filter((id): id is string => Boolean(id))
              .map((cplId) => ({ cpmkId: idCpmk(mk.kode, c.kode), cplId })),
          ),
        ),
      });

      await tx.subCpmk.createMany({
        data: kurikulum.mataKuliah.flatMap((mk) =>
          mk.cpmk.flatMap((c) =>
            c.subCpmk.map((s, k) => ({
              cpmkId: idCpmk(mk.kode, c.kode),
              kode: s.kode,
              rumusan: s.rumusan,
              levelBloom: (s.levelBloom as LevelBloom | null) ?? null,
              urutan: k,
              sumber: sumber(s.sumberAi),
              mingguDisarankan: [],
            })),
          ),
        ),
      });

      await tx.logAudit.create({
        data: {
          penggunaId: sesi.id,
          aksi: "KURIKULUM_DIIMPOR",
          entitas: "kurikulum",
          entitasId: baru.id,
          ringkasan:
            `${sesi.email} mengimpor "${meta.nama}" — ` +
            `${validasi.ringkasan.jumlahCpl} CPL, ${validasi.ringkasan.jumlahMk} MK, ` +
            `${validasi.ringkasan.jumlahCpmk} CPMK, ${validasi.ringkasan.jumlahSubCpmk} Sub-CPMK` +
            (dariAi > 0 ? `; ${dariAi} rumusan dari usulan AI` : ""),
        },
      });

      return baru.id;
    }, {
      // Bawaan Prisma 5 detik. Impor satu kurikulum penuh menulis ribuan baris;
      // sudah dibatch, tetapi jaringan ke basis data terkelola tetap bisa
      // lambat. Lebih baik menunggu daripada meninggalkan impor separuh jalan.
      timeout: 60_000,
      maxWait: 15_000,
    });

    segarkan("/kurikulum");
    return { ok: true, pesan: kam.aksi.kurikulum.tersimpanDraf, kurikulumId };
  } catch (galat) {
    console.error("[kurikulum] gagal menyimpan impor:", galat);
    return { ok: false, pesan: pesanGagalSimpan(galat, kam) };
  }
}

/**
 * Menerjemahkan galat Prisma menjadi kalimat yang bisa ditindaklanjuti.
 *
 * "Periksa log server" saja memaksa siapa pun membuka terminal untuk tahu
 * apakah masalahnya skema, waktu habis, atau data bentrok — padahal kode
 * galatnya sudah cukup untuk menjawab itu di layar.
 */
function pesanGagalSimpan(galat: unknown, kam: Kamus): string {
  if (klienBasi(galat)) return PESAN_KLIEN_BASI;
  const kode = kodePrisma(galat);

  switch (kode) {
    case "P2022": // kolom tidak ada di basis data
    case "P2021": // tabel tidak ada di basis data
      return (
        kam.aksi.galatSimpan.strukturBasi
      );
    case "P2002":
      return kam.aksi.galatSimpan.bentrokKurikulum;
    case "P2028": // transaksi kedaluwarsa
      return (
        kam.aksi.galatSimpan.transaksiKurikulum
      );
    default: {
      const nama = galat instanceof Error ? galat.constructor.name : kam.aksi.galatSimpan.galat;
      const inti = galat instanceof Error ? intiPesanPrisma(galat.message) : "";
      return `${kam.aksi.galatSimpan.gagalKurikulum} — ${nama}${kode ? ` (${kode})` : ""}${inti ? `: ${inti}` : "."}`;
    }
  }
}

export async function hapusKurikulum(id: string): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id },
    select: { id: true, nama: true, status: true, prodiId: true },
  });
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  if (kurikulum.status === "BERLAKU") {
    return {
      ok: false,
      pesan: kam.aksi.kurikulum.berlakuTakDihapus,
    };
  }

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }

  /*
   * Status BERLAKU saja tidak cukup menjaga ini. Kurikulum ARSIP lolos
   * pemeriksaan di atas, padahal `Kurikulum → MataKuliah → Rpkps →
   * RpkpsSnapshot` seluruhnya onDelete: Cascade — satu klik melenyapkan setiap
   * RPKPS terbit beserta salinan bekunya, kelas, peserta, dan nilai di
   * bawahnya, tanpa satu pesan pun (docs/15, lampiran).
   */
  const menggantung = await sensusKurikulum(id);
  if (menggantung.length > 0) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.kurikulum.adaRpkpsMenggantung, {
        jumlah: menggantung.length,
        daftar: menggantung.map((r) => r.label).join("; "),
      }),
    };
  }

  await prisma.kurikulum.delete({ where: { id } });
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "KURIKULUM_DIHAPUS",
      entitas: "kurikulum",
      entitasId: id,
      ringkasan: `${sesi.email} menghapus kurikulum "${kurikulum.nama}"`,
    },
  });

  segarkan("/kurikulum");
  return { ok: true, pesan: kam.aksi.kurikulum.dihapus };
}

export async function ubahStatusKurikulum(
  id: string,
  status: "DRAF" | "BERLAKU" | "ARSIP",
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id },
    select: { id: true, prodiId: true, nama: true },
  });
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }

  /*
   * Ambang mutu yang sama dengan jalur impor (docs/15 §2.6).
   *
   * `simpanImpor` menolak berkas yang masih memuat temuan PEMBLOKIR, tetapi
   * kurikulum yang disusun tangan tidak pernah melewati pemeriksaan itu. Tanpa
   * penjaga di sini, dua jalur masuk yang sama berujung pada dua ambang yang
   * berbeda — dan yang lolos diam-diam adalah kurikulum tulisan tangan, yang
   * justru paling mungkin belum lengkap.
   *
   * Hanya saat DIBERLAKUKAN. Draf memang boleh belum lengkap; itulah gunanya
   * draf.
   */
  if (status === "BERLAKU") {
    const masukan = await muatKurikulumInput(id);
    const validasi = masukan ? validasiKurikulum(masukan) : null;
    if (validasi && !validasi.lolos) {
      return {
        ok: false,
        pesan: sisip(kam.kurikulum.sunting.belumBolehBerlaku, {
          jumlah: validasi.pemblokir.length,
        }),
      };
    }
  }

  // Satu prodi hanya boleh punya satu kurikulum BERLAKU.
  await prisma.$transaction([
    ...(status === "BERLAKU"
      ? [
          prisma.kurikulum.updateMany({
            where: { prodiId: kurikulum.prodiId, status: "BERLAKU", id: { not: id } },
            data: { status: "ARSIP" },
          }),
        ]
      : []),
    prisma.kurikulum.update({
      where: { id },
      data: { status, berlakuDari: status === "BERLAKU" ? new Date() : undefined },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "KURIKULUM_STATUS_DIUBAH",
        entitas: "kurikulum",
        entitasId: id,
        ringkasan: `${sesi.email} mengubah status "${kurikulum.nama}" menjadi ${status}`,
      },
    }),
  ]);

  segarkan("/kurikulum");
  segarkan(`/kurikulum/${id}`);
  return { ok: true, pesan: sisip(kam.aksi.rpkps.statusDiubah, { status: status.toLowerCase() }) };
}

/**
 * Membuat kurikulum DRAF kosong, tanpa berkas Excel. Acuan: docs/15 §2.5.
 *
 * Selama ini satu-satunya jalur masuk lapisan kurikulum adalah impor Excel,
 * sehingga prodi yang menyusun kurikulum dari nol harus mengarang berkas
 * lebih dulu. Keduanya bermuara ke bentuk data yang sama; yang ini mengisinya
 * lapis demi lapis lewat penyunting di halaman kurikulum.
 */
export async function buatKurikulumKosong(
  prodiId: string,
  nama: string,
  tahun: number,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const parsed = SkemaSimpan.safeParse({ prodiId, nama, tahun });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? kam.aksi.umum.dataTidakValid };
  }

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }

  // @@unique([prodiId, tahun]) — diperiksa lebih dulu agar pesannya menyebut
  // tahunnya, bukan melempar P2002 mentah.
  const bentrok = await prisma.kurikulum.findFirst({
    where: { prodiId, tahun: parsed.data.tahun },
    select: { id: true },
  });
  if (bentrok) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.kurikulum.tahunSudahAda, { tahun: parsed.data.tahun }),
    };
  }

  const baru = await prisma.kurikulum.create({
    data: {
      prodiId,
      nama: parsed.data.nama,
      tahun: parsed.data.tahun,
      status: "DRAF",
      catatan: `Disusun manual oleh ${sesi.email}`,
    },
    select: { id: true },
  });

  await catatSunting(sesi, baru.id, `menyusun kurikulum kosong "${parsed.data.nama}"`);
  segarkan("/kurikulum");
  return { ok: true, pesan: kam.aksi.kurikulum.kosongDibuat, kurikulumId: baru.id };
}

/**
 * Menyunting identitas kurikulum: nama, tahun, catatan.
 *
 * Tidak memakai `pastikanWenangSunting`: yang disunting adalah amplopnya,
 * bukan isinya, dan tak satu pun ruas ini ikut `proyeksiIsi()`. Yang tetap
 * dijaga adalah `tahun` — ia bagian kunci unik per prodi.
 */
export async function perbaruiMetaKurikulum(
  id: string,
  nama: string,
  tahun: number,
  catatan: string | null,
): Promise<HasilSimpan> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI");

  const kurikulum = await prisma.kurikulum.findUnique({
    where: { id },
    select: { prodiId: true, status: true },
  });
  if (!kurikulum) return { ok: false, pesan: kam.aksi.takAda.kurikulum };

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(kurikulum.prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }
  if (kurikulum.status === "ARSIP") {
    return { ok: false, pesan: kam.aksi.kurikulum.arsipTakDisunting };
  }

  const parsed = SkemaSimpan.safeParse({ prodiId: kurikulum.prodiId, nama, tahun });
  if (!parsed.success) {
    return { ok: false, pesan: parsed.error.issues[0]?.message ?? kam.aksi.umum.dataTidakValid };
  }

  const bentrok = await prisma.kurikulum.findFirst({
    where: { prodiId: kurikulum.prodiId, tahun: parsed.data.tahun, id: { not: id } },
    select: { id: true },
  });
  if (bentrok) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.kurikulum.tahunSudahAda, { tahun: parsed.data.tahun }),
    };
  }

  await prisma.kurikulum.update({
    where: { id },
    data: {
      nama: parsed.data.nama,
      tahun: parsed.data.tahun,
      catatan: catatan?.trim() || null,
    },
  });

  await catatSunting(sesi, id, `menyunting identitas kurikulum "${parsed.data.nama}"`);
  segarkan("/kurikulum", `/kurikulum/${id}`);
  return { ok: true, pesan: kam.aksi.umum.tersimpan };
}
