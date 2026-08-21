"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hapusKurikulum, ubahStatusKurikulum, type HasilSimpan } from "./aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<HasilSimpan>) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });
  return { menunggu, jalankan };
}

export function TombolStatusKurikulum({
  id,
  status,
}: {
  id: string;
  status: "DRAF" | "BERLAKU" | "ARSIP";
}) {
  const { menunggu, jalankan } = useAksi();

  if (status === "DRAF") {
    return (
      <Button
        size="sm"
        disabled={menunggu}
        onClick={() => jalankan(() => ubahStatusKurikulum(id, "BERLAKU"))}
      >
        Berlakukan
      </Button>
    );
  }
  if (status === "BERLAKU") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={menunggu}
        onClick={() => jalankan(() => ubahStatusKurikulum(id, "ARSIP"))}
      >
        Arsipkan
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={menunggu}
      onClick={() => jalankan(() => ubahStatusKurikulum(id, "DRAF"))}
    >
      Kembalikan ke draf
    </Button>
  );
}

export function TombolHapusKurikulum({ id, nama }: { id: string; nama: string }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={menunggu}
      onClick={() => {
        if (
          !confirm(
            `Hapus kurikulum "${nama}" beserta seluruh CPL, mata kuliah, CPMK, dan Sub-CPMK di dalamnya?\n\nTindakan ini tidak dapat dibatalkan.`,
          )
        ) {
          return;
        }
        jalankan(() => hapusKurikulum(id));
      }}
    >
      Hapus
    </Button>
  );
}
