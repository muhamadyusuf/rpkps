import type { Nada } from "@/domain/dasbor/ringkasan";

/**
 * Pemetaan nada → token warna. Bagan TIDAK PERNAH menyebut warna Tailwind
 * mentah (`emerald-600`, `amber-500`); seluruhnya lewat token yang sudah
 * disusun untuk terang dan gelap di `globals.css`.
 */
export const WARNA_NADA: Record<Nada, string> = {
  netral: "var(--muted-foreground)",
  cahaya: "var(--cahaya)",
  sukses: "var(--success)",
  peringatan: "var(--warning)",
  bahaya: "var(--destructive)",
};

/** Deret warna untuk bagan banyak seri. Lima cukup — lebih dari itu, legenda
 * lebih cepat dibaca daripada warna. */
export const WARNA_DERET = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function warnaDeret(i: number): string {
  return WARNA_DERET[i % WARNA_DERET.length];
}
