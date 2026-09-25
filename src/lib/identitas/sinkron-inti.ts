import { randomUUID } from "node:crypto";
import type { Peran, StatusPengguna } from "@/generated/prisma";
import type { BarisDirektori, FaktaPegawai, PeranAplikasi, PeranDariIdentitas } from "@/domain/identitas/kontrak";
import {
  PERAN_TURUNAN,
  pagarPenghapusan,
  rekonsiliasi,
  statusSetelahSinkron,
  turunkanPeran,
  type Diabaikan,
  type PenugasanAda,
  type PetaProdi,
  type RencanaRekonsiliasi,
  type Turunan,
} from "@/domain/identitas/peran";
import type { Klien } from "@/lib/rpkps/kebijakan-inti";

/**
 * Sinkron peran RPKPS dari identitas-itts (docs/26 §5) — bagian yang menyentuh
 * basis data.
 *
 * Terpisah dari `sinkron.ts` (yang memanggil jaringan) dengan alasan yang sama
 * seperti berkas `*-inti.ts` lain: yang paling mungkin salah di sini —
 * constraint unik yang tertabrak, baris yang tak sengaja terhapus, transaksi
 * setengah jalan — hanya terbukti terhadap Postgres sungguhan. Berkas ini
 * menerima klien Prisma dan TIDAK menandai dirinya `server-only`, sehingga
 * `uji/sinkron-peran.ts` dapat menjalankannya di PGlite.
 *
 * Hanya `penugasan_peran` bersumber IDENTITAS yang dibuat dan dihapus di sini.
 * Baris LOKAL tak pernah dihapus kecuali `hapusLokal` (lihat `rekonsiliasi`).
 */

export type OpsiSinkron = {
  /** Hapus juga peran LOKAL turunan yang tak didukung identitas-itts. Bawaan false: peralihan tak boleh mengunci orang. */
  hapusLokal: boolean;
  /** Surel admin bootstrap (env). Peran ADMIN LOKAL mereka tak pernah dihapus sinkron. */
  emailBootstrap: readonly string[];
};

export async function muatPetaProdi(db: Klien): Promise<PetaProdi> {
  const baris = await db.prodi.findMany({
    where: { identitasUnitId: { not: null } },
    select: { id: true, identitasUnitId: true },
  });
  return new Map(baris.map((b) => [b.identitasUnitId as string, b.id]));
}

type PenggunaMuat = {
  id: string;
  email: string;
  status: StatusPengguna;
  identitasAkunId: string | null;
  penugasan: PenugasanAda[];
};

const PILIH_PENGGUNA = {
  id: true,
  email: true,
  status: true,
  identitasAkunId: true,
  penugasan: { select: { id: true, peran: true, prodiId: true, sumber: true } },
} as const;

type Rencana = { turunan: Turunan; rencana: RencanaRekonsiliasi };

function rencanakan(
  p: Pick<PenggunaMuat, "email" | "penugasan">,
  fakta: Pick<FaktaPegawai, "aktif" | "jenisPegawai" | "homebaseUnitId" | "peran">,
  peta: PetaProdi,
  opsi: OpsiSinkron,
): Rencana {
  const turunan = turunkanPeran(fakta, peta);
  const bootstrap = opsi.emailBootstrap.map((e) => e.toLowerCase()).includes(p.email.toLowerCase());
  const rencana = rekonsiliasi(turunan.penugasan, p.penugasan, {
    hapusLokal: opsi.hapusLokal,
    lindungi: (a) => bootstrap && a.peran === "ADMIN",
  });
  return { turunan, rencana };
}

export type HasilSatu = {
  penggunaId: string;
  ditambah: number;
  dipromosi: number;
  dihapus: number;
  lokalTakDidukung: PenugasanAda[];
  diabaikan: Diabaikan[];
  statusBaru: StatusPengguna | null;
};

