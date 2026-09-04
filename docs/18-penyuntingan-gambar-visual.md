# Penyuntingan Gambar Visual

> Status: **TERPASANG (V1–V5).**
> Membalik satu keputusan docs/17 §9 ("tidak ada penyunting gambar visual").
> Alasan pembalikannya sederhana: memperbaiki satu label yang bertumpuk
> seharusnya tidak menuntut dosen membaca SVG.

Keputusan yang sudah diambil:

| Pertanyaan | Keputusan |
|---|---|
| Cakupan | Pilih elemen, geser, ubah ukuran, sunting teks dan warnanya, hapus |
| Mermaid | Ditawari "bekukan ke SVG" sekali jalan, dengan peringatan |
| Raster | Potong dan putar |

---

## BAGIAN 1 — Dua aturan yang menjepit fitur ini

Fitur ini lahir di antara dua aturan yang sudah terpasang, dan keduanya tidak
boleh dilonggarkan.

**docs/17 I1 — diagram adalah kode; PNG hanya turunannya.** Maka penyunting
visual TIDAK BOLEH menyunting piksel. Suntingan piksel akan lenyap pada
rasterisasi berikutnya, dan yang lebih buruk: kode dan gambar menjadi dua hal
yang menceritakan isi berbeda. **Setiap gerakan di layar menulis ulang
KODENYA.**

**docs/17 I2 — SVG hanya dirender di dalam `<img>`.** Maka kita tidak dapat
memasang penangan klik pada elemen di dalam SVG: bagi DOM, `<img>` buram. Tidak
ada `elemen.addEventListener` untuk sebuah `<rect>` di dalamnya, dan menyisipkan
SVG ke DOM agar bisa — persis yang dilarang.

### 1.1 Jalan keluarnya: lapisan pegangan milik kita sendiri

`<img>` tetap menjadi latar yang terlihat. Di atasnya, kita menggambar
**lapisan pegangan sendiri** dari HTML biasa — kotak seleksi dan titik seret —
yang posisinya dihitung dari geometri yang KITA urai dari kode SVG.

```
  koordinat tetikus (piksel layar)
      │  dibagi skala tampilan
      ▼
  koordinat viewBox (satuan gambar)
      │  dicocokkan dengan kotak tiap simpul yang diurai
      ▼
  simpul terpilih → sunting atributnya di dalam TEKS kodenya
      │
      ▼
  kode baru → periksa ulang → render ulang → rasterkan ulang
```

Dua aturan tetap utuh: kode tetap sumber kebenaran, dan tidak ada satu pun
markah asing yang masuk ke pohon dokumen.

### 1.2 Yang dapat dan tidak dapat disentuh

| Elemen | Geser | Ubah ukuran | Sunting teks |
|---|---|---|---|
| `rect` | ✅ `x`,`y` | ✅ `width`,`height` | — |
| `circle` | ✅ `cx`,`cy` | ✅ `r` | — |
| `ellipse` | ✅ `cx`,`cy` | ✅ `rx`,`ry` | — |
| `line` | ✅ kedua ujung | — | — |
| `polyline`, `polygon` | ✅ seluruh titik | — | — |
| `text`, `tspan` | ✅ `x`,`y` | ✅ `font-size` | ✅ |
| `path` | ✅ lewat `transform` | — | — |

`path` digeser dengan `transform="translate(...)"` yang digabung dengan
translasi yang sudah ada, bukan dengan menulis ulang `d`-nya. Menyunting
lengkungan Bézier lewat seret adalah penyunting vektor penuh, dan itu bukan
yang dibangun di sini.

---

## BAGIAN 2 — Menyunting teks, bukan pohon

Suntingan dikerjakan **di dalam teks kode**, pada offset yang sudah diketahui
pengurai — bukan dengan mengurai lalu menyusun ulang seluruh berkas.

Alasannya bukan penghematan. Menyusun ulang berarti setiap suntingan kecil
menulis ulang seluruh SVG dengan format kita sendiri: urutan atribut berubah,
indentasi hilang, komentar penyusunnya lenyap. Dosen yang membuka tab "kode"
setelah menggeser satu kotak akan menemukan berkas yang tidak dikenalinya lagi.

Karena itu `uraiSvg()` mengembalikan simpul beserta **posisi awal dan akhir**
tiap nilai atribut di dalam string aslinya, dan penyuntingnya mengganti
potongan itu saja.

---

## BAGIAN 3 — Membekukan Mermaid

Mermaid menghitung tata letaknya sendiri; tidak ada koordinat yang dapat
diseret. Yang ditawarkan adalah **membekukannya menjadi SVG sekali jalan**,
dengan peringatan yang tidak boleh diperhalus: sesudah itu ia bukan Mermaid
lagi, tata letak otomatisnya hilang, dan menyusun ulang dari kode Mermaid
berarti membuang seluruh suntingan visualnya.

Satu kendala yang menentukan cara pembekuannya: **keluaran Mermaid memuat blok
`<style>`**, dan `<style>` ditolak sanitasi kita (docs/17 §5.1) — ia menerima
`url(...)` dan mengembalikan pengambilan sumber daya luar lewat pintu belakang.
Jadi keluaran Mermaid tidak dapat disimpan apa adanya.

