"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LEMBAR_TEMPLAT } from "@/domain/rpkps/templat";
import { cn } from "@/lib/utils";
import {
  periksaImporTemplat,
  terapkanImporTemplat,
  type HasilPratinjauImpor,
} from "./aksi-impor";

/**
 * Impor isi RPKPS dari template Excel (docs/23).
 *
 * Berkas TETAP di peramban antara pemeriksaan dan penerapan, lalu dikirim lagi
 * saat menerapkan: server membaca ulang berkas itu, tidak memercayai hasil
 * pemeriksaan. Karena itu tidak ada draf yang disimpan di state panel ini —
 * hanya berkas, hasil ringkas, dan cap versi dokumen.
 */
export function PanelImpor({ rpkpsId }: { rpkpsId: string }) {
  const { k, isi, bahasa } = useBahasa();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const [berkas, setBerkas] = useState<File | null>(null);
  const [hasil, setHasil] = useState<HasilPratinjauImpor | null>(null);
  const [lembar, setLembar] = useState<string | null>(null);
  const [memeriksa, mulaiPeriksa] = useTransition();
  const [menerapkan, mulaiTerapkan] = useTransition();

  const t = k.rpkps.impor;
  const sibuk = memeriksa || menerapkan;

  function pilih(f: File | null) {
    setBerkas(f);
    setHasil(null);
    setLembar(null);
  }

  function periksa() {
    if (!berkas) return;
    mulaiPeriksa(async () => {
      const data = new FormData();
      data.set("berkas", berkas);
      const h = await periksaImporTemplat(rpkpsId, data);
      setHasil(h);
      setLembar(null);
      if (h.pesan) toast.error(h.pesan);
    });
  }

  function terapkan() {
    if (!berkas || !hasil?.cap) return;
    mulaiTerapkan(async () => {
      const data = new FormData();
      data.set("berkas", berkas);
      data.set("cap", hasil.cap as string);
      const h = await terapkanImporTemplat(rpkpsId, data);
      if (!h.ok) {
        toast.error(h.pesan);
        return;
      }
      toast.success(h.pesan);
      pilih(null);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  const perLembar = new Map<string, number>();
  for (const x of hasil?.temuan ?? []) {
    const kunci = x.lembar ?? "";
    perLembar.set(kunci, (perLembar.get(kunci) ?? 0) + 1);
  }
  const tampil = (hasil?.temuan ?? []).filter((x) => lembar === null || (x.lembar ?? "") === lembar);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="size-4 shrink-0 text-primary" />
          {t.judul}
        </CardTitle>
        <CardDescription>{t.keterangan}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Rute API tidak berawalan bahasa; `?bahasa=` hanya memilih bahasa lembar Petunjuk. */}
          <a
            href={`/api/rpkps/${rpkpsId}/templat?bahasa=${bahasa}`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Download />
            {t.unduh}
          </a>

          <input
            ref={input}
            id="berkas-impor"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={sibuk}
            onChange={(e) => pilih(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" disabled={sibuk} onClick={() => input.current?.click()}>
            <Upload />
            {t.pilihBerkas}
          </Button>

          <Button disabled={!berkas || sibuk} onClick={periksa}>
            {memeriksa ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            {memeriksa ? t.memeriksa : t.periksa}
          </Button>
        </div>

        {berkas ? (
          <p className="font-mono text-xs text-muted-foreground">
            {isi(t.berkasDipilih, { nama: berkas.name })}
          </p>
        ) : null}

        {hasil && !hasil.ok && hasil.totalTemuan > 0 ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0 text-destructive" />
              <p className="text-sm font-medium">{isi(t.temuanJudul, { jumlah: hasil.totalTemuan })}</p>
            </div>

            {perLembar.size > 1 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <ChipLembar aktif={lembar === null} onClick={() => setLembar(null)}>
                  {isi(t.saringSemua, { jumlah: hasil.temuan.length })}
                </ChipLembar>
                {[...perLembar].map(([kunci, n]) => (
                  <ChipLembar key={kunci} aktif={lembar === kunci} onClick={() => setLembar(kunci)}>
                    {kunci ? LEMBAR_TEMPLAT[kunci as keyof typeof LEMBAR_TEMPLAT] : "—"} · {n}
                  </ChipLembar>
                ))}
              </div>
            ) : null}

            <ul className="space-y-1.5 text-sm">
              {tampil.map((x, i) => (
                <li key={i}>
                  {x.lembar ? (
                    <span className="mr-1 font-mono text-[10px] text-muted-foreground">
                      {x.baris
                        ? isi(t.lokasi, { lembar: LEMBAR_TEMPLAT[x.lembar], baris: x.baris })
                        : isi(t.lokasiLembar, { lembar: LEMBAR_TEMPLAT[x.lembar] })}
                      {x.kolom ? ` · ${isi(t.kolom, { kolom: x.kolom })}` : ""}
                    </span>
                  ) : null}
                  {/*
                    Temuan lapis 1–2 membawa kode dan parameter; kalimatnya milik
                    kamus, dalam bahasa pembaca. Temuan `periksaDraf` membawa
                    `pesan` Indonesianya sendiri, sama seperti pada draf AI.
                  */}
                  {t.temuan[x.kode] ? isi(t.temuan[x.kode], x.params ?? {}) : (x.pesan ?? x.kode)}
                </li>
              ))}
              {hasil.totalTemuan > hasil.temuan.length ? (
                <li className="text-muted-foreground">
                  {isi(t.terpotong, { jumlah: hasil.totalTemuan - hasil.temuan.length })}
                </li>
              ) : null}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{t.temuanPetunjuk}</p>
          </div>
        ) : null}

        {hasil?.ok && hasil.ringkas && hasil.timpa ? (
          <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-success-foreground" />
              <p className="text-sm font-medium">{t.lolosJudul}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {isi(t.ringkasan, {
                pertemuan: hasil.ringkas.jumlahPertemuan,
                indikator: hasil.ringkas.jumlahIndikator,
                tugas: hasil.ringkas.jumlahTugas,
                butir: hasil.ringkas.jumlahButirUjian,
                komponen: hasil.ringkas.jumlahKomponen,
                pustaka: hasil.ringkas.jumlahPustakaBaru,
              })}
            </p>

            <div className="rounded-md border bg-background p-2.5">
              <p className="label-teknis text-muted-foreground/80">{t.timpaJudul}</p>
              <p className="mt-1 text-sm">
                {hasil.timpa.mingguTerisi === 0 && hasil.timpa.tugas === 0 && hasil.timpa.kisiKisi === 0
                  ? t.timpaKosong
                  : isi(t.timpaIsi, {
                      minggu: hasil.timpa.mingguTerisi,
                      efektif: hasil.timpa.mingguEfektif,
                    })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={sibuk} onClick={terapkan}>
                {menerapkan ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                {menerapkan ? t.menerapkan : t.terapkan}
              </Button>
              <Button variant="outline" disabled={sibuk} onClick={() => pilih(null)}>
                {t.batal}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChipLembar({
  aktif,
  onClick,
  children,
}: {
  aktif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs",
        aktif ? "border-destructive/60 bg-destructive/10" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
