# Impor RPKPS dari Template

> Status: **TERPASANG (21 September 2026). T1–T6 selesai.** Tiga keputusan Bagian 6
> disetujui sesuai usulan. Yang menyimpang dari rancangan awal ditandai
> **[Berubah]** dan dijelaskan di tempatnya; Bagian 8 merangkumnya.
> Menjawab permintaan: *"RPKPS tidak hanya dibantu AI, tetapi juga bisa diimpor
> dari template. Pastikan proses submitnya divalidasi."*

## BAGIAN 1 — Masalah

Hari ini ada dua jalan mengisi isi RPKPS: **draf AI** (`susunDrafRpkps` →
`terapkanDrafRpkps`, docs/12) dan **penyuntingan manual** baris demi baris
(docs/09). Dosen yang sudah punya bahan — RPKPS tahun lalu di Excel, rancangan
yang disusun bersama tim — tidak punya jalan ketiga: mengetik ulang 14 minggu,
tugas, dan kisi-kisi lewat formulir, atau membayar token AI untuk sesuatu yang
sudah ia tulis sendiri.

Kurikulum sudah punya jalan ini (`/kurikulum/impor`: pratinjau → validasi →
simpan). RPKPS belum.

## BAGIAN 2 — Prinsip

**T1 · Satu gerbang, satu pintu tulis.** Impor tidak punya aturan sendiri.
Berkas dibaca menjadi `DrafRpkps` — bentuk yang sama dengan keluaran AI —
diperiksa `periksaDraf()` yang sama, dan ditulis oleh inti penulisan yang sama
dengan `terapkanDrafRpkps`. Aturan komponen nilai, identitas baris
`komponen_nilai` (`rencanakanKomponen`), penguncian `bolehSuntingIsi`, dan
riwayat tidak disalin ke jalur kedua. Menyalinnya berarti dua pintu yang lambat
laun berbeda aturan.

**T2 · Angka dosen tidak ditambal diam-diam.** Ini pembeda terpenting dari draf
AI. `alokasikanAsesmen` ada karena model lalai; berkas dosen adalah sumber
kebenaran, dan menormalkan bobotnya ke 100 tanpa bertanya berarti server
mengarang keputusan penilaian. Impor **tidak menjalankan** rekonsiliasi:
bobot yang tidak pas 100 menjadi temuan berlokasi (lembar + baris), dan dosen
yang memperbaikinya.

**T3 · Berkas tidak dipercaya, dan pratinjau bukan otorisasi.** Sama dengan
docs/04 §9.9 dan draf AI: hasil pratinjau yang dikirim balik peramban diperiksa
ULANG di server terhadap keadaan RPKPS saat itu.

**T4 · Impor tidak menyentuh kerangka.** Nomor minggu, jenis pertemuan
(EFEKTIF/UTS/UAS), menit TM/PT/BM, dan jadwal Sub-CPMK per minggu berasal dari
kurikulum dan kebijakan beban belajar (docs/03). Kolom-kolomnya ada di template
sebagai rujukan **terkunci**; nilai yang berbeda dari kerangka menjadi temuan,
bukan penulisan.

## BAGIAN 3 — Rancangan

### 3.1 Format: `.xlsx`, dibuat dari RPKPS itu sendiri

`exceljs` sudah dipakai untuk impor kurikulum, pengguna, dan nilai, dengan
pembaca yang mencocokkan kolom lewat **teks judul**, bukan posisi
(`bacaLembar`). Impor RPKPS memakai pola itu.

Templat diunduh dari **RPKPS yang bersangkutan** — bukan berkas kosong
generik — sehingga:

- kolom terkunci (minggu, jenis, Sub-CPMK terjadwal, kode Sub-CPMK yang boleh
  dirujuk) sudah benar dan tidak perlu diketik;
- isi yang **sudah ada** di dokumen ikut terunduh, jadi alurnya bisa
  *unduh → lengkapi → unggah* (perjalanan pulang-pergi), bukan hanya dokumen
  kosong;
- lembar rujukan memuat daftar Sub-CPMK, level Bloom, bentuk soal, dan jenis
  tugas yang sah, dengan validasi data (dropdown) pada selnya.

