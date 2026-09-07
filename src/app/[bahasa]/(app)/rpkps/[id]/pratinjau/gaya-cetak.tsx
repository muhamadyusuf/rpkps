/**
 * Aturan cetak khusus halaman pratinjau naskah.
 *
 * Dipasang di sini, bukan di `globals.css`, karena `@page` tidak dapat
 * dibatasi selektor: satu `@page { margin: 0 }` di berkas global berlaku untuk
 * SETIAP halaman aplikasi yang dicetak — termasuk katalog publik, yang justru
 * mengandalkan margin bawaan peramban dan akan tercetak menempel tepi kertas.
 * Sebagai elemen `<style>` di dalam halaman ini, aturannya ikut lahir dan mati
 * bersama halamannya.
 *
 * Margin dinolkan karena lembar naskah SUDAH membawa marginnya sendiri (1,5 cm
 * potret, 1,23 cm mendatar, sama dengan berkas DOCX). Dibiarkan bawaan,
 * keduanya bertumpuk dan naskah tercetak lebih sempit daripada aslinya.
 */
export function GayaCetakNaskah() {
  return (
    <style>{`
@media print {
  @page { size: A4 portrait; margin: 0; }
  /* Tabel mingguan mendatar di berkas DOCX, dan harus mendatar juga di sini.
     Peramban yang belum mengenal halaman bernama tetap mencetak tabelnya —
     hanya saja pada kertas potret. */
  @page mendatar { size: A4 landscape; margin: 0; }

  .naskah { margin: 0 !important; }
  .naskah > * + * { margin-top: 0 !important; }

  .lembar {
    box-shadow: none !important;
    break-after: page;
    break-inside: auto;
  }
  .naskah > *:last-child .lembar { break-after: auto; }
  .lembar[data-lembar="mendatar"] { page: mendatar; }

  /* Tabel panjang boleh terpenggal antarhalaman, tetapi kepalanya ikut ke
     halaman berikutnya — tabel mingguan hampir selalu lebih tinggi dari satu
     lembar. */
  .lembar table { break-inside: auto; }
  .lembar thead { display: table-header-group; }
}
    `}</style>
  );
}
