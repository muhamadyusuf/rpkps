# Bahan Ajar: Buku Ajar dan Slide dari RPKPS

> Status: **BA1–BA6 TERPASANG.** Seluruh alurnya berjalan: skema, domain murni
> beserta validatornya, empat tahap AI, halaman `/bahan-ajar`, pencetakan buku
> `.docx` (naskah lengkap, satu bab, salinan tanpa kunci jawaban), dan slide
> `.pptx` beserta catatan pembicaranya. Yang tersisa hanya BA7: uji tambahan
> dan penajaman antarmuka.
> Menu baru `/bahan-ajar`. Dosen yang RPKPS-nya sudah tersusun menyuruh AI
> menyusun **buku ajar** bab demi bab, menyuntingnya, lalu mengunduh dua
> luaran: satu berkas `.docx` buku utuh yang siap didaftarkan ISBN, dan satu
> berkas `.pptx` slide kuliah per bab.

Keputusan yang sudah diambil sebelum rancangan ini ditulis:

| Pertanyaan | Keputusan |
|---|---|
| Satuan | Satu bab = satu baris mingguan EFEKTIF; bab-bab digabung menjadi satu buku per mata kuliah |
| Isi | Buku ajar utuh: tujuan, uraian materi, contoh/studi kasus, latihan + kunci, ringkasan — layak terbit |
| Luaran | DUA: buku `.docx` dan slide `.pptx` |
| Dwibahasa | Satu bahasa per buku (kolom `bahasa`), BUKAN pasangan kolom `*En` |
| Gerbang | Status RPKPS apa pun, asal baris mingguannya sudah berisi |
| Kelengkapan buku | Prakata, pendahuluan, ringkasan bab, glosarium, daftar pustaka disusun AI dan disunting dosen; metadata terbitan diisi dosen |

---

## BAGIAN 1 — Prinsip yang mengikat

**P1 · Bahan ajar adalah dokumen berdampingan, bukan bagian RPKPS.**
Alasannya sama persis dengan profil lulusan dan hasil evaluasi: `proyeksiIsi()`
dan `proyeksiIsiEn()` adalah dasar sidik SHA-256, dan menambahkan apa pun ke
sana menggeser sidik SELURUH RPKPS yang sudah terbit. Buku ajar karena itu
tidak masuk proyeksi, tidak masuk `rpkps_snapshot`, tidak ikut rantai
pengesahan, dan tidak pernah menyalakan peringatan pergeseran isi. Ia menempel
pada `Rpkps` hanya lewat kunci asing.

**P2 · `bolehSuntingIsi` sengaja TIDAK berlaku di sini.** Isi RPKPS terkunci
begitu diajukan, karena Kaprodi dan Penjaminan Mutu menandatangani isi
tertentu. Buku ajar tidak ditandatangani siapa pun, dan justru paling banyak
dikerjakan SESUDAH RPKPS terbit — saat kuliahnya benar-benar berjalan.
Mengunci buku ajar dengan status RPKPS berarti mematikan fitur ini di sepanjang
semester yang seharusnya menjadi masa pakainya.

**P3 · Yang boleh menulis adalah pengampu, bukan pengelola.** Untuk RPKPS,
`wenang.boleh = pengampu || pengelola`; ADMIN/KAPRODI/GPM ikut boleh menyunting
karena dokumen itu milik prodi. Buku ajar punya **penulis**, dan namanya
tercetak di halaman hak cipta. Karena itu tulisnya `wenang.pengampu` saja;
pengelola tetap `bolehLihat`. Ini satu-satunya tempat di aplikasi yang
mempersempit wewenang tulis dengan sengaja, dan alasannya harus tertulis di
`wenang-bahan-ajar.ts` supaya tidak "diperbaiki" orang berikutnya.

**P4 · AI menghasilkan draf; dosen adalah penulisnya.** Setiap bab menyimpan
`sumber` (`AI` atau `KURIKULUM`, mengikuti enum yang sudah ada) dan penanda
`disuntingPada`. Layar menyebutkan dengan jelas bab mana yang masih murni
keluaran model. Yang tercetak di buku hanyalah nama dosen — jadi peringatan itu
harus ada sebelum tombol unduh, bukan sesudahnya.

