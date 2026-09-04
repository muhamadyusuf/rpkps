# Gambar dan Diagram dalam Buku Ajar

> Status: **TERPASANG SELURUHNYA (IL1–IL7).** Skema, domain murni, tahap AI
> diagram, antarmuka beserta rasterisasi di peramban, penyematan gambar pada
> `.docx` dan `.pptx`, serta ilustrasi raster berketerangan asal — semuanya
> ada beserta ujinya.
>
> Melengkapi docs/16. Buku ajar mendapat gambar: **diagram vektor** yang
> ditulis AI sebagai kode, **unggahan dosen**, dan — hanya pada penyedia yang
> mendukung — **ilustrasi raster** dari model penghasil gambar.

Keputusan yang sudah diambil sebelum rancangan ini ditulis:

| Pertanyaan | Keputusan |
|---|---|
| Sumber gambar | Diagram AI, unggahan dosen, dan ilustrasi raster AI |
| Bentuk diagram | Mermaid untuk yang berbentuk graf; SVG tulisan model untuk sisanya |
| Rasterisasi | Di peramban, saat dosen menyetujui |
| Penyimpanan | Kolom `bytea` di Postgres |

---

## BAGIAN 1 — Mengapa diagram, bukan gambar

Permintaannya berbunyi: gambarnya jangan terlihat seperti hasil AI. Itu bukan
soal selera, dan penyebabnya dapat disebut satu per satu.

Yang membuat sebuah gambar terbaca sebagai keluaran model penghasil gambar
adalah **piksel yang ditebak**: gradien plastik, bayangan yang tidak konsisten
arahnya, garis yang menebal-menipis tanpa alasan, detail yang mengambang, dan —
yang paling merusak untuk buku ajar — **teks label yang berantakan**. Model
penghasil gambar melukis bentuk yang menyerupai huruf, bukan menuliskan huruf.
Sebuah diagram alur yang labelnya terbaca "Prosess Datta" tidak dapat dipakai
di buku yang akan didaftarkan ISBN, dan tidak dapat diperbaiki tanpa
menggambar ulang.

Diagram buku ajar yang baik justru bukan lukisan. Ia gambar teknis: garis
setebal sama, label yang benar-benar teks, dan tipografi yang sama dengan
tubuh bukunya. Semua itu diperoleh dengan cara yang berbeda sama sekali —
**model menulis KODE diagram, dan mesin yang menggambarnya**. Hasilnya:

- Label adalah teks sungguhan; tidak mungkin berantakan, dapat dicari, dapat
  disalin, dan ikut terbaca pembaca layar.
- Tajam pada cetakan berapa pun — vektor tidak punya resolusi.
- Gaya garisnya ditentukan cetakan kita, bukan selera model.
- Dosen dapat menyuntingnya; kode diagram dapat dibaca manusia.
- Deterministik: diagram yang sama menghasilkan berkas yang sama.

Ilustrasi raster tetap ada tempatnya — gambar suasana, sketsa alat, metafora
visual pembuka bab — dan karena itu tetap dirancang di sini. Tetapi ia
**bukan** jalur utama, dan §6 menyebutkan syarat serta batasnya dengan
terang-terangan.

---

## BAGIAN 2 — Prinsip yang mengikat

**I1 · Diagram adalah kode, bukan piksel.** Yang disimpan sebagai sumber
kebenaran sebuah diagram adalah teks — Mermaid atau SVG — dan PNG hanyalah
turunannya. Diagram yang hanya punya PNG tidak dapat disunting, tidak dapat
diperbaiki labelnya, dan tidak dapat dicetak ulang lebih besar.

**I2 · SVG dari model dan dari unggahan adalah data yang TIDAK dipercaya.**
SVG bukan format gambar yang polos: ia dapat memuat `<script>`, penangan
`onload`, `<foreignObject>` berisi HTML, dan rujukan ke alamat luar yang
membocorkan siapa membuka dokumen. Karena itu dua lapis, dan keduanya wajib:

1. **Disanitasi di server sebelum disimpan** — daftar putih elemen dan
   atribut, bukan daftar hitam.
2. **Dirender hanya di dalam `<img>`** dengan `data:` URI, tidak pernah lewat
   `innerHTML`. Di dalam `<img>`, skrip tidak dieksekusi dan rujukan luar
   tidak diambil, apa pun yang lolos dari lapis pertama.

