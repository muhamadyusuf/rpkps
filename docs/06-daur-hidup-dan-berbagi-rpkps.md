# Daur Hidup dan Berbagi RPKPS

> Status: **B1–B5 TERPASANG (B1–B4 24 Agustus 2026; B5 4 September 2026).**
> Amandemen §4.3 DITERIMA: sejak B5 ada dua pintu tanpa login, dan keduanya
> tertutup rapat pada berkasnya masing-masing.
> Menjawab tiga permintaan yang sering diucapkan sebagai satu: *menghapus RPKPS*,
> *mengirimkannya pada dosen lain*, dan *"fitur share lainnya"*.
> Ketiganya sebenarnya **enam operasi berbeda** dengan risiko yang jauh berbeda.
> Bagian 6 memuat keputusan yang perlu ditetapkan sebelum kode ditulis.

## BAGIAN 1 — Enam operasi yang tersembunyi di balik tiga kata

"Hapus", "kirim", dan "bagikan" adalah kata sehari-hari yang di dalam aplikasi ini
memetakan ke operasi dengan akibat yang tidak sebanding. Memberi mereka satu tombol
yang sama adalah cara tercepat melenyapkan bukti akreditasi.

| # | Operasi | Yang sebenarnya diminta dosen | Akibat terberat bila salah |
|---|---|---|---|
| **H** | **Hapus** | "Saya salah pilih mata kuliah / tahun akademik" | Nilai, evaluasi capaian, dan salinan beku ikut lenyap lewat cascade |
| **A** | **Arsipkan** | "MK ini tidak dibuka semester ini" | Halaman publik hilang, padahal dokumennya sah |
| **P** | **Tambah pengampu** | "Rekan saya ikut menyusun" | Dokumen prodi lain tersunting orang luar |
| **S** | **Serah terima koordinator** | "Mulai semester ini yang pegang Pak/Bu X" | Penanggung jawab dokumen terbit jadi kabur |
| **D** | **Salin (duplikat)** | "Pakai punya tahun lalu" / "kirimkan punyamu ke saya" | Sub-CPMK milik MK lain menempel ke pertemuan |
| **B** | **Bagikan tautan** | "Kirim ke mitra industri / asesor untuk dibaca" | Draf yang belum disahkan beredar sebagai dokumen resmi |

Perhatikan bahwa **tidak satu pun dari keenamnya adalah "kirim lewat surel"**.
Aplikasi ini belum punya lapisan surel, dan menambahkannya untuk keperluan ini
adalah jalan memutar: yang dibutuhkan dosen penerima adalah **akses**, bukan
lampiran. Lampiran DOCX sudah tersedia lewat `/api/rpkps/[id]/docx` dan dapat
dikirim dosen sendiri lewat surel kampus.

## BAGIAN 2 — Menghapus RPKPS

### 2.1 Apa yang sebenarnya ikut terhapus

`Rpkps` adalah akar sebuah pohon cascade yang lebar. Satu `prisma.rpkps.delete()`
melenyapkan, tanpa jejak dan tanpa pemulihan:

```
rpkps
├── pertemuan            → aktivitas_belajar, indikator,
│                          pertemuan_sub_cpmk, pertemuan_pustaka
├── pustaka, komponen_nilai
├── tugas                → kriteria_tugas, linimasa_tugas, tugas_sub_cpmk
├── kisi_kisi            → butir_kisi_kisi
├── rpkps_riwayat        ← seluruh jejak pengesahan
├── rpkps_snapshot       ← SALINAN BEKU + sidik SHA-256
└── kelas                → peserta_kelas → nilai
                         → evaluasi_mk  → hasil_capaian, temuan_evaluasi,
                                          evaluasi_snapshot
```

Dua cabang terakhir yang menentukan. `rpkps_snapshot` adalah satu-satunya bukti
bahwa dokumen pernah disahkan dengan isi tertentu — menghapusnya membuat halaman
katalog publik menjadi 404 dan sidik SHA-256 yang sudah tercetak di berkas DOCX
tidak lagi dapat diverifikasi. Cabang `kelas` memuat **nilai mahasiswa dan temuan
PPEPP** — persis berkas yang diminta asesor.

