"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { TombolIkon } from "@/components/tombol-ikon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMenit } from "@/domain/beban-belajar/kalkulator";
import type { Pagu } from "@/domain/beban-belajar/tipe";
import { simpanPertemuan, type IsiPertemuan } from "../../../aksi";
import {
  DaftarDwibahasa,
  DaftarPasangan,
  Medan,
  SakelarBahasa,
  type ModeBahasa,
} from "@/components/dwibahasa";

type Kategori = "TM" | "PT" | "BM";

interface Props {
  pertemuanId: string;
  /**
   * Cap `diubahPada` baris ini saat halaman digambar. Dikirim kembali apa
   * adanya saat menyimpan: server menolak bila baris sudah berubah, sehingga
   * tulisan rekan sepengampu tidak tertimpa diam-diam.
   */
  capVersi: string;
  rpkpsId: string;
  minggu: number;
  pagu: Pagu;
  toleransiPersen: number;
  subCpmkTersedia: { id: string; kode: string; rumusan: string }[];
  komponenTersedia: { id: string; nama: string; bobot: number }[];
  pustakaTersedia: { id: string; nomor: number; jenis: string; teks: string }[];
  awal: IsiPertemuan;
}

export function EditorPertemuan(props: Props) {
  const { pagu, toleransiPersen } = props;
  const { k, isi } = useBahasa();
  const [d, setD] = useState<IsiPertemuan>(props.awal);
  const [mode, setMode] = useState<ModeBahasa>("id");
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const total = useMemo(() => {
    const per = (k: Kategori) =>
      d.aktivitas.filter((a) => a.kategori === k).reduce((s, a) => s + (Number(a.menit) || 0), 0);
    const tm = per("TM");
    const pt = per("PT");
    const bm = per("BM");
    return { tm, pt, bm, semua: tm + pt + bm };
  }, [d.aktivitas]);

  const selisih = total.semua - pagu.total;
  const persen = pagu.total > 0 ? (selisih / pagu.total) * 100 : 0;
  const pas = Math.abs(persen) <= toleransiPersen;

  function ubah<K extends keyof IsiPertemuan>(kunci: K, nilai: IsiPertemuan[K]) {
    setD((s) => ({ ...s, [kunci]: nilai }));
  }

  function simpan() {
    mulai(async () => {
      const hasil = await simpanPertemuan(
        props.pertemuanId,
        {
          ...d,
          aktivitas: d.aktivitas.map((a) => ({ ...a, menit: Number(a.menit) || 0 })),
          bobot: Number(d.bobot) || 0,
          // Disaring BERPASANGAN: membuang baris Indonesia kosong tanpa
          // membuang pasangan Inggrisnya akan menggeser seluruh daftar, dan
          // subtopik ketiga berbahasa Inggris berakhir menjelaskan subtopik
          // keempat berbahasa Indonesia.
          ...saringBerpasangan(d.subtopik, d.subtopikEn),
          indikator: d.indikator.filter((x) => x.teks.trim() !== ""),
        },
        props.capVersi,
      );
      if (hasil.ok) {
        toast.success(hasil.pesan);
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        <SakelarBahasa mode={mode} ubah={setMode} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.rpkps.mingguEditor.topikJudul}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Medan
              mode={mode}
              id="topik"
              label={k.rpkps.mingguEditor.topik}
              nilai={d.topik ?? ""}
              nilaiEn={d.topikEn ?? ""}
              ubah={(v) => ubah("topik", v || null)}
              ubahEn={(v) => ubah("topikEn", v || null)}
              petunjuk={k.rpkps.mingguEditor.contohTopik}
            />

            <DaftarDwibahasa
              mode={mode}
              label={k.rpkps.mingguEditor.subtopik}
              nilai={d.subtopik}
              nilaiEn={d.subtopikEn}
              ubah={(v) => ubah("subtopik", v)}
              ubahEn={(v) => ubah("subtopikEn", v)}
              petunjuk={k.rpkps.mingguEditor.contohSubtopik}
            />

            <div className="space-y-2">
              <Label>{k.rpkps.mingguEditor.subDibahas}</Label>
              <div className="space-y-1.5">
                {props.subCpmkTersedia.map((s) => {
                  const terpilih = d.subCpmkId.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={terpilih}
                        onChange={(e) =>
                          ubah(
                            "subCpmkId",
                            e.target.checked
                              ? [...d.subCpmkId, s.id]
                              : d.subCpmkId.filter((x) => x !== s.id),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <Badge variant="outline" className="mr-1.5 font-mono text-[10px]">
                          {s.kode}
                        </Badge>
                        {s.rumusan}
                      </span>
                    </label>
                  );
                })}
                {props.subCpmkTersedia.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {k.rpkps.mingguEditor.tanpaSub}
                  </p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.rpkps.mingguEditor.metodeJudul}</CardTitle>
            <CardDescription>{k.rpkps.mingguEditor.metodeKeterangan}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Medan
              mode={mode}
              id="metodeNarasi"
              label={k.rpkps.mingguEditor.metodePembelajaran}
              baris={4}
              nilai={d.metodeNarasi ?? ""}
              nilaiEn={d.metodeNarasiEn ?? ""}
              ubah={(v) => ubah("metodeNarasi", v || null)}
              ubahEn={(v) => ubah("metodeNarasiEn", v || null)}
              petunjuk={k.rpkps.mingguEditor.contohMetode}
            />
            <Medan
              mode={mode}
              id="aktivitasDosen"
              label={k.rpkps.mingguEditor.aktivitasDosen}
              baris={3}
              nilai={d.aktivitasDosen ?? ""}
              nilaiEn={d.aktivitasDosenEn ?? ""}
              ubah={(v) => ubah("aktivitasDosen", v || null)}
              ubahEn={(v) => ubah("aktivitasDosenEn", v || null)}
            />
            <Medan
              mode={mode}
              id="aktivitasMahasiswa"
              label={k.rpkps.mingguEditor.aktivitasMahasiswa}
              baris={3}
              nilai={d.aktivitasMahasiswa ?? ""}
              nilaiEn={d.aktivitasMahasiswaEn ?? ""}
              ubah={(v) => ubah("aktivitasMahasiswa", v || null)}
              ubahEn={(v) => ubah("aktivitasMahasiswaEn", v || null)}
            />
            <Medan
              mode={mode}
              id="tugasTerstruktur"
              label={k.rpkps.mingguEditor.tugasTerstruktur}
              baris={3}
              nilai={d.tugasTerstruktur ?? ""}
              nilaiEn={d.tugasTerstrukturEn ?? ""}
              ubah={(v) => ubah("tugasTerstruktur", v || null)}
              ubahEn={(v) => ubah("tugasTerstrukturEn", v || null)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.rpkps.mingguEditor.penilaianJudul}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1.5">
                <Medan
                  mode={mode}
                  id="penilaianJenis"
                  label={k.rpkps.mingguEditor.jenisPenilaian}
                  nilai={d.penilaianJenis ?? ""}
                  nilaiEn={d.penilaianJenisEn ?? ""}
                  ubah={(v) => ubah("penilaianJenis", v || null)}
                  ubahEn={(v) => ubah("penilaianJenisEn", v || null)}
                  petunjuk={k.rpkps.mingguEditor.contohJenisPenilaian}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bobot">{k.rpkps.mingguEditor.bobot}</Label>
                <Input
                  id="bobot"
                  type="number"
                  step="0.01"
                  value={d.bobot}
                  onChange={(e) => ubah("bobot", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="komponenNilaiId">{k.rpkps.mingguEditor.masukKomponen}</Label>
              <Select
                value={d.komponenNilaiId ?? "__kosong__"}
                onValueChange={(v) =>
                  ubah("komponenNilaiId", !v || v === "__kosong__" ? null : v)
                }
              >
                <SelectTrigger id="komponenNilaiId">
                  <SelectValue placeholder={k.rpkps.mingguEditor.belumDitentukan} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__kosong__">{k.rpkps.mingguEditor.pilihanKosong}</SelectItem>
                  {props.komponenTersedia.map((komp) => (
                    <SelectItem key={komp.id} value={komp.id}>
                      {isi(k.rpkps.mingguEditor.pilihanKomponen, {
                        nama: komp.nama,
                        bobot: komp.bobot,
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {k.rpkps.mingguEditor.komponenPetunjuk}
              </p>
            </div>

            <Medan
              mode={mode}
              id="penilaianSistem"
              label={k.rpkps.mingguEditor.sistemPenilaian}
              baris={2}
              nilai={d.penilaianSistem ?? ""}
              nilaiEn={d.penilaianSistemEn ?? ""}
              ubah={(v) => ubah("penilaianSistem", v || null)}
              ubahEn={(v) => ubah("penilaianSistemEn", v || null)}
              petunjuk={k.rpkps.mingguEditor.contohSistem}
            />

            <DaftarPasangan
              mode={mode}
              label={k.rpkps.mingguEditor.indikator}
              nilai={d.indikator}
              ubah={(v) => ubah("indikator", v)}
              petunjuk={k.rpkps.mingguEditor.contohIndikator}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.rpkps.mingguEditor.referensiJudul}</CardTitle>
          </CardHeader>
          <CardContent>
            {props.pustakaTersedia.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {k.rpkps.mingguEditor.tanpaPustaka}
              </p>
            ) : (
              <div className="space-y-1.5">
                {props.pustakaTersedia.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={d.pustakaId.includes(p.id)}
                      onChange={(e) =>
                        ubah(
                          "pustakaId",
                          e.target.checked
                            ? [...d.pustakaId, p.id]
                            : d.pustakaId.filter((x) => x !== p.id),
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="text-muted-foreground">[{p.nomor}]</span> {p.teks}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.rpkps.mingguEditor.neracaJudul}</CardTitle>
            <CardDescription>
              {isi(k.rpkps.mingguEditor.neracaMinggu, { nomor: props.minggu })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">
                  {k.rpkps.mingguEditor.terpakai}
                </span>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    pas ? "text-success-foreground" : "text-destructive"
                  }`}
                >
                  {formatMenit(total.semua)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
                <span>{k.rpkps.mingguEditor.pagu}</span>
                <span className="tabular-nums">{formatMenit(pagu.total)}</span>
              </div>
              {pagu.total > 0 ? (
                <p
                  className={`mt-2 text-xs ${pas ? "text-muted-foreground" : "font-medium text-destructive"}`}
                >
                  {selisih === 0
                    ? k.rpkps.mingguEditor.pasDenganPagu
                    : isi(k.rpkps.mingguEditor.selisih, {
                        arah:
                          selisih > 0
                            ? k.rpkps.mingguEditor.lebih
                            : k.rpkps.mingguEditor.kurang,
                        menit: formatMenit(Math.abs(selisih)),
                        persen: Math.abs(Math.round(persen * 10) / 10),
                      })}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5 text-xs">
              {(["TM", "PT", "BM"] as Kategori[]).map((kat) => {
                const nilai = kat === "TM" ? total.tm : kat === "PT" ? total.pt : total.bm;
                const paguK = kat === "TM" ? pagu.tm : kat === "PT" ? pagu.pt : pagu.bm;
                const lebih = nilai > paguK;
                return (
                  <div key={kat} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {k.enum.kategoriWaktu[kat]}
                    </span>
                    <span className={`tabular-nums ${lebih ? "font-medium text-destructive" : ""}`}>
                      {nilai}′ / {paguK}′
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs">{k.rpkps.mingguEditor.rincianAktivitas}</Label>
              {d.aktivitas.map((a, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border p-2">
                  <Input
                    value={a.nama}
                    placeholder={k.rpkps.mingguEditor.namaAktivitas}
                    className="h-7 text-xs"
                    onChange={(e) =>
                      ubah(
                        "aktivitas",
                        d.aktivitas.map((x, j) =>
                          j === i ? { ...x, nama: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={a.kategori}
                      onValueChange={(v) =>
                        ubah(
                          "aktivitas",
                          d.aktivitas.map((x, j) =>
                            j === i ? { ...x, kategori: (v ?? "TM") as Kategori } : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="h-7 w-16 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TM">TM</SelectItem>
                        <SelectItem value="PT">PT</SelectItem>
                        <SelectItem value="BM">BM</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={a.menit}
                      className="h-7 w-16 text-xs"
                      onChange={(e) =>
                        ubah(
                          "aktivitas",
                          d.aktivitas.map((x, j) =>
                            j === i ? { ...x, menit: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    />
                    <span className="text-xs text-muted-foreground">′</span>
                    <TombolIkon
                      size="icon-xs"
                      petunjuk={k.rpkps.mingguEditor.hapusAktivitas}
                      className="ml-auto"
                      onClick={() =>
                        ubah("aktivitas", d.aktivitas.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 />
                    </TombolIkon>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  ubah("aktivitas", [
                    ...d.aktivitas,
                    { nama: "", namaEn: null, kategori: "BM" as Kategori, menit: 0 },
                  ])
                }
              >
                <Plus />
                {k.rpkps.mingguEditor.tambahAktivitas}
              </Button>
            </div>

            <Button className="w-full" disabled={menunggu} onClick={simpan}>
              {menunggu ? k.rpkps.mingguEditor.menyimpan : k.rpkps.mingguEditor.simpan}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Membuang baris yang KEDUA bahasanya kosong, dan hanya baris itu.
 *
 * Menyaring tiap bahasa sendiri-sendiri akan menggeser pasangannya: satu
 * subtopik Indonesia yang dikosongkan membuat seluruh terjemahan di bawahnya
 * naik satu baris, dan tidak ada yang menyadarinya sampai dokumen dicetak.
 */
function saringBerpasangan(
  asal: string[],
  terjemahan: string[],
): { subtopik: string[]; subtopikEn: string[] } {
  const jumlah = Math.max(asal.length, terjemahan.length);
  const subtopik: string[] = [];
  const subtopikEn: string[] = [];
  for (let i = 0; i < jumlah; i++) {
    const a = (asal[i] ?? "").trim();
    const b = (terjemahan[i] ?? "").trim();
    if (a === "" && b === "") continue;
    subtopik.push(a);
    subtopikEn.push(b);
  }
  return { subtopik, subtopikEn };
}