Menyanitasi di peramban saja bukan pengganti lapis pertama: yang menulis ke
basis data adalah server, dan hasil sanitasi peramban sampai ke sana sebagai
kiriman klien biasa.

**I3 · Yang dicetak persis yang dilihat dosen saat menyetujui.** PNG
dirasterkan peramban dari SVG yang sama, pada saat persetujuan, memakai font
yang sama dengan yang tampak di pratinjau. Rasterisasi di server akan memakai
font server — yang tidak punya Times New Roman — dan label bergeser diam-diam,
tanpa satu pun galat.

**I4 · Gambar tidak masuk ruang sidik mana pun.** Alasannya sama dengan
seluruh bahan ajar (docs/16 P1): `proyeksiIsi()`, `proyeksiIsiEn()`, dan
`rpkps_snapshot` tidak boleh mengenal satu pun tabel gambar.

**I5 · Ilustrasi raster AI selalu diberi keterangan.** Buku ini akan
didaftarkan ISBN dan beredar dengan nama dosen sebagai penulis. Gambar yang
dihasilkan model dicatat `sumber = AI_RASTER` dan tercetak keterangannya di
bawah gambar itu. Menyembunyikannya bukan pilihan yang boleh diambil aplikasi
atas nama penulis.

**I6 · Batas ukuran dan jumlah ditegakkan kode.** Berkasnya hidup di kolom
`bytea` Postgres yang jauh (AGENTS.md: satu perjalanan ~25 ms), jadi ukuran
bukan urusan estetika melainkan urusan waktu muat. Batasnya di §3.3.

**I7 · Label diagram memakai bahasa dan tipografi buku.** Buku berbahasa
Inggris tidak boleh punya diagram berlabel Indonesia, dan diagram bergaya
sendiri membuat halaman terlihat seperti tempelan.

---

## BAGIAN 3 — Model data

### 3.1 `GambarBab`

```prisma
enum SumberGambar {
  DIAGRAM_AI     // Mermaid/SVG tulisan model
  UNGGAHAN       // berkas dari dosen
  AI_RASTER      // model penghasil gambar; wajib berketerangan (I5)
}

enum BentukGambar {
  MERMAID
  SVG
  RASTER
}

model GambarBab {
  id     String @id @default(cuid())
  babId  String @map("bab_id")
  nomor  Int    // urutan dalam bab; nomor cetaknya "Gambar {bab}.{nomor}"

  judul    String   // keterangan gambar, tercetak di bawahnya
  altTeks  String?  @map("alt_teks")  // untuk pembaca layar dan ekspor daring

  sumber SumberGambar
  bentuk BentukGambar

  /// Sumber kebenaran diagram (I1): kode Mermaid atau berkas SVG yang SUDAH
  /// disanitasi. Kosong untuk gambar raster.
  kode String?

  /// Turunan untuk dicetak. PNG WAJIB: `docx` menerima SVG hanya bila disertai
  /// cadangan raster, dan PowerPoint sama saja.
  png       Bytes
  lebarPx   Int    @map("lebar_px")
  tinggiPx  Int    @map("tinggi_px")

  /// Judul subbab tempat gambar ini berada. Dicocokkan saat mencetak; yang
  /// tidak cocok jatuh ke akhir bab, tidak pernah hilang (§4.3).
  letak String?

  dibuatPada DateTime @default(now()) @map("dibuat_pada")
  diubahPada DateTime @updatedAt @map("diubah_pada")

  bab BabBukuAjar @relation(fields: [babId], references: [id], onDelete: Cascade)

  @@unique([babId, nomor])
  @@index([babId])
  @@map("gambar_bab")
}
```

`png` disimpan sebagai `Bytes`, bukan `String` base64: base64 membengkakkan
33% dan tidak pernah dibaca sebagai teks oleh siapa pun.

### 3.2 Yang sengaja TIDAK ada

- **Tidak ada kolom SVG hasil render Mermaid.** Mermaid dirender ulang dari
  kodenya saat disunting; yang dicetak tetap PNG. Menyimpan tiga bentuk untuk
  satu gambar berarti tiga hal yang harus dijaga tetap sejalan.
- **Tidak ada kolom `*En`.** Sama seperti seluruh bahan ajar (docs/16 P7):
  buku Inggris adalah buku kedua, beserta gambarnya sendiri.

### 3.3 Batas

