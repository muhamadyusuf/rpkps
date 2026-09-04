"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBahasa } from "@/components/penyedia-bahasa";
import type { ButirDibuang } from "@/domain/kurikulum/draf-usulan";
import type { ButirInput } from "@/domain/kurikulum/usulan";
import type { KunciPilihan } from "@/app/[bahasa]/(app)/rpkps/[id]/panel-draf";
import { periksaKesiapanDraf, susunDrafAi, terapkanDrafAi } from "./aksi-draf";

/**
 * Panel draf AI pada usulan revisi — docs/04 §9.5.
 *
 * # Mengapa butir dicentang satu per satu
 *
 * Berbeda dari draf RPKPS, yang disetujui sekali untuk seluruh dokumen, di
 * sini tiap butir adalah usulan tersendiri yang nanti diputuskan Kaprodi satu
 * per satu. Persetujuan borongan akan menyeberangkan butir yang tidak pernah
 * dibaca siapa pun ke meja Kaprodi — dan butir yang tidak dibaca pengusulnya
 * sendiri adalah persis "kurikulum karangan LLM" yang §9.2 ada untuk
 * mencegahnya.
 *
 * Dasar tiap butir ditampilkan bersama butirnya, bukan disembunyikan di balik
 * tombol: yang membedakan usulan yang sah dari yang dikarang justru dasarnya.
 */
