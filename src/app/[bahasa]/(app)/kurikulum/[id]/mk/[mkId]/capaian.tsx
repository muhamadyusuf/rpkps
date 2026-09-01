"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaTeks, Pilihan } from "@/components/ui/pilihan";
import { TombolIkon } from "@/components/tombol-ikon";
import { cn } from "@/lib/utils";
import { useAksiKurikulum } from "../../../aksi-klien";
import { setelCplMataKuliah } from "../../../aksi-mk";
import {
  geserCpmk,
  geserSubCpmk,
  hapusCpmk,
  hapusSubCpmk,
  perbaruiCpmk,
  perbaruiSubCpmk,
  setelCplCpmk,
  tambahCpmk,
  tambahSubCpmk,
  type MasukanCpmk,
  type MasukanSubCpmk,
} from "../../../aksi-cpmk";

/**
 * Penyunting CPMK dan Sub-CPMK pada halaman mata kuliah.
 *
 * Ketiga lapisan tampil bersarang dan dapat disunting di tempat, karena itulah
 * cara orang membacanya: sebuah Sub-CPMK hanya masuk akal di bawah CPMK-nya,
 * dan sebuah CPMK hanya masuk akal berdampingan dengan CPL yang dijabarkannya.
 *
 * Hanya dirender untuk kurikulum DRAF. Pada kurikulum BERLAKU halaman induk
 * menampilkan bentuk baca-saja beserta tombol "Usulkan revisi" — dan aksinya
 * tetap memeriksa ulang di server.
 */

const LEVEL = [
  "C1", "C2", "C3", "C4", "C5", "C6",
  "A1", "A2", "A3", "A4", "A5",
  "P1", "P2", "P3", "P4", "P5",
] as const;

export type SubCpmkTampil = {
  id: string;
  kode: string;
  rumusan: string;
  levelBloom: string | null;
  kko: string | null;
  mingguDisarankan: number[];
  sumber: string;
  pensiun: boolean;
};

export type CpmkTampil = {
  id: string;
  kode: string;
  rumusan: string;
  levelBloom: string | null;
  sumber: string;
  pensiun: boolean;
  cplId: string[];
  subCpmk: SubCpmkTampil[];
};

export type CplPilihan = { id: string; kode: string; deskripsi: string };