| Batas | Nilai | Alasan |
|---|---|---|
| PNG per gambar | 2 MB | Baris `bytea` yang dibaca bersama bab |
| SVG/Mermaid | 200 KB | Diagram yang lebih besar dari ini bukan diagram |
| Gambar per bab | 12 | Melampauinya, yang dibuat bukan bab melainkan album |
| Sisi terpanjang PNG | 3000 px | 300 dpi pada lebar cetak B5 |
| Jenis unggahan | PNG, JPEG, SVG | Tidak ada GIF, tidak ada TIFF |

---

## BAGIAN 4 — Diagram dari AI

### 4.1 Tahap AI kelima

docs/16 §3 punya empat tahap. Ini yang kelima, `BUKU_DIAGRAM`, berjalan **per
bab** dan **setelah isi babnya ada** — sama seperti tahap slide, dan karena
alasan yang sama: diagram yang tidak menggambarkan apa pun dari babnya hanyalah
hiasan.

Keluarannya per gambar:

```
{ judul, alt, letak, bentuk: "MERMAID" | "SVG", kode }
```

- `letak` wajib salah satu judul subbab bab itu, disalin persis.
- `bentuk` dipilih model sendiri, dengan aturan di §4.2.
- 2–5 gambar per bab. Bab yang tidak menuntut gambar boleh mengembalikan
  daftar kosong, dan panduan menyebut itu terang-terangan — diagram yang
  dipaksakan lebih buruk daripada halaman tanpa gambar.

### 4.2 Kapan Mermaid, kapan SVG

Aturannya masuk panduan sebagai daftar tertutup, bukan sebagai selera:

| Pakai Mermaid bila | Pakai SVG bila |
|---|---|
| Bagan alur, keputusan bercabang | Struktur data berindeks (larik, tumpukan, antrean) |
| Diagram urutan (sequence) | Pohon dengan posisi yang bermakna |
| Diagram keadaan | Sumbu koordinat, grafik fungsi |
| ER, diagram kelas | Diagram blok berskala, skema teknis |
| Garis waktu, Gantt | Apa pun yang tata letaknya membawa arti |

Alasannya: tata letak Mermaid **dihitung mesin**, jadi label tidak pernah
bertumpuk — dan itu justru mustahil dijamin bila modelnya sendiri yang
menghitung koordinat. Sebaliknya, Mermaid tidak dapat menggambar hal yang
posisinya bermakna, dan memaksakannya menghasilkan graf yang menjelaskan lebih
sedikit daripada satu larik bernomor.

### 4.3 Cetakan gaya — inilah yang membuatnya tidak berbau AI

Panduan SVG memuat kontrak gaya yang ketat, dan `periksaSvg` di domain
menolak yang melanggarnya. Bukan saran, melainkan syarat:

- **Tanpa gradien, tanpa bayangan, tanpa transparansi.** `linearGradient`,
  `radialGradient`, `filter`, dan `opacity` di bawah 1 ditolak. Ketiganya
  adalah tanda tangan visual gambar bikinan mesin.
- **Satu ketebalan garis**: `stroke-width` 1.5, kecuali garis penekan 2.5.
- **Palet tertutup**: hitam `#111827` untuk garis dan teks, abu `#6B7280`
  untuk garis bantu, satu warna aksen `#1D4ED8`, isian hanya `#F3F4F6` atau
  putih. Tidak ada warna lain.
- **Tipografi buku**: `font-family="Times New Roman, Liberation Serif, serif"`,
  ukuran minimal 12, dan tidak ada teks yang diubah menjadi lintasan.
- **`viewBox` wajib**, lebar padanan 800 satuan, tanpa `width`/`height` tetap —
  supaya gambarnya menyesuaikan lebar cetak, bukan sebaliknya.
- **Teks adalah `<text>`**, tidak pernah `<foreignObject>`. Selain soal
  keamanan (§5), `foreignObject` tidak dirender sama sekali di dalam `<img>` —
  labelnya akan hilang tanpa satu pesan pun.

Aturan yang sama berlaku untuk Mermaid lewat berkas tema: `htmlLabels: false`
(alasan yang sama persis), `fontFamily` serif, dan palet yang sama.

### 4.4 Penempatan

Gambar dicetak setelah subbab yang disebut `letak`. Yang `letak`-nya tidak
cocok dengan satu pun judul subbab **jatuh ke akhir bab** dan ditandai di layar
— tidak pernah dibuang. Nomornya "Gambar {nomor bab}.{urutan}", dan diberikan
server berdasar urutan cetak, bukan oleh model.

