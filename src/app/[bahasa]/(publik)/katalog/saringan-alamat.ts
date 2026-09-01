import type { SaringanKatalog } from "@/lib/publik/muat";

/**
 * Membaca penyaring dari query string.
 *
 * Semuanya berasal dari luar dan tidak boleh dipercaya: `searchParams` bisa
 * berisi larik (`?semester=1&semester=2`), teks kosong dari formulir yang
 * dibiarkan pada pilihan "Semua", atau angka semester yang tidak masuk akal.
 * Dibersihkan sekali di sini supaya kueri Prisma di hilir menerima bentuk yang
 * sudah pasti.
 */
export function bacaSaringan(
  mentah: Record<string, string | string[] | undefined>,
): SaringanKatalog & { semester?: number } {
  const cari = satu(mentah.cari);
  const prodi = satu(mentah.prodi);
  const tahunAkademik = satu(mentah.ta);
  const semester = angkaSemester(satu(mentah.semester));

  return {
    ...(cari ? { cari } : {}),
    ...(prodi ? { prodi } : {}),
    ...(tahunAkademik ? { tahunAkademik } : {}),
    ...(semester ? { semester } : {}),
  };
}

function satu(nilai: string | string[] | undefined): string | undefined {
  const teks = Array.isArray(nilai) ? nilai[0] : nilai;
  const bersih = teks?.trim();
  return bersih ? bersih : undefined;
}

function angkaSemester(nilai: string | undefined): number | undefined {
  if (!nilai) return undefined;
  const angka = Number(nilai);
  if (!Number.isInteger(angka) || angka < 1 || angka > 14) return undefined;
  return angka;
}
