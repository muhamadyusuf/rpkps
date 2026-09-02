"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Languages } from "lucide-react";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBahasa } from "@/components/penyedia-bahasa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { terapkanTerjemahan, usulkanTerjemahan, type Usul } from "./aksi-terjemahan";
import type { KunciPilihan } from "./panel-draf";

/**
 * Panel terjemahan berbantuan AI.
 *
 * Dua langkah yang sengaja tidak disatukan: meminta, lalu meninjau. Tombol
 * "Terjemahkan" tidak pernah menulis apa pun — yang menulis adalah
 * "Terapkan", setelah dosen mencentang. Terjemahan tidak pernah otomatis
 * (docs/11 §8).
 */
export function PanelTerjemahan({
  rpkpsId,
  kredensial,
}: {
  rpkpsId: string;
  kredensial: KunciPilihan[];
}) {
  const { k, isi } = useBahasa();
  const [usul, setUsul] = useState<Usul[] | null>(null);
  const [pilih, setPilih] = useState<Set<string>>(new Set());
  const [asal, setAsal] = useState<string | null>(null);
  const [berjalan, setBerjalan] = useState(false);
  const [menerapkan, mulaiTerap] = useTransition();
  const router = useRouter();

  /**
   * Kunci yang akan dipakai tertulis di panel, bukan tersembunyi di halaman
   * pengaturan: panggilan ini menagih ke akun dosen sendiri, dan yang
   * menanggung biaya berhak melihatnya sebelum menekan tombol (docs/08).
   */
  const aktif = kredensial.filter((x) => x.aktif);
  const [kunciId, setKunciId] = useState<string>(
    () => (aktif.find((x) => x.bawaan) ?? aktif[0])?.id ?? "",
  );

  if (aktif.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Languages className="size-4 shrink-0 text-primary" />
            {k.terjemahanPanel.judul}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3">
            <KeyRound className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm">
                <strong>{k.terjemahanPanel.tanpaKunciTebal}</strong>{" "}
                {k.terjemahanPanel.tanpaKunciIsi}
              </p>
              <ButtonLink size="sm" variant="outline" href="/pengaturan/ai">
                <KeyRound />
                {k.terjemahanPanel.daftarkanKunci}
              </ButtonLink>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function minta() {
    setBerjalan(true);
    try {
      const h = await usulkanTerjemahan(rpkpsId, kunciId || null);
      if (!h.ok) {
        toast.error(h.pesan);
        return;
      }
      setUsul(h.usul);
      // Seluruhnya tercentang di awal: dosen membaca lalu MEMBATALKAN yang
      // salah, bukan mencentang tiga puluhan baris satu per satu.
      setPilih(new Set(h.usul.map((u) => u.alamat)));
      setAsal(`${h.penyedia} · ${h.model}`);
      toast.success(h.pesan);
    } finally {
      setBerjalan(false);
    }
  }

  function terapkan() {
    if (!usul) return;
    mulaiTerap(async () => {
      const h = await terapkanTerjemahan(
        rpkpsId,
        usul.filter((u) => pilih.has(u.alamat)).map((u) => ({ alamat: u.alamat, teks: u.teks })),
      );
      if (h.ok) {
        toast.success(h.pesan);
        setUsul(null);
        setPilih(new Set());
        router.refresh();
      } else {
        toast.error(h.pesan);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Languages className="size-4 shrink-0 text-primary" />
          {k.terjemahanPanel.judul}
          {asal ? (
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {asal}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>{k.terjemahanPanel.keterangan}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={kunciId} onValueChange={(v) => setKunciId(v ?? "")}>
            <SelectTrigger className="w-auto min-w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {aktif.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.label} · {x.modelEfektif} · ···{x.ekor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={minta} disabled={berjalan || menerapkan}>
            <Languages />
            {berjalan ? k.terjemahanPanel.berjalan : k.terjemahanPanel.tombol}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{k.terjemahanPanel.naskahSah}</p>

        {usul ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">
                {isi(k.terjemahanPanel.tinjau, { jumlah: usul.length })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPilih(new Set(usul.map((u) => u.alamat)))}
              >
                {k.terjemahanPanel.pilihSemua}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPilih(new Set())}>
                {k.terjemahanPanel.kosongkan}
              </Button>
            </div>

            <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {usul.map((u) => (
                <li key={u.alamat} className="rounded-lg border p-3 text-sm">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={pilih.has(u.alamat)}
                      onChange={(e) =>
                        setPilih((s) => {
                          const b = new Set(s);
                          if (e.target.checked) b.add(u.alamat);
                          else b.delete(u.alamat);
                          return b;
                        })
                      }
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="block text-xs font-medium text-muted-foreground">
                        {u.label}
                      </span>
                      {/* Asli di kiri, usulan di kanan — sama seperti mode
                          berdampingan pada penyunting: menilai terjemahan
                          tanpa melihat aslinya tidak mungkin. */}
                      <span className="grid gap-2 md:grid-cols-2">
                        <span className="block rounded bg-muted/50 px-2 py-1.5 text-muted-foreground">
                          {u.asal}
                        </span>
                        <span className="block rounded bg-cahaya/[0.06] px-2 py-1.5">
                          {u.teks}
                        </span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <Button onClick={terapkan} disabled={menerapkan || pilih.size === 0}>
              {menerapkan ? k.terjemahanPanel.menerapkan : k.terjemahanPanel.terapkan}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
