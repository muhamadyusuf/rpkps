import { Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { sesiSaatIni } from "@/lib/sesi";
import { jalurAktif, kamus } from "@/lib/bahasa/server";
import { TombolKeluar } from "@/components/tombol-keluar";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).menungguVerifikasi.metaJudul };
}

export default async function HalamanMenungguVerifikasi() {
  const sesi = await sesiSaatIni();
  if (!sesi) redirect(await jalurAktif("/masuk"));
  if (sesi.status === "AKTIF") redirect(await jalurAktif("/dashboard"));

  const k = await kamus();

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-xl border border-warning/35 bg-warning/10 text-warning">
          <Clock className="size-6" />
        </div>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.menungguVerifikasi.eyebrow}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {k.menungguVerifikasi.judul}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {k.menungguVerifikasi.isiAwal}{" "}
          <span className="font-mono text-foreground">{sesi.email}</span>
          {k.menungguVerifikasi.isiAkhir}
        </p>
        <div className="mt-6">
          <TombolKeluar variant="outline" />
        </div>
      </div>
    </main>
  );
}
