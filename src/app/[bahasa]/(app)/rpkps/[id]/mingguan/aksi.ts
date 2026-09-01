"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { prisma } from "@/lib/prisma";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import { kamusAksi } from "@/lib/bahasa/server";
import {
  barisMingguan,
  jumlahNilaiPerKode,
  susunUlangKerangkaDb,
  terapkanStruktur,
} from "@/lib/rpkps/struktur";
import { isi } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";
import {
  hitungDampakStruktur,
  kodeMenganggur,
  periksaKelayakanUbahStruktur,
  susunRencanaStruktur,
  type DampakStruktur,
  type Operasi,
} from "@/domain/rpkps/rencana-mingguan";

/**
 * Aksi struktur tabel mingguan — tahap M2 pada docs/09.
 *
 * Terpisah dari `../../aksi.ts` yang menangani ISI satu baris: yang di sini
 * mengubah HIMPUNAN barisnya. Berkas ini hanya lapisan wewenang, jejak audit,
 * dan penyegaran halaman; mekanismenya ada di `@/lib/rpkps/struktur` supaya
 * dapat diuji terhadap basis data sungguhan tanpa sesi.
 */

export type Hasil = { ok: boolean; pesan: string; minggu?: number };

/** Wewenang + syarat status. Dipakai setiap aksi di berkas ini. */
async function siapkan(rpkpsId: string) {
  const { sesi, boleh, status } = await wenangRpkps(rpkpsId);
  if (!boleh) return { galat: (await kamusAksi()).aksi.wenang.ubahRpkps, sesi };

  const kelayakan = periksaKelayakanUbahStruktur({ status: status ?? "" });
  if (!kelayakan.boleh) return { galat: kelayakan.alasan.join(" "), sesi };

  return { galat: null, sesi };
}

async function jalankan(
  rpkpsId: string,
  op: Operasi,
  ringkasanAudit: (email: string, nomorBaru: number | null) => string,
  pesanBerhasil: (kam: Kamus, nomorBaru: number | null) => string,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const siap = await siapkan(rpkpsId);
  if (siap.galat) return { ok: false, pesan: siap.galat };

  const hasil = await terapkanStruktur(prisma, rpkpsId, op);
  if (!hasil.ok) return { ok: false, pesan: hasil.pesan };

  await prisma.logAudit.create({
    data: {
      penggunaId: siap.sesi.id,
      aksi: "PERTEMUAN_STRUKTUR",
      entitas: "rpkps",
      entitasId: rpkpsId,
      ringkasan: ringkasanAudit(siap.sesi.email, hasil.nomorBaru),
    },
  });

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan(`/rpkps/${rpkpsId}/mingguan`);
  return {
    ok: true,
    pesan: pesanBerhasil(kam, hasil.nomorBaru),
    minggu: hasil.nomorBaru ?? undefined,
  };
}

export async function tambahPertemuan(rpkpsId: string): Promise<Hasil> {
  return jalankan(
    rpkpsId,
    { jenis: "TAMBAH" },
    (email, nomor) => `${email} menambah pertemuan minggu ${nomor}`,
    (kam, nomor) => isi(kam.aksi.mingguan.ditambahkan, { n: nomor ?? "" }),
  );
}

export async function sisipPertemuan(
  rpkpsId: string,
  setelah: number,
): Promise<Hasil> {
  return jalankan(
    rpkpsId,
    { jenis: "SISIP", setelah },
    (email, nomor) => `${email} menyisipkan pertemuan pada minggu ${nomor}`,
    (kam, nomor) => isi(kam.aksi.mingguan.disisipkan, { n: nomor ?? "" }),
  );
}

export async function hapusPertemuan(
  rpkpsId: string,
  minggu: number,
): Promise<Hasil> {
  return jalankan(
    rpkpsId,
    { jenis: "HAPUS", minggu },
    (email) => `${email} menghapus pertemuan minggu ${minggu}`,
    (kam) => isi(kam.aksi.mingguan.dihapus, { n: minggu }),
  );
}

