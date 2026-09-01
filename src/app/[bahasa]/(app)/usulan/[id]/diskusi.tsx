"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBahasa } from "@/components/penyedia-bahasa";
import { tanggal } from "@/lib/bahasa/format";
import { AreaTeks } from "@/components/ui/pilihan";
import { tambahCatatan } from "../aksi";

/**
 * Kanal catatan mutu GPM — dan tempat pengusul menjawabnya.
 *
 * GPM sengaja tidak memblokir: ia memberi pertimbangan, Kaprodi tetap pemutus
 * tunggal (doc 04 §8.3). Karena itu catatan hidup sebagai diskusi terbuka,
 * bukan sebagai langkah persetujuan tersendiri.
 */
export function Diskusi({
  usulanId,
  catatan,
}: {
  usulanId: string;
  catatan: {
    id: string;
    isi: string;
    dibuatPada: Date;
    oleh: { id: string; nama: string } | null;
  }[];
}) {
  const [menunggu, mulai] = useTransition();
  const [teks, setTeks] = useState("");
  const router = useRouter();
  const { k, isi, bahasa } = useBahasa();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareQuote className="size-4" />
          {isi(k.usulan.diskusi.judul, { jumlah: catatan.length })}
        </CardTitle>
        <CardDescription>{k.usulan.diskusi.keterangan}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {catatan.length > 0 ? (
          <ul className="space-y-3">
            {catatan.map((c) => (
              <li key={c.id} className="border-b pb-3 text-sm last:border-0 last:pb-0">
                <p className="text-xs text-muted-foreground">
                  {c.oleh?.nama ?? k.usulan.diskusi.penggunaDihapus} ·{" "}
                  {tanggal(c.dibuatPada, bahasa, "pendek")}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{c.isi}</p>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-2">
          <AreaTeks
            id="catatan-baru"
            nama="isi"
            nilai={teks}
            onChange={setTeks}
            baris={3}
            placeholder={k.usulan.diskusi.placeholder}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={menunggu || teks.trim().length < 12}
            onClick={() =>
              mulai(async () => {
                const hasil = await tambahCatatan(usulanId, teks);
                if (hasil.ok) {
                  toast.success(hasil.pesan);
                  setTeks("");
                  router.refresh();
                } else {
                  toast.error(hasil.pesan);
                }
              })
            }
          >
            {k.usulan.diskusi.kirim}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
