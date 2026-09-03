"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { simpanBab, susunBabAi, susunSlideAi, type IsiBab } from "../../aksi";

type Latihan = { soal: string; kunci: string | null };

/**
 * Penyunting satu bab.
 *
 * Menulis ulang SELURUH isi bab beserta latihannya dalam satu simpan, jadi ia
 * membawa cap `diubahPada` yang dibacanya saat halaman dibuka. Cap itu ikut ke
 * `where` sebuah `updateMany` di server: dua penyunting pada bab yang sama
 * tidak dapat saling menimpa tanpa gejala.
 */
export function EditorBab({
  bukuId,
  nomor,
  awal,
  cap,
  bolehTulis,
  adaUraian,
}: {
  bukuId: string;
  nomor: number;
  awal: Omit<IsiBab, "cap">;
  cap: string;
  bolehTulis: boolean;
  adaUraian: boolean;
}) {
  const { k } = useBahasa();
  const router = useRouter();

  const [judul, setJudul] = useState(awal.judul);
  const [tujuan, setTujuan] = useState(awal.tujuan.join("\n"));
  const [uraian, setUraian] = useState(awal.uraian ?? "");
  const [studiKasus, setStudiKasus] = useState(awal.studiKasus ?? "");
  const [ringkasan, setRingkasan] = useState(awal.ringkasan ?? "");
  const [latihan, setLatihan] = useState<Latihan[]>(awal.latihan);

  const [menyimpan, mulaiSimpan] = useTransition();
  const [ai, setAi] = useState<"bab" | "slide" | null>(null);

  const kunciTerbuka = !bolehTulis || ai !== null;

  return (
    <div className="space-y-6">
      {bolehTulis ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={ai !== null || menyimpan}
            onClick={async () => {
              setAi("bab");
              const hasil = await susunBabAi(bukuId, nomor);
              setAi(null);
              if (hasil.ok) {
                toast.success(hasil.pesan);
                // Isi bab ditulis server; halaman dimuat ulang agar penyunting
                // memegang cap versi yang baru — bukan cap yang sudah basi.
                router.refresh();
              } else toast.error(hasil.pesan);
            }}
          >
            {ai === "bab" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {k.bahanAjar.susunBabIni}
          </Button>

          <Button
            size="sm"
            variant="outline"
            disabled={ai !== null || menyimpan || !adaUraian}
            onClick={async () => {
              setAi("slide");
              const hasil = await susunSlideAi(bukuId, nomor);
              setAi(null);
              if (hasil.ok) {
                toast.success(hasil.pesan);
                router.refresh();
              } else toast.error(hasil.pesan);
            }}
          >
            {ai === "slide" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {k.bahanAjar.susunSlideIni}
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.bahanAjar.labelJudulBab}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={judul}
            disabled={kunciTerbuka}
            onChange={(e) => setJudul(e.target.value)}
          />

          <div>
            <Label htmlFor="tujuan">{k.bahanAjar.labelTujuan}</Label>
            <Area
              id="tujuan"
              rows={4}
              nilai={tujuan}
              atur={setTujuan}
              nonaktif={kunciTerbuka}
            />
            <p className="mt-1 text-xs text-muted-foreground">{k.bahanAjar.tujuanPetunjuk}</p>
          </div>

          <div>
            <Label htmlFor="uraian">{k.bahanAjar.labelUraian}</Label>
            <Area
              id="uraian"
              rows={20}
              nilai={uraian}
              atur={setUraian}
              nonaktif={kunciTerbuka}
            />
            <p className="mt-1 text-xs text-muted-foreground">{k.bahanAjar.uraianPetunjuk}</p>
          </div>

          <div>
            <Label htmlFor="studi">{k.bahanAjar.labelStudiKasus}</Label>
            <Area
              id="studi"
              rows={6}
              nilai={studiKasus}
              atur={setStudiKasus}
              nonaktif={kunciTerbuka}
            />
          </div>

          <div>
            <Label htmlFor="ringkasan">{k.bahanAjar.labelRingkasan}</Label>
            <Area
              id="ringkasan"
              rows={5}
              nilai={ringkasan}
              atur={setRingkasan}
              nonaktif={kunciTerbuka}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.bahanAjar.labelLatihan}</CardTitle>
          <CardDescription>{k.bahanAjar.kunciPetunjuk}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {latihan.length === 0 ? (
            <p className="text-sm text-muted-foreground">{k.bahanAjar.latihanKosong}</p>
          ) : null}

          {latihan.map((l, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-medium text-muted-foreground">{i + 1}</span>
                {bolehTulis ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={kunciTerbuka}
                    onClick={() => setLatihan((x) => x.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                    {k.bahanAjar.hapusLatihan}
                  </Button>
                ) : null}
              </div>
              <div>
                <Label>{k.bahanAjar.labelSoal}</Label>
                <Area
                  rows={3}
                  nilai={l.soal}
                  nonaktif={kunciTerbuka}
                  atur={(v) =>
                    setLatihan((x) => x.map((y, j) => (j === i ? { ...y, soal: v } : y)))
                  }
                />
              </div>
              <div>
                <Label>{k.bahanAjar.labelKunci}</Label>
                <Area
                  rows={3}
                  nilai={l.kunci ?? ""}
                  nonaktif={kunciTerbuka}
                  atur={(v) =>
                    setLatihan((x) =>
                      x.map((y, j) => (j === i ? { ...y, kunci: v || null } : y)),
                    )
                  }
                />
              </div>
            </div>
          ))}

          {bolehTulis ? (
            <Button
              size="sm"
              variant="outline"
              disabled={kunciTerbuka}
              onClick={() => setLatihan((x) => [...x, { soal: "", kunci: null }])}
            >
              <Plus className="size-4" />
              {k.bahanAjar.tambahLatihan}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {bolehTulis ? (
        <div className="flex justify-end">
          <Button
            disabled={menyimpan || ai !== null}
            onClick={() =>
              mulaiSimpan(async () => {
                const hasil = await simpanBab(bukuId, nomor, {
                  judul,
                  tujuan: tujuan.split("\n").map((t) => t.trim()).filter(Boolean),
                  uraian: uraian.trim() || null,
                  studiKasus: studiKasus.trim() || null,
                  ringkasan: ringkasan.trim() || null,
                  latihan: latihan
                    .map((l) => ({ soal: l.soal.trim(), kunci: l.kunci?.trim() || null }))
                    .filter((l) => l.soal !== ""),
                  cap,
                });
                if (hasil.ok) {
                  toast.success(hasil.pesan);
                  router.refresh();
                } else toast.error(hasil.pesan);
              })
            }
          >
            {menyimpan ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {menyimpan ? k.bahanAjar.menyimpan : k.bahanAjar.simpan}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Textarea bergaya sama dengan Input; tidak ada komponen ui untuknya. */
function Area({
  id,
  rows,
  nilai,
  atur,
  nonaktif,
}: {
  id?: string;
  rows: number;
  nilai: string;
  atur: (v: string) => void;
  nonaktif: boolean;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
      value={nilai}
      disabled={nonaktif}
      onChange={(e) => atur(e.target.value)}
    />
  );
}
