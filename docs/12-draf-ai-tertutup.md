# Draf AI yang Tertutup terhadap Peta Asesmen

> Status: **TERPASANG (30 Agustus 2026).**
> Menjawab temuan nyata: draf yang disusun AI selalu meninggalkan peta asesmen
> dalam keadaan terbuka. Contoh yang dilaporkan:
>
> > Peta asesmen belum siap dipakai menghitung capaian
> > 16 asesmen · total 200% · 8 dari 14 Sub-CPMK terukur · 2 dari 2 CPL
> > terukur · 15 temuan
>
> Semua angka itu berasal dari SATU kelalaian yang sama: draf menetapkan bobot
> tetapi tidak pernah menetapkan **ke komponen mana bobot itu masuk**.

## BAGIAN 1 — Membedah angka 200%

Tiga celah, bukan satu. Ketiganya ada di jalur yang sama.

### 1.1 Baris mingguan tidak pernah menunjuk komponen

`SkemaKerangka.bobot_minggu` hanya memuat `{ minggu, bobot }`. Tidak ada nama
komponen di sana, `DrafPertemuan` tidak punya bidangnya, dan
`terapkanDrafRpkps()` karena itu menulis `pertemuan.bobot` tanpa pernah
menyentuh `pertemuan.komponenNilaiId`. Setiap baris mingguan berbobot keluar
sebagai "— belum ditentukan —", dan `susunPetaAsesmen` melaporkannya satu per
satu sebagai `PA-TANPA-KOMPONEN`.

### 1.2 Karena itu, bobot tugas terhitung dua kali

Aturan kedua peta asesmen (docs/05 §5.3): sebuah komponen dirinci baris
mingguan **atau** lembar tugas — tidak pernah keduanya. Yang menentukan mana
yang berlaku adalah `dirinciMingguan`, sebuah peta **nama komponen → bobot**
yang dibangun dari baris mingguan.

Bila tidak ada satu pun baris mingguan yang menunjuk komponen, peta itu kosong.
Akibatnya setiap lembar tugas dibaca sebagai bobot TAMBAHAN, bukan sebagai
rencana baris yang sudah ada. Mingguan 100% + tugas 100% = **200%**.

Jadi angka 200% bukan kesalahan aritmetika model. Model menjumlahkan dua deret
yang masing-masing memang 100; yang hilang adalah keterangan bahwa keduanya
menghitung tagihan yang sama.

### 1.3 Minggu ujian tidak pernah diberi bobot

`bobot_minggu` menurut panduan hanya mencakup minggu **EFEKTIF**, dan
`periksaDraf()` menolak draf yang menyentuh minggu ujian
(`D-MINGGU-BUKAN-EFEKTIF`). Baris UTS dan UAS karena itu tetap berbobot 0
seumur hidup draf. Tiga akibat beruntun:

1. Komponen "UTS" dan "UAS" yang diusulkan model sendiri tidak dirinci apa pun
   → `PA-KOMPONEN-TANPA-ASESMEN`.
2. Kisi-kisi UTS/UAS menggantung tanpa baris ujian berbobot →
   `PA-KISI-TANPA-UJIAN`.
3. **Inilah sebab "8 dari 14 Sub-CPMK terukur".** Baris ujian tidak menempel
   Sub-CPMK — Sub-CPMK ujian hidup di kisi-kisi, dan bobotnya mengalir hanya
   lewat baris ujian. Bobot ujian 0 berarti seluruh Sub-CPMK yang hanya diuji
   di UTS/UAS tidak terukur sama sekali. Yang tersisa hanyalah Sub-CPMK milik
   minggu efektif berbobot — 8 minggu, 8 Sub-CPMK.

Hitungan 15 temuan itu, dengan kata lain, adalah 8 baris tanpa komponen +
1 total ≠ 100 + 2 komponen ujian tanpa asesmen + 2 kisi-kisi menggantung +
Sub-CPMK tanpa bobot + selisih bobot tugas. Satu sebab, lima belas gejala.

## BAGIAN 2 — Prinsip perbaikan

Tiga kalimat yang mengikat seluruh rancangan di bawah.

**P1 · Dalam draf AI, setiap bobot hidup di baris mingguan.** Lembar tugas
adalah *rencana* baris itu, bukan tempat bobot kedua. Alasannya bukan selera:
itu persis aturan yang sudah ditegakkan `susunPetaAsesmen`, dan setiap
penilaian memang terjadi pada suatu minggu — termasuk tugas, yang dikumpulkan
pada minggu tertentu. Penyuntingan manual tetap bebas memakai bentuk lain;
yang dikunci hanya keluaran AI.

