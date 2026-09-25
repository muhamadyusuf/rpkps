import type { Klien } from "@/lib/rpkps/kebijakan-inti";
import {
  aktivitasParaf,
  aktivitasRiwayat,
  kunciRantai,
  type AktivitasKeluar,
  type BarisRantai,
  type KonteksRpkps,
} from "@/domain/identitas/aktivitas";

/**
 * Penyelaras aktivitas → identitas-itts (docs/24).
 *
 * `rpkps_riwayat` dan `tanda_tangan_rpkps` ditulis di transaksi yang sama
 * dengan perubahan dokumennya, jadi keduanya sudah menjadi outbox: yang
 * disimpan di sini hanya kursor — sampai mana sudah dibaca. Aksi pengguna
 * tidak menyentuh penyelaras ini sama sekali; gagal melapor tidak pernah
 * menggagalkan pekerjaan dosen.
 *
 * Kursor maju hanya setelah identitas-itts menjawab 200. Kiriman ulang aman:
 * identitas-itts idempoten atas id aktivitas, jadi sesudah galat di tengah
 * jalan cukup panggil lagi. Isian mundur memakai jalur yang sama persis —
 * kursor kosong berarti mulai dari baris pertama.
 *
 * Menerima klien Prisma dan `fetch` sebagai parameter (tidak `server-only`)
 * supaya dapat diuji terhadap Postgres sungguhan di uji/integrasi.ts.
 */

export type KonfigIdentitas = { url: string; klienId: string; rahasia: string };

export type SumberAktivitas = "riwayat" | "paraf";
const SUMBER: readonly SumberAktivitas[] = ["riwayat", "paraf"];

/** Baris per putaran. Satu pengesahan menjadi dua aktivitas, jadi satu kiriman ≤ 400 — di bawah batas 500. */
const BATAS_BARIS = 200;
const MAKS_PER_KIRIMAN = 500;
/**
 * Baris yang lebih muda dari ini belum dibaca. Cap waktu ditulis aplikasi
 * sebelum transaksinya selesai, jadi baris bercap lebih awal bisa terlihat
 * SETELAH baris bercap lebih akhir — tanpa jeda, kursor sudah melewatinya.
 */
const JEDA_MENGENDAP_MS = 5 * 60_000;
const BATAS_WAKTU_BAWAAN_MS = 45_000;

export type RingkasSumber = {
  baris: number;
  dikirim: number;
  diterima: number;
  duplikat: number;
  ditolak: number;
  isianMundur: boolean;
  /** Kursor sudah menyusul baris terbaru. */
  tuntas: boolean;
};

export type HasilSinkron = {
  riwayat: RingkasSumber;
  paraf: RingkasSumber;
  /** Sampai 20 penolakan pertama — alasannya juga terlihat di halaman aplikasi klien identitas-itts. */
  contohTolak: { id: string | null; alasan: string }[];
};

type Kursor = { pada: Date; idTerakhir: string; isiMundurSelesai: boolean } | null;

function setelahKursor(kolom: "dibuatPada" | "ditandatanganiPada", k: Kursor) {
  if (!k) return {};
  return { OR: [{ [kolom]: { gt: k.pada } }, { [kolom]: k.pada, id: { gt: k.idTerakhir } }] };
}

async function konteksRpkps(db: Klien, rpkpsIds: string[]): Promise<Map<string, KonteksRpkps>> {
  const rpkps = await db.rpkps.findMany({
    where: { id: { in: rpkpsIds } },
    select: {
      id: true,
      mataKuliah: { select: { kode: true, nama: true, kurikulum: { select: { prodi: { select: { kode: true } } } } } },
      tahunAkademik: {
        select: { kode: true, tenggatPenyusunan: true, tenggatReview: true, tenggatPengesahan: true, jaminanHariPutusan: true },
      },
    },
  });
  return new Map(
    rpkps.map((r) => [
      r.id,
      {
        judul: `RPKPS ${r.mataKuliah.kode} ${r.mataKuliah.nama} ${r.tahunAkademik.kode}`,
        tenggat: {
          penyusunan: r.tahunAkademik.tenggatPenyusunan,
          review: r.tahunAkademik.tenggatReview,
          pengesahan: r.tahunAkademik.tenggatPengesahan,
        },
        jaminanHari: r.tahunAkademik.jaminanHariPutusan,
        atribut: { prodi: r.mataKuliah.kurikulum.prodi.kode, ta: r.tahunAkademik.kode },
      },
    ]),
  );
}

async function petaSurel(db: Klien, ids: (string | null)[]) {
  const unik = [...new Set(ids.filter((x): x is string => !!x))];
  const pengguna = await db.pengguna.findMany({ where: { id: { in: unik } }, select: { id: true, email: true } });
  const peta = new Map(pengguna.map((p) => [p.id, p.email]));
  return (id: string) => peta.get(id);
}

