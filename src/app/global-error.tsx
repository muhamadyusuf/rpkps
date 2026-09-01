"use client";

import "./globals.css";

/**
 * Jaring terakhir: galat yang terjadi pada layout akar itu sendiri.
 *
 * Berbeda dari `error.tsx` biasa, berkas ini MENGGANTIKAN seluruh dokumen —
 * karena itu ia menulis sendiri `<html>` dan `<body>`, dan tidak boleh
 * bergantung pada apa pun yang disediakan layout akar: penyedia tema, font,
 * maupun komponen yang memanggil `useTheme`. Warnanya diambil dari variabel
 * tema yang sudah ada di globals.css, sehingga tetap terbaca di kedua tema.
 *
 * Karena alasan yang sama ia tinggal di AKAR `src/app`, di luar ruas
 * `[bahasa]`, dan kalimatnya tetap bahasa Indonesia: yang gagal di sini
 * adalah layout akar itu sendiri, jadi tidak ada bahasa aktif yang masih
 * dapat dipercaya untuk dibaca.
 */
export default function GalatGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Aplikasi gagal dimuat
          </h1>
          <p className="text-sm text-muted-foreground">
            Kegagalan terjadi sebelum halaman sempat digambar. Tidak ada data
            yang berubah. Muat ulang; bila berulang, sebutkan kode galat di
            bawah kepada pengelola sistem.
          </p>
          <button
            type="button"
            onClick={reset}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Muat ulang
          </button>
          {error.digest ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              kode galat {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