Preseden di dalam kode sudah ada: `hapusKelas` di
`src/app/(app)/rpkps/[id]/kelas/aksi.ts` menolak menghapus kelas yang sudah memuat
nilai, dengan alasan yang sama. Aturan di bawah hanya menaikkan preseden itu satu
tingkat.

### 2.2 Aturan H1 — hanya RPKPS tanpa akibat yang boleh dihapus

Penghapusan sejati **hanya** untuk RPKPS yang belum pernah berakibat apa pun.
Empat syarat, **ditegakkan kode**, bukan oleh centang "saya paham risikonya":

| Syarat | Alasan |
|---|---|
| `status ∈ {DRAF, DIREVISI}` | Dokumen yang diajukan sedang ditunggu Kaprodi; yang terbit sudah menjadi rujukan |
| `rpkps_snapshot` kosong | Tidak pernah ada salinan beku ⇒ tidak pernah ada halaman publik, tidak pernah ada sidik yang dicetak |
| Tidak ada `kelas` yang memuat peserta, nilai, atau `evaluasi_mk` | Bukti pelaksanaan tidak boleh lenyap. Kelas kosong ikut terhapus |
| Peminta = KOORDINATOR pengampu, atau ADMIN/KAPRODI dalam cakupan prodi | Anggota tim tidak boleh menghapus dokumen tim |

Pesan penolakan harus **menyebut angkanya** — "sudah memuat 34 nilai dan 1 evaluasi
tertutup", bukan "tidak dapat dihapus" — mengikuti gaya pesan `hapusKelas`.

### 2.3 Aturan H2 — selebihnya diarsipkan, tidak dihapus

Nilai enum `ARSIP` sudah ada pada `StatusRpkps` sejak awal dan **belum pernah
dipakai**. Di sinilah tempatnya. Mengarsipkan berarti:

- dokumen hilang dari daftar kerja `/rpkps` (tersedia lewat saringan "Arsip");
- seluruh baris, snapshot, nilai, dan evaluasi **tetap utuh**;
- slot `(mataKuliahId, tahunAkademikId)` **tetap terpakai** — lihat 2.4;
- tercatat di `rpkps_riwayat` dengan alasan wajib, minimal seperti catatan revisi.

Arsip **bukan** cara memensiunkan RPKPS tahun lalu. RPKPS tahun lalu tetap
`TERBIT` dan tetap tampil di katalog — riwayat antar tahun itu justru yang
ditunjukkan `versiLain` pada halaman publik. Arsip dipakai untuk **penarikan**:
MK batal dibuka, atau dokumen terbit karena kekeliruan.

### 2.4 Kendala yang harus disebut di antarmuka

`@@unique([mataKuliahId, tahunAkademikId])` berarti satu MK hanya boleh punya satu
RPKPS per tahun akademik. Inilah sebab utama dosen ingin menghapus: **salah pilih
MK atau TA saat membuat**. Karena RPKPS yang diarsipkan tetap memakai slotnya,
antarmuka wajib membedakan keduanya dengan jelas:

- **Hapus** → slot bebas, boleh dibuat ulang. Hanya untuk draf tanpa akibat.
- **Arsipkan** → slot tetap terpakai; membuat ulang MK+TA yang sama akan ditolak.

### 2.5 Jejak setelah baris hilang

Penghapusan dicatat ke `log_audit` dengan `data` berisi sensus singkat dari yang
dilenyapkan — jumlah pertemuan, tugas, kisi-kisi, pustaka — beserta kode MK dan
tahun akademiknya. Baris-barisnya memang hilang, tetapi pertanyaan "ke mana
perginya RPKPS TI214 2025/2026-GENAP?" tetap terjawab.

### 2.6 Aturan H3 — pintu darurat administrator

