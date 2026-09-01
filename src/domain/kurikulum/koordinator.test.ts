import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataRiwayat } from "@/domain/rpkps/riwayat";
import { teksRiwayat } from "@/lib/bahasa/riwayat";
import { id } from "@/kamus/id";

import {
  peristiwaSerahTerima,
  periksaCalonKoordinator,
  rencanakanSerahTerima,
  susunPengampuAwal,
  type PengampuRpkps,
} from "./koordinator";

describe("periksaCalonKoordinator", () => {
  it("menerima dosen aktif", () => {
    const h = periksaCalonKoordinator({ nama: "Budi", status: "AKTIF", peran: ["DOSEN"] });
    assert.equal(h.boleh, true);
    assert.equal(h.alasan, null);
  });

  it("menerima Kaprodi dan Koordinator MK", () => {
    for (const peran of ["KAPRODI", "KOORDINATOR_MK"]) {
      const h = periksaCalonKoordinator({ nama: "Sari", status: "AKTIF", peran: [peran] });
      assert.equal(h.boleh, true, peran);
    }
  });

  it("menolak yang belum aktif, dan menyebut namanya", () => {
    const h = periksaCalonKoordinator({
      nama: "Rina",
      status: "MENUNGGU_VERIFIKASI",
      peran: ["DOSEN"],
    });
    assert.equal(h.boleh, false);
    assert.match(h.alasan ?? "", /Rina/);
  });

  it("menolak yang tidak memegang peran dosen", () => {
    const h = periksaCalonKoordinator({ nama: "Tio", status: "AKTIF", peran: ["MAHASISWA"] });
    assert.equal(h.boleh, false);
    assert.match(h.alasan ?? "", /peran dosen/);
  });

  // Prodi bukan urusan calon: MK wajib umum, MK layanan, dan dosen tamu nyata.
  // Yang dibatasi cakupan prodi adalah siapa yang MENETAPKAN.
  it("tidak memandang prodi calon", () => {
    const h = periksaCalonKoordinator({ nama: "Dosen Tamu", status: "AKTIF", peran: ["DOSEN"] });
    assert.equal(h.boleh, true);
  });
});

describe("rencanakanSerahTerima", () => {
  const tim: PengampuRpkps[] = [
    { penggunaId: "u1", peran: "KOORDINATOR", nama: "Budi" },
    { penggunaId: "u2", peran: "ANGGOTA", nama: "Sari" },
  ];

  it("menurunkan koordinator lama dan menaikkan anggota", () => {
    const r = rencanakanSerahTerima(tim, "u2");
    assert.equal(r.sudahKoordinator, false);
    assert.equal(r.perluDitambahkan, false);
    assert.deepEqual(r.namaDiturunkan, ["Budi"]);
  });

  it("menandai calon yang belum masuk tim", () => {
    const r = rencanakanSerahTerima(tim, "u9");
    assert.equal(r.perluDitambahkan, true);
    assert.deepEqual(r.namaDiturunkan, ["Budi"]);
  });

  it("tidak menurunkan siapa pun bila ia sudah koordinator", () => {
    const r = rencanakanSerahTerima(tim, "u1");
    assert.equal(r.sudahKoordinator, true);
    assert.equal(r.perluDitambahkan, false);
    assert.deepEqual(r.namaDiturunkan, []);
  });

  it("bekerja pada RPKPS yang belum punya koordinator", () => {
    const r = rencanakanSerahTerima([{ penggunaId: "u2", peran: "ANGGOTA", nama: "Sari" }], "u2");
    assert.equal(r.sudahKoordinator, false);
    assert.deepEqual(r.namaDiturunkan, []);
  });
});

describe("peristiwaSerahTerima", () => {
  /** Kalimat Indonesia peristiwa itu — sekaligus bukti penandanya terisi. */
  const kalimat = (p: DataRiwayat) => teksRiwayat(p, "", id);

  it("menyebut kedua pihak", () => {
    assert.match(kalimat(peristiwaSerahTerima("Sari", ["Budi"])), /dari Budi kepada Sari/);
  });

  it("tidak mengarang pihak yang tidak ada", () => {
    const p = peristiwaSerahTerima("Sari", []);
    assert.equal(p.kunci, "KOORDINASI_DISERAHKAN_PENUGASAN");
    const k = kalimat(p);
    assert.match(k, /kepada Sari/);
    assert.ok(!k.includes("dari"));
  });
});

describe("susunPengampuAwal", () => {
  it("menjadikan pembuat koordinator bila MK belum ditugaskan", () => {
    assert.deepEqual(susunPengampuAwal("staf", null), [
      { penggunaId: "staf", peran: "KOORDINATOR", urutan: 0 },
    ]);
  });

  // Inilah yang dulu membuat staf prodi menjadi penanggung jawab sepuluh
  // dokumen yang ia bantu siapkan.
  it("menyerahkan koordinasi kepada pemegang penugasan, pembuat jadi anggota", () => {
    assert.deepEqual(susunPengampuAwal("staf", "dosen"), [
      { penggunaId: "dosen", peran: "KOORDINATOR", urutan: 0 },
      { penggunaId: "staf", peran: "ANGGOTA", urutan: 1 },
    ]);
  });

  it("tidak menggandakan baris bila pembuat memang pemegangnya", () => {
    assert.deepEqual(susunPengampuAwal("dosen", "dosen"), [
      { penggunaId: "dosen", peran: "KOORDINATOR", urutan: 0 },
    ]);
  });
});
