import { muatKebijakanDari, type Klien } from "@/lib/rpkps/kebijakan-inti";
import { tulisKerangka } from "@/lib/rpkps/kerangka";
import { susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { rancangKerangkaMingguan } from "@/domain/rpkps/kerangka";
import {
  geserRujukan,
  kodeMenganggur,
  pemetaanKodeAsesmen,
  susunRencanaStruktur,
  type BarisMingguan,
  type Operasi,
  type PemetaanMinggu,
} from "@/domain/rpkps/rencana-mingguan";
import type { JenisPertemuan, KategoriWaktu, Prisma } from "@/generated/prisma";

export type { Klien };

/**
 * Mekanisme perubahan STRUKTUR tabel mingguan — docs/09 §4.2.
 *
 * Terpisah dari server action-nya dengan sengaja: yang di sini tidak tahu
 * apa-apa tentang sesi, wewenang, maupun `revalidatePath`, sehingga dapat
 * dijalankan apa adanya oleh harness integrasi terhadap Postgres sungguhan.
 * Dan memang harus: yang paling mungkin salah di seluruh fitur ini adalah
 * penomoran ulang yang menabrak `@@unique([rpkpsId, minggu])`, dan itu tidak
 * akan pernah terlihat pada uji domain yang murni.
 *
 * Karena itu pula klien Prisma diterima sebagai PARAMETER dan berkas ini
 * tidak menandai dirinya `server-only`: penanda itu melempar galat di luar
 * lingkungan React, termasuk di `uji/integrasi.ts`. Polanya sama dengan
 * `lib/kurikulum/usulan-inti.ts`. Yang menjaga pintunya adalah aksi
 * pemanggil, yang selalu lewat `wenangRpkps` lebih dulu.
 */

/** Awalan singgah saat memindahkan kode asesmen; dua fase, seperti nomor minggu. */
const SINGGAH = "~";

export type HasilStruktur = {
  ok: boolean;
  pesan: string;
  nomorBaru: number | null;
};

export async function barisMingguan(
  db: Klien,
  rpkpsId: string,
): Promise<BarisMingguan[]> {
  const pertemuan = await db.pertemuan.findMany({
    where: { rpkpsId },
    orderBy: { minggu: "asc" },
    select: { id: true, minggu: true, jenis: true, bobot: true },
  });
  return pertemuan.map((p) => ({
    id: p.id,
    minggu: p.minggu,
    jenis: p.jenis,
    bobot: Number(p.bobot),
  }));
}

/** Jumlah nilai per kode asesmen pada SELURUH kelas RPKPS ini. */
export async function jumlahNilaiPerKode(
  db: Klien,
  rpkpsId: string,
): Promise<Record<string, number>> {
  const baris = await db.nilaiAsesmen.groupBy({
    by: ["asesmenKode"],
    where: { peserta: { kelas: { rpkpsId } } },
    _count: { _all: true },
  });
  return Object.fromEntries(baris.map((b) => [b.asesmenKode, b._count._all]));
}

/**
 * Menjalankan sebuah operasi struktur secara utuh dalam satu transaksi.
 *
 * Urutannya tidak boleh ditukar:
 *   1. hapus baris (bila ada), supaya nomornya bebas;
 *   2. penomoran ulang DUA FASE — semua baris terdampak dipindahkan ke nomor
 *      negatif lebih dulu, baru diturunkan ke nomor tujuan. Sekali fase saja
 *      akan menabrak `@@unique([rpkpsId, minggu])` pada baris yang belum
 *      sempat bergeser;
 *   3. baris baru (bila ada), setelah nomornya kosong;
 *   4. geser rujukan minggu pada tugas dan linimasa (docs/09 §K3);
 *   5. pindahkan kode asesmen pada nilai — juga dua fase, karena
 *      `@@unique([pesertaKelasId, asesmenKode])` bisa bertabrakan dengan cara
 *      yang sama (docs/09 §K4).
 */
export async function terapkanStruktur(
  db: Klien,
  rpkpsId: string,
  op: Operasi,
): Promise<HasilStruktur> {
  const sebelum = await barisMingguan(db, rpkpsId);
  const rencana = susunRencanaStruktur(sebelum, op);
  if (rencana.galat) {
    return { ok: false, pesan: rencana.galat, nomorBaru: null };
  }

  const petaKode = pemetaanKodeAsesmen(sebelum, rencana.sesudah);

  /**
   * Kode yang menganggur (barisnya dihapus) tidak ikut dipindahkan, tetapi
   * BISA menghalangi: bila salah satunya menempati kode tujuan, fase kedua
   * menabrak kunci unik. Diperiksa lebih dulu supaya dosen mendapat kalimat
   * yang menjelaskan, bukan galat basis data.
   */
  const menganggur = new Set(kodeMenganggur(sebelum, rencana.sesudah));
  const bentrok = petaKode.filter((k) => menganggur.has(k.ke));
  if (bentrok.length > 0) {
    return {
      ok: false,
      nomorBaru: null,
      pesan:
        `Kode asesmen ${bentrok.map((b) => b.ke).join(", ")} masih dipakai nilai ` +
        "dari baris yang sudah dihapus sebelumnya. Rapikan nilai itu lewat impor nilai kelas, lalu ulangi.",
    };
  }

  const aktivitasBaru =
    rencana.nomorBaru === null
      ? []
      : await aktivitasBawaan(db, rpkpsId, rencana.nomorBaru);

  await db.$transaction(async (tx) => {
    if (rencana.idDihapus) {
      await tx.pertemuan.delete({ where: { id: rencana.idDihapus } });
    }

    await nomoriUlang(tx, rencana.pemetaan);

    if (rencana.nomorBaru !== null) {
      await tx.pertemuan.create({
        data: {
          rpkpsId,
          minggu: rencana.nomorBaru,
          jenis: "EFEKTIF",
          subtopik: [],
          bobot: 0,
          aktivitas: { create: aktivitasBaru },
        },
      });
    }

    if (op.jenis === "UBAH_JENIS") {
      const sasaran = rencana.sesudah.find((b) => b.minggu === op.minggu);
      if (sasaran) {
        await tx.pertemuan.update({
          where: { id: sasaran.id },
          data: { jenis: op.ke as JenisPertemuan },
        });
      }
    }

    await geserRujukanTugas(tx, rpkpsId, rencana.pemetaan);
    await pindahkanKodeNilai(tx, rpkpsId, petaKode);
  });

  return { ok: true, pesan: "Tersimpan.", nomorBaru: rencana.nomorBaru };
}

/**
 * Membuang seluruh tabel mingguan dan menyusunnya kembali dari kebijakan
 * beban belajar (docs/09 §K7). SELURUH isi baris ikut lenyap.
 */
export async function susunUlangKerangkaDb(
  db: Klien,
  rpkpsId: string,
): Promise<{ ok: boolean; pesan: string; jumlah: number }> {
  const rpkps = await db.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      mataKuliah: {
        select: {
          sksTeori: true,
          sksPraktik: true,
          bentukTeori: true,
          bentukPraktik: true,
          cpmk: {
            orderBy: { urutan: "asc" },
            select: { subCpmk: { orderBy: { urutan: "asc" }, select: { id: true } } },
          },
        },
      },
    },
  });
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan.", jumlah: 0 };

  const { kebijakan } = await muatKebijakanDari(db);
  const rencana = susunRencanaSemester(kebijakan, rpkps.mataKuliah);
  const baris = rancangKerangkaMingguan(
    rencana,
    kebijakan,
    rpkps.mataKuliah.cpmk.flatMap((c) => c.subCpmk).map((s) => s.id),
  );

  await db.$transaction(async (tx) => {
    await tx.pertemuan.deleteMany({ where: { rpkpsId } });
    await tulisKerangka(tx, rpkpsId, baris);
  });

  return {
    ok: true,
    pesan: `Kerangka disusun ulang: ${baris.length} pertemuan.`,
    jumlah: baris.length,
  };
}

