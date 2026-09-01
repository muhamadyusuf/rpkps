"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaTeks, Pilihan } from "@/components/ui/pilihan";
import { TombolIkon } from "@/components/tombol-ikon";
import { cn } from "@/lib/utils";
import { useAksiKurikulum } from "../aksi-klien";
import { geserCpl, hapusCpl, perbaruiCpl, tambahCpl, type MasukanCpl } from "../aksi-cpl";

/**
 * Penyunting CPL pada halaman kurikulum.
 *
 * Hanya dirender untuk kurikulum DRAF — halaman induk yang memutuskan itu,
 * dan aksinya memeriksa ulang di server. Keduanya perlu: yang di halaman
 * supaya tombolnya tidak menipu, yang di server karena aksi adalah titik masuk
 * yang dapat dipanggil tanpa melewati antarmuka sama sekali.
 */

export type CplTampil = {
  id: string;
  kode: string;
  deskripsi: string;
  ranah: string;
  tingkatKkni: number | null;
  jumlahMk: number;
  jumlahCpmk: number;
  kodeProfil: string[];
};

const RANAH = ["SIKAP", "PENGETAHUAN", "KETERAMPILAN_UMUM", "KETERAMPILAN_KHUSUS"] as const;

export function PengelolaCpl({
  kurikulumId,
  daftar,
}: {
  kurikulumId: string;
  daftar: CplTampil[];
}) {
  const { menunggu, jalankan } = useAksiKurikulum();
  const { k, isi } = useBahasa();
  const [menyunting, setMenyunting] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {daftar.map((c, i) =>
        menyunting === c.id ? (
          <FormulirCpl
            key={c.id}
            awal={c}
            menunggu={menunggu}
            onBatal={() => setMenyunting(null)}
            onSimpan={(masukan) =>
              jalankan(() => perbaruiCpl(c.id, masukan), () => setMenyunting(null))
            }
          />
        ) : (
          <div key={c.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="secondary">{c.kode}</Badge>
                <Badge variant="outline" className="text-[10px]">
                  {k.enum.ranahCpl[c.ranah as keyof typeof k.enum.ranahCpl]}
                </Badge>
                {c.tingkatKkni ? (
                  <span className="text-xs text-muted-foreground">
                    {isi(k.kurikulum.detail.kkni, { tingkat: c.tingkatKkni })}
                  </span>
                ) : null}
                {c.kodeProfil.map((kode) => (
                  <Badge key={kode} variant="outline" className="text-[10px]">
                    {kode}
                  </Badge>
                ))}
                <span className="text-xs text-muted-foreground">
                  {isi(k.kurikulum.detail.cplRingkas, { mk: c.jumlahMk, cpmk: c.jumlahCpmk })}
                </span>
              </div>

              <div className="flex gap-0.5">
                <TombolIkon
                  size="icon-xs"
                  petunjuk={isi(k.kurikulum.sunting.naik, { kode: c.kode })}
                  disabled={menunggu || i === 0}
                  petunjukMati={k.kurikulum.sunting.sudahTeratas}
                  onClick={() => jalankan(() => geserCpl(c.id, "naik"))}
                >
                  <ChevronUp />
                </TombolIkon>
                <TombolIkon
                  size="icon-xs"
                  petunjuk={isi(k.kurikulum.sunting.turun, { kode: c.kode })}
                  disabled={menunggu || i === daftar.length - 1}
                  petunjukMati={k.kurikulum.sunting.sudahTerbawah}
                  onClick={() => jalankan(() => geserCpl(c.id, "turun"))}
                >
                  <ChevronDown />
                </TombolIkon>
                <TombolIkon
                  size="icon-xs"
                  petunjuk={isi(k.kurikulum.sunting.suntingCpl, { kode: c.kode })}
                  disabled={menunggu}
                  onClick={() => setMenyunting(c.id)}
                >
                  <Pencil />
                </TombolIkon>
                <TombolIkon
                  size="icon-xs"
                  petunjuk={isi(k.kurikulum.sunting.hapusCpl, { kode: c.kode })}
                  disabled={menunggu}
                  onClick={() => {
                    if (!confirm(isi(k.kurikulum.sunting.konfirmasiHapusCpl, { kode: c.kode }))) {
                      return;
                    }
                    jalankan(() => hapusCpl(c.id));
                  }}
                >
                  <Trash2 />
                </TombolIkon>
              </div>
            </div>

            <p className="mt-1.5 text-sm">{c.deskripsi}</p>
          </div>
        ),
      )}

      {daftar.length === 0 ? (
        <p className="text-sm text-muted-foreground">{k.kurikulum.detail.cplKosong}</p>
      ) : null}

      <FormulirCpl
        baru
        menunggu={menunggu}
        onSimpan={(masukan, reset) => jalankan(() => tambahCpl(kurikulumId, masukan), reset)}
      />
    </div>
  );
}