**P5 · ISBN, penerbit, dan tahun terbit tidak pernah datang dari model.**
Metadata terbitan diisi manusia. Panduan AI melarangnya secara eksplisit, dan
larangan itu **ditegakkan kode**: skema keluaran tahap mana pun tidak punya
medan ISBN, dan `periksaBukuAjar` menolak buku yang `isbn`-nya tidak cocok pola
ISBN-13. Alasannya sama dengan larangan mengarang ISBN pada draf pustaka
(docs/01): nomor karangan yang tercetak di halaman hak cipta adalah kesalahan
yang tidak dapat ditarik kembali setelah bukunya beredar.

**P6 · Kutipan hanya boleh menunjuk pustaka yang ada di RPKPS.** Model
diberikan daftar pustaka RPKPS beserta nomornya dan hanya boleh menyitir nomor
itu. Pustaka baru diusulkan lewat medan terpisah (`pustaka_usulan`) yang
ditandai jelas sebagai usulan dan **tidak ikut tercetak** sebelum dosen
memindahkannya ke daftar pustaka RPKPS. Daftar pustaka buku dirakit dari baris
`pustaka`, bukan dari karangan model.

**P7 · Bahasa dipilih per buku.** `buku_ajar.bahasa` bernilai `id` atau `en`.
Satu RPKPS boleh punya dua buku — satu tiap bahasa — dan keduanya adalah
dokumen terpisah dengan bab dan babnya sendiri. Buku ajar TIDAK memakai pola
kolom `*En` docs/11: teksnya panjang (satu bab bisa 20.000 aksara), pasangan
kolomnya akan ada delapan lebih, dan `pasanganTerjemahan` yang ikut tumbuh akan
membuat angka kelengkapan terjemahan RPKPS bercampur dengan pekerjaan menulis
buku. Konsekuensinya jelas dan diterima: **tidak ada satu pun kolom `*En` di
tabel bahan ajar**, dan panel terjemahan RPKPS tidak menyentuhnya.

---

## BAGIAN 2 — Model data

### 2.1 `BukuAjar` — satu per (RPKPS, bahasa)

```prisma
model BukuAjar {
  id      String          @id @default(cuid())
  rpkpsId String          @map("rpkps_id")
  bahasa  BahasaAntarmuka @default(id)

  // ── Metadata terbitan. Diisi dosen, tidak pernah oleh AI (P5).
  judul       String
  subjudul    String?
  penulis     String[]          // nama lengkap bergelar, urut
  afiliasi    String?
  penerbit    String?
  kotaTerbit  String?           @map("kota_terbit")
  tahunTerbit Int?              @map("tahun_terbit")
  edisi       String?
  isbn        String?
  hakCipta    String?           @map("hak_cipta")

  // ── Kelengkapan yang disusun AI lalu disunting dosen.
  prakata      String?
  pendahuluan  String?
  glosarium    Json?            // [{ istilah, arti }]
  biografi     String?

  sumber     SumberIsi @default(AI)
  dibuatPada DateTime  @default(now()) @map("dibuat_pada")
  diubahPada DateTime  @updatedAt      @map("diubah_pada")

  rpkps Rpkps        @relation(fields: [rpkpsId], references: [id], onDelete: Cascade)
  bab   BabBukuAjar[]

  @@unique([rpkpsId, bahasa])
  @@map("buku_ajar")
}
```

`onDelete: Cascade` dari `Rpkps` aman dan disengaja: buku ajar bukan dokumen
resmi, tidak punya salinan beku, dan tidak masuk sensus `hapusPaksaRpkps`.
Yang perlu ditambahkan ke `periksaKelayakanHapus` hanyalah **hitungan
informatif** — "RPKPS ini punya buku ajar dengan 14 bab yang ikut terhapus" —
bukan penghalang.

### 2.2 `BabBukuAjar` — satu per minggu efektif

