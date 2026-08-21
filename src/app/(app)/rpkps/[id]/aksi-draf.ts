"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { GalatAi } from "@/lib/ai/galat";
import { susunDraf } from "@/lib/ai/draf-rpkps";
import {
  periksaDraf,
  type DrafRpkps,
  type KonteksDraf,
  type TemuanDraf,
} from "@/domain/rpkps/draf";
import type { BentukSoal, JenisTugas, LevelBloom, Prisma } from "@/generated/prisma";
import {
  PESAN_KLIEN_BASI,
  intiPesanPrisma,
  klienBasi,
  kodePrisma,
} from "@/lib/galat-prisma";

export interface HasilDraf {
  ok: boolean;
  pesan?: string;
  draf?: DrafRpkps;
  temuan?: TemuanDraf[];
  penyedia?: string;
  model?: string;
  /** Durasi nyata, dilaporkan setelah selesai — bukan perkiraan di muka. */
  msModel?: number;
}

async function pastikanWenang(rpkpsId: string) {
  const sesi = await wajibAktif();
  const rpkps = await prisma.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      id: true,
      status: true,
      mataKuliah: { select: { kurikulum: { select: { prodiId: true } } } },
      pengampu: { select: { penggunaId: true } },
    },
  });
  if (!rpkps) return { sesi, boleh: false, dapatDisunting: false };

  const cakupan = cakupanProdi(sesi);
  const dalamCakupan =
    cakupan === null || cakupan.includes(rpkps.mataKuliah.kurikulum.prodiId);
  const pengampu = rpkps.pengampu.some((p) => p.penggunaId === sesi.id);
  const boleh =
    dalamCakupan && (pengampu || punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM"));

  return {
    sesi,
    boleh,
    dapatDisunting: rpkps.status === "DRAF" || rpkps.status === "DIREVISI",
  };
}

/**
 * Bidang yang dimuat sebagai batas bagi draf.
 *
 * Ditulis sebagai konstanta ber-`satisfies`, bukan literal di dalam pemanggilan,
 * supaya bentuk hasilnya dapat dinamai lewat RpkpsGetPayload. Ditulis inline,
 * inferensi Prisma menyerah pada select sedalam ini dan mengembalikan tipe
 * model penuh — yang membuat setiap relasi tampak tidak ada.
 */
const PILIH_KONTEKS = {
  deskripsi: true,
  mataKuliah: {
    select: {
      kode: true, nama: true, deskripsi: true, semester: true,
      sksTeori: true, sksPraktik: true,
      cpl: { select: { cpl: { select: { kode: true, deskripsi: true } } } },
      cpmk: {
        orderBy: { urutan: "asc" },
        select: {
          kode: true, rumusan: true, levelBloom: true,
          subCpmk: {
            orderBy: { urutan: "asc" },
            select: { id: true, kode: true, rumusan: true, levelBloom: true },
          },
        },
      },
    },
  },
  pustaka: {
    orderBy: [{ jenis: "asc" }, { nomor: "asc" }],
    select: { nomor: true, jenis: true, teks: true },
  },
  komponenNilai: {
    orderBy: { urutan: "asc" },
    select: { id: true, nama: true, bobot: true },
  },
  pertemuan: {
    orderBy: { minggu: "asc" },
    select: {
      id: true, minggu: true, jenis: true,
      aktivitas: { select: { kategori: true, menit: true } },
      subCpmk: { select: { subCpmk: { select: { id: true, kode: true } } } },
    },
  },
} satisfies Prisma.RpkpsSelect;

type Konteks = Prisma.RpkpsGetPayload<{ select: typeof PILIH_KONTEKS }>;

function muatKonteks(rpkpsId: string): Promise<Konteks | null> {
  return prisma.rpkps.findUnique({ where: { id: rpkpsId }, select: PILIH_KONTEKS });
}

/**
 * Nomor pertama yang bebas untuk tiap jenis pustaka.
 *
 * Dihitung server, bukan oleh model: Pustaka unik per (jenis, nomor), jadi
 * menyerahkan penomoran ke model berarti mengundang bentrok dengan pustaka
 * yang sudah dosen masukkan.
 */
