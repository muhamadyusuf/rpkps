# Dwibahasa: Antarmuka dan Isi RPKPS

> Status: **TERPASANG SELURUHNYA — L1–L7 (31 Agustus 2026).**
> Menjawab dua kebutuhan yang sering dikira satu: (a) *antarmuka* aplikasi
> harus dapat dibaca dalam bahasa Inggris, dan (b) *dokumen RPKPS* harus
> tersedia dalam dua bahasa. Keduanya berbeda sifat, berbeda tempat
> penyimpanan, dan berbeda pemiliknya — dikerjakan bersama karena satu
> saklar yang sama menyalakannya.

## BAGIAN 1 — Dua lapisan yang tidak boleh tertukar

| | Antarmuka | Isi |
|---|---|---|
| Contoh | "Simpan", "Total bobot harus 100%", "Menunggu pengesahan" | topik pertemuan, rumusan Sub-CPMK, uraian tugas |
| Pemilik | pengembang | dosen / kurikulum |
| Tempat | berkas kamus di repositori | kolom database |
| Kelengkapan | dijamin `tsc` — kunci hilang = gagal kompilasi | tidak dijamin; boleh kosong dan jatuh ke bahasa Indonesia |
| Berubah saat | rilis aplikasi | dosen menyunting |

Kesalahan yang paling mahal di proyek i18n adalah mencampur keduanya:
menaruh nama mata kuliah di berkas kamus, atau menaruh label tombol di
database. Aturannya sederhana — **kalau kalimat itu tidak berubah antar
RPKPS, ia milik kamus; kalau berubah, ia milik database.**

Ada lapisan ketiga yang mudah terlewat dan justru paling sering salah:
**kalimat yang lahir di domain** — pesan temuan validator, judul notifikasi,
label enum. Bentuknya seperti isi (dirakit saat berjalan, memuat angka dan
nama) tetapi pemiliknya pengembang. Lapisan itu ditangani BAGIAN 4.

## BAGIAN 2 — Bahasa datang dari alamat

### 2.1 Setiap alamat berawalan bahasa

```
/id/rpkps/abc123          /en/rpkps/abc123
/id/katalog/TI/TI214      /en/katalog/TI/TI214
```

Tidak ada bentuk tanpa awalan. Bahasa Indonesia pun memakai `/id/`.

Alasannya bukan estetika. Kalau bahasa bawaan tidak berawalan, setiap tautan
punya dua bentuk sah (`/rpkps` dan `/id/rpkps`), dan setiap fungsi yang
menyusun alamat harus tahu mana bahasa bawaan. Itu percabangan yang akan
dilupakan seseorang, di suatu tempat, pada tahun ketiga. Satu bentuk saja
lebih murah untuk dijaga — dan membuat `revalidatePath`, `sitemap`, serta
`hreflang` menjadi hitungan yang lurus.

Konsekuensinya seluruh pohon rute pindah:

```
src/app/[bahasa]/(app)/…        ← dulu src/app/(app)/…
src/app/[bahasa]/(publik)/…     ← dulu src/app/(publik)/…
src/app/[bahasa]/layout.tsx     ← tata letak akar, pemegang <html lang>
src/app/api/…                   ← TIDAK pindah
src/app/sitemap.ts, robots.ts   ← TIDAK pindah
```

`src/app/api` tetap di akar dan tidak tertelan `[bahasa]` karena ruas statis
menang atas ruas dinamis pada pencocokan rute Next. Route Handler juga tidak
dapat membaca root params, jadi bahasa untuk unduhan datang dari kueri
(`?bahasa=en`) — lihat BAGIAN 7.

> **Memindahkan pohon rute: matikan `next dev` dulu, lalu hapus `.next/`.**
> Turbopack menyimpan *loader tree* hasil pemindaian direktori di dalam cache
> inkrementalnya. Memindahkan seluruh `app/` selagi server berjalan membuat
> cache itu menunjuk ruas yang tidak ada lagi, dan gejalanya BUKAN pesan yang
> menolong: mula-mula alamat yang sah menjawab 404, lalu Turbopack panik
> dengan `Cell … no longer exists in task … directory_tree_to_loader_tree`.
> Tidak ada yang salah pada kode — `npm run typecheck` tetap bersih sepanjang
> waktu, dan itulah yang membuatnya membingungkan. Obatnya `rm -rf .next`.
> Berlaku lagi di L5, yang menyentuh rute katalog publik.

### 2.2 Alamat lama tetap hidup

`src/proxy.ts` bertambah satu tugas di depan tugasnya yang sekarang:

1. Alamat sudah berawalan bahasa yang dikenal → teruskan.
2. Belum → tentukan bahasa, lalu **alihkan** (307) ke alamat berawalan.

Urutan penentuan bahasa:

| Urutan | Sumber | Alasan |
|---|---|---|
| 1 | cookie `bahasa` | pilihan yang pernah dinyatakan orang itu, di peramban itu |
| 2 | header `Accept-Language` | tebakan pertama yang sopan untuk tamu |
| 3 | `id` | ini aplikasi kampus Indonesia |

Preferensi tersimpan di `Pengguna.bahasa` sengaja **tidak** dibaca di proxy:
firebase-admin tidak jalan di runtime Edge dan proxy tidak menyentuh basis
data — aturan yang sudah berlaku di berkas itu.

Penyelarasannya terjadi di **satu titik saja: `src/app/api/sesi/route.ts`**.
Itu bukan pilihan gaya, melainkan satu-satunya tempat yang memenuhi kedua
syarat sekaligus — boleh menyentuh basis data (runtime Node) dan boleh
memasang cookie (Route Handler). Proxy gugur pada syarat pertama, Server
Component pada syarat kedua. Kebetulan yang menguntungkan: rute itu dilewati
tepat sekali, yaitu saat masuk. Sejak titik itu dosen yang membuka aplikasi
dari komputer lab langsung mendapat bahasanya sendiri, dan `masukDenganGoogle`
mengembalikan bahasa tersebut supaya pengalihan sesudah masuk tidak sempat
mampir ke bahasa yang salah.

### 2.3 Membaca bahasa di kode

| Tempat | Cara |
|---|---|
| Server Component, utilitas server | `await bahasa()` dari `next/root-params` |
| Client Component | `useBahasa()` dari `PenyediaBahasa` |
| Server Action | `bahasaAksi()` / `kamusAksi()` (cookie) — root params **tidak** tersedia di sana |
| Route Handler | kueri `?bahasa=` |

Batasan Server Action itu penting dan bukan pilihan kita: `next/root-params`
tidak berjalan di Server Action. Aksi yang perlu menyusun kalimat (mis. galat
yang dikembalikan ke formulir) membaca cookie `bahasa` lewat pembungkus
`bahasaAksi()` di `src/lib/bahasa/server.ts`.

### 2.4 Tautan tidak ditulis manual

Ada ±100 `href` internal di `src/`. Menuliskan awalan pada masing-masing
adalah undangan untuk lupa. Karena itu:

```ts
// src/components/tautan.tsx — pengganti next/link untuk alamat internal
<Tautan href="/rpkps/abc">…</Tautan>   // → /id/rpkps/abc atau /en/rpkps/abc
```

`Tautan` membaca bahasa dari context dan memasang awalan. Pembaruan pada
berkas-berkas rute karenanya hanya mengganti baris `import` — bukan
menyunting setiap `href`.

Tiga pelengkapnya, untuk tempat yang tidak melewati komponen:

