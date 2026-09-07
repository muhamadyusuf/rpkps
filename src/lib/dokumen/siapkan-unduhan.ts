import "server-only";
import type { Bahasa } from "@/kamus";
import { muatRpkps } from "@/lib/rpkps/muat";
import { rakitDariRpkps } from "@/lib/dokumen/rakit-naskah";
import { buatDokumenRpkps } from "@/lib/dokumen/rpkps-docx";

/**
 * Menyusun berkas DOCX satu RPKPS beserta nama berkasnya.
 *
 * Dipakai dua rute dengan gerbang yang berbeda — yang butuh sesi dan yang
 * terbuka untuk umum — sehingga aturan "dokumen terbit dicetak dari salinan
 * beku" hanya ditulis sekali. OTORISASI BUKAN URUSAN FUNGSI INI; pemanggil
 * yang memutuskan siapa boleh mengunduh apa.
 *
 * Isinya sendiri dirakit `rakitNaskahRpkps`, yang juga melayani halaman
 * pratinjau: berkas yang diunduh dan naskah yang dipratinjau harus berasal
 * dari perakitan yang sama, atau pratinjau berhenti dapat dipercaya.
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

  const { naskah, riwayat, ttd, sidik, namaBerkas } = await rakitDariRpkps(rpkps, {
    bahasa,
  });
  // Terbit tanpa salinan beku berarti data tidak konsisten. Rute publik lebih
  // baik menjawab 404 daripada menerbitkan isi yang belum pernah disahkan.
  if (opsi.hanyaTerbit && !sidik) return null;

  const buffer = await buatDokumenRpkps(naskah, riwayat, ttd, sidik, bahasa);

  return { buffer, namaBerkas, sidik };
}
