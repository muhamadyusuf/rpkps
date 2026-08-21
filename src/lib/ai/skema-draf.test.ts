import assert from "node:assert/strict";
import { test } from "node:test";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SkemaKeluaranDraf } from "./skema-draf";

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
 * gagal, JANGAN sekadar menaikkan angkanya — pecah penyusunan draf menjadi
 * beberapa panggilan, masing-masing dengan skema sendiri.
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

const ukuran = ukur(zodOutputFormat(SkemaKeluaranDraf).schema);

test("skema draf tidak memuat percabangan anyOf", () => {
  // Satu .nullable() menjadi satu anyOf. Percabangan jauh lebih mahal bagi
  // grammar daripada field biasa: sembilan .nullable() itulah yang dulu
  // membuat permintaan draf ditolak seluruhnya.
  assert.equal(
    ukuran.cabang,
    0,
    "Ada .nullable()/union baru di skema draf. Pakai sentinel (\"\" atau 0) " +
      "seperti field lain, lalu kembalikan menjadi null di susunDraf().",
  );
});

test("jumlah properti skema draf masih di dalam anggaran grammar", () => {
  // Diukur: 51 properti lolos, +4 field teks masih lolos, +8 ditolak.
  assert.ok(
    ukuran.properti <= 55,
    `Skema draf memuat ${ukuran.properti} properti; anggarannya 55.`,
  );
});

test("jumlah larik skema draf masih di dalam anggaran grammar", () => {
  // Diukur: 12 larik lolos, +2 larik ditolak. Tidak ada ruang untuk tumbuh.
  assert.ok(
    ukuran.larik <= 12,
    `Skema draf memuat ${ukuran.larik} larik; anggarannya 12.`,
  );
});