```prisma
model BabBukuAjar {
  id         String  @id @default(cuid())
  bukuAjarId String  @map("buku_ajar_id")
  /// Baris mingguan asalnya. SetNull, bukan Cascade: bab yang sudah ditulis
  /// dosen tidak boleh lenyap karena baris mingguan disusun ulang.
  pertemuanId String? @map("pertemuan_id")

  nomor    Int      // = minggu asalnya saat dibuat, boleh diurutkan ulang
  judul    String
  tujuan   String[] // diturunkan dari indikator & Sub-CPMK minggu itu
  uraian   String?  // isi utama, beberapa subbab, dipisah baris kosong
  studiKasus String? @map("studi_kasus")
  ringkasan  String?

  /// Sidik rencana minggu SAAT bab ini disusun — topik, subtopik, indikator,
  /// dan kode Sub-CPMK. Bila RPKPS-nya berubah sesudahnya, layar menandai bab
  /// ini "disusun dari rencana yang sudah berubah". Lihat §5.3.
  sidikSumber String? @map("sidik_sumber")

  sumber       SumberIsi @default(AI)
  disuntingPada DateTime? @map("disunting_pada")
  dibuatPada   DateTime  @default(now()) @map("dibuat_pada")
  /// Kunci optimistik, sama seperti `simpanPertemuan`: penyunting bab menulis
  /// ulang SELURUH isinya beserta latihan dan slidenya.
  diubahPada   DateTime  @updatedAt @map("diubah_pada")

  buku    BukuAjar     @relation(fields: [bukuAjarId], references: [id], onDelete: Cascade)
  pertemuan Pertemuan? @relation(fields: [pertemuanId], references: [id], onDelete: SetNull)
  latihan LatihanBab[]
  slide   SlideBab[]
  pustaka BabPustaka[]

  @@unique([bukuAjarId, nomor])
  @@index([bukuAjarId])
  @@map("bab_buku_ajar")
}

model LatihanBab {
  id    String @id @default(cuid())
  babId String @map("bab_id")
  nomor Int
  soal  String
  /// Dipisahkan dari soal karena berkas untuk mahasiswa dicetak TANPA kunci.
  kunci String?
  bloom LevelBloom?

  bab BabBukuAjar @relation(fields: [babId], references: [id], onDelete: Cascade)

  @@unique([babId, nomor])
  @@map("latihan_bab")
}

model SlideBab {
  id       String   @id @default(cuid())
  babId    String   @map("bab_id")
  nomor    Int
  judul    String
  butir    String[]
  /// Catatan pembicara; masuk ke speaker notes .pptx, tidak ke badan slide.
  catatan  String?

  bab BabBukuAjar @relation(fields: [babId], references: [id], onDelete: Cascade)

  @@unique([babId, nomor])
  @@map("slide_bab")
}

/// Pustaka RPKPS yang disitir bab ini. Dipakai merakit daftar pustaka buku
/// dan memeriksa bahwa model tidak menyitir nomor yang tidak ada (P6).
model BabPustaka {
  babId     String @map("bab_id")
  pustakaId String @map("pustaka_id")

  bab     BabBukuAjar @relation(fields: [babId], references: [id], onDelete: Cascade)
  pustaka Pustaka     @relation(fields: [pustakaId], references: [id], onDelete: Cascade)

  @@id([babId, pustakaId])
  @@map("bab_pustaka")
}
```

Minggu UTS dan UAS **tidak** melahirkan bab. Alasannya sama dengan larangan AI
mengisi minggu ujian pada draf RPKPS: tidak ada materi yang diajarkan di sana.

---

## BAGIAN 3 — Tugas AI

Empat tahap, semuanya lewat `pakaiKredensial()` → `jalankanTugasAi()`, dengan
`kodeTugas` yang masuk `log_audit` seperti tugas AI lain.

| Tahap | Kode tugas | Panggilan | Keluaran |
|---|---|---|---|
| 1 · Kerangka buku | `BUKU_KERANGKA` | 1 | judul buku, judul & tujuan tiap bab, alur antarbab, usulan glosarium awal |
| 2 · Isi bab | `BUKU_BAB` | 1 **per bab** | uraian bersubbab, studi kasus, ringkasan, latihan + kunci, nomor pustaka yang disitir |
| 3 · Slide bab | `BUKU_SLIDE` | 1 per bab | 8–15 slide beserta catatan pembicara |
| 4 · Kelengkapan | `BUKU_KELENGKAPAN` | 1 | prakata, pendahuluan, glosarium final, biografi ringkas |

