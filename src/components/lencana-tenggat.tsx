import { CalendarClock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NilaiTenggat } from "@/domain/rpkps/tenggat";

/**
 * Isyarat tenggat. Sengaja DIAM pada keadaan tenang: tenggat yang masih jauh,
 * dokumen yang sudah diajukan, dan semester tanpa tenggat tidak menampilkan
 * apa pun. Penanda yang selalu muncul berhenti dibaca, dan yang berhenti
 * dibaca tidak menolong siapa pun saat tenggatnya benar-benar dekat.
 */
export function LencanaTenggat({
  nilai,
  className,
}: {
  nilai: NilaiTenggat;
  className?: string;
}) {
  if (nilai.tingkat !== "DEKAT" && nilai.tingkat !== "LEWAT") return null;

  const lewat = nilai.tingkat === "LEWAT";
  const Ikon = lewat ? TriangleAlert : CalendarClock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1",
        lewat
          ? "bg-destructive/10 text-destructive ring-destructive/25"
          : "bg-warning/10 text-warning-foreground ring-warning/25",
        className,
      )}
    >
      <Ikon className="size-3 shrink-0" />
      {nilai.label}
    </span>
  );
}