---

## BAGIAN 5 — Keamanan SVG

Bagian ini pendek tetapi tidak boleh diringkas lebih jauh.

### 5.1 Sanitasi di server — `src/domain/bahan-ajar/svg-aman.ts`, murni

Daftar **putih**, bukan daftar hitam:

- Elemen: `svg g path rect circle ellipse line polyline polygon text tspan
  marker defs symbol use title desc`.
- Atribut: geometri, `fill`, `stroke`, `stroke-width`, `stroke-dasharray`,
  `font-family`, `font-size`, `text-anchor`, `transform`, `viewBox`, `class`,
  `id`.
- Ditolak seluruhnya: `script`, `foreignObject`, `image`, `animate`, `set`,
  `iframe`, `style` yang memuat `url(`, setiap atribut berawalan `on`, setiap
  `href`/`xlink:href` yang bukan `#fragmen`, dan setiap `data:`/`javascript:`.
- Entitas XML eksternal dan `<!DOCTYPE` ditolak mentah-mentah — itu jalur
  billion-laughs dan pembacaan berkas server.

Melanggar berarti **ditolak**, bukan dibersihkan diam-diam: diagram yang
separuh dibuang menghasilkan gambar yang salah, dan gambar yang salah di buku
ajar lebih buruk daripada tidak ada gambar. Yang ditolak dilaporkan sebagai
temuan berkode, dan dosen dapat meminta model menyusun ulang.

### 5.2 Render hanya di dalam `<img>`

Pratinjau dan rasterisasi memakai `<img src="data:image/svg+xml;base64,…">`.
Konsekuensi yang disengaja: skrip tidak berjalan, rujukan luar tidak diambil,
dan font halaman tidak ikut — karena itu §4.3 mewajibkan nama font generik,
bukan webfont.

`innerHTML`, `dangerouslySetInnerHTML`, dan `<svg>` sebaris DILARANG untuk isi
gambar mana pun. Penjaganya uji yang memindai berkas.

### 5.2b Kode Mermaid punya jalur eksekusinya sendiri

Ditemukan saat memasang IL2 dan TIDAK ada di rancangan awal ini. Yang disimpan
untuk diagram Mermaid adalah KODENYA, bukan SVG hasil rendernya — sehingga
hasil render itu tidak pernah melewati §5.1. Mermaid sendiri punya arahan yang
mengubah perilaku perendernya, dan seluruhnya berjalan di peramban dosen:

- `click` menautkan simpul ke alamat atau ke fungsi;
- `%%{init: …}%%` menyetel ulang konfigurasi, termasuk `securityLevel` dan
  `htmlLabels` — dua setelan yang justru menjadi penjaga kita;
- `style`/`classDef`/`linkStyle` memberi diagram warnanya sendiri. Yang ini
  bukan lubang keamanan melainkan pelanggaran cetakan gaya (I7).

Penjaganya `src/domain/bahan-ajar/mermaid-aman.ts`, dengan daftar jenis
diagram yang tertutup.

### 5.3 Unggahan dosen

Diperlakukan sama persis. SVG unggahan lewat sanitasi yang sama; PNG dan JPEG
diperiksa **angka ajaibnya**, bukan namanya — berkas bernama `.png` yang
isinya HTML adalah cara tertua menyelundupkan halaman ke dalam situs.

---

## BAGIAN 6 — Ilustrasi raster AI

Dirancang, dengan syarat yang disebut terang-terangan.

- **Hanya penyedia yang mendukung.** Dari tiga penyedia BYOK, hanya Gemini.
  Antarmuka `Penyedia` bertambah **`gambar?()` yang opsional**; adapter yang
  tidak mengimplementasikannya membuat tombolnya padam beserta kalimat
  alasannya. Tidak ada cadangan ke penyedia lain dan tidak ada kunci institusi
  — aturan `pakaiKredensial` tidak dilonggarkan sedikit pun untuk fitur ini.
- **Selalu berketerangan** (I5). Baris `sumber = AI_RASTER`, dan keterangan
  gambarnya tercetak dengan tambahan yang menyatakan asalnya. Halaman awal buku
  memuat satu paragraf pengungkapan bila ada satu saja gambar semacam ini.