export function PengelolaCapaian({
  mataKuliahId,
  daftar,
  cplMk,
  cplKurikulum,
}: {
  mataKuliahId: string;
  daftar: CpmkTampil[];
  /** CPL yang dibebankan pada mata kuliah ini — pilihan sah bagi CPMK. */
  cplMk: CplPilihan[];
  /** Seluruh CPL kurikulum — pilihan bagi matriks CPL×MK. */
  cplKurikulum: CplPilihan[];
}) {
  const { menunggu, jalankan } = useAksiKurikulum();
  const { k, isi } = useBahasa();
  const [menyunting, setMenyunting] = useState<string | null>(null);
  const [menambah, setMenambah] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <p className="label-teknis text-muted-foreground/80">
            {k.kurikulum.sunting.cplDibebankan}
          </p>
        </CardHeader>
        <CardContent>
          {/*
            `key` dari isi pemetaan, bukan dari id: pilihan ditahan di state,
            jadi ia harus dipasang ulang bila data server berubah.
          */}
          <PemetaanCpl
            key={cplMk.map((c) => c.id).join(",")}
            semua={cplKurikulum}
            terpilih={cplMk.map((c) => c.id)}
            kosong={k.kurikulum.sunting.tanpaCplKurikulum}
            menunggu={menunggu}
            onSimpan={(dipilih) => jalankan(() => setelCplMataKuliah(mataKuliahId, dipilih))}
          />
        </CardContent>
      </Card>

      {daftar.map((c, i) => (
        <Card key={c.id}>
          <CardHeader>
            {menyunting === c.id ? (
              <FormulirCpmk
                awal={c}
                menunggu={menunggu}
                onBatal={() => setMenyunting(null)}
                onSimpan={(masukan) =>
                  jalankan(() => perbaruiCpmk(c.id, masukan), () => setMenyunting(null))
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge>{c.kode}</Badge>
                    {c.levelBloom ? (
                      <Badge variant="outline" className="text-[10px]">
                        {c.levelBloom}
                      </Badge>
                    ) : null}
                    {c.sumber === "AI" ? (
                      <Badge variant="outline" className="text-[10px]">
                        AI
                      </Badge>
                    ) : null}
                    {c.pensiun ? (
                      <Badge variant="outline" className="text-[10px]">
                        {k.kurikulum.mk.lencanaPensiun}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex gap-0.5">
                    <TombolIkon
                      size="icon-xs"
                      petunjuk={isi(k.kurikulum.sunting.naik, { kode: c.kode })}
                      petunjukMati={k.kurikulum.sunting.sudahTeratas}
                      disabled={menunggu || i === 0}
                      onClick={() => jalankan(() => geserCpmk(c.id, "naik"))}
                    >
                      <ChevronUp />
                    </TombolIkon>
                    <TombolIkon
                      size="icon-xs"
                      petunjuk={isi(k.kurikulum.sunting.turun, { kode: c.kode })}
                      petunjukMati={k.kurikulum.sunting.sudahTerbawah}
                      disabled={menunggu || i === daftar.length - 1}
                      onClick={() => jalankan(() => geserCpmk(c.id, "turun"))}
                    >
                      <ChevronDown />
                    </TombolIkon>
                    <TombolIkon
                      size="icon-xs"
                      petunjuk={isi(k.kurikulum.sunting.suntingCpmk, { kode: c.kode })}
                      disabled={menunggu}
                      onClick={() => setMenyunting(c.id)}
                    >
                      <Pencil />
                    </TombolIkon>
                    <TombolIkon
                      size="icon-xs"
                      petunjuk={isi(k.kurikulum.sunting.hapusCpmk, { kode: c.kode })}
                      disabled={menunggu}
                      onClick={() => {
                        if (
                          !confirm(isi(k.kurikulum.sunting.konfirmasiHapusCpmk, { kode: c.kode }))
                        ) {
                          return;
                        }
                        jalankan(() => hapusCpmk(c.id));
                      }}
                    >
                      <Trash2 />
                    </TombolIkon>
                  </div>
                </div>

                <p className="mt-2 text-sm">{c.rumusan}</p>

                <div className="mt-3 border-t pt-3">
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {k.kurikulum.sunting.cplDijabarkan}
                  </p>
                  <PemetaanCpl
                    key={c.cplId.join(",")}
                    semua={cplMk}
                    terpilih={c.cplId}
                    kosong={k.kurikulum.sunting.bebankanCplDulu}
                    menunggu={menunggu}
                    onSimpan={(dipilih) => jalankan(() => setelCplCpmk(c.id, dipilih))}
                  />
                </div>
              </>
            )}
          </CardHeader>

          <CardContent>
            <DaftarSubCpmk cpmk={c} menunggu={menunggu} jalankan={jalankan} />
          </CardContent>
        </Card>
      ))}

      {daftar.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {k.kurikulum.mk.cpmkKosong}
          </CardContent>
        </Card>
      ) : null}

      {menambah ? (
        <Card className="border-cahaya/40">
          <CardContent className="pt-6">
            <FormulirCpmk
              baru
              menunggu={menunggu}
              onBatal={() => setMenambah(false)}
              onSimpan={(masukan, reset) =>
                jalankan(() => tambahCpmk(mataKuliahId, masukan), reset)
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setMenambah(true)}>
          <Plus />
          {k.kurikulum.sunting.tambahCpmk}
        </Button>
      )}
    </div>
  );
}

function DaftarSubCpmk({
  cpmk,
  menunggu,
  jalankan,
}: {
  cpmk: CpmkTampil;
  menunggu: boolean;
  jalankan: ReturnType<typeof useAksiKurikulum>["jalankan"];
}) {
  const { k, isi } = useBahasa();
  const [menyunting, setMenyunting] = useState<string | null>(null);
  const [menambah, setMenambah] = useState(false);

  return (
    <div className="space-y-3">
      {cpmk.subCpmk.length === 0 ? (
        <p className="text-sm text-destructive">{k.kurikulum.mk.subKosong}</p>
      ) : null}

      {cpmk.subCpmk.map((s, i) =>
        menyunting === s.id ? (
          <div key={s.id} className="rounded-lg border border-cahaya/40 p-3">
            <FormulirSubCpmk
              awal={s}
              menunggu={menunggu}
              onBatal={() => setMenyunting(null)}
              onSimpan={(masukan) =>
                jalankan(() => perbaruiSubCpmk(s.id, masukan), () => setMenyunting(null))
              }
            />
          </div>
        ) : (
          <div key={s.id} className="flex gap-3 border-b pb-3 text-sm last:border-0 last:pb-0">
            <div className="flex shrink-0 flex-col items-start gap-1">
              <Badge variant="outline" className="font-mono text-[10px]">
                {s.kode}
              </Badge>
              {s.levelBloom ? (
                <span className="text-[10px] text-muted-foreground">{s.levelBloom}</span>
              ) : null}
              {s.pensiun ? (
                <Badge variant="outline" className="text-[10px]">
                  {k.kurikulum.mk.lencanaPensiun}
                </Badge>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="pt-0.5">{s.rumusan}</p>
              {s.kko || s.mingguDisarankan.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.kko ? isi(k.kurikulum.sunting.kkoRingkas, { kko: s.kko }) : null}
                  {s.kko && s.mingguDisarankan.length > 0 ? " · " : null}
                  {s.mingguDisarankan.length > 0
                    ? isi(k.kurikulum.sunting.mingguRingkas, {
                        minggu: s.mingguDisarankan.join(", "),
                      })
                    : null}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 gap-0.5">
              <TombolIkon
                size="icon-xs"
                petunjuk={isi(k.kurikulum.sunting.naik, { kode: s.kode })}
                petunjukMati={k.kurikulum.sunting.sudahTeratas}
                disabled={menunggu || i === 0}
                onClick={() => jalankan(() => geserSubCpmk(s.id, "naik"))}
              >
                <ChevronUp />
              </TombolIkon>
              <TombolIkon
                size="icon-xs"
                petunjuk={isi(k.kurikulum.sunting.turun, { kode: s.kode })}
                petunjukMati={k.kurikulum.sunting.sudahTerbawah}
                disabled={menunggu || i === cpmk.subCpmk.length - 1}
                onClick={() => jalankan(() => geserSubCpmk(s.id, "turun"))}
              >
                <ChevronDown />
              </TombolIkon>
              <TombolIkon
                size="icon-xs"
                petunjuk={isi(k.kurikulum.sunting.suntingSub, { kode: s.kode })}
                disabled={menunggu}
                onClick={() => setMenyunting(s.id)}
              >
                <Pencil />
              </TombolIkon>
              <TombolIkon
                size="icon-xs"
                petunjuk={isi(k.kurikulum.sunting.hapusSub, { kode: s.kode })}
                disabled={menunggu}
                onClick={() => {
                  if (!confirm(isi(k.kurikulum.sunting.konfirmasiHapusSub, { kode: s.kode }))) {
                    return;
                  }
                  jalankan(() => hapusSubCpmk(s.id));
                }}
              >
                <Trash2 />
              </TombolIkon>
            </div>
          </div>
        ),
      )}

      {menambah ? (
        <div className="rounded-lg border border-cahaya/40 p-3">
          <FormulirSubCpmk
            baru
            menunggu={menunggu}
            onBatal={() => setMenambah(false)}
            onSimpan={(masukan, reset) => jalankan(() => tambahSubCpmk(cpmk.id, masukan), reset)}
          />
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setMenambah(true)}>
          <Plus />
          {k.kurikulum.sunting.tambahSub}
        </Button>
      )}
    </div>
  );
}

/**
 * Pemetaan sebagai deretan tombol-jungkit, bukan Select bertingkat.
 *
 * Perubahan ditahan sampai "Simpan pemetaan" ditekan supaya mencentang empat
 * CPL tidak berarti empat kali tulis. Pola yang sama dipakai `PemetaanCpl`
 * pada penyunting profil lulusan.
 */
function PemetaanCpl({
  semua,
  terpilih,
  kosong,
  menunggu,
  onSimpan,
}: {
  semua: CplPilihan[];
  terpilih: string[];
  kosong: string;
  menunggu: boolean;
  onSimpan: (cplId: string[]) => void;
}) {
  const { k } = useBahasa();
  const [dipilih, setDipilih] = useState<string[]>(terpilih);

  const berubah =
    dipilih.length !== terpilih.length || dipilih.some((id) => !terpilih.includes(id));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {semua.map((c) => {
          const aktif = dipilih.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={aktif}
              title={c.deskripsi}
              disabled={menunggu}
              onClick={() =>
                setDipilih((s) =>
                  s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id],
                )
              }
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-xs transition-colors duration-200 ease-presisi",
                "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                aktif
                  ? "border-cahaya/45 bg-cahaya/12 text-foreground"
                  : "border-border text-muted-foreground hover:border-cahaya/30 hover:text-foreground",
              )}
            >
              {c.kode}
            </button>
          );
        })}
        {semua.length === 0 ? (
          <span className="text-sm text-muted-foreground">{kosong}</span>
        ) : null}
      </div>

      {berubah ? (
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" disabled={menunggu} onClick={() => onSimpan(dipilih)}>
            <Check />
            {k.kurikulum.profil.simpanPemetaan}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={menunggu}
            onClick={() => setDipilih(terpilih)}
          >
            {k.umum.batal}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FormulirCpmk({
  awal,
  baru = false,
  menunggu,
  onSimpan,
  onBatal,
}: {
  awal?: CpmkTampil;
  baru?: boolean;
  menunggu: boolean;
  onSimpan: (masukan: MasukanCpmk, reset: () => void) => void;
  onBatal?: () => void;
}) {
  const { k } = useBahasa();
  const idForm = baru ? "form-cpmk-baru" : `form-cpmk-${awal?.id}`;

  return (
    <form
      id={idForm}
      className="space-y-3"
      action={(fd) => {
        const level = String(fd.get("levelBloom") ?? "");
        onSimpan(
          {
            kode: String(fd.get("kode") ?? ""),
            rumusan: String(fd.get("rumusan") ?? ""),
            levelBloom: level === "" ? null : level,
          } as MasukanCpmk,
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
            placeholder={k.kurikulum.sunting.contohKodeCpmk}
            className="w-36 font-mono"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idForm}-level`}>{k.kurikulum.sunting.levelBloom}</Label>
          <Pilihan
            id={`${idForm}-level`}
            nama="levelBloom"
            nilai={awal?.levelBloom ?? ""}
            className="w-28"
          >
            <option value="">{k.kurikulum.sunting.tanpaLevel}</option>
            {LEVEL.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Pilihan>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idForm}-rumusan`}>{k.kurikulum.sunting.rumusanCpmk}</Label>
        <AreaTeks
          id={`${idForm}-rumusan`}
          nama="rumusan"
          nilai={awal?.rumusan ?? ""}
          placeholder={k.kurikulum.sunting.contohRumusanCpmk}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={menunggu}>
          {baru ? <Plus /> : <Check />}
          {baru ? k.kurikulum.sunting.tambahCpmk : k.umum.simpan}
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

function FormulirSubCpmk({
  awal,
  baru = false,
  menunggu,
  onSimpan,
  onBatal,
}: {
  awal?: SubCpmkTampil;
  baru?: boolean;
  menunggu: boolean;
  onSimpan: (masukan: MasukanSubCpmk, reset: () => void) => void;
  onBatal?: () => void;
}) {
  const { k } = useBahasa();
  const idForm = baru ? "form-sub-baru" : `form-sub-${awal?.id}`;

  return (
    <form
      id={idForm}
      className="space-y-3"
      action={(fd) => {
        const level = String(fd.get("levelBloom") ?? "");
        const kko = String(fd.get("kko") ?? "").trim();
        onSimpan(
          {
            kode: String(fd.get("kode") ?? ""),
            rumusan: String(fd.get("rumusan") ?? ""),
            levelBloom: level === "" ? null : level,
            kko: kko === "" ? null : kko,
            // "3, 5, 6" → [3, 5, 6]. Yang bukan angka dibuang di sini; sisanya
            // dirapikan lagi oleh skema di server.
            mingguDisarankan: String(fd.get("minggu") ?? "")
              .split(/[,\s]+/)
              .map((x) => Number(x))
              .filter((n) => Number.isInteger(n) && n > 0),
          } as MasukanSubCpmk,
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
            placeholder={k.kurikulum.sunting.contohKodeSub}
            className="w-40 font-mono"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idForm}-level`}>{k.kurikulum.sunting.levelBloom}</Label>
          <Pilihan
            id={`${idForm}-level`}
            nama="levelBloom"
            nilai={awal?.levelBloom ?? ""}
            className="w-28"
          >
            <option value="">{k.kurikulum.sunting.tanpaLevel}</option>
            {LEVEL.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Pilihan>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idForm}-kko`}>{k.kurikulum.sunting.kko}</Label>
          <Input
            id={`${idForm}-kko`}
            name="kko"
            defaultValue={awal?.kko ?? ""}
            placeholder={k.kurikulum.sunting.contohKko}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idForm}-minggu`}>{k.kurikulum.sunting.mingguDisarankan}</Label>
          <Input
            id={`${idForm}-minggu`}
            name="minggu"
            defaultValue={awal?.mingguDisarankan.join(", ") ?? ""}
            placeholder="3, 4"
            className="w-32 tabular-nums"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idForm}-rumusan`}>{k.kurikulum.sunting.rumusanSub}</Label>
        <AreaTeks
          id={`${idForm}-rumusan`}
          nama="rumusan"
          nilai={awal?.rumusan ?? ""}
          placeholder={k.kurikulum.sunting.contohRumusanSub}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={menunggu}>
          {baru ? <Plus /> : <Check />}
          {baru ? k.kurikulum.sunting.tambahSub : k.umum.simpan}
        </Button>
        {onBatal ? (
          <Button type="button" size="sm" variant="ghost" disabled={menunggu} onClick={onBatal}>
            <X />
            {k.umum.batal}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