H1 dan H2 menutup semua jalan bagi dokumen yang sudah disahkan, dan untuk dosen
maupun Kaprodi memang begitulah seharusnya. Tetapi ada keadaan yang tidak
terjawab arsip: dokumen **tidak boleh tetap ada**. Dua yang nyata — RPKPS terbit
pada mata kuliah yang salah sehingga katalog publik menampilkan dokumen yang
tidak pernah berlaku, dan dokumen yang memuat data yang wajib dihapus atas
permintaan yang sah. Mengarsipkan hanya menyembunyikannya; barisnya masih ada.

Karena itu **satu** pintu darurat, bukan pelonggaran H1:

| Syarat | Alasan |
|---|---|
| Peminta memegang peran `ADMIN` | Bukan `bolehKelola`. Koordinator dan Kaprodi tetap berhenti di H1; yang boleh membatalkan aturan institusi hanya pemegang wewenang institusi |
| Alasan tertulis ≥ `MIN_ALASAN_HAPUS_PAKSA` karakter | Setelah barisnya lenyap, kalimat inilah satu-satunya keterangan yang tersisa |
| Kode mata kuliah diketik ulang di dialog | Menahan gerakan refleks; bukan pengaman, pengamannya tetap di server |
| Sensus lengkap tercatat ke `log_audit` **di dalam transaksi yang sama** | Lihat di bawah |

Yang membedakannya dari H1 bukan longgarnya, melainkan **arah pertanyaannya**.
`periksaKelayakanHapus` menjawab "apa yang menghalangi?"; `ringkasAkibatHapus`
menjawab "apa yang hancur bila tetap dilanjutkan?" — dan jawabannya dihitung
dari basis data lalu **ditampilkan di dialog**, bukan diringkas menjadi
"tindakan ini permanen". Administrator berhak melewati penghalangnya; ia tidak
berhak tidak tahu apa yang ia hancurkan.

Catatan auditnya lebih tebal daripada H1 dan sengaja demikian: selain sensus
isi, ia menyimpan **sidik SHA-256 setiap salinan beku** beserta versinya, daftar
pengampu berikut surelnya, rincian tiap kelas, status saat dihapus, dan alasan
yang ditulis. Berkas DOCX yang sudah tercetak memuat sidik itu; setelah barisnya
hilang, `log_audit` adalah satu-satunya tempat angka tersebut masih dapat
ditelusuri. Aksinya `RPKPS_DIHAPUS_PAKSA`, terpisah dari `RPKPS_DIHAPUS`, supaya
kedua peristiwa itu tidak pernah tercampur saat log dibaca.

Jalur paksa hidup di server action tersendiri (`hapusPaksaRpkps`), **bukan**
sebagai parameter `paksa: boolean` pada `hapusRpkps`. Bendera opsional pada aksi
yang sudah dipanggil dari dialog biasa cepat sekali berubah menjadi nilai yang
diteruskan begitu saja dari peramban; fungsi terpisah berarti jalur ini punya
penjaga sendiri yang tidak dapat dilewati dari jalur biasa.

Arsip tetap jawaban bawaan. Antarmuka menampilkan pintu ini **hanya di dalam
dialog penolakan H1 dan hanya bagi ADMIN**, di bawah anjuran mengarsipkan —
supaya urutan yang dibaca selalu: inilah yang menghalangi, inilah cara benar
menariknya, baru pintu darurat.

## BAGIAN 3 — Mengirimkan pada dosen lain

### 3.1 Tiga maksud yang berbeda

"Kirimkan RPKPS ini ke Pak Budi" hampir selalu berarti salah satu dari:

| Maksud | Operasi | Akibat pada dokumen |
|---|---|---|
| "Bantu saya menyusunnya" | **P — tambah pengampu** (ANGGOTA) | Bertambah satu penyunting; dokumen tetap satu |
| "Semester ini beliau yang pegang" | **S — serah terima** koordinator | Penanggung jawab berganti; dokumen tetap satu |
| "Pakai punyaku sebagai contoh" | **D — salin** | Lahir dokumen BARU milik penerima |

Ketiganya harus menjadi tiga tindakan bernama sendiri. Satu tombol "kirim" yang
diam-diam memilih salah satunya akan salah menebak separuh waktu.

