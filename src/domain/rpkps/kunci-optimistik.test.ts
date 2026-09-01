import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periksaKesegaran, pesanTertimpa } from "./kunci-optimistik";

describe("kunci optimistik", () => {
  it("cap ISO yang sah diterima dan dikembalikan sebagai tanggal", () => {
    const hasil = periksaKesegaran("2026-08-30T09:00:00.123Z", "Minggu 5");
    assert.equal(hasil.segar, true);
    if (hasil.segar) assert.equal(hasil.cap.getTime(), Date.parse("2026-08-30T09:00:00.123Z"));
  });

  it("milidetik dipertahankan — kolomnya TIMESTAMP(3), jadi presisi itu berarti", () => {
    const hasil = periksaKesegaran("2026-08-30T09:00:00.999Z", "Minggu 5");
    assert.ok(hasil.segar && hasil.cap.toISOString().endsWith(".999Z"));
  });

  it("penyunting tanpa cap ditolak, bukan dibiarkan lewat", () => {
    for (const nilai of [undefined, null, ""]) {
      const hasil = periksaKesegaran(nilai, "Minggu 5");
      assert.equal(hasil.segar, false, String(nilai));
    }
  });

  it("cap ngawur ditolak dengan pesan yang menyebut barisnya", () => {
    const hasil = periksaKesegaran("kemarin sore", "Tugas 2");
    assert.equal(hasil.segar, false);
    if (!hasil.segar) assert.match(hasil.pesan, /Tugas 2/);
  });

  it("pesan tertimpa menyebut bahwa tidak ada yang hilang", () => {
    const pesan = pesanTertimpa("Minggu 5");
    assert.match(pesan, /Minggu 5/);
    assert.match(pesan, /Tidak ada yang ditimpa/);
  });
});
