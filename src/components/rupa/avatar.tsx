import { cn } from "@/lib/utils";

export function inisialDari(nama: string): string {
  return (
    nama
      .split(/\s+/)
      .filter((bagian) => /\p{L}/u.test(bagian))
      .slice(0, 2)
      .map((bagian) => bagian[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Avatar inisial bulat, serupa `Avatar` identitas-itts. Tanpa foto: profil
 * pegawai hidup di identitas-itts (docs/26), dan RPKPS tidak mengambil foto.
 */
export function AvatarInisial({
  nama,
  ukuran = 32,
  className,
}: {
  nama: string;
  ukuran?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: ukuran, height: ukuran, fontSize: Math.round(ukuran * 0.36) }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-permukaan-3 font-semibold text-teks-2 ring-1 ring-garis",
        className,
      )}
    >
      {inisialDari(nama)}
    </span>
  );
}