async function terapkan(
  db: Klien,
  p: PenggunaMuat,
  r: Rencana,
  pegawaiAktif: boolean,
  tautkan: string | null,
): Promise<HasilSatu> {
  const { rencana, turunan } = r;
  const jumlahSetelah = p.penugasan.length - rencana.hapus.length + rencana.tambah.length;
  const statusBaru = statusSetelahSinkron(p.status, pegawaiAktif, jumlahSetelah);

  await db.$transaction(async (tx) => {
    // Urutan penting: hapus dulu, lalu promosi, baru tambah — yang tambah tak pernah
    // sama kuncinya dengan yang sudah ada (rekonsiliasi memastikannya), tetapi
    // `skipDuplicates` tetap menjaga balapan dua sinkron serentak.
    if (rencana.hapus.length > 0) await tx.penugasanPeran.deleteMany({ where: { id: { in: rencana.hapus } } });
    if (rencana.promosi.length > 0) {
      await tx.penugasanPeran.updateMany({ where: { id: { in: rencana.promosi } }, data: { sumber: "IDENTITAS" } });
    }
    if (rencana.tambah.length > 0) {
      await tx.penugasanPeran.createMany({
        data: rencana.tambah.map((t) => ({ penggunaId: p.id, peran: t.peran, prodiId: t.prodiId, sumber: "IDENTITAS" as const })),
        skipDuplicates: true,
      });
    }
    await tx.pengguna.update({
      where: { id: p.id },
      data: {
        sinkronPada: new Date(),
        ...(statusBaru ? { status: statusBaru } : {}),
        ...(tautkan ? { identitasAkunId: tautkan } : {}),
      },
    });
  });

  return {
    penggunaId: p.id,
    ditambah: rencana.tambah.length,
    dipromosi: rencana.promosi.length,
    dihapus: rencana.hapus.length,
    lokalTakDidukung: rencana.lokalTakDidukung,
    diabaikan: turunan.diabaikan,
    statusBaru,
  };
}

/**
 * Menyelaraskan peran SATU pengguna dengan fakta dari identitas-itts. Dipakai
 * saat login dan penyegaran malar. `akunId` menautkan baris ke identitas-itts
 * bila belum — kecuali sudah dipakai baris lain (dua surel, satu orang), yang
 * dilewati tanpa menggagalkan sinkron.
 */
export async function sinkronkanFakta(
  db: Klien,
  penggunaId: string,
  fakta: Pick<FaktaPegawai, "aktif" | "jenisPegawai" | "homebaseUnitId" | "peran"> & { akunId: string },
  opsi: OpsiSinkron,
): Promise<HasilSatu | null> {
  const [p, peta] = await Promise.all([
    db.pengguna.findUnique({ where: { id: penggunaId }, select: PILIH_PENGGUNA }),
    muatPetaProdi(db),
  ]);
  if (!p) return null;

  let tautkan: string | null = null;
  if (p.identitasAkunId === null) {
    const dipakai = await db.pengguna.findUnique({ where: { identitasAkunId: fakta.akunId }, select: { id: true } });
    if (!dipakai) tautkan = fakta.akunId;
    else if (dipakai.id !== p.id) return null; // orang yang sama sudah punya baris lain: jangan digandakan
  } else if (p.identitasAkunId !== fakta.akunId) {
    // Baris sudah bertaut ke akun lain: surel yang sama kini menunjuk orang berbeda. Jangan diselaraskan diam-diam.
    return null;
  }

  return terapkan(db, p, rencanakan(p, fakta, peta, opsi), fakta.aktif, tautkan);
}

// ─── Sinkron menyeluruh ────────────────────────────────────────────────────

export type MasukanSemua = {
  peranAplikasi: readonly PeranAplikasi[];
  /** Halaman direktori untuk pegawai AKTIF, sudah digabung. Yang tak tercantum dianggap tak lagi aktif. */
  direktori: readonly BarisDirektori[];
};

export type LaporanSinkron = {
  pegawaiDiproses: number;
  penggunaBaru: number;
  ditautkan: number;
  ditambah: number;
  dipromosi: number;
  dihapus: number;
  statusDiubah: number;
  /** Peran turunan LOKAL yang identitas-itts tak dukung (paling banyak 50 ditampilkan). */
  lokalTakDidukung: { email: string; peran: Peran; prodiId: string | null }[];
  lokalTakDidukungJumlah: number;
  /** Peran yang TIDAK diberikan beserta sebabnya, dikelompokkan. */
  diabaikan: { alasan: string; jumlah: number; unitId?: string }[];
  /** Unit identitas-itts yang perlu dipetakan ke prodi (di /master/prodi). */
  unitTakTerpetakan: string[];
  /** Diisi bila pagar penghapusan massal menolak — dan dalam kasus itu TIDAK ADA yang diubah. */
  ditolak: { alasan: "pagar-penghapusan" | "direktori-kosong"; akanHapus: number; batas: number } | null;
};

const BATAS_DAFTAR_LAPORAN = 50;

