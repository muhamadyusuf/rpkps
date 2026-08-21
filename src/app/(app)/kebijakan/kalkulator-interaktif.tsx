"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { LABEL_BENTUK } from "@/domain/beban-belajar/kebijakan-bawaan";
import { bebanMahasiswa, periksaMataKuliah } from "@/domain/beban-belajar/validator";
import type { BentukPembelajaran, Kebijakan } from "@/domain/beban-belajar/tipe";

const PILIHAN_SKS = [0, 1, 2, 3, 4, 5, 6];

export function KalkulatorInteraktif({ kebijakan }: { kebijakan: Kebijakan }) {
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
        <CardTitle className="text-base">Kalkulator beban belajar</CardTitle>
        <CardDescription>
          Menghitung pagu waktu satu mata kuliah dan memeriksanya terhadap
          invarian {kebijakan.jamPerSksPerSemester} jam per sks per semester.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>sks teori</Label>
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
                      {LABEL_BENTUK[b] ?? b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>sks praktik</Label>
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
                      {LABEL_BENTUK[b] ?? b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {hasil === null ? (
          <p className="text-sm text-muted-foreground">
            Tentukan jumlah sks lebih dari nol.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metrik
                label="Pagu per minggu efektif"
                nilai={formatMenit(hasil.rencana.paguMingguEfektif.total)}
                rincian={`TM ${hasil.rencana.paguMingguEfektif.tm}' · PT ${hasil.rencana.paguMingguEfektif.pt}' · BM ${hasil.rencana.paguMingguEfektif.bm}'`}
              />
              <Metrik
                label="Beban terjadwal"
                nilai={formatMenit(hasil.rencana.paguMingguEfektif.terjadwal)}
                rincian={
                  hasil.rencana.paguMingguEfektif.ruangKhusus > 0
                    ? `termasuk ${formatMenit(hasil.rencana.paguMingguEfektif.ruangKhusus)} ruang khusus`
                    : "butuh slot ruang per minggu"
                }
              />
              <Metrik
                label="Total semester"
                nilai={`${hasil.rencana.jamPerSks} jam/sks`}
                rincian={`${hasil.rencana.totalJam} jam · ${hasil.rencana.sksTotal} sks`}
                sorot={hasil.lolos ? "baik" : "buruk"}
              />
            </div>

            <BarisMinggu rencana={hasil.rencana} />

            {hasil.temuan.length === 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success/10 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-foreground" />
                <p>
                  Lolos seluruh pemeriksaan. Total mendarat tepat di{" "}
                  {kebijakan.jamPerSksPerSemester} jam per sks.
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
                          Lapis {t.lapis}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {t.kode}
                        </span>
                      </div>
                      <p>{t.pesan}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <BebanPaket kebijakan={kebijakan} />
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
}: {
  rencana: ReturnType<typeof periksaMataKuliah>["rencana"];
}) {
  const maks = Math.max(...rencana.minggu.map((m) => m.pagu.total), 1);
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Sebaran pagu per minggu
      </p>
      <div className="flex items-end gap-1">
        {rencana.minggu.map((m) => (
          <div key={m.minggu} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full rounded-sm ${
                m.jenis === "UJIAN" ? "bg-warning/100/60" : "bg-primary/70"
              }`}
              style={{ height: `${Math.max(4, (m.pagu.total / maks) * 56)}px` }}
              title={`Minggu ${m.minggu}: ${formatMenit(m.pagu.total)}${
                m.jenis === "UJIAN" ? " (ujian)" : ""
              }`}
            />
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {m.minggu}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="inline-block size-2 rounded-sm bg-primary/70 align-middle" />{" "}
        minggu efektif ·{" "}
        <span className="inline-block size-2 rounded-sm bg-warning/100/60 align-middle" />{" "}
        minggu ujian (pagunya diambil dari sisa target, bukan angka tetap)
      </p>
    </div>
  );
}

function BebanPaket({ kebijakan }: { kebijakan: Kebijakan }) {
  const paket = [18, 20, 22, 24].map((sks) => ({
    sks,
    ...bebanMahasiswa(kebijakan, sks),
  }));

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium">Beban mahasiswa bila mengambil…</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {paket.map((p) => (
          <div key={p.sks}>
            <p className="text-xs text-muted-foreground">{p.sks} sks</p>
            <p className="text-sm font-semibold tabular-nums">
              {p.jamPerMinggu} jam/mgg
            </p>
            <p className="text-[10px] text-muted-foreground">
              {p.setaraKerjaPenuh}x kerja penuh waktu
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