function FormulirCpl({
  awal,
  baru = false,
  menunggu,
  onSimpan,
  onBatal,
}: {
  awal?: CplTampil;
  baru?: boolean;
  menunggu: boolean;
  onSimpan: (masukan: MasukanCpl, reset: () => void) => void;
  onBatal?: () => void;
}) {
  const { k } = useBahasa();
  const idForm = baru ? "form-cpl-baru" : `form-cpl-${awal?.id}`;

  return (
    <form
      id={idForm}
      className={cn(
        "space-y-3",
        baru ? "border-t pt-4" : "rounded-lg border border-cahaya/40 p-4",
      )}
      action={(fd) => {
        const kkni = String(fd.get("tingkatKkni") ?? "");
        onSimpan(
          {
            kode: String(fd.get("kode") ?? ""),
            deskripsi: String(fd.get("deskripsi") ?? ""),
            ranah: String(fd.get("ranah") ?? "KETERAMPILAN_KHUSUS"),
            // Kosong berarti tidak dicantumkan, bukan nol — banyak buku
            // kurikulum tidak menuliskan KKNI per CPL.
            tingkatKkni: kkni === "" ? null : Number(kkni),
          } as MasukanCpl,
          () => {
            const form = document.getElementById(idForm) as HTMLFormElement | null;
            form?.reset();
          },
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idForm}-kode`}>{k.kurikulum.sunting.kode}</Label>
          <Input
            id={`${idForm}-kode`}
            name="kode"
            defaultValue={awal?.kode ?? ""}
            placeholder={k.kurikulum.sunting.contohKodeCpl}
            className="w-28 font-mono"
            required
          />
        </div>

        <div className="min-w-52 flex-1 space-y-1.5">
          <Label htmlFor={`${idForm}-ranah`}>{k.kurikulum.sunting.ranah}</Label>
          <Pilihan id={`${idForm}-ranah`} nama="ranah" nilai={awal?.ranah ?? "KETERAMPILAN_KHUSUS"}>
            {RANAH.map((r) => (
              <option key={r} value={r}>
                {k.enum.ranahCpl[r]}
              </option>
            ))}
          </Pilihan>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idForm}-kkni`}>{k.kurikulum.sunting.tingkatKkni}</Label>
          <Input
            id={`${idForm}-kkni`}
            name="tingkatKkni"
            type="number"
            min={1}
            max={9}
            defaultValue={awal?.tingkatKkni ?? ""}
            placeholder="6"
            className="w-20 tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idForm}-deskripsi`}>{k.kurikulum.sunting.rumusanCpl}</Label>
        <AreaTeks
          id={`${idForm}-deskripsi`}
          nama="deskripsi"
          nilai={awal?.deskripsi ?? ""}
          placeholder={k.kurikulum.sunting.contohRumusanCpl}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant={baru ? "outline" : "default"} disabled={menunggu}>
          {baru ? <Plus /> : <Check />}
          {baru ? k.kurikulum.sunting.tambahCpl : k.umum.simpan}
        </Button>
        {onBatal ? (
          <Button type="button" variant="ghost" disabled={menunggu} onClick={onBatal}>
            <X />
            {k.umum.batal}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
