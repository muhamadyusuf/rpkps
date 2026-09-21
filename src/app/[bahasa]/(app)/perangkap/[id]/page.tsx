import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Tautan } from "@/components/tautan";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { wajibPeran } from "@/lib/otorisasi";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi } from "@/lib/bahasa/teks";
import { tautanPeta } from "@/domain/keamanan/lokasi-ip";
import type { RingkasanKiriman } from "@/domain/keamanan/perangkap";
import { FormulirTinjauan } from "./formulir";

export const dynamic = "force-dynamic";

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

export default async function HalamanDetailPerangkap({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await wajibPeran("ADMIN");
  const { id } = await params;
  const [k, b] = await Promise.all([kamus(), bahasaAktif()]);

  const t = await prisma.perangkapTemuan.findUnique({ where: { id } });
  if (!t) notFound();

  const [seIp, sePerangkat] = await Promise.all([
    prisma.perangkapTemuan.findMany({
      where: { ip: t.ip, id: { not: t.id } },
      orderBy: { terakhirPada: "desc" },
      take: 10,
      select: { id: true, metode: true, jalur: true, terakhirPada: true },
    }),
    t.sidikPerangkat
      ? prisma.perangkapTemuan.findMany({
          where: { sidikPerangkat: t.sidikPerangkat, ip: { not: t.ip } },
          orderBy: { terakhirPada: "desc" },
          take: 10,
          select: { id: true, ip: true, jalur: true, terakhirPada: true },
        })
      : Promise.resolve([]),
  ]);

  const d = k.perangkap.detail;
  const peta = tautanPeta(t.lintang, t.bujur);
  const kiriman = (t.kiriman ?? null) as RingkasanKiriman | null;
  const kepala = (t.header ?? {}) as Record<string, string>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ButtonLink href="/perangkap" variant="ghost" size="sm">
        <ArrowLeft />
        {d.kembali}
      </ButtonLink>

      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">{k.perangkap.eyebrow}</p>
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{t.ip}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {k.perangkap.jenis[t.jenis as keyof typeof k.perangkap.jenis] ?? t.jenis}
          </Badge>
          <Badge variant={t.status === "BARU" ? "destructive" : "outline"}>
            {k.perangkap.status[t.status]}
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.identitas}</CardTitle>
          <CardDescription>{d.tanpaFoto}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <Baris label={d.ip}><span className="font-mono">{t.ip}</span></Baris>
            <Baris label={d.rantaiIp}><span className="font-mono">{t.rantaiIp}</span></Baris>
            <Baris label={d.perangkat}><span className="font-mono">{t.sidikPerangkat}</span></Baris>
            <Baris label={d.userAgent}>{t.userAgent}</Baris>
            <Baris label={d.bahasa}>{t.bahasaPeramban}</Baris>
            <Baris label={d.rujukan}>{t.rujukan}</Baris>
            <Baris label={d.pertama}>{tanggal(t.pertamaPada, b, "waktu")}</Baris>
            <Baris label={d.terakhir}>{tanggal(t.terakhirPada, b, "waktu")}</Baris>
            <Baris label={d.jumlah}>{t.jumlah}</Baris>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.lokasi}</CardTitle>
          <CardDescription>{k.perangkap.catatanLokasi}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <Baris label={d.negara}>{[t.negara, t.kodeNegara].filter(Boolean).join(" · ")}</Baris>
            <Baris label={d.wilayah}>{t.wilayah}</Baris>
            <Baris label={d.kota}>{t.kota}</Baris>
            <Baris label={d.koordinat}>
              {peta ? (
                <a
                  href={peta}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <span className="font-mono">
                    {t.lintang}, {t.bujur}
                  </span>
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </Baris>
            <Baris label={d.zona}>{t.zonaWaktu}</Baris>
            <Baris label={d.penyedia}>{[t.penyedia, t.asn].filter(Boolean).join(" · ")}</Baris>
            <Baris label={d.sumberLokasi}>{t.sumberLokasi}</Baris>
          </dl>
          {!t.kota && !t.negara && !t.kodeNegara ? (
            <p className="text-sm text-muted-foreground">{k.perangkap.lokasiBelum}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.serangan}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <Baris label={d.sasaran}>
              <code className="font-mono">{t.metode} {t.jalur}</code>
            </Baris>
            <Baris label={d.kueri}><code className="font-mono">{t.kueri}</code></Baris>
            {kiriman ? (
              <>
                <Baris label={d.penggunaDicoba}><code className="font-mono">{kiriman.pengguna}</code></Baris>
                <Baris label={d.kiriman}>
                  {kiriman.panjangSandi !== undefined
                    ? isi(d.panjangSandi, { n: kiriman.panjangSandi })
                    : null}
                </Baris>
                <Baris label={d.kolomDikirim}>
                  {kiriman.kolom.length > 0 ? (
                    <span className="font-mono">{kiriman.kolom.join(", ")}</span>
                  ) : null}
                </Baris>
                <Baris label={d.cuplikan}>
                  {kiriman.cuplikan ? (
                    <pre className="whitespace-pre-wrap break-all font-mono text-xs">{kiriman.cuplikan}</pre>
                  ) : null}
                </Baris>
              </>
            ) : null}
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">{d.kepala}</summary>
            <dl className="mt-2 divide-y divide-border">
              {Object.entries(kepala).map(([nama, nilai]) => (
                <Baris key={nama} label={nama}>
                  <span className="font-mono text-xs">{nilai}</span>
                </Baris>
              ))}
            </dl>
          </details>
        </CardContent>
      </Card>

      {seIp.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{d.seIp}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {seIp.map((x) => (
                <li key={x.id}>
                  <Tautan href={`/perangkap/${x.id}`} className="underline-offset-4 hover:underline">
                    <code className="font-mono text-xs">{x.metode} {x.jalur}</code>
                  </Tautan>
                  <span className="ml-2 text-xs text-muted-foreground">{tanggal(x.terakhirPada, b, "waktu")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {sePerangkat.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">{d.sePerangkat}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {sePerangkat.map((x) => (
                <li key={x.id}>
                  <Tautan href={`/perangkap/${x.id}`} className="underline-offset-4 hover:underline">
                    <span className="font-mono text-xs">{x.ip}</span>{" "}
                    <code className="font-mono text-xs">{x.jalur}</code>
                  </Tautan>
                  <span className="ml-2 text-xs text-muted-foreground">{tanggal(x.terakhirPada, b, "waktu")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.tinjau}</CardTitle>
          {t.ditinjauOleh && t.ditinjauPada ? (
            <CardDescription>
              {isi(d.ditinjauOleh, { nama: t.ditinjauOleh, waktu: tanggal(t.ditinjauPada, b, "waktu") })}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <FormulirTinjauan id={t.id} status={t.status} catatan={t.catatan ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
