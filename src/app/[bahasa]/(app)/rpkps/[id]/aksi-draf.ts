"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { prisma } from "@/lib/prisma";
import { bolehSuntingIsi, pesanTerkunci, wenangRpkps } from "@/lib/rpkps/wenang";
import { GalatAi } from "@/lib/ai/galat";
import { susunDraf } from "@/lib/ai/draf-rpkps";
import { bersihkanArahan } from "@/domain/rpkps/arahan";
import {
  periksaDraf,
  type DrafRpkps,
  type KonteksDraf,
  type TemuanDraf,
} from "@/domain/rpkps/draf";
import type { Prisma } from "@/generated/prisma";
import { konteksDomain, muatKonteks } from "@/lib/rpkps/konteks-draf";
import { pesanGagalTulis } from "@/lib/rpkps/pesan-tulis";
import {
  refPustaka,
  ringkasTulis,
  selesaikanRujukan,
  tulisDraf,
} from "@/lib/rpkps/tulis-draf";
import { kamusAksi } from "@/lib/bahasa/server";
import { isi as sisip } from "@/lib/bahasa/teks";
import { riwayat } from "@/domain/rpkps/riwayat";
import { barisRiwayat } from "@/lib/rpkps/riwayat";

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

  const k = await muatKonteks(prisma, rpkpsId);
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
 * Menyusun draf isi RPKPS dengan AI. Tidak menyentuh isi dokumen.
 *
 * Satu-satunya yang ditulisnya adalah `arahanAi` — catatan kerja penyusunan,
 * bukan isi RPKPS, dan karena itu tidak pernah masuk `proyeksiIsi()` maupun
 * salinan beku (docs/20 §2.5). Draf sendiri tidak disimpan sama sekali sampai
 * dosen menyetujuinya lewat `terapkanDrafRpkps`.
 *
 * Persetujuan dosen berupa satu tombol untuk seluruh dokumen, jadi draf yang
 * melanggar invarian dikembalikan beserta temuannya dan tidak dapat diterapkan.
 */
export async function susunDrafRpkps(
  rpkpsId: string,
  /** Arahan bebas dosen (docs/20). Kiriman peramban — dibersihkan di sini. */
  arahanMentah?: string | null,
  /** Kunci AI yang dipilih dosen; kosong berarti kunci bawaannya. */
  kredensialId?: string | null,
): Promise<HasilDraf> {
  const kam = await kamusAksi();
  const { boleh, dapatDisunting, status, sesi } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.atasRpkps };
  if (!dapatDisunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const k = await muatKonteks(prisma, rpkpsId);
  if (!k) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  // Disimpan SEBELUM model dipanggil, dan hanya di sini: yang tersimpan selalu
  // arahan yang benar-benar dipakai menyusun draf terakhir, bukan yang sempat
  // diketik lalu dibatalkan. Await-nya memang menunggu pemeriksaan wewenang
  // dan keberadaan RPKPS di atas, jadi ia tidak dapat digabungkan ke
  // Promise.all mana pun — dan 25 ms itu tidak berarti apa-apa di depan
  // panggilan model yang berdurasi puluhan detik.
  const { arahan } = bersihkanArahan(arahanMentah);
  await prisma.rpkps.update({ where: { id: rpkpsId }, data: { arahanAi: arahan } });

  const mulai = Date.now();
  try {
    const { draf, penyedia, model, catatan } = await susunDraf({
      penggunaId: sesi.id,
      rpkpsId,
      kredensialId,
      arahan,
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

  const k = await muatKonteks(prisma, rpkpsId);
  if (!k) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const temuan = periksaDraf(konteksDomain(k), draf);
  if (temuan.length > 0) {
    return { ok: false, pesan: sisip(kam.aksi.ai.drafMelanggar, { jumlah: temuan.length }) };
  }

  // Id diselesaikan LEBIH DULU, di luar transaksi, dan setiap yang meleset
  // dikumpulkan (lihat `selesaikanRujukan`).
  const { hilang, rencana } = selesaikanRujukan(
    k.pertemuan,
    k.mataKuliah.cpmk.flatMap((c) => c.subCpmk),
    draf,
  );
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
      // Penulisannya SATU pintu dengan impor template (docs/23): lihat
      // `src/lib/rpkps/tulis-draf.ts`.
      await tulisDraf(tx, rpkpsId, draf, rencana, "AI");

      const ringkas = ringkasTulis(draf);

      await tx.rpkpsRiwayat.create({
        data: {
          rpkpsId,
          versi: 1,
          status: "DRAF",
          ...barisRiwayat(riwayat("DRAF_AI_DITERAPKAN", { oleh: sesi.email, ringkas })),
          olehId: sesi.id,
        },
      });
      // Arahan dibaca dari basis data, TIDAK diterima dari klien: jejak audit
      // yang isinya ditentukan peramban bukan jejak audit. Ia sengaja tidak
      // ikut ke rpkps_riwayat — baris riwayat dirakit dari { kunci, params }
      // dan dibaca berbulan-bulan kemudian dalam bahasa pembacanya, bukan
      // tempat bagi paragraf bebas milik satu dosen (docs/20 AD5).
      await tx.logAudit.create({
        data: {
          penggunaId: sesi.id,
          aksi: "RPKPS_DRAF_AI_DITERAPKAN",
          entitas: "rpkps",
          entitasId: rpkpsId,
          ringkasan:
            `${sesi.email} menyetujui draf AI — ${ringkas}` +
            (k.arahanAi ? " · dengan arahan dosen" : ""),
          data: { arahan: k.arahanAi },
        },
      });
    }, { timeout: 60_000, maxWait: 15_000 });
  } catch (galat) {
    console.error("[rpkps] gagal menerapkan draf:", galat);
    return { ok: false, pesan: pesanGagalTulis(galat, kam) };
  }

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan(`/rpkps/${rpkpsId}/mingguan`);
  segarkan(`/rpkps/${rpkpsId}/tugas`);
  segarkan(`/rpkps/${rpkpsId}/kisi-kisi`);
  return { ok: true, pesan: kam.aksi.ai.drafDiterapkan };
}
