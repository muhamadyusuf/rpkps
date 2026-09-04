import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import {
  BATAS_KATA_KALIMAT,
  hitungKata,
  istilahTakSeragam,
  periksaNaskah,
  taksiranHalaman,
  type BabNaskah,
  type NaskahBuku,
} from "./naskah";

function bab(nomor: number, ubah: Partial<BabNaskah> = {}): BabNaskah {
  return {
    nomor,
    judul: `Bab ${nomor}`,
    tujuan: ["Mahasiswa mampu menjelaskan rekursi"],
    uraian:
      "1. Pengertian\nRekursi adalah teknik penyelesaian masalah. Fungsi memanggil dirinya sendiri.",
    ringkasan: "Bab ini menjelaskan rekursi.",
    sitiran: [1],
    ...ubah,
  };
}

function buku(ubah: Partial<NaskahBuku> = {}): NaskahBuku {
  return {
    bab: [bab(1), bab(2), bab(3)],
    glosarium: [{ istilah: "Rekursi", arti: "Fungsi memanggil dirinya." }],
    pustaka: [{ nomor: 1 }],
    ...ubah,
  };
}

function kode(n: NaskahBuku): string[] {
  return periksaNaskah(n).temuan.map((t) => t.kode);
}

describe("pemeriksaan naskah mekanis", () => {
  it("naskah yang rapi tidak memunculkan satu temuan pun", () => {
    assert.deepEqual(periksaNaskah(buku()).temuan, []);
  });

  it("menghitung kata dan menaksir tebalnya", () => {
    assert.equal(hitungKata("Satu dua tiga, empat."), 4);
    assert.equal(hitungKata(""), 0);
    // 350 kata per halaman B5; sebuah TAKSIRAN, dan disebut begitu di layar.
    assert.equal(taksiranHalaman(350), 1);
    assert.equal(taksiranHalaman(351), 2);
  });

  it("kalimat yang terlalu panjang ditandai beserta potongannya", () => {
    const panjang = `1. Pengertian\n${"kata ".repeat(BATAS_KATA_KALIMAT + 5)}akhir.`;
    const hasil = periksaNaskah(buku({ bab: [bab(1, { uraian: panjang })] }));
    const t = hasil.temuan.find((x) => x.kode === "NS-KALIMAT-PANJANG");
    assert.equal(t?.bab, 1);
    assert.equal(t?.params?.n, BATAS_KATA_KALIMAT);
    assert.equal(hasil.ringkasan.kalimatPanjang, 1);
  });

  it("paragraf yang terlalu tebal ditandai", () => {
    const tebal = `1. Pengertian\n${"kata ".repeat(200)}`;
    assert.ok(kode(buku({ bab: [bab(1, { uraian: tebal })] })).includes("NS-PARAGRAF-PANJANG"));
  });

  it("TUJUAN YANG TIDAK PERNAH TERSENTUH URAIAN DITANDAI", () => {
    /*
     * Pemeriksaan paling khas OBE di seluruh aplikasi. Bab yang menjanjikan
     * "mampu menghitung" tetapi tidak pernah menghitung apa pun tidak
     * melanggar satu aturan tata bahasa pun — ia hanya gagal mengajar apa yang
     * dijanjikannya.
     */
    const luput = buku({
      bab: [
        bab(1, {
          tujuan: ["Mahasiswa mampu menghitung kompleksitas algoritma"],
          uraian: "1. Pengertian\nRekursi adalah teknik penyelesaian masalah.",
          ringkasan: "Bab ini menjelaskan rekursi.",
        }),
      ],
    });
    const t = periksaNaskah(luput).temuan.find((x) => x.kode === "NS-TUJUAN-TAK-TERSENTUH");
    assert.equal(t?.bab, 1);
    assert.match(String(t?.params?.daftar), /menghitung/);
  });

  it("kata berimbuhan tetap dikenali sebagai pemenuhan tujuan", () => {
    // "menghitung" pada tujuan sering muncul sebagai "dihitung" di uraian.
    const terpenuhi = buku({
      bab: [
        bab(1, {
          tujuan: ["Mahasiswa mampu menghitung kompleksitas"],
          uraian: "1. Kompleksitas\nKompleksitas dihitung dari jumlah operasinya.",
          ringkasan: null,
        }),
      ],
    });
    assert.ok(!kode(terpenuhi).includes("NS-TUJUAN-TAK-TERSENTUH"));
  });

  it("bab yang panjangnya timpang ditandai", () => {
    const timpang = buku({
      bab: [
        bab(1, { uraian: `1. A\n${"kata ".repeat(400)}` }),
        bab(2, { uraian: `1. B\n${"kata ".repeat(400)}` }),
        bab(3, { uraian: "1. C\nSatu kalimat saja." }),
      ],
    });
    const t = periksaNaskah(timpang).temuan.find((x) => x.kode === "NS-BAB-TIMPANG");
    assert.match(String(t?.params?.daftar), /3/);
  });

  it("pustaka yang tidak pernah disitir dan bab tanpa sitiran ditandai", () => {
    const n = buku({
      bab: [bab(1, { sitiran: [] })],
      pustaka: [{ nomor: 1 }, { nomor: 2 }],
    });
    const semua = kode(n);
    assert.ok(semua.includes("NS-BAB-TANPA-SITIRAN"));
    assert.ok(semua.includes("NS-PUSTAKA-TAK-DISITIR"));
  });

  it("bab kosong tidak dituduh tanpa sitiran", () => {
    // Bab yang belum ditulis punya masalah lain, dan itu bukan urusan modul ini.
    const n = buku({ bab: [bab(1, { uraian: "", sitiran: [] })] });
    assert.ok(!kode(n).includes("NS-BAB-TANPA-SITIRAN"));
  });

  it("istilah glosarium yang tidak dipakai ditandai", () => {
    const n = buku({ glosarium: [{ istilah: "Antrean", arti: "…" }] });
    assert.ok(kode(n).includes("NS-GLOSARIUM-TAK-DIPAKAI"));
  });

  it("setiap temuan punya kalimatnya, dengan penanda terisi", () => {
    const n = buku({
      bab: [
        bab(1, {
          tujuan: ["Mahasiswa mampu menghitung kompleksitas"],
          uraian: `1. A\n${"kata ".repeat(200)}`,
          ringkasan: null,
          sitiran: [],
        }),
        bab(2, { uraian: "1. B\nPendek." }),
        bab(3, { uraian: `1. C\n${"kata ".repeat(400)}` }),
      ],
      glosarium: [{ istilah: "Antrean", arti: "…" }],
      pustaka: [{ nomor: 1 }, { nomor: 9 }],
    });
    const hasil = periksaNaskah(n);
    assert.ok(hasil.temuan.length >= 5);
    for (const t of hasil.temuan) {
      const pesan = pesanTemuanId(t);
      assert.doesNotMatch(pesan, /\{[a-zA-Z]+\}/, `${t.kode}: ${pesan}`);
      assert.notEqual(pesan, t.kode, `${t.kode} belum punya kalimat`);
    }
  });
});

