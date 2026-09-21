import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BATAS_LOGO,
  periksaLogo,
  rapikanMisi,
  rapikanSitus,
  rapikanSurel,
  rapikanTelepon,
  tinggiSkala,
} from "./identitas-prodi";

/** PNG paling ringkas yang kepala IHDR-nya lengkap. Isinya tidak dibaca. */
function png(lebar: number, tinggi: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x00, 0x00, 0x00, 0x0d], 8);
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(b.buffer).setUint32(16, lebar);
  new DataView(b.buffer).setUint32(20, tinggi);
  return b;
}

/**
 * JPEG dengan satu segmen APP0 di depan SOF0, supaya yang diuji benar-benar
 * penelusuran segmennya — bukan pembacaan offset tetap yang kebetulan cocok.
 */
function jpeg(lebar: number, tinggi: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof0 = [
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (tinggi >> 8) & 0xff, tinggi & 0xff,
    (lebar >> 8) & 0xff, lebar & 0xff,
    ...new Array(8).fill(0),
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0]);
}

describe("penerimaan logo", () => {
  it("membaca dimensi PNG dari IHDR", () => {
    assert.deepEqual(periksaLogo(png(512, 256)), {
      ok: true,
      logo: { tipe: "image/png", lebar: 512, tinggi: 256 },
    });
  });

  it("membaca dimensi JPEG dengan melewati segmen di depan SOF", () => {
    assert.deepEqual(periksaLogo(jpeg(400, 300)), {
      ok: true,
      logo: { tipe: "image/jpeg", lebar: 400, tinggi: 300 },
    });
  });

  /**
   * Inti aturannya (docs/21 §2.2): jenis diputuskan dari BITA, bukan dari
   * `Content-Type`. Berkas yang menyebut dirinya PNG tetapi isinya bukan
   * gambar harus tertahan di sini — bukan di Word, yang akan menolak seluruh
   * dokumen tanpa menyebut gambar mana penyebabnya.
   */
  it("menolak bita yang bukan PNG maupun JPEG", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    assert.deepEqual(periksaLogo(svg), { ok: false, sebab: "bukanGambar" });
    assert.deepEqual(periksaLogo(new TextEncoder().encode("%PDF-1.7")), {
      ok: false,
      sebab: "bukanGambar",
    });
  });

  it("menolak PNG yang tandanya benar tetapi chunk pertamanya bukan IHDR", () => {
    const b = png(512, 512);
    b.set([0x49, 0x44, 0x41, 0x54], 12); // "IDAT"
    assert.deepEqual(periksaLogo(b), { ok: false, sebab: "bukanGambar" });
  });

  it("menolak yang kosong, kekecilan, kebesaran, dan terlalu berat", () => {
    assert.deepEqual(periksaLogo(new Uint8Array(0)), { ok: false, sebab: "kosong" });
    assert.deepEqual(periksaLogo(png(64, 64)), { ok: false, sebab: "terlaluKecil" });
    assert.deepEqual(periksaLogo(png(3000, 3000)), { ok: false, sebab: "terlaluLebar" });

    const berat = new Uint8Array(BATAS_LOGO.bita + 1);
    berat.set(png(512, 512), 0);
    assert.deepEqual(periksaLogo(berat), { ok: false, sebab: "terlaluBesar" });
  });

  it("menghitung tinggi tampil tanpa menggepengkan nisbah", () => {
    assert.equal(tinggiSkala({ lebar: 400, tinggi: 200 }, 1134), 567);
    assert.equal(tinggiSkala({ lebar: 0, tinggi: 200 }, 1134), 1134);
  });
});

describe("perapian kontak", () => {
  it("melengkapi skema yang hilang dengan https", () => {
    assert.equal(rapikanSitus("ti.itts.ac.id"), "https://ti.itts.ac.id");
    assert.equal(rapikanSitus("http://ti.itts.ac.id/"), "http://ti.itts.ac.id");
  });

  /**
   * Nilai ini berakhir sebagai `href` pada halaman katalog PUBLIK. Skema
   * selain http/https yang lolos ke sana adalah celah XSS yang dipasang
   * tangan sendiri.
   */
  it("menolak skema selain http dan https", () => {
    assert.equal(rapikanSitus("javascript:alert(1)"), null);
    assert.equal(rapikanSitus("data:text/html,<script>"), null);
    assert.equal(rapikanSitus("mailto:ti@itts.ac.id"), null);
  });

  it("menolak host tanpa titik dan teks kosong", () => {
    assert.equal(rapikanSitus("localhost"), null);
    assert.equal(rapikanSitus("   "), null);
  });

  it("menjaga surel tetap satu baris tanpa spasi", () => {
    assert.equal(rapikanSurel(" ti@itts.ac.id "), "ti@itts.ac.id");
    assert.equal(rapikanSurel("ti@itts"), null);
    assert.equal(rapikanSurel("a@b.c, c@d.e"), null);
    assert.equal(rapikanSurel("Prodi TI <ti@itts.ac.id>"), null);
  });

  it("menerima nomor telepon yang lazim, menolak yang bukan nomor", () => {
    assert.equal(rapikanTelepon(" (021) 1234   5678 "), "(021) 1234 5678");
    assert.equal(rapikanTelepon("+62 21 1234-5678"), "+62 21 1234-5678");
    assert.equal(rapikanTelepon("hubungi kami"), null);
    assert.equal(rapikanTelepon("(021)"), null);
  });

  /**
   * Nomor cetak butir misi adalah POSISINYA. Butir kosong yang tertinggal di
   * tengah berarti "Misi 3" yang tidak berbunyi apa-apa di berkas cetak.
   */
  it("merapatkan butir misi dan membuang yang kosong", () => {
    assert.deepEqual(rapikanMisi(["  Satu ", "", "   ", "Tiga"]), ["Satu", "Tiga"]);
    assert.deepEqual(rapikanMisi([]), []);
  });

  it("membatasi jumlah butir misi", () => {
    const banyak = Array.from({ length: 30 }, (_, i) => `Misi ${i + 1}`);
    assert.equal(rapikanMisi(banyak).length, 15);
  });
});
