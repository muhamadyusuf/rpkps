import { after, NextResponse } from "next/server";
import { ambilIpKlien, rantaiMentah } from "@/domain/keamanan/ip";
import { lokasiDariKepala } from "@/domain/keamanan/lokasi-ip";
import {
  adalahUmpanMasuk,
  kumpulkanKepala,
  ringkasKiriman,
  sidikPerangkat,
  SEMUA_JENIS_UMPAN,
  type JenisUmpan,
} from "@/domain/keamanan/perangkap";
import { catatTemuan } from "@/lib/keamanan/perangkap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rute umpan — docs/22. Tidak pernah dipanggil orang sah.
 *
 * Proxy mengalihkan alamat umpan ke sini dan memasang `x-perangkap-jenis` serta
 * `x-perangkap-jalur`. Permintaan TANPA kedua kepala itu (mis. pengguna yang
 * mengetik /api/perangkap) dijawab 404 tanpa dicatat: rute ini bukan pintu
 * untuk menulis ke tabel temuan.
 *
 * Jawabannya sengaja membosankan: 404 untuk berkas, formulir masuk generik
 * untuk panel admin. Menjawab 403 atau pesan khas akan memberi tahu pemindai
 * bahwa ia terdeteksi.
 */

const MAKS_BADAN = 16 * 1024;

async function bacaBadan(permintaan: Request): Promise<string> {
  if (!permintaan.body) return "";
  const pembaca = permintaan.body.getReader();
  const potongan: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAKS_BADAN) {
      const { done, value } = await pembaca.read();
      if (done || !value) break;
      potongan.push(value);
      total += value.length;
    }
  } finally {
    // Sisanya dibuang: badan raksasa tidak boleh ditampung.
    void pembaca.cancel().catch(() => {});
  }
  return new TextDecoder().decode(Buffer.concat(potongan).subarray(0, MAKS_BADAN));
}

const FORMULIR = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Log in</title><style>body{font:14px system-ui,sans-serif;background:#f1f1f1;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#fff;padding:24px;width:280px;border:1px solid #ddd;display:grid;gap:12px}
input{padding:8px;border:1px solid #bbb;font:inherit}button{padding:9px;background:#2271b1;color:#fff;border:0;font:inherit}
p{color:#b32d2e;margin:0}</style></head><body>
<form method="post"><h1 style="font-size:18px;margin:0">Administrator login</h1>__GALAT__
<input name="log" placeholder="Username" autocomplete="off"><input name="pwd" type="password" placeholder="Password" autocomplete="off">
<button type="submit">Log in</button></form></body></html>`;

const tanpaCache = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

async function tangani(permintaan: Request) {
  const jenis = permintaan.headers.get("x-perangkap-jenis");
  const jalur = permintaan.headers.get("x-perangkap-jalur");
  if (!jenis || !jalur || !SEMUA_JENIS_UMPAN.includes(jenis as JenisUmpan)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const kepala = permintaan.headers;
  const metode = permintaan.method.toUpperCase();
  const [jalurBersih, kueri = ""] = jalur.split("?");
  const kirim = metode === "POST" || metode === "PUT" || metode === "PATCH";
  const badan = kirim ? await bacaBadan(permintaan) : "";

  // Dibangun SEBELUM after(): kepala permintaan tidak dijamin terbaca setelah
  // respons terkirim.
  const temuan = {
    ip: ambilIpKlien(kepala),
    rantaiIp: rantaiMentah(kepala),
    jenis,
    jalur: jalurBersih,
    metode,
    kueri: kueri ? `?${kueri}` : null,
    userAgent: kepala.get("user-agent"),
    bahasaPeramban: kepala.get("accept-language"),
    rujukan: kepala.get("referer"),
    sidikPerangkat: sidikPerangkat(kepala),
    header: kumpulkanKepala(kepala),
    kiriman: kirim ? ringkasKiriman(kepala.get("content-type") ?? "", badan) : null,
    lokasiKepala: lokasiDariKepala(kepala),
  };
  after(() => catatTemuan(temuan));

  const tampilkanFormulir = adalahUmpanMasuk(jenis as JenisUmpan, jalurBersih);
  if (tampilkanFormulir && metode === "GET") {
    return new NextResponse(FORMULIR.replace("__GALAT__", ""), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", ...tanpaCache },
    });
  }
  if (tampilkanFormulir && metode === "POST") {
    return new NextResponse(
      FORMULIR.replace("__GALAT__", "<p>Invalid username or password.</p>"),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...tanpaCache } },
    );
  }
  return new NextResponse("Not Found", { status: 404, headers: tanpaCache });
}

export const GET = tangani;
export const POST = tangani;
export const PUT = tangani;
export const PATCH = tangani;
export const DELETE = tangani;
export const HEAD = tangani;
export const OPTIONS = tangani;
