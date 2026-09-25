"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { sinkronkanSekarang } from "./aksi";

/** Menyelaraskan peran SEMUA pegawai dengan identitas-itts sekarang (sama dengan cron harian). */
export function TombolSinkronSemua() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k } = useBahasa();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={menunggu}
      onClick={() =>
        mulai(async () => {
          const hasil = await sinkronkanSekarang();
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
    >
      {menunggu ? k.pengguna.sinkron.berjalan : k.pengguna.sinkron.tombol}
    </Button>
  );
}