### 3.2 Aturan P — tim pengampu dapat disunting

`RpkpsPengampu` sudah ada di skema dan terisi otomatis saat RPKPS dibuat
(pembuatnya menjadi `KOORDINATOR`), tetapi **tidak ada satu pun antarmuka untuk
mengubahnya**. Kartu "Tim pengampu" di halaman detail hanya membaca. Akibatnya
kolaborasi hari ini mustahil: mata kuliah yang diampu tiga dosen tetap hanya bisa
disunting satu orang.

Yang ditambahkan:

- Kaprodi/ADMIN dalam cakupan, dan KOORDINATOR RPKPS bersangkutan, boleh
  menambah dan melepas ANGGOTA.
- Calon diambil dari pengguna berstatus `AKTIF` yang memegang peran `DOSEN`,
  `KOORDINATOR_MK`, atau `KAPRODI`.
- Melepas pengampu **tidak** menghapus apa pun yang sudah ia tulis — isi RPKPS
  tidak menyimpan kepemilikan per baris.
- Koordinator tidak boleh melepas dirinya sendiri tanpa serah terima (3.3),
  supaya tidak ada RPKPS tanpa penanggung jawab.

### 3.3 Aturan S — serah terima koordinator, dan apa yang TIDAK ikut berpindah

Serah terima = koordinator lama turun menjadi ANGGOTA (atau dilepas), calon naik
menjadi KOORDINATOR, dalam satu transaksi. Dicatat di `rpkps_riwayat`, bukan hanya
di `log_audit`, karena pergantian penanggung jawab adalah bagian riwayat dokumen
yang dibaca Kaprodi.

**Yang tidak ikut berpindah: salinan beku.** Nama pengampu pada `rpkps_snapshot`
adalah nama yang tertera saat pengesahan, dan tidak boleh disentuh — memperbaruinya
akan mengubah `proyeksiIsi()` dan **menggeser sidik SHA-256 seluruh dokumen
terbit**. Serah terima setelah dokumen terbit mengganti *siapa yang boleh
menyunting revisi berikutnya*, bukan *siapa yang menandatangani yang sudah sah*.
Kalimat ini wajib muncul di dialog, bukan hanya di dokumen ini.

### 3.4 Konsekuensi otorisasi yang tidak bisa dihindari

Empat berkas memuat salinan `pastikanWenang` dengan bentuk yang sama:

```ts
boleh: dalamCakupan && (pengampu || punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM"))
```

Perhatikan **`dalamCakupan &&`**. Selama syarat itu berbentuk konjungsi, menambahkan
dosen dari prodi lain sebagai pengampu **tidak memberinya apa pun** — halaman detail
sendiri memanggil `cakupanProdi` lalu `notFound()`. Fitur "kirim ke dosen lain"
akan tampak berhasil dan diam-diam tidak berfungsi.

Padahal team teaching lintas prodi nyata: mata kuliah wajib umum, MK layanan, dan
dosen tamu dari prodi tetangga. Karena itu aturannya diusulkan berubah menjadi:

```
boleh = pengampu                                   // penunjukan eksplisit
      || (dalamCakupan && punyaPeran(ADMIN, KAPRODI, GPM))   // wewenang jabatan
```

Artinya: **kepengampuan adalah jalur akses tersendiri, bukan tambahan di atas
cakupan prodi.** Ditunjuk sebagai pengampu = boleh menyunting RPKPS itu, dan hanya
RPKPS itu. Cakupan prodi tetap mengatur segala yang lain — daftar, kurikulum,
evaluasi prodi. Perubahan ini menyentuh `aksi.ts`, `tugas/aksi.ts`, `aksi-draf.ts`,
`kisi-kisi/aksi.ts`, `kelas/aksi.ts`, dan pemeriksaan setingkat halaman pada
`rpkps/[id]/page.tsx` beserta anak-anaknya. Menambalnya sebagian akan menghasilkan
dosen yang bisa membuka satu halaman tetapi ditolak di halaman sebelahnya.

Daftar `/rpkps` juga perlu menyertakan RPKPS tempat pengguna terdaftar sebagai
pengampu meski di luar cakupan prodinya, dan menandai baris "Anda pengampu".

