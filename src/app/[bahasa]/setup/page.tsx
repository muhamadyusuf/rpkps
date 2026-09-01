import { CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { databaseTerkonfigurasi, statusEnv } from "@/lib/env";
import { periksaFirebaseAuth } from "@/lib/firebase/periksa";

import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { Kamus } from "@/kamus";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await kamus()).setup.metaJudul };
}

/**
 * Tiga bagian konfigurasi, dirakit dari kamus saat render.
 *
 * Nama variabel lingkungan dan navigasi konsol Firebase ("Sign-in method",
 * "Get started") TIDAK diterjemahkan: itu yang benar-benar tertulis di layar
 * yang sedang dibuka pembaca.
 */
function penjelasan(k: Kamus): Record<string, { judul: string; langkah: string[] }> {
  const b = k.setup.bagian;
  return {
    database: {
      judul: b.databaseJudul,
      langkah: [b.database1, b.database2, b.database3, b.database4],
    },
    firebaseKlien: {
      judul: b.klienJudul,
      langkah: [b.klien1, b.klien2, b.klien3, b.klien4, b.klien5],
    },
    firebaseAdmin: {
      judul: b.adminJudul,
      langkah: [b.admin1, b.admin2, b.admin3, b.admin4],
    },
  };
}

export default async function HalamanSetup() {
  const k = await kamus();
  const PENJELASAN = penjelasan(k);
  const status = statusEnv();
  const auth = await periksaFirebaseAuth();
  const dbSiap = status.database.siap && databaseTerkonfigurasi();
  const authAktif = auth.status === "aktif";
  const semuaSiap =
    dbSiap && status.firebaseKlien.siap && status.firebaseAdmin.siap && authAktif;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <p className="label-teknis text-muted-foreground/70">RPKPS ITTS</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
          {k.setup.judul}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {k.setup.keteranganAwal}{" "}
          <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.85em]">
            .env
          </code>{" "}
          {k.setup.keteranganAkhir}
        </p>
      </div>

      {semuaSiap ? (
        <Card className="mb-6 border-l-2 border-l-success bg-success/8">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <CheckCircle2 className="size-5 shrink-0 text-success-foreground" />
            <div>
              <CardTitle className="text-base">{k.setup.lengkapJudul}</CardTitle>
              <CardDescription>{k.setup.lengkapIsi}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ButtonLink href="/masuk">{k.setup.lanjutMasuk}</ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      {status.firebaseKlien.siap && !authAktif ? (
        <Card className="mb-6 border-l-2 border-l-warning bg-warning/8">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
            <div className="min-w-0">
              <CardTitle className="text-base">
                {auth.status === "belum-aktif"
                  ? k.setup.authBelumAktif
                  : auth.status === "kunci-salah"
                    ? k.setup.authKunciSalah
                    : k.setup.authTakTerjangkau}
              </CardTitle>
              <CardDescription className="mt-1">
                {auth.status === "belum-aktif" ? (
                  <>
                    {k.setup.authBelumAktifAwal}{" "}
                    <code className="rounded border border-border bg-muted px-1 font-mono text-[0.85em]">
                      auth/configuration-not-found
                    </code>
                    .
                  </>
                ) : auth.status === "kunci-salah" ? (
                  k.setup.authKunciSalahIsi
                ) : (
                  isi(k.setup.authTakTerjangkauIsi, {
                    pesan: auth.status === "tak-terjangkau" ? auth.pesan : "—",
                  })
                )}
              </CardDescription>
            </div>
          </CardHeader>
          {auth.status === "belum-aktif" ? (
            <CardContent>
              <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
                <li>{k.setup.langkah1}</li>
                <li>
                  {k.setup.langkah2Awal} <strong>Authentication</strong>{" "}
                  {k.setup.langkah2Akhir} <strong>Get started</strong>.
                </li>
                <li>
                  {k.setup.langkah3Awal} <strong>Sign-in method</strong>{" "}
                  {k.setup.langkah3Tengah} <strong>Google</strong>{" "}
                  {k.setup.langkah3Akhir}
                </li>
                <li>{k.setup.langkah4}</li>
              </ol>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {authAktif && auth.domainDiizinkan.length > 0 ? (
        <p className="mb-6 text-xs text-muted-foreground">
          {isi(k.setup.domainDiizinkan, {
            domain: auth.domainDiizinkan.join(", "),
          })}
        </p>
      ) : null}

      <div className="space-y-4">
        {(Object.keys(PENJELASAN) as (keyof typeof PENJELASAN)[]).map((kunci) => {
          const bagian = status[kunci as keyof typeof status];
          const siap = kunci === "database" ? dbSiap : bagian.siap;
          const info = PENJELASAN[kunci];

          return (
            <Card key={kunci} className={siap ? "opacity-70" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {siap ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" />
                    ) : (
                      <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
                    )}
                    <div>
                      <CardTitle className="text-base">{info.judul}</CardTitle>
                      {!siap && bagian.kurang.length > 0 ? (
                        <CardDescription className="mt-1">
                          {isi(k.setup.belumTerisi, {
                            daftar: bagian.kurang.join(", "),
                          })}
                        </CardDescription>
                      ) : null}
                      {!siap &&
                      kunci === "database" &&
                      bagian.kurang.length === 0 ? (
                        <CardDescription className="mt-1">
                          {k.setup.placeholderDb}
                        </CardDescription>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={siap ? "secondary" : "outline"}>
                    {siap ? k.setup.siap : k.setup.belum}
                  </Badge>
                </div>
              </CardHeader>
              {!siap ? (
                <CardContent>
                  <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
                    {info.langkah.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ol>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        {k.setup.catatanAkhirAwal}{" "}
        <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          .env
        </code>
        {k.setup.catatanAkhirTengah}{" "}
        <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          npm run dev
        </code>
        .
      </p>
    </main>
  );
}
