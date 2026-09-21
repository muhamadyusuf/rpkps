# Identitas Program Studi

> Status: **DISETUJUI (21 September 2026), sedang dipasang.** Empat keputusan
> BAGIAN 7 sudah diambil dan sudah dituangkan ke dalam BAGIAN 2–6.
>
> Menjawab satu permintaan: *"Tambahkan fitur untuk menambahkan logo program
> studi, visi & misi, alamat prodi, telp, website, email."*

Menyentuh [02-template-itts-dan-penyelarasan-industri.md](./02-template-itts-dan-penyelarasan-industri.md)
(kop dokumen), [06-daur-hidup-dan-berbagi-rpkps.md](./06-daur-hidup-dan-berbagi-rpkps.md) §4.3
(pintu tanpa login), dan [11-dwibahasa.md](./11-dwibahasa.md) §5 (kolom `*En`).

---

## BAGIAN 1 — Masalah yang diselesaikan

Tabel `prodi` hari ini hanya tahu tujuh hal: `nama`, `namaEn`, `kode`,
`jenjang`, `gelar`, `akreditasi`, `aktif`. Akibatnya:

| Yang hilang | Di mana terasa |
|---|---|
| Logo prodi | Berkas DOCX RPKPS tidak berkop. Halaman katalog memakai monogram huruf (`gaya.monogramProdi`) sebagai pengganti darurat. |
| Visi & misi | Tidak ada di mana pun. Padahal ini hal pertama yang ditanya asesor, dan satu-satunya tempat yang menjelaskan *mengapa* CPL prodi berbunyi begitu. |
| Alamat, telepon, surel | Tidak ada. Dokumen resmi yang keluar dari aplikasi ini tidak memuat satu pun cara menghubungi penerbitnya. |
| Situs | Ada, tetapi sebagai **konstanta kode**: `SITUS_PRODI` di `src/lib/publik/tautan.ts`, berisi satu baris `TI: "https://ti.itts.ac.id"`. Komentarnya sendiri mengakui alasannya cuma "menambah kolom berarti migrasi plus formulir admin untuk satu URL" — alasan yang gugur begitu ada lima medan lain yang butuh formulir yang sama. |

Konstanta `SITUS_PRODI` **dipensiunkan** oleh konsep ini, bukan dibiarkan
berdampingan. Dua daftar yang tidak sinkron lebih buruk daripada satu daftar.

---

## BAGIAN 2 — Bentuk fitur

### I1 — Tujuh medan baru pada `prodi`, bukan tabel baru

Satu prodi punya tepat satu identitas, dan identitas itu ikut dibaca hampir
setiap kali prodinya dibaca. Tabel terpisah berarti satu `join` tambahan pada
setiap pembacaan untuk relasi satu-ke-satu yang tidak pernah kosong — dan basis
data ini jauh (~25 ms sekali jalan, lihat AGENTS.md).

```prisma
model Prodi {
  // … medan yang sudah ada

  /// Visi prodi, satu paragraf. Prosa — karena itu berpasangan *En.
  visi     String? @db.Text
  visiEn   String? @db.Text @map("visi_en")

  /// Misi prodi sebagai DAFTAR butir, bukan satu blok teks. Misi selalu
  /// dicetak bernomor; menyimpannya sebagai satu teks berarti setiap
  /// pembaca memecahnya sendiri dengan aturan yang berbeda-beda.
  misi     String[]
  misiEn   String[] @map("misi_en")

  /// Kontak. TIDAK berpasangan *En — lihat §2.4.
  alamat   String? @db.Text
  telepon  String?
  surel    String?
  situs    String?

  /// Logo, disimpan sebagai bita di basis data — lihat §2.2.
  logo       Bytes?
  logoTipe   String? @map("logo_tipe")   // "image/png" | "image/jpeg"
  logoLebar  Int?    @map("logo_lebar")
  logoTinggi Int?    @map("logo_tinggi")
}
```

Seluruhnya opsional. Prodi yang belum mengisinya tetap sah, dan setiap
tampilan punya perilaku kosong yang jelas (§4).

### I2 — Logo disimpan sebagai bita, bukan URL

Mengikuti `gambar_bab.png` yang sudah ada (docs/17). Alasannya bukan selera:

- **Pencetak butuh bitanya, bukan alamatnya.** `docx` menanam gambar sebagai
  bita di dalam berkas. Kalau yang tersimpan URL, setiap unduhan DOCX berubah
  menjadi permintaan jaringan ke host luar di tengah perakitan dokumen — dan
  host luar yang sedang mati membuat unduhan gagal, atau lebih buruk, berhasil
  tanpa kop.
