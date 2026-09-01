import type { Bahasa } from "@/kamus";
import { adalahBahasa } from "@/kamus";

/**
 * Bahasa berkas unduhan, dari kueri `?bahasa=`.
 *
 * Nilai yang tidak dikenali jatuh ke Indonesia — naskah yang sah — bukan
 * ditolak: alamat unduhan sering disalin tangan, dan menjawab 400 atas salah
 * ketik hanya menghalangi orang mengambil dokumennya (docs/11 §7).
 */
export function bahasaBerkas(permintaan: Request): Bahasa {
  const nilai = new URL(permintaan.url).searchParams.get("bahasa");
  return adalahBahasa(nilai) ? nilai : "id";
}
