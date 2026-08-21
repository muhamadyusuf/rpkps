import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tafsirkanResponsAuth } from "./tafsir-auth";

describe("penafsiran status Firebase Authentication", () => {
  it("respons sukses berarti Authentication aktif", () => {
    const h = tafsirkanResponsAuth(200, {
      authorizedDomains: ["localhost", "obe-itts.firebaseapp.com"],
    });
    assert.equal(h.status, "aktif");
    assert.deepEqual(
      h.status === "aktif" ? h.domainDiizinkan : [],
      ["localhost", "obe-itts.firebaseapp.com"],
    );
  });

  it("CONFIGURATION_NOT_FOUND berarti Authentication belum diaktifkan", () => {
    const h = tafsirkanResponsAuth(400, {
      error: { code: 400, message: "CONFIGURATION_NOT_FOUND" },
    });
    assert.equal(h.status, "belum-aktif");
  });

  it("API key tidak sah dibedakan dari galat lain", () => {
    assert.equal(
      tafsirkanResponsAuth(400, {
        error: { message: "API key not valid. Please pass a valid API key." },
      }).status,
      "kunci-salah",
    );
  });

  it("galat lain dilaporkan apa adanya, bukan ditebak", () => {
    const h = tafsirkanResponsAuth(503, { error: { message: "backend unavailable" } });
    assert.equal(h.status, "tak-terjangkau");
    assert.equal(h.status === "tak-terjangkau" ? h.pesan : "", "backend unavailable");
  });

  it("respons tanpa badan tetap menghasilkan pesan", () => {
    const h = tafsirkanResponsAuth(500, null);
    assert.equal(h.status, "tak-terjangkau");
    assert.match(h.status === "tak-terjangkau" ? h.pesan : "", /500/);
  });
});
