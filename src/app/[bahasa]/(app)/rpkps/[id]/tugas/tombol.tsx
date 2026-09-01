"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { TombolIkon } from "@/components/tombol-ikon";
import { buatTugas, hapusTugas, type Hasil } from "./aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { jalur } = useBahasa();
  const jalankan = (fn: () => Promise<Hasil>, tujuan?: (h: Hasil) => string | null) =>
    mulai(async () => {
      const h = await fn();
      if (h.ok) {
        toast.success(h.pesan);
        const ke = tujuan?.(h);
        if (ke) router.push(jalur(ke));
        router.refresh();
      } else toast.error(h.pesan);
    });
  return { menunggu, jalankan };
}

export function TombolBuatTugas({ rpkpsId }: { rpkpsId: string }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      disabled={menunggu}
      onClick={() =>
        jalankan(
          () => buatTugas(rpkpsId),
          (h) => (h.id ? `/rpkps/${rpkpsId}/tugas/${h.id}` : null),
        )
      }
    >
      <Plus />
      {menunggu ? "Membuat…" : "Tambah tugas"}
    </Button>
  );
}

export function TombolHapusTugas({ tugasId, nama }: { tugasId: string; nama: string }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <TombolIkon
      petunjuk={`Hapus tugas "${nama}" beserta indikator dan linimasanya`}
      disabled={menunggu}
      onClick={() => {
        if (!confirm(`Hapus tugas "${nama}" beserta indikator dan linimasanya?`)) return;
        jalankan(() => hapusTugas(tugasId));
      }}
    >
      <Trash2 />
    </TombolIkon>
  );
}
