import { FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { kamus } from "@/lib/bahasa/server";

export async function generateMetadata() {
  return { title: (await kamus()).galat.tidakDitemukan.metaJudul };
}

/**
 * Dipakai `notFound()` di halaman detail: RPKPS, usulan, kurikulum, kelas.
 *
 * Alamat yang salah dan dokumen yang tidak boleh dibuka berakhir di halaman
 * yang SAMA, dan itu disengaja: membedakan keduanya akan memberi tahu orang
 * luar bahwa sebuah id memang ada.
 */
export default async function TidakDitemukanAplikasi() {
  const k = await kamus();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted ring-1 ring-border">
        <FileQuestion className="size-5 text-muted-foreground" />
      </span>
      <div className="space-y-1.5">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {k.galat.tidakDitemukan.judul}
        </h1>
        <p className="text-sm text-muted-foreground">{k.galat.tidakDitemukan.dalam}</p>
      </div>
      <ButtonLink href="/dashboard">{k.galat.tidakDitemukan.kembali}</ButtonLink>
    </div>
  );
}
