import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periksaGayaSvg } from "./gaya-svg";
import { periksaSvgAman } from "./svg-aman";
import {
  geserSimpul,
  hapusSimpul,
  kotakSimpul,
  simpulPada,
  ubahAtributSimpul,
  ubahTeksSimpul,
  ubahUkuranSimpul,
  uraiSvg,
  viewBoxDari,
} from "./svg-model";

const SVG = `<svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg">
  <!-- catatan penyusun -->
  <rect x="10" y="20" width="100" height="60" fill="#F3F4F6" stroke="#111827" stroke-width="1.5"/>
  <circle cx="300" cy="100" r="40" fill="none" stroke="#111827" stroke-width="1.5"/>
  <line x1="120" y1="50" x2="260" y2="100" stroke="#6B7280" stroke-width="1.5"/>
  <text x="20" y="120" font-family="Times New Roman, serif" font-size="14" fill="#111827">Mulai</text>
  <polyline points="400,10 450,60 500,10" fill="none" stroke="#111827" stroke-width="1.5"/>
  <path d="M600 100 L700 200" stroke="#111827" stroke-width="1.5" fill="none"/>
</svg>`;

function simpul(svg: string, tag: string) {
  const s = uraiSvg(svg).find((x) => x.tag === tag);
  assert.ok(s, `simpul ${tag} tidak ditemukan`);
  return s;
}

describe("mengurai SVG", () => {
  it("menemukan setiap elemen beserta atributnya", () => {
    const semua = uraiSvg(SVG);
    assert.deepEqual(
      semua.map((s) => s.tag),
      ["svg", "rect", "circle", "line", "text", "polyline", "path"],
    );
    assert.equal(simpul(SVG, "rect").atribut.get("width")?.nilai, "100");
  });

  it("mencatat posisi nilai atribut di dalam berkas aslinya", () => {
    // Inilah yang membuat penyuntingan dapat mengganti potongan saja.
    const rect = simpul(SVG, "rect");
    const x = rect.atribut.get("x")!;
    assert.equal(SVG.slice(x.awal, x.akhir), "10");
  });

  it("mengambil isi teks beserta posisinya", () => {
    const teks = simpul(SVG, "text");
    assert.equal(teks.teks?.nilai, "Mulai");
    assert.equal(SVG.slice(teks.teks!.awal, teks.teks!.akhir), "Mulai");
  });

  it("komentar tidak menjadi simpul", () => {
    assert.ok(!uraiSvg(SVG).some((s) => s.tag.includes("!")));
  });

  it("viewBox terbaca", () => {
    assert.deepEqual(viewBoxDari(SVG), { x: 0, y: 0, lebar: 800, tinggi: 400 });
    assert.equal(viewBoxDari("<svg/>"), null);
  });
});

describe("kotak simpul", () => {
  it("dihitung untuk tiap jenis yang dapat disunting", () => {
    assert.deepEqual(kotakSimpul(simpul(SVG, "rect")), {
      x: 10,
      y: 20,
      lebar: 100,
      tinggi: 60,
    });
    assert.deepEqual(kotakSimpul(simpul(SVG, "circle")), {
      x: 260,
      y: 60,
      lebar: 80,
      tinggi: 80,
    });
    assert.deepEqual(kotakSimpul(simpul(SVG, "line")), {
      x: 120,
      y: 50,
      lebar: 140,
      tinggi: 50,
    });
    assert.deepEqual(kotakSimpul(simpul(SVG, "polyline")), {
      x: 400,
      y: 10,
      lebar: 100,
      tinggi: 50,
    });
  });

  it("kotak teks memakai garis alas, bukan tepi atas", () => {
    // `y` sebuah <text> adalah garis alasnya; kotak yang menganggapnya tepi
    // atas akan tergambar di bawah tulisannya.
    const k = kotakSimpul(simpul(SVG, "text"))!;
    assert.ok(k.y < 120, "kotak teks tidak naik ke atas garis alas");
    assert.ok(k.tinggi > 0 && k.lebar > 0);
  });

  it("translate ikut diperhitungkan", () => {
    const digeser = SVG.replace('<rect x="10"', '<rect transform="translate(5,7)" x="10"');
    const k = kotakSimpul(simpul(digeser, "rect"))!;
    assert.deepEqual([k.x, k.y], [15, 27]);
  });
});

