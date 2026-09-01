import { Suspense } from "react";
import { redirect } from "next/navigation";
import { sesiSaatIni } from "@/lib/sesi";
import { jalurAktif, kamus } from "@/lib/bahasa/server";
import { PengalihTema } from "@/components/pengalih-tema";
import { Lambang } from "@/components/lambang";
import { TombolMasuk } from "./tombol-masuk";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).masuk.metaJudul };
}

export default async function HalamanMasuk() {
  const sesi = await sesiSaatIni().catch(() => null);
  if (sesi) redirect(await jalurAktif("/dashboard"));

  const k = await kamus();

  return (
    <main className="relative flex min-h-dvh items-center justify-center px-6 py-12">
      {/* Halaman masuk memakai kisi yang lebih tegas daripada halaman dalam:
          ini satu-satunya layar tanpa data, jadi bidangnya boleh bicara. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="kisi absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,#000,transparent_75%)]" />
        <div className="absolute top-[-18rem] left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-cahaya/12 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Lambang berpendar className="mx-auto mb-5 size-14" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {k.aplikasi.nama}
          </h1>
          <p className="label-teknis mt-2 text-muted-foreground/80">
            {k.masuk.tagline}
          </p>
          <p className="mt-3 text-sm text-balance text-muted-foreground">
            {k.masuk.subjudul}
          </p>
        </div>

        <div className="siku panel rounded-xl border border-border bg-card p-5 shadow-angkat">
          <Suspense
            fallback={<div className="h-11 animate-pulse rounded-lg bg-muted" />}
          >
            <TombolMasuk />
          </Suspense>

          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            {k.masuk.catatan}
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <PengalihTema className="w-64" />
        </div>
      </div>
    </main>
  );
}
