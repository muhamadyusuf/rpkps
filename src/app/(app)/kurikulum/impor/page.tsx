import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibPeran } from "@/lib/otorisasi";
import { aiTersedia } from "@/lib/ai/klien";
import { FormulirImpor } from "./formulir-impor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Impor Kurikulum" };

export default async function HalamanImpor() {
  const sesi = await wajibPeran("ADMIN", "KAPRODI");
  const cakupan = cakupanProdi(sesi);

  const prodi = await prisma.prodi.findMany({
    where: { aktif: true, ...(cakupan === null ? {} : { id: { in: cakupan } }) },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, kode: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href="/kurikulum">
          <ArrowLeft />
          Kurikulum
        </ButtonLink>
      </div>

      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">Modul</p>
        <h1 className="text-2xl font-semibold tracking-tight">Impor Kurikulum</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          CPL, CPMK, dan Sub-CPMK berasal dari buku kurikulum. Setelah diimpor,
          ketiganya bersifat read-only di penyusun RPKPS — perubahan harus lewat
          usulan revisi kurikulum.
        </p>
      </header>

      {prodi.length === 0 ? (
        <p className="rounded-lg border border-warning/25 bg-warning/10 p-4 text-sm">
          Belum ada program studi aktif yang dapat Anda kelola.
        </p>
      ) : (
        <FormulirImpor prodi={prodi} aiAktif={aiTersedia()} />
      )}
    </div>
  );
}
