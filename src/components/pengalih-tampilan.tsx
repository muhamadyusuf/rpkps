import { LayoutGrid, Rows3 } from "lucide-react";
import { Tautan } from "@/components/tautan";
import { kamus } from "@/lib/bahasa/server";
import { cn } from "@/lib/utils";

/**
 * Pengalih antara peta semester dan tabel rinci.
 *
 * Pilihannya hidup di ALAMAT, bukan di state komponen. Dua alasan: halaman
 * daftar berpindah halaman lewat tautan, dan state klien akan kembali ke
 * bawaan setiap kali itu terjadi; dan "buka tabel rincinya" menjadi sesuatu
 * yang bisa dikirimkan sebagai tautan.
 *
 * Digambar sebagai tautan, bukan tombol — sama dengan navigasi halaman, dan
 * dengan alasan yang sama: dapat dibuka di tab baru dan tetap bekerja tanpa
 * JavaScript.
 */

export type Tampilan = "peta" | "tabel";

/** Bawaannya peta: itulah lembar yang dibaca orang lebih dulu. */
export function bacaTampilan(nilai: string | string[] | undefined): Tampilan {
  const teks = Array.isArray(nilai) ? nilai[0] : nilai;
  return teks === "tabel" ? "tabel" : "peta";
}

/**
 * Alamat halaman yang sama dengan tampilan lain, saringan lain dipertahankan.
 * `hal` sengaja tidak dibawa: kedua tampilan memuat baris yang sama, tetapi
 * nomor halaman peta tidak dijamin bermakna di tabel.
 */
export function tautanTampilan(
  basis: string,
  params: Record<string, string | undefined>,
  tampilan: Tampilan,
): string {
  const q = new URLSearchParams();
  for (const [kunci, nilai] of Object.entries(params)) {
    if (nilai !== undefined && nilai !== "") q.set(kunci, nilai);
  }
  if (tampilan === "tabel") q.set("tampilan", "tabel");
  const teks = q.toString();
  return teks ? `${basis}?${teks}` : basis;
}

export async function PengalihTampilan({
  basis,
  params = {},
  tampilan,
  className,
}: {
  /** Alamat halaman TANPA awalan bahasa — mis. "/rpkps". */
  basis: string;
  params?: Record<string, string | undefined>;
  tampilan: Tampilan;
  className?: string;
}) {
  const k = await kamus();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5",
        className,
      )}
    >
      <Butir
        href={tautanTampilan(basis, params, "peta")}
        aktif={tampilan === "peta"}
        label={k.komponen.peta.tampilanPeta}
      >
        <LayoutGrid className="size-3.5" />
      </Butir>
      <Butir
        href={tautanTampilan(basis, params, "tabel")}
        aktif={tampilan === "tabel"}
        label={k.komponen.peta.tampilanTabel}
      >
        <Rows3 className="size-3.5" />
      </Butir>
    </div>
  );
}

function Butir({
  href,
  aktif,
  label,
  children,
}: {
  href: string;
  aktif: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tautan
      href={href}
      aria-current={aktif ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        aktif
          ? "bg-cahaya/12 text-foreground ring-1 ring-cahaya/25"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {label}
    </Tautan>
  );
}