function laporanKosong(): LaporanSinkron {
  return {
    pegawaiDiproses: 0,
    penggunaBaru: 0,
    ditautkan: 0,
    ditambah: 0,
    dipromosi: 0,
    dihapus: 0,
    statusDiubah: 0,
    lokalTakDidukung: [],
    lokalTakDidukungJumlah: 0,
    diabaikan: [],
    unitTakTerpetakan: [],
    ditolak: null,
  };
}

type Langkah =
  | { jenis: "ada"; p: PenggunaMuat; r: Rencana; aktif: boolean; tautkan: string | null }
  | { jenis: "baru"; email: string; akunId: string; r: Rencana };

/**
 * Menyelaraskan SEMUA pegawai. Dua tahap: (1) rencana tanpa menulis apa pun;
 * (2) pagar penghapusan massal — bila identitas-itts tampak keliru, berhenti
 * TANPA mengubah satu baris pun; (3) penerapan per orang.
 *
 * Yang dicakup: setiap pegawai AKTIF di direktori (bertaut atau dikenali lewat
 * surel), setiap pengguna yang bertaut tetapi TIDAK lagi ada di direktori aktif
 * (dicabut peran turunannya), dan cangkang `pengguna` baru untuk pegawai yang
 * akan memegang paling sedikit satu peran tetapi belum pernah membuka RPKPS.
 * Pengguna LOKAL (tak bertaut, surel tak ada di direktori) tak tersentuh.
 */
