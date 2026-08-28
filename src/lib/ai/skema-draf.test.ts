import assert from "node:assert/strict";
import { test } from "node:test";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SkemaKerangka, SkemaPertemuan, SkemaTugasKisi } from "./skema-draf";

/**
 * Penjaga batas grammar structured output.
 *
 * Anthropic mengompilasi skema keluaran menjadi grammar dan menolak permintaan
 * bila grammar-nya melewati batas ukuran — 400 "The compiled grammar is too
 * large". Kegagalannya muncul di tangan dosen saat menekan tombol susun draf,
 * bukan saat menyunting skema, jadi ambangnya dijaga di sini.
 *
 * Angka di bawah berasal dari pengukuran langsung ke API pada 2026-08-21
 * (claude-opus-5); rinciannya di kepala skema-draf.ts. Bila salah satu uji ini
 * gagal, JANGAN sekadar menaikkan angkanya — pecah tahap yang bersangkutan
 * menjadi dua panggilan, seperti yang sudah dilakukan pada draf utuh.
 *
 * Sejak draf dipecah tiga tahap, tiap grammar jauh di bawah ambang. Anggaran
 * di sini karena itu dipasang per tahap dan longgar: yang dijaga bukan lagi
 * "muat atau tidak", melainkan supaya satu tahap tidak diam-diam tumbuh
 * kembali sampai seukuran skema tunggal yang dulu.
 */

interface Ukuran {
  properti: number;
  larik: number;
  cabang: number;
}

function ukur(skema: unknown): Ukuran {
  const u: Ukuran = { properti: 0, larik: 0, cabang: 0 };
  (function telusuri(simpul: unknown) {
    if (!simpul || typeof simpul !== "object") return;
    const n = simpul as Record<string, unknown>;
    if (Array.isArray(n.anyOf)) {
      u.cabang += n.anyOf.length;
      n.anyOf.forEach(telusuri);
    }
    if (n.type === "object" && n.properties) {
      const properti = n.properties as Record<string, unknown>;
      u.properti += Object.keys(properti).length;
      Object.values(properti).forEach(telusuri);
    }
    if (n.type === "array") {
      u.larik += 1;
      telusuri(n.items);
    }
  })(skema);
  return u;
}

const TAHAP = [
  { nama: "kerangka", skema: SkemaKerangka },
  { nama: "pertemuan", skema: SkemaPertemuan },
  { nama: "tugas dan kisi-kisi", skema: SkemaTugasKisi },
] as const;

/** Anggaran per tahap. Skema tunggal yang dulu: 51 properti, 12 larik. */
const ANGGARAN = { properti: 40, larik: 9 };

for (const { nama, skema } of TAHAP) {
  const ukuran = ukur(zodOutputFormat(skema).schema);

  test(`skema tahap ${nama} tidak memuat percabangan anyOf`, () => {
    // Satu .nullable() menjadi satu anyOf. Percabangan jauh lebih mahal bagi
    // grammar daripada field biasa: sembilan .nullable() itulah yang dulu
    // membuat permintaan draf ditolak seluruhnya. Larangannya dipertahankan
    // meski ruangnya kini longgar, supaya bentuk sentinel seragam di ketiga
    // tahap dan susunDraf() tidak perlu menangani dua konvensi.
    assert.equal(
      ukuran.cabang,
      0,
      `Ada .nullable()/union baru di skema tahap ${nama}. Pakai sentinel ` +
        `("" atau 0) seperti field lain, lalu kembalikan menjadi null saat digabung.`,
    );
  });

  test(`jumlah properti skema tahap ${nama} masih di dalam anggaran`, () => {
    assert.ok(
      ukuran.properti <= ANGGARAN.properti,
      `Tahap ${nama} memuat ${ukuran.properti} properti; anggarannya ${ANGGARAN.properti}.`,
    );
  });

  test(`jumlah larik skema tahap ${nama} masih di dalam anggaran`, () => {
    assert.ok(
      ukuran.larik <= ANGGARAN.larik,
      `Tahap ${nama} memuat ${ukuran.larik} larik; anggarannya ${ANGGARAN.larik}.`,
    );
  });
}