describe("ejaan istilah yang tidak seragam", () => {
  it("menemukan varian tanda hubung", () => {
    const teks = "Alamat e-mail dosen. E-mail itu penting. Setiap email dicatat.";
    const hasil = istilahTakSeragam(teks);
    assert.equal(hasil.length, 1, JSON.stringify(hasil));
    assert.deepEqual(hasil[0].map((v) => v.toLowerCase()).sort(), ["e-mail", "e-mail", "email"]);
  });

  it("PERBEDAAN SPASI TIDAK TERDETEKSI, DAN ITU BATAS YANG DISADARI", () => {
    /*
     * "Sub-CPMK" dan "Sub CPMK" tidak dapat dibandingkan oleh pemeriksa yang
     * bekerja per kata: yang kedua terpecah menjadi dua kata sebelum sempat
     * dibandingkan. Menangkapnya menuntut pencarian frasa, dan frasa dua kata
     * yang kebetulan berdampingan akan melahirkan lebih banyak gangguan
     * daripada temuan. Yang seperti ini diserahkan ke tugas AI TINJAU_NASKAH,
     * yang memang menilai istilah dengan pertimbangan.
     */
    assert.deepEqual(
      istilahTakSeragam("Sub-CPMK pertama. Sub CPMK kedua. Sub-CPMK ketiga."),
      [],
    );
  });

  it("HURUF BESAR DI AWAL KALIMAT BUKAN KETIDAKSERAGAMAN", () => {
    /*
     * Tanpa aturan ini, setiap kata benda yang pernah mengawali kalimat akan
     * dilaporkan — dan daftar yang penuh gangguan adalah daftar yang berhenti
     * dibaca orang.
     */
    const teks = "Rekursi itu penting. Fungsi memakai rekursi. rekursi lagi. Rekursi juga.";
    assert.deepEqual(istilahTakSeragam(teks), []);
  });

  it("kata yang jarang muncul tidak dinilai", () => {
    // Sekali di awal kalimat dan sekali di tengah bukan ketidakseragaman.
    assert.deepEqual(istilahTakSeragam("Antrean penting. antrean itu."), []);
  });
});
