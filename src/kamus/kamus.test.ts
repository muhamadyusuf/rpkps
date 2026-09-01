import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { en } from "./en";
import { id } from "./id";

/**
 * Penjaga kamus.
 *
 * Kelengkapan kunci sebetulnya sudah dijamin `tsc` lewat `en: Kamus`. Yang
 * TIDAK dijamin tipe adalah tiga hal yang justru paling sering terjadi:
 * nilai kosong yang lolos karena `""` tetap `string`, terjemahan yang lupa
 * membawa penanda sisipannya sehingga angkanya lenyap dari kalimat, dan
 * kunci yang dihapus dari `id.ts` tetapi tertinggal di `en.ts`.
 */

type Simpul = Record<string, unknown>;

function ratakan(objek: Simpul, awalan = ""): Map<string, string> {
  const hasil = new Map<string, string>();
  for (const [kunci, nilai] of Object.entries(objek)) {
    const jalur = awalan ? `${awalan}.${kunci}` : kunci;
    if (typeof nilai === "string") hasil.set(jalur, nilai);
    else if (nilai && typeof nilai === "object") {
      for (const [k, v] of ratakan(nilai as Simpul, jalur)) hasil.set(k, v);
    } else {
      throw new Error(`Nilai kamus bukan string maupun objek: ${jalur}`);
    }
  }
  return hasil;
}

function penanda(pola: string): string[] {
  return [...pola.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

const rataId = ratakan(id);
const rataEn = ratakan(en);

describe("kamus", () => {
  it("kedua bahasa punya kunci yang sama persis", () => {
    assert.deepEqual([...rataEn.keys()].sort(), [...rataId.keys()].sort());
  });

  it("tidak ada nilai kosong", () => {
    for (const [nama, peta] of [
      ["id", rataId],
      ["en", rataEn],
    ] as const) {
      for (const [kunci, nilai] of peta) {
        assert.ok(nilai.trim().length > 0, `${nama}.${kunci} kosong`);
      }
    }
  });

  it("penanda sisipan terbawa utuh ke terjemahan", () => {
    for (const [kunci, pola] of rataId) {
      assert.deepEqual(
        penanda(rataEn.get(kunci)!),
        penanda(pola),
        `penanda pada "${kunci}" tidak sama antara id dan en`,
      );
    }
  });

  it("akronim resmi tidak diterjemahkan", () => {
    // Menerjemahkan RPKPS/CPL/CPMK memutus dokumen dari peraturan yang
    // menaunginya. Kalau kunci ini berubah, itu keputusan besar — bukan
    // sesuatu yang layak lolos tanpa terlihat. Lihat docs/11 §3.4.
    assert.equal(en.menu.rpkps, "RPKPS");
  });
});