type Tx = Prisma.TransactionClient;

async function nomoriUlang(tx: Tx, pemetaan: readonly PemetaanMinggu[]) {
  if (pemetaan.length === 0) return;
  // Fase 1 — singgah di nomor negatif, yang tidak pernah dipakai baris nyata.
  for (const p of pemetaan) {
    await tx.pertemuan.update({ where: { id: p.id }, data: { minggu: -p.ke } });
  }
  // Fase 2 — turun ke nomor tujuan, kini pasti kosong.
  for (const p of pemetaan) {
    await tx.pertemuan.update({ where: { id: p.id }, data: { minggu: p.ke } });
  }
}

/**
 * `tugas.minggu_mulai`, `tugas.minggu_selesai`, dan `linimasa_tugas.minggu`
 * menyebut nomor minggu sebagai angka biasa. Tanpa ini, tugas yang
 * dijadwalkan minggu 5–7 tiba-tiba menunjuk materi yang lain.
 */
async function geserRujukanTugas(
  tx: Tx,
  rpkpsId: string,
  pemetaan: readonly PemetaanMinggu[],
) {
  if (pemetaan.length === 0) return;

  const tugas = await tx.tugas.findMany({
    where: { rpkpsId },
    select: { id: true, mingguMulai: true, mingguSelesai: true },
  });
  for (const t of tugas) {
    const mulai = geserRujukan(pemetaan, t.mingguMulai);
    const selesai = geserRujukan(pemetaan, t.mingguSelesai);
    if (mulai !== t.mingguMulai || selesai !== t.mingguSelesai) {
      await tx.tugas.update({
        where: { id: t.id },
        data: { mingguMulai: mulai, mingguSelesai: selesai },
      });
    }
  }

  const linimasa = await tx.linimasaTugas.findMany({
    where: { tugas: { rpkpsId } },
    select: { id: true, minggu: true },
  });
  for (const l of linimasa) {
    const minggu = geserRujukan(pemetaan, l.minggu);
    if (minggu !== l.minggu) {
      await tx.linimasaTugas.update({ where: { id: l.id }, data: { minggu } });
    }
  }
}

