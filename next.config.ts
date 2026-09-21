import type { NextConfig } from "next";

/**
 * Header keamanan untuk SEMUA alamat (docs/22 §3).
 *
 * Yang sengaja TIDAK dipasang: `script-src` pada CSP. Next.js menyisipkan skrip
 * inline, dan CSP berbasis nonce mematikan render statis; sebuah CSP `script-src`
 * yang keliru tidak gagal dengan pesan — halamannya cukup berhenti berjalan.
 * Yang dipasang adalah direktif yang tidak dapat merusak render tetapi menutup
 * kelas serangan yang nyata: dibingkai situs lain, `<base>` disusupi, formulir
 * dibelokkan ke luar, dan plugin objek.
 *
 * COOP `same-origin-allow-popups`, bukan `same-origin`: masuk dengan Google
 * memakai jendela popup, dan `same-origin` memutus hubungan yang dibutuhkan
 * Firebase untuk menerima hasilnya.
 */
const HEADER_KEAMANAN = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],

  // Tidak perlu memberi tahu pemindai bahwa ini Next.js.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: HEADER_KEAMANAN }];
  },

  experimental: {
    serverActions: {
      /**
       * Gambar buku ajar dikirim sebagai PNG hasil rasterisasi peramban
       * (docs/17 I3), dan satu diagram 300 dpi dapat mendekati 2 MB — menjadi
       * ±2,7 MB setelah base64. Batas bawaan Server Action adalah 1 MB, dan
       * melampauinya gagal sebagai galat jaringan yang tidak menyebut sebabnya.
       *
       * Batas ini SENGAJA tidak dinaikkan lebih jauh: ia berlaku untuk seluruh
       * Server Action di aplikasi, dan angka besar di sini berarti setiap
       * tindakan lain ikut boleh menerima kiriman sebesar itu.
       */
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