Lembar (pengenal tetap bahasa Indonesia — aturan pengenal berkas Excel di
AGENTS.md; hanya lembar Petunjuk yang diterjemahkan):

| Lembar | Isi | Menulis ke |
|---|---|---|
| Petunjuk | cap berkas: kode MK, id RPKPS, tahun akademik | tidak ditulis |
| Identitas | deskripsi, kalimat pembuka CPMK | `Rpkps` |
| Mingguan | topik, subtopik, metode, aktivitas dosen/mhs, tugas terstruktur, penilaian, **bobot, komponen**, indikator, rujukan pustaka | `Pertemuan` |
| Komponen Nilai | nama, bobot | `KomponenNilai` |
| Ujian | bobot + komponen baris UTS/UAS | `Pertemuan` (bobot & komponen saja) |
| Tugas · Kriteria | lembar tugas dan rubriknya | `Tugas`, `KriteriaTugas` |
| Kisi-kisi | butir UTS/UAS: Sub-CPMK, Bloom, bentuk, skor | `KisiKisi`, `ButirKisiKisi` |
| Pustaka | pustaka **baru**; baris yang sudah ada tampil terkunci | `Pustaka` |

Kolom `*En`, `arahanAi`, dan identitas prodi **tidak ada** di template: yang
pertama bukan bagian impor (terjemahan tetap lewat docs/11), sisanya bukan isi
dokumen (AGENTS.md — di luar `proyeksiIsi()`).

### 3.2 Empat lapis validasi

Inilah jawaban atas "pastikan proses submitnya divalidasi". Berurutan; lapis
yang lebih awal murah dan menolak lebih dulu.

**Lapis 1 — Berkas.** Server, sebelum apa pun dibaca:
`.xlsx`, ≤ 3 MB **[Berubah dari 5 MB: batas badan Server Action aplikasi ini 4 MB
(`next.config.ts`), dan berkas di atasnya gagal sebagai galat jaringan tanpa
sebab]**, bita ajaib ZIP (`PK\x03\x04`) — nama berkas dan `File.type` datang dari
peramban dan dapat dikarang — **ukuran terurai dari direktori pusat ZIP** (berkas
kecil dapat membuka menjadi gigabita; direktori pusat dibaca tanpa membuka satu
entri pun), maksimum 500 baris per lembar, dan **cap Petunjuk**
harus cocok dengan RPKPS ini. Berkas mata kuliah lain ditolak dengan kalimat
jelas, bukan ditulis ke dokumen yang salah. (Cap bukan tanda tangan; ia
mencegah salah unggah, bukan pemalsuan — pemalsuan tidak menang apa pun karena
lapis 3 dan 4 tetap berlaku.)

**Lapis 2 — Sel menjadi nilai.** Pembacaan longgar: kesalahan pengisian menjadi
**temuan berlokasi** `{ lembar, baris, kolom, kode }`, bukan galat yang
menggagalkan seluruh berkas (pola `GalatBaris` di `domain/kurikulum/berkas.ts`).
Meliputi angka berkoma Indonesia ("12,5"), sel rumus (dibaca hasilnya, bukan
rumusnya), enum tidak dikenal, dan batas panjang tiap medan (Excel tidak
membatasi sel; basis data dan .docx berkepentingan). Karakter kendali dibuang.
Larik (`subtopik`, `indikator`) dipisah per baris sel.

**Lapis 3 — Domain: `periksaDraf()`.** Sama persis dengan draf AI — total bobot
mingguan dan komponen 100%, tiap komponen cocok dengan barisnya, tiap Sub-CPMK
terukur, pustaka tidak karangan, kisi-kisi total 100, dan seterusnya. Tidak ada
kode temuan baru untuk aturan yang sama; hanya kode lapis 1–2 yang baru, dan
semuanya berupa **kode + parameter**, kalimatnya di kamus antarmuka
(`rpkps.impor.temuan` pada `id.ts`/`en.ts`, berkunci kode) dan dirakit
saat dibaca, dalam bahasa pembacanya (docs/11 §4.1). Bukan di
`temuan-id.ts`: kamus itu milik validator dokumen, dan penjaganya
(`temuan.test.ts`) memindai `src/domain` untuk kode bertanda `tingkat:`. Catatan:
`periksaDraf` sendiri masih memuat kalimat Indonesia di `pesan`; impor memakainya apa
adanya seperti draf AI — menyusulkan kode+params untuk `periksaDraf` adalah
pekerjaan terpisah, tidak diseret ke sini.