| Kebutuhan | Alat |
|---|---|
| `router.push` / `router.replace` di klien | `const { jalur } = useBahasa()` |
| `redirect()` di server | `redirect(await jalurAktif("/masuk"))` |
| menandai butir menu yang aktif | `useJalurTanpaBahasa()` |

`jalurAktif` sengaja **bukan** pembungkus `redirect` sendiri. `redirect()`
bertipe kembali `never`, dan TypeScript memakai itu untuk mempersempit tipe di
baris sesudahnya — `if (!sesi) redirect(…)` membuat `sesi` menjadi bukan-null
tanpa tanda seru. Pembungkus `async` merusak penyempitan itu, karena yang
terlihat kompilator adalah `await`, bukan pemanggilan yang tak pernah kembali.

`useJalurTanpaBahasa()` menjawab kegagalan senyap di arah sebaliknya:
`usePathname()` kini mengembalikan `/en/rpkps` sedangkan navigasi
membandingkannya dengan `href` yang ditulis tanpa bahasa. Tanpa pelepasan
awalan, tidak ada satu pun butir menu yang pernah tampak aktif — dan tidak
ada yang gagal, hanya penanda modul yang tidak pernah menyala.

### 2.5 `revalidatePath` menyentuh dua bahasa

Ada 105 pemanggilan `revalidatePath` di aksi-aksi server. Setelah alamat
berawalan, `revalidatePath("/rpkps")` tidak lagi cocok dengan apa pun.

```ts
// src/lib/bahasa/segarkan.ts
export function segarkan(...daftarJalur: string[]): void {
  for (const href of daftarJalur) {
    for (const berbahasa of segalaBahasa(href)) revalidatePath(berbahasa);
  }
}
```

Dua panggilan, deterministik, tanpa mengandalkan pencocokan pola. Seluruh
`revalidatePath` internal diganti `segarkan`.

ESLint menjaga keduanya lewat `no-restricted-imports` di `src/app` dan
`src/components`: `next/link` dan `revalidatePath` ditolak, masing-masing
dengan pesan yang menyebut penggantinya. Keduanya dipagari karena gagal
**secara senyap** — kode tetap dikompilasi, tetap dirender, dan hanya salah
saat dijalankan. Tidak ada uji yang menangkapnya.

### 2.6 Halaman publik dan mesin pencari

Katalog publik adalah satu-satunya bagian yang dibaca mesin pencari, dan
justru bagian yang paling butuh dua bahasa (calon mahasiswa asing, mitra,
asesor internasional).

- `generateStaticParams` di tata letak akar menghasilkan `id` dan `en`,
  sehingga halaman katalog tetap dapat dirender statis untuk keduanya.
- Setiap halaman katalog memasang `alternates.languages` (hreflang) yang
  menunjuk pasangannya, plus `x-default` ke `/id/…`. **Menyusul di L5**,
  bersama katalog berbahasa Inggris yang membacanya dari `isiEn`; sebelum
  ada isi Inggris, hreflang per halaman belum punya yang ditunjuk.
- `sitemap.ts` menerbitkan kedua alamat. **Dikerjakan di L1, bukan L5**:
  begitu alamat berawalan, setiap baris peta situs yang telanjang dijawab
  pengalihan 307 — perayap memperlakukan itu sebagai alamat non-kanonik dan
  sinyal peringkatnya terpencar. Hal yang sama berlaku untuk `robots.ts`,
  yang daftar `disallow`-nya kini dilebarkan per bahasa.
- `opengraph-image.tsx` mengikuti bahasa ruasnya.

## BAGIAN 3 — Kamus antarmuka

### 3.1 Kelengkapan dijamin kompilator, bukan disiplin

```
src/kamus/id.ts     ← sumber kebenaran; seluruh kunci lahir di sini
src/kamus/en.ts     ← const en: typeof id = { … }
src/kamus/index.ts  ← pemilih + tipe Bahasa
```

`en.ts` bertipe `typeof id`. Menambah kunci di `id.ts` tanpa menambahnya di
`en.ts` **menggagalkan `npm run typecheck`**. Inilah jawaban atas permintaan
"pastikan semua konten benar-benar dwibahasa": bukan janji, melainkan pagar
yang ditegakkan mesin.

Yang tidak dijamin kompilator adalah teks Indonesia yang lupa dipindahkan ke
kamus dan masih tertanam di JSX. Untuk itu ada penjaga kedua: skrip
`npm run periksa:kamus` memindai `src/app` dan `src/components` untuk literal
yang mengandung huruf berulang khas Indonesia di posisi teks JSX. Tidak
sempurna, tetapi menangkap kelalaian massal.

### 3.2 Nilainya string, bukan fungsi

```ts
export const id = {
  umum: { simpan: "Simpan", batal: "Batal" },
  rpkps: {
    judul: "RPKPS",
    menunggu: "{jumlah} dokumen menunggu pengesahan",
    pertemuan: { satu: "{n} pertemuan", banyak: "{n} pertemuan" },
  },
} as const;
```

Kamus wajib berupa data yang dapat diserialisasi — kalau nilainya fungsi,
kamus tidak dapat dilewatkan dari Server Component ke Client Component sama
sekali. Interpolasi memakai penanda `{nama}`:

```ts
t("rpkps.menunggu", { jumlah: 4 })
```

Jamak ditangani pasangan `satu` / `banyak` yang dipilih `Intl.PluralRules`.
Bahasa Indonesia tidak mengenal infleksi jamak sehingga kedua nilainya sama
persis; itu bukan pemborosan, melainkan biaya agar `en.ts` dapat menuliskan
"1 meeting" dan "12 meetings" tanpa bercabang di pemanggil.

### 3.3 Sisi klien hanya menerima yang dipakai

`PenyediaBahasa` dipasang di tata letak akar dan menerima **kamus utuh**
sebagai prop — nilainya string semua, jadi aman menyeberang dan dikompresi
baik. Client Component memakai `useBahasa()`; tidak ada yang mengimpor
`src/kamus/*` langsung dari komponen klien, supaya kedua kamus tidak ikut
terbundel dua kali.

### 3.4 Angka, tanggal, dan kata benda milik institusi

- Tanggal: `src/lib/bahasa/format.ts` menggantikan 12 pemanggilan
  `toLocaleDateString("id-ID", …)` yang tersebar. Locale mengikuti bahasa
  aktif (`id-ID` / `en-US`).
- Angka dan persen: `Intl.NumberFormat` dengan locale yang sama. Perhatikan
  pemisah desimal berbeda (`85,5` vs `85.5`) — bobot penilaian tercetak,
  jadi ini terlihat.
- **Yang tidak diterjemahkan:** akronim yang merupakan istilah resmi —
  RPKPS, CPL, CPMK, Sub-CPMK, SKS, NIDN, KKNI, OBE. Pada bahasa Inggris
  akronim tetap, dengan kepanjangan Inggris di penjelas saat pertama muncul
  ("CPMK — Course Learning Outcomes"). Menerjemahkan akronimnya akan
  memutuskan dokumen dari peraturan yang menaunginya.

## BAGIAN 4 — Kalimat yang lahir di domain

Ini bagian yang paling mudah terlewat. `src/domain` harus tetap murni
(tanpa Prisma, tanpa React) — dan sekarang juga **tanpa kalimat jadi**.

### 4.1 Temuan validator: kode dan parameter, bukan kalimat

**Terpasang (31 Agustus 2026).** Dulu:

```ts
temuan.push({
  kode: "B1-BOBOT-MINGGUAN",
  tingkat: "PEMBLOKIR",
  pesan: `Total bobot pada tabel mingguan ${total}%, seharusnya 100%.`,
  saran: `Kurangi ${lebih}% dari salah satu pertemuan.`,
});
```

