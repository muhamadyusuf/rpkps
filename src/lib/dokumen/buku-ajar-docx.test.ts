import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import {
  buatBukuAjarDocx,
  namaBerkasBuku,
  type BukuUntukCetak,
} from "./buku-ajar-docx";

/**
 * Uji pencetak buku ajar.
 *
 * Berkas .docx adalah zip berisi XML, jadi ia dapat dibuka kembali dan dibaca
 * di sini — bukan sekadar "tidak melempar galat". Yang paling penting dijaga
 * adalah `?kunci=0`: berkas untuk mahasiswa harus benar-benar tidak memuat
 * satu pun kunci jawaban, dan gagalnya senyap — berkasnya tetap terbuka
 * dengan rapi, hanya saja kuncinya ikut terbagikan.
 */

const KUNCI_1 = "Rekursi berhenti pada kasus dasar.";
const KUNCI_2 = "Kompleksitasnya O(n log n).";

function buku(ubah: Partial<BukuUntukCetak> = {}): BukuUntukCetak {
  return {
    bahasa: "id",
    judul: "Struktur Data dan Algoritma",
    subjudul: "Pendekatan Praktis",
    penulis: ["Dr. Contoh, S.T., M.T."],
    afiliasi: "Institut Teknologi Tangerang Selatan",
    penerbit: "Penerbit ITTS",
    kotaTerbit: "Tangerang Selatan",
    tahunTerbit: 2026,
    edisi: "Pertama",
    isbn: "978-3-16-148410-0",
    hakCipta: null,
    prakata: "Buku ini disusun untuk mahasiswa semester tiga.",
    pendahuluan: "Struktur data adalah cara menyimpan data.",
    glosarium: [{ istilah: "Rekursi", arti: "Fungsi yang memanggil dirinya." }],
    biografi: "Penulis mengampu mata kuliah ini sejak 2020.",
    mataKuliah: { kode: "TI214", nama: "Struktur Data" },
    prodi: "Teknik Informatika",
    pustaka: [{ nomor: 1, jenis: "UTAMA", teks: "Cormen, T. (2022). Introduction to Algorithms." }],
    bab: [
      {
        nomor: 1,
        judul: "Rekursi",
        tujuan: ["Mahasiswa mampu menjelaskan rekursi"],
        uraian: "1. Pengertian Rekursi\nRekursi adalah teknik penyelesaian masalah.",
        studiKasus: "Menara Hanoi.",
        ringkasan: "Bab ini membahas rekursi.",
        belumDisunting: false,
        latihan: [
          { nomor: 1, soal: "Jelaskan kasus dasar.", kunci: KUNCI_1 },
          { nomor: 2, soal: "Hitung kompleksitasnya.", kunci: KUNCI_2 },
        ],
      },
      {
        nomor: 2,
        judul: "Pengurutan",
        tujuan: ["Mahasiswa mampu membandingkan algoritma pengurutan"],
        uraian: "1. Pengurutan Sisip\nAlgoritma ini menyisipkan satu per satu.",
        studiKasus: null,
        ringkasan: null,
        belumDisunting: true,
        latihan: [],
      },
    ],
    ...ubah,
  };
}

/** Seluruh teks di dalam berkas: badan dokumen beserta header dan footer. */
async function teksBerkas(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const nama = Object.keys(zip.files).filter((n) => n.endsWith(".xml"));
  const isi = await Promise.all(nama.map((n) => zip.file(n)!.async("string")));
  return isi.join("\n");
}