**Lapis 4 — Wewenang dan keadaan, di aksi terapkan.** `wenangRpkps` +
`bolehSuntingIsi` (DRAF/DIREVISI saja), lalu seluruh analisis **diulang** — dan
**[Berubah]** yang diulang adalah *berkasnya*, bukan draf hasil pratinjau:
penerapan menerima berkas yang sama sekali lagi dan membacanya dari awal.
Draf yang dikirim balik peramban dapat dikarang (dan tipenya tidak dapat
dijamin), sedangkan berkas yang dibaca ulang tidak dapat menghasilkan sesuatu
yang berbeda dari yang diperiksa. Harganya satu unggahan lagi, puluhan
kilobita. Ditambah **cap versi**: penerapan menulis ulang seluruh
`pertemuan`, `tugas`, dan `kisi_kisi`, jadi ia wajib membawa cap
`diubahPada` yang dibaca saat pratinjau (`kunci-optimistik.ts`, aturan
mengikat di AGENTS.md). Bila rekan setim menyunting di sela pratinjau dan
terapkan, impor ditolak dengan pesan "dokumen berubah sejak pratinjau" —
tidak menimpa diam-diam. Cap dibandingkan lagi **di dalam transaksi** penulisan.
Jendela antara pembacaan itu dan penulisan tidak nol (penyunting lain menulis ke
baris yang berbeda dan tidak menunggu kita), tetapi berukuran milidetik, bukan
menit seperti jarak pratinjau ke persetujuan. Cap mencakup seluruh himpunan
baris `pertemuan`/`tugas`/`kisi_kisi`, daftar komponen, dan jumlah pustaka —
baris yang ditambah atau dihapus pun menggesernya. Pratinjau dan penerapan juga
dibatasi laju per pengguna (`lajuImporTemplat`, 20/menit): membuka ZIP dan
mem-parse Excel memakai CPU server.

**Tombol Terapkan mati selama ada satu temuan.** Sama dengan draf AI.
Pertanyaan terbuka §6.2 menyangkut apakah aturan ini terlalu keras untuk berkas
setengah jadi.

### 3.3 Pratinjau sebelum menimpa

Halaman pratinjau menampilkan, sebelum persetujuan:

- temuan diurutkan menurut lembar dan baris, dapat disaring per lembar;
- **apa yang akan ditimpa**: "12 dari 14 minggu sudah berisi dan akan diganti;
  3 tugas dan 2 kisi-kisi akan diganti seluruhnya" — dosen berhak tahu bahwa
  kerja manualnya akan tertimpa;
- ringkasan yang sama dengan `ringkasDraf()` (jumlah pertemuan, indikator,
  tugas, butir, komponen, bobot).

Pratinjau **tidak menulis apa pun**, dan tidak menyimpan berkas: yang bertahan
hanya hasil parse di peramban, diperiksa ulang saat terapkan.

### 3.4 Penulisan: ekstrak inti dari `terapkanDrafRpkps`

Isi transaksi `terapkanDrafRpkps` diekstrak ke `src/lib/rpkps/tulis-draf.ts`
(`selesaikanRujukan` sebelum transaksi, `tulisDraf` di dalamnya), dengan dua
parameter yang berbeda antar pemanggil: **jenis riwayat** (`DRAF_AI_DITERAPKAN` / `IMPOR_TEMPLAT_DITERAPKAN`)
dan **`sumber`** pada baris yang ditulis. Untuk `sumber`: isi dari berkas
adalah tulisan dosen, bukan model, jadi baris **tidak** ditandai `AI`
(`SumberIsi` tidak diberi nilai `IMPOR`; migrasi enum untuk satu lencana tidak
sepadan, dan lencana "AI" yang salah pasang menyesatkan pemeriksa).

