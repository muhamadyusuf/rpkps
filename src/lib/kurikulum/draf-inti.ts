import { id as kamusId } from "@/kamus/id";
import { teksTemuan } from "@/lib/bahasa/temuan";
import { validasiKurikulum } from "@/domain/kurikulum/validator";
import type { MataKuliahInput } from "@/domain/kurikulum/tipe";
import type { BahanDraf, DasarTersedia } from "@/domain/kurikulum/draf-usulan";
import type { ButirInput } from "@/domain/kurikulum/usulan";
import { muatKurikulumInput, type Klien } from "./usulan-inti";

/**
 * Lapisan basis data draf AI Usulan Revisi Kurikulum — fase U3b–U3c.
 * Acuan: docs/04-usulan-revisi-kurikulum.md §9.3 dan §9.7.
 *
 * Tugasnya satu: menyusun **katalog dasar tertutup** sebelum model dipanggil.
 * Inilah setengah dari poros §9.2 — model boleh menyusun butir, tetapi dasar
 * yang boleh dipilihnya sudah ditentukan lebih dulu di sini, dari data yang
 * benar-benar ada. Setengah lainnya `saringDrafUsulan`, yang memeriksa ulang
 * pilihan model terhadap katalog yang sama.
 *
 * Tiga sumber, seluruhnya sudah ada di basis data hari ini:
 *
 *   TEMUAN_VALIDATOR — `validasiKurikulum` atas mata kuliah sasaran
 *   TEMUAN_EVALUASI  — akar masalah yang ditulis Kaprodi pada evaluasi kelas
 *   CATATAN_DOSEN    — yang diketik dosen sendiri sebelum menekan tombol
 *
 * `SINYAL_INDUSTRI`, `MASUKAN_DUDI`, dan `TRACER` sengaja tidak ada: sumbernya
 * belum ada di basis data, dan itu memang isi U4.
 *
 * Klien Prisma diterima sebagai PARAMETER, bukan diimpor dari `@/lib/prisma`,
 * dengan alasan yang sama seperti `usulan-inti.ts`: perakitan katalog adalah
 * bagian paling berisiko dari fase ini — ia yang memutuskan dasar apa saja
 * yang BOLEH ADA — dan harus dapat dijalankan uji integrasi terhadap Postgres
 * tertanam. Pembungkus yang mengikatnya ke klien aplikasi ada di
 * `src/lib/kurikulum/bahan-draf.ts`.
 */

/** Konteks yang dikirim ke model — bentuk baca, bukan bentuk simpan. */
export interface KonteksDraf {
  mataKuliah: {
    kode: string;
    nama: string;
    semester: number;
    sks: number;
  };
  cplDibebankan: { kode: string; deskripsi: string }[];
  cpmk: {
    kode: string;
    rumusan: string;
    levelBloom: string | null;
    cplKode: string[];
    subCpmk: { kode: string; rumusan: string; levelBloom: string | null }[];
  }[];
  /** Katalog dasar. Model MEMILIH `ref` dari sini; ia tidak menulis dasar. */
  dasar: {
    ref: string;
    jenis: string;
    kutipan: string;
    sasaran: string;
  }[];
  catatanDosen: string | null;
}

export interface BahanLengkap {
  /** Bentuk yang dipakai `saringDrafUsulan` — batas keras, bukan bahan baca. */
  bahan: BahanDraf;
  konteks: KonteksDraf;
  ringkas: {
    temuanValidator: number;
    temuanEvaluasi: number;
    cpmk: number;
    subCpmk: number;
    adaCatatan: boolean;
  };
  /**
   * Peta `ref` katalog → id baris `temuan_evaluasi`.
   *
   * Dipakai saat penerapan untuk mengisi `TemuanEvaluasi.usulanId` — sambungan
   * yang menutup siklus PPEPP (docs/04 §9.6, docs/05 §5.6). Tanpa peta ini
   * penerapan harus menebak-nebak dari kutipannya.
   */
  refTemuanEvaluasi: Map<string, string>;
}

/** Prefiks ref dibedakan agar dua sumber tidak pernah bertabrakan kodenya. */
const PREFIKS_VALIDATOR = "V";
const PREFIKS_EVALUASI = "E";

/**
 * Merakit bahan untuk satu usulan.
 *
 * Mengembalikan `null` bila mata kuliah sasarannya tidak ada — usulan tanpa
 * mata kuliah memang tidak dapat didrafkan AI, karena seluruh batas kodenya
 * berasal dari mata kuliah itu.
 */
