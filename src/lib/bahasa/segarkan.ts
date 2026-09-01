import { revalidatePath } from "next/cache";
import { segalaBahasa } from "./jalur";

/**
 * `revalidatePath` untuk kedua bahasa sekaligus.
 *
 * Setelah alamat berawalan bahasa, `revalidatePath("/rpkps")` tidak lagi
 * cocok dengan apa pun — halaman yang sesungguhnya adalah `/id/rpkps` dan
 * `/en/rpkps`. Kegagalannya SENYAP: tidak ada galat, hanya data basi yang
 * bertahan sampai ada yang mengeluh. Karena itu seluruh aksi memakai fungsi
 * ini, dan `revalidatePath` langsung dilarang di `src/app` oleh ESLint.
 *
 * Dua panggilan harfiah, bukan pencocokan pola: bentuk `revalidatePath(pola,
 * "page")` mensyaratkan seluruh ruas dinamis ditulis berkurung, sehingga
 * `/[bahasa]/rpkps/${id}` — separuh harfiah, separuh pola — tidak dapat
 * diandalkan. Dua panggilan selalu berarti apa yang tertulis.
 */
export function segarkan(...daftarJalur: string[]): void {
  for (const href of daftarJalur) {
    for (const berbahasa of segalaBahasa(href)) revalidatePath(berbahasa);
  }
}