export async function sinkronkanSemuaInti(db: Klien, masukan: MasukanSemua, opsi: OpsiSinkron): Promise<LaporanSinkron> {
  const laporan = laporanKosong();
  const [peta, semuaPengguna] = await Promise.all([
    muatPetaProdi(db),
    db.pengguna.findMany({ select: PILIH_PENGGUNA }),
  ]);

  const tertaut = semuaPengguna.filter((p) => p.identitasAkunId !== null);
  // Direktori kosong padahal ada yang bertaut = hampir pasti kekeliruan (filter salah, penyedia keliru),
  // dan pengolahannya akan mencabut peran SEMUA orang.
  if (masukan.direktori.length === 0 && tertaut.length > 0) {
    laporan.ditolak = { alasan: "direktori-kosong", akanHapus: tertaut.length, batas: 0 };
    return laporan;
  }

  const peranPerAkun = new Map<string, PeranDariIdentitas[]>();
  for (const peran of masukan.peranAplikasi) {
    for (const h of peran.pemegang) {
      if (!h.aktif) continue;
      const daftar = peranPerAkun.get(h.akunId) ?? [];
      daftar.push({ namaPeran: peran.namaPeran, jabatan: peran.jabatan });
      peranPerAkun.set(h.akunId, daftar);
    }
  }

  const faktaPerAkun = new Map<string, FaktaPegawai>();
  for (const b of masukan.direktori) {
    if (!b.aktif) continue;
    faktaPerAkun.set(b.akunId, {
      akunId: b.akunId,
      email: b.email,
      aktif: true,
      jenisPegawai: b.jenisPegawai,
      homebaseUnitId: b.homebaseUnitId,
      peran: peranPerAkun.get(b.akunId) ?? [],
    });
  }

  const perAkun = new Map(tertaut.map((p) => [p.identitasAkunId as string, p]));
  const perSurel = new Map(semuaPengguna.map((p) => [p.email.toLowerCase(), p]));

  // ── Tahap 1: rencana ───────────────────────────────────────────────────
  const langkah: Langkah[] = [];
  const dikenali = new Set<string>();

  for (const fakta of faktaPerAkun.values()) {
    const p = perAkun.get(fakta.akunId) ?? perSurel.get(fakta.email);
    if (p) {
      // Baris bertaut ke akun LAIN: surel sama, orang berbeda. Jangan diselaraskan diam-diam.
      if (p.identitasAkunId !== null && p.identitasAkunId !== fakta.akunId) continue;
      dikenali.add(p.id);
      langkah.push({ jenis: "ada", p, r: rencanakan(p, fakta, peta, opsi), aktif: true, tautkan: p.identitasAkunId === null ? fakta.akunId : null });
    } else {
      const r = rencanakan({ email: fakta.email, penugasan: [] }, fakta, peta, opsi);
      if (r.turunan.penugasan.length > 0) langkah.push({ jenis: "baru", email: fakta.email, akunId: fakta.akunId, r });
      else laporan.diabaikan.push(...r.turunan.diabaikan.map((d) => ({ alasan: d.alasan, jumlah: 1, unitId: d.unitId })));
    }
  }
  for (const p of tertaut) {
    if (dikenali.has(p.id)) continue;
    // Bertaut, tetapi tak lagi ada di direktori aktif → nonaktif/dihapus di identitas-itts.
    const fakta = { aktif: false, jenisPegawai: "", homebaseUnitId: null, peran: [] as PeranDariIdentitas[] };
    langkah.push({ jenis: "ada", p, r: rencanakan(p, fakta, peta, opsi), aktif: false, tautkan: null });
  }

  // ── Tahap 2: pagar ─────────────────────────────────────────────────────
  const akanHapus = langkah.reduce((n, l) => n + (l.jenis === "ada" ? l.r.rencana.hapus.length : 0), 0);
  const turunanAda = tertaut.reduce((n, p) => n + p.penugasan.filter((a) => PERAN_TURUNAN.includes(a.peran)).length, 0);
  const pagar = pagarPenghapusan(turunanAda, akanHapus);
  if (!pagar.ok) {
    laporan.ditolak = { alasan: "pagar-penghapusan", akanHapus, batas: pagar.batas };
    return laporan;
  }

  // ── Tahap 3: penerapan ─────────────────────────────────────────────────
  const diabaikan = new Map<string, { alasan: string; jumlah: number; unitId?: string }>();
  const catatDiabaikan = (daftar: readonly Diabaikan[]) => {
    for (const d of daftar) {
      const kunci = `${d.alasan}|${d.unitId ?? ""}`;
      const e = diabaikan.get(kunci) ?? { alasan: d.alasan, jumlah: 0, unitId: d.unitId };
      e.jumlah++;
      diabaikan.set(kunci, e);
    }
  };
  for (const d of laporan.diabaikan) catatDiabaikan([{ sumber: "", alasan: d.alasan as Diabaikan["alasan"], unitId: d.unitId }]);
  laporan.diabaikan = [];

  for (const l of langkah) {
    laporan.pegawaiDiproses++;
    if (l.jenis === "baru") {
      try {
        await db.$transaction(async (tx) => {
          const p = await tx.pengguna.create({
            data: {
              // Sama dengan `firebaseUidUndangan()` (lib/sesi.ts): uid sementara yang tak pernah keluar dari
              // Firebase, ditautkan pada masuk pertama. Diulang di sini karena sesi.ts memuat `server-only`.
              firebaseUid: `undangan:${randomUUID()}`,
              email: l.email,
              identitasAkunId: l.akunId,
              // `nama` masih NOT NULL sampai kontraksi (docs/26 §7); ini penampung, BUKAN data pegawai —
              // tampilan membaca nama dari identitas-itts.
              nama: l.email.split("@")[0],
              status: "AKTIF",
              sinkronPada: new Date(),
            },
            select: { id: true },
          });
          await tx.penugasanPeran.createMany({
            data: l.r.turunan.penugasan.map((t) => ({ penggunaId: p.id, peran: t.peran, prodiId: t.prodiId, sumber: "IDENTITAS" as const })),
            skipDuplicates: true,
          });
        });
        laporan.penggunaBaru++;
        laporan.ditambah += l.r.turunan.penugasan.length;
      } catch (galat) {
        // Balapan dengan masuk pertama orang yang sama: barisnya baru saja dibuat di tempat lain. Sinkron berikutnya mengurusnya.
        console.error("[sinkron] gagal membuat cangkang pengguna:", galat instanceof Error ? galat.message : galat);
      }
      catatDiabaikan(l.r.turunan.diabaikan);
      continue;
    }

    const hasil = await terapkan(db, l.p, l.r, l.aktif, l.tautkan);
    if (l.tautkan) laporan.ditautkan++;
    laporan.ditambah += hasil.ditambah;
    laporan.dipromosi += hasil.dipromosi;
    laporan.dihapus += hasil.dihapus;
    if (hasil.statusBaru) laporan.statusDiubah++;
    catatDiabaikan(hasil.diabaikan);
    for (const a of hasil.lokalTakDidukung) {
      laporan.lokalTakDidukungJumlah++;
      if (laporan.lokalTakDidukung.length < BATAS_DAFTAR_LAPORAN) {
        laporan.lokalTakDidukung.push({ email: l.p.email, peran: a.peran, prodiId: a.prodiId });
      }
    }
  }

  laporan.diabaikan = [...diabaikan.values()].sort((a, b) => b.jumlah - a.jumlah);
  laporan.unitTakTerpetakan = [...new Set(laporan.diabaikan.flatMap((d) => (d.unitId ? [d.unitId] : [])))].sort();
  return laporan;
}
