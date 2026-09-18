import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { wajibPeran } from "@/lib/otorisasi";
import { FormulirImporPengguna } from "./formulir-impor";
import { kamus } from "@/lib/bahasa/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).pengguna.impor.metaJudul };
}

export default async function HalamanImporPengguna() {
  await wajibPeran("ADMIN");
  const k = await kamus();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/pengguna">
          <ArrowLeft />
          {k.pengguna.impor.kembali}
        </ButtonLink>
      </div>

      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.pengguna.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {k.pengguna.impor.judul}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {k.pengguna.impor.keterangan}
        </p>
      </header>

      <FormulirImporPengguna />
    </div>
  );
}
