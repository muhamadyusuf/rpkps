import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PROXY = readFileSync("src/proxy.ts", "utf8");
const RUTE = readFileSync("src/app/api/perangkap/route.ts", "utf8");
const CATAT = readFileSync("src/lib/keamanan/perangkap.ts", "utf8");
const AKSI = readFileSync("src/app/[bahasa]/(app)/perangkap/aksi.ts", "utf8");
const SESI = readFileSync("src/app/api/sesi/route.ts", "utf8");

test("proxy memeriksa umpan SEBELUM bahasa dan sesi, dan selalu menimpa kepalanya", () => {
  const badan = PROXY.slice(PROXY.indexOf("export function proxy"));
  assert.ok(badan.indexOf("umpan(request") < badan.indexOf("tanpaAwalanBahasa(pathname)"));
  assert.match(PROXY, /kepala\.set\("x-perangkap-jenis"/);
  assert.match(PROXY, /kepala\.set\("x-perangkap-jalur"/);
});

test("rute umpan menolak permintaan tanpa kepala proxy, dan tidak menyentuh sesi", () => {
  assert.match(RUTE, /if \(!jenis \|\| !jalur/);
  assert.doesNotMatch(RUTE, /sesiSaatIni|wajib(Masuk|Aktif|Peran)/);
});

test("rute umpan mencatat lewat after(), bukan menunggu basis data", () => {
  assert.match(RUTE, /after\(\(\) => catatTemuan\(temuan\)\)/);
});

test("badan kiriman tidak pernah disimpan mentah", () => {
  assert.doesNotMatch(CATAT, /badan|body/i);
  assert.match(RUTE, /ringkasKiriman\(/);
});

test("temuan tidak dapat dihapus dari antarmuka admin", () => {
  assert.doesNotMatch(AKSI, /\.delete\(|deleteMany/);
  assert.match(AKSI, /wajibPeran\("ADMIN"\)/);
});

test("pertukaran token masuk dibatasi lajunya dan IP audit bukan kepala mentah", () => {
  assert.match(SESI, /lajuMasuk\.coba/);
  assert.doesNotMatch(SESI, /headers\.get\("x-forwarded-for"\)/);
});
