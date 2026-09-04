import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import { BATAS_GAMBAR_BAB, rapikanDiagram, type DiagramMentah } from "./keluaran-diagram";
import { periksaGayaSvg } from "./gaya-svg";
import { periksaSvgAman } from "./svg-aman";

const SVG_SAH =
  `<svg viewBox="0 0 800 400"><rect x="10" y="10" width="100" height="40" ` +
  `fill="#F3F4F6" stroke="#111827" stroke-width="1.5"/>` +
  `<text x="20" y="35" font-family="Times New Roman, serif" font-size="14" fill="#111827">A</text></svg>`;

const MMD_SAH = "flowchart TD\n  A[Mulai] --> B[Selesai]";

function d(ubah: Partial<DiagramMentah> = {}): DiagramMentah {
  return {
    judul: "Alur penelusuran",
    alt: "Bagan alur dari mulai ke selesai",
    letak: "1. Pengertian Rekursi",
    bentuk: "MERMAID",
    kode: MMD_SAH,
    ...ubah,
  };
}

describe("merapikan keluaran diagram", () => {
  it("keluaran yang benar tidak berubah dan tidak menimbulkan catatan", () => {
    const { hasil, catatan } = rapikanDiagram([d(), d({ bentuk: "SVG", kode: SVG_SAH })]);
    assert.deepEqual(catatan, []);
    assert.deepEqual(
      hasil.map((x) => [x.nomor, x.bentuk, x.letak]),
      [
        [1, "MERMAID", "1. Pengertian Rekursi"],
        [2, "SVG", "1. Pengertian Rekursi"],
      ],
    );
  });

  it("daftar kosong sah — bab boleh tanpa gambar", () => {
    // Diagram yang dipaksakan lebih buruk daripada halaman tanpa gambar.
    const { hasil, catatan } = rapikanDiagram([]);
    assert.deepEqual(hasil, []);
    assert.deepEqual(catatan, []);
  });

  it("isian kosong menjadi null", () => {
    const { hasil } = rapikanDiagram([d({ alt: "  ", letak: "" })]);
    assert.equal(hasil[0].altTeks, null);
    assert.equal(hasil[0].letak, null);
  });

  it("diagram tanpa judul, tanpa kode, atau berbentuk asing dibuang", () => {
    const { hasil, catatan } = rapikanDiagram([
      d({ judul: "  " }),
      d({ kode: "" }),
      d({ bentuk: "RASTER" }),
      d(),
    ]);
    assert.equal(hasil.length, 1);
    assert.equal(
      catatan.find((c) => c.kode === "IL-DIAGRAM-DITOLAK")?.params?.jumlah,
      3,
    );
  });

  it("SVG yang tidak aman DIBUANG, tidak ditambal", () => {
    /*
     * Menambal berarti menulis ulang gambar sampai ia lolos, dan hasilnya
     * gambar yang tidak pernah dilihat siapa pun sebelum tercetak. Yang
     * dibuang dilaporkan supaya dosen dapat meminta model menyusunnya ulang.
     */
    const jahat = `<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>`;
    const { hasil, catatan } = rapikanDiagram([
      d({ judul: "Berbahaya", bentuk: "SVG", kode: jahat }),
      d(),
    ]);
    assert.deepEqual(hasil.map((x) => x.judul), ["Alur penelusuran"]);
    assert.match(
      String(catatan.find((c) => c.kode === "IL-DIAGRAM-DITOLAK")?.params?.daftar),
      /Berbahaya/,
    );
    // Alasannya ikut, supaya yang perlu diminta berbeda dapat disebut.
    assert.ok(catatan.some((c) => c.kode === "IL-SVG-ELEMEN-TERLARANG"));
  });

  it("SVG yang aman tetapi melanggar cetakan gaya juga dibuang", () => {
    const bergradien =
      `<svg viewBox="0 0 1 1"><defs><linearGradient id="g"><stop offset="0" stop-color="#111827"/></linearGradient></defs>` +
      `<rect fill="url(#g)"/></svg>`;
    // Aman, tetapi bukan gaya buku — dan pesannya menyebut alasan yang benar.
    assert.equal(periksaSvgAman(bergradien).ok, true);
    assert.equal(periksaGayaSvg(bergradien).ok, false);

    const { hasil, catatan } = rapikanDiagram([
      d({ judul: "Bergradien", bentuk: "SVG", kode: bergradien }),
    ]);
    assert.deepEqual(hasil, []);
    assert.ok(catatan.some((c) => c.kode === "IL-GAYA-GRADIEN"));
  });

  it("Mermaid yang memuat arahan konfigurasi dibuang", () => {
    const { hasil, catatan } = rapikanDiagram([
      d({ kode: `%%{init: {"securityLevel":"loose"}}%%\n${MMD_SAH}` }),
    ]);
    assert.deepEqual(hasil, []);
    assert.ok(catatan.some((c) => c.kode === "IL-MMD-ARAHAN"));
  });

  it("alasan yang berulang hanya dilaporkan sekali", () => {
    // Lima diagram yang melanggar aturan yang sama tidak perlu lima baris.
    const jahat = `<svg viewBox="0 0 1 1"><script/></svg>`;
    const { catatan } = rapikanDiagram(
      Array.from({ length: 5 }, (_, i) =>
        d({ judul: `G${i}`, bentuk: "SVG", kode: jahat }),
      ),
    );
    assert.equal(
      catatan.filter((c) => c.kode === "IL-SVG-ELEMEN-TERLARANG").length,
      1,
    );
  });

  it("kelebihan gambar tidak diambil, dan dilaporkan", () => {
    const banyak = Array.from({ length: BATAS_GAMBAR_BAB + 3 }, (_, i) =>
      d({ judul: `Gambar ${i}` }),
    );
    const { hasil, catatan } = rapikanDiagram(banyak);
    assert.equal(hasil.length, BATAS_GAMBAR_BAB);
    assert.deepEqual(
      catatan.find((c) => c.kode === "IL-DIAGRAM-TERLALU-BANYAK")?.params,
      { n: BATAS_GAMBAR_BAB, jumlah: 3 },
    );
  });

  it("nomor selalu rapat 1..n walau ada yang dibuang", () => {
    const { hasil } = rapikanDiagram([
      d({ judul: "A" }),
      d({ judul: "B", kode: "" }),
      d({ judul: "C" }),
    ]);
    assert.deepEqual(hasil.map((x) => [x.nomor, x.judul]), [
      [1, "A"],
      [2, "C"],
    ]);
  });

  it("catatan membawa nomor babnya", () => {
    const { catatan } = rapikanDiagram([d({ kode: "" })], { bab: 7 });
    assert.ok(catatan.every((c) => c.bab === 7));
  });

  it("setiap catatan punya kalimatnya, dengan penanda terisi", () => {
    const { catatan } = rapikanDiagram(
      [
        d({ judul: "", kode: "" }),
        d({ judul: "X", bentuk: "SVG", kode: `<svg viewBox="0 0 1 1"><script/></svg>` }),
        ...Array.from({ length: BATAS_GAMBAR_BAB + 1 }, () => d()),
      ],
      { bab: 2 },
    );
    assert.ok(catatan.length >= 3);
    for (const c of catatan) {
      const pesan = pesanTemuanId(c);
      assert.doesNotMatch(pesan, /\{[a-zA-Z]+\}/, `${c.kode}: ${pesan}`);
      assert.notEqual(pesan, c.kode, `${c.kode} belum punya kalimat`);
      // Catatan perapian selalu INFO: yang gagal bukan buku dosen, melainkan
      // satu keluaran model.
      assert.equal(c.tingkat, "INFO", c.kode);
    }
  });
});
