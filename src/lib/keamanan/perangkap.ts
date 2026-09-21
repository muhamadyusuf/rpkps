import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { lajuCatatPerangkap } from "@/lib/keamanan/laju";
import { cariLokasiIp } from "@/lib/keamanan/lokasi-ip";
import type { LokasiIp } from "@/domain/keamanan/lokasi-ip";
import type { RingkasanKiriman } from "@/domain/keamanan/perangkap";

/**
 * Menulis temuan perangkap (docs/22).
 *
 * Dipanggil dari `after()` — dosen atau pemindai tidak menunggu basis data yang
 * jauh. Tiga penjaga menjaga tabel ini tidak menjadi sasaran serangan baru:
 *
 * 1. Batas tulis per IP (60/menit). Pemindai yang menyapu ribuan alamat tidak
 *    boleh mengubah perangkap menjadi pengisi basis data.
 * 2. Lipat: (ip, jalur, metode) yang sama dalam 30 menit menaikkan `jumlah`,
 *    bukan menambah baris.
 * 3. Semua teks dipotong. Nilainya datang dari penyerang.
 */

const JENDELA_LIPAT_MS = 30 * 60_000;

export type TemuanMasuk = {
  ip: string;
  rantaiIp: string | null;
  jenis: string;
  jalur: string;
  metode: string;
  kueri: string | null;
  userAgent: string | null;
  bahasaPeramban: string | null;
  rujukan: string | null;
  sidikPerangkat: string;
  header: Record<string, string>;
  kiriman: RingkasanKiriman | null;
  /** Lokasi dari kepala platform, bila ada; menghemat panggilan keluar. */
  lokasiKepala: LokasiIp | null;
};

const potong = (v: string | null, n: number) => (v ? v.slice(0, n) : null);

function kolomLokasi(l: LokasiIp | null) {
  if (!l) return {};
  return {
    negara: l.negara,
    kodeNegara: l.kodeNegara,
    wilayah: l.wilayah,
    kota: l.kota,
    lintang: l.lintang,
    bujur: l.bujur,
    zonaWaktu: l.zonaWaktu,
    penyedia: l.penyedia,
    asn: l.asn,
    sumberLokasi: l.sumber,
  };
}

export async function catatTemuan(t: TemuanMasuk): Promise<void> {
  try {
    if (!lajuCatatPerangkap.coba(t.ip).boleh) return;

    const sekarang = new Date();
    const ada = await prisma.perangkapTemuan.findFirst({
      where: {
        ip: t.ip,
        jalur: t.jalur,
        metode: t.metode,
        terakhirPada: { gte: new Date(sekarang.getTime() - JENDELA_LIPAT_MS) },
      },
      select: { id: true },
    });
    if (ada) {
      await prisma.perangkapTemuan.update({
        where: { id: ada.id },
        data: { jumlah: { increment: 1 }, terakhirPada: sekarang },
      });
      return;
    }

    // IP yang sudah pernah dilokasikan tidak ditanyakan lagi.
    const pernah = await prisma.perangkapTemuan.findFirst({
      where: { ip: t.ip, sumberLokasi: { not: null } },
      orderBy: { terakhirPada: "desc" },
      select: {
        negara: true, kodeNegara: true, wilayah: true, kota: true, lintang: true,
        bujur: true, zonaWaktu: true, penyedia: true, asn: true, sumberLokasi: true,
      },
    });

    const baru = await prisma.perangkapTemuan.create({
      data: {
        ip: t.ip,
        rantaiIp: t.rantaiIp,
        jenis: t.jenis,
        jalur: t.jalur.slice(0, 300),
        metode: t.metode.slice(0, 12),
        kueri: potong(t.kueri, 500),
        userAgent: potong(t.userAgent, 400),
        bahasaPeramban: potong(t.bahasaPeramban, 100),
        rujukan: potong(t.rujukan, 300),
        sidikPerangkat: t.sidikPerangkat,
        header: t.header,
        kiriman: t.kiriman ? (t.kiriman as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        ...(pernah ?? kolomLokasi(t.lokasiKepala)),
      },
      select: { id: true, sumberLokasi: true, lintang: true },
    });

    // Kepala platform hanya memberi kota; layanan IP melengkapi penyedia/ASN.
    if (baru.sumberLokasi === null || baru.sumberLokasi === "VERCEL") {
      const lokasi = await cariLokasiIp(t.ip);
      if (lokasi) {
        await prisma.perangkapTemuan.update({ where: { id: baru.id }, data: kolomLokasi(lokasi) });
      }
    }
  } catch (galat) {
    // Perangkap yang gagal mencatat tidak boleh mengubah apa yang dilihat
    // pemindai — jawabannya sudah terkirim.
    console.error("[perangkap] gagal mencatat temuan:", galat instanceof Error ? galat.message : galat);
  }
}