Penjinakannya **murni teks**, tanpa DOM sama sekali:

1. Buang seluruh blok `<style>`.
2. Pasang atribut rupa secara eksplisit menurut jenis elemennya — bentuk
   mendapat isian dan garis buku, `path` mendapat `fill="none"`, teks mendapat
   warna dan font buku. Palet yang dipakai sama dengan tema Mermaid kita,
   sehingga hasilnya nyaris tidak berbeda dari yang baru dilihat dosen.
3. Buang `width`/`height` pada tag akar (cetakan gaya docs/17 §4.3).
4. Jalankan `periksaSvgAman` dan `periksaGayaSvg`. Yang gagal **tidak
   disimpan**, dan diagramnya tetap Mermaid seperti sebelumnya.

Menginlinekan gaya dengan `getComputedStyle` sempat dipertimbangkan dan
ditolak: ia menuntut SVG disisipkan ke dokumen, dan itu persis larangan I2.
Bahwa markahnya kali ini berasal dari pustaka kita sendiri tidak mengubah
bentuk kodenya — yang tertinggal adalah jalur penyisipan yang siap dipakai
ulang oleh orang berikutnya untuk markah yang bukan milik kita.

---

## BAGIAN 4 — Gambar raster

Untuk foto, tangkapan layar, dan ilustrasi AI tidak ada kode yang dapat
disunting, jadi yang masuk akal hanyalah operasi pada pikselnya: **potong** dan
**putar 90°**. Keduanya di peramban, dengan kanvas yang sama seperti
rasterisasi, lalu PNG-nya diganti.

Batasnya jujur: memotong membuang piksel dan tidak dapat dibatalkan setelah
disimpan. Aslinya tidak disimpan — menyimpan dua salinan tiap gambar demi
sebuah "batal" yang jarang dipakai berarti melipatgandakan kolom `bytea`
paling besar di basis data.

---

## BAGIAN 5 — Antarmuka

Di panel gambar, tombol pensil membuka penyunting bertab. Tab yang tampil
ditentukan bentuk gambarnya, karena tidak semuanya berlaku untuk semuanya:

- **Visual** (SVG saja) — gambar beserta lapisan pegangan, ditambah panel
  sifat: isi teks, warna dari palet, dan tombol hapus. Batal/ulang menyimpan
  riwayat KODE, bukan riwayat gerakan — satu tumpukan string, dan setiap
  keadaan di dalamnya adalah SVG yang sah.
- **Kode** (SVG dan Mermaid) — yang sudah ada, tetap tersedia. Ia dan tab
  visual menyunting benda yang sama, dan berpindah tab tidak kehilangan
  suntingan.
- **Gambar** (raster saja) — potong dan putar.

Diagram Mermaid mendapat satu tombol tambahan, **Bekukan ke SVG**, dengan
konfirmasi yang menyebutkan apa yang hilang.

Penyimpanan menempuh jalur yang sama persis dengan sebelumnya: kode diperiksa
ulang di server, PNG dirasterkan ulang di peramban. Tidak ada jalur masuk baru
ke basis data, dan karena itu tidak ada lapis pemeriksaan yang terlewat.

---

## BAGIAN 6 — Yang sengaja TIDAK dikerjakan

- **Menggambar bentuk baru.** Penyunting ini memperbaiki diagram yang sudah
  ada; membuat yang baru adalah pekerjaan model atau pekerjaan penyunting
  vektor sungguhan.
- **Menyunting lengkungan `path`.**
- **Seret untuk mengubah tata letak Mermaid.** Tidak mungkin secara bentuk;
  yang ditawarkan adalah membekukannya lebih dulu.
- **Warna di luar palet.** Penyunting visual tidak boleh menjadi pintu belakang
  yang melewati cetakan gaya (docs/17 §4.3).
- **Riwayat batal yang melintasi penyimpanan.**

---

## BAGIAN 7 — Uji

| Berkas | Yang dijaga |
|---|---|
| `svg-model.test.ts` | urai simpul beserta offsetnya; geser tiap jenis elemen; ubah ukuran; sunting teks; hapus; hit-test memilih yang paling atas; **suntingan tidak mengubah bagian lain berkas** |
| `svg-model.test.ts` | hasil tiap suntingan tetap lolos `periksaSvgAman` dan `periksaGayaSvg` |
| `bekukan-mermaid.test.ts` | `<style>` terbuang; atribut rupa terpasang; `width`/`height` akar hilang; hasilnya lolos kedua pemeriksa |
| `gambar-aman.test.ts` | tetap hijau — penyunting visual tidak menambah satu pun `innerHTML` |

---

## BAGIAN 8 — Rencana pemasangan

| Tahap | Isi | Status |
|---|---|---|
| V1 | `svg-model.ts`: pengurai beroffset, kotak simpul, hit-test, operasi sunting | ✅ |
| V2 | `bekukan-mermaid.ts` | ✅ |
| V3 | Penyunting visual di peramban: lapisan pegangan, seret, panel properti, batal/ulang | ✅ |
| V4 | Penyunting raster: potong dan putar | ✅ |
| V5 | Penyatuan ke panel gambar, kamus dua bahasa, uji | ✅ |
