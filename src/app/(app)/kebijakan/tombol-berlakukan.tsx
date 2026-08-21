"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { berlakukanKebijakan } from "./aksi";

export function TombolBerlakukan({ kebijakanId }: { kebijakanId: string }) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={menunggu}
      onClick={() =>
        mulai(async () => {
          const hasil = await berlakukanKebijakan(kebijakanId);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
    >
      {menunggu ? "Memproses…" : "Berlakukan kebijakan"}
    </Button>
  );
}