**P2 · Komponen nilai tetap buku besarnya; barisnya yang mengisi sampai
penuh.** Model tetap merancang bobot tiap komponen, dan angka itulah yang
menang. Yang diturunkan adalah bobot tiap baris mingguan: sesudah tiap baris
menyebut komponennya, bobot komponen dibagikan ke baris-baris itu secara
proporsional sampai jumlahnya persis. `PA-KOMPONEN-TIDAK-COCOK` karena itu
menjadi mustahil secara konstruksi, bukan karena model berhati-hati.

Arah sebaliknya — menjumlahkan baris menjadi bobot komponen — sempat
dipertimbangkan dan ditolak. Ia melanggar aturan yang mengikat di `AGENTS.md`
("bobot penilaian punya satu buku besar"), dan ongkos praktisnya nyata: begitu
jumlah baris meleset dari 100, penormalannya melahirkan angka pecahan seperti
17,65% di sekujur dokumen. Dengan komponen sebagai buku besar, komponen
berbaris tunggal — UTS, UAS — menerima bobot utuh yang bulat.

**P3 · Penutupan peta diselesaikan server, deterministik, dan dilaporkan.**
Model diminta menyebut komponen tiap baris karena ia paling tahu maksudnya.
Bila ia lalai, server yang menambal — dengan aturan tetap, dan setiap tambalan
masuk ke `catatan` yang dibaca dosen sebelum menekan setuju. Pola ini sudah
berjalan untuk aritmetika (`normalisasi.ts`); yang ditambah hanya cakupannya.

## BAGIAN 3 — Rancangan

### 3.1 Tahap 1 menetapkan seluruh buku besar

`SkemaKerangka.bobot_minggu` berubah bentuk:

```
bobot_minggu: [{ minggu, bobot, komponen }]
```

dengan dua perluasan aturan:

- Daftarnya mencakup **seluruh** minggu, termasuk minggu ujian. Minggu ujian
  adalah tempat bobot UTS/UAS hidup.
- `komponen` diisi nama yang PERSIS sama dengan salah satu `komponen_nilai`.
  Minggu berbobot 0 mengisinya `""`.

`komponen_nilai` tetap diminta beserta bobotnya, dan sesuai P2 angka itulah
yang tersimpan. Bila jumlah baris sebuah komponen berbeda dari bobot
komponennya, **bobot barisnya yang disesuaikan** — proporsi antar baris
dipertahankan — dan penyesuaiannya masuk `catatan`.

Dua aturan tambahan yang masuk panduan:

- Hanya minggu yang punya `subCpmkTerjadwal` boleh diberi bobot. Minggu efektif
  tanpa Sub-CPMK yang diberi bobot melahirkan `PA-ASESMEN-TANPA-SUB-CPMK`:
  bobotnya tidak mengalir ke capaian mana pun.
- Minggu ujian diberi bobot hanya bila kisi-kisinya nanti benar-benar disusun.
  Baris ujian tidak menempel Sub-CPMK, jadi bobot ujian tanpa kisi-kisi adalah
  bobot yang mengambang.

Contoh sah untuk 14 minggu efektif + UTS di minggu 8 + UAS di minggu 16:

```
komponen_nilai : Tugas 30, Kuis 15, UTS 25, UAS 30            → 100
bobot_minggu   : 4=15 (Kuis), 7=15 (Tugas), 8=25 (UTS),
                 12=15 (Tugas), 16=30 (UAS), sisanya 0        → 100
periksa per komponen: Kuis 15 = 15 ✓, Tugas 15+15 = 30 ✓,
                      UTS 25 ✓, UAS 30 ✓
```

### 3.2 Tahap 3 menempatkan tugas sebagai rencana

Panduan tugas berubah pada satu titik: nama komponen yang disebut sebuah lembar
tugas harus komponen yang **sudah dirinci baris mingguan**, dan jumlah bobot
seluruh tugas dalam satu komponen sama dengan bobot komponen itu — karena
keduanya menghitung tagihan yang sama, bukan dua tagihan.

### 3.3 Rekonsiliasi server — `src/domain/rpkps/alokasi-asesmen.ts`

