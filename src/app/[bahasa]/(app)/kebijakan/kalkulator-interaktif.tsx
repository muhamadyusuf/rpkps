"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import type { Kamus } from "@/kamus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMenit } from "@/domain/beban-belajar/kalkulator";
import { bebanMahasiswa, periksaMataKuliah } from "@/domain/beban-belajar/validator";
import type { BentukPembelajaran, Kebijakan } from "@/domain/beban-belajar/tipe";
import { teksTemuan } from "@/lib/bahasa/temuan";

const PILIHAN_SKS = [0, 1, 2, 3, 4, 5, 6];

export function KalkulatorInteraktif({ kebijakan }: { kebijakan: Kebijakan }) {
  const { k, isi } = useBahasa();
  const [sksTeori, setSksTeori] = useState(2);
  const [sksPraktik, setSksPraktik] = useState(1);
  const [bentukTeori, setBentukTeori] = useState<BentukPembelajaran>("KULIAH");
  const [bentukPraktik, setBentukPraktik] = useState<BentukPembelajaran>("PRAKTIKUM");

  const hasil = useMemo(() => {
    if (sksTeori + sksPraktik === 0) return null;
    try {
      return periksaMataKuliah(kebijakan, {
        sksTeori,
        sksPraktik,
        bentukTeori,
        bentukPraktik,
      });
    } catch {
      return null;
    }
  }, [kebijakan, sksTeori, sksPraktik, bentukTeori, bentukPraktik]);

  const bentukTersedia = kebijakan.bentuk.map((b) => b.bentuk);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.kebijakan.kalkulator.judul}</CardTitle>
        <CardDescription>
          {isi(k.kebijakan.kalkulator.keterangan, {
            jam: kebijakan.jamPerSksPerSemester,
          })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{k.kebijakan.kalkulator.sksTeori}</Label>
            <div className="flex gap-2">
              <Select
                value={String(sksTeori)}
                onValueChange={(v) => setSksTeori(Number(v))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILIHAN_SKS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={bentukTeori}
                onValueChange={(v) => setBentukTeori(v as BentukPembelajaran)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bentukTersedia.map((b) => (
                    <SelectItem key={b} value={b}>
                      {k.enum.bentukPembelajaran[b] ?? b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{k.kebijakan.kalkulator.sksPraktik}</Label>
            <div className="flex gap-2">
              <Select
                value={String(sksPraktik)}
                onValueChange={(v) => setSksPraktik(Number(v))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILIHAN_SKS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={bentukPraktik}
                onValueChange={(v) => setBentukPraktik(v as BentukPembelajaran)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bentukTersedia.map((b) => (
                    <SelectItem key={b} value={b}>
                      {k.enum.bentukPembelajaran[b] ?? b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {hasil === null ? (
          <p className="text-sm text-muted-foreground">
            {k.kebijakan.kalkulator.sksNol}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metrik
                label={k.kebijakan.kalkulator.paguMinggu}
                nilai={formatMenit(hasil.rencana.paguMingguEfektif.total)}
                rincian={`TM ${hasil.rencana.paguMingguEfektif.tm}' · PT ${hasil.rencana.paguMingguEfektif.pt}' · BM ${hasil.rencana.paguMingguEfektif.bm}'`}
              />
              <Metrik
                label={k.kebijakan.kalkulator.bebanTerjadwal}
                nilai={formatMenit(hasil.rencana.paguMingguEfektif.terjadwal)}
                rincian={
                  hasil.rencana.paguMingguEfektif.ruangKhusus > 0
                    ? isi(k.kebijakan.kalkulator.termasukRuangKhusus, {
                        menit: formatMenit(hasil.rencana.paguMingguEfektif.ruangKhusus),
                      })
                    : k.kebijakan.kalkulator.butuhSlot
                }
              />
              <Metrik
                label={k.kebijakan.kalkulator.totalSemester}
                nilai={isi(k.kebijakan.kalkulator.jamPerSks, {
                  jam: hasil.rencana.jamPerSks,
                })}
                rincian={isi(k.kebijakan.kalkulator.rincianTotal, {
                  jam: hasil.rencana.totalJam,
                  sks: hasil.rencana.sksTotal,
                })}
                sorot={hasil.lolos ? "baik" : "buruk"}
              />
            </div>

            <BarisMinggu rencana={hasil.rencana} k={k} isi={isi} />

            {hasil.temuan.length === 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-foreground" />
                <p>
                  {isi(k.kebijakan.kalkulator.lolos, {
                    jam: kebijakan.jamPerSksPerSemester,
                  })}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {hasil.temuan.map((t, i) => (
                  <li
                    key={`${t.kode}-${i}`}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${
                      t.tingkat === "PEMBLOKIR"
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-warning/25 bg-warning/10"
                    }`}
                  >
                    {t.tingkat === "PEMBLOKIR" ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="mb-0.5 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {isi(k.kebijakan.kalkulator.lapis, { nomor: t.lapis })}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {t.kode}
                        </span>
                      </div>
                      <p>{teksTemuan(t, k).pesan}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <BebanPaket kebijakan={kebijakan} k={k} isi={isi} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metrik({
  label,
  nilai,
  rincian,
  sorot,
}: {
  label: string;
  nilai: string;
  rincian: string;
  sorot?: "baik" | "buruk";
}) {
  const warna =
    sorot === "baik"
      ? "text-success-foreground"
      : sorot === "buruk"
        ? "text-destructive"
        : "";
  return (
    <div className="panel rounded-lg border p-3">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p
        className={`mt-1.5 font-mono text-lg leading-none font-semibold tabular-nums ${warna}`}
      >
        {nilai}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{rincian}</p>
    </div>
  );
}

function BarisMinggu({
  rencana,
  k,
  isi,
}: {
  rencana: ReturnType<typeof periksaMataKuliah>["rencana"];
  k: Kamus;
  isi: (pola: string, sisipan?: Record<string, string | number>) => string;
}) {
  const maks = Math.max(...rencana.minggu.map((m) => m.pagu.total), 1);
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {k.kebijakan.kalkulator.sebaranPagu}
      </p>
      <div className="flex items-end gap-1">
        {rencana.minggu.map((m) => (
          <div key={m.minggu} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm ${
                m.jenis === "UJIAN" ? "bg-warning/100/60" : "bg-primary/70"
              }`}
              style={{ height: `${Math.max(4, (m.pagu.total / maks) * 56)}px` }}
              title={`${isi(k.kebijakan.kalkulator.judulMinggu, {
                nomor: m.minggu,
                menit: formatMenit(m.pagu.total),
              })}${m.jenis === "UJIAN" ? k.kebijakan.kalkulator.tandaUjian : ""}`}
            />
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {m.minggu}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="inline-block size-2 rounded-sm bg-primary/70 align-middle" />{" "}
        {k.kebijakan.kalkulator.legendaEfektif} ·{" "}
        <span className="inline-block size-2 rounded-sm bg-warning/100/60 align-middle" />{" "}
        {k.kebijakan.kalkulator.legendaUjian}
      </p>
    </div>
  );
}

function BebanPaket({
  kebijakan,
  k,
  isi,
}: {
  kebijakan: Kebijakan;
  k: Kamus;
  isi: (pola: string, sisipan?: Record<string, string | number>) => string;
}) {
  const paket = [18, 20, 22, 24].map((sks) => ({
    sks,
    ...bebanMahasiswa(kebijakan, sks),
  }));

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium">{k.kebijakan.kalkulator.bebanPaket}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {paket.map((p) => (
          <div key={p.sks}>
            <p className="text-xs text-muted-foreground">
              {isi(k.kebijakan.kalkulator.sks, { jumlah: p.sks })}
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {isi(k.kebijakan.kalkulator.jamPerMinggu, { jam: p.jamPerMinggu })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isi(k.kebijakan.kalkulator.setaraKerja, { kali: p.setaraKerjaPenuh })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
