import { daftarRingkas } from "@/domain/temuan";
import { babBergeser } from "./sidik-sumber";
import { isbnSah } from "./isbn";
import type { BukuAjarInput, HasilPeriksaBukuAjar, TemuanBahanAjar } from "./tipe";

/**
 * Pemeriksaan buku ajar — docs/16 §5.4.
 *
 * Murni: kode dan parameter, tidak pernah kalimat. Kalimatnya di
 * `temuan-id.ts`/`temuan-en.ts`, dirakit `teksTemuan` saat dibaca.
 *
 * Yang diperiksa di sini adalah KELAYAKAN TERBIT, bukan mutu tulisan. Tidak
 * ada aturan yang dapat menilai apakah sebuah bab layak dibaca mahasiswa;
 * yang dapat diperiksa mesin hanyalah bab yang kosong, sitiran yang menunjuk
 * pustaka yang tidak ada, nomor ISBN yang salah ketik, dan buku yang belum
 * disentuh manusia sama sekali.
 */

export function periksaBukuAjar(buku: BukuAjarInput): HasilPeriksaBukuAjar {
  const temuan: TemuanBahanAjar[] = [];

  // ── Bab ─────────────────────────────────────────────────────────────
  if (buku.bab.length === 0) {
    temuan.push({ kode: "BA-TANPA-BAB", tingkat: "PEMBLOKIR" });
  }

  const kosong: number[] = [];
  const tanpaTujuan: number[] = [];
  const tanpaKunci: number[] = [];
  const bergeser: number[] = [];
  const kehilanganMinggu: number[] = [];
  const sitiranAsing = new Set<number>();

  const tersedia = new Set(buku.nomorPustakaTersedia);

  for (const bab of buku.bab) {
    if (!bab.uraian?.trim()) kosong.push(bab.nomor);
    if (bab.tujuan.filter((t) => t.trim()).length === 0) tanpaTujuan.push(bab.nomor);
    if (bab.latihan.some((l) => !l.kunci?.trim())) tanpaKunci.push(bab.nomor);
    if (babBergeser(bab.sidikSumber, bab.sidikSekarang)) bergeser.push(bab.nomor);
    if (!bab.punyaMinggu) kehilanganMinggu.push(bab.nomor);
    for (const nomor of bab.sitiran) {
      if (!tersedia.has(nomor)) sitiranAsing.add(nomor);
    }
  }

  if (kosong.length > 0) {
    temuan.push({
      kode: "BA-BAB-KOSONG",
      tingkat: "PEMBLOKIR",
      params: { jumlah: kosong.length, daftar: daftarRingkas(kosong.map(String)) },
    });
  }

  if (sitiranAsing.size > 0) {
    /*
     * Pemblokir, bukan peringatan. Sitiran yang menunjuk pustaka yang tidak
     * ada di RPKPS berarti model menyebut sumber yang tidak pernah diberikan
     * kepadanya (docs/16 P6) — dan daftar pustaka buku dirakit dari baris
     * pustaka, sehingga sitiran itu akan menggantung di teks tanpa padanan di
     * halaman daftar pustaka.
     */
    const nomor = [...sitiranAsing].sort((a, b) => a - b);
    temuan.push({
      kode: "BA-PUSTAKA-ASING",
      tingkat: "PEMBLOKIR",
      params: { jumlah: nomor.length, daftar: daftarRingkas(nomor.map(String)) },
    });
  }

  if (tanpaTujuan.length > 0) {
    temuan.push({
      kode: "BA-TANPA-TUJUAN",
      tingkat: "PERINGATAN",
      params: { daftar: daftarRingkas(tanpaTujuan.map(String)) },
    });
  }

  if (tanpaKunci.length > 0) {
    temuan.push({
      kode: "BA-LATIHAN-TANPA-KUNCI",
      tingkat: "PERINGATAN",
      params: { daftar: daftarRingkas(tanpaKunci.map(String)) },
    });
  }

  if (bergeser.length > 0) {
    temuan.push({
      kode: "BA-BAB-BERGESER",
      tingkat: "PERINGATAN",
      params: { daftar: daftarRingkas(bergeser.map(String)) },
    });
  }

  if (kehilanganMinggu.length > 0) {
    temuan.push({
      kode: "BA-MINGGU-HILANG",
      tingkat: "PERINGATAN",
      params: { daftar: daftarRingkas(kehilanganMinggu.map(String)) },
    });
  }

  // ── Tanggung jawab penulis ──────────────────────────────────────────
  const babDisunting = buku.bab.filter((b) => b.disunting).length;
  if (buku.bab.length > 0 && babDisunting === 0) {
    /*
     * Peringatan yang paling penting di daftar ini. Buku yang seluruh isinya
     * masih keluaran model mentah tidak layak dibawa ke penerbit, dan satu-
     * satunya orang yang dapat menilai itu adalah dosen yang namanya akan
     * tercetak di sampul (docs/16 P4).
     */
    temuan.push({ kode: "BA-SELURUHNYA-AI", tingkat: "PERINGATAN" });
  }

  // ── Metadata terbitan ───────────────────────────────────────────────
  // Satu kode = satu kalimat: nama medan yang kosong TIDAK dilewatkan sebagai
  // parameter, karena "penerbit" adalah kata Indonesia yang akan bocor ke
  // layar berbahasa Inggris (docs/11 §4.1).
  if (buku.penulis.filter((n) => n.trim()).length === 0) {
    temuan.push({ kode: "BA-TANPA-PENULIS", tingkat: "PERINGATAN" });
  }
  if (!buku.penerbit?.trim()) {
    temuan.push({ kode: "BA-TANPA-PENERBIT", tingkat: "PERINGATAN" });
  }
  if (!buku.tahunTerbit) {
    temuan.push({ kode: "BA-TANPA-TAHUN", tingkat: "PERINGATAN" });
  }
  if (!buku.prakata?.trim()) {
    temuan.push({ kode: "BA-TANPA-PRAKATA", tingkat: "PERINGATAN" });
  }

  if (buku.isbn?.trim() && !isbnSah(buku.isbn)) {
    /*
     * ISBN kosong hanyalah buku yang belum didaftarkan — wajar, dan halaman
     * hak cipta mencetaknya sebagai garis isian. ISBN yang TERISI tetapi salah
     * digit periksanya adalah salah ketik yang akan ikut beredar.
     */
    temuan.push({
      kode: "BA-ISBN-TIDAK-SAH",
      tingkat: "PEMBLOKIR",
      params: { isbn: buku.isbn.trim() },
    });
  }

  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");
  const peringatan = temuan.filter((t) => t.tingkat === "PERINGATAN");

  return {
    temuan,
    pemblokir,
    peringatan,
    lolos: pemblokir.length === 0,
    ringkasan: {
      jumlahBab: buku.bab.length,
      babBerisi: buku.bab.filter((b) => b.uraian?.trim()).length,
      babDisunting,
      jumlahLatihan: buku.bab.reduce((s, b) => s + b.latihan.length, 0),
      jumlahSlide: buku.bab.reduce((s, b) => s + b.jumlahSlide, 0),
    },
  };
}