Sekarang:

```ts
temuan.push({
  kode: "B1-BOBOT-MINGGUAN",
  tingkat: "PEMBLOKIR",
  params: { total, selisih: bulatkan(Math.abs(total - 100), 2) },
});
```

Kalimatnya hidup di `src/kamus/temuan-id.ts` dan `temuan-en.ts` — 127 kode,
berkunci kode temuan apa adanya, sehingga menelusuri dari layar ke aturan yang
memunculkannya cukup dengan mencari kodenya. `teksTemuan(temuan, kam)`
(`src/lib/bahasa/temuan.ts`) merakitnya saat dibaca.

Ketiga tipe temuan — `TemuanRpkps`, `TemuanKurikulum`, `TemuanValidasi` —
kehilangan medan `pesan` dan `saran` sepenuhnya. Itu disengaja: selama medan
itu masih ada, akan selalu ada satu tempat yang mengisinya dengan kalimat
Indonesia dan lolos tanpa gejala.

#### Durasi adalah angka, bukan "2 jam 30 menit"

`formatMenit()` menghasilkan kalimat Indonesia. Memasukkan hasilnya ke `params`
akan menyelundupkan bahasa penulis validator ke layar pembaca berbahasa Inggris
lewat pintu belakang — `tsc` tidak bisa melihatnya, karena keduanya `string`.
Karena itu params boleh bertanda:

```ts
export type ParamTemuan = string | number | { menit: number };
```

`teksTemuan` merakit `{ menit: 150 }` menjadi "2 jam 30 menit" atau "2 hours
30 minutes" lewat `durasi()` di `src/lib/bahasa/format.ts`, yang mengambil kata
"jam" dan "menit" dari kamus. `formatMenit` tetap ada untuk hitungan internal.

#### Satu kode per aturan

Tiga tempat memakai satu kode untuk beberapa kalimat berbeda —
`U-RALAT-BUKAN-EJAAN` untuk empat aturan, `U-KODE-DIPAKAI` untuk dua,
`U-SUB-KODE-KOSONG` untuk dua — dan `B1`/`B5`/`L1`/`L2` memilih kalimat lewat
ternary di dalam `pesan`. Kamus berkunci kode memaksa semuanya dipecah, dan
itu perbaikan tersendiri: kode yang dipakai bersama menghapus satu-satunya
petunjuk mengapa sebuah usulan ditolak. Uji yang tadinya menyebut satu kode
untuk tiga aturan sekarang menyebut aturannya masing-masing.

#### Uji domain menjadi lebih baik, bukan lebih lemah

Empat puluh dua assertion menguji susunan kata (`t.pesan.includes("baris 2 dan
4")`). Semuanya dipertahankan lewat `pesanTemuanId(t)` — perender kamus
Indonesia. Hasilnya bukan sekadar assertion yang selamat: rendering itu
sekarang membuktikan bahwa nama penanda pada kamus benar-benar diisi oleh
`params` aturannya. Penanda yang salah nama lolos `tsc` — keduanya `string` —
tetapi tertinggal utuh sebagai `{daftar}` di hasil render, dan di situlah uji
menangkapnya.

Tiga penjaga lain di `src/lib/bahasa/temuan.test.ts`: setiap kode yang
dihasilkan domain harus ada di **kedua** kamus; penanda kedua bahasa harus sama
persis; dan tidak boleh ada kalimat Inggris yang masih identik dengan
Indonesianya.

#### Yang menerima kalimat jadi

`konteksPerbaikan()` menyusun prompt AI dan memang perlu kalimatnya. Ia
sekarang menerima temuan yang SUDAH berkalimat, dan pemanggilnya
(`kurikulum/aksi-ai.ts`) merender dengan kamus Indonesia — bahasa buku
kurikulum yang sedang diperbaiki, bukan bahasa antarmuka pemanggilnya.

### 4.2 Notifikasi dirender saat dibaca, bukan saat ditulis

**Terpasang (31 Agustus 2026).** Dulu `susunNotifikasi(peristiwa)` mengembalikan
`judul` dan `ringkasan` sebagai kalimat jadi, dan kalimat itulah yang tersimpan.
Artinya bahasa notifikasi terkunci pada bahasa **penulis** saat peristiwa
terjadi — dosen yang memakai antarmuka Inggris tetap membaca "RPKPS TI214
menunggu pengesahan".

```prisma
model Notifikasi {
  jenis     JenisNotifikasi
  data      Json?    // { kunci, params }
  judul     String   // cadangan bahasa Indonesia
  ringkasan String
}
```

`susunNotifikasi` sekarang menghasilkan `kunci` + `params`; `teksNotifikasi`
(`src/lib/bahasa/notifikasi.ts`) merakit kalimatnya saat dibaca.

**`kunci` bukan `jenis`.** Satu jenis peristiwa dapat berbunyi dua cara: seorang
pengampu dikabari berbeda ketika ia koordinator, penugasan koordinator berbunyi
lain ketika RPKPS-nya belum ada, dan keputusan usulan berbunyi lain tanpa
catatan. Jenis adalah enum basis data yang menandai peristiwanya; kunci menandai
kalimatnya. Sembilan jenis menjadi dua belas kunci.

**Kata keputusan datang dari kamus.** `KEPUTUSAN[p.keputusan]` yang dulu
menyisipkan "dikembalikan untuk revisi" ke dalam judul pindah menjadi
`kamus.keputusanUsulan` — enum, bukan kalimat.

**Baris lama tidak ditulis ulang.** `data` nullable; baris tanpa `data` memakai
`judul`/`ringkasan` yang tersimpan. Ia kehilangan kemampuan berganti bahasa, dan
itu harga yang wajar untuk migrasi tanpa risiko. Cadangan itu juga tetap ditulis
untuk baris baru: bila suatu saat sebuah kunci hilang dari kamus, notifikasi
lama tetap punya isi.

### 4.2b Pesan pemeriksaan Zod: kunci, bukan kalimat

Skema Zod adalah konstanta lingkup modul — disusun sekali saat berkas dimuat,
jauh sebelum ada permintaan, dan karenanya jauh sebelum ada bahasa. Dua jalan
keluar yang tampak wajar, keduanya buruk:

- menjadikannya pabrik `(kam) => z.object(…)` merusak `z.infer<typeof Skema>`
  di setiap pemanggil dan menyusun ulang seluruh skema pada tiap permintaan;
- membiarkan kalimatnya di tempat berarti borang berbahasa Inggris menolak
  masukan dengan kalimat Indonesia.

Yang dipakai: skema menulis **kunci** berawalan `@`, dan kalimatnya dirakit di
tempat pesan itu dilaporkan — di sana kamus sudah ada.

```ts
const Skema = z.object({
  nama: z.string().trim().min(2, "@aksi.periksa.namaMinimal"),
});
…
if (!urai.success) return { ok: false, pesan: pesanZod(urai.error, kam) };
```

`pesanZod` (`src/lib/bahasa/zod.ts`) menerjemahkan kunci `@…`, melewatkan
pesan bawaan Zod apa adanya, dan mengisi `{n}` dari **batas skema itu sendiri**
(`issue.minimum`/`issue.maximum`) — bukan dari angka yang ditulis ulang di
kamus, yang akan berbohong pada hari seseorang mengubah `.min(20)`.

