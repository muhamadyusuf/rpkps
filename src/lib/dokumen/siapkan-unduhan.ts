import "server-only";
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
  /** Menolak mencetak apa pun yang belum disahkan. Dipakai rute publik. */
  opsi: { hanyaTerbit?: boolean } = {},
): Promise<BerkasRpkps | null> {
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
  let riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
  let sidik: string | null = null;

  if (snapshot) {
    const beku = cairkanSnapshot<RpkpsLengkap>(snapshot.isi as unknown as IsiSnapshot);
    sumber = beku.rpkps;
    riwayat = beku.riwayat;
    sidik = snapshot.sidik;
  } else {
    riwayat = await prisma.rpkpsRiwayat.findMany({
      where: { rpkpsId: id },
      orderBy: { dibuatPada: "asc" },
      select: { versi: true, dibuatPada: true, deskripsi: true },
    });
  }

  const buffer = await buatDokumenRpkps(sumber, riwayat, sidik);
  const namaBerkas =
    `RPKPS ${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama} - ${rpkps.tahunAkademik.kode}${sidik ? " (terbit)" : " (draf)"}.docx`.replace(
      /[/\\?%*:|"<>]/g,
      "-",
    );

  return { buffer, namaBerkas, sidik };
}
