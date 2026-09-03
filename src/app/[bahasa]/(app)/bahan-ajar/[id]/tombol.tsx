"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBahasa } from "@/components/penyedia-bahasa";
import { hapusBukuAjar } from "../aksi";

/**
 * Buku ajar boleh dihapus tanpa syarat, tidak seperti RPKPS: ia bukan akar
 * cascade yang menjangkau salinan beku, nilai mahasiswa, maupun halaman
 * publik. Konfirmasinya tetap ada karena yang hilang adalah tulisan.
 */
export function TombolHapusBuku({ bukuId }: { bukuId: string }) {
  const { k, jalur } = useBahasa();
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  return (
    <div className="flex justify-end">
      <Button
        size="sm"
        variant="outline"
        disabled={menunggu}
        onClick={() => {
          if (!confirm(k.bahanAjar.hapusKonfirmasi)) return;
          mulai(async () => {
            const hasil = await hapusBukuAjar(bukuId);
            if (!hasil.ok) {
              toast.error(hasil.pesan);
              return;
            }
            toast.success(hasil.pesan);
            router.push(jalur("/bahan-ajar"));
          });
        }}
      >
        {menunggu ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {k.bahanAjar.hapusTombol}
      </Button>
    </div>
  );
}