Kunci itu hidup sebagai string, jadi salah ketik lolos dari `tsc`; gejalanya
cuma "Data tidak valid." di layar dosen, berbulan-bulan. Penjaganya sebuah uji
(`src/lib/bahasa/zod.test.ts`) yang memindai seluruh `src/app` dan menuntut
setiap kunci `@` ada di **kedua** kamus.

### 4.2c Riwayat RPKPS: peristiwa, bukan kalimat

**Terpasang (31 Agustus 2026).** `rpkps_riwayat.deskripsi` dibaca ulang
berbulan-bulan setelah ditulis — di ikhtisar RPKPS, di ekspor DOCX, dan di
**katalog publik** — oleh orang yang belum tentu penulisnya. Merangkai
kalimatnya saat menulis membuat satu RPKPS berakhir dengan riwayat separuh
Indonesia separuh Inggris, bergantung siapa yang kebetulan menekan tombolnya.

Bentuknya sama dengan notifikasi: kolom `data Json?` berisi `{ kunci, params }`,
`deskripsi` tetap ada sebagai cadangan. Enam belas kunci di `kamus.riwayat`,
disusun `riwayat()` (`src/domain/rpkps/riwayat.ts`) dan ditulis
`barisRiwayat()` (`src/lib/rpkps/riwayat.ts`) yang mengisi kedua kolom
sekaligus. Sebelas tempat menulis riwayat, semuanya lewat satu pintu itu.

#### Salinan beku tidak pernah ditulis ulang

Riwayat ikut membeku ke dalam `rpkps_snapshot.isi`, dan snapshot yang dibuat
sebelum L3 tidak punya `data`. Snapshot itu **tidak** ditulis ulang: menyentuh
isi dokumen terbit adalah persis yang dilarang. Halaman publiknya jatuh ke
`deskripsi` bahasa Indonesia, dan itu memang dokumen yang ditandatangani.
Snapshot baru membekukan keduanya, jadi dokumen yang terbit setelah ini dapat
menampilkan riwayatnya dalam bahasa pembaca.

Sidiknya sendiri tidak tersentuh: `sidik` datang dari `sidikDokumen()` di atas
`proyeksiIsi`, bukan dari `isi` snapshot. Riwayat menumpang di salinan beku
tanpa pernah masuk ke ruang sidik.

#### `log_audit.ringkasan` tetap bahasa Indonesia

Tiga belas berkas aksi menulis `log_audit.ringkasan`, dan tidak satu pun
disentuh. Ia jejak audit: bahasanya satu, tetap, dan bukan urusan preferensi
pembaca.

### 4.3 Label enum

`LABEL_PERAN`, `LABEL_PENYEDIA`, `LABEL_BENTUK`, `LABEL_KATEGORI`,
`LABEL_STATUS`, `LABEL_JENIS`, `LABEL_DASAR`, `LABEL_STATUS_BUTIR` — semua
`Record<Enum, string>` berpindah ke kamus sebagai objek berkunci enum.
Tipenya tetap dijaga: `Record<Peran, string>` di kedua kamus, sehingga
menambah nilai enum baru di Prisma memaksa dua terjemahan sekaligus.

## BAGIAN 5 — Isi RPKPS dwibahasa

### 5.1 Kolom cermin `*En`

Skema **sudah** memulai konvensi ini dan meninggalkannya setengah jalan:
`Cpl.deskripsiEn`, `MataKuliah.namaEn`, `Cpmk.rumusanEn`,
`SubCpmk.rumusanEn`, `ButirUsulan.rumusanEn` ada di basis data tetapi tidak
dipakai satu baris pun di kode. Rencana ini melanjutkannya, bukan
menggantinya — dan §5.1b menuntaskan empat di antaranya.

Kolom baru, semuanya `String?` (atau `String[]`) dan **selalu opsional**:

| Tabel | Kolom baru |
|---|---|
| `mata_kuliah` | `deskripsi_en` |
| `profil_lulusan` | `deskripsi_en` |
| `bahan_kajian` | `nama_en`, `deskripsi_en` |
| `rpkps` | `deskripsi_en`, `kalimat_pembuka_cpmk_en`, `catatan_evaluasi_en` |
| `pertemuan` | `topik_en`, `subtopik_en[]`, `metode_narasi_en`, `aktivitas_dosen_en`, `aktivitas_mahasiswa_en`, `tugas_terstruktur_en`, `penilaian_jenis_en`, `penilaian_sistem_en` |
| `aktivitas_belajar` | `nama_en` (`metode_en` **tidak** — lihat §5.1a) |
| `indikator` | `teks_en` |
| `komponen_nilai` | `nama_en` |
| `pertemuan_pustaka` | `catatan_en` |
| `tugas` | `nama_en`, `deskripsi_en`, `uraian_tugas_en`, `format_luaran_en`, `ketentuan_lain_en` |
| `kriteria_tugas` | `indikator_en`, `rincian_en[]` |
| `linimasa_tugas` | `tahapan_en`, `aktivitas_en` |
| `kisi_kisi` | `catatan_en` |
| `butir_kisi_kisi` | `indikator_en` |
| `prodi`, `fakultas`, `institusi` | `nama_en` |

#### 5.1a Kolom yang tidak dicerminkan

Tiga tempat sengaja TIDAK mendapat kolom `*_en`, semuanya karena alasan yang
sama: kolom Indonesianya sendiri belum punya penulis maupun pembaca, sehingga
kembarannya tak akan pernah bisa diisi siapa pun — dan penjaga muatan simpan
(§5.3) akan gagal selamanya tanpa ada yang dapat memperbaikinya.

| Kolom | Keadaan |
|---|---|
| `aktivitas_belajar.metode` | Tidak ditulis penyunting mana pun, tidak dibaca satu tampilan pun |
| `rpkps.catatan_evaluasi` | Sama; juga tidak masuk `proyeksiIsi` |
| seluruh `bahan_kajian` | Tabelnya sendiri belum dipakai sama sekali |

Ketiganya ditemukan oleh penjaga, bukan oleh mata: yang pertama saat penjaga
§5.3 dipasang, dua sisanya saat daftar model penjaga itu diperluas ke `Rpkps`
dan seluruh kolom `*En` disapu terhadap penulisnya. Bila suatu hari salah
satunya mendapat penyunting, kembarannya menyusul bersamaan.

**Yang sengaja TIDAK diterjemahkan:**

- `pustaka.teks` — entri bibliografi. Judul buku tidak diterjemahkan;
  menerjemahkannya justru membuat sitasi tidak dapat dilacak.
- `mata_kuliah.kode`, kode CPL/CPMK/Sub-CPMK, `tahun_akademik.kode` —
  pengenal, bukan kalimat.
- Nama orang, NIDN, NIP.
- `catatan_usulan.isi`, `dasar_butir.kutipan`, `temuan_evaluasi.akar_masalah`
  — percakapan dan kesaksian antar manusia. Menerjemahkannya berarti
  memalsukan apa yang ditulis orang.

#### 5.1b Lapisan kurikulum: kolom lama yang akhirnya punya penyunting

**Terpasang (1 September 2026.)** Lima kolom yang disebut di awal §5.1 sebagai
"ada di basis data tetapi tidak dipakai satu baris pun" sekarang dapat diisi:

| Tabel | Kolom | Penyuntingnya |
|---|---|---|
| `mata_kuliah` | `nama_en`, `deskripsi_en` | `kurikulum/aksi-mk.ts` + tabel MK |
| `cpl` | `deskripsi_en` | `kurikulum/aksi-cpl.ts` |
| `cpmk` | `rumusan_en` | `kurikulum/aksi-cpmk.ts` |
| `sub_cpmk` | `rumusan_en` | `kurikulum/aksi-cpmk.ts` |

