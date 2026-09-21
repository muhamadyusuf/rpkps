"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { simpanTinjauan } from "../aksi";
import type { StatusPerangkap } from "@/generated/prisma";

const STATUS: StatusPerangkap[] = ["BARU", "DITINJAU", "DILAPORKAN", "DIABAIKAN"];

export function FormulirTinjauan({
  id,
  status,
  catatan,
}: {
  id: string;
  status: StatusPerangkap;
  catatan: string;
}) {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { k } = useBahasa();

  return (
    <form
      action={(fd) =>
        mulai(async () => {
          const hasil = await simpanTinjauan(id, fd);
          if (hasil.ok) {
            toast.success(hasil.pesan);
            router.refresh();
          } else {
            toast.error(hasil.pesan);
          }
        })
      }
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="status">{k.perangkap.detail.statusLabel}</Label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
        >
          {STATUS.map((s) => (
            <option key={s} value={s}>
              {k.perangkap.status[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="catatan">{k.perangkap.detail.catatan}</Label>
        <textarea
          id="catatan"
          name="catatan"
          rows={4}
          maxLength={1000}
          defaultValue={catatan}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit" disabled={menunggu}>
        {k.perangkap.detail.simpan}
      </Button>
    </form>
  );
}
