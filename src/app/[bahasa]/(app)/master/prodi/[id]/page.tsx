import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { bolehSuntingIdentitasProdi, wajibAktif } from "@/lib/otorisasi";
import { punyaPeran } from "@/domain/otorisasi";
import { env } from "@/lib/env";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { namaMk } from "@/lib/bahasa/teks";
import { FormulirIdentitas, KartuLogo, KartuPemetaanUnit } from "./formulir-identitas";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await kamus()).master.identitas.metaJudul };
}

/**
 * Identitas satu program studi (docs/21 §3.1).
 *
 * Gerbangnya BUKAN `wajibPeran("ADMIN")` seperti halaman master lainnya:
 * visi, misi, dan kontak adalah rumusan prodi, jadi Kaprodi prodi itu boleh
 * menyuntingnya sendiri. Keputusannya diambil `bolehSuntingIdentitasProdi`,
 * satu tempat, dan aksi-aksinya menimbangnya lagi — halaman yang tertutup
 * tidak pernah menjadi alasan untuk aksi yang terbuka.
 */
export default async function HalamanIdentitasProdi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sesi = await wajibAktif();
  const { id } = await params;

  const prodi = await prisma.prodi.findUnique({
    where: { id },
    select: {
      id: true,
      nama: true,
      namaEn: true,
      kode: true,
      jenjang: true,
      visi: true,
      visiEn: true,
      misi: true,
      misiEn: true,
      alamat: true,
      telepon: true,
      surel: true,
      situs: true,
      logoLebar: true,
      identitasUnitId: true,
      diubahPada: true,
    },
  });
  if (!prodi || !bolehSuntingIdentitasProdi(sesi, prodi.id)) notFound();

  const [k, b] = await Promise.all([kamus(), bahasaAktif()]);
  const t = k.master.identitas;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink href="/master/prodi" variant="ghost" size="sm" className="-ml-2">
          <ArrowLeft aria-hidden className="mr-1.5 size-4" />
          {t.kembali}
        </ButtonLink>
      </div>

      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">{k.master.eyebrow}</p>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {namaMk(prodi, b)}
          <Badge variant="outline">{prodi.kode}</Badge>
          <Badge variant="outline">{prodi.jenjang}</Badge>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.keterangan}</p>
      </header>

      <KartuLogo
        judul={t.logoJudul}
        nama={namaMk(prodi, b)}
        // Penanda versi: rutenya boleh di-cache lama, jadi tanpa ini lambang
        // yang baru diunggah tidak terlihat sampai cache peramban kedaluwarsa.
        urlLogo={
          prodi.logoLebar
            ? `/api/prodi/${prodi.id}/logo?v=${prodi.diubahPada.getTime()}`
            : null
        }
        milik={{ jenis: "prodi", id: prodi.id }}
      />

      {env.identitasItts && punyaPeran(sesi, "ADMIN") ? (
        <KartuPemetaanUnit prodiId={prodi.id} unitId={prodi.identitasUnitId} />
      ) : null}

      <FormulirIdentitas
        awal={{
          id: prodi.id,
          nama: namaMk(prodi, b),
          visi: prodi.visi,
          visiEn: prodi.visiEn,
          misi: prodi.misi,
          misiEn: prodi.misiEn,
          alamat: prodi.alamat,
          telepon: prodi.telepon,
          surel: prodi.surel,
          situs: prodi.situs,
        }}
      />
    </div>
  );
}
