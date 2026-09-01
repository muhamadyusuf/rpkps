"use client";

import { Fragment, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Tautan } from "@/components/tautan";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AreaTeks, Pilihan } from "@/components/ui/pilihan";
import { TombolIkon } from "@/components/tombol-ikon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAksiKurikulum } from "../aksi-klien";
import {
  hapusMataKuliah,
  perbaruiMataKuliah,
  tambahMataKuliah,
  type MasukanMk,
} from "../aksi-mk";

/**
 * Penyunting mata kuliah pada halaman kurikulum.
 *
 * Tabelnya tetap tabel — struktur kurikulum dibaca dengan membandingkan baris
 * (semester, sks, CPL), dan itu hilang bila tiap mata kuliah jadi kartu. Borang
 * sunting membuka DI BAWAH barisnya, bukan menggantikannya, supaya pembanding
 * di sekitarnya tetap terlihat saat mengubah angka sks.
 */

export type MkTampil = {
  id: string;
  kode: string;
  nama: string;
  deskripsi: string | null;
  semester: number;
  status: string;
  sksTeori: number;
  sksPraktik: number;
  bentukTeori: string;
  bentukPraktik: string;
  kodeCpl: string[];
  jumlahCpmk: number;
};

const BENTUK = [
  "KULIAH",
  "RESPONSI",
  "TUTORIAL",
  "SEMINAR",
  "PRAKTIKUM",
  "PRAKTIK_STUDIO",
  "PRAKTIK_BENGKEL",
  "PRAKTIK_LAPANGAN",
  "PENELITIAN",
  "PKM",
  "KKN",
] as const;

const STATUS = ["WAJIB", "PILIHAN", "WAJIB_UMUM"] as const;

