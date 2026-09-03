"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBahasa } from "@/components/penyedia-bahasa";
import { buatBukuAjar } from "./aksi";

/**
 * Memulai buku ajar untuk sebuah RPKPS.
 *
 * Bahasanya dipilih di sini dan tidak dapat diubah setelahnya: buku Inggris
 * adalah buku KEDUA yang ditulis terpisah, bukan terjemahan yang menempel pada
 * buku Indonesia (docs/16 P7).
 */
export function TombolBuatBuku({
  rpkpsId,
  bahasa,
}: {
  rpkpsId: string;
  bahasa: "id" | "en";
}) {
  const { k, jalur } = useBahasa();
  const [menunggu, mulai] = useTransition();
  const [sedang, setSedang] = useState(false);
  const router = useRouter();

  return (
    <Button
      size="sm"
      variant={bahasa === "id" ? "default" : "outline"}
      disabled={menunggu || sedang}
      onClick={() => {
        setSedang(true);
        mulai(async () => {
          const hasil = await buatBukuAjar({ rpkpsId, bahasa });
          setSedang(false);
          if (!hasil.ok) {
            toast.error(hasil.pesan);
            return;
          }
          toast.success(hasil.pesan);
          if (hasil.id) router.push(jalur(`/bahan-ajar/${hasil.id}`));
        });
      }}
    >
      {menunggu || sedang ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <BookPlus className="size-4" />
      )}
      {menunggu || sedang
        ? k.bahanAjar.membuat
        : bahasa === "id"
          ? k.bahanAjar.buatId
          : k.bahanAjar.buatEn}
    </Button>
  );
}
