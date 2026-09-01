import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { kamus } from "@/lib/bahasa/server";

/**
 * Pencarian daftar sebagai formulir GET biasa — polanya sama dengan penyaring
 * katalog publik.
 *
 * Kolom tersembunyi TIDAK menyertakan `hal`: pencarian baru selalu dimulai
 * dari halaman pertama, karena hasil yang berbeda membuat nomor halaman lama
 * tidak berarti apa-apa.
 */
export async function KotakCari({
  action,
  nilai,
  placeholder,
  className,
}: {
  action: string;
  nilai: string;
  placeholder: string;
  className?: string;
}) {
  const k = await kamus();

  return (
    <form action={action} className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={nilai}
          placeholder={placeholder}
          aria-label={k.komponen.cari.aria}
          className="pl-9"
        />
      </div>
      <Button type="submit" variant="outline">
        {k.komponen.cari.tombol}
      </Button>
      {nilai ? (
        <a
          href={action}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          {k.komponen.cari.bersihkan}
        </a>
      ) : null}
    </form>
  );
}
