"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MailX } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { setelSurelNotifikasi } from "./aksi";

/**
 * Sakelar kanal surel (docs/10 §2.5).
 *
 * Hanya dirender bila kanalnya memang menyala di server. Sakelar yang tampil
 * pada pemasangan tanpa SMTP adalah janji yang tidak dapat ditepati aplikasi:
 * dinyalakan, lalu tidak ada surel yang pernah datang.
 */
export function SakelarSurel({ nyala }: { nyala: boolean }) {
  const { k } = useBahasa();
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {nyala ? (
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        ) : (
          <MailX className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">{k.notifikasi.surelJudul}</p>
          <p className="text-xs text-muted-foreground">
            {nyala ? k.notifikasi.surelNyala : k.notifikasi.surelMati}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={menunggu}
        onClick={() =>
          mulai(async () => {
            await setelSurelNotifikasi(!nyala);
            toast.success(nyala ? k.notifikasi.surelDimatikan : k.notifikasi.surelDinyalakan);
            router.refresh();
          })
        }
      >
        {nyala ? k.notifikasi.surelMatikan : k.notifikasi.surelNyalakan}
      </Button>
    </div>
  );
}