Modul baru, murni, dipanggil `gabungkan()` di `draf-rpkps.ts` setelah ketiga
tahap selesai — di sanalah baris mingguan, lembar tugas, dan kisi-kisi pertama
kali terlihat bersamaan; sebelum tahap 3 belum diketahui kisi-kisi mana yang
benar-benar berisi butir. Urutannya tetap, dan tiap langkah yang mengubah angka
model menulis satu baris `catatan`:

1. **Padankan nama komponen** (dirapikan, tanpa peduli besar-kecil huruf). Nama
   yang tidak dikenal dianggap belum ditunjuk.
2. **Cabut bobot yang tidak dapat mengalir.** Minggu efektif berbobot tanpa
   Sub-CPMK terjadwal → bobotnya 0. Minggu ujian berbobot tanpa kisi-kisi
   berjenis sama → bobotnya 0, karena baris ujian tidak menempel Sub-CPMK dan
   kisi-kisilah yang menyatakan apa yang diukurnya.
3. **Tambal komponen yang belum ditunjuk.** Baris ujian → komponen yang namanya
   menunjuk ujian itu ("UTS", "Ujian Tengah Semester"), dibuat bila belum ada.
   Baris efektif → komponen bukan-ujian dengan bobot rancangan terbesar; bila
   tidak ada satu pun, komponen baru bernama "Penilaian Proses".
4. **Tetapkan buku besarnya.** Komponen yang tidak ditunjuk baris mana pun
   dibuang — ia komponen tanpa asesmen, dan mempertahankannya berarti
   `PA-KOMPONEN-TANPA-ASESMEN` yang dijamin muncul. Komponen bentukan langkah 3
   mewarisi bobot usulan baris-barisnya. Sisanya dinormalkan ke 100 dengan
   `normalisasiKe100`; hanya bila totalnya jauh di luar akal (di luar 50–200)
   buku besarnya diturunkan dari baris, sebagai jalan terakhir.
5. **Bagikan bobot tiap komponen ke baris yang merincinya**, proporsional
   terhadap usulan model, dengan `bagiProporsional` — saudara `normalisasiKe100`
   yang totalnya bukan 100 melainkan bobot satu komponen. Sesudah langkah ini
   jumlah seluruh baris tepat 100 menurut konstruksi.
6. **Selaraskan lembar tugas**: tugas yang komponennya tidak dikenal dipasang ke
   komponen baris berbobot pada rentang minggunya (`mingguSelesai` lebih dulu,
   karena di sanalah tagihannya jatuh); bila tidak ada, bobotnya menjadi 0 —
   lembar rencana tanpa bobot tetap berguna, sedangkan bobot tanpa baris
   terhitung sebagai tagihan kedua. Lalu bobot tugas dalam tiap komponen
   dibagikan dari bobot komponen itu, sehingga `PA-TUGAS-BEDA-BOBOT` tidak
   dapat muncul.

Sesudah keenam langkah, peta asesmen dari draf ini **tertutup menurut
konstruksi**: total 100%, tiap asesmen punya komponen, tiap komponen dirinci,
dan tidak ada bobot ganda.

### 3.4 `periksaDraf()` sebagai penahan terakhir

Rekonsiliasi memperbaiki; `periksaDraf()` membuktikan. Temuan baru — semuanya
seharusnya tidak pernah menyala, dan menyala berarti rekonsiliasi bocor:

| Kode | Arti |
|---|---|
| `D-MINGGU-TANPA-KOMPONEN` | baris berbobot tanpa komponen |
| `D-MINGGU-KOMPONEN-ASING` | komponen yang disebut tidak ada di daftar |
| `D-KOMPONEN-TANPA-ASESMEN` | komponen tidak dirinci baris mana pun |
| `D-KOMPONEN-TIDAK-COCOK` | jumlah baris ≠ bobot komponen |
| `D-MINGGU-BERBOBOT-TANPA-SUB-CPMK` | bobot yang tidak mengalir ke capaian |
| `D-UJIAN-BERBOBOT-TANPA-KISI` | bobot ujian tanpa kisi-kisi |
| `D-UJIAN-BUKAN-MINGGU-UJIAN` | baris ujian menunjuk minggu yang bukan ujian |
| `D-UJIAN-GANDA` | satu minggu ujian disebut dua kali |
| `D-SUB-CPMK-TIDAK-TERUKUR` | Sub-CPMK tidak terjangkau baris berbobot maupun kisi-kisi |

