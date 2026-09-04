import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { buatSlidePptx, namaBerkasSlide, type DekUntukSlide } from "./slide-pptx";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * Uji pencetak slide.
 *
 * Berkas .pptx adalah zip berisi XML, jadi ia dibuka kembali dan dibaca di
 * sini. Dua hal yang paling penting dijaga: catatan pembicara benar-benar
 * menjadi notes (bukan teks di atas slide), dan kunci jawaban tidak dapat
 * sampai ke slide sama sekali.
 */

const CATATAN = "Mulai dengan bertanya siapa yang pernah menulis fungsi rekursif.";

function dek(ubah: Partial<DekUntukSlide> = {}): DekUntukSlide {
  return {
    bahasa: "id",
    judulBuku: "Struktur Data dan Algoritma",
    penulis: ["Dr. Contoh, S.T., M.T."],
    mataKuliah: { kode: "TI214", nama: "Struktur Data" },
    bab: [
      {
        nomor: 1,
        judul: "Rekursi",
        tujuan: ["Mahasiswa mampu menjelaskan kasus dasar"],
        slide: [
          {
            nomor: 1,
            judul: "Apa itu rekursi",
            butir: ["Memanggil dirinya sendiri", "Selalu punya kasus dasar"],
            catatan: CATATAN,
          },
          { nomor: 2, judul: "Tumpukan pemanggilan", butir: ["Satu bingkai per panggilan"], catatan: null },
        ],
        latihan: [{ nomor: 1, soal: "Jelaskan kasus dasar." }],
        gambar: [
          {
            nomor: 1,
            judul: "Alur penelusuran",
            dataUri: PNG_1PX,
            lebarPx: 800,
            tinggiPx: 400,
          },
        ],
      },
      {
        nomor: 2,
        judul: "Pengurutan",
        tujuan: [],
        slide: [{ nomor: 1, judul: "Pengurutan sisip", butir: ["O(n^2)"], catatan: null }],
        latihan: [],
        gambar: [],
      },
    ],
    ...ubah,
  };
}

async function bukaZip(buffer: Buffer) {
  return JSZip.loadAsync(buffer);
}

async function teksSlide(buffer: Buffer): Promise<string> {
  const zip = await bukaZip(buffer);
  const nama = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const isi = await Promise.all(nama.map((n) => zip.file(n)!.async("string")));
  return isi.join("\n");
}

async function teksCatatan(buffer: Buffer): Promise<string> {
  const zip = await bukaZip(buffer);
  const nama = Object.keys(zip.files).filter((n) =>
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n),
  );
  const isi = await Promise.all(nama.map((n) => zip.file(n)!.async("string")));
  return isi.join("\n");
}

describe("slide .pptx", () => {
  it("berkasnya zip .pptx yang sah", async () => {
    const zip = await bukaZip(await buatSlidePptx(dek()));
    assert.ok(zip.file("ppt/presentation.xml"), "tidak ada ppt/presentation.xml");
    assert.ok(zip.file("[Content_Types].xml"), "tidak ada [Content_Types].xml");
  });

  it("jumlah slide sesuai isi babnya", async () => {
    const zip = await bukaZip(await buatSlidePptx(dek()));
    const jumlah = Object.keys(zip.files).filter((n) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(n),
    ).length;
    /*
     * Bab 1: pembuka + tujuan + dua slide isi + gambar + latihan = 6
     * Bab 2: pembuka + satu slide isi                            = 2
     *        (tanpa tujuan, tanpa gambar, tanpa latihan)
     */
    assert.equal(jumlah, 8);
  });

  it("catatan menjadi speaker notes, bukan teks di atas slide", async () => {
    // Inilah beda bahan mengajar dan slide yang dibacakan.
    const berkas = await buatSlidePptx(dek());
    assert.ok((await teksCatatan(berkas)).includes(CATATAN), "catatan tidak menjadi notes");
    assert.ok(!(await teksSlide(berkas)).includes(CATATAN), "catatan ikut ke badan slide");
  });

  it("KUNCI JAWABAN TIDAK DAPAT MASUK KE SLIDE", () => {
    /*
     * Penjaga docs/16 §4.2, dan bentuknya sengaja bukan uji isi berkas:
     * `LatihanSlide` tidak punya medan `kunci` sama sekali, jadi pemanggil
     * tidak dapat mengirimkannya. Yang diperiksa di sini adalah bahwa modulnya
     * memang tidak pernah menyebut kunci — kalau seseorang menambahkannya
     * kelak, uji inilah yang berbunyi, bukan seorang mahasiswa di kelas yang
     * melihat jawabannya tersorot di layar.
     */
    const sumber = readFileSync("src/lib/dokumen/slide-pptx.ts", "utf8");
    // Komentar dibuang lebih dulu: berkas itu MENJELASKAN panjang lebar
    // mengapa kunci tidak boleh ada di sini, dan penjelasan itu harus tetap
    // boleh menyebut kata yang dilarangnya.
    const kode = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    assert.ok(!/\bkunci\b/.test(kode), "slide-pptx.ts menyebut kunci di luar komentar");
  });

  it("hanya bab yang diminta yang ikut", async () => {
    const teks = await teksSlide(await buatSlidePptx(dek(), { bab: 2 }));
    assert.ok(teks.includes("Pengurutan"));
    assert.ok(!teks.includes("Tumpukan pemanggilan"), "bab lain ikut tercetak");
  });

  it("bab yang tidak ada tetap menghasilkan berkas yang dapat dibuka", async () => {
    // Berkas tanpa satu slide pun tidak dapat dibuka PowerPoint.
    const zip = await bukaZip(await buatSlidePptx(dek(), { bab: 99 }));
    const jumlah = Object.keys(zip.files).filter((n) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(n),
    ).length;
    assert.equal(jumlah, 1);
  });

  it("berkas berbahasa Inggris memakai label Inggris", async () => {
    const teks = await teksSlide(await buatSlidePptx(dek({ bahasa: "en" })));
    assert.ok(teks.includes("CHAPTER"));
    assert.ok(teks.includes("Learning Objectives"));
    assert.ok(!teks.includes("Tujuan Pembelajaran"));
  });

  it("nama berkas menyebut babnya bila hanya satu bab", () => {
    assert.equal(namaBerkasSlide(dek()), "Struktur Data dan Algoritma.pptx");
    assert.equal(
      namaBerkasSlide(dek(), { bab: 3 }),
      "Struktur Data dan Algoritma - Bab 3.pptx",
    );
  });
});

describe("gambar di dalam slide", () => {
  it("tiap gambar menjadi slidenya sendiri, dengan medianya ikut", async () => {
    // Penuh layar, bukan terselip di samping butir — itulah cara diagram
    // ditayangkan di kelas.
    const berkas = await buatSlidePptx(dek(), { bab: 1 });
    const zip = await bukaZip(berkas);
    const media = Object.keys(zip.files).filter((n) => n.startsWith("ppt/media/"));
    assert.ok(media.length > 0, "tidak ada media di dalam .pptx");
    assert.ok((await teksSlide(berkas)).includes("Gambar 1.1"), "keterangan tidak bernomor");
  });

  it("bab tanpa gambar tidak menambah slide", async () => {
    const zip = await bukaZip(await buatSlidePptx(dek(), { bab: 2 }));
    const jumlah = Object.keys(zip.files).filter((n) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(n),
    ).length;
    assert.equal(jumlah, 2);
  });
});