Borangnya memakai `AreaTeksDwibahasa` (`src/components/dwibahasa.tsx`) —
sepupu tak terkendali dari `Medan`, karena borang kurikulum membaca isinya
dari `FormData`, bukan dari state. Bentuk berdampingannya sama: Indonesia di
kiri sebagai acuan, Inggris di kanan.

**Gerbangnya tidak dilonggarkan.** Ketiga aksi tetap melewati
`pastikanWenangSunting` (kurikulum DRAF saja), dan `perbaruiMataKuliah` tetap
melewati `periksaKelayakanUbahMk`. Artinya nama Inggris sebuah mata kuliah
tidak dapat lagi diubah setelah RPKPS-nya punya salinan beku — dan itu
disengaja: `nama_en` masuk ruang sidik kedua lewat `proyeksiIsiEn()`, jadi
menggesernya pada dokumen terbit persoalannya sama dengan menggeser sidik
Indonesianya (§6.2). Konsekuensinya jujur dan perlu diketahui: mata kuliah
yang RPKPS-nya sudah terbit baru bisa mendapat nama Inggris pada kurikulum
berikutnya.

**Menampilkannya selalu lewat `namaMk()`** (`src/lib/bahasa/teks.ts`), bungkus
sebaris untuk `pilihTeks` yang dipakai ±20 tempat: kepala halaman RPKPS,
daftar RPKPS, peta semester, papan koordinator, dasbor dosen, dan pemilih mata
kuliah pada usulan serta salin RPKPS. Aturan lapisannya: **pemuat data
mengembalikan KEDUA kolom, yang memilih bahasa adalah tampilan.** Karena itu
`BarisPenugasan`, `BarisRpkpsDosen`, dan `SasaranSalin` bertambah `namaEn`
alih-alih memanggil `bahasaAktif()` di dalam pemuatnya — pemuat yang sama juga
dipakai jalur yang tidak punya bahasa alamat.

**Pencarian ikut kolom Inggris.** Kotak cari pada `/rpkps`, `/usulan`, dan
papan koordinator menambahkan `namaEn` ke `OR`-nya. Tanpa itu pembaca
antarmuka Inggris mengetik nama yang dilihatnya di layar dan tidak menemukan
apa pun.

Penjaganya `src/lib/kurikulum/terjemahan.test.ts`. Bentuknya sama dengan
penjaga §5.3, kegagalan yang dijaganya berbeda: di lapisan kurikulum kolom
yang tertinggal dari skema Zod tidak terhapus, ia hanya tidak akan pernah
dapat diisi siapa pun — kegagalan yang lebih senyap lagi, dan persis nasib
`mata_kuliah.nama_en` selama ini.

**Yang masih menganggur setelah ini:** `profil_lulusan.deskripsi_en`,
`bahan_kajian.nama_en`/`deskripsi_en`, dan `butir_usulan.rumusan_en` —
ketiganya belum punya penyunting, jadi sengaja belum didaftarkan pada
penjaga (alasan yang sama dengan §5.1a). Impor kurikulum (JSON) juga belum
membawa medan `*En`: berkas impor lama tetap sah, dan mengimpor ulang tidak
menghapus terjemahan yang sudah ada karena `createMany` hanya menulis
kurikulum baru. Katalog publik menyusul di L5, ekspor DOCX/Excel di L6.

### 5.2 `komponen_nilai.nama_en` tidak menyentuh identitas baris

Aturan mengikat yang sudah ada tetap berlaku sepenuhnya: `@@unique([rpkpsId,
nama])` tetap pada kolom Indonesia, dan penulisan tetap lewat
`rencanakanKomponen` + `tulisKomponenNilai`. `nama_en` ikut sebagai medan
biasa yang di-*update*, **bukan** bagian kunci pencocokan. Kalau `nama_en`
ikut menjadi kunci, mengubah terjemahan akan melepas seluruh tautan asesmen
— persis bencana yang aturan itu cegah.

### 5.3 Penyimpanan yang menulis ulang baris wajib membawa medan Inggris

`simpanPertemuan` dan `simpanTugas` menulis ulang baris beserta seluruh
anaknya di bawah kunci optimistik `diubahPada`. Karena itu **medan `*En`
wajib ikut dalam muatan simpan**. Kalau tidak, menyunting tab Indonesia akan
menghapus terjemahan Inggris tanpa satu pesan pun — kegagalan senyap dengan
bentuk persis sama seperti hilangnya id `komponen_nilai`.

Penyunting mengirim kedua bahasa dalam satu muatan, satu kunci optimistik,
satu transaksi. Tidak ada "simpan hanya bahasa Inggris".

**Penjaganya tekstual, karena tidak bisa lain.** `tsc` tidak dapat melihat
kolom yang hilang dari muatan simpan — Prisma menerima `data` parsial dengan
senang hati. Jadi `src/lib/rpkps/terjemahan.test.ts` membaca `schema.prisma`,
mengumpulkan setiap kolom `*En` pada model isi RPKPS, dan menuntut namanya
disebut di berkas aksi yang menulis model itu. Penjaga ini langsung bekerja
pada hari pertama: ia menemukan `metode_en` yang tidak punya penulis (§5.1a).

### 5.4 Pemilihan teks saat menampilkan

```ts
// src/lib/bahasa/teks.ts
pilihTeks(baris.topik, baris.topikEn, bahasa)
// → { teks: string, asli: boolean }
```

**Arah cadangan hanya satu.** Pembaca Inggris melihat teks Indonesia bila
terjemahannya belum ada; pembaca Indonesia TIDAK pernah melihat teks Inggris.
Membalik arahnya akan memunculkan kalimat Inggris di tengah dokumen resmi
berbahasa Indonesia, yang adalah versi yang ditandatangani. `BAHASA_ASAL`
terpisah dari `BAHASA_BAWAAN` supaya jawabannya tidak ikut berubah kalau suatu
saat bahasa bawaan antarmuka diganti.

**Yang belum tersentuh di L4:** halaman katalog publik masih seluruhnya
Indonesia. Isinya datang dari salinan beku lewat `proyeksiIsi`, dan proyeksi
itu tidak boleh bertambah medan (§6.1) — jadi versi Inggrisnya menunggu ruang
sidik kedua di L5.

`asli: true` berarti nilai Inggris kosong dan yang tampil adalah teks
Indonesia. Antarmuka Inggris menandainya halus (bukan peringatan merah —
belum diterjemahkan adalah keadaan normal, bukan galat). Pada dokumen
tercetak, penandanya berupa catatan kaki sekali di akhir bagian, bukan pada
tiap baris.

### 5.5 Penyunting: dua kolom, bukan dua halaman

Formulir mingguan dan tugas mendapat sakelar `ID | EN | Berdampingan`.
"Berdampingan" adalah mode kerja sesungguhnya: teks Indonesia di kiri
sebagai acuan, isian Inggris di kanan. Menerjemahkan tanpa melihat aslinya
adalah cara paling cepat menghasilkan terjemahan yang salah.

Ringkasan kelengkapan ("12 dari 34 medan diterjemahkan") tampil di halaman
ikhtisar RPKPS. Angka itu **tidak** memblokir apa pun.