export async function rakitBahanDraf(
  db: Klien,
  arg: {
    kurikulumId: string;
    mataKuliahId: string | null;
    catatanDosen: string | null;
  },
): Promise<BahanLengkap | null> {
  if (!arg.mataKuliahId) return null;

  /*
   * Dua bacaan yang tidak saling menunggu. Kurikulum dimuat UTUH karena
   * `validasiKurikulum` memang menilai keseluruhannya — aturan seperti
   * "CPL tidak dijabarkan satu MK pun" tidak dapat dihitung dari satu mata
   * kuliah saja.
   */
  const [kurikulum, mk] = await Promise.all([
    muatKurikulumInput(db, arg.kurikulumId),
    db.mataKuliah.findUnique({
      where: { id: arg.mataKuliahId },
      select: { kode: true },
    }),
  ]);
  if (!kurikulum || !mk) return null;

  const mkInput = kurikulum.mataKuliah.find((m) => m.kode === mk.kode);
  if (!mkInput) return null;

  const dasar: DasarTersedia[] = [];
  const refTemuanEvaluasi = new Map<string, string>();

  // ── Sumber 1 · temuan validator ────────────────────────────────────────
  const semuaTemuan = validasiKurikulum(kurikulum).temuan;
  const temuanMk = semuaTemuan.filter((t) => t.lokasi?.mk === mkInput.kode);

  for (const t of temuanMk) {
    const cpmkKode = t.lokasi?.cpmk ?? null;
    const subCpmkKode = t.lokasi?.subCpmk ?? null;
    /*
     * Kalimatnya dirakit DI SINI, dalam bahasa Indonesia, lalu dibekukan
     * sebagai kutipan dasar. Itu disengaja dan berbeda dari aturan umum
     * docs/11 §4: `dasar_butir.kutipan` adalah kutipan — bukti yang dibaca
     * Kaprodi berbulan-bulan kemudian dan tidak pernah ditulis ulang.
     * Menyimpannya sebagai kode+params akan membuat kutipan berubah bunyi
     * ketika kamus disunting, dan bukti yang berubah bukan lagi bukti.
     */
    const kalimat = teksTemuan(t, kamusId);
    dasar.push({
      ref: `${PREFIKS_VALIDATOR}:${t.kode}:${subCpmkKode ?? cpmkKode ?? mkInput.kode}`,
      jenis: "TEMUAN_VALIDATOR",
      kutipan: `[${t.kode}] ${kalimat.pesan}`,
      cpmkKode,
      subCpmkKode,
    });
  }

  // ── Sumber 2 · temuan evaluasi ─────────────────────────────────────────
  const indukSub = new Map<string, string>();
  for (const c of mkInput.cpmk) {
    for (const s of c.subCpmk) indukSub.set(s.kode, c.kode);
  }

  const temuanEvaluasi = await db.temuanEvaluasi.findMany({
    where: {
      evaluasi: { kelas: { rpkps: { mataKuliahId: arg.mataKuliahId } } },
      tingkat: { in: ["SUB_CPMK", "CPMK"] },
      // Temuan yang SUDAH diteruskan menjadi usulan tidak ditawarkan lagi:
      // menawarkannya berarti mengusulkan perbaikan yang sama dua kali, dan
      // yang kedua tampak sama meyakinkannya dengan yang pertama.
      usulanId: null,
    },
    orderBy: { dibuatPada: "desc" },
    select: {
      id: true,
      tingkat: true,
      kode: true,
      akarMasalah: true,
      capaianTerukur: true,
    },
  });

  for (const t of temuanEvaluasi) {
    const ref = `${PREFIKS_EVALUASI}:${t.id}`;
    const subCpmkKode = t.tingkat === "SUB_CPMK" ? t.kode : null;
    const cpmkKode = t.tingkat === "CPMK" ? t.kode : (indukSub.get(t.kode) ?? null);
    // Temuan atas capaian yang tidak dikenal mata kuliah ini dilewati: ia
    // milik kelas lain yang kebetulan ikut terbaca, dan dasar yang tidak dapat
    // dipasangkan ke sasaran mana pun hanya akan dibuang penyaring.
    if (!cpmkKode && !subCpmkKode) continue;

    dasar.push({
      ref,
      jenis: "TEMUAN_EVALUASI",
      kutipan: t.akarMasalah,
      cpmkKode,
      subCpmkKode,
    });
    refTemuanEvaluasi.set(ref, t.id);
  }

  const catatanDosen = arg.catatanDosen?.trim() || null;

  return {
    bahan: {
      mkKode: mkInput.kode,
      cpmkKode: mkInput.cpmk.map((c) => c.kode),
      subCpmkKode: mkInput.cpmk.flatMap((c) => c.subCpmk.map((s) => s.kode)),
      cplDibebankan: mkInput.cplKode,
      dasar,
      catatanDosen,
    },
    konteks: susunKonteks(mkInput, kurikulum.cpl, dasar, catatanDosen),
    ringkas: {
      temuanValidator: temuanMk.length,
      temuanEvaluasi: refTemuanEvaluasi.size,
      cpmk: mkInput.cpmk.length,
      subCpmk: mkInput.cpmk.reduce((n, c) => n + c.subCpmk.length, 0),
      adaCatatan: catatanDosen !== null,
    },
    refTemuanEvaluasi,
  };
}

