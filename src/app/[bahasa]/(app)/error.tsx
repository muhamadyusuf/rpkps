"use client";

import { PapanGalat } from "@/components/papan-galat";
import { useBahasa } from "@/components/penyedia-bahasa";

export default function GalatAplikasi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { k } = useBahasa();

  return (
    <PapanGalat
      galat={error}
      pulihkan={reset}
      judul={k.galat.aplikasi.judul}
      keterangan={k.galat.aplikasi.keterangan}
    />
  );
}
