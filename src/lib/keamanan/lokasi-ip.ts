import "server-only";
import { adalahIpPublik } from "@/domain/keamanan/ip";
import { tafsirIpwho, type LokasiIp } from "@/domain/keamanan/lokasi-ip";

/**
 * Mencari lokasi perkiraan sebuah IP lewat layanan pihak ketiga (ipwho.is,
 * HTTPS, tanpa kunci). Yang dikirim ke sana hanya alamat IP milik pemindai —
 * bukan data pengguna kita.
 *
 * Batas waktu pendek dan kegagalannya diam: lokasi adalah pengayaan, dan
 * catatan temuan sudah tersimpan sebelum fungsi ini dipanggil.
 */
export async function cariLokasiIp(ip: string): Promise<LokasiIp | null> {
  if (!adalahIpPublik(ip)) return null;
  try {
    const respons = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city,latitude,longitude,connection,timezone`,
      { signal: AbortSignal.timeout(3000), cache: "no-store" },
    );
    if (!respons.ok) return null;
    return tafsirIpwho(await respons.json());
  } catch {
    return null;
  }
}