Jejak: `rpkps_riwayat` lewat `barisRiwayat` (kunci + params, docs/11 §4.2c) dan
`log_audit` `RPKPS_IMPOR_DITERAPKAN` dengan **nama berkas dan SHA-256 berkas**,
bukan isinya.

### 3.5 Yang diperbaiki sekalian — terbukti, bukan dugaan

Jalur lama `terapkanDrafRpkps` menghapus seluruh `tugas` dan `kisi_kisi` lalu
membuatnya ulang, dan menghapus-buat-ulang `indikator`. Akibat nyata, semuanya
tanpa satu pesan pun dan semuanya kini tertutup **[Berubah: cakupannya lebih
luas daripada dugaan awal]**:

- `tugas.namaEn`, `kriteria_tugas.*En`, dan `indikator.teksEn` — terjemahan —
  lenyap (dilarang aturan "penyimpanan yang menulis ulang baris wajib membawa
  medan `*En`");
- `linimasa_tugas` ikut terhapus lewat cascade;
- **`nilai_butir` — skor mahasiswa — ikut terhapus lewat cascade** saat
  kisi-kisi diganti, pada dokumen DIREVISI yang kelasnya sudah bernilai.

`tulisDraf` menulis **di tempat**: tugas dicocokkan menurut `nomor`, kriteria
menurut `nomor`, indikator menurut urutan, kisi-kisi menurut `jenis`, butir
menurut `nomor`; yang tidak disebut draf dihapus, kolom `*En` dibiarkan. Butir
yang akan hilang dan sudah punya skor mahasiswa **menolak seluruh penulisan**
(`GalatTulis NILAI_TERTAUT`, transaksi dibatalkan) — bukan menghapus skornya.
Baris ujian pada kerangka yang tidak disebut draf dinolkan bobotnya: draf sudah
diperiksa berjumlah 100 TANPA baris itu, jadi bobot lamanya tidak boleh
tertinggal. Keduanya berlaku juga untuk draf AI. Terbukti terhadap Postgres
sungguhan di `uji/integrasi.ts` §17.

## BAGIAN 4 — Yang sengaja tidak dikerjakan

- **Tidak membaca `.docx` Template ITTS.** Tabel Word dengan sel gabungan dan
  format bebas rapuh dibaca mesin, dan salah baca yang senyap lebih buruk
  daripada tidak ada fitur. Bila dibutuhkan, jalurnya: dosen mengunggah `.docx`,
  **AI memetakannya ke `DrafRpkps`**, dan hasilnya melewati gerbang yang sama —
  mesin nol tetap sama, hanya penulisnya berbeda. Itu fitur tersendiri.
- **Tidak menormalkan bobot** (T2).
- **Tidak menyimpan berkas unggahan** dan tidak ada halaman publik/tautan untuk
  templat; templat hanya dapat diunduh oleh pengguna yang berwenang atas RPKPS
  itu.
- **Tidak mengimpor ke RPKPS berstatus DIAJUKAN ke atas.** Rantai pengesahan
  (docs/14) menandatangani sidik isi; `bolehSuntingIsi` sudah menutup ini dan
  tidak dilonggarkan.
- **Tidak mengubah Sub-CPMK, CPMK, atau CPL** (T4; docs/04, docs/15).

## BAGIAN 5 — Berkas dan tahap

| Tahap | Isi |
|---|---|
| **T1** | `src/domain/rpkps/templat.ts` (murni): skema berkas, `periksaBerkas`/`periksaIsiZip`/`periksaCap`, `rakitTemplat` (sel → `DrafRpkps` + `periksaDraf`), pemetaan lokasi temuan. `cap-isi.ts` (sidik cap versi) **terpisah** karena `templat.ts` diimpor komponen klien dan sidik memakai `node:crypto`. Uji: `templat.test.ts`, `cap-isi.test.ts`. |
| **T2** | `src/lib/rpkps/templat-excel.ts`: penulis (template terisi dari RPKPS, dengan daftar pilihan dan lembar Rujukan) dan pembaca (cocok judul; sel persen dan rumus ditangani). Tanpa `server-only` agar dapat diuji **pulang-pergi**: `templat-excel.test.ts`. |
| **T3** | `src/lib/rpkps/tulis-draf.ts` (inti penulisan bersama, di tempat), `konteks-draf.ts`, `pesan-tulis.ts`; `aksi-draf.ts` memakainya. Uji integrasi §17. |
| **T4** | `aksi-impor.ts` (`periksaImporTemplat`, `terapkanImporTemplat`), rute `GET /api/rpkps/[id]/templat`, `impor-templat.ts` (`analisisBerkas`), `cap-isi.ts` (lib), `lajuImporTemplat`, kunci riwayat `IMPOR_TEMPLAT_DITERAPKAN`, audit `RPKPS_IMPOR_DITERAPKAN`. |
| **T5** | `panel-impor.tsx` di halaman RPKPS di bawah `PanelDraf`; kamus `rpkps.impor`, `aksi.impor`, `riwayat` di `id.ts` dan `en.ts`. |
| **T6** | Uji integrasi §17, entri `AGENTS.md`, daftar docs. |

## BAGIAN 6 — Keputusan (ditetapkan 21 September 2026)

1. **Format:** `.xlsx`. `.docx` tetap di luar cakupan (§4).
2. **Ketat:** satu temuan menahan penerapan, sama dengan draf AI.
3. **Menimpa:** berkas menggantikan isi, dengan pratinjau "yang akan diganti"
   (§3.3).

## BAGIAN 7 — Aturan yang perlu masuk `AGENTS.md`

> **Impor template dan draf AI berbagi satu gerbang dan satu pintu tulis.**
> Berkas template dibaca menjadi `DrafRpkps`, diperiksa `periksaDraf()`, dan
> ditulis inti penulisan yang sama dengan `terapkanDrafRpkps`; jangan membuat
> jalur tulis kedua. Impor **tidak** menjalankan `alokasikanAsesmen`: angka dari
> dosen tidak ditambal server, hanya dilaporkan. Berkas dan hasil pratinjau tidak
> dipercaya — `periksaDraf`, `bolehSuntingIsi`, dan cap versi diulang saat
> terapkan.

## BAGIAN 8 — Yang menyimpang dari rancangan awal

| Rancangan | Terpasang | Sebabnya |
|---|---|---|
| Batas 5 MB | 3 MB | Batas badan Server Action 4 MB. |
| Penerapan memeriksa ulang draf kiriman peramban | Penerapan membaca ulang **berkasnya** | Draf kiriman tidak dapat dijamin bentuknya; berkas tidak dapat menghasilkan hal lain daripada yang diperiksa. |
| Empat lapis | Lapis 1 ditambah pemeriksaan ukuran terurai ZIP dan pembatas laju | Berkas kecil dapat membengkak; parse Excel memakai CPU. |
| §3.5 "diverifikasi bila terbukti" | Terbukti, dan lebih luas: indikator, linimasa, dan **skor mahasiswa** ikut hilang pada jalur lama | Diketahui saat menyusun uji integrasi; ditutup lewat penulisan di tempat. |
| — | Baris ujian yang tak disebut berkas dinolkan | Draf diperiksa berjumlah 100 tanpa baris itu. |
| — | Kolom persen Excel (0,3 = 30%) dikalikan 100 saat dibaca | Bobot 30% tanpa ini terbaca 0,3 dan lolos sebagai angka sah. |

## BAGIAN 9 — Yang belum dikerjakan

- **Tidak ada uji peramban** pada `panel-impor.tsx`: dokumen ini diperiksa dengan
  `tsc`, ESLint, `next build`, dan uji domain/pulang-pergi/integrasi. Antarmuka
  belum pernah dijalankan dengan sesi sungguhan.
- **Terjemahan tidak ikut diperbarui.** Bila dosen mengubah teks Indonesia lewat
  berkas, kolom `*En` yang ada dibiarkan (tidak dihapus, tidak diterjemahkan
  ulang). Panel Terjemahan tetap jalan untuk menyusulkannya.
- **`periksaDraf` masih memuat kalimat Indonesia di `pesan`** (§3.2 lapis 3).
