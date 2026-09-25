import assert from "node:assert/strict";
import { test } from "node:test";
import {
  UMUR_ALUR_SSO_MS,
  alamatMulaiKanonik,
  bacaKlaim,
  bukaAlur,
  bungkusAlur,
  cocokState,
  kodeGalatSso,
  lanjutAman,
  mulaiAlurSso,
  tantanganPkce,
  urlOtorisasi,
} from "./sso";

test("PKCE: vektor uji resmi RFC 7636 Lampiran B", () => {
  assert.equal(
    tantanganPkce("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});

test("alur: state dan verifier acak, panjang verifier sesuai RFC", () => {
  const a = mulaiAlurSso(null);
  const b = mulaiAlurSso(null);
  assert.notEqual(a.state, b.state);
  assert.notEqual(a.verifier, b.verifier);
  assert.ok(a.verifier.length >= 43 && a.verifier.length <= 128);
  assert.match(a.verifier, /^[A-Za-z0-9_-]+$/);
});

test("urlOtorisasi: semua parameter ada, challenge dihitung dari verifier, secret tak ikut", () => {
  const alur = mulaiAlurSso("/rpkps");
  const u = new URL(
    urlOtorisasi({
      basis: "http://localhost:3001/",
      klienId: "rpkps",
      redirectUri: "http://localhost:3000/api/identitas/callback",
      alur,
    }),
  );
  assert.equal(u.origin + u.pathname, "http://localhost:3001/oauth/authorize");
  const p = u.searchParams;
  assert.equal(p.get("response_type"), "code");
  assert.equal(p.get("client_id"), "rpkps");
  assert.equal(p.get("redirect_uri"), "http://localhost:3000/api/identitas/callback");
  assert.equal(p.get("scope"), "openid");
  assert.equal(p.get("state"), alur.state);
  assert.equal(p.get("code_challenge_method"), "S256");
  assert.equal(p.get("code_challenge"), tantanganPkce(alur.verifier));
  // Verifier tidak boleh ikut ke peramban — hanya challenge-nya.
  assert.equal(u.toString().includes(alur.verifier), false);
  assert.equal(p.has("client_secret"), false);
});

test("cookie alur: bulat-balik utuh", () => {
  const t = 1_800_000_000_000;
  const alur = mulaiAlurSso("/kurikulum", t);
  assert.deepEqual(bukaAlur(bungkusAlur(alur), t + 5_000), alur);
});

test("cookie alur: kedaluwarsa, dari masa depan, rusak, atau salah bentuk → null", () => {
  const t = 1_800_000_000_000;
  const alur = mulaiAlurSso(null, t);
  const nilai = bungkusAlur(alur);

  assert.equal(bukaAlur(nilai, t + UMUR_ALUR_SSO_MS + 1), null, "kedaluwarsa");
  assert.notEqual(bukaAlur(nilai, t + UMUR_ALUR_SSO_MS), null, "tepat di batas masih sah");
  assert.equal(bukaAlur(nilai, t - 5 * 60_000), null, "cap waktu dari masa depan");

  assert.equal(bukaAlur(undefined, t), null);
  assert.equal(bukaAlur("", t), null);
  assert.equal(bukaAlur("bukan-base64-json!!", t), null);
  assert.equal(bukaAlur(Buffer.from("[]").toString("base64url"), t), null);
  assert.equal(bukaAlur(Buffer.from("null").toString("base64url"), t), null);
  assert.equal(bukaAlur("a".repeat(3000), t), null, "terlalu panjang");

  for (const rusak of [
    { ...alur, state: "pendek" },
    { ...alur, verifier: "pendek" },
    { ...alur, verifier: "v".repeat(200) },
    { ...alur, lanjut: 5 },
    { ...alur, mulai: "kemarin" },
    { ...alur, mulai: null },
  ]) {
    const b = Buffer.from(JSON.stringify(rusak)).toString("base64url");
    assert.equal(bukaAlur(b, t), null, JSON.stringify(rusak));
  }
});

test("cookie alur: `lanjut` yang disusupi dinetralkan saat dibuka", () => {
  const t = 1_800_000_000_000;
  const alur = { ...mulaiAlurSso(null, t), lanjut: "https://jahat.example/x" };
  const buka = bukaAlur(Buffer.from(JSON.stringify(alur)).toString("base64url"), t);
  assert.notEqual(buka, null);
  assert.equal(buka!.lanjut, null);
});

test("cocokState: hanya nilai yang persis sama", () => {
  assert.equal(cocokState("abc123", "abc123"), true);
  assert.equal(cocokState("abc123", "abc124"), false);
  assert.equal(cocokState("abc123", "abc12"), false);
  assert.equal(cocokState("abc123", ""), false);
  assert.equal(cocokState("abc123", null), false);
  assert.equal(cocokState("abc123", undefined), false);
});

test("lanjutAman: hanya alamat dalam situs, bukan API, tanpa awalan bahasa", () => {
  assert.equal(lanjutAman("/rpkps/abc"), "/rpkps/abc");
  assert.equal(lanjutAman("/kurikulum?tab=cpl"), "/kurikulum?tab=cpl");
  // Awalan bahasa dilepas — pemasangnya satu, di jalur().
  assert.equal(lanjutAman("/en/rpkps/abc"), "/rpkps/abc");
  // Dasbor adalah bawaan.
  assert.equal(lanjutAman("/"), null);
  assert.equal(lanjutAman("/id"), null);

  for (const jahat of [
    null,
    undefined,
    "",
    "rpkps",
    "//jahat.example",
    "/\\jahat.example",
    "https://jahat.example",
    "javascript:alert(1)",
    "/api/identitas/masuk",
    "/en/api/sesi",
    "/api",
    "/a\nb",
    "/a\rb",
    "/a\u0000b",
    "/" + "x".repeat(600),
  ]) {
    assert.equal(lanjutAman(jahat as string | null | undefined), null, String(jahat));
  }
});

test("bacaKlaim: butuh sub dan surel yang wajar; surel dinormalkan", () => {
  assert.deepEqual(bacaKlaim({ sub: "cmu1", email: "  Yusuf@ITTS.ac.id ", name: " Muhamad Yusuf " }), {
    sub: "cmu1",
    email: "yusuf@itts.ac.id",
    nama: "Muhamad Yusuf",
  });
  assert.equal(bacaKlaim({ sub: "cmu1", email: "a@b.c", name: null })!.nama, null);
  assert.equal(bacaKlaim({ sub: "cmu1", email: "a@b.c", name: "   " })!.nama, null);

  assert.equal(bacaKlaim({ email: "a@b.c" }), null, "tanpa sub");
  assert.equal(bacaKlaim({ sub: "", email: "a@b.c" }), null);
  assert.equal(bacaKlaim({ sub: "cmu1" }), null, "tanpa surel");
  assert.equal(bacaKlaim({ sub: "cmu1", email: "bukan-surel" }), null);
  assert.equal(bacaKlaim({ sub: "cmu1", email: "a b@c.d" }), null);
  assert.equal(bacaKlaim({ sub: 42, email: "a@b.c" }), null);
  assert.equal(bacaKlaim({ sub: "cmu1", email: ["a@b.c"] }), null);
});

test("kodeGalatSso: daftar tertutup — nilai dari alamat tak pernah lolos apa adanya", () => {
  assert.equal(kodeGalatSso("layanan"), "layanan");
  assert.equal(kodeGalatSso("belum-terdaftar"), "belum-terdaftar");
  assert.equal(kodeGalatSso("<script>alert(1)</script>"), null);
  assert.equal(kodeGalatSso("__proto__"), null);
  assert.equal(kodeGalatSso(""), null);
  assert.equal(kodeGalatSso(null), null);
  assert.equal(kodeGalatSso(undefined), null);
});

test("host kanonik: alur dimulai di host redirect_uri, bukan di alamat lain", () => {
  const situs = "https://rpkps.itts.ac.id";
  // Sudah di host kanonik: tidak dialihkan.
  assert.equal(alamatMulaiKanonik(new URL("https://rpkps.itts.ac.id/api/identitas/masuk"), situs, null), null);
  // Alamat lain (mis. tautan lama ke *.vercel.app): dialihkan, `lanjut` ikut.
  const ke = alamatMulaiKanonik(new URL("https://rpkps.vercel.app/api/identitas/masuk"), situs, "/rpkps/abc");
  assert.ok(ke);
  const u = new URL(ke);
  assert.equal(u.origin, situs);
  assert.equal(u.pathname, "/api/identitas/masuk");
  assert.equal(u.searchParams.get("lanjut"), "/rpkps/abc");
  // Pagar putaran: permintaan hasil pengalihan tidak dialihkan lagi.
  assert.equal(alamatMulaiKanonik(u, "https://lain.contoh", "/rpkps/abc"), null);
  // Alamat situs rusak: jangan menebak.
  assert.equal(alamatMulaiKanonik(new URL("https://rpkps.vercel.app/x"), "bukan url", null), null);
});
