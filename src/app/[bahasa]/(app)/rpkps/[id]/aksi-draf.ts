"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { prisma } from "@/lib/prisma";
import { bolehSuntingIsi, pesanTerkunci, wenangRpkps } from "@/lib/rpkps/wenang";
import { GalatAi } from "@/lib/ai/galat";
import { susunDraf } from "@/lib/ai/draf-rpkps";
import {
  periksaDraf,
  type DrafRpkps,
  type KonteksDraf,
  type TemuanDraf,
} from "@/domain/rpkps/draf";
import { rencanakanKomponen } from "@/domain/rpkps/komponen-nilai";
import type { BentukSoal, JenisTugas, LevelBloom, Prisma } from "@/generated/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import type { Kamus } from "@/kamus";
import { isi as sisip } from "@/lib/bahasa/teks";
import { riwayat } from "@/domain/rpkps/riwayat";
import { barisRiwayat } from "@/lib/rpkps/riwayat";
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
  /**
   * Penyesuaian aritmetika yang dilakukan server atas keluaran model.
   * Ditampilkan apa adanya: yang menyetujui dokumen adalah dosen, dan ia
   * berhak tahu angka mana yang bukan lagi angka model.
   */
  catatan?: string[];
}

async function pastikanWenang(rpkpsId: string) {
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  return {
    sesi,
    boleh,
    status,
    dapatDisunting: bolehSuntingIsi(status),
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
    mingguUjian: k.pertemuan
      .filter((p) => p.jenis !== "EFEKTIF")
      .map((p) => ({ minggu: p.minggu, jenis: p.jenis as "UTS" | "UAS" })),
    subCpmkTersedia: k.mataKuliah.cpmk.flatMap((c) => c.subCpmk.map((s) => s.kode)),
    // Sub-CPMK per minggu datang dari kerangka, bukan dari draf: inilah yang
    // menentukan apakah bobot sebuah minggu dapat mengalir ke capaian.
    subCpmkPerMinggu: Object.fromEntries(
      k.pertemuan.map((p) => [p.minggu, p.subCpmk.map((s) => s.subCpmk.kode)]),
    ),
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
  const kam = await kamusAksi();
  const { boleh, dapatDisunting, status } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const k = await muatKonteks(rpkpsId);
  if (!k) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const d = konteksDomain(k);
  if (d.mingguEfektif.length === 0) {
    return { ok: false, pesan: kam.aksi.mingguan.tanpaPertemuanEfektif };
  }
  if (d.subCpmkTersedia.length === 0) {
    return { ok: false, pesan: kam.aksi.mingguan.tanpaSubCpmk };
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
export async function susunDrafRpkps(
  rpkpsId: string,
  /** Kunci AI yang dipilih dosen; kosong berarti kunci bawaannya. */
  kredensialId?: string | null,
): Promise<HasilDraf> {
  const kam = await kamusAksi();
  const { boleh, dapatDisunting, status, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const k = await muatKonteks(rpkpsId);
  if (!k) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const mulai = Date.now();
  try {
    const { draf, penyedia, model, catatan } = await susunDraf({
      penggunaId: sesi.id,
      rpkpsId,
      kredensialId,
      batas: konteksDomain(k),
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
    return { ok: temuan.length === 0, draf, temuan, penyedia, model, msModel, catatan };
  } catch (galat) {
    if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
    console.error("[rpkps] gagal menyusun draf:", galat);
    return { ok: false, pesan: kam.aksi.ai.gagalDraf };
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
  const kam = await kamusAksi();
  const { boleh, dapatDisunting, status, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const k = await muatKonteks(rpkpsId);
  if (!k) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const temuan = periksaDraf(konteksDomain(k), draf);
  if (temuan.length > 0) {
    return { ok: false, pesan: sisip(kam.aksi.ai.drafMelanggar, { jumlah: temuan.length }) };
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

  const tulisUjian = draf.ujian.map((u) => ({
    u,
    id: wajib(idPertemuan.get(u.minggu), `baris ujian minggu ${u.minggu}`),
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
      pesan: sisip(kam.aksi.lain.drafRujukanHilang, {
        n: hilang.length,
        daftar: `${hilang.slice(0, 5).join(", ")}${hilang.length > 5 ? ", …" : ""}`,
      }),
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // ── Bagian A, pembuka CPMK, komponen nilai, pustaka ─────────────
      await tx.rpkps.update({
        where: { id: rpkpsId },
        data: { deskripsi: draf.deskripsi, kalimatPembukaCpmk: draf.kalimatPembukaCpmk },
      });

      // Komponen nilai DISELARASKAN dengan draf, bukan dihapus lalu dibuat
      // ulang: baris mingguan yang sudah ditautkan dosen menunjuk komponen
      // lewat id, dan id itu harus selamat. Draf tidak membawa id, jadi
      // pemasangannya lewat nama — karena itu tidak ada penggantian nama di
      // jalur ini, dan langkah nama sementara tidak diperlukan.
      const adaKomponen = await tx.komponenNilai.findMany({
        where: { rpkpsId },
        select: { id: true, nama: true },
      });
      const rencanaKomponen = rencanakanKomponen(
        draf.komponenNilai.map((n) => ({ id: null, nama: n.nama, bobot: n.bobot })),
        adaKomponen,
      );
      if (rencanaKomponen.hapus.length > 0) {
        await tx.komponenNilai.deleteMany({ where: { id: { in: rencanaKomponen.hapus } } });
      }
      for (const k of rencanaKomponen.perbarui) {
        await tx.komponenNilai.update({
          where: { id: k.id },
          data: { nama: k.nama, bobot: k.bobot, urutan: k.urutan, sumber: "AI" },
        });
      }
      if (rencanaKomponen.tambah.length > 0) {
        await tx.komponenNilai.createMany({
          data: rencanaKomponen.tambah.map((k) => ({
            rpkpsId,
            nama: k.nama,
            bobot: k.bobot,
            urutan: k.urutan,
            sumber: "AI" as const,
          })),
        });
      }

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

      // Peta komponen dibaca SETELAH penyelarasan di atas — memuat id komponen
      // yang baru dibuat maupun yang dipertahankan — dan SEBELUM baris mingguan
      // ditulis, karena sejak docs/12 baris mingguan pun menunjuk komponen.
      const komponenBaru = new Map<string, string>(
        (
          await tx.komponenNilai.findMany({ where: { rpkpsId }, select: { id: true, nama: true } })
        ).map((n) => [n.nama, n.id]),
      );
      const idKomponen = (nama: string | null) =>
        nama ? (komponenBaru.get(nama) ?? null) : null;

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
            komponenNilaiId: idKomponen(p.komponenNilai),
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

      // ── Baris ujian: HANYA bobot dan komponennya ─────────────────────
      // Topik, jenis, dan menit aktivitas baris ujian tidak disentuh — isinya
      // bukan urusan model. Yang ditulis di sini adalah dua hal yang memang
      // tidak dapat ditentukan dari luar minggu ujian, dan tanpa keduanya
      // seluruh Sub-CPMK yang hanya diuji lewat UTS/UAS tidak pernah terukur.
      for (const { u, id } of tulisUjian) {
        if (!id) continue;
        await tx.pertemuan.update({
          where: { id },
          data: {
            bobot: u.bobot,
            komponenNilaiId: idKomponen(u.komponenNilai),
            sumber: "AI",
          },
        });
      }

      // ── Tugas: diganti seluruhnya ────────────────────────────────────
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
            komponenNilaiId: idKomponen(t.komponenNilai),
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
        `${draf.pertemuan.length} pertemuan, ${draf.ujian.filter((u) => u.bobot > 0).length} baris ujian berbobot, ` +
        `${draf.tugas.length} tugas, ` +
        `${draf.kisiKisi.reduce((s, x) => s + x.butir.length, 0)} butir kisi-kisi, ` +
        `${draf.komponenNilai.length} komponen nilai, ` +
        `${draf.pustakaBaru.length} pustaka baru, deskripsi dan pembuka CPMK`;

      await tx.rpkpsRiwayat.create({
        data: {
          rpkpsId,
          versi: 1,
          status: "DRAF",
          ...barisRiwayat(riwayat("DRAF_AI_DITERAPKAN", { oleh: sesi.email, ringkas })),
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
    return { ok: false, pesan: pesanGagalTerap(galat, kam) };
  }

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan(`/rpkps/${rpkpsId}/mingguan`);
  segarkan(`/rpkps/${rpkpsId}/tugas`);
  segarkan(`/rpkps/${rpkpsId}/kisi-kisi`);
  return { ok: true, pesan: kam.aksi.ai.drafDiterapkan };
}

/**
 * Menerjemahkan galat penulisan menjadi kalimat yang bisa ditindaklanjuti.
 *
 * P2003 dan galat enum di sini hampir selalu berarti draf memuat nilai yang
 * tidak dikenal skema — dan itu artinya periksaDraf() kebobolan, bukan salah
 * dosen. Pesannya menyebut hal itu terang-terangan supaya cepat dilaporkan.
 */
function pesanGagalTerap(galat: unknown, kam: Kamus): string {
  if (klienBasi(galat)) return PESAN_KLIEN_BASI;
  const kode = kodePrisma(galat);

  switch (kode) {
    case "P2022":
    case "P2021":
      return kam.aksi.galatSimpan.strukturBasiSingkat;
    case "P2002":
      return kam.aksi.galatSimpan.bentrokDraf;
    case "P2003":
      return kam.aksi.galatSimpan.rujukanHilang;
    case "P2028":
      return kam.aksi.galatSimpan.transaksiDraf;
    default: {
      const nama = galat instanceof Error ? galat.constructor.name : kam.aksi.galatSimpan.galat;
      const inti = galat instanceof Error ? intiPesanPrisma(galat.message) : "";
      return `${kam.aksi.galatSimpan.gagalDraf} — ${nama}${kode ? ` (${kode})` : ""}${inti ? `: ${inti}` : "."}`;
    }
  }
}
