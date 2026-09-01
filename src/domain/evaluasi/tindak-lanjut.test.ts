import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  nilaiVerifikasi,
  periksaPenutupan,
  periksaTemuan,
  type TemuanInput,
} from "./tindak-lanjut";
import type { CapaianButir } from "./capaian";
import { pesanTemuanId } from "@/lib/bahasa/temuan";

function butir(
  kode: string,
  tercapai: boolean,
  persenLulus: number,
  tingkat: CapaianButir["tingkat"] = "CPMK",
): CapaianButir {
  return {
    tingkat,
    kode,
    rerata: persenLulus,
    persenLulus,
    tercapai,
    pita: tercapai ? "BAIK" : "KURANG",
    jumlahDinilai: 20,
  };
}

function temuanSehat(kode = "CPMK2"): TemuanInput {
  return {
    tingkat: "CPMK",
    kode,
    akarMasalah:
      "Materi normalisasi hanya dibahas satu pertemuan sebelum UAS, tanpa latihan terbimbing.",
    tindakan:
      "Menambah satu sesi latihan terbimbing pada minggu 13 dan memindahkan kuis normalisasi ke minggu 14.",
    taSasaranId: "ta-2026-ganjil",
  };
}

const REFLEKSI =
  "Perkuliahan berjalan sesuai rencana sampai minggu 12; dua pertemuan terakhir terpotong libur nasional.";

function kode(daftar: { kode: string }[]): string[] {
  return daftar.map((t) => t.kode);
}

describe("mutu satu tindak lanjut", () => {
  it("meloloskan temuan yang lengkap", () => {
    assert.deepEqual(periksaTemuan(temuanSehat()), []);
  });

  it("menolak akar masalah dan tindakan yang sekadar formalitas", () => {
    const t = { ...temuanSehat(), akarMasalah: "Mahasiswa malas", tindakan: "Diperbaiki" };
    const h = periksaTemuan(t);
    assert.ok(kode(h).includes("TL-AKAR-PENDEK"));
    assert.ok(kode(h).includes("TL-TINDAKAN-PENDEK"));
  });

  it("menolak tindakan tanpa tahun akademik sasaran", () => {
    const h = periksaTemuan({ ...temuanSehat(), taSasaranId: null });
    assert.ok(kode(h).includes("TL-TANPA-TA-SASARAN"));
  });
});

describe("syarat penutupan evaluasi", () => {
  it("menahan penutupan selama ada CPMK gagal tanpa tindak lanjut", () => {
    const h = periksaPenutupan({
      butir: [butir("CPMK1", true, 95), butir("CPMK2", false, 40)],
      temuan: [],
      catatanProses: REFLEKSI,
      pemblokirCapaian: [],
    });
    const t = h.temuan.find((x) => x.kode === "TL-TANPA-RTL")!;
    assert.ok(pesanTemuanId(t).includes("CPMK2"));
    assert.equal(h.dapatDitutup, false);
  });

  it("meloloskan penutupan setelah CPMK gagal punya tindak lanjut", () => {
    const h = periksaPenutupan({
      butir: [butir("CPMK1", true, 95), butir("CPMK2", false, 40)],
      temuan: [temuanSehat("CPMK2")],
      catatanProses: REFLEKSI,
      pemblokirCapaian: [],
    });
    assert.equal(h.dapatDitutup, true);
    assert.deepEqual(h.pemblokir, []);
  });

  it("menahan penutupan tanpa refleksi pelaksanaan", () => {
    const h = periksaPenutupan({
      butir: [butir("CPMK1", true, 95)],
      temuan: [],
      catatanProses: "Lancar.",
      pemblokirCapaian: [],
    });
    assert.ok(kode(h.temuan).includes("TL-TANPA-REFLEKSI"));
    assert.equal(h.dapatDitutup, false);
  });

  it("meneruskan pemblokir dari mesin capaian", () => {
    const h = periksaPenutupan({
      butir: [butir("CPMK1", true, 95)],
      temuan: [],
      catatanProses: REFLEKSI,
      pemblokirCapaian: [
        { kode: "EV-BELUM-LENGKAP", tingkat: "PEMBLOKIR" },
      ],
    });
    assert.equal(h.dapatDitutup, false);
    assert.ok(kode(h.pemblokir).includes("EV-BELUM-LENGKAP"));
  });

  it("menandai CPL gagal tanpa menahan penutupan — itu urusan prodi", () => {
    const h = periksaPenutupan({
      butir: [butir("CPMK1", true, 95), butir("CPL2", false, 40, "CPL")],
      temuan: [],
      catatanProses: REFLEKSI,
      pemblokirCapaian: [],
    });
    assert.ok(kode(h.temuan).includes("TL-CPL-BELUM-TERCAPAI"));
    assert.equal(h.dapatDitutup, true);
  });

  it("ikut memeriksa mutu tiap tindak lanjut yang dilampirkan", () => {
    const h = periksaPenutupan({
      butir: [butir("CPMK2", false, 40)],
      temuan: [{ ...temuanSehat("CPMK2"), tindakan: "Nanti diperbaiki" }],
      catatanProses: REFLEKSI,
      pemblokirCapaian: [],
    });
    assert.ok(kode(h.pemblokir).includes("TL-TINDAKAN-PENDEK"));
  });
});

describe("verifikasi lintas semester", () => {
  const lama = [{ tingkat: "CPMK" as const, kode: "CPMK2", capaianTerukur: 40 }];

  it("mengusulkan TERCAPAI ketika capaian menembus ambang", () => {
    const [h] = nilaiVerifikasi(lama, [butir("CPMK2", true, 88)]);
    assert.equal(h.usulan, "TERCAPAI");
    assert.equal(h.sebelum, 40);
    assert.equal(h.sesudah, 88);
    assert.ok(h.narasi.includes("naik dari 40%"));
  });

  it("mengusulkan TIDAK_TERCAPAI ketika masih di bawah ambang", () => {
    const [h] = nilaiVerifikasi(lama, [butir("CPMK2", false, 35)]);
    assert.equal(h.usulan, "TIDAK_TERCAPAI");
    assert.ok(h.narasi.includes("turun dari 40%"));
  });

  it("menahan penilaian ketika butirnya tidak terukur lagi", () => {
    const [h] = nilaiVerifikasi(lama, [butir("CPMK1", true, 90)]);
    assert.equal(h.usulan, "BELUM");
    assert.equal(h.sesudah, null);
  });
});