describe("memilih simpul pada sebuah titik", () => {
  it("memilih yang paling atas", () => {
    // Yang belakangan digambar menutupi yang lebih dahulu.
    const bertumpuk =
      `<svg viewBox="0 0 100 100">` +
      `<rect x="0" y="0" width="50" height="50" fill="none"/>` +
      `<rect x="10" y="10" width="20" height="20" fill="none"/>` +
      `</svg>`;
    const s = simpulPada(uraiSvg(bertumpuk), 15, 15);
    assert.equal(s?.indeks, 2);
  });

  it("garis tipis tetap dapat diklik lewat toleransi", () => {
    const s = simpulPada(uraiSvg(SVG), 190, 75, 6);
    assert.equal(s?.tag, "line");
  });

  it("titik kosong tidak memilih apa pun", () => {
    assert.equal(simpulPada(uraiSvg(SVG), 780, 380), null);
  });

  it("tag svg sendiri tidak pernah terpilih", () => {
    const s = simpulPada(uraiSvg(`<svg viewBox="0 0 10 10"><rect x="1" y="1" width="2" height="2"/></svg>`), 2, 2);
    assert.equal(s?.tag, "rect");
  });
});

describe("menggeser", () => {
  it("rect, circle, line, polyline, dan teks bergeser dengan koordinatnya", () => {
    let svg = SVG;
    for (const tag of ["rect", "circle", "line", "polyline", "text"]) {
      svg = geserSimpul(svg, simpul(svg, tag), 10, 5);
    }
    assert.match(svg, /<rect x="20" y="25"/);
    assert.match(svg, /cx="310" cy="105"/);
    assert.match(svg, /x1="130" y1="55" x2="270" y2="105"/);
    assert.match(svg, /points="410,15 460,65 510,15"/);
    assert.match(svg, /<text x="30" y="125"/);
  });

  it("path bergeser lewat transform, bukan dengan menulis ulang d", () => {
    /*
     * Menyunting `d` menuntut pengurai lintasan lengkap; satu kesalahan di
     * sana mengubah BENTUK gambarnya, bukan sekadar posisinya.
     */
    const svg = geserSimpul(SVG, simpul(SVG, "path"), 10, 20);
    assert.match(svg, /transform="translate\(10,20\)"/);
    assert.match(svg, /d="M600 100 L700 200"/, "d ikut berubah");
  });

  it("translate yang sudah ada ditambahkan, bukan ditumpuk", () => {
    const sekali = geserSimpul(SVG, simpul(SVG, "path"), 10, 20);
    const dua = geserSimpul(sekali, simpul(sekali, "path"), 5, 5);
    assert.match(dua, /transform="translate\(15,25\)"/);
    assert.equal((dua.match(/translate\(/g) ?? []).length, 1);
  });

  it("SUNTINGAN TIDAK MENGUBAH BAGIAN LAIN BERKAS", () => {
    /*
     * Alasan seluruh modul ini menyunting teks alih-alih menyusun ulang pohon:
     * dosen yang membuka tab kode setelah menggeser satu kotak harus menemukan
     * berkas yang sama — bukan berkasnya yang diformat ulang.
     */
    const svg = geserSimpul(SVG, simpul(SVG, "rect"), 1, 1);
    assert.ok(svg.includes("<!-- catatan penyusun -->"), "komentar hilang");
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes('font-family="Times New Roman, serif"'));
    // Yang berubah hanya dua angka.
    assert.equal(svg.split("\n").length, SVG.split("\n").length);
  });
});

