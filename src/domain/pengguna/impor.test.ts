import assert from "node:assert/strict";
import { test } from "node:test";
import { rakitPenggunaImpor, type BarisPenggunaMentah } from "./impor";

const PRODI = [{ id: "p-ti", kode: "TI" }];
const baris = (over: Partial<BarisPenggunaMentah>): BarisPenggunaMentah => ({
  baris: 2,
  email: "a@x.id",
  nama: "A",
  peran: "ASESOR",
  prodiKode: "",
  ...over,
});

test("impor: hanya untuk non-pegawai — ASESOR dan MAHASISWA lolos", () => {
  const { siap, galat } = rakitPenggunaImpor(
    [baris({ email: "a@x.id", peran: "ASESOR" }), baris({ baris: 3, email: "m@x.id", peran: "MAHASISWA", prodiKode: "ti" })],
    PRODI,
  );
  assert.equal(galat.length, 0);
  assert.deepEqual(siap.map((b) => [b.peran, b.prodiId]), [["ASESOR", null], ["MAHASISWA", "p-ti"]]);
});

test("impor: peran pegawai ditolak — pegawai datang dari identitas-itts, bukan dari berkas", () => {
  for (const peran of ["DOSEN", "KAPRODI", "GPM", "ADMIN", "KOORDINATOR_MK"]) {
    const { siap, galat } = rakitPenggunaImpor([baris({ peran, prodiKode: "TI" })], PRODI);
    assert.equal(siap.length, 0, peran);
    assert.match(galat[0].pesan, /identitas-itts/, peran);
  }
});

test("impor: peran kosong ditolak (pengguna lokal tanpa peran tak lolos gerbang masuk)", () => {
  const { siap, galat } = rakitPenggunaImpor([baris({ peran: "" })], PRODI);
  assert.equal(siap.length, 0);
  assert.equal(galat.length, 1);
});

test("impor: MAHASISWA wajib berkode prodi yang dikenal", () => {
  assert.equal(rakitPenggunaImpor([baris({ peran: "MAHASISWA", prodiKode: "" })], PRODI).galat.length, 1);
  assert.equal(rakitPenggunaImpor([baris({ peran: "MAHASISWA", prodiKode: "XX" })], PRODI).galat.length, 1);
});
