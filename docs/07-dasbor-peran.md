# Dasbor Berbasis Peran

Status: **D1–D3 terpasang.** Acuan silang: doc 03 (beban belajar), doc 04
(usulan revisi), doc 05 (evaluasi ketercapaian).

## 1. Masalah yang diselesaikan

Sebelum ini `/dashboard` menampilkan tiga angka master data yang sama untuk
semua orang. Angka itu benar, tetapi tidak menjawab pertanyaan yang dibawa
seseorang saat membuka aplikasi. Pertanyaannya berbeda menurut kursi yang
diduduki:

| Peran | Pertanyaan pertama saat membuka aplikasi |
|---|---|
| Dosen / Koordinator MK | Apa yang menunggu saya? RPKPS mana yang belum lengkap, kelas mana yang nilainya belum masuk? |
| Kaprodi | Ada berapa usulan dan RPKPS menunggu keputusan saya? CPL mana yang belum tercapai di prodi saya? |
| Penjaminan Mutu (GPM) | Prodi mana yang tertinggal? Berapa cakupan evaluasi institusi? Temuan mana yang belum diverifikasi? |
| Admin | Siapa yang menunggu verifikasi? Apakah master data siap dipakai? |
| Asesor | Mana dokumen yang sah, dan apa buktinya? |
| Mahasiswa | Di mana RPKPS mata kuliah saya? |

Dasbor karena itu **bukan satu halaman dengan filter**, melainkan susunan
panel yang dipilih menurut peran yang dipegang akun.

## 2. Aturan yang mengikat

1. **Dasbor hanya membaca.** Tidak ada aksi yang mengubah data di dasbor;
   setiap kartu adalah pintu ke halaman modul yang berwenang. Ini menjaga
   otorisasi tetap berada di satu tempat (`aksi.ts` tiap modul).
2. **Cakupan prodi ditegakkan, bukan disaring di tampilan.** Semua kueri lewat
   `cakupanProdi(sesi)`. Peran bercakupan institusi (ADMIN/GPM/ASESOR)
   mendapat `null` = semua prodi.
3. **Peran majemuk menumpuk, bukan bertanding.** Seorang Kaprodi yang juga
   mengampu mata kuliah melihat panel prodi *dan* panel dosen. Tidak ada
   "peran tertinggi" yang menelan peran lain — itu justru menyembunyikan
   pekerjaan yang bersangkutan.
4. **Hanya evaluasi berstatus `DITUTUP` yang dihitung** (doc 05 §5.5). Angka
   dari evaluasi setengah jalan lebih berbahaya daripada kolom kosong.
5. **Dasbor tidak menghitung ulang apa pun.** Capaian datang dari
   `agregasiProdi`, bobot dari `susunPetaAsesmen`, beban dari kalkulator.
   Tidak ada rumus baru di lapisan dasbor — kalau angkanya berbeda dari
   halaman modul, salah satunya berbohong.
6. **Bagan digambar di server sebagai SVG.** Tanpa pustaka grafik, tanpa
   JavaScript klien. Alasannya bukan ukuran berkas semata: dasbor ini sering
   dibuka di jaringan kampus dan dicetak untuk rapat mutu.

## 3. Susunan halaman

```
┌ Sapaan ───────────────────────────────────────────────┐
│ nama · tahun akademik aktif · peran                   │
├ Antrian kerja ────────────────────────────────────────┤
│ butir yang menunggu TINDAKAN pengguna ini, terurut    │
│ menurut kegentingan. Kosong = tidak ditampilkan.      │
├ Panel menurut peran (bertumpuk) ──────────────────────┤
│ Kaprodi → Mutu → Dosen → Admin → Asesor → Mahasiswa   │
└───────────────────────────────────────────────────────┘
```

### 3.1 Antrian kerja (D1)

Satu daftar gabungan dari beberapa sumber, masing-masing hanya muncul bila
pengguna berwenang menindaknya:

| Sumber | Syarat peran | Kegentingan |
|---|---|---|
| Usulan revisi `DIAJUKAN` | KAPRODI/ADMIN di prodi itu | tinggi |
| RPKPS `DIAJUKAN` | KAPRODI/GPM/ADMIN di prodi itu | tinggi |
| RPKPS `DIREVISI` yang saya ampu | pengampu | tinggi |
| Pengguna `MENUNGGU_VERIFIKASI` | ADMIN | sedang |
| Temuan evaluasi `BELUM` diverifikasi yang saya tanggung | penanggung jawab | sedang |
| Kelas dengan nilai lengkap tetapi evaluasi belum ditutup | pengampu RPKPS-nya | sedang |
| Kebijakan beban belajar masih `DRAF` | ADMIN/GPM | tinggi |
| RPKPS `DRAF` yang saya ampu | pengampu | rendah |

Kegentingan menentukan urutan dan warna, bukan sekadar hiasan: warna
`destructive` hanya untuk hal yang menghambat orang lain.

### 3.2 Panel Kaprodi (D2)

* **Corong RPKPS** — batang tumpuk Draf → Diajukan → Terbit untuk tahun
  akademik aktif, ditambah hitungan mata kuliah yang belum punya RPKPS sama
  sekali. Corong ini menjawab "seberapa jauh prodi saya dari siap".
* **Capaian CPL** — batang mendatar per CPL dengan penanda ambang 85%.
  Sumber: `agregasiProdi`. CPL tanpa data digambar sebagai batang kosong
  bertanda — bukan 0%, karena keduanya berbeda arti.
* **Tren antar tahun akademik** — garis persen lulus per CPL.
* **Sebaran kelas paralel** — tiga selisih terbesar; rencana sama, hasil jauh
  berbeda menunjuk pelaksanaan (doc 05 §4.1b).

### 3.3 Panel Penjaminan Mutu (D2)

Sama seperti Kaprodi tetapi lintas prodi, dan pertanyaannya bukan "apa yang
kurang" melainkan "siapa yang tertinggal":

* Cincin cakupan evaluasi institusi (MK dievaluasi / MK kurikulum).
* Tabel prodi × (RPKPS terbit, cakupan evaluasi, CPL tercapai) dengan batang
  mini di tiap sel supaya perbandingan terbaca tanpa membaca angka.
* Temuan PPEPP terbuka, dikelompokkan menurut status verifikasi.

### 3.4 Panel Dosen / Koordinator MK (D2)

* **RPKPS saya** — daftar dengan batang kelengkapan (pertemuan terisi,
  komponen nilai, tugas, kisi-kisi) dan status.
* **Monitoring kelas** — tahap tiap kelas: `Tanpa peserta` → `Nilai sebagian`
  → `Siap dihitung` → `Dihitung` → `Ditutup`. Tahap dihitung dari kelengkapan
  `NilaiAsesmen` terhadap peta asesmen, bukan dari tanggal.
* **Temuan yang saya tanggung** dengan tahun akademik sasarannya.

### 3.5 Panel Admin (D3)

* Kartu master data: prodi aktif, tahun akademik aktif, kebijakan beban
  belajar, pengguna menunggu verifikasi.
* **Sebaran peran** — batang jumlah pengguna per peran; celah di sini
  (mis. prodi tanpa Kaprodi) adalah temuan.
* **Denyut aktivitas** — batang harian 14 hari terakhir dari `log_audit`.

### 3.6 Panel Asesor (D3)

Hanya angka yang dapat dipertanggungjawabkan: dokumen `TERBIT` beserta jumlah
snapshot bersidik, evaluasi `DITUTUP` beserta snapshotnya, dan tautan ke
katalog publik. Asesor tidak melihat draf.

### 3.7 Panel Mahasiswa (D3)

Tautan ke katalog publik prodi dan jumlah RPKPS terbit. Tidak lebih — tidak
ada data nilai perorangan di aplikasi ini yang tertaut ke akun mahasiswa.

## 4. Pembagian berkas

| Berkas | Isi |
|---|---|
| `src/domain/dasbor/ringkasan.ts` | murni: sebaran status, tahap kelas, denyut harian, persen |
| `src/domain/dasbor/antrian.ts` | murni: penyusunan dan pengurutan antrian kerja |
| `src/lib/dasbor/muat.ts` | kueri Prisma per panel, menegakkan cakupan prodi |
| `src/components/bagan/*` | bagan SVG server: batang, tumpuk, garis, cincin, kisi panas |
| `src/app/(app)/dashboard/panel-*.tsx` | perakitan tampilan tiap peran |

Domain tetap bebas Prisma dan React supaya dapat diuji `node --test`.