async function pindahkanKodeNilai(
  tx: Tx,
  rpkpsId: string,
  peta: readonly { dari: string; ke: string }[],
) {
  if (peta.length === 0) return;
  const milikRpkps = { peserta: { kelas: { rpkpsId } } };

  for (const k of peta) {
    await tx.nilaiAsesmen.updateMany({
      where: { ...milikRpkps, asesmenKode: k.dari },
      data: { asesmenKode: SINGGAH + k.ke },
    });
  }
  for (const k of peta) {
    await tx.nilaiAsesmen.updateMany({
      where: { ...milikRpkps, asesmenKode: SINGGAH + k.ke },
      data: { asesmenKode: k.ke },
    });
  }
}

/**
 * Alokasi waktu bawaan untuk baris baru: pagu minggu itu, mengikuti pola
 * `buatRpkps`. Baris di luar 1..mingguPerSemester tidak punya pagu, jadi
 * dibiarkan kosong — dosen yang menentukan bebannya, dan validator
 * menandainya lewat W-MINGGU-BERLEBIH.
 */
async function aktivitasBawaan(db: Klien, rpkpsId: string, minggu: number) {
  const rpkps = await db.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      mataKuliah: {
        select: { sksTeori: true, sksPraktik: true, bentukTeori: true, bentukPraktik: true },
      },
    },
  });
  if (!rpkps) return [];

  const { kebijakan } = await muatKebijakanDari(db);
  const rencana = susunRencanaSemester(kebijakan, rpkps.mataKuliah);
  const pagu = rencana.minggu.find((m) => m.minggu === minggu)?.pagu;
  if (!pagu) return [];

  const aktivitas: { nama: string; kategori: KategoriWaktu; menit: number; urutan: number }[] = [];
  if (pagu.tm > 0) aktivitas.push({ nama: "Tatap muka", kategori: "TM", menit: pagu.tm, urutan: 0 });
  if (pagu.pt > 0) {
    aktivitas.push({ nama: "Penugasan terstruktur", kategori: "PT", menit: pagu.pt, urutan: 1 });
  }
  if (pagu.bm > 0) {
    aktivitas.push({ nama: "Belajar mandiri", kategori: "BM", menit: pagu.bm, urutan: 2 });
  }
  return aktivitas;
}