- **Tidak untuk apa pun yang faktual.** Panduan melarangnya untuk diagram,
  grafik, peta, anatomi, skema alat, dan apa pun yang pembaca akan anggap
  sebagai keterangan teknis. Yang boleh: gambar suasana pembuka bab dan
  metafora visual. Model penghasil gambar tidak tahu apa-apa tentang alat yang
  digambarnya, dan buku ajar yang menggambarkan alat secara keliru mengajarkan
  hal yang keliru.
- **Tanpa SVG**, jadi tidak dapat disunting. Yang tersimpan hanya PNG-nya.

---

## BAGIAN 7 — Pencetakan

### 7.1 `.docx`

`ImageRun` bertipe `svg` dengan **cadangan PNG wajib** — itu bentuk yang
diterima `docx`, bukan pilihan kita. Word memakai SVG-nya bila mampu, dan
pembaca lama jatuh ke PNG.

Tiap gambar dicetak sebagai: gambar di tengah, lalu satu paragraf keterangan
bergaya `Caption` — "Gambar 3.2 Alur penelusuran pohon biner" — beserta
keterangan asal bila `AI_RASTER`.

Lebar gambar dihitung dari lebar cetak B5 dikurangi tepi, dan tingginya
mengikuti rasio PNG-nya. Gambar tidak pernah dilebarkan melebihi lebar cetak.

**Daftar Gambar** ikut dicetak sesudah daftar isi, dirakit dari baris `gambar_bab`
— nomor dan judulnya. Tanpa nomor halaman, dan itu disebutkan apa adanya:
nomor halaman baru ada setelah Word menata ulang seluruh dokumen, dan menebak
angka yang akan salah lebih buruk daripada tidak mencantumkannya.

### 7.2 `.pptx`

`addImage` dengan PNG-nya. Diagram bab ikut ke slide yang subbabnya sama; bila
tidak ketemu, ia menjadi slide tersendiri berjudul keterangan gambarnya.

### 7.3 Berkas untuk mahasiswa

`?kunci=0` tidak menyentuh gambar sama sekali. Gambar bukan kunci jawaban.

---

## BAGIAN 8 — Antarmuka

Di penyunting bab (`/bahan-ajar/[id]/bab/[nomor]`), satu bagian baru:

- Daftar gambar bab, masing-masing dengan pratinjau `<img>`, judul, letak, dan
  penanda sumbernya.
- **Susun diagram dengan AI** — memanggil tahap kelima untuk bab itu. Hasilnya
  ditampilkan sebagai pratinjau **sebelum disimpan**; dosen menyetujui, dan
  pada saat itulah peramban merasterkan PNG-nya dan mengirim keduanya.
- **Unggah gambar** — berkas dari dosen; PNG/JPEG dipakai apa adanya, SVG lewat
  sanitasi dan rasterisasi yang sama.
- **Sunting kode** — kotak teks berisi Mermaid atau SVG, dengan pratinjau yang
  diperbarui saat mengetik. Menyimpan berarti merasterkan ulang.
- Naik/turun mengubah urutan, dan nomor gambar ikut menyesuaikan.

Mermaid diimpor **dinamis, hanya di halaman ini**. Ia besar, dan tidak boleh
ikut ke berkas bundel setiap halaman aplikasi.

---

## BAGIAN 9 — Yang sengaja TIDAK dikerjakan

- **Tidak ada penyunting gambar visual.** Yang disunting adalah kodenya.
- **Tidak ada pencarian gambar dari internet.** Lisensi gambar bukan sesuatu
  yang boleh ditebak aplikasi atas nama penulis buku.
- **Tidak ada OCR maupun penelusuran ulang gambar unggahan.**
- **Tidak ada nomor halaman pada Daftar Gambar** (§7.1).
- **Tidak ada gambar pada RPKPS.** Ini fitur bahan ajar; ruang sidik RPKPS
  tidak tersentuh (I4).

---

## BAGIAN 10 — Uji

