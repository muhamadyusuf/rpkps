import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { sesiSaatIni } from "@/lib/sesi";
import { jalurAktif, kamus } from "@/lib/bahasa/server";
import { TombolTema } from "@/components/pengalih-tema";
import { TombolBahasa } from "@/components/pengalih-bahasa";
import { Lambang } from "@/components/lambang";
import { TombolMasuk } from "./tombol-masuk";
import gaya from "./masuk.module.css";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).masuk.metaJudul };
}

export default async function HalamanMasuk() {
  const sesi = await sesiSaatIni().catch(() => null);
  if (sesi) redirect(await jalurAktif("/dashboard"));

  const k = await kamus();

  return (
    <main className={gaya.masuk}>
      <div aria-hidden className={`kisi ${gaya.latar}`} />

      <div className={gaya.bingkai}>
        <div className={gaya.sakelar}>
          <TombolBahasa />
          <TombolTema />
        </div>

        <section className={gaya.naskah}>
          <p className={gaya.eyebrow}>
            <span aria-hidden />
            {k.masuk.tagline}
          </p>
          <h1>{k.aplikasi.nama}</h1>
          <p className={gaya.deskripsi}>{k.masuk.subjudul}</p>
          <p className={gaya.jaminan}>
            <ShieldCheck className="size-3.5" aria-hidden />
            {k.masuk.catatan}
          </p>
        </section>

        {/* Bidang masuk menempati posisi yang di beranda diisi blok arsitektur
            pembelajaran: sisi kanan, lumut gelap, tepi tajam. Yang berpindah
            hanya isinya — susunan halamannya dikenali sebagai halaman yang
            sama. */}
        <section className={gaya.panel}>
          <div className={gaya.panelAtas}>
            <span>OBE / RPKPS</span>
            <span aria-hidden>↗</span>
          </div>

          <div className={gaya.panelIsi}>
            <Lambang className={`${gaya.lambang} size-9`} />
            <h2>{k.publik.masuk}</h2>

            <Suspense
              fallback={
                <div className="h-11 animate-pulse rounded-md bg-white/10" />
              }
            >
              <TombolMasuk />
            </Suspense>
          </div>

          <p className={gaya.kaki}>{k.aplikasi.deskripsi}</p>
        </section>
      </div>
    </main>
  );
}