### 3.1 Mengapa satu panggilan per bab

Pelajaran docs/12 dan `terjemahan-rpkps.ts` berlaku lebih keras di sini: satu
bab buku ajar yang layak terbit adalah 3.000–6.000 token keluaran, jadi 14 bab
sekaligus mustahil muat dan pasti `TERPOTONG`. Yang penting bukan sekadar
memecahnya, melainkan **menyimpan tiap bab begitu selesai**: kegagalan di bab 9
tidak boleh menghanguskan bab 1–8. Bab yang gagal dilaporkan sebagai `kurang`,
tidak pernah dibulatkan menjadi sukses.

### 3.2 Mengapa perulangannya di peramban, bukan di server

"Susun semua bab" adalah 14 panggilan berurutan — beberapa menit. Satu Server
Action yang menunggu semuanya akan menabrak batas waktu, dan dosen kehilangan
seluruh pekerjaan tanpa tahu sampai mana. Karena itu:

- Server Action `susunBab(bukuId, nomor)` mengerjakan **satu** bab dan menyimpannya.
- Tombol "Susun semua" adalah perulangan di komponen klien yang memanggil aksi
  itu bab demi bab, menampilkan kemajuan `3/14`, dan berhenti begitu ada bab
  yang gagal — dengan bab-bab sebelumnya sudah aman tersimpan.
- Berurutan, bukan paralel: alasannya sama dengan `SEKALIGUS = 3` pada
  terjemahan — batas permintaan-per-menit kunci milik dosen.

### 3.3 Blok panduan

`PANDUAN_DASAR` (blok STABIL, kena prompt caching — tidak boleh memuat tanggal,
nama dosen, atau apa pun yang berubah) memuat:

- Peran: menulis **buku ajar untuk mahasiswa**, bukan RPKPS dan bukan makalah.
  Gaya: bahasa Indonesia akademik yang menjelaskan, bukan mendaftar.
- Panjang yang diharapkan per bab dan bentuk subbab bernomor.
- Larangan: mengarang pustaka, mengarang ISBN, mengarang nomor peraturan,
  menyitir pustaka di luar daftar yang diberikan (P5, P6).
- Larangan menyalin utuh dari sumber mana pun — buku ini akan didaftarkan
  Perpusnas, dan tanggung jawab hukumnya melekat pada dosen.
- Cara mengosongkan isian: string kosong, tanpa `null` (pelajaran
  `skema-draf.ts`).

Blok BERUBAH per bab memuat: identitas mata kuliah, topik & subtopik minggu itu,
Sub-CPMK dan indikatornya, alokasi menit, daftar pustaka bernomor, judul bab
tetangga (supaya alurnya nyambung dan tidak mengulang), dan — untuk tahap 3 —
isi bab yang sudah final.

### 3.4 Tahap 4 berjalan paling akhir

Prakata dan pendahuluan hanya bisa ditulis setelah seluruh bab ada; keduanya
mengacu pada isi buku. Konteksnya adalah **ringkasan** tiap bab, bukan isi
penuh — kalau tidak, tahap 4 sendirian akan lebih besar daripada semua tahap
lain digabung.

---

## BAGIAN 4 — Luaran

### 4.1 Buku ajar `.docx` — `src/lib/dokumen/buku-ajar-docx.ts`

Tipografinya **bukan** tipografi RPKPS. `gaya.ts` menyetel Arial 9pt untuk
formulir bertabel; buku ajar butuh ukuran B5 (18,2 × 25,7 cm), huruf serif 11pt,
paragraf berindentasi, dan gaya heading sungguhan. Karena itu berkas gayanya
sendiri, `buku-gaya.ts`, dan `gaya.ts` **tidak disentuh** — mengubahnya akan
menggeser tata letak setiap RPKPS yang dicetak.

Susunan berkas:

1. Halaman judul (judul, subjudul, penulis, penerbit)
2. Halaman hak cipta — penulis, penerbit, kota & tahun, edisi, ISBN, kalimat
   hak cipta. **Bagian yang kosong dicetak sebagai garis isian**, bukan
   dilewati diam-diam: buku tanpa ISBN yang tercetak seolah lengkap adalah
   jebakan.
3. Prakata (angka halaman romawi)
4. Daftar isi — field `TableOfContents` docx, karena itu judul bab wajib
   memakai `HeadingLevel`, bukan paragraf tebal
5. Bab 1..n: judul bab → tujuan pembelajaran → uraian bersubbab → studi kasus →
   ringkasan → latihan (kunci jawaban opsional)
6. Glosarium
7. Daftar pustaka — dirakit dari `pustaka` RPKPS, bukan dari model
8. Biografi penulis

Rute: `GET /api/bahan-ajar/[id]/docx`

| Parameter | Arti |
|---|---|
| `bab=3` | hanya satu bab (untuk dibagikan mingguan) |
| `kunci=0` | tanpa kunci jawaban — **versi untuk mahasiswa** |

`kunci=0` bukan hiasan: kunci jawaban tersimpan di kolom terpisah persis supaya
berkas untuk mahasiswa dapat dibuat tanpa menyunting apa pun.

### 4.2 Slide `.pptx` — `src/lib/dokumen/slide-pptx.ts`

Dependensi baru: **`pptxgenjs`** (murni JS, tanpa binary, aman di serverless).
Ini satu-satunya paket baru yang diminta rancangan ini.

Satu berkas per bab (`?bab=3`) atau satu berkas seluruh buku. Susunan: slide
judul → slide tujuan → slide isi (judul + butir) → slide penutup/latihan.
`catatan` masuk sebagai **speaker notes**, tidak pernah ke badan slide. Rasio
16:9. Tanpa gambar — ilustrasi adalah pekerjaan berikutnya (§7).

Rute: `GET /api/bahan-ajar/[id]/pptx`, gerbang wewenang identik dengan `.docx`.

---

## BAGIAN 5 — Halaman, wewenang, dan kewarasan

### 5.1 Alamat

| Alamat | Isi |
|---|---|
| `/bahan-ajar` | daftar buku ajar: RPKPS yang diampu + yang sudah punya buku dalam cakupan prodi |
| `/bahan-ajar/[id]` | sampul: metadata terbitan, daftar bab beserta status, tombol AI, kemajuan |
| `/bahan-ajar/[id]/bab/[nomor]` | penyunting satu bab: uraian, studi kasus, latihan, slide |

Daftar `/bahan-ajar` **dihalamankan dan disaring di database** lewat
`bacaHalaman`/`hitungHalaman` — sama seperti daftar internal lain. Seluruh
`href` ditulis tanpa awalan bahasa dan memakai `Tautan`; penyegaran memakai
`segarkan`, tidak pernah `revalidatePath`.

### 5.2 Wewenang — `src/lib/bahan-ajar/wenang.ts`

```
bolehLihat = wenangAtasRpkps(...).bolehLihat
bolehTulis = wenangAtasRpkps(...).pengampu        // P3, bukan .boleh
```

Tanpa `bolehSuntingIsi` (P2). Setiap Server Action bahan ajar melewati satu
penjaga — `bukuUntukTulis` — dan menyalin aturannya ke tiap berkas aksi adalah
kesalahan yang sudah pernah terjadi di `rpkps/aksi.ts`. Ketiga keputusan itu
dikunci `src/lib/bahan-ajar/wenang.test.ts`, yang membaca sumbernya: modul ini
`server-only` dan menarik klien Prisma, sehingga memanggilnya dalam uji berarti
menuntut basis data untuk menguji sesuatu yang sepenuhnya soal bentuk kode.

### 5.3 Bab yang rencananya sudah bergerak

`sidikSumber` diisi saat bab disusun: SHA-256 dari topik, subtopik, indikator,
dan kode Sub-CPMK minggu itu. Halaman membandingkannya dengan sidik sekarang.
Kalau berbeda, bab ditandai — bukan diblokir, bukan ditulis ulang otomatis.
Bab yang `pertemuanId`-nya sudah `null` (baris mingguan dihapus) ditandai
"tidak lagi punya minggu".