| Berkas | Yang dijaga |
|---|---|
| `src/domain/bahan-ajar/svg-aman.test.ts` | `script`, `onload`, `foreignObject`, `href` luar, `data:`, `<!DOCTYPE`, dan entitas eksternal DITOLAK; SVG yang sah lolos utuh |
| `src/domain/bahan-ajar/mermaid-aman.test.ts` | `click`, `%%{init}%%`, label HTML, dan `style`/`classDef` ditolak; panah `-->` dan `a < b` TIDAK disalahartikan sebagai HTML |
| `src/domain/bahan-ajar/keluaran-diagram.test.ts` | diagram yang tidak lolos DIBUANG, bukan ditambal; alasan berulang dilaporkan sekali; nomor tetap rapat |
| `src/lib/ai/skema-diagram.test.ts` | skema tidak punya satu pun medan piksel; panduan mengambil palet dan ambangnya DARI konstanta domain |
| `src/domain/bahan-ajar/gaya-svg.test.ts` | gradien, filter, dan warna di luar palet ditolak; garis 1.5 lolos |
| `src/domain/bahan-ajar/letak-gambar.test.ts` | penempatan setelah subbab; `letak` asing jatuh ke akhir bab, tidak hilang; penomoran "bab.urutan" |
| `src/lib/dokumen/buku-ajar-docx.test.ts` | berkas memuat bagian media; keterangan "Gambar 1.1" ada; Daftar Gambar memuat setiap gambar |
| `src/lib/dokumen/slide-pptx.test.ts` | PNG masuk sebagai media slide |
| uji pemindai sumber | tidak ada `innerHTML`/`dangerouslySetInnerHTML` pada komponen gambar (§5.2) |
| `proyeksi.test.ts` | tetap hijau — sidik dokumen tidak bergerak (I4) |

---

## BAGIAN 11 — Rencana pemasangan

| Tahap | Isi | Status |
|---|---|---|
| IL1 | Skema: `GambarBab`, dua enum, batas ukuran | ✅ |
| IL2 | Domain murni: `svg-aman.ts`, `mermaid-aman.ts`, `gaya-svg.ts`, `letak-gambar.ts`, `berkas-gambar.ts` beserta ujinya | ✅ |
| IL3 | Tahap AI kelima `BUKU_DIAGRAM` + panduan, cetakan gaya, dan `keluaran-diagram.ts` | ✅ |
| IL4 | Antarmuka: daftar gambar, pratinjau `<img>`, rasterisasi peramban, unggahan, penyunting kode, Mermaid dinamis | ✅ |
| IL5 | Cetak `.docx`: `ImageRun` svg+PNG, keterangan, Daftar Gambar | ✅ |
| IL6 | Cetak `.pptx` | ✅ |
| IL7 | Ilustrasi raster: `gambar?()` opsional pada `Penyedia`, adapter Gemini, pengungkapan asal | ✅ |

---

## BAGIAN 12 — Aturan yang perlu masuk `AGENTS.md`

> - **SVG adalah data tidak tepercaya, dan dirender hanya di dalam `<img>`.**
>   Ia dapat memuat `<script>`, `onload`, `<foreignObject>`, dan rujukan ke
>   alamat luar. Sanitasinya di `src/domain/bahan-ajar/svg-aman.ts` dengan
>   daftar PUTIH dan berjalan DI SERVER sebelum disimpan; peramban hanya
>   merender lewat `data:` URI di dalam `<img>`. `innerHTML` dan
>   `dangerouslySetInnerHTML` tidak boleh menyentuh isi gambar mana pun.
> - **Diagram disimpan sebagai kode; PNG hanyalah turunannya.** Yang boleh
>   dijadikan sumber kebenaran adalah Mermaid atau SVG. PNG wajib ada karena
>   `docx` menerima SVG hanya bila disertai cadangan raster — bukan karena ia
>   dokumennya.
> - **PNG dirasterkan di peramban saat dosen menyetujui.** Merasterkan di
>   server berarti memakai font server, yang tidak punya Times New Roman;
>   labelnya bergeser tanpa satu galat pun, dan yang tercetak bukan yang
>   dilihat dosen saat menyetujui.
> - **Mermaid dirender dengan `htmlLabels: false`.** Label `foreignObject`
>   tidak dirender sama sekali di dalam `<img>`; diagramnya akan tercetak
>   dengan kotak-kotak kosong tanpa satu pesan galat.
> - **Ilustrasi raster AI selalu berketerangan asal, dan tidak pernah dipakai
>   untuk apa pun yang faktual.** Model penghasil gambar tidak tahu apa-apa
>   tentang alat yang digambarnya. Ia juga hanya tersedia pada penyedia yang
>   mendukung — `gambar?()` bersifat opsional pada antarmuka `Penyedia`, dan
>   ketiadaannya tidak boleh menjadi alasan jatuh ke penyedia atau kunci lain.
