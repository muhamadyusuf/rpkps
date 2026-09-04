import "server-only";
import type { Bahasa } from "@/kamus";
import { prisma } from "@/lib/prisma";
import { muatRpkps, type RpkpsLengkap } from "@/lib/rpkps/muat";
import { ambilSnapshot, cairkanSnapshot, type IsiSnapshot } from "@/lib/rpkps/snapshot";
import { buatDokumenRpkps } from "@/lib/dokumen/rpkps-docx";

/**
 * Menyusun berkas DOCX satu RPKPS beserta nama berkasnya.
 *
 * Dipakai dua rute dengan gerbang yang berbeda — yang butuh sesi dan yang
 * terbuka untuk umum — sehingga aturan "dokumen terbit dicetak dari salinan
 * beku" hanya ditulis sekali. OTORISASI BUKAN URUSAN FUNGSI INI; pemanggil
 * yang memutuskan siapa boleh mengunduh apa.
 */

export type BerkasRpkps = {
  buffer: Buffer;
  namaBerkas: string;
  /** Sidik salinan beku; null berarti yang dicetak adalah draf. */
  sidik: string | null;
};

export async function siapkanUnduhanRpkps(
  id: string,
  opsi: {
    /** Menolak mencetak apa pun yang belum disahkan. Dipakai rute publik. */
    hanyaTerbit?: boolean;
    /**
     * Bahasa berkas. Bawaannya Indonesia — naskah yang sah dan yang
     * ditandatangani (docs/11 §7).
     */
    bahasa?: Bahasa;
  } = {},
): Promise<BerkasRpkps | null> {
  const bahasa = opsi.bahasa ?? "id";
  const rpkps = await muatRpkps(id);
  if (!rpkps) return null;
  if (opsi.hanyaTerbit && rpkps.status !== "TERBIT") return null;

  // Dokumen yang sudah terbit selalu dicetak dari salinan beku, bukan dari
  // data langsung. Kalau kurikulum disunting setelah pengesahan, berkas yang
  // diunduh tetap identik dengan yang ditandatangani.
  const snapshot =
    rpkps.status === "TERBIT" ? await ambilSnapshot(id, rpkps.versi) : null;
  if (opsi.hanyaTerbit && !snapshot) return null;

  let sumber = rpkps;
  let sumberEn: RpkpsLengkap | null = null;
  let riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
  let sidik: string | null = null;

  if (snapshot) {
    const beku = cairkanSnapshot<RpkpsLengkap>(snapshot.isi as unknown as IsiSnapshot);
    sumber = beku.rpkps;
    riwayat = beku.riwayat;
    /**
     * Berkas Inggris mencetak sidik ruang KEDUA, bukan sidik dokumen
     * Indonesia. Mencetak sidik Indonesia pada berkas berbahasa Inggris akan
     * membuat orang membandingkan dua isi yang berbeda dan menyimpulkan
     * dokumennya sudah bergeser.
     */
    sidik = bahasa === "en" ? (snapshot.sidikEn ?? snapshot.sidik) : snapshot.sidik;

    if (bahasa === "en" && snapshot.isiEn) {
      // Salinan beku Inggris memuat proyeksi, bukan bentuk RpkpsLengkap —
      // cukup untuk seluruh bagian yang dicetak.
      sumberEn = snapshot.isiEn as unknown as RpkpsLengkap;
    }
  } else {
    riwayat = await prisma.rpkpsRiwayat.findMany({
      where: { rpkpsId: id },
      orderBy: { dibuatPada: "asc" },
      select: { versi: true, dibuatPada: true, deskripsi: true },
    });
  }

  /**
   * Tanda tangan ronde yang dicetak, dibaca dari tabelnya sendiri — bukan dari
   * salinan beku. Barisnya memang tidak pernah berubah (nama dan identitas
   * dibekukan saat menandatangani), jadi membekukannya untuk kedua kalinya
   * hanya menambah satu tempat lagi yang harus tetap sejalan. Dan ia TIDAK
   * boleh masuk `proyeksiIsi`: menambah apa pun ke sana menggeser sidik
   * seluruh dokumen terbit.
   */
  const ttd = await prisma.tandaTanganRpkps.findMany({
    where: { rpkpsId: id, versi: rpkps.versi },
    orderBy: { ditandatanganiPada: "asc" },
    select: {
      peran: true,
      penggunaId: true,
      nama: true,
      identitas: true,
      sidik: true,
      ditandatanganiPada: true,
    },
  });

  const buffer = await buatDokumenRpkps(sumberEn ?? sumber, riwayat, ttd, sidik, bahasa);
  const namaBerkas =
    `RPKPS ${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama} - ${rpkps.tahunAkademik.kode}${sidik ? " (terbit)" : " (draf)"}.docx`.replace(
      /[/\\?%*:|"<>]/g,
      "-",
    );

  return { buffer, namaBerkas, sidik };
}
