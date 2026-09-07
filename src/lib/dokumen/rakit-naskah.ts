import "server-only";
import type { Bahasa } from "@/kamus";
import { prisma } from "@/lib/prisma";
import { muatRpkps, type RpkpsLengkap } from "@/lib/rpkps/muat";
import { ambilSnapshot, cairkanSnapshot, type IsiSnapshot } from "@/lib/rpkps/snapshot";
import { naskahEn } from "@/lib/dokumen/naskah-en";
import type { CapTandaTangan } from "@/lib/dokumen/rpkps-docx";

/**
 * Merakit satu naskah RPKPS yang siap dicetak — dan siap dipratinjau.
 *
 * Berdiri sendiri, terpisah dari `siapkan-unduhan.ts`, karena punya DUA
 * pembaca dengan kebutuhan berbeda: penyusun DOCX, dan halaman pratinjau di
 * dalam aplikasi. Pratinjau menjanjikan "beginilah nanti hasil unduhannya",
 * dan janji itu hanya dapat ditepati bila keduanya membaca sumber yang sama —
 * salinan beku yang sama, tanda tangan yang sama, sidik yang sama, dan
 * pemilihan bahasa yang sama. Merakitnya dua kali membuat keduanya menyimpang
 * pelan-pelan tanpa satu galat pun.
 *
 * Berkas ini sengaja TIDAK menyentuh `docx`: mengimpornya dari sebuah halaman
 * akan menarik seluruh penyusun dokumen ke dalam berkas halaman itu, padahal
 * yang dibutuhkannya hanya datanya.
 *
 * OTORISASI BUKAN URUSAN BERKAS INI; pemanggil yang memutuskan siapa boleh
 * melihat apa.
 */

export interface NaskahSiap {
  /**
   * Isi dokumen dalam bahasa yang diminta, bentuk `RpkpsLengkap`. Dokumen
   * TERBIT datang dari salinan beku; selebihnya dari data langsung.
   */
  naskah: RpkpsLengkap;
  riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
  ttd: CapTandaTangan[];
  /** Sidik salinan beku; `null` berarti yang dirakit adalah draf. */
  sidik: string | null;
  namaBerkas: string;
}

export async function rakitNaskahRpkps(
  id: string,
  opsi: { bahasa?: Bahasa } = {},
): Promise<NaskahSiap | null> {
  const rpkps = await muatRpkps(id);
  if (!rpkps) return null;
  return rakitDariRpkps(rpkps, opsi);
}

/**
 * Perakitan atas RPKPS yang SUDAH dimuat.
 *
 * Halaman pratinjau memuatnya lebih dulu untuk memutuskan wewenang dan
 * menyusun kepala halaman; memuatnya sekali lagi di sini berarti satu
 * perjalanan penuh ke basis data yang jauh untuk baris yang sudah di tangan.
 */
export async function rakitDariRpkps(
  rpkps: RpkpsLengkap,
  opsi: { bahasa?: Bahasa } = {},
): Promise<NaskahSiap> {
  const bahasa = opsi.bahasa ?? "id";

  // Dokumen yang sudah terbit selalu dicetak dari salinan beku, bukan dari
  // data langsung. Kalau kurikulum disunting setelah pengesahan, yang tampil
  // dan yang terunduh tetap identik dengan yang ditandatangani.
  const snapshot =
    rpkps.status === "TERBIT" ? await ambilSnapshot(rpkps.id, rpkps.versi) : null;

  let sumber = rpkps;
  let riwayat: NaskahSiap["riwayat"];
  let sidik: string | null = null;

  if (snapshot) {
    const beku = cairkanSnapshot<RpkpsLengkap>(snapshot.isi as unknown as IsiSnapshot);
    sumber = beku.rpkps;
    riwayat = beku.riwayat;
    /**
     * Naskah Inggris menyebut sidik ruang KEDUA, bukan sidik dokumen
     * Indonesia. Mencetak sidik Indonesia pada naskah berbahasa Inggris
     * membuat orang membandingkan dua isi yang berbeda dan menyimpulkan
     * dokumennya sudah bergeser (docs/11 §7).
     */
    sidik = bahasa === "en" ? (snapshot.sidikEn ?? snapshot.sidik) : snapshot.sidik;
  } else {
    riwayat = await prisma.rpkpsRiwayat.findMany({
      where: { rpkpsId: rpkps.id },
      orderBy: { dibuatPada: "asc" },
      select: { versi: true, dibuatPada: true, deskripsi: true },
    });
  }

  /**
   * Tanda tangan ronde yang dicetak, dari data LANGSUNG — bukan dari salinan
   * beku. Barisnya memang tidak pernah berubah (nama dan identitas dibekukan
   * saat menandatangani), jadi membekukannya untuk kedua kalinya hanya
   * menambah satu tempat lagi yang harus tetap sejalan. Dan ia TIDAK boleh
   * masuk `proyeksiIsi`: menambah apa pun ke sana menggeser sidik seluruh
   * dokumen terbit.
   *
   * Disaring dari baris yang SUDAH dimuat, bukan dikueri lagi: `muatRpkps`
   * membawa seluruh ronde, terurut `[versi desc, ditandatanganiPada asc]`,
   * jadi menyaring satu ronde di memori menghasilkan urutan yang sama persis
   * dengan kueri terpisah — sambil menghemat satu perjalanan ke basis data
   * yang jauh pada tiap render panel pratinjau.
   */
  const ttd = rpkps.tandaTangan.filter((t) => t.versi === rpkps.versi);

  /**
   * Naskah Inggris dirakit dari kolom `*En` sumber yang sama — bukan dari
   * `rpkps_snapshot.isi_en`.
   *
   * Godaannya masuk akal: salinan beku Inggris SUDAH ada, dan tinggal dipakai.
   * Tetapi bentuknya bukan `RpkpsLengkap` melainkan keluaran `proyeksiIsiEn` —
   * `tahunAkademik` di sana string, `pengampu[].pengguna` tidak ada, `cpl`
   * naik ke akar — sehingga melewatkannya ke pencetak membuat setiap unduhan
   * Inggris atas dokumen TERBIT gagal pada pembacaan pertama. Dan tidak ada
   * yang hilang dengan merakitnya di sini: untuk dokumen terbit `sumber`
   * adalah salinan beku itu sendiri, yang membawa seluruh kolom `*En`
   * sebagaimana dibekukan.
   */
  const naskah = bahasa === "en" ? naskahEn(sumber) : sumber;

  const namaBerkas =
    `RPKPS ${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama} - ${rpkps.tahunAkademik.kode}${sidik ? " (terbit)" : " (draf)"}.docx`.replace(
      /[/\\?%*:|"<>]/g,
      "-",
    );

  return { naskah, riwayat, ttd, sidik, namaBerkas };
}
