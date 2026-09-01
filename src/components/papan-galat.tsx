"use client";

import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useBahasa } from "@/components/penyedia-bahasa";

/**
 * Tampilan baku saat sebuah segmen gagal digambar.
 *
 * Tiga hal yang wajib ada, dan tidak lebih:
 *
 *   1. Kalimat yang menyebut apa yang gagal, bukan "Something went wrong".
 *   2. Tombol coba lagi — `reset()` menggambar ulang segmennya saja, jadi
 *      kegagalan sesaat (koneksi basis data putus sekejap) benar-benar pulih
 *      tanpa memuat ulang seluruh halaman.
 *   3. `digest` — sidik galat dari server. Isi galat sesungguhnya TIDAK pernah
 *      dikirim ke peramban pada build produksi, jadi tanpa sidik ini laporan
 *      pengguna tidak dapat dicocokkan dengan log server.
 */
export function PapanGalat({
  galat,
  pulihkan,
  judul,
  keterangan,
  hrefPulang = "/dashboard",
  labelPulang,
}: {
  galat: Error & { digest?: string };
  pulihkan: () => void;
  judul: string;
  keterangan: string;
  hrefPulang?: string;
  labelPulang?: string;
}) {
  const { k, isi } = useBahasa();

  useEffect(() => {
    // Satu-satunya tempat isi galat masih terbaca di sisi klien saat
    // pengembangan; di produksi yang tersisa hanya digest-nya.
    console.error("[galat segmen]", galat);
  }, [galat]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/25">
        <CircleAlert className="size-5 text-destructive" />
      </span>

      <div className="space-y-1.5">
        <h1 className="font-heading text-xl font-semibold tracking-tight">{judul}</h1>
        <p className="text-sm text-muted-foreground">{keterangan}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={pulihkan}>
          <RotateCcw />
          {k.komponen.galat.cobaLagi}
        </Button>
        <ButtonLink variant="outline" href={hrefPulang}>
          {labelPulang ?? k.komponen.galat.kembaliDasbor}
        </ButtonLink>
      </div>

      {galat.digest ? (
        <p className="font-mono text-[11px] text-muted-foreground">
          {isi(k.komponen.galat.kode, { digest: galat.digest })}
        </p>
      ) : null}
    </div>
  );
}
