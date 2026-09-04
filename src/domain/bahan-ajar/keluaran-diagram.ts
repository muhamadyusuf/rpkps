import { daftarRingkas } from "@/domain/temuan";
import { periksaGayaSvg } from "./gaya-svg";
import { periksaMermaid } from "./mermaid-aman";
import { periksaSvgAman } from "./svg-aman";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Merapikan keluaran tahap `BUKU_DIAGRAM` — docs/17 §4.
 *
 * Pola yang sama dengan `keluaran.ts`: rapikan MEMPERBAIKI, validator
 * MEMBUKTIKAN. Bedanya satu, dan penting — di sini "memperbaiki" berarti
 * **membuang diagram yang tidak lolos**, bukan menambalnya.
 *
 * Menambal SVG berarti menulis ulang gambar orang lain sampai ia lolos
 * pemeriksaan, dan hasilnya adalah gambar yang tidak pernah dilihat siapa pun
 * sebelum tercetak. Sebuah bab dengan tiga diagram yang benar lebih baik
 * daripada bab dengan lima diagram yang dua di antaranya sudah bukan lagi apa
 * yang dimaksudkan penulisnya. Yang dibuang dilaporkan, dan dosen dapat
 * meminta model menyusunnya ulang.
 *
 * Murni: tanpa Prisma, tanpa DOM, tanpa zod.
 */

/** Batas jumlah gambar per bab — docs/17 §3.3. */
export const BATAS_GAMBAR_BAB = 12;

export interface DiagramMentah {
  judul: string;
  alt: string;
  letak: string;
  bentuk: string;
  kode: string;
}

export interface DiagramSiap {
  nomor: number;
  judul: string;
  altTeks: string | null;
  letak: string | null;
  bentuk: "MERMAID" | "SVG";
  kode: string;
}

export interface HasilDiagram {
  hasil: DiagramSiap[];
  catatan: TemuanBahanAjar[];
}

export function rapikanDiagram(
  mentah: readonly DiagramMentah[],
  opsi: { bab?: number } = {},
): HasilDiagram {
  const catatan: TemuanBahanAjar[] = [];
  const hasil: DiagramSiap[] = [];
  const ditolak: string[] = [];
  /** Alasan penolakan, digabung supaya dosen tahu apa yang harus diperbaiki. */
  const alasan: TemuanBahanAjar[] = [];
  let kelebihan = 0;

  for (const d of mentah ?? []) {
    const judul = (d.judul ?? "").trim();
    const kode = (d.kode ?? "").trim();
    const bentuk = (d.bentuk ?? "").trim().toUpperCase();

    // Tanpa judul, gambar tidak dapat diberi keterangan maupun masuk Daftar
    // Gambar; tanpa kode, tidak ada yang dapat digambar.
    if (!judul || !kode || (bentuk !== "MERMAID" && bentuk !== "SVG")) {
      ditolak.push(judul || "(tanpa judul)");
      continue;
    }

    if (hasil.length >= BATAS_GAMBAR_BAB) {
      kelebihan++;
      continue;
    }

    const periksa =
      bentuk === "SVG" ? periksaSatuSvg(kode) : periksaMermaid(kode);

    if (!periksa.ok) {
      ditolak.push(judul);
      alasan.push(...periksa.temuan);
      continue;
    }

    hasil.push({
      nomor: hasil.length + 1,
      judul,
      altTeks: (d.alt ?? "").trim() || null,
      letak: (d.letak ?? "").trim() || null,
      bentuk,
      kode,
    });
  }

  if (ditolak.length > 0) {
    catatan.push({
      kode: "IL-DIAGRAM-DITOLAK",
      tingkat: "INFO",
      params: { jumlah: ditolak.length, daftar: daftarRingkas(ditolak) },
      bab: opsi.bab,
    });
    /*
     * Alasan tiap penolakan ikut dilaporkan, diturunkan tingkatnya menjadi
     * INFO: yang gagal bukan buku dosen melainkan satu keluaran model, dan
     * satu-satunya gunanya di layar adalah memberi tahu apa yang perlu
     * diminta berbeda. Duplikatnya dibuang — lima diagram yang melanggar
     * aturan yang sama tidak perlu lima baris yang sama.
     */
    const terlihat = new Set<string>();
    for (const t of alasan) {
      if (terlihat.has(t.kode)) continue;
      terlihat.add(t.kode);
      catatan.push({ ...t, tingkat: "INFO", bab: opsi.bab });
    }
  }

  if (kelebihan > 0) {
    catatan.push({
      kode: "IL-DIAGRAM-TERLALU-BANYAK",
      tingkat: "INFO",
      params: { n: BATAS_GAMBAR_BAB, jumlah: kelebihan },
      bab: opsi.bab,
    });
  }

  return { hasil, catatan };
}

/** SVG harus lolos KEDUANYA: aman dahulu, baru sesuai cetakan gaya. */
function periksaSatuSvg(kode: string): { ok: boolean; temuan: TemuanBahanAjar[] } {
  const aman = periksaSvgAman(kode);
  if (!aman.ok) return { ok: false, temuan: aman.temuan };

  const gaya = periksaGayaSvg(kode);
  return { ok: gaya.ok, temuan: gaya.temuan };
}
