import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BAWAAN_HARI_BERBAGI,
  MAKS_HARI_BERBAGI,
  bolehDibuka,
  hitungKedaluwarsa,
  jepitHari,
  sisaHari,
  statusTautan,
} from "./berbagi";

const sekarang = new Date("2026-09-04T09:00:00Z");
const hari = (n: number) => new Date(sekarang.getTime() + n * 86_400_000);

describe("umur tautan pratinjau", () => {
  it("menjepit permintaan yang melampaui batas atas", () => {
    assert.equal(jepitHari(365), MAKS_HARI_BERBAGI);
    assert.equal(jepitHari(90), 90);
    assert.equal(jepitHari(14), 14);
  });

  it("tidak pernah menghasilkan tautan berumur nol atau negatif", () => {
    assert.equal(jepitHari(0), 1);
    assert.equal(jepitHari(-30), 1);
  });

  it("masukan yang bukan angka jatuh ke bawaan, bukan ke NaN", () => {
    assert.equal(jepitHari(Number.NaN), BAWAAN_HARI_BERBAGI);
  });

  it("kedaluwarsa dihitung dari sekarang", () => {
    assert.equal(
      hitungKedaluwarsa(14, sekarang).toISOString(),
      hari(14).toISOString(),
    );
  });
});

describe("keadaan tautan", () => {
  const aktif = { kedaluwarsa: hari(3), dicabutPada: null };

  it("tautan yang belum lewat dan belum dicabut boleh dibuka", () => {
    assert.equal(statusTautan(aktif, sekarang), "AKTIF");
    assert.ok(bolehDibuka(aktif, sekarang));
  });

  it("tautan yang lewat tenggat tertutup dengan sendirinya", () => {
    const t = { kedaluwarsa: hari(-1), dicabutPada: null };
    assert.equal(statusTautan(t, sekarang), "KEDALUWARSA");
    assert.ok(!bolehDibuka(t, sekarang));
  });

  it("pencabutan menang atas kedaluwarsa — itu keputusan seseorang", () => {
    const t = { kedaluwarsa: hari(-5), dicabutPada: hari(-6) };
    assert.equal(statusTautan(t, sekarang), "DICABUT");
  });

  it("dicabut menutup pintu meski umurnya masih panjang", () => {
    const t = { kedaluwarsa: hari(80), dicabutPada: hari(-1) };
    assert.equal(statusTautan(t, sekarang), "DICABUT");
    assert.ok(!bolehDibuka(t, sekarang));
  });

  it("tepat pada detik kedaluwarsa, pintu sudah tertutup", () => {
    const t = { kedaluwarsa: sekarang, dicabutPada: null };
    assert.ok(!bolehDibuka(t, sekarang));
  });

  it("sisa hari tidak pernah negatif", () => {
    assert.equal(sisaHari(hari(-9), sekarang), 0);
    assert.equal(sisaHari(hari(2), sekarang), 2);
  });
});
