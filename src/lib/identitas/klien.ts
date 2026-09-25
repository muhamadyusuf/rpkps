import "server-only";
import { env } from "@/lib/env";

/**
 * Satu-satunya jalan RPKPS memanggil API server-ke-server identitas-itts
 * (docs/26): Basic `client_id:client_secret`, batas waktu, tanpa cache, dan
 * galat yang membedakan SEBAB — karena tiap sebab berbeda penanganannya:
 *
 *   tak-dikonfigurasi  IDENTITAS_ITTS_* kosong. Integrasi belum diaktifkan.
 *   tak-terjangkau     jaringan, batas waktu, atau 5xx. Sementara — coba lagi nanti.
 *   ditolak            401/4xx. Kredensial klien salah/dicabut. Perlu tindakan admin.
 *   cakupan            403. Klien belum punya `kepegawaian.read` di /klien.
 *   jawaban-cacat      bentuk jawaban tak sesuai kontrak.
 *
 * Pesan galat SELALU memuat "identitas-itts": `jelaskanKegagalanSesi`
 * (lib/masuk.ts) mengenalinya sebagai kegagalan layanan luar (503), bukan galat acak.
 */

export type JenisGalatIdentitas = "tak-dikonfigurasi" | "tak-terjangkau" | "ditolak" | "cakupan" | "jawaban-cacat";

export class GalatIdentitas extends Error {
  constructor(
    readonly jenis: JenisGalatIdentitas,
    pesan: string,
  ) {
    super(pesan);
    this.name = "GalatIdentitas";
  }
}

export type ParamIdentitas = Record<string, string | readonly string[] | undefined>;

/** Sama dengan gerbang kepegawaian: kompilasi dingin di pengembangan pernah memakan ±3,7 detik. */
export const BATAS_WAKTU_IDENTITAS_MS = 8000;

export async function ambilDariIdentitas(
  jalur: string,
  params: ParamIdentitas = {},
  batasMs: number = BATAS_WAKTU_IDENTITAS_MS,
): Promise<unknown> {
  const k = env.identitasItts;
  if (!k) throw new GalatIdentitas("tak-dikonfigurasi", "identitas-itts belum dikonfigurasi (IDENTITAS_ITTS_*)");

  const alamat = new URL(`${k.url}${jalur}`);
  for (const [nama, nilai] of Object.entries(params)) {
    if (nilai === undefined) continue;
    for (const v of typeof nilai === "string" ? [nilai] : nilai) alamat.searchParams.append(nama, v);
  }

  let resp: Response;
  try {
    resp = await fetch(alamat, {
      headers: { Authorization: `Basic ${Buffer.from(`${k.klienId}:${k.rahasia}`).toString("base64")}` },
      cache: "no-store",
      signal: AbortSignal.timeout(batasMs),
    });
  } catch (galat) {
    throw new GalatIdentitas("tak-terjangkau", `identitas-itts tak terjangkau (${jalur}): ${(galat as Error).name}`);
  }

  if (!resp.ok) {
    const dasar = `identitas-itts menjawab ${resp.status} pada ${jalur}`;
    if (resp.status === 403) {
      throw new GalatIdentitas("cakupan", `${dasar} — klien "${k.klienId}" butuh cakupan "kepegawaian.read" (/klien → ${k.klienId} → Ubah)`);
    }
    // Isi jawaban tidak dicatat: pada kegagalan pun bisa memuat petunjuk tentang kredensial.
    throw new GalatIdentitas(resp.status >= 500 ? "tak-terjangkau" : "ditolak", dasar);
  }

  try {
    return await resp.json();
  } catch {
    throw new GalatIdentitas("jawaban-cacat", `identitas-itts menjawab bukan JSON pada ${jalur}`);
  }
}
