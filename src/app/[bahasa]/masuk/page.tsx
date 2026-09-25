import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { sesiSaatIni } from "@/lib/sesi";
import { jalurAktif, kamus } from "@/lib/bahasa/server";
import { Lambang } from "@/components/lambang";
import { HalamanPolos } from "@/components/rupa/halaman-polos";
import { kodeGalatSso } from "@/domain/identitas/sso";
import { ssoTersedia } from "@/lib/identitas/sso";
import { TombolMasuk } from "./tombol-masuk";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).masuk.metaJudul };
}

/**
 * Halaman masuk, polos ala Pengaturan identitas-itts (docs/28 §6): satu kartu
 * di tengah latar netral. Seluruh logika masuk tetap di `TombolMasuk` — yang
 * berubah hanya bingkainya.
 */
export default async function HalamanMasuk({
  searchParams,
}: {
  searchParams: Promise<{ galat?: string }>;
}) {
  const sesi = await sesiSaatIni().catch(() => null);
  if (sesi) redirect(await jalurAktif("/dashboard"));

  const [k, { galat }] = await Promise.all([kamus(), searchParams]);

  // `?galat=` dari alamat balik identitas-itts. Yang tampil bukan nilainya,
  // melainkan teks kamus untuk kode yang dikenal — kode lain diabaikan.
  const kodeGalat = kodeGalatSso(galat);
  const galatSso = kodeGalat ? k.masuk.sso.galat[kodeGalat] : null;

  return (
    <HalamanPolos className="justify-center">
      <section className="anim-muncul w-full max-w-[400px] rounded-xl border border-border bg-card p-6 shadow-angkat sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lambang className="size-6" />
          </span>
          <div className="min-w-0 leading-tight">
            <h1 className="text-lg font-semibold tracking-[-0.02em]">{k.aplikasi.nama}</h1>
            <p className="label-teknis mt-1.5">{k.masuk.tagline}</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{k.masuk.subjudul}</p>

        <div className="mt-6">
          <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-muted" />}>
            <TombolMasuk sso={ssoTersedia()} galatSso={galatSso} />
          </Suspense>
        </div>

        <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {k.masuk.catatan}
        </p>
      </section>

      <p className="mt-6 max-w-[400px] text-center text-[11px] text-muted-foreground">
        {k.aplikasi.deskripsi}
      </p>
    </HalamanPolos>
  );
}
