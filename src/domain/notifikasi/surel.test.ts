import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAKS_PERCOBAAN_SUREL,
  alamatSah,
  bolehDisurel,
  jadwalUlang,
  jedaBerikutnya,
  putusanSurel,
  ringkasGalat,
} from "./surel";

const sekarang = new Date("2026-09-04T09:00:00Z");

describe("jeda mundur", () => {
  it("menaik, bukan tetap", () => {
    assert.ok(jedaBerikutnya(2) > jedaBerikutnya(1));
    assert.ok(jedaBerikutnya(3) > jedaBerikutnya(2));
  });

  it("percobaan pertama menunggu semenit, bukan sehari", () => {
    assert.equal(jedaBerikutnya(1), 60_000);
  });

  it("jadwal ulang dihitung dari sekarang", () => {
    assert.equal(
      jadwalUlang(1, sekarang).getTime() - sekarang.getTime(),
      jedaBerikutnya(1),
    );
  });
});

describe("putusan antrian", () => {
  const baris = (ubah: Partial<Parameters<typeof putusanSurel>[0]> = {}) => ({
    status: "MENUNGGU" as const,
    percobaan: 0,
    kirimSetelah: null,
    ...ubah,
  });

  it("baris baru langsung boleh dikirim", () => {
    assert.equal(putusanSurel(baris(), sekarang), "KIRIM");
  });

  it("baris yang masih dalam jeda menunggu, tidak dimatikan", () => {
    const t = baris({ percobaan: 1, kirimSetelah: new Date(sekarang.getTime() + 60_000) });
    assert.equal(putusanSurel(t, sekarang), "TUNGGU");
  });

  it("jeda yang sudah lewat membuka giliran berikutnya", () => {
    const t = baris({ percobaan: 2, kirimSetelah: new Date(sekarang.getTime() - 1) });
    assert.equal(putusanSurel(t, sekarang), "KIRIM");
  });

  it("percobaan yang habis berarti menyerah, bukan menunggu selamanya", () => {
    const t = baris({ percobaan: MAKS_PERCOBAAN_SUREL });
    assert.equal(putusanSurel(t, sekarang), "MENYERAH");
  });

  it("yang sudah terkirim, gagal, atau dilewati tidak disentuh lagi", () => {
    for (const status of ["TERKIRIM", "GAGAL", "DILEWATI"] as const) {
      assert.equal(putusanSurel(baris({ status }), sekarang), "SELESAI");
    }
  });
});

describe("kelayakan penerima", () => {
  const dasar = {
    kanalMenyala: true,
    surelNotifikasi: true,
    email: "dosen@itts.ac.id",
    statusAkun: "AKTIF",
  };

  it("penerima yang lengkap boleh disurel", () => {
    assert.ok(bolehDisurel(dasar));
  });

  it("kanal mati menutup semuanya, tanpa kecuali", () => {
    assert.ok(!bolehDisurel({ ...dasar, kanalMenyala: false }));
  });

  it("penolakan penerima dihormati", () => {
    assert.ok(!bolehDisurel({ ...dasar, surelNotifikasi: false }));
  });

  it("akun nonaktif tidak dikabari", () => {
    // Kabar tentang dokumen yang tidak lagi dapat ia buka.
    assert.ok(!bolehDisurel({ ...dasar, statusAkun: "NONAKTIF" }));
  });

  it("alamat yang jelas bukan alamat disaring lebih dulu", () => {
    assert.ok(!alamatSah(""));
    assert.ok(!alamatSah(null));
    assert.ok(!alamatSah("dosen(at)itts"));
    assert.ok(alamatSah("dosen@itts.ac.id"));
  });
});

describe("pesan galat", () => {
  it("kredensial tidak pernah ikut tersimpan", () => {
    const pesan = ringkasGalat(
      "535-5.7.8 Username and Password not accepted for rpkps@itts.ac.id",
      ["rpkps@itts.ac.id", "sandi-rahasia"],
    );
    assert.ok(!pesan.includes("rpkps@itts.ac.id"));
    assert.match(pesan, /535/);
  });

  it("dipendekkan supaya kolomnya tidak menjadi tempat menumpuk", () => {
    assert.ok(ringkasGalat("x".repeat(900)).length <= 300);
  });
});