- **Belum ada penyimpanan objek di proyek ini.** Menambahkannya untuk satu
  logo per prodi adalah biaya operasional yang tidak sebanding.

Aturan penerimaan berkas, ditegakkan server:

| Aturan | Nilai | Alasan |
|---|---|---|
| Jenis | PNG atau JPEG saja | **SVG ditolak.** SVG adalah data tidak tepercaya (AGENTS.md); `svg-aman.ts` ada untuk bahan ajar dan harganya sepadan di sana. Untuk satu logo, tidak. |
| Pemeriksaan jenis | **bita ajaib**, bukan `file.type` | `Content-Type` datang dari peramban dan dapat dikarang. |
| Ukuran berkas | ≤ 512 KB | Logo yang lebih besar dari itu adalah foto, bukan logo. |
| Dimensi | 128–2000 px kedua sisi | Di bawah 128 px kop tercetak buram; di atas 2000 px tidak ada gunanya. |
| Dimensi disimpan | ya (`logoLebar`, `logoTinggi`) | Supaya pencetak dapat menghitung tinggi tampil pada lebar tetap tanpa membongkar bita. |

Penyajiannya lewat satu rute: `GET /api/prodi/[id]/logo`.

```
Content-Type: image/png | image/jpeg
Cache-Control: public, max-age=300, s-maxage=86400
X-Content-Type-Options: nosniff
Content-Disposition: inline
```

Peramban memanggilnya dengan `?v=<diubahPada ms>` sehingga penggantian logo
langsung terlihat meski cache-nya panjang.

> **Rute ini adalah pintu ketiga tanpa login, dan itu disengaja.**
> docs/06 §4.3 menetapkan dua pintu tanpa login yang tertutup rapat pada
> berkasnya masing-masing: `src/lib/publik/muat.ts` (katalog, hanya salinan
> beku `TERBIT`) dan `src/lib/berbagi/muat.ts` (pratinjau bertoken). Rute logo
> tidak menjadi pintu ketiga ke salah satu dari keduanya — ia **tidak boleh
> memanggil satu pun dari kedua berkas itu**, dan ia hanya menyajikan bita
> lambang lembaga: tidak ada isi dokumen, tidak ada kelas, nilai, atau
> evaluasi di baliknya. Logo prodi memang sudah terpampang di gerbang kampus.
> Penjaganya `src/lib/prodi/logo.test.ts`.

### I3 — Visi & misi tidak masuk berkas RPKPS

Template ITTS bagian A–J (docs/02 §1.1) tidak punya tempat untuk visi prodi,
dan menambahkannya berarti mengarang bagian baru pada formulir resmi.

Yang masuk berkas RPKPS hanyalah **kop**: logo, nama institusi, nama prodi,
alamat, telepon, surel, situs. Visi & misi tampil di:

1. **Halaman katalog prodi** `/[bahasa]/katalog/[prodi]` — bagian "Visi & Misi"
   di bawah kepala halaman. Inilah halaman yang dibuka asesor.
2. **Halaman identitas prodi** di dalam aplikasi (§3), sebagai pratinjau
   sekaligus formulirnya.

*Bila nanti diputuskan visi & misi harus ikut tercetak*, tempatnya adalah
**Halaman Pengesahan**, di atas blok tanda tangan — bukan bagian A–J. Itu
keputusan yang belum diambil di konsep ini (§7).

### I4 — Kontak tidak berpasangan `*En`

`alamat`, `telepon`, `surel`, `situs` **tidak** mendapat kolom `*En`.

Alamat pos bukan prosa: ia alat untuk sampai ke tempatnya. "Jalan" yang
diterjemahkan menjadi "Street" membuat amplop tidak sampai dan peta tidak
menemukan. Nomor telepon, surel, dan URL tidak punya terjemahan sama sekali.
Preseden: `institusi.alamat` dan `institusi.situs` sudah begitu.

Yang berpasangan `*En` hanya `visi` dan `misi` — keduanya prosa, keduanya
dibaca asesor internasional di `/en/katalog`.

**Keduanya TIDAK masuk `medanRpkps`/`pasanganTerjemahan`.** Terjemahan AI
(docs/11 §8) melayani isi satu RPKPS; visi prodi bukan isi RPKPS, dan
memasukkannya ke penyebut kelengkapan terjemahan RPKPS akan mengulang persis
bug docs/11 §8.7. Terjemahannya diketik di formulir yang sama, berdampingan,
seperti `namaEn` hari ini.

### I5 — Kop dicetak dari data HIDUP, tidak pernah dibekukan

Ini aturan pentingnya.