function nomorBerikutnya(
  pustaka: { jenis: string; nomor: number }[],
): Record<string, number> {
  const hasil: Record<string, number> = {};
  for (const jenis of ["UTAMA", "PENDUKUNG", "DARING", "TOOLS"]) {
    const dipakai = pustaka.filter((p) => p.jenis === jenis).map((p) => p.nomor);
    hasil[jenis] = dipakai.length === 0 ? 1 : Math.max(...dipakai) + 1;
  }
  return hasil;
}

/** Rujukan pustaka yang tidak dapat tertukar: Pustaka unik per (jenis, nomor). */
function refPustaka(p: { jenis: string; nomor: number }): string {
  return `${p.jenis}-${p.nomor}`;
}

function konteksDomain(k: Konteks): KonteksDraf {
  return {
    mingguEfektif: k.pertemuan.filter((p) => p.jenis === "EFEKTIF").map((p) => p.minggu),
    semuaMinggu: k.pertemuan.map((p) => p.minggu),
    subCpmkTersedia: k.mataKuliah.cpmk.flatMap((c) => c.subCpmk.map((s) => s.kode)),
    refPustaka: k.pustaka.map(refPustaka),
  };
}

export interface HasilKesiapan {
  ok: boolean;
  pesan?: string;
  /** Angka yang menentukan seberapa besar pekerjaan model nanti. */
  ringkas?: {
    mingguEfektif: number;
    subCpmk: number;
    pustaka: number;
    komponenNilai: number;
  };
}

/**
 * Memeriksa apakah RPKPS siap disusun AI, sebelum model dipanggil.
 *
 * Dipisah dari susunDrafRpkps() supaya antarmuka punya tahap yang BENAR-BENAR
 * terjadi untuk ditampilkan, bukan tahap yang ditebak dari waktu berjalan.
 * Langkah ini murah — satu kueri — dan sekaligus menolak lebih awal bila
 * prasyaratnya belum ada, tanpa membakar token.
 */
export async function periksaKesiapanDraf(rpkpsId: string): Promise<HasilKesiapan> {
  const { boleh, dapatDisunting } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang atas RPKPS ini." };
  if (!dapatDisunting) return { ok: false, pesan: "RPKPS sudah diajukan atau terbit." };

  const k = await muatKonteks(rpkpsId);
  if (!k) return { ok: false, pesan: "RPKPS tidak ditemukan." };

  const d = konteksDomain(k);
  if (d.mingguEfektif.length === 0) {
    return { ok: false, pesan: "Belum ada pertemuan efektif pada RPKPS ini." };
  }
  if (d.subCpmkTersedia.length === 0) {
    return { ok: false, pesan: "Mata kuliah ini belum punya Sub-CPMK di kurikulum." };
  }

  return {
    ok: true,
    ringkas: {
      mingguEfektif: d.mingguEfektif.length,
      subCpmk: d.subCpmkTersedia.length,
      pustaka: d.refPustaka.length,
      komponenNilai: k.komponenNilai.length,
    },
  };
}

/**
 * Menyusun draf isi RPKPS dengan AI. TIDAK menyimpan apa pun.
 *
 * Persetujuan dosen berupa satu tombol untuk seluruh dokumen, jadi draf yang
 * melanggar invarian dikembalikan beserta temuannya dan tidak dapat diterapkan.
 */