### 3.5 Aturan D — menyalin RPKPS

Salin membuat RPKPS **baru** berstatus `DRAF`, versi 1, dengan pemohon sebagai
KOORDINATOR. Sasarannya sepasang (mata kuliah, tahun akademik) yang belum terisi.

Yang **disalin**: deskripsi, kalimat pembuka, ambang, pustaka, komponen nilai,
seluruh pertemuan beserta aktivitas dan indikator, tugas beserta kriteria dan
linimasa.

Yang **tidak pernah disalin**: `rpkps_snapshot`, `rpkps_riwayat`, `kelas`, nilai,
dan `evaluasi_mk`. Riwayat dokumen baru dimulai dengan satu baris: *"Disalin dari
TI214 2024/2025-GENAP"*.

Aturan yang paling mudah dilanggar menyangkut **Sub-CPMK**:

| Sasaran | Pemetaan Sub-CPMK | Kisi-kisi |
|---|---|---|
| MK **sama**, TA berbeda | Ikut disalin — Sub-CPMK-nya identik | Ikut disalin |
| MK **berbeda** | **Dilepas semua.** `PertemuanSubCpmk` dan `TugasSubCpmk` tidak dibuat | **Tidak disalin.** `ButirKisiKisi.subCpmkId` wajib isi, dan Sub-CPMK MK lain tidak sah di sini |

Menyalin pemetaan Sub-CPMK antar mata kuliah akan menempelkan capaian milik MK lain
ke pertemuan — persis yang dicegah `saringSubCpmkMilikRpkps` pada jalur penyuntingan
biasa. Hasil salinan lintas MK memang perlu dipetakan ulang oleh dosen; itu
konsekuensi yang benar, dan panel validasi akan menandainya sebagai pemblokir.

Salin lintas MK **tetap harus dalam cakupan prodi pemohon** — ini bukan jalur untuk
memindahkan isi antar prodi tanpa sepengetahuan Kaprodi.

## BAGIAN 4 — Berbagi ke luar aplikasi

### 4.1 Yang sudah ada, tetapi tidak terlihat

Dua kanal berbagi sudah berfungsi hari ini dan tidak punya satu pun tombol yang
menyebut dirinya "bagikan":

1. **Katalog publik** — `/katalog/[prodi]/[kode]`, tanpa login, hanya `TERBIT`,
   dibaca dari salinan beku. Alamatnya sudah dihitung `jalurRpkpsPublik()`.
2. **Unduhan DOCX** — `/api/rpkps/[id]/docx` untuk pengguna terdaftar (termasuk
   draf), `/api/publik/rpkps/[id]/docx` untuk umum (hanya terbit).

Pekerjaan terbesar di sini bukan menambah kemampuan, melainkan **memunculkannya**:
satu panel "Bagikan" di halaman detail RPKPS yang memuat alamat publik lengkap
(dengan `urlSitus()`), tombol salin, tautan unduh DOCX, dan — bila belum terbit —
kalimat yang menjelaskan mengapa alamat publiknya belum ada.

### 4.2 Tautan pratinjau untuk dokumen yang belum disahkan

Yang belum bisa dilakukan sama sekali: memperlihatkan draf kepada orang yang
**tidak punya akun** — mitra industri yang diminta menilai penyelarasan (doc 02),
atau asesor eksternal sebelum visitasi.

Usulannya sebuah model baru:

```prisma
model TautanBerbagi {
  id            String    @id @default(cuid())
  rpkpsId       String    @map("rpkps_id")
  token         String    @unique          // 32 bita acak, base64url
  catatan       String?                    // "Untuk Pak Andi, PT Pertamina"
  kedaluwarsa   DateTime  @map("kedaluwarsa")
  dicabutPada   DateTime? @map("dicabut_pada")
  jumlahAkses   Int       @default(0) @map("jumlah_akses")
  terakhirAkses DateTime? @map("terakhir_akses")
  dibuatOlehId  String?   @map("dibuat_oleh_id")
  dibuatPada    DateTime  @default(now()) @map("dibuat_pada")
  ...
}
```