`prodi` tidak ada di `proyeksiIsi()` maupun `proyeksiIsiEn()`, dan **tidak
boleh masuk ke sana** — alasannya sama persis dengan profil lulusan,
`arahanAi`, dan hasil evaluasi: proyeksi adalah dasar sidik SHA-256, dan
menambah apa pun ke sana menggeser sidik **seluruh** RPKPS yang sudah terbit
dan memunculkan peringatan pergeseran palsu.

Konsekuensinya lugas dan justru yang diinginkan:

> Prodi pindah gedung, ganti nomor telepon, atau memperbarui logo. Seluruh
> RPKPS terbit — termasuk yang dicetak ulang dari salinan beku — mulai
> tercetak dengan kop yang baru. **Isinya tidak berubah, sidiknya tidak
> bergeser, tanda tangannya tetap sah.** Kop adalah kertasnya, bukan
> naskahnya.

Secara teknis: `rakitDariRpkps` (`src/lib/dokumen/rakit-naskah.ts`) mengambil
kop dari tabel `prodi` **langsung**, walaupun badan dokumennya datang dari
`rpkps_snapshot`. Kop dilewatkan sebagai argumen tersendiri:

```ts
export interface KopProdi {
  institusi: string;      // "Institut Teknologi Tangerang Selatan"
  prodi: string;          // "Program Studi Teknologi Informasi (S1)"
  alamat: string | null;
  telepon: string | null;
  surel: string | null;
  situs: string | null;
  logo: { bita: Buffer; tipe: string; lebar: number; tinggi: number } | null;
}

buatDokumenRpkps(naskah, riwayat, ttd, sidik, bahasa, kop)
```

