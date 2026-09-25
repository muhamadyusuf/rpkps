import assert from "node:assert/strict";
import { test } from "node:test";
import { waktuStatus } from "./format";

test("waktuStatus: hari singkat, tanggal, bulan, jam bertitik dua", () => {
  const d = new Date(2026, 8, 25, 11, 19);
  assert.equal(waktuStatus(d, "id"), "Jum, 25 Sep 11:19");
  assert.equal(waktuStatus(d, "en"), "Fri, Sep 25 11:19");
});

test("waktuStatus: jam dan menit selalu dua digit", () => {
  assert.equal(waktuStatus(new Date(2026, 0, 5, 7, 3), "id"), "Sen, 5 Jan 07:03");
});