`D-BOBOT-MINGGUAN` diperluas: yang dijumlahkan kini baris efektif **dan** baris
ujian, persis seperti B1 pada validator RPKPS. `KonteksDraf` bertambah
`mingguUjian` dan `subCpmkPerMinggu` supaya pemeriksaan ini dapat dikerjakan di
domain, tanpa Prisma.

Satu temuan di daftar itu tidak punya tambalan otomatis:
`D-SUB-CPMK-TIDAK-TERUKUR`. Menambal berarti mengarang butir ujian, dan butir
ujian karangan server lebih buruk daripada draf yang ditolak dengan alasan
jelas. Panduan tahap 3 sudah mewajibkan seluruh Sub-CPMK teruji di UTS atau
UAS; bila model melanggarnya, ongkosnya satu draf yang harus diulang.

### 3.5 Penerapan ke dokumen

`terapkanDrafRpkps()` berubah pada tiga titik:

1. Peta `nama komponen → id` dibaca **sebelum** perulangan pertemuan, bukan
   sesudahnya seperti sekarang. Idnya tetap datang dari `rencanakanKomponen`,
   jadi identitas baris `komponen_nilai` tetap utuh — aturan yang mengikat itu
   tidak tersentuh.
2. Baris efektif ditulis dengan `komponenNilaiId`.
3. Baris ujian ikut ditulis, tetapi **hanya** `bobot`, `komponenNilaiId`, dan
   `sumber`. Topik, jenis, dan menit aktivitas baris ujian tidak disentuh —
   isinya bukan urusan model.

Titik 3 melunakkan larangan lama "AI tidak menyentuh minggu ujian". Larangan
itu tetap berlaku untuk ISI; yang kini boleh ditulis hanyalah angka bobot dan
tautan komponennya, dua hal yang memang tidak dapat ditentukan dari luar minggu
ujian.

## BAGIAN 4 — Yang sengaja tidak dikerjakan

- **Tidak ada penambalan pada dokumen yang sudah tersimpan.** Rancangan ini
  memperbaiki draf yang BARU disusun. RPKPS yang sudah terlanjur diterapkan
  dengan komponen kosong tetap diperbaiki lewat penyunting — usulan komponen
  untuk baris ujian di `mingguan/[minggu]/page.tsx` sudah membantu, dan
  perluasannya ke baris efektif dapat menyusul terpisah.
- **Tidak menyentuh `susunPetaAsesmen`.** Peta bukan sumber masalahnya; ia
  justru pelapor yang benar. Melonggarkan aturannya berarti membuat angka
  capaian yang tidak dapat dipercaya.
- **Tidak mengunci bentuk "komponen dirinci lembar tugas"** di penyuntingan
  manual. Yang dikunci hanya keluaran AI (P1).

## BAGIAN 5 — Uji

- `alokasi-asesmen.test.ts` — enam langkah rekonsiliasi, dibuka dengan kasus
  "model sudah benar": tidak ada satu angka pun yang berubah dan `catatan`
  kosong. Penambalan yang menyala saat tidak diperlukan sama merusaknya dengan
  penambalan yang gagal.
- Uji silang yang paling berharga, di berkas yang sama: keluaran rekonsiliasi
  dimasukkan ke `susunPetaAsesmen` dan hasilnya wajib `lolos: true` — termasuk
  untuk masukan yang memuat SELURUH kelalaian §1 sekaligus. Itu mengikat dua
  modul yang selama ini hanya bertetangga.
- `draf.test.ts` — sembilan temuan baru, beserta kasus negatifnya.
- `normalisasi.test.ts` — `bagiProporsional`, termasuk anggota tanpa bobot
  usulan yang harus dibagi rata alih-alih meninggalkan komponen setengah terisi.

## BAGIAN 6 — Aturan yang perlu masuk `AGENTS.md`

> **Draf AI menutup peta asesmennya sendiri.** Setiap baris mingguan berbobot
> yang ditulis draf AI — termasuk baris UTS dan UAS — wajib menunjuk komponen
> nilai, dan bobot tiap baris dibagikan dari bobot komponennya oleh
> `alokasikanAsesmen`, bukan dijumlahkan menjadi bobot komponen. Lembar tugas
> adalah rencana baris itu; memberinya bobot di luar komponen yang sudah
> dirinci baris mingguan membuat tagihan yang sama terhitung dua kali, dan
> itulah yang dulu memunculkan "total 200%".
