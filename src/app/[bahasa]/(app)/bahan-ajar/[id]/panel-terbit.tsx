"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teksTemuan } from "@/lib/bahasa/temuan";
import type { TemuanBahanAjar } from "@/domain/bahan-ajar/tipe";
import { simpanSinopsis, susunSinopsisAi } from "./aksi-sunting";

/**
 * Kesiapan terbit — docs/19 §4.
 *
 * Menjawab satu pertanyaan: apakah naskah ini dapat diserahkan. Bukan "apakah
 * isinya bagus" — itu tidak dapat dinilai mesin, dan yang dapat menilainya
 * hanya penulisnya sendiri.
 */
export function PanelTerbit({
  bukuId,
  temuan,
  siap,
  ringkasan,
  sinopsisAwal,
  kataKunciAwal,
  bolehTulis,
  adaKunciAi,
}: {
  bukuId: string;
  temuan: TemuanBahanAjar[];
  siap: boolean;
  ringkasan: { taksiranHalaman: number; babBerisi: number; jumlahBab: number };
  sinopsisAwal: string | null;
  kataKunciAwal: string[];
  bolehTulis: boolean;
  adaKunciAi: boolean;
}) {
  const { k, isi } = useBahasa();
  const router = useRouter();

  const [sinopsis, setSinopsis] = useState(sinopsisAwal ?? "");
  const [kataKunci, setKataKunci] = useState(kataKunciAwal.join(", "));
  const [menunggu, mulai] = useTransition();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{k.bahanAjar.terbitJudul}</CardTitle>
            <CardDescription className="mt-1">
              {isi(k.bahanAjar.terbitRingkas, {
                halaman: ringkasan.taksiranHalaman,
                berisi: ringkasan.babBerisi,
                total: ringkasan.jumlahBab,
              })}
            </CardDescription>
          </div>
          <Badge variant={siap ? "default" : "outline"}>
            {siap ? k.bahanAjar.terbitSiap : k.bahanAjar.terbitBelum}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {temuan.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success-foreground" />
            {k.bahanAjar.terbitLengkap}
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {temuan.map((t, i) => {
              const kalimat = teksTemuan(t, k);
              return (
                <li key={`${t.kode}-${i}`} className="flex items-start gap-2">
                  {t.tingkat === "PEMBLOKIR" ? (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span>
                    {kalimat.pesan}
                    {kalimat.saran ? (
                      <span className="block text-xs text-muted-foreground">{kalimat.saran}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="space-y-2 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="sinopsis">{k.bahanAjar.sinopsisJudul}</Label>
            {bolehTulis ? (
              <Button
                size="sm"
                variant="outline"
                disabled={menunggu || !adaKunciAi}
                onClick={() =>
                  mulai(async () => {
                    const hasil = await susunSinopsisAi(bukuId);
                    if (hasil.ok) {
                      toast.success(hasil.pesan);
                      router.refresh();
                    } else toast.error(hasil.pesan);
                  })
                }
              >
                {menunggu ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {k.bahanAjar.susunSinopsis}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{k.bahanAjar.sinopsisKeterangan}</p>

          <textarea
            id="sinopsis"
            rows={5}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            value={sinopsis}
            disabled={!bolehTulis}
            onChange={(e) => setSinopsis(e.target.value)}
          />

          <Label htmlFor="katakunci">{k.bahanAjar.kataKunci}</Label>
          <Input
            id="katakunci"
            value={kataKunci}
            disabled={!bolehTulis}
            placeholder={k.bahanAjar.kataKunciPetunjuk}
            onChange={(e) => setKataKunci(e.target.value)}
          />

          {bolehTulis ? (
            <Button
              size="sm"
              disabled={menunggu}
              onClick={() =>
                mulai(async () => {
                  const hasil = await simpanSinopsis(bukuId, {
                    sinopsis: sinopsis.trim() || null,
                    kataKunci: kataKunci
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  });
                  if (hasil.ok) toast.success(hasil.pesan);
                  else toast.error(hasil.pesan);
                })
              }
            >
              {k.bahanAjar.simpan}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
