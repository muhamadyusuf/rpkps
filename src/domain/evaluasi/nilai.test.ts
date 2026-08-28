import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bacaNilai, type BarisMentah } from "./nilai";

const ASESMEN = [{ kode: "M2" }, { kode: "M5" }, { kode: "UTS" }, { kode: "UAS" }];

function baris(nomor: number, nim: string, nama: string, skor: Record<string, string>): BarisMentah {
  return { nomor, nim, nama, skor };
}

function berkasSehat(): BarisMentah[] {
  return [
    baris(2, "1101", "Ali", { M2: "80", M5: "75", UTS: "68", UAS: "90" }),
    baris(3, "1102", "Budi", { M2: "60", M5: "65", UTS: "55", UAS: "70" }),
  ];
}

function kode(h: { temuan: { kode: string }[] }): string[] {
  return h.temuan.map((t) => t.kode);
}

describe("berkas nilai sehat", () => {
  it("terbaca tanpa temuan", () => {
    const h = bacaNilai(berkasSehat(), ASESMEN);
    assert.deepEqual(h.temuan, []);
    assert.equal(h.lolos, true);
    assert.equal(h.ringkasan.persenLengkap, 100);
    assert.equal(h.baris.length, 2);
    assert.deepEqual(h.baris[0].skor, { M2: 80, M5: 75, UTS: 68, UAS: 90 });
  });

  it("menerima koma desimal", () => {
    const h = bacaNilai([baris(2, "1101", "Ali", { M2: "78,5", M5: "70", UTS: "70", UAS: "70" })], ASESMEN);
    assert.equal(h.baris[0].skor.M2, 78.5);
    assert.equal(h.lolos, true);
  });
});

describe("kolom yang tidak cocok dengan rencana", () => {
  it("mengabaikan kolom asing dengan peringatan", () => {
    const b = berkasSehat();
    b[0].skor.KUIS9 = "80";
    const h = bacaNilai(b, ASESMEN);
    assert.ok(kode(h).includes("NL-KOLOM-ASING"));
    assert.deepEqual(h.ringkasan.kolomAsing, ["KUIS9"]);
    assert.equal(h.lolos, true);
    assert.ok(!("KUIS9" in h.baris[0].skor));
  });

  it("menandai asesmen yang tidak punya kolom", () => {
    const b = berkasSehat().map((x) => ({ ...x, skor: { M2: x.skor.M2, M5: x.skor.M5, UTS: x.skor.UTS } }));
    const h = bacaNilai(b, ASESMEN);
    assert.ok(kode(h).includes("NL-KOLOM-HILANG"));
    assert.deepEqual(h.ringkasan.kolomHilang, ["UAS"]);
    assert.equal(h.baris[0].skor.UAS, null);
  });
});

describe("baris yang bermasalah", () => {
  it("melewati baris kosong di ujung berkas tanpa mengeluh", () => {
    const b = [...berkasSehat(), baris(4, "", "", { M2: "", M5: "", UTS: "", UAS: "" })];
    const h = bacaNilai(b, ASESMEN);
    assert.equal(h.baris.length, 2);
    assert.deepEqual(h.temuan, []);
  });

  it("menolak baris berisi nilai tanpa NIM", () => {
    const b = [...berkasSehat(), baris(4, "", "", { M2: "80", M5: "", UTS: "", UAS: "" })];
    const h = bacaNilai(b, ASESMEN);
    assert.ok(kode(h).includes("NL-NIM-KOSONG"));
    assert.equal(h.lolos, false);
  });

  it("menolak NIM ganda dan menyebut kedua barisnya", () => {
    const b = [...berkasSehat(), baris(4, "1101", "Ali (lagi)", { M2: "90", M5: "", UTS: "", UAS: "" })];
    const h = bacaNilai(b, ASESMEN);
    const t = h.temuan.find((x) => x.kode === "NL-NIM-GANDA")!;
    assert.ok(t.pesan.includes("baris 2 dan 4"));
    assert.equal(h.baris.length, 2);
  });

  it("memperingatkan nama kosong tanpa memblokir", () => {
    const b = berkasSehat();
    b[1].nama = "";
    const h = bacaNilai(b, ASESMEN);
    assert.ok(kode(h).includes("NL-NAMA-KOSONG"));
    assert.equal(h.lolos, true);
  });
});

describe("skor yang bermasalah", () => {
  it("menolak isi yang bukan angka", () => {
    const b = berkasSehat();
    b[0].skor.UTS = "belum ujian";
    const h = bacaNilai(b, ASESMEN);
    assert.ok(kode(h).includes("NL-SKOR-BUKAN-ANGKA"));
    assert.equal(h.lolos, false);
    assert.equal(h.baris[0].skor.UTS, null);
  });

  it("menolak skor di luar 0–100", () => {
    const b = berkasSehat();
    b[0].skor.UAS = "120";
    b[1].skor.M2 = "-5";
    const h = bacaNilai(b, ASESMEN);
    assert.equal(h.temuan.filter((t) => t.kode === "NL-SKOR-DILUAR-RENTANG").length, 2);
  });

  it("membedakan sel kosong dari nilai nol", () => {
    const b = [baris(2, "1101", "Ali", { M2: "0", M5: "", UTS: "70", UAS: "70" })];
    const h = bacaNilai(b, ASESMEN);
    assert.equal(h.baris[0].skor.M2, 0);
    assert.equal(h.baris[0].skor.M5, null);
    assert.equal(h.ringkasan.selTerisi, 3);
    assert.ok(kode(h).includes("NL-BELUM-LENGKAP"));
    assert.equal(h.lolos, true); // belum lengkap boleh disimpan
  });
});
