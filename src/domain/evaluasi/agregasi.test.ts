import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agregasiProdi, type ArgAgregasi, type BarisCapaian } from "./agregasi";
import { pesanTemuanId } from "@/lib/bahasa/temuan";

function baris(
  ubah: Partial<BarisCapaian> & Pick<BarisCapaian, "cplKode" | "mkKode" | "sks">,
): BarisCapaian {
  return {
    mkNama: "Mata kuliah",
    kelas: "A",
    tahunAkademik: "2025/2026-GENAP",
    tahunMulai: 2025,
    rerata: 75,
    persenLulus: 90,
    tercapai: true,
    jumlahDinilai: 20,
    ...ubah,
  };
}

function arg(daftar: BarisCapaian[], ubah: Partial<ArgAgregasi> = {}): ArgAgregasi {
  return {
    baris: daftar,
    cplProdi: ["CPL1", "CPL2"],
    jumlahMkKurikulum: 4,
    ambangKetercapaian: 85,
    ...ubah,
  };
}

function kode(h: { temuan: { kode: string }[] }): string[] {
  return h.temuan.map((t) => t.kode);
}

describe("capaian CPL tingkat prodi", () => {
  it("menimbang tiap mata kuliah menurut sks, bukan rata-rata polos", () => {
    // MK 4 sks bernilai 40, MK 1 sks bernilai 90.
    // Tertimbang: (40×4 + 90×1) / 5 = 50. Rata-rata polos akan memberi 65.
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 4, rerata: 40, persenLulus: 40, tercapai: false }),
        baris({ cplKode: "CPL1", mkKode: "TI102", sks: 1, rerata: 90, persenLulus: 90 }),
      ]),
    );
    const cpl1 = h.cpl.find((c) => c.kode === "CPL1")!;
    assert.equal(cpl1.rerata, 50);
    assert.equal(cpl1.persenLulus, 50);
    assert.equal(cpl1.kelasTercapai, 1);
    assert.equal(cpl1.kelasTerukur, 2);
    assert.deepEqual(cpl1.mkTerukur, ["TI101", "TI102"]);
  });

  it("menandai CPL yang belum pernah terukur sebagai pemblokir", () => {
    const h = agregasiProdi(arg([baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3 })]));
    const t = h.temuan.find((x) => x.kode === "AG-CPL-TANPA-DATA")!;
    assert.ok(pesanTemuanId(t).includes("CPL2"));
    assert.equal(h.ringkasan.cplTerukur, 1);
    assert.equal(h.ringkasan.cplDibebankan, 2);
  });

  it("mengabaikan baris yang tidak punya mahasiswa terukur", () => {
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3 }),
        baris({ cplKode: "CPL1", mkKode: "TI102", sks: 3, jumlahDinilai: 0, rerata: null, persenLulus: null }),
      ]),
    );
    assert.equal(h.cpl.find((c) => c.kode === "CPL1")!.kelasTerukur, 1);
  });

  it("memperingatkan CPL prodi di bawah ambang", () => {
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, persenLulus: 60, tercapai: false }),
        baris({ cplKode: "CPL2", mkKode: "TI102", sks: 3 }),
      ]),
    );
    const t = h.temuan.find((x) => x.kode === "AG-CPL-BELUM-TERCAPAI")!;
    assert.ok(pesanTemuanId(t).includes("CPL1 (60%)"));
    assert.ok(!pesanTemuanId(t).includes("CPL2"));
  });
});

describe("tren antar tahun akademik", () => {
  it("mengurutkan titik tren menurut tahun", () => {
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, tahunAkademik: "2026/2027-GANJIL", tahunMulai: 2026, persenLulus: 88 }),
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, tahunAkademik: "2025/2026-GENAP", tahunMulai: 2025, persenLulus: 60 }),
        baris({ cplKode: "CPL2", mkKode: "TI102", sks: 3 }),
      ]),
    );
    const tren = h.tren.get("CPL1")!;
    assert.deepEqual(tren.map((t) => t.tahunAkademik), [
      "2025/2026-GENAP",
      "2026/2027-GANJIL",
    ]);
    assert.deepEqual(tren.map((t) => t.persenLulus), [60, 88]);
  });
});

describe("sebaran antar kelas paralel", () => {
  it("menemukan rencana sama dengan hasil jauh berbeda", () => {
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, kelas: "A", persenLulus: 92 }),
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, kelas: "B", persenLulus: 61, tercapai: false }),
        baris({ cplKode: "CPL2", mkKode: "TI102", sks: 3 }),
      ]),
    );
    assert.equal(h.sebaran.length, 1);
    assert.equal(h.sebaran[0].selisih, 31);
    assert.equal(h.sebaran[0].tertinggi.kelas, "A");
    assert.equal(h.sebaran[0].terendah.kelas, "B");
    assert.ok(kode(h).includes("AG-SEBARAN-KELAS"));
  });

  it("membiarkan selisih yang masih wajar", () => {
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, kelas: "A", persenLulus: 92 }),
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, kelas: "B", persenLulus: 85 }),
        baris({ cplKode: "CPL2", mkKode: "TI102", sks: 3 }),
      ]),
    );
    assert.deepEqual(h.sebaran, []);
    assert.ok(!kode(h).includes("AG-SEBARAN-KELAS"));
  });

  it("tidak membandingkan kelas lintas tahun akademik", () => {
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, kelas: "A", persenLulus: 92 }),
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3, kelas: "A", persenLulus: 40, tahunAkademik: "2024/2025-GENAP", tahunMulai: 2024 }),
        baris({ cplKode: "CPL2", mkKode: "TI102", sks: 3 }),
      ]),
    );
    assert.deepEqual(h.sebaran, []);
  });
});

describe("cakupan evaluasi", () => {
  it("memperingatkan cakupan di bawah 75%", () => {
    const h = agregasiProdi(
      arg([
        baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3 }),
        baris({ cplKode: "CPL2", mkKode: "TI102", sks: 3 }),
      ]),
    );
    assert.equal(h.ringkasan.cakupanPersen, 50);
    assert.ok(kode(h).includes("AG-CAKUPAN-RENDAH"));
  });

  it("diam ketika cakupan memadai", () => {
    const h = agregasiProdi(
      arg(
        [
          baris({ cplKode: "CPL1", mkKode: "TI101", sks: 3 }),
          baris({ cplKode: "CPL2", mkKode: "TI102", sks: 3 }),
          baris({ cplKode: "CPL1", mkKode: "TI103", sks: 3 }),
        ],
        { jumlahMkKurikulum: 4 },
      ),
    );
    assert.equal(h.ringkasan.cakupanPersen, 75);
    assert.ok(!kode(h).includes("AG-CAKUPAN-RENDAH"));
  });
});