Empat pagar yang menyertainya, dan tanpa keempatnya fitur ini lebih baik tidak ada:

1. **Selalu kedaluwarsa.** Tanpa tanggal, satu tautan yang bocor berlaku selamanya.
   Batas atas 90 hari, bawaan 14 hari, dan dapat dicabut kapan saja.
2. **Selalu bertanda draf.** Halaman pratinjau memakai tata letak publik tetapi
   dengan pita "DRAF — BELUM DISAHKAN" yang tidak dapat disembunyikan, dan
   **tanpa** sidik SHA-256 — sidik hanya milik salinan beku.
3. **Tidak pernah terindeks.** `robots: noindex, nofollow`, tidak masuk sitemap,
   tidak masuk katalog, tanpa kartu OpenGraph.
4. **Hanya baca, dan hanya RPKPS.** Tidak ada nilai, tidak ada kelas, tidak ada
   evaluasi di halaman itu — nilai mahasiswa tidak boleh punya jalur tanpa login.

### 4.3 Amandemen terhadap aturan halaman publik

`AGENTS.md` menetapkan: *"Halaman publik hanya membaca salinan beku, dan hanya
status TERBIT. Semua kueri lewat `src/lib/publik/muat.ts`."* Tautan pratinjau
melanggar keduanya, dan itu harus **dinyatakan**, bukan diselundupkan.

Amandemen yang diusulkan:

> Ada **dua** pintu tanpa login, dan keduanya tertutup rapat pada berkasnya
> masing-masing. `src/lib/publik/muat.ts` melayani katalog: hanya `TERBIT`, hanya
> salinan beku, terindeks. `src/lib/berbagi/muat.ts` melayani tautan pratinjau:
> hanya lewat token yang sah dan belum kedaluwarsa, membaca data langsung, selalu
> bertanda draf, tidak pernah terindeks. Berkas yang satu tidak boleh memanggil
> berkas yang lain.

Bila amandemen ini ditolak, 4.2 gugur seluruhnya dan berbagi draf tetap dilakukan
lewat penambahan pengampu (3.2) atau kiriman berkas DOCX.

## BAGIAN 5 — Tahapan

| Tahap | Isi | Bergantung pada |
|---|---|---|
| **B1** | Hapus (H1) + arsipkan (H2) + saringan status di daftar + jejak audit | — |
| **B2** | Kelola tim pengampu (P) + serah terima (S) + perubahan otorisasi 3.4 | — |
| **B3** | Panel "Bagikan": alamat publik, salin, unduh DOCX (4.1) | — |
| **B4** | Salin RPKPS (D) | B2 (koordinator hasil salinan) |
| **B5** ✅ | Tautan pratinjau bertoken (4.2) | Keputusan K4 dicabut 4 September 2026 |

### 5.0 Di mana B5 berada

| Lapisan | Berkas |
|---|---|
| Aturan umur & keadaan tautan (murni, teruji) | `src/domain/rpkps/berbagi.ts` + `.test.ts` |
| Pintu kedua tanpa login | `src/lib/berbagi/muat.ts` |
| Tindakan server (buat, cabut) | `src/app/[bahasa]/(app)/rpkps/[id]/aksi-berbagi.ts` |
| Halaman pratinjau | `src/app/[bahasa]/(publik)/pratinjau/[token]/page.tsx` |
| Penjaga amandemen §4.3 | `src/lib/berbagi/pintu.test.ts` |

Empat hal yang ditegakkan kode, bukan disiplin:

1. **Tokennya 32 bita acak kriptografis** (`randomBytes`), bukan cuid: cuid
   dirancang agar unik, bukan agar tidak dapat ditebak — dan token inilah
   satu-satunya penjaga pintu ini.
2. **Umur dijepit di domain**, 1–90 hari, bawaan 14. Permintaan di luar
   rentang dijepit, bukan ditolak: nilainya datang dari borang, dan borang yang
   menolak tanpa menawarkan apa pun hanya memaksa orang menebak.