Penyebutnya hanya medan yang ADA ISINYA di bahasa Indonesia: topik kosong
bukan pekerjaan terjemahan yang tertinggal, ia memang tidak ada. Memasukkannya
membuat angkanya berbohong. Hitungannya murni di
`src/domain/rpkps/terjemahan.ts`; pengumpul pasangannya di
`src/lib/rpkps/terjemahan.ts`, dan ia sengaja menulis daftarnya apa adanya
alih-alih memindai nama kolom berakhiran "En" — kolom `*En` juga ada di lapisan
kurikulum, yang tidak dapat disunting dari halaman RPKPS.

### 5.6 Tidak memblokir pengajuan

Validator RPKPS **tidak** bertambah pemblokir. Paling jauh satu peringatan
baru (`W8-TERJEMAHAN-PARSIAL`) yang muncul hanya bila terjemahan sudah
dimulai tapi belum selesai — karena dokumen setengah-Inggris lebih
membingungkan daripada dokumen yang seluruhnya Indonesia.

## BAGIAN 6 — Sidik dan salinan beku

Ini bagian dengan risiko tertinggi di seluruh rencana.

### 6.1 `proyeksiIsi()` tidak boleh disentuh

Aturan mengikat di `AGENTS.md` tetap berlaku tanpa pengecualian. Menambah
satu medan `*En` ke `proyeksiIsi()` akan mengubah sidik SHA-256 **seluruh
RPKPS yang sudah terbit**, memunculkan peringatan pergeseran palsu pada
setiap dokumen yang sudah ditandatangani, dan meruntuhkan satu-satunya bukti
bahwa berkas yang dicetak hari ini sama dengan yang disahkan Kaprodi.

### 6.2 Ruang sidik kedua

**Terpasang (31 Agustus 2026).** Polanya sudah ada di proyek ini — evaluasi
memakai proyeksinya sendiri di `src/domain/evaluasi/proyeksi.ts` dengan alasan
yang sama persis.

```
src/domain/rpkps/proyeksi.ts      ← TIDAK BERUBAH satu baris pun
src/domain/rpkps/proyeksi-en.ts   ← proyeksiIsiEn(), sidikDokumenEn()
```

```prisma
model RpkpsSnapshot {
  isi      Json
  sidik    String
  isiEn    Json?   @map("isi_en")    // null = tidak diterbitkan berbahasa Inggris
  sidikEn  String? @map("sidik_en")
}
```

#### Kunci regresi dipasang LEBIH DULU

`src/domain/rpkps/proyeksi.test.ts` mengunci sidik sebuah dokumen contoh
sebagai nilai harfiah, dan ditulis **sebelum** apa pun di sekitarnya disentuh —
sehingga ia benar-benar membuktikan bahwa L5 tidak menggeser apa-apa, bukan
sekadar mencatat keadaan sesudahnya.

Contoh dan kuncinya sengaja di berkas yang sama: siapa pun yang mengubah
contohnya melihat nilai kunci tepat di bawahnya, dan tahu bahwa memperbarui
angka itu berarti menyatakan sidik seluruh arsip boleh bergeser. Berkas itu
juga memuat penjaga arah: proyeksi Indonesia tidak boleh memuat satu pun medan
berakhiran `En`.

#### `SumberProyeksiEn` ditulis berdiri sendiri

Percobaan pertama memperluas `SumberProyeksi` dengan intersection dan langsung
gagal — persis seperti yang sudah dicatat komentar di `proyeksi.ts`:
`cpl: A[] & cpl: B[]` menghasilkan elemen yang tidak punya properti keduanya.
Duplikasi tipenya disengaja dan lebih murah daripada tipe yang berbohong.

#### Cadangan per MEDAN, bukan per dokumen

`proyeksiIsiEn` mencadangkan tiap medan ke bahasa Indonesia. Dokumen Inggris
yang separuh medannya kosong tidak berguna bagi siapa pun; yang belum
diterjemahkan tampil apa adanya, dan halaman publik menerangkan keadaan itu
sekali di kepala dokumen. Pengenal — kode MK, kode CPL/CPMK, nomor pustaka,
nama orang, NIDN, entri bibliografi — ikut apa adanya: menerjemahkannya justru
memutus penelusuran antara kedua versi.

#### Kapan `isiEn` ditulis

`bekukanRpkps` menulisnya hanya bila ADA yang diterjemahkan. Nol terjemahan
berarti `proyeksiIsiEn` menghasilkan dokumen yang identik dengan versi
Indonesia — dan menyimpannya akan membuat `/en/katalog` menyatakan "versi
Inggris terbit" atas dokumen yang satu katanya pun tidak berbahasa Inggris.
Uji menegaskan kesamaan itu, jadi aturannya bukan tebakan.

Sebaliknya terjemahan yang belum lengkap TETAP dibekukan. Menahan seluruh
dokumen sampai medan terakhir selesai adalah cara tercepat membuat terjemahan
tidak pernah terbit.

### 6.3 Yang dilihat publik

**Terpasang.** Halaman `/en/katalog/…` membaca `isiEn` bila ada. Bila tidak,
ia menampilkan salinan Indonesia dengan sepasang keterangan: bahwa versi
Inggris belum diterbitkan, dan bahwa **versi Indonesia adalah yang sah**.
Kalimat kedua yang terpenting — halaman ini dokumen resmi, dan pembaca berhak
tahu versi mana yang berlaku bila keduanya berbeda.

Kedua sidik tampil berdampingan; yang Inggris TIDAK menggantikan yang
Indonesia, karena sidik Indonesia harus tetap dapat dibandingkan dengan berkas
DOCX yang dipegang orang. `alternates.languages` per halaman menghubungkan
kedua alamat sebagai satu dokumen dalam dua bahasa.

Halaman publik tetap hanya membaca salinan beku, tetap hanya status `TERBIT`,
dan tetap seluruhnya lewat `src/lib/publik/muat.ts`. Kartu katalog adalah
kekecualian yang disengaja: ia membaca data LANGSUNG (`MataKuliah.nama`), bukan
salinan beku, jadi di sana `pilihTeks` sudah cukup dan larangan menyentuh
proyeksi sidik tidak berlaku.

## BAGIAN 7 — Ekspor dokumen

**Terpasang (31 Agustus 2026).** `rpkps-docx.ts` memuat puluhan judul bagian
Indonesia sebagai literal. Semuanya pindah ke `src/lib/dokumen/label.ts`;
bentuk tabel dan urutan kolom **tidak berubah** — template adalah data, dan
template ITTS tetap 7 kolom di kedua bahasa.

- Empat rute unduh menerima `?bahasa=id|en`; bawaannya `id`. Nilai yang tidak
  dikenali jatuh ke `id`, bukan ditolak: alamat unduhan sering disalin tangan,
  dan menjawab 400 atas salah ketik hanya menghalangi orang mengambil
  dokumennya.
- Berkas Inggris mencetak `sidikEn`, bukan `sidik`. Mencetak sidik Indonesia
  pada berkas berbahasa Inggris akan membuat orang membandingkan dua isi yang
  berbeda dan menyimpulkan dokumennya sudah bergeser.
- Halaman pengesahan berkas Inggris membawa satu baris di kakinya: **versi
  Indonesia adalah naskah yang sah**. Untuk keperluan akreditasi, yang
  diserahkan tetap berkas Indonesia.
- Tombol unduh selalu menawarkan bahasa yang satunya. Pembaca Inggris harus
  dapat mengambil naskah yang sah tanpa berganti bahasa antarmuka lebih dulu.

### 7.1 Pengenal Excel tetap bahasa Indonesia

