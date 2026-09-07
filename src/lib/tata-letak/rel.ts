/**
 * Lebar rel navigasi: penuh, atau ciut menjadi ikon saja.
 *
 * Disimpan di COOKIE, bukan `localStorage`, dengan alasan yang sama seperti
 * panel pratinjau: keadaannya harus sudah diketahui SERVER supaya rel dirender
 * langsung pada lebar yang benar. `localStorage` baru terbaca setelah halaman
 * sampai di peramban, dan hasilnya rel yang selalu lahir lebar lalu mengerut
 * satu frame kemudian — di setiap perpindahan halaman.
 *
 * Tidak ada `server-only` di sini: dibaca tata letak di server, ditulis rel di
 * peramban, dan namanya hanya berguna selama keduanya sepakat.
 */

export const NAMA_COOKIE_REL = "rel_ciut";

/** Cookie apa pun selain `"1"` berarti rel penuh — bawaan yang aman. */
export function bacaRelCiut(nilai: string | undefined): boolean {
  return nilai === "1";
}

export function tulisRelCiut(ciut: boolean): string {
  return ciut ? "1" : "0";
}