export async function geserPertemuan(
  rpkpsId: string,
  minggu: number,
  arah: "NAIK" | "TURUN",
): Promise<Hasil> {
  return jalankan(
    rpkpsId,
    { jenis: "GESER", minggu, arah },
    (email) => `${email} menggeser pertemuan minggu ${minggu} ke ${arah.toLowerCase()}`,
    (kam) => kam.aksi.lain.urutanDiperbarui,
  );
}

export async function ubahJenisPertemuan(
  rpkpsId: string,
  minggu: number,
  ke: "EFEKTIF" | "UTS" | "UAS",
): Promise<Hasil> {
  return jalankan(
    rpkpsId,
    { jenis: "UBAH_JENIS", minggu, ke },
    (email) => `${email} menandai minggu ${minggu} sebagai ${ke}`,
    (kam) => isi(kam.aksi.mingguan.jenisDiubah, { n: minggu, jenis: ke }),
  );
}

export async function susunUlangKerangka(rpkpsId: string): Promise<Hasil> {
  const siap = await siapkan(rpkpsId);
  if (siap.galat) return { ok: false, pesan: siap.galat };

  const hasil = await susunUlangKerangkaDb(prisma, rpkpsId);
  if (!hasil.ok) return { ok: false, pesan: hasil.pesan };

  await prisma.logAudit.create({
    data: {
      penggunaId: siap.sesi.id,
      aksi: "PERTEMUAN_STRUKTUR",
      entitas: "rpkps",
      entitasId: rpkpsId,
      ringkasan: `${siap.sesi.email} menyusun ulang kerangka mingguan (${hasil.jumlah} pertemuan)`,
    },
  });

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan(`/rpkps/${rpkpsId}/mingguan`);
  return { ok: true, pesan: hasil.pesan };
}

/**
 * Dampak sebuah operasi terhadap nilai mahasiswa, dihitung SEBELUM dijalankan.
 *
 * Dipanggil dialog konfirmasi. Struktur boleh diubah walau nilai sudah masuk
 * (docs/09 §K4), tetapi tidak boleh diubah tanpa dosen tahu berapa banyak yang
 * ikut bergerak dan berapa yang akan menganggur.
 */
export async function dampakOperasi(
  rpkpsId: string,
  op: Operasi,
): Promise<DampakStruktur & { galat: string | null }> {
  const kosong = {
    berpindah: [],
    menganggur: [],
    totalBerpindah: 0,
    totalMenganggur: 0,
  };

  const siap = await siapkan(rpkpsId);
  if (siap.galat) return { ...kosong, galat: siap.galat };

  const sebelum = await barisMingguan(prisma, rpkpsId);
  const rencana = susunRencanaStruktur(sebelum, op);
  if (rencana.galat) return { ...kosong, galat: rencana.galat };

  const nilai = await jumlahNilaiPerKode(prisma, rpkpsId);
  return {
    ...hitungDampakStruktur(sebelum, rencana.sesudah, nilai),
    galat: null,
  };
}

/**
 * Apa yang akan hilang bila kerangka disusun ulang. Baris pengganti berbobot
 * nol, jadi TIDAK ADA kode asesmen yang bertahan — seluruh nilai yang sudah
 * masuk akan menganggur sampai bobotnya diisi kembali.
 */
export async function dampakSusunUlang(rpkpsId: string): Promise<{
  galat: string | null;
  jumlahPertemuan: number;
  menganggur: { kode: string; jumlah: number }[];
  totalMenganggur: number;
}> {
  const kosong = { jumlahPertemuan: 0, menganggur: [], totalMenganggur: 0 };

  const siap = await siapkan(rpkpsId);
  if (siap.galat) return { ...kosong, galat: siap.galat };

  const sebelum = await barisMingguan(prisma, rpkpsId);
  const nilai = await jumlahNilaiPerKode(prisma, rpkpsId);
  const menganggur = kodeMenganggur(sebelum, [])
    .map((kode) => ({ kode, jumlah: nilai[kode] ?? 0 }))
    .filter((m) => m.jumlah > 0);

  return {
    galat: null,
    jumlahPertemuan: sebelum.length,
    menganggur,
    totalMenganggur: menganggur.reduce((s, m) => s + m.jumlah, 0),
  };
}