export async function susunDrafRpkps(rpkpsId: string): Promise<HasilDraf> {
  const { boleh, dapatDisunting, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang atas RPKPS ini." };
  if (!dapatDisunting) return { ok: false, pesan: "RPKPS sudah diajukan atau terbit." };

  const k = await muatKonteks(rpkpsId);
  if (!k) return { ok: false, pesan: "RPKPS tidak ditemukan." };

  const mulai = Date.now();
  try {
    const { draf, penyedia, model } = await susunDraf({
      penggunaId: sesi.id,
      rpkpsId,
      konteks: {
        mataKuliah: {
          kode: k.mataKuliah.kode,
          nama: k.mataKuliah.nama,
          semester: k.mataKuliah.semester,
          sks: k.mataKuliah.sksTeori + k.mataKuliah.sksPraktik,
          sksTeori: k.mataKuliah.sksTeori,
          sksPraktik: k.mataKuliah.sksPraktik,
          deskripsi: k.deskripsi ?? k.mataKuliah.deskripsi,
        },
        cpl: k.mataKuliah.cpl.map((c) => c.cpl),
        cpmk: k.mataKuliah.cpmk,
        pustakaSudahAda: k.pustaka.map((p) => ({ ref: refPustaka(p), jenis: p.jenis, teks: p.teks })),
        nomorBerikutnya: nomorBerikutnya(k.pustaka),
        komponenNilaiSaatIni: k.komponenNilai.map((n) => ({
          nama: n.nama,
          bobot: Number(n.bobot),
        })),
        minggu: k.pertemuan.map((p) => ({
          minggu: p.minggu,
          jenis: p.jenis,
          paguMenit: Object.fromEntries(p.aktivitas.map((a) => [a.kategori, a.menit])),
          subCpmkTerjadwal: p.subCpmk.map((s) => s.subCpmk.kode),
        })),
      },
    });

    const msModel = Date.now() - mulai;
    const temuan = periksaDraf(konteksDomain(k), draf);
    return { ok: temuan.length === 0, draf, temuan, penyedia, model, msModel };
  } catch (galat) {
    if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
    console.error("[rpkps] gagal menyusun draf:", galat);
    return { ok: false, pesan: "Gagal menyusun draf. Periksa log server." };
  }
}

export type HasilTerap = { ok: boolean; pesan: string };

/**
 * Menerapkan draf ke dokumen setelah dosen menyetujuinya.
 *
 * Draf dari klien TIDAK dipercaya: diperiksa ulang di sini terhadap keadaan
 * RPKPS yang sebenarnya, karena antara pratinjau dan persetujuan bisa saja ada
 * yang berubah — dan karena kiriman klien memang tidak pernah dipercaya.
 */
export async function terapkanDrafRpkps(
  rpkpsId: string,
  draf: DrafRpkps,
): Promise<HasilTerap> {
  const { boleh, dapatDisunting, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: "Anda tidak berwenang atas RPKPS ini." };
  if (!dapatDisunting) return { ok: false, pesan: "RPKPS sudah diajukan atau terbit." };

  const k = await muatKonteks(rpkpsId);
  if (!k) return { ok: false, pesan: "RPKPS tidak ditemukan." };

  const temuan = periksaDraf(konteksDomain(k), draf);
  if (temuan.length > 0) {
    return { ok: false, pesan: `Draf melanggar ${temuan.length} aturan dan tidak diterapkan.` };
  }

  const idPertemuan = new Map<number, string>(
    k.pertemuan.map((p) => [p.minggu, p.id]),
  );
  const idSubCpmk = new Map<string, string>(
    k.mataKuliah.cpmk.flatMap((c) => c.subCpmk.map((s) => [s.kode, s.id])),
  );

  // Id diselesaikan LEBIH DULU, di luar transaksi, dan setiap yang meleset
  // dikumpulkan. Sebelumnya dipakai "!" di titik pakai, sehingga id yang tidak
  // ketemu lolos sebagai undefined dan baru meledak sebagai
  // PrismaClientValidationError — galat tanpa kode, tanpa petunjuk lokasi.
  const hilang: string[] = [];
  function wajib<T>(nilai: T | undefined, apa: string): T | undefined {
    if (nilai === undefined) hilang.push(apa);
    return nilai;
  }

  const tulisPertemuan = draf.pertemuan.map((p) => ({
    p,
    id: wajib(idPertemuan.get(p.minggu), `pertemuan minggu ${p.minggu}`),
    // Rujukan ganda pada satu minggu melanggar kunci gabungan PertemuanPustaka.
    // Id-nya BELUM dapat diselesaikan di sini: sebagian pustaka baru dibuat di
    // dalam transaksi. Kesahihan rujukannya sudah dijamin periksaDraf().
    ref: [...new Set(p.pustakaRef)],
  }));

  const tulisTugas = draf.tugas.map((t) => ({
    t,
    subCpmkId: [...new Set(t.subCpmkKode)]
      .map((k2) => wajib(idSubCpmk.get(k2), `Sub-CPMK ${k2} pada tugas ${t.nomor}`))
      .filter((x): x is string => Boolean(x)),
  }));

  const tulisKisi = draf.kisiKisi.map((kk) => ({
    kk,
    butir: kk.butir.map((b) => ({
      b,
      subCpmkId: wajib(
        idSubCpmk.get(b.subCpmkKode),
        `Sub-CPMK ${b.subCpmkKode} pada butir ${b.nomor} ${kk.jenis}`,
      ),
    })),
  }));

  if (hilang.length > 0) {
    return {
      ok: false,
      pesan:
        `Draf merujuk ${hilang.length} data yang tidak ada pada RPKPS ini: ` +
        `${hilang.slice(0, 5).join(", ")}${hilang.length > 5 ? ", …" : ""}.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // ── Bagian A, pembuka CPMK, komponen nilai, pustaka ─────────────
      await tx.rpkps.update({
        where: { id: rpkpsId },
        data: { deskripsi: draf.deskripsi, kalimatPembukaCpmk: draf.kalimatPembukaCpmk },
      });

      // Komponen nilai DIGANTI: bobotnya harus rekonsiliasi dengan tabel
      // mingguan, dan keduanya berasal dari draf yang sama.
      await tx.komponenNilai.deleteMany({ where: { rpkpsId } });
      await tx.komponenNilai.createMany({
        data: draf.komponenNilai.map((n, i) => ({
          rpkpsId,
          nama: n.nama,
          bobot: n.bobot,
          urutan: i,
          sumber: "AI" as const,
        })),
      });

      // Pustaka lama DIPERTAHANKAN apa adanya — yang baru hanya ditambahkan.
      // Daftar pustaka yang sudah dikurasi dosen tidak boleh hilang karena
      // model lupa menyalinnya kembali.
      if (draf.pustakaBaru.length > 0) {
        await tx.pustaka.createMany({
          data: draf.pustakaBaru.map((b) => ({
            rpkpsId,
            jenis: b.jenis,
            nomor: b.nomor,
            teks: b.teks,
            url: b.url,
            sumber: "AI" as const,
          })),
        });
      }

      // Dibaca SETELAH pustaka baru dibuat, supaya rujukan ke keduanya —
      // yang lama maupun yang baru — dapat diselesaikan.
      const idPustaka = new Map<string, string>(
        (
          await tx.pustaka.findMany({
            where: { rpkpsId },
            select: { id: true, nomor: true, jenis: true },
          })
        ).map((b) => [refPustaka(b), b.id]),
      );

      // ── Pertemuan ────────────────────────────────────────────────────
      for (const { p, id, ref } of tulisPertemuan) {
        if (!id) continue;
        await tx.pertemuan.update({
          where: { id },
          data: {
            topik: p.topik,
            subtopik: p.subtopik,
            metodeNarasi: p.metodeNarasi,
            aktivitasDosen: p.aktivitasDosen,
            aktivitasMahasiswa: p.aktivitasMahasiswa,
            tugasTerstruktur: p.tugasTerstruktur,
            penilaianJenis: p.penilaianJenis,
            penilaianSistem: p.penilaianSistem,
            bobot: p.bobot,
            sumber: "AI",
          },
        });
        // Menit aktivitas TM/PT/BM sengaja tidak disentuh: sudah pas dengan
        // pagu beban belajar sejak kerangka dibuat.
        await tx.indikator.deleteMany({ where: { pertemuanId: id } });
        await tx.indikator.createMany({
          data: p.indikator.map((teks, i) => ({ pertemuanId: id, teks, urutan: i })),
        });
        await tx.pertemuanPustaka.deleteMany({ where: { pertemuanId: id } });
        await tx.pertemuanPustaka.createMany({
          data: ref
            .map((r) => idPustaka.get(r))
            .filter((x): x is string => Boolean(x))
            .map((pustakaId) => ({ pertemuanId: id, pustakaId })),
        });
      }

      // ── Tugas: diganti seluruhnya ────────────────────────────────────
      // Peta komponen dibaca ulang: yang dipetakan di luar transaksi sudah
      // dihapus beberapa langkah di atas.
      const komponenBaru = new Map<string, string>(
        (
          await tx.komponenNilai.findMany({ where: { rpkpsId }, select: { id: true, nama: true } })
        ).map((n) => [n.nama, n.id]),
      );
      await tx.tugas.deleteMany({ where: { rpkpsId } });
      for (const { t, subCpmkId } of tulisTugas) {
        await tx.tugas.create({
          data: {
            rpkpsId,
            nomor: t.nomor,
            nama: t.nama,
            jenis: t.jenis as JenisTugas,
            mingguMulai: t.mingguMulai,
            mingguSelesai: t.mingguSelesai,
            bobot: t.bobot,
            komponenNilaiId: t.komponenNilai ? (komponenBaru.get(t.komponenNilai) ?? null) : null,
            deskripsi: t.deskripsi,
            uraianTugas: t.uraianTugas,
            formatLuaran: t.formatLuaran,
            sumber: "AI",
            subCpmk: { create: subCpmkId.map((id2) => ({ subCpmkId: id2 })) },
            kriteria: {
              create: t.kriteria.map((c) => ({
                nomor: c.nomor,
                indikator: c.indikator,
                rincian: c.rincian,
                bobot: c.bobot,
              })),
            },
          },
        });
      }

      // ── Kisi-kisi: diganti seluruhnya ────────────────────────────────
      await tx.kisiKisi.deleteMany({ where: { rpkpsId } });
      for (const { kk, butir } of tulisKisi) {
        await tx.kisiKisi.create({
          data: {
            rpkpsId,
            jenis: kk.jenis,
            totalSkor: 100,
            durasiMenit: kk.durasiMenit,
            sumber: "AI",
            butir: {
              create: butir.map(({ b, subCpmkId }) => ({
                nomor: b.nomor,
                subCpmkId: subCpmkId as string,
                levelBloom: b.levelBloom as LevelBloom,
                bentuk: b.bentuk as BentukSoal,
                jumlahButir: b.jumlahButir,
                skor: b.skor,
                indikator: b.indikator,
              })),
            },
          },
        });
      }

      const ringkas =
        `${draf.pertemuan.length} pertemuan, ${draf.tugas.length} tugas, ` +
        `${draf.kisiKisi.reduce((s, x) => s + x.butir.length, 0)} butir kisi-kisi, ` +
        `${draf.komponenNilai.length} komponen nilai, ` +
        `${draf.pustakaBaru.length} pustaka baru, deskripsi dan pembuka CPMK`;

      await tx.rpkpsRiwayat.create({
        data: {
          rpkpsId,
          versi: 1,
          status: "DRAF",
          deskripsi: `Draf disusun AI dan disetujui ${sesi.email}: ${ringkas}`,
          olehId: sesi.id,
        },
      });
      await tx.logAudit.create({
        data: {
          penggunaId: sesi.id,
          aksi: "RPKPS_DRAF_AI_DITERAPKAN",
          entitas: "rpkps",
          entitasId: rpkpsId,
          ringkasan: `${sesi.email} menyetujui draf AI — ${ringkas}`,
        },
      });
    }, { timeout: 60_000, maxWait: 15_000 });
  } catch (galat) {
    console.error("[rpkps] gagal menerapkan draf:", galat);
    return { ok: false, pesan: pesanGagalTerap(galat) };
  }

  revalidatePath(`/rpkps/${rpkpsId}`);
  revalidatePath(`/rpkps/${rpkpsId}/mingguan`);
  revalidatePath(`/rpkps/${rpkpsId}/tugas`);
  revalidatePath(`/rpkps/${rpkpsId}/kisi-kisi`);
  return { ok: true, pesan: "Draf diterapkan ke dokumen." };
}

/**
 * Menerjemahkan galat penulisan menjadi kalimat yang bisa ditindaklanjuti.
 *
 * P2003 dan galat enum di sini hampir selalu berarti draf memuat nilai yang
 * tidak dikenal skema — dan itu artinya periksaDraf() kebobolan, bukan salah
 * dosen. Pesannya menyebut hal itu terang-terangan supaya cepat dilaporkan.
 */
function pesanGagalTerap(galat: unknown): string {
  if (klienBasi(galat)) return PESAN_KLIEN_BASI;
  const kode = kodePrisma(galat);

  switch (kode) {
    case "P2022":
    case "P2021":
      return "Struktur basis data tertinggal dari kode aplikasi. Jalankan migrasi, lalu coba lagi.";
    case "P2002":
      return "Ada nomor yang bentrok pada draf (tugas, kriteria, atau butir kisi-kisi).";
    case "P2003":
      return "Draf merujuk data yang tidak ada pada RPKPS ini.";
    case "P2028":
      return "Penulisan melewati batas waktu transaksi dan dibatalkan seluruhnya — tidak ada isi separuh jalan.";
    default: {
      const nama = galat instanceof Error ? galat.constructor.name : "Galat";
      const inti = galat instanceof Error ? intiPesanPrisma(galat.message) : "";
      return `Gagal menerapkan draf — ${nama}${kode ? ` (${kode})` : ""}${inti ? `: ${inti}` : "."}`;
    }
  }
}