describe("mengubah ukuran", () => {
  it("rect memakai width dan height", () => {
    const svg = ubahUkuranSimpul(SVG, simpul(SVG, "rect"), 200, 90);
    assert.match(svg, /width="200" height="90"/);
  });

  it("circle memakai jari-jari terkecil dari kedua sisi", () => {
    const svg = ubahUkuranSimpul(SVG, simpul(SVG, "circle"), 100, 60);
    assert.match(svg, /r="30"/);
  });

  it("teks mengubah ukuran huruf, dan tidak pernah di bawah ambang", () => {
    // Ambang 12 adalah aturan cetakan gaya; penyunting visual tidak boleh
    // menjadi pintu belakang yang melewatinya.
    const besar = ubahUkuranSimpul(SVG, simpul(SVG, "text"), 100, 36);
    assert.match(besar, /font-size="30"/);
    const kecil = ubahUkuranSimpul(SVG, simpul(SVG, "text"), 100, 2);
    assert.match(kecil, /font-size="12"/);
  });

  it("jenis yang tidak mendukung dibiarkan utuh", () => {
    assert.equal(ubahUkuranSimpul(SVG, simpul(SVG, "path"), 10, 10), SVG);
  });
});

describe("mengubah teks dan atribut", () => {
  it("isi teks diganti, aksara XML dilarikan", () => {
    const svg = ubahTeksSimpul(SVG, simpul(SVG, "text"), "Selesai & lanjut <x>");
    assert.match(svg, />Selesai &amp; lanjut &lt;x&gt;</);
    assert.equal(periksaSvgAman(svg).ok, true, "hasilnya tidak lagi aman");
  });

  it("atribut yang sudah ada diganti", () => {
    const svg = ubahAtributSimpul(SVG, simpul(SVG, "rect"), "fill", "#FFFFFF");
    assert.match(svg, /<rect[^>]*fill="#FFFFFF"/);
  });

  it("atribut yang belum ada disisipkan", () => {
    const polos = `<svg viewBox="0 0 10 10"><rect/></svg>`;
    const svg = ubahAtributSimpul(polos, simpul(polos, "rect"), "fill", "none");
    assert.match(svg, /<rect fill="none"\/>/);
  });
});

describe("menghapus", () => {
  it("elemen tunggal hilang seluruhnya", () => {
    const svg = hapusSimpul(SVG, simpul(SVG, "circle"));
    assert.ok(!svg.includes("<circle"));
    assert.equal(uraiSvg(svg).length, uraiSvg(SVG).length - 1);
  });

  it("elemen berpasangan hilang beserta penutupnya", () => {
    const svg = hapusSimpul(SVG, simpul(SVG, "text"));
    assert.ok(!svg.includes("<text"));
    assert.ok(!svg.includes("</text>"));
    assert.ok(!svg.includes("Mulai"));
  });
});

describe("hasil suntingan tetap sah", () => {
  it("setiap operasi menghasilkan SVG yang lolos kedua pemeriksa", () => {
    /*
     * Penjaga yang paling menentukan: penyunting visual TIDAK BOLEH menjadi
     * pintu belakang yang melewati sanitasi maupun cetakan gaya. Kalau uji ini
     * gagal, ada operasi yang menghasilkan berkas yang tidak akan pernah dapat
     * disimpan — dan gagalnya baru terlihat di tangan dosen.
     */
    const langkah: ((s: string) => string)[] = [
      (s) => geserSimpul(s, simpul(s, "rect"), 12, -3),
      (s) => geserSimpul(s, simpul(s, "path"), 4, 4),
      (s) => ubahUkuranSimpul(s, simpul(s, "rect"), 150, 70),
      (s) => ubahUkuranSimpul(s, simpul(s, "text"), 100, 20),
      (s) => ubahTeksSimpul(s, simpul(s, "text"), "Selesai"),
      (s) => ubahAtributSimpul(s, simpul(s, "rect"), "fill", "#FFFFFF"),
      (s) => hapusSimpul(s, simpul(s, "circle")),
    ];

    let svg = SVG;
    for (const [i, langkahnya] of langkah.entries()) {
      svg = langkahnya(svg);
      assert.equal(periksaSvgAman(svg).ok, true, `langkah ${i}: tidak aman`);
      assert.equal(periksaGayaSvg(svg).ok, true, `langkah ${i}: melanggar gaya`);
    }
  });
});
