"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaTeks } from "../pilihan";
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
  const [isi, setIsi] = useState("");
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareQuote className="size-4" />
          Catatan ({catatan.length})
        </CardTitle>
        <CardDescription>
          Pertimbangan mutu dari Penjaminan Mutu dan tanggapan pengusul. Tidak
          memblokir keputusan Ketua Program Studi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {catatan.length > 0 ? (
          <ul className="space-y-3">
            {catatan.map((c) => (
              <li key={c.id} className="border-b pb-3 text-sm last:border-0 last:pb-0">
                <p className="text-xs text-muted-foreground">
                  {c.oleh?.nama ?? "Pengguna dihapus"} ·{" "}
                  {c.dibuatPada.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
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
            nilai={isi}
            onChange={setIsi}
            baris={3}
            placeholder="Tulis pertimbangan atau tanggapan…"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={menunggu || isi.trim().length < 12}
            onClick={() =>
              mulai(async () => {
                const hasil = await tambahCatatan(usulanId, isi);
                if (hasil.ok) {
                  toast.success(hasil.pesan);
                  setIsi("");
                  router.refresh();
                } else {
                  toast.error(hasil.pesan);
                }
              })
            }
          >
            Kirim catatan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