export function PanelDrafUsulan({
  usulanId,
  kredensial,
}: {
  usulanId: string;
  kredensial: KunciPilihan[];
}) {
  const { k, isi } = useBahasa();
  const router = useRouter();
  const d = k.usulan.draf;

  const [catatan, setCatatan] = useState("");
  const [butir, setButir] = useState<ButirInput[] | null>(null);
  const [dibuang, setDibuang] = useState<ButirDibuang[]>([]);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [asal, setAsal] = useState<string | null>(null);
  const [menyusun, setMenyusun] = useState(false);
  const [menerapkan, mulaiTerap] = useTransition();

  const aktif = kredensial.filter((x) => x.aktif);
  const [kunciId, setKunciId] = useState<string>(
    () => (aktif.find((x) => x.bawaan) ?? aktif[0])?.id ?? "",
  );
  const kunci = aktif.find((x) => x.id === kunciId) ?? null;

  function alihkan(id: string) {
    setDipilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  }

  async function susun() {
    setMenyusun(true);
    setButir(null);
    setDibuang([]);
    setDipilih(new Set());
    setAsal(null);

    const siap = await periksaKesiapanDraf(usulanId);
    if (!siap.ok) {
      setMenyusun(false);
      toast.error(siap.pesan ?? "");
      return;
    }

    const hasil = await susunDrafAi(usulanId, catatan, kunciId || null);
    setMenyusun(false);
    if (!hasil.ok) {
      toast.error(hasil.pesan ?? "");
      return;
    }

    setButir(hasil.butir ?? []);
    setDibuang(hasil.dibuang ?? []);
    // Tidak ada yang tercentang di awal. Mencentang adalah pernyataan sudah
    // dibaca; mencentangkannya lebih dulu membuat pernyataan itu bohong.
    setDipilih(new Set());
    setAsal(hasil.penyedia && hasil.model ? `${hasil.penyedia} · ${hasil.model}` : null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Sparkles className="size-4 shrink-0 text-primary" />
          {d.judul}
          {asal ? (
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {asal}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>{d.keterangan}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {aktif.length === 0 ? (
          <div className="rounded-lg border border-warning/25 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <div className="min-w-0 space-y-2">
                <p className="text-sm">
                  <strong>{d.tanpaKunciTebal}</strong> {d.tanpaKunciIsi}
                </p>
                <ButtonLink size="sm" variant="outline" href="/pengaturan/ai">
                  <KeyRound />
                  {d.daftarkanKunci}
                </ButtonLink>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-72 space-y-1.5">
              <label htmlFor="kunci-draf" className="label-teknis text-muted-foreground/80">
                {d.kunciDipakai}
              </label>
              <Select value={kunciId} onValueChange={(v) => setKunciId(v ?? "")}>
                <SelectTrigger id="kunci-draf" disabled={menyusun}>
                  <SelectValue placeholder={d.pilihKunci} />
                </SelectTrigger>
                <SelectContent>
                  {aktif.map((kr) => (
                    <SelectItem key={kr.id} value={kr.id}>
                      {k.enum.penyediaAi[kr.penyedia]} · {kr.label} · …{kr.ekor}
                      {kr.bawaan ? d.kunciBawaan : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kunci ? (
              <p className="pb-2 font-mono text-[11px] text-muted-foreground">
                {kunci.modelEfektif}
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="catatan-draf" className="label-teknis text-muted-foreground/80">
            {d.catatan}
          </label>
          <textarea
            id="catatan-draf"
            rows={3}
            disabled={menyusun}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder={d.catatanContoh}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">{d.catatanPetunjuk}</p>
        </div>

        <Button disabled={menyusun || kunci === null} onClick={() => void susun()}>
          {menyusun ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {menyusun ? d.menyusun : d.susun}
        </Button>

        {butir !== null && butir.length === 0 ? (
          <p className="text-sm text-muted-foreground">{d.hasilKosong}</p>
        ) : null}

        {butir !== null && butir.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDipilih(new Set(butir.map((b) => b.id)))}
              >
                {d.pilihSemua}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDipilih(new Set())}>
                {d.kosongkan}
              </Button>
            </div>

            <ul className="space-y-3">
              {butir.map((b) => (
                <li key={b.id} className="rounded-lg border p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0"
                      checked={dipilih.has(b.id)}
                      onChange={() => alihkan(b.id)}
                    />
                    <span className="min-w-0 space-y-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {k.enum.jenisButir[b.jenis]}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {b.subCpmkKode ?? b.cpmkKode}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {d.sumberAi}
                        </Badge>
                      </span>

                      {b.rumusan ? (
                        <span className="block text-sm">{b.rumusan}</span>
                      ) : null}
                      {b.cplKode && b.cplKode.length > 0 ? (
                        <span className="block font-mono text-xs text-muted-foreground">
                          {b.cplKode.join(", ")}
                        </span>
                      ) : null}
                      {b.mingguDisarankan && b.mingguDisarankan.length > 0 ? (
                        <span className="block font-mono text-xs text-muted-foreground">
                          {b.mingguDisarankan.join(", ")}
                        </span>
                      ) : null}

                      <span className="block text-xs text-muted-foreground">{b.alasan}</span>

                      {/*
                        Dasar ditampilkan lengkap. Inilah yang memisahkan usulan
                        yang sah dari yang dikarang, dan kutipannya berasal dari
                        katalog server — bukan dari jawaban model.
                      */}
                      <span className="block rounded border-l-2 border-cahaya/40 bg-muted/30 px-2 py-1.5">
                        <span className="label-teknis block text-muted-foreground/70">
                          {d.dasarJudul}
                        </span>
                        {b.dasar.map((x, i) => (
                          <span key={i} className="block text-xs text-muted-foreground">
                            {k.enum.jenisDasar[x.jenis]} — {x.kutipan}
                          </span>
                        ))}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <Button
              disabled={dipilih.size === 0 || menerapkan}
              onClick={() =>
                mulaiTerap(async () => {
                  const hasil = await terapkanDrafAi(
                    usulanId,
                    butir.filter((b) => dipilih.has(b.id)),
                    catatan,
                  );
                  if (hasil.ok) {
                    toast.success(hasil.pesan);
                    setButir(null);
                    setDipilih(new Set());
                    router.refresh();
                  } else toast.error(hasil.pesan);
                })
              }
            >
              {menerapkan ? <Loader2 className="size-4 animate-spin" /> : null}
              {isi(d.terapkan, { jumlah: dipilih.size })}
            </Button>
          </div>
        ) : null}

        {dibuang.length > 0 ? (
          <div className="rounded-lg border border-dashed p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <TriangleAlert className="size-4 shrink-0 text-muted-foreground" />
              {isi(d.dibuangJudul, { jumlah: dibuang.length })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{d.dibuangKeterangan}</p>
            <ul className="mt-2 space-y-1">
              {dibuang.map((x, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-mono">{x.sasaran}</span> —{" "}
                  {d.sebab[x.kode as keyof typeof d.sebab] ?? x.alasan}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