describe("buku ajar .docx", () => {
  it("berkasnya zip .docx yang sah", async () => {
    const zip = await JSZip.loadAsync(await buatBukuAjarDocx(buku()));
    assert.ok(zip.file("word/document.xml"), "tidak ada word/document.xml");
    assert.ok(zip.file("[Content_Types].xml"), "tidak ada [Content_Types].xml");
    assert.ok(zip.file("word/styles.xml"), "tidak ada word/styles.xml");
  });

  it("memuat judul, penulis, bab, glosarium, dan daftar pustaka", async () => {
    const teks = await teksBerkas(await buatBukuAjarDocx(buku()));
    for (const bagian of [
      "Struktur Data dan Algoritma",
      "Dr. Contoh",
      "Rekursi",
      "Pengurutan",
      "GLOSARIUM",
      "DAFTAR PUSTAKA",
      "Cormen",
      "978-3-16-148410-0",
    ]) {
      assert.ok(teks.includes(bagian), `tidak memuat "${bagian}"`);
    }
  });

  it("kunci=false tidak memuat satu pun kunci jawaban", async () => {
    /*
     * Penjaga docs/16 §4.1. Inilah alasan `latihan_bab.kunci` disimpan di
     * kolomnya sendiri: berkas untuk mahasiswa dibuat dengan mematikan
     * bendera, bukan dengan menyunting naskah.
     */
    const teks = await teksBerkas(await buatBukuAjarDocx(buku(), { kunci: false }));

    assert.ok(!teks.includes(KUNCI_1), "kunci jawaban 1 ikut tercetak");
    assert.ok(!teks.includes(KUNCI_2), "kunci jawaban 2 ikut tercetak");
    assert.ok(!teks.includes("Kunci Jawaban"), "judul bagian kunci ikut tercetak");
    // Soalnya sendiri tetap ada — yang dibuang hanya kuncinya.
    assert.ok(teks.includes("Jelaskan kasus dasar."));
  });

  it("kunci ikut tercetak pada berkas dosen", async () => {
    const teks = await teksBerkas(await buatBukuAjarDocx(buku()));
    assert.ok(teks.includes(KUNCI_1));
    assert.ok(teks.includes("Kunci Jawaban"));
  });

  it("bab tunggal hanya memuat bab itu, tanpa kelengkapan buku", async () => {
    const teks = await teksBerkas(await buatBukuAjarDocx(buku(), { bab: 2 }));
    assert.ok(teks.includes("Pengurutan"));
    assert.ok(!teks.includes("Menara Hanoi"), "bab lain ikut tercetak");
    assert.ok(!teks.includes("GLOSARIUM"), "glosarium ikut pada cetakan satu bab");
    assert.ok(!teks.includes("DAFTAR PUSTAKA"), "daftar pustaka ikut pada cetakan satu bab");
  });

  it("halaman hak cipta mencetak garis isian untuk yang belum diisi", async () => {
    // Buku tanpa ISBN yang halaman hak ciptanya tampak lengkap adalah jebakan.
    const teks = await teksBerkas(
      await buatBukuAjarDocx(buku({ isbn: null, penerbit: null, tahunTerbit: null })),
    );
    assert.ok(teks.includes("(belum didaftarkan)"));
  });

  it("naskah yang masih memuat bab mentah membawa peringatannya sendiri", async () => {
    // Peringatan ini harus ada DI DALAM berkas: berkas inilah yang dikirim ke
    // penerbit, dan layar aplikasi tidak ikut terkirim.
    const adaMentah = await teksBerkas(await buatBukuAjarDocx(buku()));
    assert.ok(adaMentah.includes("belum disunting penulis"));

    const semuaDisunting = await teksBerkas(
      await buatBukuAjarDocx(
        buku({ bab: buku().bab.map((b) => ({ ...b, belumDisunting: false })) }),
      ),
    );
    assert.ok(!semuaDisunting.includes("belum disunting penulis"));
  });

  it("berkas berbahasa Inggris memakai label Inggris", async () => {
    const teks = await teksBerkas(await buatBukuAjarDocx(buku({ bahasa: "en" })));
    assert.ok(teks.includes("BIBLIOGRAPHY"));
    assert.ok(teks.includes("CHAPTER"));
    assert.ok(!teks.includes("DAFTAR PUSTAKA"));
  });

  it("daftar isi dibangun dari gaya heading, bukan paragraf tebal", async () => {
    const zip = await JSZip.loadAsync(await buatBukuAjarDocx(buku()));
    const dokumen = await zip.file("word/document.xml")!.async("string");
    // Field TOC ada …
    assert.ok(dokumen.includes("TOC"), "tidak ada field daftar isi");
    // … dan ada judul yang benar-benar memakai gaya Heading1 untuk diisinya.
    assert.ok(/w:pStyle w:val="Heading1"/.test(dokumen), "tidak ada judul bergaya Heading1");
    assert.ok(/w:pStyle w:val="Heading2"/.test(dokumen), "subbab tidak menjadi Heading2");
  });

  it("nama berkas menyebut bab atau ketiadaan kunci", () => {
    const b = buku();
    assert.equal(namaBerkasBuku(b, {}), "Struktur Data dan Algoritma.docx");
    assert.equal(namaBerkasBuku(b, { bab: 3 }), "Struktur Data dan Algoritma - Bab 3.docx");
    assert.equal(
      namaBerkasBuku(b, { kunci: false }),
      "Struktur Data dan Algoritma - tanpa kunci.docx",
    );
    assert.ok(!namaBerkasBuku(buku({ judul: 'A/B:C*D?' }), {}).match(/[/\\?%*:|"<>]/));
  });
});
