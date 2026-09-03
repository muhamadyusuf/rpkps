import { sidikSumberBab } from "./sidik-sumber";
import type { KerangkaBuku, PertemuanUntukBab, RancanganBab } from "./tipe";

/**
 * Merancang kerangka buku ajar dari baris mingguan RPKPS — docs/16 §2.2.
 *
 * Satu bab = satu baris mingguan EFEKTIF. Minggu UTS dan UAS tidak melahirkan
 * bab: tidak ada materi yang diajarkan di sana, dan bab kosong bernama "Ujian
 * Tengah Semester" hanya akan tercetak di daftar isi buku.
 *
 * Nomor bab BERURUTAN 1..n, bukan nomor minggunya. Buku yang babnya melompat
 * dari 7 ke 9 karena minggu 8 adalah UTS terbaca seperti buku yang kehilangan
 * satu bab.
 */
export function rancangKerangkaBuku(
  pertemuan: readonly PertemuanUntukBab[],
): KerangkaBuku {
  const bab: RancanganBab[] = [];
  const dilewati: number[] = [];

  const efektif = [...pertemuan]
    .filter((p) => p.jenis === "EFEKTIF")
    .sort((a, b) => a.minggu - b.minggu);

  for (const p of efektif) {
    const judul = judulBab(p);
    const tujuan = tujuanBab(p);

    /*
     * Minggu yang belum punya topik MAUPUN Sub-CPMK tidak menjadi bab. Bukan
     * karena tidak boleh, melainkan karena tidak ada yang dapat ditulis: model
     * hanya akan mengarang bab yang tidak berhubungan dengan apa pun. Yang
     * dilewati dilaporkan, supaya dosen tahu RPKPS-nya yang belum selesai.
     */
    if (!judul) {
      dilewati.push(p.minggu);
      continue;
    }

    bab.push({
      nomor: bab.length + 1,
      minggu: p.minggu,
      pertemuanId: p.id,
      judul,
      tujuan,
      subtopik: p.subtopik.map((s) => s.trim()).filter(Boolean),
      sidikSumber: sidikSumberBab(p),
    });
  }

  return { bab, dilewati };
}

/**
 * Judul bab diambil dari topik minggu itu. Bila topiknya kosong tetapi
 * Sub-CPMK-nya ada, rumusan Sub-CPMK dipakai sebagai judul sementara — dosen
 * dan model sama-sama masih punya bahan. Bila keduanya kosong, tidak ada judul
 * dan minggunya dilewati.
 */
function judulBab(p: PertemuanUntukBab): string {
  const topik = p.topik?.trim();
  if (topik) return topik;

  const rumusan = p.subCpmk[0]?.rumusan?.trim();
  return rumusan ? potong(rumusan, 80) : "";
}

/**
 * Tujuan pembelajaran bab diambil dari indikator minggu itu; bila belum ada,
 * dari rumusan Sub-CPMK yang dijadwalkan. Keduanya sudah berupa kalimat
 * kemampuan terukur — tidak ada yang perlu dikarang ulang.
 */
function tujuanBab(p: PertemuanUntukBab): string[] {
  const indikator = p.indikator.map((t) => t.trim()).filter(Boolean);
  if (indikator.length > 0) return indikator;
  return p.subCpmk.map((s) => s.rumusan.trim()).filter(Boolean);
}

function potong(teks: string, maks: number): string {
  if (teks.length <= maks) return teks;
  const potongan = teks.slice(0, maks);
  const spasi = potongan.lastIndexOf(" ");
  return (spasi > maks * 0.6 ? potongan.slice(0, spasi) : potongan).trimEnd() + "…";
}

/**
 * Menomori ulang bab setelah ada yang dihapus atau dipindahkan.
 *
 * Dipakai penyunting, bukan penyusun: `rancangKerangkaBuku` sudah menomori
 * berurutan sejak awal.
 */
export function nomoriUlang<T extends { nomor: number }>(bab: readonly T[]): T[] {
  return [...bab]
    .sort((a, b) => a.nomor - b.nomor)
    .map((b, i) => ({ ...b, nomor: i + 1 }));
}