### 5.4 Validator — `src/domain/bahan-ajar/validator.ts`, murni

Temuan berupa **kode + parameter**, bukan kalimat — kalimatnya di
`temuan-id.ts`/`temuan-en.ts`, dirakit `teksTemuan`:

| Kode | Arti |
|---|---|
| `BA-BAB-KOSONG` | bab tanpa uraian |
| `BA-TANPA-TUJUAN` | bab tanpa tujuan pembelajaran |
| `BA-LATIHAN-TANPA-KUNCI` | ada soal yang tidak punya kunci |
| `BA-PUSTAKA-ASING` | bab menyitir pustaka yang tidak ada di RPKPS |
| `BA-ISBN-TIDAK-SAH` | isi kolom ISBN tidak cocok pola ISBN-13 |
| `BA-METADATA-KURANG` | penerbit/tahun/penulis kosong padahal buku hendak diunduh sebagai naskah terbit |
| `BA-BAB-BERGESER` | `sidikSumber` tidak lagi cocok |
| `BA-MINGGU-HILANG` | `pertemuanId` sudah null |
| `BA-SELURUHNYA-AI` | belum ada satu bab pun yang disunting manusia |

`BA-SELURUHNYA-AI` sengaja ada. Buku yang seluruh isinya masih keluaran model
mentah tidak layak dibawa ke penerbit, dan satu-satunya orang yang dapat
menilai itu adalah dosen yang namanya akan tercetak di sampul.

---

## BAGIAN 6 — Menu, kamus, dan pemasangan

- `src/lib/menu.ts`: `{ href: "/bahan-ajar", label: "bahanAjar", ikon: "buku", peran: null }`,
  diletakkan tepat setelah `/rpkps`. `KunciIkon` bertambah `"buku"`.
- `src/kamus/id.ts` + `en.ts`: `menu.bahanAjar`, blok `bahanAjar.*`, temuan
  `BA-*`, dan pesan Zod bergaya kunci (`"@bahanAjar.periksa.judulPendek"`).
  `en.ts` bertipe `typeof id` — galat kompilasinya memang pesan bahwa ada kunci
  yang belum diterjemahkan.
- Label berkas cetak masuk `src/lib/dokumen/label.ts`. **Tidak ada pengenal
  Excel di sini**, jadi aturan docs/11 §7.1 tidak tersentuh.

Urutan pemasangan:

| Tahap | Isi | Status |
|---|---|---|
| BA1 | Skema Prisma + `db:push`; `BukuAjar`, `BabBukuAjar`, `LatihanBab`, `SlideBab`, `BabPustaka` | ✅ |
| BA2 | Domain murni: `kerangka-buku.ts` (bab dari minggu efektif), `validator.ts`, `sidik-sumber.ts` — tanpa Prisma, tanpa React | ✅ |
| BA3 | `src/lib/ai/buku-ajar.ts`: empat tahap, skema Zod, panduan, penyimpanan per bab | ✅ |
| BA4 | Halaman `/bahan-ajar`, sampul, penyunting bab, Server Action + `bahan-ajar/wenang.ts` | ✅ |
| BA5 | `buku-gaya.ts` + `buku-ajar-docx.ts` + rute unduh, termasuk `kunci=0` | ✅ |
| BA6 | `pptxgenjs` + `slide-pptx.ts` + rutenya | ✅ |
| BA7 | Menu, kamus dua bahasa, uji, dan baris aturan di `AGENTS.md` | sebagian |

---

## BAGIAN 7 — Yang sengaja TIDAK dikerjakan

- **Tidak masuk katalog publik.** Buku ajar milik dosen, bukan dokumen mutu.
- **Tidak ada gambar/ilustrasi.** Menyisipkan gambar berarti penyimpanan
  berkas, dan itu pekerjaan tersendiri.
- **Tidak ada pemeriksa plagiarisme.** Aplikasi tidak menjanjikan apa yang
  tidak dapat ditepatinya; yang ada hanyalah peringatan tanggung jawab penulis.
