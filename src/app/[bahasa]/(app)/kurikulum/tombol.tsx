"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
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
  const { k } = useBahasa();

  if (status === "DRAF") {
    return (
      <Button
        size="sm"
        disabled={menunggu}
        onClick={() => jalankan(() => ubahStatusKurikulum(id, "BERLAKU"))}
      >
        {k.kurikulum.berlakukan}
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
        {k.kurikulum.arsipkan}
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
      {k.kurikulum.kembalikanDraf}
    </Button>
  );
}

export function TombolHapusKurikulum({ id, nama }: { id: string; nama: string }) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();

  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={menunggu}
      onClick={() => {
        if (!confirm(isi(k.kurikulum.konfirmasiHapus, { nama }))) return;
        jalankan(() => hapusKurikulum(id));
      }}
    >
      {k.kurikulum.hapus}
    </Button>
  );
}