3. **Token tidak dikenal, dicabut, dan kedaluwarsa menghasilkan halaman yang
   SAMA.** Membedakannya berarti memberi tahu bahwa sebuah token pernah ada.
4. **Pencatatan akses tidak pernah menutup pintu.** Ia `void` beserta
   `catch`-nya: halaman yang gagal terbuka karena penghitungnya bermasalah
   adalah pertukaran yang salah arah. Yang dicatat hanya jumlah dan waktu —
   bukan siapa, karena pembacanya memang tidak punya akun.

Yang membuat tautan ini boleh dibuat: koordinator mata kuliah dan pengelola
prodi, **bukan** setiap pengampu. Membagikan draf ke luar institusi adalah
keputusan pemegang dokumen (§3.4).

### 5.1 Di mana B1–B4 berada

| Lapisan | Berkas |
|---|---|
| Aturan hapus/arsip/pulih (murni, teruji) | `src/domain/rpkps/daur-hidup.ts` + `.test.ts` |
| Wewenang atas satu RPKPS (§3.4) | `src/lib/rpkps/wenang.ts` |
| Data pendukung panel pengelolaan | `src/lib/rpkps/kelola.ts` |
| Tindakan server | `src/app/(app)/rpkps/[id]/aksi-kelola.ts` |
| Antarmuka | `src/app/(app)/rpkps/[id]/pengelola.tsx` |
| Uji lintas lapisan | bagian 9 pada `uji/integrasi.ts` |

Enam salinan `pastikanWenang` di berkas aksi kini semuanya mendelegasikan ke
`wenang.ts`, dan sembilan halaman beserta tiga rute API memakai `bolehLihat`
dari sumber yang sama. Satu perbaikan ikut terbawa: `putuskanRpkps` dulu hanya
memeriksa `wajibPeran("ADMIN","KAPRODI","GPM")` tanpa cakupan prodi — Kaprodi
prodi A dapat mengesahkan dokumen prodi B dengan menebak alamatnya. Sekarang ia
menuntut `wenang.pengelola`.

B1–B3 tidak menyentuh skema sama sekali kecuali pemakaian `ARSIP` yang sudah ada.
B5 menambah satu tabel dan satu rute publik baru.

## BAGIAN 6 — Keputusan yang sudah ditetapkan

Ditetapkan 24 Agustus 2026. Cakupan yang dikerjakan: **B1–B4**. **B5 (tautan
pratinjau bertoken) ditunda** — dengan demikian amandemen §4.3 belum berlaku dan
`src/lib/publik/muat.ts` tetap satu-satunya pintu tanpa login.

| # | Pertanyaan | Usulan |
|---|---|---|
| **K1** | Mana yang dimaksud "kirim ke dosen lain": tambah pengampu, serah terima, atau salin? | **Ketiganya**, sebagai tindakan terpisah bernama sendiri (Bagian 3) |
| **K2** | Apakah kepengampuan memberi akses lintas cakupan prodi? | **Ya.** Kepengampuan adalah jalur akses tersendiri; aturan §3.4 berlaku serentak di seluruh berkas |
| **K3** | Apakah RPKPS `TERBIT` yang diarsipkan hilang dari katalog publik? | **Ya.** Arsip berarti penarikan. Tidak perlu kode tambahan: `HANYA_TERBIT` di `publik/muat.ts` sudah menyaringnya |
| **K4** | Tautan pratinjau bertoken untuk draf — dibuat atau tidak? | Semula **ditunda**; **dikerjakan 4 September 2026** beserta amandemen §4.3 |
| **K5** | Siapa yang boleh menghapus: koordinator saja, atau Kaprodi saja? | Koordinator RPKPS **atau** ADMIN/KAPRODI dalam cakupan; anggota tidak |
| **K6** | Perlukah pemberitahuan dalam aplikasi saat seseorang ditunjuk sebagai pengampu? | Belum. Tidak ada lapisan notifikasi sama sekali; menambahnya untuk satu peristiwa terlalu mahal. Cukup tanda "Anda pengampu" di daftar RPKPS |