Berkas nilai (`excel-nilai.ts`) dan templat kurikulum (`kurikulum/excel.ts`)
**dibaca ulang saat diunggah**, dan keduanya mencocokkan kolom lewat TEKS
judulnya, bukan posisinya. Karena itu judul kolom dan nama lembar tetap
berbahasa Indonesia — "NIM", "Nama", "Angkatan", "Nilai", "Kode MK",
"Level Bloom", dan seterusnya. Yang diterjemahkan hanya lembar Petunjuk, yang
tidak pernah dibaca.

Kegagalannya kalau aturan ini dilanggar bersifat SENYAP: pembaca hanya
melaporkan "kolom tidak ditemukan", dan tidak ada yang menghubungkannya dengan
bahasa berkas. Karena itu ada dua penjaga di `label.test.ts`:

1. Tidak satu pun pengenal boleh muncul sebagai nilai di sub-tabel
   `label.excel` — kalau sebuah pengenal masuk tabel label, cepat atau lambat
   seseorang akan menerjemahkannya.
2. Pengenal harus tetap tertulis harfiah di kode pembacanya.

Cakupan penjaga pertama sengaja hanya `excel.*`. Judul bagian DOCX boleh saja
kebetulan berbunyi "Sub-CPMK", dan label LKPS boleh berbunyi "Mata Kuliah":
keduanya tidak pernah diimpor, jadi menerjemahkannya justru benar. `excel-lkps.ts`
diterjemahkan seluruhnya karena ia laporan, bukan formulir.

Lembar Petunjuk kedua bahasa kini membuka dengan peringatan yang sama: nama
lembar dan judul kolom adalah pengenal, jangan diganti. Itu berlaku bagi
pengguna Indonesia juga — mengganti nama kolom merusak impor tanpa perlu
menerjemahkannya.

### 7.2 Penjaga tabel label

Sama seperti kamus antarmuka: kunci dan bentuk harus sama persis di kedua
bahasa (larik tetap larik, dengan panjang yang sama), penanda `{nama}` tidak
boleh berubah saat diterjemahkan, dan tidak boleh ada kalimat Inggris yang
masih identik dengan Indonesianya. Yang ketiga mengecualikan pengenal murni
("CPMK", "NIDN / NIP / NIK") dan pola yang hanya berisi penanda.

## BAGIAN 8 — Bantuan AI

**Terpasang (31 Agustus 2026).** Menerjemahkan tiga puluhan medan teks per
RPKPS dengan tangan adalah pekerjaan yang tidak akan dilakukan siapa pun.
`terjemahkanRpkps` (`src/lib/ai/terjemahan-rpkps.ts`) mengerjakannya sebagai
SATU tugas — bukan tiga puluhan. Selain soal biaya, satu permintaan juga yang
membuat istilahnya konsisten: model melihat seluruh dokumen sekaligus, bukan
potongan lepas.

Aturan BYOK berlaku utuh: kredensial hanya lewat `pakaiKredensial()`, dibuka
sekali lalu adapternya diteruskan ke gerbang, tanpa cadangan ke env, tanpa
klien SDK pada variabel modul. Keempatnya dijaga uji tekstual di
`terjemahan-rpkps.test.ts`, karena tidak satu pun dapat diberikan tipe.

### 8.1 Dua aksi, dan pemisahannya adalah intinya

`usulkanTerjemahan` hanya MEMINTA dan mengembalikan draf; `terapkanTerjemahan`
menulis apa yang sudah dicentang dosen. Tidak ada jalan dari model langsung ke
basis data — dijaga uji yang membaca badan `usulkanTerjemahan` dan menuntutnya
tidak memuat satu pun `prisma.*.update/create/upsert/delete`.

Panel tinjau menampilkan asli di kiri dan usulan di kanan, sama seperti mode
berdampingan pada penyunting: menilai terjemahan tanpa melihat aslinya tidak
mungkin. Seluruhnya tercentang di awal — dosen membaca lalu MEMBATALKAN yang
salah, bukan mencentang tiga puluhan baris satu per satu.

### 8.2 Alamat adalah masukan dari klien

Setiap medan punya alamat `tabel:id:kolom`. Alamat itu kembali dari peramban
saat diterapkan, jadi ia masukan yang tidak dipercaya, dan diurai apa adanya
menjadi `prisma[tabel].update({ [kolom]: … })` ia adalah
tulis-apa-saja-ke-mana-saja. Dua lapis penjagaan:

1. **Daftar putih kolom.** Hanya kolom berakhiran `En` pada tabel yang
   terdaftar — `MEDAN_BOLEH` di `src/lib/rpkps/medan-en.ts`. Diuji dua kali:
   setiap medan di dalamnya harus berakhiran `En`, dan setiap namanya harus
   cocok dengan `schema.prisma` (§8.6).
2. **Pengesahan terhadap dokumen ini.** Alamat dicocokkan dengan
   `medanRpkps(rpkps)` — id baris bersifat global, dan wewenang yang sudah
   diperiksa hanya berlaku untuk RPKPS ini. Tanpa langkah ini sebuah alamat
   milik dokumen orang lain akan ditulis begitu saja.

Model juga boleh mengembalikan alamat yang tidak pernah dikirim — entah karena
mengarang, entah karena dosen menyunting di tab lain selama permintaan
berjalan. `saringHasilTerjemahan` di domain membuangnya.

### 8.3 Penerapan menulis kolom `*En` saja

Sengaja BUKAN lewat `simpanPertemuan`/`simpanTugas`. Keduanya mengganti seluruh
isi baris, dan memakainya di sini berarti menulis ulang isi Indonesia dari data
yang dibaca beberapa detik lalu — menimpa suntingan rekan setim yang terjadi
sementara model bekerja. Arah sebaliknya aman: menulis kolom terjemahan saja
tidak dapat menghapus apa pun yang lain (§5.3).

### 8.4 Penyimpangan dari rencana: `sumber = AI` TIDAK dipasang

Rencana semula menyebut baris hasil terjemahan ditandai `sumber = AI`. Itu
tidak dikerjakan, dan sebaiknya memang tidak.

`SumberIsi` menandai asal ISI sebuah baris. Menaikkannya menjadi `AI` karena
kolom terjemahannya diisi model akan menyatakan bahwa rumusan **Indonesia**-nya
lahir dari model — padahal dosen yang menulisnya. Asesor membaca naskah
Indonesia; menandainya AI justru menyesatkan persis pihak yang hendak
dilindungi docs/01 §4.8.

Jejaknya ditaruh di tempat yang benar: `log_audit` mencatat
`RPKPS_DITERJEMAHKAN` beserta jumlah medan, dan panel menampilkan penyedia
serta model yang dipakai. Kalau kelak provenance per medan memang dibutuhkan,
tempatnya kolom terpisah pada medan terjemahan — bukan menumpang pada `sumber`
yang sudah punya arti lain.

### 8.5 Glosarium terkunci

CPL → *Programme Learning Outcomes*, CPMK → *Course Learning Outcomes*,
Sub-CPMK → *Lesson Learning Outcomes*, sks → *credit units*, RPKPS tetap
RPKPS, ditambah UTS/UAS, TM/PT/BM, dan jabatan. Tanpa glosarium satu dokumen
akan memakai tiga istilah berbeda untuk CPMK di tiga bagian, dan pembaca yang
membandingkannya dengan naskah Indonesia tidak dapat menelusuri mana yang mana.

Glosarium hidup di blok STABIL yang di-cache penyedia — diuji, karena satu
byte yang berpindah ke blok permintaan membatalkan seluruh cache.

Terjemahan **tidak pernah otomatis**. Selalu ada tombol dan selalu ada
peninjauan.

