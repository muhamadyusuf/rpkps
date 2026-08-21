"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ajukanRpkps, buatRpkps, putuskanRpkps, type Hasil } from "./aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<Hasil>, tujuan?: (h: Hasil) => string | null) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        const ke = tujuan?.(hasil);
        if (ke) router.push(ke);
        router.refresh();
      } else {
        toast.error(hasil.pesan);
        if (hasil.id) router.push(`/rpkps/${hasil.id}`);
      }
    });
  return { menunggu, jalankan };
}

export function TombolBuatRpkps({
  mataKuliahId,
  tahunAkademikId,
  label = "Buat RPKPS",
}: {
  mataKuliahId: string;
  tahunAkademikId: string;
  label?: string;
}) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      size="sm"
      disabled={menunggu}
      onClick={() =>
        jalankan(
          () => buatRpkps(mataKuliahId, tahunAkademikId),
          (h) => (h.id ? `/rpkps/${h.id}` : null),
        )
      }
    >
      {menunggu ? "Menyiapkan…" : label}
    </Button>
  );
}

export function TombolAjukan({ id, aktif }: { id: string; aktif: boolean }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button disabled={menunggu || !aktif} onClick={() => jalankan(() => ajukanRpkps(id))}>
      {menunggu ? "Mengajukan…" : "Ajukan untuk pengesahan"}
    </Button>
  );
}

export function TombolPutusan({ id }: { id: string }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={menunggu}
        onClick={() => jalankan(() => putuskanRpkps(id, "SETUJU"))}
      >
        Setujui &amp; terbitkan
      </Button>
      <Button
        variant="outline"
        disabled={menunggu}
        onClick={() => {
          const catatan = prompt("Catatan revisi (opsional):") ?? undefined;
          jalankan(() => putuskanRpkps(id, "REVISI", catatan));
        }}
      >
        Kembalikan untuk revisi
      </Button>
    </div>
  );
}