/** Seluruh cap rantai milik RPKPS-RPKPS ini — pembanding untuk "kapan sampai" dan "berapa kali dikembalikan". */
async function rantaiDari(db: Klien, rpkpsIds: string[]): Promise<BarisRantai[]> {
  const semua = await db.rpkpsRiwayat.findMany({
    where: { rpkpsId: { in: rpkpsIds } },
    select: { id: true, rpkpsId: true, versi: true, data: true, olehId: true, dibuatPada: true },
  });
  return semua.flatMap((r) => {
    const kunci = kunciRantai(r.data);
    return kunci ? [{ id: r.id, rpkpsId: r.rpkpsId, versi: r.versi, kunci, olehId: r.olehId, pada: r.dibuatPada }] : [];
  });
}

async function bacaRiwayat(db: Klien, kursor: Kursor, sampai: Date, awalan: string) {
  const baris = await db.rpkpsRiwayat.findMany({
    where: { AND: [{ dibuatPada: { lte: sampai } }, setelahKursor("dibuatPada", kursor)] },
    orderBy: [{ dibuatPada: "asc" }, { id: "asc" }],
    take: BATAS_BARIS,
    select: { id: true, rpkpsId: true, data: true, dibuatPada: true },
  });
  const terakhir = baris.at(-1);
  const akhir = terakhir ? { id: terakhir.id, pada: terakhir.dibuatPada } : undefined;
  // Kursor tetap melewati peristiwa lain (draf AI, arsip, serah terima…) — bukan perbuatan rantai.
  const perbuatan = baris.filter((b) => kunciRantai(b.data));
  if (perbuatan.length === 0) return { akhir, jumlah: baris.length, aktivitas: [] };

  const rpkpsIds = [...new Set(perbuatan.map((b) => b.rpkpsId))];
  const [rantai, konteks] = await Promise.all([rantaiDari(db, rpkpsIds), konteksRpkps(db, rpkpsIds)]);
  const email = await petaSurel(db, rantai.map((r) => r.olehId));
  const aktivitas = perbuatan.flatMap((b) => {
    const cap = rantai.find((r) => r.id === b.id);
    const k = konteks.get(b.rpkpsId);
    return cap && k ? aktivitasRiwayat({ baris: cap, rantai, konteks: k, email, awalan }) : [];
  });
  return { akhir, jumlah: baris.length, aktivitas };
}

async function bacaParaf(db: Klien, kursor: Kursor, sampai: Date, awalan: string) {
  const baris = await db.tandaTanganRpkps.findMany({
    where: { AND: [{ peran: "PENGAMPU", ditandatanganiPada: { lte: sampai } }, setelahKursor("ditandatanganiPada", kursor)] },
    orderBy: [{ ditandatanganiPada: "asc" }, { id: "asc" }],
    take: BATAS_BARIS,
    select: { id: true, rpkpsId: true, versi: true, penggunaId: true, ditandatanganiPada: true },
  });
  if (baris.length === 0) return { akhir: undefined, jumlah: 0, aktivitas: [] };

  const rpkpsIds = [...new Set(baris.map((b) => b.rpkpsId))];
  const [rantai, konteks, permintaan, email] = await Promise.all([
    rantaiDari(db, rpkpsIds),
    konteksRpkps(db, rpkpsIds),
    db.notifikasi.findMany({
      where: { jenis: "RPKPS_MINTA_PARAF", entitasId: { in: rpkpsIds }, penggunaId: { in: [...new Set(baris.map((b) => b.penggunaId))] } },
      select: { penggunaId: true, entitasId: true, dibuatPada: true },
    }),
    petaSurel(db, baris.map((b) => b.penggunaId)),
  ]);
  const aktivitas = baris.flatMap((b) => {
    const k = konteks.get(b.rpkpsId);
    if (!k) return [];
    return aktivitasParaf({
      paraf: { id: b.id, rpkpsId: b.rpkpsId, versi: b.versi, penggunaId: b.penggunaId, pada: b.ditandatanganiPada },
      diminta: permintaan.filter((p) => p.penggunaId === b.penggunaId && p.entitasId === b.rpkpsId).map((p) => p.dibuatPada),
      dikembalikan: rantai.filter((r) => r.rpkpsId === b.rpkpsId && r.kunci === "DIKEMBALIKAN_REVISI").map((r) => r.pada),
      konteks: k,
      email,
      awalan,
    });
  });
  return { akhir: { id: baris.at(-1)!.id, pada: baris.at(-1)!.ditandatanganiPada }, jumlah: baris.length, aktivitas };
}

type JawabanIdentitas = { diterima: number; duplikat: number; dibatalkan: number; ditolak: { id: string | null; alasan: string }[] };