### 8.6 Satu kueri per kolom, bukan satu kueri per medan

**Diperbaiki 2 September 2026, setelah gagal di tangan pengguna.** Versi
pertama menulis `prisma[tabel].update()` sekali per medan di dalam satu
`$transaction`. Pada RPKPS contoh yang kecil itu jalan; pada dokumen
sungguhan ia berhenti dengan:

```
Transaction API error: A rollback cannot be executed on an expired
transaction. The timeout for this transaction was 5000 ms, however 5071 ms
passed since the start of the transaction.
```

Sebabnya bukan kueri yang lambat, melainkan JUMLAHNYA. Sebuah RPKPS 16 minggu
punya ratusan medan — tujuh kolom per pertemuan, ditambah indikator dan
aktivitas tiap minggu, tugas, dan butir kisi-kisi. Batas waktu transaksi
dihitung sejak transaksi dibuka, bukan per kueri, jadi jumlah bolak-balik
itulah yang melampauinya. Pelajaran yang persis sama sudah tertulis di
`src/lib/evaluasi/nilai-inti.ts` untuk impor nilai; ia terlewat di sini.

Penulisannya sekarang dikelompokkan menurut **pasangan tabel+kolom**, satu
pernyataan per kelompok:

```sql
UPDATE "pertemuan" AS t
SET "topik_en" = v.teks
FROM (VALUES ($1::text, $2::text), …) AS v(id, teks)
WHERE t.id = v.id
```

Jumlah kueri jadi terikat pada banyaknya KOLOM (paling banyak 20), bukan pada
besar dokumen. Batas waktu 20 detik tetap dipasang — sebagai margin bagi
koneksi lambat, bukan sebagai perbaikannya.

Harga yang dibayar: ini satu-satunya SQL tulis-tangan di aplikasi ini, dan
`Prisma.raw` tidak tahu apa-apa tentang `@map`. Karena itu `MEDAN_BOLEH`
menyimpan KEDUA penamaan, dan dua penjaga berdiri di belakangnya —
`src/lib/rpkps/terjemahan-sql.test.ts` mencocokkan tiap nama tabel dan kolom
dengan `schema.prisma` (termasuk bahwa kunci barisnya benar-benar bernama
`id`), dan `uji/integrasi.ts` §15 menjalankan penulisannya terhadap Postgres
sungguhan: nama tabel yang salah atau cast yang kurang hanya terlihat saat
dieksekusi.

Penulisannya karena itu pindah ke `src/lib/rpkps/terjemahan-tulis.ts` dan
menerima klien Prisma sebagai PARAMETER — alasan yang sama dengan
`nilai-inti.ts`: yang tidak dapat diuji terhadap basis data sungguhan tidak
boleh berisi SQL tulis-tangan. Berkas `"use server"` juga hanya boleh
mengekspor fungsi async, sehingga daftar putihnya memang tidak dapat tinggal
di berkas aksi.

## BAGIAN 9 — Urutan pengerjaan

Berfase, dan tiap fase berdiri sendiri: aplikasi tetap jalan dan tetap lulus
`npm test` di akhir setiap fase.

| Fase | Isi | Risiko |
|---|---|---|
| ~~**L1**~~ | ✅ **Terpasang.** Rangka: `[bahasa]`, proxy, kamus + `PenyediaBahasa`, `Tautan`, `segarkan`, pengalih bahasa, `Pengguna.bahasa`, sitemap/robots dwibahasa, pagar ESLint | — |
| ~~**L2**~~ | ✅ **Terpasang.** Kamus antarmuka: `(app)`, `(publik)`, `components`; 163 pesan aksi; pesan Zod berkunci `@` (§4.2b) | — |
| ~~**L3**~~ | ✅ **Terpasang.** Temuan validator (§4.1, 127 kode), notifikasi (§4.2, 12 kunci), riwayat RPKPS (§4.2c, 16 kunci), label enum (§4.3) | — |
| ~~**L4**~~ | ✅ **Terpasang.** 33 kolom `*En`, penyunting berdampingan, `pilihTeks`, ringkasan kelengkapan, W8 | — |
| ~~**L5**~~ | ✅ **Terpasang.** `proyeksi-en.ts`, `isiEn`/`sidikEn`, katalog publik EN, hreflang per halaman, kunci regresi sidik | — |
| ~~**L6**~~ | ✅ **Terpasang.** `label.ts` (dua bahasa), `?bahasa=`, sidik ruang kedua di berkas EN, pengenal Excel dijaga uji | — |
| ~~**L7**~~ | ✅ **Terpasang.** `terjemahkanRpkps` (BYOK), panel tinjau, penerapan berdaftar-putih | — |

L1–L3 memenuhi permintaan pertama (aplikasi dwibahasa); L4–L7 memenuhi
permintaan kedua (RPKPS dwibahasa). Keduanya terpasang.

### 9.1 Yang TIDAK dikerjakan di L1, dan mengapa

Rangkanya berdiri, tetapi teks aplikasi masih hampir seluruhnya bahasa
Indonesia — membuka `/en/rpkps` menghasilkan halaman berbahasa Inggris hanya
pada kerangkanya. Itu memang bentuk L1, bukan pekerjaan yang tertinggal:
memindahkan pohon rute dan mengekstrak 19.000 baris teks dalam satu langkah
menghasilkan perubahan yang tidak dapat ditinjau siapa pun.

Dua hal yang sudah punya alatnya tetapi baru dipakai di L2:

- `src/lib/bahasa/format.ts` sudah ada, tetapi 12 pemanggilan
  `toLocaleDateString("id-ID", …)` yang tersebar belum diganti.
- Penjaga kedua pada §3.1 — pemindai literal Indonesia yang tertinggal di
  JSX — belum ditulis; ia baru berguna setelah ada yang dipindahkan.


### 9.2 Yang TIDAK dikerjakan di L2, dan mengapa

Seluruh teks antarmuka dan seluruh pesan aksi kini lewat kamus, tetapi tiga
hal sengaja ditinggalkan untuk L3 karena bentuknya sama: kalimat yang lahir
jauh dari layar.

- **Temuan validator** (`panel-validasi.tsx`) dan **lencana tenggat**
  (`lencana-tenggat.tsx`) belum dipindahkan — keduanya menampilkan kalimat
  yang dirakit di `src/domain`, dan memindahkan tampilannya lebih dulu hanya
  akan memindahkan setengah masalah.
- **Kalimat yang tersimpan di basis data** — §4.2c.
- **`log_audit.ringkasan` tidak akan pernah dipindahkan.** Ia jejak audit;
  bahasanya satu, tetap, dan bukan urusan preferensi pembaca.

## BAGIAN 10 — Yang sengaja tidak dikerjakan

- **Bahasa ketiga.** Struktur kamus mendukungnya, tetapi kolom `*En`
  tidak. Kalau kelak ada bahasa Arab atau Mandarin, kolom cermin harus
  diganti tabel terjemahan — dan itu keputusan yang lebih baik diambil saat
  kebutuhannya nyata, bukan sekarang.
- **RTL.** Tidak ada bahasa sasaran yang ditulis kanan-ke-kiri.
- **Penerjemahan otomatis massal.** Tidak ada tombol "terjemahkan seluruh
  kurikulum". Dokumen yang tidak pernah dibaca manusia sebelum terbit adalah
  dokumen yang tidak dapat dipertanggungjawabkan.
- **Terjemahan `catatan_usulan`, `dasar_butir`, `temuan_evaluasi`.**
  Perkataan orang disimpan apa adanya.
