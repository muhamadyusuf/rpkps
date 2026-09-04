import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],

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
