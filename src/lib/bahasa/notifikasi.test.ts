import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { id } from "@/kamus/id";
import { en } from "@/kamus/en";
import { susunNotifikasi } from "@/domain/notifikasi/pesan";
import { bacaData, teksNotifikasi } from "./notifikasi";
import { bacaDataRiwayat, teksRiwayat } from "./riwayat";
import { riwayat } from "@/domain/rpkps/riwayat";

/** Penanda `{nama}` pada sebuah pola. */
function penanda(pola: string): Set<string> {
  return new Set([...pola.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

describe("kalimat notifikasi", () => {
  it("kedua bahasa memakai penanda yang sama persis", () => {
    for (const kunci of Object.keys(id.pesanNotifikasi) as (keyof typeof id.pesanNotifikasi)[]) {
      const a = id.pesanNotifikasi[kunci];
      const b = en.pesanNotifikasi[kunci];
      assert.deepEqual(penanda(a.judul), penanda(b.judul), `${kunci}.judul`);
      assert.deepEqual(penanda(a.ringkasan), penanda(b.ringkasan), `${kunci}.ringkasan`);
    }
  });

  it("setiap kunci yang disusun domain ada di kamus", () => {
    // `KunciNotifikasi` dan kunci kamus sama-sama diperiksa `tsc`, tetapi
    // hanya lewat `pesanNotifikasi[data.kunci]` yang boleh mengembalikan
    // undefined. Uji ini menutup celahnya dari sisi data.
    const contoh = susunNotifikasi({
      jenis: "RPKPS_DIAJUKAN",
      rpkpsId: "r1",
      mk: "TI214",
      ta: "2025/2026 GENAP",
      oleh: "Sari",
    });
    assert.ok(contoh.kunci in id.pesanNotifikasi);
    assert.ok(contoh.kunci in en.pesanNotifikasi);
  });

  it("permintaan paraf berbunyi sebagai tagihan, bukan kabar", () => {
    // P6 (docs/14 §4.2). Satu-satunya notifikasi yang lahir dari permintaan;
    // kalimatnya harus menyebut dokumen mana dan apa yang tertahan karenanya.
    const n = susunNotifikasi({
      jenis: "RPKPS_MINTA_PARAF",
      rpkpsId: "r1",
      mk: "TI214 Basis Data",
      ta: "2025/2026 GENAP",
      oleh: "Sari",
    });
    assert.equal(n.kunci, "RPKPS_MINTA_PARAF");
    assert.ok(n.kunci in id.pesanNotifikasi);
    assert.ok(n.kunci in en.pesanNotifikasi);
    assert.equal(n.tautan, "/rpkps/r1");

    const data = { kunci: n.kunci, params: n.params };
    const kosong = { judul: "", ringkasan: "" };
    assert.match(teksNotifikasi(data, kosong, id).judul, /TI214 Basis Data/);
    assert.match(teksNotifikasi(data, kosong, en).ringkasan, /cannot be submitted/);
  });

  it("merakit kalimat dalam bahasa pembacanya", () => {
    const n = susunNotifikasi({
      jenis: "RPKPS_DIAJUKAN",
      rpkpsId: "r1",
      mk: "TI214",
      ta: "2025/2026 GENAP",
      oleh: "Sari",
    });
    const data = { kunci: n.kunci, params: n.params };
    const kosong = { judul: "", ringkasan: "" };
    assert.match(teksNotifikasi(data, kosong, id).judul, /menunggu pengesahan/);
    assert.match(teksNotifikasi(data, kosong, en).judul, /awaiting approval/);
  });

  it("kata keputusan usulan datang dari kamus, bukan dari params", () => {
    const n = susunNotifikasi({
      jenis: "USULAN_DIPUTUSKAN",
      usulanId: "u1",
      judul: "Perbaikan CPMK081",
      oleh: "Kaprodi",
      keputusan: "DIREVISI",
      catatan: null,
    });
    const data = { kunci: n.kunci, params: n.params };
    const kosong = { judul: "", ringkasan: "" };
    assert.match(teksNotifikasi(data, kosong, id).judul, /dikembalikan untuk revisi/);
    assert.match(teksNotifikasi(data, kosong, en).judul, /returned for revision/);
  });

  it("baris tanpa data jatuh ke cadangan yang tersimpan", () => {
    // Baris yang ditulis sebelum L3. Ia kehilangan kemampuan berganti bahasa,
    // tetapi tidak boleh berubah menjadi baris kosong.
    const cadangan = { judul: "RPKPS TI214 menunggu pengesahan", ringkasan: "Sari mengajukan." };
    assert.deepEqual(teksNotifikasi(null, cadangan, en), cadangan);
    assert.equal(bacaData(null), null);
    assert.equal(bacaData({ params: {} }), null);
    assert.deepEqual(bacaData({ kunci: "RPKPS_DIAJUKAN" }), {
      kunci: "RPKPS_DIAJUKAN",
      params: {},
    });
  });
});

describe("kalimat riwayat RPKPS", () => {
  it("kedua bahasa memakai penanda yang sama persis", () => {
    for (const kunci of Object.keys(id.riwayat) as (keyof typeof id.riwayat)[]) {
      assert.deepEqual(penanda(id.riwayat[kunci]), penanda(en.riwayat[kunci]), kunci);
    }
  });

  it("merakit kalimat dalam bahasa pembacanya", () => {
    const p = riwayat("DIARSIPKAN", { alasan: "Kurikulum berganti" });
    assert.equal(teksRiwayat(p, "", id), "Diarsipkan: Kurikulum berganti");
    assert.equal(teksRiwayat(p, "", en), "Archived: Kurikulum berganti");
  });

  it("baris beku tanpa data memakai deskripsi yang tersimpan", () => {
    // Snapshot yang dibuat sebelum L3 tidak pernah ditulis ulang; menyentuh
    // isi dokumen terbit adalah persis yang dilarang AGENTS.md.
    const lama = "Dikembalikan dari arsip sebagai draf";
    assert.equal(teksRiwayat(null, lama, en), lama);
    assert.equal(bacaDataRiwayat(undefined), null);
  });

  it("kunci tak dikenal jatuh ke cadangan, bukan ke baris kosong", () => {
    const asing = { kunci: "ENTAH_APA" as never, params: {} };
    assert.equal(teksRiwayat(asing, "kalimat lama", id), "kalimat lama");
  });
});