function susunKonteks(
  mk: MataKuliahInput,
  cpl: { kode: string; deskripsi: string }[],
  dasar: DasarTersedia[],
  catatanDosen: string | null,
): KonteksDraf {
  const dibebankan = new Set(mk.cplKode);

  return {
    mataKuliah: {
      kode: mk.kode,
      nama: mk.nama,
      semester: mk.semester,
      sks: mk.sksTeori + mk.sksPraktik,
    },
    cplDibebankan: cpl
      .filter((c) => dibebankan.has(c.kode))
      .map((c) => ({ kode: c.kode, deskripsi: c.deskripsi })),
    cpmk: mk.cpmk.map((c) => ({
      kode: c.kode,
      rumusan: c.rumusan,
      levelBloom: c.levelBloom ?? null,
      cplKode: c.cplKode,
      subCpmk: c.subCpmk.map((s) => ({
        kode: s.kode,
        rumusan: s.rumusan,
        levelBloom: s.levelBloom ?? null,
      })),
    })),
    dasar: dasar.map((d) => ({
      ref: d.ref,
      jenis: d.jenis,
      kutipan: d.kutipan,
      sasaran: d.subCpmkKode ?? d.cpmkKode ?? mk.kode,
    })),
    catatanDosen,
  };
}

/**
 * Menulis butir hasil draf beserta dasarnya, dan menautkan temuan evaluasi yang
 * menjadi dasarnya — dalam SATU transaksi.
 *
 * Satu transaksi, bukan dua langkah: temuan yang tertaut ke usulan yang gagal
 * disimpan akan hilang dari tawaran draf berikutnya tanpa pernah menjadi apa
 * pun. Penautan itu sendiri mengisi `TemuanEvaluasi.usulanId` — kolom yang
 * sejak doc 05 §5.6 ada dan tidak pernah terisi, dan yang menutup siklus
 * PPEPP: evaluasi → tindak lanjut → revisi kurikulum.
 *
 * Butir yang masuk WAJIB sudah lolos `saringDrafUsulan`. Fungsi ini tidak
 * memeriksa apa pun; ia menulis.
 */
export async function tulisButirDraf(
  db: Klien,
  arg: {
    usulanId: string;
    butir: ButirInput[];
    /** Peta ref katalog → id temuan evaluasi, dari `rakitBahanDraf`. */
    refTemuanEvaluasi: Map<string, string>;
  },
): Promise<{ ditulis: number; temuanTertaut: number }> {
  const terakhir = await db.butirUsulan.aggregate({
    where: { usulanId: arg.usulanId },
    _max: { urutan: true },
  });
  let urutan = terakhir._max.urutan ?? 0;

  const temuanTertaut = new Set<string>();
  for (const b of arg.butir) {
    for (const d of b.dasar) {
      const idTemuan = d.ref ? arg.refTemuanEvaluasi.get(d.ref) : undefined;
      if (idTemuan) temuanTertaut.add(idTemuan);
    }
  }

  await db.$transaction(async (tx) => {
    for (const b of arg.butir) {
      urutan += 1;
      await tx.butirUsulan.create({
        data: {
          usulanId: arg.usulanId,
          urutan,
          jenis: b.jenis,
          sumber: "AI",
          cpmkKode: b.cpmkKode,
          subCpmkKode: b.subCpmkKode ?? null,
          rumusan: b.rumusan ?? null,
          levelBloom: b.levelBloom ?? null,
          cplKode: b.cplKode ?? [],
          mingguDisarankan: b.mingguDisarankan ?? [],
          alasan: b.alasan,
          dasar: {
            create: b.dasar.map((d) => ({
              jenis: d.jenis,
              ref: d.ref ?? null,
              kutipan: d.kutipan,
            })),
          },
        },
      });
    }

    if (temuanTertaut.size > 0) {
      await tx.temuanEvaluasi.updateMany({
        // `usulanId: null` ikut ke syarat: bila di sela pratinjau dan penerapan
        // ada yang lebih dulu meneruskan temuan yang sama, yang menang adalah
        // usulan pertama — bukan yang terakhir menekan tombol.
        where: { id: { in: [...temuanTertaut] }, usulanId: null },
        data: { usulanId: arg.usulanId },
      });
    }
  });

  return { ditulis: arg.butir.length, temuanTertaut: temuanTertaut.size };
}
