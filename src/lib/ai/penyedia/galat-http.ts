/**
 * Pembacaan badan galat penyedia REST, dan penyusunan daftar model yang
 * benar-benar boleh dipakai sebuah kunci.
 *
 * Sebelum berkas ini ada, adapter Mistral dan Gemini menyusun pesan galat
 * HANYA dari kode status HTTP: `if (!respons.ok) throw new GalatAi(pesanGalat(
 * respons.status))`. Alasan sebenarnya selalu dikirim penyedia di badan
 * respons — "model tidak termasuk langganan Anda", "kunci ini tidak mencakup
 * endpoint chat" — lalu dibuang tanpa dibaca. Dosen membaca "403" dan tidak
 * punya cara mengetahui apa yang harus diperbaiki, padahal jawabannya ada di
 * paket yang sama.
 *
 * Dua aturan yang mengikat berkas ini:
 *
 * 1. **Kunci API tidak pernah ikut keluar.** Badan galat berasal dari luar dan
 *    tidak dijamin bersih — sebagian penyedia mengutip potongan permintaan.
 *    Semua teks melewati `tanpaKunci()` sebelum dipakai.
 * 2. **Penyelidikan tambahan tidak boleh menahan pengguna.** Daftar model
 *    hanya diambil pada galat yang memang butuh (403/404), dengan batas waktu
 *    sendiri yang jauh lebih pendek daripada batas waktu chat; gagalnya
 *    dilaporkan sebagai "tidak diketahui", bukan dilempar.
 */

const BATAS_HURUF = 300;
const BATAS_WAKTU_PROBE_MS = 15_000;
const MAKS_MODEL_DISEBUT = 12;

/**
 * Membaca alasan yang ditulis penyedia pada badan respons galat.
 * Mengembalikan null bila badannya kosong atau tidak memuat kalimat apa pun.
 */
export async function alasanPenyedia(
  respons: Response,
  apiKey: string,
): Promise<string | null> {
  let mentah: string;
  try {
    mentah = await respons.text();
  } catch {
    return null;
  }
  if (!mentah.trim()) return null;

  let pesan: string | null = null;
  try {
    pesan = petikPesan(JSON.parse(mentah));
  } catch {
    // Bukan JSON — halaman galat proxy, misalnya. Teks mentahnya masih berguna.
    pesan = mentah;
  }
  if (!pesan?.trim()) return null;

  return bersihkanPesan(pesan, apiKey);
}

/**
 * Menggali kalimat galat dari bentuk yang dipakai penyedia:
 * Mistral `{message}` atau `{detail:[{msg}]}`, Gemini `{error:{message}}`.
 * Sengaja longgar — bentuk badan galat bukan bagian kontrak yang stabil.
 */
function petikPesan(nilai: unknown, dalam = 0): string | null {
  if (dalam > 4) return null;
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) {
    for (const anak of nilai) {
      const pesan = petikPesan(anak, dalam + 1);
      if (pesan) return pesan;
    }
    return null;
  }
  if (nilai && typeof nilai === "object") {
    const objek = nilai as Record<string, unknown>;
    for (const kunci of ["message", "msg", "error_description", "detail", "error"]) {
      if (kunci in objek) {
        const pesan = petikPesan(objek[kunci], dalam + 1);
        if (pesan) return pesan;
      }
    }
  }
  return null;
}

/**
 * Menjadikan kalimat penyedia aman ditampilkan: kunci API disensor bila
 * penyedia mengutipnya kembali, dan panjangnya dibatasi agar dialog tetap
 * terbaca. Empat huruf terakhir kunci dibiarkan, sejalan dengan `ekorKunci`
 * di kredensial.ts — cukup untuk mengenali kunci mana yang dimaksud, tidak
 * cukup untuk memakainya.
 *
 * Dipakai juga oleh adapter Anthropic, yang alasannya datang dari SDK dan
 * bukan dari `Response`.
 */
export function bersihkanPesan(teks: string, apiKey: string): string {
  const tersensor =
    apiKey.length < 8 ? teks : teks.split(apiKey).join(`•••${apiKey.slice(-4)}`);
  const satuBaris = tersensor.replace(/\s+/g, " ").trim();
  return satuBaris.length > BATAS_HURUF
    ? `${satuBaris.slice(0, BATAS_HURUF)}…`
    : satuBaris;
}

/**
 * Hasil penyelidikan daftar model.
 * - `daftar` — kunci boleh membaca katalog; isinya nama model yang sah.
 * - `tertutup` — katalog sendiri ditolak, tanda masalahnya bukan pada nama
 *   model melainkan pada paket akun atau cakupan kunci.
 * - `gagal` — tidak dapat disimpulkan (jaringan, batas waktu, bentuk asing).
 */
export type HasilModel =
  | { jenis: "daftar"; model: string[] }
  | { jenis: "tertutup" }
  | { jenis: "gagal" };

/**
 * Mengambil katalog model dengan kunci yang sama. Dipakai HANYA saat galat
 * 403/404, ketika pertanyaan pengguna selalu sama: "kalau bukan model ini,
 * lalu model apa yang boleh saya pakai?"
 */
export async function ambilDaftarModel(
  url: string,
  init: RequestInit,
  petik: (badan: unknown) => string[] | null,
): Promise<HasilModel> {
  let respons: Response;
  try {
    respons = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(BATAS_WAKTU_PROBE_MS),
    });
  } catch {
    return { jenis: "gagal" };
  }

  // Katalog ikut ditolak: kuncinya sah tetapi tidak berwenang atas apa pun.
  if (respons.status === 401 || respons.status === 403) return { jenis: "tertutup" };
  if (!respons.ok) return { jenis: "gagal" };

  try {
    const model = petik(await respons.json());
    return model && model.length > 0
      ? { jenis: "daftar", model }
      : { jenis: "tertutup" };
  } catch {
    return { jenis: "gagal" };
  }
}

/** Kalimat penutup yang menerangkan hasil penyelidikan model kepada dosen. */
export function kalimatDaftarModel(hasil: HasilModel, penyedia: string): string {
  switch (hasil.jenis) {
    case "daftar": {
      const disebut = hasil.model.slice(0, MAKS_MODEL_DISEBUT);
      const sisa = hasil.model.length - disebut.length;
      return (
        `Model yang boleh dipakai kunci ini: ${disebut.join(", ")}` +
        `${sisa > 0 ? `, dan ${sisa} lainnya` : ""}. ` +
        "Isikan salah satunya pada kolom Model di Pengaturan → Kunci AI."
      );
    }
    case "tertutup":
      return (
        `Kunci ini tidak berwenang atas satu model pun — daftar model ${penyedia} ` +
        "pun ditolak. Yang perlu diperiksa bukan nama modelnya, melainkan status " +
        `paket/langganan akun ${penyedia} Anda dan cakupan (scope) kunci ini.`
      );
    case "gagal":
      return `Daftar model ${penyedia} tidak dapat dibaca untuk memeriksa pilihan yang sah.`;
  }
}

/** Menyisipkan kutipan alasan penyedia bila ada. */
export function kutipAlasan(penyedia: string, alasan: string | null): string {
  return alasan ? ` ${penyedia} menjawab: "${alasan}".` : "";
}