async function kirim(konfig: KonfigIdentitas, aktivitas: AktivitasKeluar[], isianMundur: boolean, ambil: typeof fetch) {
  const total: JawabanIdentitas = { diterima: 0, duplikat: 0, dibatalkan: 0, ditolak: [] };
  const url = `${konfig.url.replace(/\/+$/, "")}/api/v1/aktivitas`;
  const kredensial = Buffer.from(`${konfig.klienId}:${konfig.rahasia}`).toString("base64");
  for (let i = 0; i < aktivitas.length; i += MAKS_PER_KIRIMAN) {
    const resp = await ambil(url, {
      method: "POST",
      headers: { Authorization: `Basic ${kredensial}`, "Content-Type": "application/json" },
      body: JSON.stringify({ aktivitas: aktivitas.slice(i, i + MAKS_PER_KIRIMAN), isianMundur }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      // Galat utuh dari identitas-itts (mis. 401 client_secret salah) dilempar;
      // kursor tidak maju, putaran berikutnya mengulang dari tempat yang sama.
      throw new Error(`identitas-itts menjawab ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    }
    const j = (await resp.json()) as JawabanIdentitas;
    total.diterima += j.diterima;
    total.duplikat += j.duplikat;
    total.dibatalkan += j.dibatalkan;
    total.ditolak.push(...j.ditolak);
  }
  return total;
}

/**
 * Satu putaran penyelarasan: tiap sumber dibaca per 200 baris sampai kursor
 * menyusul, atau sampai batas waktu habis (sisanya diteruskan putaran
 * berikutnya — isian mundur riwayat panjang tidak perlu selesai sekali jalan).
 *
 * `ulang` menghapus kursor: seluruh riwayat dikirim ulang sebagai isian
 * mundur. Aman karena identitas-itts idempoten — gunanya menyusulkan
 * aktivitas yang dulu ditolak karena pelakunya belum terdaftar sebagai pegawai.
 */
export async function sinkronkanAktivitas(
  db: Klien,
  konfig: KonfigIdentitas,
  opsi: { sekarang?: Date; batasWaktuMs?: number; ulang?: boolean; ambil?: typeof fetch } = {},
): Promise<HasilSinkron> {
  const mulai = Date.now();
  const sampai = new Date((opsi.sekarang ?? new Date()).getTime() - JEDA_MENGENDAP_MS);
  const ambil = opsi.ambil ?? fetch;
  if (opsi.ulang) await db.kursorIdentitas.deleteMany({});

  const kosong = (): RingkasSumber => ({ baris: 0, dikirim: 0, diterima: 0, duplikat: 0, ditolak: 0, isianMundur: false, tuntas: false });
  const hasil: HasilSinkron = { riwayat: kosong(), paraf: kosong(), contohTolak: [] };

  for (const sumber of SUMBER) {
    const r = hasil[sumber];
    for (;;) {
      const kursor: Kursor = await db.kursorIdentitas.findUnique({ where: { sumber } });
      const isianMundur = !kursor?.isiMundurSelesai;
      const bacaan = sumber === "riwayat" ? await bacaRiwayat(db, kursor, sampai, konfig.klienId) : await bacaParaf(db, kursor, sampai, konfig.klienId);
      const tuntas = bacaan.jumlah < BATAS_BARIS;

      if (bacaan.aktivitas.length > 0) {
        const j = await kirim(konfig, bacaan.aktivitas, isianMundur, ambil);
        r.dikirim += bacaan.aktivitas.length;
        r.diterima += j.diterima;
        r.duplikat += j.duplikat;
        r.ditolak += j.ditolak.length;
        hasil.contohTolak.push(...j.ditolak.slice(0, 20 - hasil.contohTolak.length));
        r.isianMundur ||= isianMundur;
      }
      r.baris += bacaan.jumlah;

      // Kursor pertama dibuat walau belum ada satu baris pun, supaya baris
      // pertama yang lahir sesudahnya tidak ikut bertanda isian mundur.
      const akhir = bacaan.akhir ?? (kursor ? null : { pada: new Date(0), id: "" });
      if (akhir) {
        await db.kursorIdentitas.upsert({
          where: { sumber },
          create: { sumber, pada: akhir.pada, idTerakhir: akhir.id, isiMundurSelesai: tuntas },
          update: { pada: akhir.pada, idTerakhir: akhir.id, isiMundurSelesai: (kursor?.isiMundurSelesai ?? false) || tuntas },
        });
      } else if (kursor && !kursor.isiMundurSelesai && tuntas) {
        await db.kursorIdentitas.update({ where: { sumber }, data: { isiMundurSelesai: true } });
      }

      if (tuntas) {
        r.tuntas = true;
        break;
      }
      if (Date.now() - mulai > (opsi.batasWaktuMs ?? BATAS_WAKTU_BAWAAN_MS)) break;
    }
  }
  return hasil;
}