- **Tidak ada terjemahan otomatis buku.** Buku Inggris adalah buku kedua yang
  disusun terpisah (P7).
- **Tidak ada rantai pengesahan atau tanda tangan buku.**
- **Tidak menyentuh `proyeksiIsi()`, `sidikDokumen()`, maupun `rpkps_snapshot`.**

---

## BAGIAN 8 — Uji

| Berkas | Yang dijaga |
|---|---|
| `src/domain/bahan-ajar/kerangka-buku.test.ts` | bab hanya dari minggu EFEKTIF; UTS/UAS tidak melahirkan bab; penomoran ulang |
| `src/domain/bahan-ajar/validator.test.ts` | sembilan temuan beserta kasus negatifnya; ISBN-13 sah/tidak sah |
| `src/lib/ai/buku-ajar.test.ts` | bab yang gagal dilaporkan `kurang`, bukan dibulatkan sukses; bab yang berhasil tetap tersimpan; skema keluaran tidak punya medan ISBN (P5); pustaka di luar daftar ditolak (P6) |
| `src/lib/dokumen/buku-ajar-docx.test.ts` | berkas terbuka sebagai zip dan memuat `word/document.xml`; **`kunci=0` benar-benar tidak memuat teks kunci jawaban** |
| `src/lib/dokumen/slide-pptx.test.ts` | zip memuat `ppt/presentation.xml`; jumlah slide sesuai; catatan pembicara ada di notes, bukan di badan slide |
| `src/lib/rpkps/terjemahan-cakupan.test.ts` | tetap hijau — tidak ada kolom `*En` baru yang lahir dari fitur ini (P7) |
| `src/domain/rpkps/proyeksi.test.ts` | tetap hijau — sidik dokumen contoh tidak bergerak satu aksara pun (P1) |

Dua uji terakhir adalah yang paling berharga: keduanya sudah ada, dan keduanya
akan menyala kalau fitur ini merembes ke tempat yang bukan haknya.

---

## BAGIAN 9 — Aturan yang perlu masuk `AGENTS.md`

> - **Bahan ajar berdampingan dengan RPKPS, tidak di dalamnya.** `buku_ajar`
>   dan `bab_buku_ajar` tidak boleh masuk `proyeksiIsi()`, `proyeksiIsiEn()`,
>   maupun `rpkps_snapshot`; alasannya sama dengan profil lulusan dan hasil
>   evaluasi — proyeksi adalah dasar sidik SHA-256 seluruh dokumen terbit.
>   Bahan ajar juga TIDAK tunduk pada `bolehSuntingIsi`: ia justru paling
>   banyak dikerjakan setelah RPKPS terbit.
> - **Yang menulis buku ajar adalah pengampu, bukan pengelola.**
>   `bolehTulisBukuAjar` sengaja lebih sempit daripada `wenang.boleh` —
>   nama penulis tercetak di halaman hak cipta. Menyamakannya dengan wewenang
>   RPKPS memberi ADMIN/KAPRODI/GPM hak menulis buku atas nama orang lain.
> - **ISBN dan metadata terbitan tidak pernah datang dari AI.** Skema keluaran
>   tugas `BUKU_*` tidak punya medan ISBN, penerbit, atau tahun terbit; nomor
>   karangan yang tercetak di halaman hak cipta tidak dapat ditarik kembali
>   setelah bukunya beredar.
> - **Kunci jawaban hidup di kolomnya sendiri.** `latihan_bab.kunci` terpisah
>   dari `soal` supaya berkas untuk mahasiswa (`?kunci=0`) dapat dibuat tanpa
>   menyunting apa pun. Menggabungkannya ke satu kolom teks membuat kunci
>   jawaban ikut terbagikan, dan gagalnya senyap.
> - **Buku ajar punya tipografinya sendiri.** `src/lib/dokumen/gaya.ts` menyetel
>   formulir RPKPS (Arial 9pt, bertabel); buku ajar memakai `buku-gaya.ts`
>   (B5, serif, `HeadingLevel` untuk daftar isi). Mengubah `gaya.ts` agar
>   "cocok untuk keduanya" menggeser tata letak setiap RPKPS yang dicetak.