export function PengelolaMataKuliah({
  kurikulumId,
  daftar,
}: {
  kurikulumId: string;
  daftar: MkTampil[];
}) {
  const { menunggu, jalankan } = useAksiKurikulum();
  const { k, isi } = useBahasa();
  const [menyunting, setMenyunting] = useState<string | null>(null);
  const [menambah, setMenambah] = useState(false);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{k.kurikulum.detail.kolomKode}</TableHead>
              <TableHead>{k.kurikulum.detail.kolomNama}</TableHead>
              <TableHead className="text-center">{k.kurikulum.detail.kolomSmt}</TableHead>
              <TableHead className="text-center">{k.kurikulum.detail.kolomSks}</TableHead>
              <TableHead>{k.kurikulum.detail.kolomCpl}</TableHead>
              <TableHead className="text-right">{k.kurikulum.detail.kolomCpmk}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((mk) => (
              <Fragment key={mk.id}>
                <TableRow>
                  <TableCell>
                    <Tautan
                      href={`/kurikulum/${kurikulumId}/mk/${mk.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {mk.kode}
                    </Tautan>
                  </TableCell>
                  <TableCell className="text-sm">
                    {mk.nama}
                    {mk.status !== "WAJIB" ? (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {k.enum.statusMataKuliah[mk.status as keyof typeof k.enum.statusMataKuliah]}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{mk.semester}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {mk.sksTeori + mk.sksPraktik}
                    <span className="text-muted-foreground">
                      {" "}
                      ({mk.sksTeori}+{mk.sksPraktik})
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {mk.kodeCpl.map((kode) => (
                        <Badge key={kode} variant="outline" className="text-[10px]">
                          {kode}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {mk.jumlahCpmk}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      <TombolIkon
                        size="icon-xs"
                        petunjuk={isi(k.kurikulum.sunting.suntingMk, { kode: mk.kode })}
                        disabled={menunggu}
                        onClick={() => setMenyunting(menyunting === mk.id ? null : mk.id)}
                      >
                        <Pencil />
                      </TombolIkon>
                      <TombolIkon
                        size="icon-xs"
                        petunjuk={isi(k.kurikulum.sunting.hapusMk, { kode: mk.kode })}
                        disabled={menunggu}
                        onClick={() => {
                          if (
                            !confirm(
                              isi(k.kurikulum.sunting.konfirmasiHapusMk, { kode: mk.kode }),
                            )
                          ) {
                            return;
                          }
                          jalankan(() => hapusMataKuliah(mk.id));
                        }}
                      >
                        <Trash2 />
                      </TombolIkon>
                    </div>
                  </TableCell>
                </TableRow>

                {menyunting === mk.id ? (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-muted/30 p-4">
                      <FormulirMk
                        awal={mk}
                        menunggu={menunggu}
                        onBatal={() => setMenyunting(null)}
                        onSimpan={(masukan) =>
                          jalankan(
                            () => perbaruiMataKuliah(mk.id, masukan),
                            () => setMenyunting(null),
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}

            {daftar.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {k.kurikulum.detail.mkKosong}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {menambah ? (
        <div className="rounded-lg border border-cahaya/40 p-4">
          <FormulirMk
            baru
            menunggu={menunggu}
            onBatal={() => setMenambah(false)}
            onSimpan={(masukan, reset) =>
              jalankan(() => tambahMataKuliah(kurikulumId, masukan), reset)
            }
          />
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setMenambah(true)}>
          <Plus />
          {k.kurikulum.sunting.tambahMk}
        </Button>
      )}
    </div>
  );
}

function FormulirMk({
  awal,
  baru = false,
  menunggu,
  onSimpan,
  onBatal,
}: {
  awal?: MkTampil;
  baru?: boolean;
  menunggu: boolean;
  onSimpan: (masukan: MasukanMk, reset: () => void) => void;
  onBatal?: () => void;
}) {
  const { k } = useBahasa();
  const idForm = baru ? "form-mk-baru" : `form-mk-${awal?.id}`;

  return (
    <form
      id={idForm}
      className="space-y-3"
      action={(fd) => {
        const deskripsi = String(fd.get("deskripsi") ?? "").trim();
        onSimpan(
          {
            kode: String(fd.get("kode") ?? ""),
            nama: String(fd.get("nama") ?? ""),
            deskripsi: deskripsi === "" ? null : deskripsi,
            semester: Number(fd.get("semester") ?? 1),
            status: String(fd.get("status") ?? "WAJIB"),
            sksTeori: Number(fd.get("sksTeori") ?? 0),
            sksPraktik: Number(fd.get("sksPraktik") ?? 0),
            bentukTeori: String(fd.get("bentukTeori") ?? "KULIAH"),
            bentukPraktik: String(fd.get("bentukPraktik") ?? "PRAKTIKUM"),
          } as MasukanMk,
          () => {
            const form = document.getElementById(idForm) as HTMLFormElement | null;
            form?.reset();
          },
        );
      }}
    >
      <div className="flex flex-wrap items-end gap-2">
        <Ruas label={k.kurikulum.sunting.kode} htmlFor={`${idForm}-kode`}>
          <Input
            id={`${idForm}-kode`}
            name="kode"
            defaultValue={awal?.kode ?? ""}
            placeholder={k.kurikulum.sunting.contohKodeMk}
            className="w-28 font-mono"
            required
          />
        </Ruas>

        <Ruas label={k.kurikulum.detail.kolomNama} htmlFor={`${idForm}-nama`} lebar>
          <Input
            id={`${idForm}-nama`}
            name="nama"
            defaultValue={awal?.nama ?? ""}
            placeholder={k.kurikulum.sunting.contohNamaMk}
            required
          />
        </Ruas>

        <Ruas label={k.kurikulum.detail.kolomSmt} htmlFor={`${idForm}-semester`}>
          <Input
            id={`${idForm}-semester`}
            name="semester"
            type="number"
            min={1}
            max={14}
            defaultValue={awal?.semester ?? 1}
            className="w-20 tabular-nums"
            required
          />
        </Ruas>

        <Ruas label={k.kurikulum.sunting.status} htmlFor={`${idForm}-status`}>
          <Pilihan
            id={`${idForm}-status`}
            nama="status"
            nilai={awal?.status ?? "WAJIB"}
            className="w-44"
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {k.enum.statusMataKuliah[s]}
              </option>
            ))}
          </Pilihan>
        </Ruas>
      </div>

      {/*
        sks dan bentuk dipasang berdampingan, teori di atas praktik: pasangan
        itulah yang menentukan pagu waktu per minggu (docs/03 §2.2), dan
        memilih bentuk tanpa melihat sks-nya sendiri membuat angka pagu di
        halaman mata kuliah terasa datang entah dari mana.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <Ruas label={k.kurikulum.sunting.sksTeori} htmlFor={`${idForm}-sksTeori`}>
            <Input
              id={`${idForm}-sksTeori`}
              name="sksTeori"
              type="number"
              min={0}
              max={12}
              defaultValue={awal?.sksTeori ?? 0}
              className="w-20 tabular-nums"
              required
            />
          </Ruas>
          <Ruas label={k.kurikulum.sunting.bentukTeori} htmlFor={`${idForm}-bentukTeori`} lebar>
            <Pilihan
              id={`${idForm}-bentukTeori`}
              nama="bentukTeori"
              nilai={awal?.bentukTeori ?? "KULIAH"}
            >
              {BENTUK.map((b) => (
                <option key={b} value={b}>
                  {k.enum.bentukPembelajaran[b]}
                </option>
              ))}
            </Pilihan>
          </Ruas>
        </div>

        <div className="flex items-end gap-2">
          <Ruas label={k.kurikulum.sunting.sksPraktik} htmlFor={`${idForm}-sksPraktik`}>
            <Input
              id={`${idForm}-sksPraktik`}
              name="sksPraktik"
              type="number"
              min={0}
              max={12}
              defaultValue={awal?.sksPraktik ?? 0}
              className="w-20 tabular-nums"
              required
            />
          </Ruas>
          <Ruas
            label={k.kurikulum.sunting.bentukPraktik}
            htmlFor={`${idForm}-bentukPraktik`}
            lebar
          >
            <Pilihan
              id={`${idForm}-bentukPraktik`}
              nama="bentukPraktik"
              nilai={awal?.bentukPraktik ?? "PRAKTIKUM"}
            >
              {BENTUK.map((b) => (
                <option key={b} value={b}>
                  {k.enum.bentukPembelajaran[b]}
                </option>
              ))}
            </Pilihan>
          </Ruas>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idForm}-deskripsi`}>{k.kurikulum.sunting.deskripsiMk}</Label>
        <AreaTeks
          id={`${idForm}-deskripsi`}
          nama="deskripsi"
          nilai={awal?.deskripsi ?? ""}
          placeholder={k.kurikulum.sunting.contohDeskripsiMk}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={menunggu}>
          {baru ? <Plus /> : <Check />}
          {baru ? k.kurikulum.sunting.tambahMk : k.umum.simpan}
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

function Ruas({
  label,
  htmlFor,
  lebar = false,
  children,
}: {
  label: string;
  htmlFor: string;
  lebar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", lebar && "min-w-44 flex-1")}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
