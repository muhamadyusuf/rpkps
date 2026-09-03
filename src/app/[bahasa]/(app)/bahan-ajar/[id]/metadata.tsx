"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { simpanMetadata, type IsiMetadata } from "./aksi";

/**
 * Keterangan terbitan — satu-satunya bagian buku yang TIDAK boleh datang dari
 * model (docs/16 P5). Skema keluaran AI bahkan tidak punya medannya, jadi
 * borang inilah satu-satunya jalan masuk ISBN, penerbit, dan tahun terbit.
 */
export function FormulirMetadata({
  bukuId,
  awal,
  bolehTulis,
}: {
  bukuId: string;
  awal: IsiMetadata;
  bolehTulis: boolean;
}) {
  const { k } = useBahasa();
  const [nilai, setNilai] = useState<IsiMetadata>(awal);
  const [penulis, setPenulis] = useState(awal.penulis.join("\n"));
  const [menunggu, mulai] = useTransition();

  function ubah<K extends keyof IsiMetadata>(kunci: K, isi: IsiMetadata[K]) {
    setNilai((lama) => ({ ...lama, [kunci]: isi }));
  }

  const teks = (kunci: keyof IsiMetadata) =>
    (nilai[kunci] as string | null) ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.bahanAjar.metadataJudul}</CardTitle>
        <CardDescription>{k.bahanAjar.metadataKeterangan}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="judul">{k.bahanAjar.labelJudul}</Label>
            <Input
              id="judul"
              value={nilai.judul}
              disabled={!bolehTulis}
              onChange={(e) => ubah("judul", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="subjudul">{k.bahanAjar.labelSubjudul}</Label>
            <Input
              id="subjudul"
              value={teks("subjudul")}
              disabled={!bolehTulis}
              onChange={(e) => ubah("subjudul", e.target.value || null)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="penulis">{k.bahanAjar.labelPenulis}</Label>
            <textarea
              id="penulis"
              rows={3}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              value={penulis}
              disabled={!bolehTulis}
              onChange={(e) => setPenulis(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {k.bahanAjar.penulisPetunjuk}
            </p>
          </div>

          <div>
            <Label htmlFor="afiliasi">{k.bahanAjar.labelAfiliasi}</Label>
            <Input
              id="afiliasi"
              value={teks("afiliasi")}
              disabled={!bolehTulis}
              onChange={(e) => ubah("afiliasi", e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor="penerbit">{k.bahanAjar.labelPenerbit}</Label>
            <Input
              id="penerbit"
              value={teks("penerbit")}
              disabled={!bolehTulis}
              onChange={(e) => ubah("penerbit", e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor="kota">{k.bahanAjar.labelKota}</Label>
            <Input
              id="kota"
              value={teks("kotaTerbit")}
              disabled={!bolehTulis}
              onChange={(e) => ubah("kotaTerbit", e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor="tahun">{k.bahanAjar.labelTahun}</Label>
            <Input
              id="tahun"
              inputMode="numeric"
              value={nilai.tahunTerbit ?? ""}
              disabled={!bolehTulis}
              onChange={(e) =>
                ubah("tahunTerbit", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div>
            <Label htmlFor="edisi">{k.bahanAjar.labelEdisi}</Label>
            <Input
              id="edisi"
              value={teks("edisi")}
              disabled={!bolehTulis}
              onChange={(e) => ubah("edisi", e.target.value || null)}
            />
          </div>
          <div>
            <Label htmlFor="isbn">{k.bahanAjar.labelIsbn}</Label>
            <Input
              id="isbn"
              value={teks("isbn")}
              disabled={!bolehTulis}
              onChange={(e) => ubah("isbn", e.target.value || null)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{k.bahanAjar.isbnPetunjuk}</p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="hakCipta">{k.bahanAjar.labelHakCipta}</Label>
            <Input
              id="hakCipta"
              value={teks("hakCipta")}
              disabled={!bolehTulis}
              onChange={(e) => ubah("hakCipta", e.target.value || null)}
            />
          </div>
        </div>

        {bolehTulis ? (
          <Button
            size="sm"
            disabled={menunggu}
            onClick={() =>
              mulai(async () => {
                const hasil = await simpanMetadata(bukuId, {
                  ...nilai,
                  penulis: penulis
                    .split("\n")
                    .map((n) => n.trim())
                    .filter(Boolean),
                });
                if (hasil.ok) toast.success(hasil.pesan);
                else toast.error(hasil.pesan);
              })
            }
          >
            {menunggu ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {menunggu ? k.bahanAjar.menyimpan : k.bahanAjar.simpan}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
