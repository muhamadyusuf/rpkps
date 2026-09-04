"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { putuskanUsulan, suntingBabAi, tinjauNaskahAi } from "./aksi-sunting";

/**
 * Panel usulan penyuntingan — docs/19.
 *
 * # Mengapa tidak ada tombol "terima semua"
 *
 * Ditolak dengan sadar (docs/19 E2). Begitu tombol itu ada, ia yang akan
 * dipakai, dan seluruh tahap ini berubah menjadi penulisan ulang oleh model
 * dengan satu langkah tambahan. Yang membuat tahap ini berharga bukan
 * usulannya, melainkan bahwa dosen MEMBACA naskahnya sambil memutuskan — dan
 * itulah sebabnya menerima usulan boleh dihitung sebagai suntingan manusia.
 *
 * Kutipan dan penggantinya ditampilkan berdampingan, bukan sebagai teks
 * gabungan: yang harus dinilai adalah bedanya.
 */

export type UsulanTampil = {
  id: string;
  babNomor: number | null;
  jenis: "BAHASA" | "ISTILAH" | "PENGULANGAN" | "TUJUAN" | "STRUKTUR";
  kutipan: string | null;
  usul: string;
  alasan: string;
};

export function PanelUsulan({
  bukuId,
  usulan,
  bolehTulis,
  adaKunciAi,
  /** Ada di halaman bab: tombolnya menyunting bab itu saja. */
  nomorBab,
  /** Ada di halaman sampul: tombolnya meninjau seluruh naskah. */
  tinjauSeluruh,
}: {
  bukuId: string;
  usulan: UsulanTampil[];
  bolehTulis: boolean;
  adaKunciAi: boolean;
  nomorBab?: number;
  tinjauSeluruh?: boolean;
}) {
  const { k, isi } = useBahasa();
  const router = useRouter();
  const [sedang, setSedang] = useState<string | null>(null);
  const [menyusun, mulai] = useTransition();

  async function putuskan(id: string, putusan: "DITERIMA" | "DITOLAK") {
    setSedang(id);
    const hasil = await putuskanUsulan(bukuId, { usulanId: id, putusan });
    setSedang(null);
    if (!hasil.ok) {
      toast.error(hasil.pesan);
      // Usulan kedaluwarsa berpindah status; daftarnya harus ikut menyusut.
      router.refresh();
      return;
    }
    toast.success(hasil.pesan);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isi(k.bahanAjar.usulanJudul, { jumlah: usulan.length })}
        </CardTitle>
        <CardDescription>{k.bahanAjar.usulanKeterangan}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {bolehTulis ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={menyusun || !adaKunciAi}
              onClick={() =>
                mulai(async () => {
                  const hasil = tinjauSeluruh
                    ? await tinjauNaskahAi(bukuId)
                    : await suntingBabAi(bukuId, nomorBab!);
                  if (hasil.ok) {
                    toast.success(hasil.pesan);
                    router.refresh();
                  } else toast.error(hasil.pesan);
                })
              }
            >
              {menyusun ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {tinjauSeluruh ? k.bahanAjar.tinjauNaskah : k.bahanAjar.suntingBab}
            </Button>
          </div>
        ) : null}

        {!adaKunciAi && bolehTulis ? (
          <p className="text-xs text-muted-foreground">{k.bahanAjar.tanpaKunci}</p>
        ) : null}

        {usulan.length === 0 ? (
          <p className="text-sm text-muted-foreground">{k.bahanAjar.usulanKosong}</p>
        ) : (
          <ul className="space-y-3">
            {usulan.map((u) => (
              <li key={u.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {k.bahanAjar.jenisUsulan[u.jenis]}
                  </Badge>
                  {u.babNomor !== null ? (
                    <span className="text-xs text-muted-foreground">
                      {isi(k.bahanAjar.babEyebrow, { nomor: u.babNomor })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {k.bahanAjar.seluruhBuku}
                    </span>
                  )}
                </div>

                {/* Kutipan dan penggantinya berdampingan: yang dinilai bedanya. */}
                {u.kutipan ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded border bg-destructive/5 p-2">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">
                        {k.bahanAjar.naskahSekarang}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{u.kutipan}</p>
                    </div>
                    <div className="rounded border bg-success/5 p-2">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground uppercase">
                        {k.bahanAjar.usulanPengganti}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {u.usul || <span className="italic">{k.bahanAjar.usulHapus}</span>}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Tanpa kutipan berarti nasihat: tidak ada yang diganti
                  // otomatis, dan menyetujuinya berarti sudah dibaca.
                  <p className="rounded border bg-muted/40 p-2 text-sm whitespace-pre-wrap">
                    {u.usul}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">{u.alasan}</p>

                {bolehTulis ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={sedang !== null}
                      onClick={() => void putuskan(u.id, "DITERIMA")}
                    >
                      {sedang === u.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      {u.kutipan ? k.bahanAjar.terapkanUsulan : k.bahanAjar.tandaiDibaca}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sedang !== null}
                      onClick={() => void putuskan(u.id, "DITOLAK")}
                    >
                      <X className="size-4" />
                      {k.bahanAjar.tolakUsulan}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
