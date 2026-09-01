import { Tautan } from "@/components/tautan";
import { kamus } from "@/lib/bahasa/server";

export async function generateMetadata() {
  return { title: (await kamus()).galat.tidakDitemukan.metaJudul };
}

/** Alamat di luar seluruh modul — termasuk salah ketik pada tautan publik. */
export default async function TidakDitemukan() {
  const k = await kamus();

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="label-teknis text-muted-foreground/70">
        {k.galat.tidakDitemukan.kode}
      </p>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        {k.galat.tidakDitemukan.judul}
      </h1>
      <p className="text-sm text-muted-foreground">{k.galat.tidakDitemukan.akar}</p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Tautan href="/" className="underline underline-offset-4">
          {k.galat.tidakDitemukan.katalog}
        </Tautan>
        <Tautan href="/dashboard" className="underline underline-offset-4">
          {k.galat.tidakDitemukan.masukAplikasi}
        </Tautan>
      </div>
    </div>
  );
}
