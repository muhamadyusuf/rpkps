import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BATAS_APLIKASI, alamatAman, uraiDaftarAplikasi } from "./aplikasi";

describe("uraiDaftarAplikasi", () => {
  it("menerima butir yang sah", () => {
    const hasil = uraiDaftarAplikasi(
      {
        aplikasi: [
          { klien_id: "kampus-maps", nama: "Kampus Maps", url: "https://maps.itts.ac.id/api/identitas/masuk", ikon: "unit", warna: "teal" },
        ],
      },
      "rpkps",
    );
    assert.deepEqual(hasil, [
      {
        klienId: "kampus-maps",
        nama: "Kampus Maps",
        href: "https://maps.itts.ac.id/api/identitas/masuk",
        ikon: "unit",
        warna: "teal",
      },
    ]);
  });

  it("tidak menautkan dirinya sendiri", () => {
    const hasil = uraiDaftarAplikasi(
      { aplikasi: [{ klien_id: "rpkps", nama: "RPKPS", url: "https://rpkps.itts.ac.id" }] },
      "rpkps",
    );
    assert.equal(hasil.length, 0);
  });

  it("membuang alamat selain http/https, bukan seluruh daftar", () => {
    const hasil = uraiDaftarAplikasi(
      {
        aplikasi: [
          { klien_id: "jahat", nama: "Jahat", url: "javascript:alert(1)" },
          { klien_id: "data", nama: "Data", url: "data:text/html,<script>1</script>" },
          { klien_id: "baik", nama: "Baik", url: "https://baik.itts.ac.id" },
        ],
      },
      "rpkps",
    );
    assert.deepEqual(
      hasil.map((a) => a.klienId),
      ["baik"],
    );
  });

  it("ikon dan warna di luar kosakata jatuh ke bawaan", () => {
    const [a] = uraiDaftarAplikasi(
      { aplikasi: [{ klien_id: "x", nama: "X", url: "https://x.id", ikon: "<svg>", warna: "#f00" }] },
      "rpkps",
    );
    assert.equal(a?.ikon, "aplikasi");
    assert.equal(a?.warna, "nila");
  });

  it("jawaban cacat menghasilkan daftar kosong", () => {
    for (const cacat of [null, 42, "teks", { aplikasi: "bukan larik" }, {}]) {
      assert.deepEqual(uraiDaftarAplikasi(cacat, "rpkps"), []);
    }
  });

  it("dibatasi dan tanpa duplikat", () => {
    const banyak = Array.from({ length: 30 }, (_, i) => ({
      klien_id: `a${i % 20}`,
      nama: `A${i}`,
      url: `https://a${i}.id`,
    }));
    const hasil = uraiDaftarAplikasi({ aplikasi: banyak }, "rpkps");
    assert.equal(hasil.length, BATAS_APLIKASI);
    assert.equal(new Set(hasil.map((a) => a.klienId)).size, hasil.length);
  });
});

describe("alamatAman", () => {
  it("menolak kredensial di dalam alamat", () => {
    assert.equal(alamatAman("https://user:pass@x.id"), null);
  });
});
