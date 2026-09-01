import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibPeran } from "@/lib/otorisasi";
import { aiTersediaUntuk } from "@/lib/ai/kredensial";
import { FormulirImpor } from "./formulir-impor";
import { kamus } from "@/lib/bahasa/server";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).kurikulum.impor.metaJudul };
}

export default async function HalamanImpor() {
  const sesi = await wajibPeran("ADMIN", "KAPRODI");
  const cakupan = cakupanProdi(sesi);

  // Kunci AI melekat pada dosen (docs/08): ketersediaannya ditanya per
  // pengguna, bukan per server.
  const aiAktif = await aiTersediaUntuk(sesi.id);

  const prodi = await prisma.prodi.findMany({
    where: { aktif: true, ...(cakupan === null ? {} : { id: { in: cakupan } }) },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, kode: true },
  });

  const k = await kamus();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/kurikulum">
          <ArrowLeft />
          {k.kurikulum.detail.kembali}
        </ButtonLink>
      </div>

      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.kurikulum.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {k.kurikulum.impor.judul}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {k.kurikulum.impor.keterangan}
        </p>
      </header>

      {prodi.length === 0 ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-4 text-sm">
          {k.kurikulum.impor.tanpaProdi}
        </p>
      ) : (
        <FormulirImpor prodi={prodi} aiAktif={aiAktif} />
      )}
    </div>
  );
}