`NaskahSiap` bertambah satu medan `kop`, sehingga **pratinjau dan berkas
membaca kop yang sama** — janji `rakit-naskah.ts` ("pratinjau tidak boleh
menyimpang dari berkasnya") tetap utuh.

Nama prodi pada kop dipilih dengan `pilihTeks`/`namaMk`-nya prodi: berkas
Inggris memakai `namaEn` bila ada, jatuh ke Indonesia bila kosong — satu arah,
seperti seluruh cadangan tampilan (docs/11 §5.3).

---

## BAGIAN 3 — Antarmuka

### I6 — Halaman `/master/prodi/[id]`

`/master/prodi` hari ini sudah punya formulir tambah + tabel. Nama prodi pada
tabel menjadi tautan ke halaman detail baru.

```
Master · Program Studi / Teknologi Informasi

┌─ Identitas ─────────────────────────────────────────────────┐
│  Nama            [ Teknologi Informasi              ]       │
│  Nama (English)  [ Information Technology           ]       │
│  Kode  [ TI  ]   Jenjang [ S1 ▾ ]   Gelar [ S.Kom. ]        │
│  Akreditasi      [ Unggul                           ]       │
└─────────────────────────────────────────────────────────────┘

┌─ Logo ──────────────────────────────────────────────────────┐
│   ┌────────┐   PNG atau JPEG · maks 512 KB · 128–2000 px    │
│   │  ▣▣▣   │   Tampil pada kop berkas RPKPS dan katalog.    │
│   │  ▣▣▣   │                                                │
│   └────────┘   [ Ganti logo ]  [ Hapus ]                    │
└─────────────────────────────────────────────────────────────┘

┌─ Visi & Misi ───────────────────────────────────────────────┐
│  Visi             [                                 ]       │
│  Visi (English)   [                                 ]       │
│                                                             │
│  Misi                          Misi (English)               │
│  1. [                    ]     1. [                    ]    │
│  2. [                    ]     2. [                    ]    │
│  + Tambah butir                                             │
└─────────────────────────────────────────────────────────────┘

┌─ Kontak ────────────────────────────────────────────────────┐
│  Alamat    [                                        ]       │
│  Telepon   [ +62 21 …     ]   Surel [ ti@itts.ac.id ]       │
│  Situs     [ https://ti.itts.ac.id                  ]       │
│                                                             │
│  Tampil pada kop setiap berkas RPKPS prodi ini —            │
│  termasuk yang sudah terbit. Sidik dokumen tidak berubah.   │
└─────────────────────────────────────────────────────────────┘
```

Kalimat terakhir itu bagian dari rancangannya, bukan hiasan: ia yang membuat
§2.5 dapat dipahami tanpa membaca dokumen ini.

Butir misi diurutkan oleh posisinya di larik; menambah/menghapus/menggeser
butir menulis ulang larik **utuh** — bukan `SET misi[i] = …`, yang
meninggalkan `NULL` yang tidak dapat dibaca `String[]` Prisma (docs/11 §8.6).
Larik `misi` dan `misiEn` boleh berbeda panjang: butir Inggris yang belum ada
tampil kosong, tidak memaksa dosen menerjemahkan seluruhnya sekaligus.

### I7 — Siapa boleh menyunting

Satu fungsi, satu berkas — `src/lib/prodi/wenang.ts`:

```ts
boleh = ADMIN || (KAPRODI di prodi itu)
```

`ADMIN` karena `/master/*` memang miliknya. **`KAPRODI` karena visi dan misi
adalah rumusan prodi, dan meminta dosen menunggu admin untuk memperbaiki satu
kalimat visi adalah cara tercepat membuat medan ini tidak pernah terisi.**

Butir menu `/master/prodi` tetap `["ADMIN"]` — Kaprodi tidak butuh daftar
seluruh prodi. Jalan masuknya dari panel Kaprodi di dasbor (docs/07) menuju
`/master/prodi/<prodi sendiri>` langsung.

`GPM` **tidak** termasuk: cakupannya institusi, tetapi visi prodi bukan
dokumen mutu yang ia sahkan — ia meninjaunya.

### I8 — Katalog publik

- `daftarProdiPublik()` (`src/lib/publik/muat.ts`) ikut memilih `visi`,
  `visiEn`, `misi`, `misiEn`, `situs`, dan **penanda ada-tidaknya logo** —
  bukan bitanya. Menarik 500 KB bita hanya untuk merender daftar kartu adalah
  persis yang dicegah rute `/api/prodi/[id]/logo`.
- Kepala halaman `/katalog/[prodi]`: `gaya.monogramProdi` diganti logo bila
  ada; monogram tetap ada sebagai perilaku kosong.
- Bagian **Visi & Misi** baru, memakai `pilihTeks` untuk `/en`.
- `situsProdi(kode)` dan konstanta `SITUS_PRODI` dihapus; pemanggilnya
  membaca `prodi.situs`. Seed mengisi `TI` dengan nilai lama agar tidak ada
  yang mundur.

### I9 — Kop pada berkas dan pratinjau

`kepala()` di `src/lib/dokumen/rpkps-docx.ts` hari ini mencetak dua baris abu
kecil. Menjadi:

```
┌──────┬────────────────────────────────────────────────┐
│      │  INSTITUT TEKNOLOGI TANGERANG SELATAN          │
│ logo │  Program Studi Teknologi Informasi (S1)        │
│      │  Jl. … · Telp. (021) … · ti@itts.ac.id         │
├──────┴────────────────────────────────────────────────┤   ← garis
│  FORM-RPKPS-01 · Rencana Pembelajaran: <nama MK>      │
└───────────────────────────────────────────────────────┘
```

Tabel dua kolom tanpa garis (lebar logo tetap 2 cm; tingginya dihitung dari
`logoLebar`/`logoTinggi` supaya tidak gepeng), garis bawah hairline, lalu dua
baris kode dokumen yang sudah ada sekarang.

**Kop penuh hanya di halaman pertama tiap `section`.** `titlePage: true` +
`headers.first`; halaman berikutnya memakai kop ringkas (dua baris abu yang
ada hari ini). Logo penuh pada setiap halaman dari tiga `section` membuat
berkas membengkak tanpa menambah keterangan apa pun.

Prodi tanpa logo → tabel jatuh menjadi satu kolom; tidak ada kotak kosong.

`naskah.tsx` (pratinjau) menyalin susunan yang sama, seperti yang sudah
dilakukannya untuk seluruh bagian lain.

---

## BAGIAN 4 — Perilaku kosong

Tidak satu pun medan baru wajib. Yang dijanjikan tiap tampilan saat kosong:

| Tempat | Kosong berarti |
|---|---|
| Kop DOCX | Baris yang datanya kosong **dihilangkan**, bukan dicetak sebagai "-". Prodi tanpa logo → kop satu kolom. |
| Katalog prodi | Bagian Visi & Misi tidak dirender sama sekali. Monogram huruf menggantikan logo. |
| Halaman identitas | Medan kosong dengan teks bantu; tidak ada peringatan. Ini bukan validator RPKPS. |

Tidak ada temuan validator baru. Identitas prodi tidak menghalangi pengajuan
maupun pengesahan satu pun RPKPS — kalau ia melakukannya, seluruh prodi yang
belum sempat mengisinya kehilangan akses ke aplikasinya sendiri.

---

## BAGIAN 5 — Yang harus dijaga

Daftar ini yang masuk ke AGENTS.md bila konsep disetujui.

1. **Identitas prodi tidak pernah masuk `proyeksiIsi()`, `proyeksiIsiEn()`,
   maupun `rpkps_snapshot`.** Kop adalah kertas, bukan naskah. Penjaganya
   `src/domain/rpkps/proyeksi.test.ts` yang sudah mengunci sidik dokumen
   contoh sebagai nilai harfiah — bila ia gagal setelah pekerjaan ini, yang
   salah pekerjaannya, bukan angkanya.
2. **Rute logo tidak memanggil `lib/publik/muat.ts` maupun
   `lib/berbagi/muat.ts`,** dan keduanya tidak memanggilnya. Penjaganya
   `src/lib/prodi/logo.test.ts`, sebangun dengan `berbagi/pintu.test.ts`.
3. **Jenis berkas logo diputuskan dari bita ajaib, bukan dari `Content-Type`.**
4. **SVG tidak diterima sebagai logo.**
5. **`alamat`, `telepon`, `surel`, `situs` tidak berpasangan `*En`; `visi`
   dan `misi` wajib berpasangan** — dan keduanya tetap di luar `medanRpkps`.
6. **Larik `misi` ditulis utuh,** tidak per indeks.
7. **`SITUS_PRODI` dihapus,** bukan dibiarkan sebagai cadangan.
8. Perubahan identitas tercatat `log_audit` sebagai `PRODI_IDENTITAS_DIUBAH`
   dengan `ringkasan` berbahasa Indonesia selamanya (docs/11 §4.2).

---

## BAGIAN 6 — Urutan kerja

| # | Langkah | Berkas |
|---|---|---|
| 1 | Skema + migrasi | `prisma/schema.prisma`, `prisma/migrations/2026…_identitas_prodi/` |
| 2 | Domain murni: pemeriksaan logo (bita ajaib, ukuran, dimensi) dan perapian kontak | `src/domain/kurikulum/identitas-prodi.ts` + uji |
| 3 | Wewenang | `src/lib/prodi/wenang.ts` |
| 4 | Aksi server + Zod berkunci | `src/app/[bahasa]/(app)/master/aksi-identitas.ts` |
| 5 | Rute logo + ujinya | `src/app/api/prodi/[id]/logo/route.ts`, `src/lib/prodi/logo.test.ts` |
| 6 | Halaman + formulir | `src/app/[bahasa]/(app)/master/prodi/[id]/` |
| 7 | Kamus `id.ts`/`en.ts` | `src/kamus/` |
| 8 | Kop DOCX + pratinjau | `rpkps-docx.ts`, `rakit-naskah.ts`, `siapkan-unduhan.ts`, `naskah.tsx`, `label.ts` |
| 9 | Katalog publik + pensiunkan `SITUS_PRODI` | `lib/publik/muat.ts`, `lib/publik/tautan.ts`, `katalog/[prodi]/page.tsx` |
| 10 | Seed + AGENTS.md | `prisma/seed.ts`, `AGENTS.md` |

Langkah 1–7 berdiri sendiri: setelah itu medan sudah dapat diisi dan terlihat
di aplikasi. Langkah 8–9 yang membuatnya tercetak dan terbit.

---

## BAGIAN 7 — Keputusan yang sudah diambil

| # | Pertanyaan | Keputusan |
|---|---|---|
| 1 | Visi & misi ikut tercetak di DOCX RPKPS? | **Tidak.** Katalog publik dan halaman identitas prodi saja (§2.3 berlaku apa adanya). |
| 2 | Kop dipasang di berkas lain? | **Ya, ketiganya.** RPKPS, buku ajar (`buku-ajar-docx.ts`), dan portofolio kelas (`portofolio-docx.ts`). |
| 3 | Logo institusi ikut dibereskan? | **Ya.** `institusi.logoUrl` — kolom yang tidak pernah diisi maupun dibaca satu baris kode pun — diganti `logo`/`logoTipe`/`logoLebar`/`logoTinggi` yang sebangun dengan logo prodi. Kop memakai KEDUANYA: lambang institut di kiri, lambang prodi di kanan. |
| 4 | Siapa boleh menyunting? | **ADMIN + KAPRODI prodi itu** (§3.2). Identitas institusi tetap ADMIN saja — ia bukan milik satu prodi. |

Akibat keputusan 2 dan 3 terhadap BAGIAN 6: langkah 8 bertambah dua berkas
cetak, dan langkah 1 bertambah tabel `institusi`. Kop dirakit SATU KALI oleh
`src/lib/dokumen/kop.ts` dan dipakai ketiga pencetak — bukan disalin tiga kali,
atau ketiganya akan menyimpang pelan-pelan seperti yang sudah dicegah
`rakit-naskah.ts` untuk isi dokumen.
