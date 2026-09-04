import "server-only";
import { prisma } from "@/lib/prisma";
import { kamusUntuk } from "@/kamus";
import { teksNotifikasi, bacaData } from "@/lib/bahasa/notifikasi";
import { isi as sisip } from "@/lib/bahasa/teks";
import { urlSitus } from "@/lib/publik/tautan";
import {
  bolehDisurel,
  jadwalUlang,
  putusanSurel,
  ringkasGalat,
  MAKS_PERCOBAAN_SUREL,
} from "@/domain/notifikasi/surel";
import { kanalSurelMenyala, kirimSurel, rahasiaSmtp } from "./pengirim";

/**
 * Kuras antrian surel — docs/10 §2.5 (tahap N5).
 *
 * Dipanggil penjadwal, bukan oleh permintaan pengguna: mengirim surel di dalam
 * jalur aksi berarti dosen menunggu jabat tangan SMTP sebelum tombolnya
 * merespons, dan satu gangguan pada penyedia surel menggagalkan pengajuan
 * RPKPS yang sebenarnya sudah tersimpan.
 *
 * Tiga hal yang dijaga di sini, ketiganya sudah pernah menjadi bencana di
 * aplikasi lain:
 *
 *  1. **Satu baris gagal tidak menghentikan sisanya.** Tiap surel punya
 *     `try/catch`-nya sendiri.
 *  2. **Tidak ada percobaan tak terbatas.** Lima kali dengan jeda menaik, lalu
 *     `GAGAL` — notifikasi dalam aplikasinya tetap ada.
 *  3. **Kalimatnya dirakit saat DIKIRIM**, dalam bahasa penerimanya. Sebuah
 *     notifikasi ditulis sekali dan dikirim beberapa menit kemudian; bahasa
 *     yang berlaku adalah bahasa PEMBACA, bukan bahasa pelakunya (docs/11 §4.2).
 */

export interface HasilKuras {
  diperiksa: number;
  terkirim: number;
  gagal: number;
  dilewati: number;
  /** Kanal mati: env SMTP belum lengkap. Bukan galat, dan bukan pekerjaan. */
  kanalMati?: true;
}

/** Batas satu putaran. Menjaga rute kuras tetap selesai dalam satu permintaan. */
const BATAS_SEKALI_KURAS = 50;

export async function kurasAntrianSurel(batas = BATAS_SEKALI_KURAS): Promise<HasilKuras> {
  const hasil: HasilKuras = { diperiksa: 0, terkirim: 0, gagal: 0, dilewati: 0 };
  if (!kanalSurelMenyala()) return { ...hasil, kanalMati: true };

  const sekarang = new Date();
  const antre = await prisma.notifikasi.findMany({
    where: {
      surelStatus: "MENUNGGU",
      OR: [{ surelKirimSetelah: null }, { surelKirimSetelah: { lte: sekarang } }],
    },
    // Yang paling lama menunggu lebih dulu: antrian surel yang mendahulukan
    // yang terbaru berarti kabar tertua tidak pernah terkirim sama sekali.
    orderBy: { dibuatPada: "asc" },
    take: batas,
    select: {
      id: true,
      data: true,
      judul: true,
      ringkasan: true,
      tautan: true,
      surelStatus: true,
      surelPercobaan: true,
      surelKirimSetelah: true,
      pengguna: {
        select: {
          nama: true,
          email: true,
          status: true,
          bahasa: true,
          surelNotifikasi: true,
        },
      },
    },
  });

  const rahasia = rahasiaSmtp();

  for (const baris of antre) {
    hasil.diperiksa += 1;

    const putusan = putusanSurel(
      {
        status: baris.surelStatus,
        percobaan: baris.surelPercobaan,
        kirimSetelah: baris.surelKirimSetelah,
      },
      sekarang,
    );
    if (putusan === "TUNGGU" || putusan === "SELESAI") continue;
    if (putusan === "MENYERAH") {
      await tandai(baris.id, { surelStatus: "GAGAL" });
      hasil.gagal += 1;
      continue;
    }

    /*
     * Diperiksa ULANG di sini, bukan hanya saat menulis: antara peristiwa dan
     * pengirimannya orang boleh mematikan surelnya atau dinonaktifkan, dan
     * antrian yang tidak menengok lagi akan tetap mengirimnya.
     */
    if (
      !bolehDisurel({
        kanalMenyala: true,
        surelNotifikasi: baris.pengguna.surelNotifikasi,
        email: baris.pengguna.email,
        statusAkun: baris.pengguna.status,
      })
    ) {
      await tandai(baris.id, { surelStatus: "DILEWATI" });
      hasil.dilewati += 1;
      continue;
    }

    const kam = kamusUntuk(baris.pengguna.bahasa);
    const teks = teksNotifikasi(
      bacaData(baris.data),
      { judul: baris.judul, ringkasan: baris.ringkasan },
      kam,
    );
    const tautan = `${urlSitus()}/${baris.pengguna.bahasa}${baris.tautan ?? "/dashboard"}`;

    const badan = [
      sisip(kam.surel.salam, { nama: baris.pengguna.nama }),
      "",
      teks.ringkasan,
      "",
      sisip(kam.surel.buka, { tautan }),
      "",
      "—",
      sisip(kam.surel.hentikan, {
        pengaturan: `${urlSitus()}/${baris.pengguna.bahasa}/notifikasi`,
      }),
      kam.surel.kaki,
    ].join("\n");

    try {
      await kirimSurel({ ke: baris.pengguna.email, subjek: teks.judul, teks: badan });
      await tandai(baris.id, {
        surelStatus: "TERKIRIM",
        surelTerkirimPada: new Date(),
        surelPercobaan: baris.surelPercobaan + 1,
        surelGalat: null,
      });
      hasil.terkirim += 1;
    } catch (galat) {
      const percobaan = baris.surelPercobaan + 1;
      const habis = percobaan >= MAKS_PERCOBAAN_SUREL;
      await tandai(baris.id, {
        surelStatus: habis ? "GAGAL" : "MENUNGGU",
        surelPercobaan: percobaan,
        surelKirimSetelah: habis ? null : jadwalUlang(percobaan, new Date()),
        surelGalat: ringkasGalat(
          galat instanceof Error ? galat.message : String(galat),
          rahasia,
        ),
      });
      if (habis) hasil.gagal += 1;
      // Sengaja tanpa `console.error` beserta pesannya: pesan SMTP kadang
      // memuat nama akun pengirim, dan log aplikasi dibaca lebih banyak orang
      // daripada yang berhak mengetahuinya. Yang tersimpan sudah disamarkan.
      console.error(`[surel] gagal mengirim notifikasi ${baris.id} (percobaan ${percobaan})`);
    }
  }

  return hasil;
}

type Tanda = Parameters<typeof prisma.notifikasi.update>[0]["data"];

/** Penandaan tidak boleh menggagalkan putaran: ia hanya pembukuan. */
async function tandai(id: string, data: Tanda): Promise<void> {
  try {
    await prisma.notifikasi.update({ where: { id }, data });
  } catch (galat) {
    console.error("[surel] gagal menandai antrian:", galat);
  }
}
