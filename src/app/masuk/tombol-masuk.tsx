"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { firebaseTerkonfigurasi, masukDenganGoogle } from "@/lib/firebase/client";
import { terjemahkanGalatAuth, type PesanGalat } from "@/lib/firebase/galat";

function IkonGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.71v2.98A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.67a7.2 7.2 0 0 1 0-4.6V7.09H1.71a12 12 0 0 0 0 10.56l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.2 15.1 0 12 0 7.4 0 3.43 2.64 1.71 6.49l3.84 2.98C6.46 6.77 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function TombolMasuk() {
  const [memuat, setMemuat] = useState(false);
  const [galatLangkah, setGalatLangkah] = useState<PesanGalat | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const terkonfigurasi = firebaseTerkonfigurasi();

  async function tangani() {
    setMemuat(true);
    setGalatLangkah(null);
    try {
      await masukDenganGoogle();
      const lanjut = params.get("lanjut");
      router.replace(lanjut && lanjut.startsWith("/") ? lanjut : "/dashboard");
      router.refresh();
    } catch (galat) {
      const info = terjemahkanGalatAuth(galat);
      if (!info.diam) {
        toast.error(info.pesan);
        // Galat konfigurasi butuh langkah perbaikan, bukan sekadar notifikasi
        // yang hilang dalam tiga detik.
        if (info.langkah) setGalatLangkah(info);
      }
      setMemuat(false);
    }
  }

  if (!terkonfigurasi) {
    return (
      <div className="rounded-lg border border-warning/25 bg-warning/10 p-4 text-sm">
        <p className="font-medium">Firebase belum dikonfigurasi.</p>
        <p className="mt-1 text-muted-foreground">
          Buka <a className="underline" href="/setup">/setup</a> untuk melihat
          variabel lingkungan yang masih kurang.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button size="lg" className="w-full" onClick={tangani} disabled={memuat}>
        <IkonGoogle />
        {memuat ? "Menghubungkan…" : "Masuk dengan Google"}
      </Button>

      {galatLangkah?.langkah ? (
        <div className="rounded-lg border border-warning/25 bg-warning/10 p-4 text-sm">
          <p className="font-medium">{galatLangkah.pesan}</p>
          <ol className="mt-2 ml-4 list-decimal space-y-1 text-muted-foreground">
            {galatLangkah.langkah.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
