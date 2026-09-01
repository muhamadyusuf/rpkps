"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { berlakukanKebijakan } from "./aksi";

export function TombolBerlakukan({ kebijakanId }: { kebijakanId: string }) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k } = useBahasa();

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
      {menunggu ? k.kebijakan.memproses : k.kebijakan.berlakukan}
    </Button>
  );
}
