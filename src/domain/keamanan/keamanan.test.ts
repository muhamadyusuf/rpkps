import { test } from "node:test";
import assert from "node:assert/strict";
import { buatPembatasLaju } from "./batas-laju";
import { adalahIpPublik, ambilIpKlien } from "./ip";
import {
  adalahUmpanMasuk,
  jenisUmpan,
  kumpulkanKepala,
  ringkasKiriman,
  sidikPerangkat,
} from "./perangkap";
import { lokasiDariKepala, tafsirIpwho, tautanPeta } from "./lokasi-ip";

const kepala = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

test("pembatas laju: menolak setelah jatah habis, lalu bergulir", () => {
  const b = buatPembatasLaju({ maks: 3, jendelaMs: 1000 });
  assert.equal(b.coba("a", 0).boleh, true);
  assert.equal(b.coba("a", 10).boleh, true);
  assert.equal(b.coba("a", 20).sisa, 0);
  const tolak = b.coba("a", 30);
  assert.equal(tolak.boleh, false);
  assert.equal(tolak.ulangDalamMs, 970);
  assert.equal(b.coba("b", 30).boleh, true, "kunci lain tidak terpengaruh");
  assert.equal(b.coba("a", 1000).boleh, true, "jendela baru");
});

test("pembatas laju: jumlah kunci dijepit", () => {
  const b = buatPembatasLaju({ maks: 1, jendelaMs: 60_000, maksKunci: 50 });
  for (let i = 0; i < 500; i++) b.coba(`ip-${i}`, i);
  assert.ok(b.ukuran() <= 50);
});

test("ip: kepala platform didahulukan, dan nilai palsu dibuang", () => {
  assert.equal(
    ambilIpKlien(kepala({ "x-vercel-forwarded-for": "8.8.8.8", "x-forwarded-for": "1.1.1.1" })),
    "8.8.8.8",
  );
  assert.equal(ambilIpKlien(kepala({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(ambilIpKlien(kepala({ "x-forwarded-for": "1.2.3.4:5555" })), "1.2.3.4");
  assert.equal(ambilIpKlien(kepala({ "x-forwarded-for": "'; DROP TABLE x;--" })), "tidak-diketahui");
  assert.equal(ambilIpKlien(kepala({})), "tidak-diketahui");
});

test("ip: privat dan loopback tidak dianggap publik", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "::1", "fe80::1", "169.254.1.1"]) {
    assert.equal(adalahIpPublik(ip), false, ip);
  }
  for (const ip of ["8.8.8.8", "203.0.113.9", "2001:4860:4860::8888"]) {
    assert.equal(adalahIpPublik(ip), true, ip);
  }
  assert.equal(adalahIpPublik("tidak-diketahui"), false);
});

test("umpan: pemindai dikenali, alamat aplikasi sendiri tidak", () => {
  for (const j of [
    "/wp-login.php",
    "/wp-admin/setup-config.php",
    "/xmlrpc.php",
    "/.env",
    "/.env.production",
    "/app/.git/config",
    "/phpmyadmin/index.php",
    "/admin",
    "/administrator/",
    "/backup.sql",
    "/shell.php",
    "/actuator/health",
    "/api/admin/users",
    "//wp-login.php",
    "/%2e%65nv",
    "/WP-LOGIN.PHP",
  ]) {
    assert.notEqual(jenisUmpan(j), null, j);
  }
  for (const j of [
    "/",
    "/dashboard",
    "/rpkps",
    "/rpkps/abc123/pratinjau",
    "/katalog",
    "/masuk",
    "/pengguna",
    "/master/prodi",
    "/api/sesi",
    "/api/rpkps/abc/docx",
    "/api/surel/kirim",
    "/pratinjau/tokenpanjang",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    assert.equal(jenisUmpan(j), null, j);
  }
});

test("umpan: hanya alamat masuk yang menampilkan formulir palsu", () => {
  assert.equal(adalahUmpanMasuk("WORDPRESS", "/wp-login.php"), true);
  assert.equal(adalahUmpanMasuk("WORDPRESS", "/xmlrpc.php"), false);
  assert.equal(adalahUmpanMasuk("BERKAS_RAHASIA", "/.env"), false);
});

test("kiriman: sandi tidak pernah disimpan, hanya panjangnya", () => {
  const r = ringkasKiriman("application/x-www-form-urlencoded", "log=admin&pwd=RahasiaSekali123&wp-submit=Log+In");
  assert.equal(r?.pengguna, "admin");
  assert.equal(r?.panjangSandi, 16);
  assert.equal(JSON.stringify(r).includes("RahasiaSekali123"), false);

  const j = ringkasKiriman("application/json", JSON.stringify({ email: "a@b.c", password: "xyz" }));
  assert.equal(j?.pengguna, "a@b.c");
  assert.equal(j?.panjangSandi, 3);
  assert.equal(JSON.stringify(j).includes("xyz"), false);
});

test("kiriman: badan tak berbentuk dipotong, dan yang memuat kata rahasia disamarkan", () => {
  const panjang = ringkasKiriman("text/plain", "a".repeat(5000));
  assert.equal(panjang?.cuplikan?.length, 1000);
  const rahasia = ringkasKiriman("text/plain", "user=a&password=hunter2");
  assert.equal(rahasia?.cuplikan?.includes("hunter2"), false);
  assert.equal(ringkasKiriman("text/plain", ""), null);
});

test("kepala bukti tidak memuat cookie maupun Authorization", () => {
  const k = kumpulkanKepala(
    kepala({ "user-agent": "curl/8", cookie: "sesi=RAHASIA", authorization: "Bearer RAHASIA" }),
  );
  assert.equal(k["user-agent"], "curl/8");
  assert.equal(JSON.stringify(k).includes("RAHASIA"), false);
});

test("sidik perangkat stabil dan tidak bergantung pada IP", () => {
  const a = sidikPerangkat(kepala({ "user-agent": "X", "accept-language": "id" }));
  const b = sidikPerangkat(kepala({ "user-agent": "X", "accept-language": "id", "x-forwarded-for": "1.1.1.1" }));
  const c = sidikPerangkat(kepala({ "user-agent": "Y", "accept-language": "id" }));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 14);
});

test("lokasi: kepala Vercel dan jawaban ipwho ditafsirkan; koordinat liar dibuang", () => {
  const v = lokasiDariKepala(
    kepala({
      "x-vercel-ip-country": "id",
      "x-vercel-ip-city": "Surabaya%20Timur",
      "x-vercel-ip-latitude": "-7.25",
      "x-vercel-ip-longitude": "112.75",
    }),
  );
  assert.equal(v?.kodeNegara, "ID");
  assert.equal(v?.kota, "Surabaya Timur");
  assert.equal(v?.lintang, -7.25);
  assert.equal(lokasiDariKepala(kepala({})), null);

  const w = tafsirIpwho({
    success: true,
    country: "Indonesia",
    country_code: "ID",
    city: "Surabaya",
    latitude: -7.2,
    longitude: 112.7,
    connection: { asn: 7713, isp: "Telkom" },
    timezone: { id: "Asia/Jakarta" },
  });
  assert.equal(w?.asn, "AS7713");
  assert.equal(w?.penyedia, "Telkom");
  assert.equal(tafsirIpwho({ success: false }), null);
  assert.equal(tafsirIpwho({ success: true, latitude: 999, longitude: 0 })?.lintang, null);
  assert.equal(tautanPeta(null, 1), null);
  assert.ok(tautanPeta(-7.2, 112.7)?.startsWith("https://www.openstreetmap.org/"));
});
