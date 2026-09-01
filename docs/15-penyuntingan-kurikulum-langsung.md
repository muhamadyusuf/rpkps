# Penyuntingan Kurikulum Langsung (CRUD)

> Status: **C1–C6 terpasang** (gerbang domain + uji, CRUD CPL / mata kuliah /
> CPMK / Sub-CPMK, kedua matriks pemetaan, kurikulum kosong, panel validator
> hidup, kamus dwibahasa). Menutup jalur masuk kedua ke
> lapisan kurikulum, berdampingan dengan impor Excel ([00 §3](./00-konsep-rpkps.md))
> dan Usulan Revisi Kurikulum ([04](./04-usulan-revisi-kurikulum.md)).
> Memperluas pola yang sudah terbukti pada Profil Lulusan (`aksi-profil.ts`).

## BAGIAN 1 — Masalah

Lapisan kurikulum punya **satu** jalur masuk: unggah berkas Excel. Sekali
tersimpan, isinya hanya dapat diubah dengan menghapus seluruh kurikulum lalu
mengimpor ulang — dan itu pun hanya selama statusnya belum `BERLAKU`.

Akibatnya tiga hal yang wajar jadi mustahil:

| Kejadian | Sekarang |
|---|---|
| Satu CPL salah ketik | Hapus kurikulum, perbaiki Excel, impor ulang |
| Prodi lupa satu mata kuliah | Sama |
| Prodi baru menyusun kurikulum dari nol | Tidak bisa — harus mengarang berkas Excel lebih dulu |

Yang ketiga paling menohok: aplikasi ini menghitung, memvalidasi, dan
menelusuri kurikulum, tetapi tidak dapat **membuat** satu pun.

Profil Lulusan sudah menyelesaikan masalah ini untuk dirinya sendiri —
`aksi-profil.ts` memasang penyunting langsung di halaman kurikulum, dengan
alasan yang ditulis terbuka di kepala berkasnya. Dokumen ini memperluas alasan
itu ke lapisan yang tersisa: **CPL, Mata Kuliah, CPMK, Sub-CPMK, dan kedua
matriks pemetaannya.**

> Catatan istilah: dalam permintaan disebut "Sub CPL". Model ini tidak
> mengenalnya. Rantainya **PL → CPL → CPMK → Sub-CPMK**, dan CPL dijabarkan
> langsung oleh CPMK di tingkat mata kuliah. Yang dimaksud "sub" hampir pasti
> Sub-CPMK, dan itu masuk cakupan.

---

## BAGIAN 2 — Enam keputusan yang membentuk rancangan ini

### 2.1 Profil Lulusan aman disunting kapan saja; sisanya TIDAK

Ini pangkal seluruh rancangan, dan alasannya sudah tertulis di
`aksi-profil.ts`: profil lulusan **tidak ikut** `proyeksiIsi()`.

Sisanya ikut. Ini isi `src/domain/rpkps/proyeksi.ts` apa adanya:

```
mataKuliah: kode, nama, semester, status, sksTeori, sksPraktik
cpl:        kode, deskripsi                    ← dari matriks CPL×MK
cpmk:       kode, rumusan, levelBloom, cpl[]   ← dari peta CPMK×CPL
subCpmk:    kode, rumusan, levelBloom
```

Setiap ruas di atas adalah dasar sidik SHA-256 dokumen. Menyunting satu
huruf pada rumusan CPMK menggeser sidik **seluruh RPKPS terbit** pada mata
kuliah itu, dan `periksaSidikCap` mulai menolak persetujuan serta pengesahan
dengan peringatan pergeseran yang tidak dilakukan siapa pun.

Itulah sebabnya URK ada, dan CRUD ini **tidak boleh** menjadi pintu belakang
yang menembusnya.

### 2.2 Gerbangnya adalah **akibat**, bukan status

Godaan pertama: "izinkan bila status `DRAF`". Itu salah, dan lubangnya sudah
ada di kode sekarang.

`ubahStatusKurikulum` menawarkan `ARSIP → DRAF` ("Kembalikan ke draf" di
`tombol.tsx`). Kurikulum yang pernah `BERLAKU`, sudah menggantung puluhan RPKPS
terbit beserta salinan bekunya, lalu diarsipkan, dapat dikembalikan menjadi
`DRAF` — dan status `DRAF`-nya berbohong tentang apa yang bergantung padanya.

Jadi gerbangnya dua lapis, dan **keduanya wajib lolos**:

| Lapis | Pertanyaan | Ditegakkan di |
|---|---|---|
| **G1** | Kurikulum ini boleh disunting? (`DRAF` saja) | `bolehSuntingKurikulum(status)` |
| **G2** | Baris ini punya akibat? | `periksaKelayakanSunting…(rujukan)` |

G1 murni status: `BERLAKU` → baca-saja, arahkan ke `/usulan`; `ARSIP` → beku
seluruhnya (aturan yang sudah dipakai `pastikanWenang`).

G2 menghitung rujukan nyata dari basis data — bukan menebak dari status. Ini
cermin persis `periksaKelayakanHapus` pada `src/domain/rpkps/daur-hidup.ts`,
yang sudah menjadi pola sah di proyek ini.

### 2.3 Yang dihitung G2, per lapisan

Cascade di skema tidak ramah. Ini yang sesungguhnya lenyap bila sebuah baris
dihapus tanpa penjaga:

| Hapus | Cascade menjangkau | Putusan |
|---|---|---|
| `MataKuliah` | `rpkps` → `rpkps_snapshot`, `kelas` → `peserta_kelas` → `nilai`, `evaluasi_mk` | **Tolak** bila ada RPKPS. Tanpa kecuali. |
| `Cpmk` | `sub_cpmk` → `pertemuan_sub_cpmk`, `tugas_sub_cpmk`, `butir_kisi_kisi` | Tolak bila ada Sub-CPMK yang dirujuk |
| `SubCpmk` | `pertemuan_sub_cpmk`, `tugas_sub_cpmk`, `butir_kisi_kisi` | Tolak bila jumlah rujukan > 0 |
| `Cpl` | `cpl_profil_lulusan`, `matriks_cpl_mk`, `peta_cpmk_cpl` | Tolak bila terpetakan ke MK yang punya RPKPS |

Penolakannya **menyebutkan angkanya** — "Sub-CPMK ini dipakai 3 baris mingguan
dan 2 butir kisi-kisi pada RPKPS TI214 2025/2026 Ganjil" — bukan "tidak dapat
dihapus". Yang membaca pesan itu perlu tahu apa yang harus dibereskan dulu.

Ini juga yang menegakkan aturan **"Capaian dipensiunkan, tidak pernah
dihapus"** untuk pertama kalinya lewat kode, bukan lewat kesepakatan.

### 2.4 Pensiun tetap milik URK

CRUD ini **tidak** mengisi `pensiunSejakTaId`. Pensiun butuh tahun akademik
mulai berlaku, dan penetapan itu keputusan Kaprodi lewat butir `CPMK_PENSIUN` /
`SUB_PENSIUN` ([04 §2.1](./04-usulan-revisi-kurikulum.md)). Di kurikulum `DRAF`
tanpa RPKPS pun tidak ada yang perlu dipensiunkan — hapus saja cukup.

Batas ini menjaga URK tetap menjadi satu-satunya pintu perubahan kurikulum
hidup, persis seperti janji doc 04.

### 2.5 Kurikulum kosong: jalur masuk yang hilang

Tanpa ini, CRUD hanya berguna bagi prodi yang **sudah** punya berkas Excel.
Ditambahkan satu aksi: **"Susun kurikulum kosong"** di `/kurikulum` —
membuat baris `Kurikulum` berstatus `DRAF` tanpa isi, lalu melempar ke halaman
detailnya untuk diisi lapis demi lapis.

Impor Excel tetap ada dan tetap jalur tercepat untuk kurikulum yang sudah
tertulis. Keduanya bermuara ke bentuk data yang sama.

### 2.6 Validator ikut hidup, bukan hanya saat impor

`validasiKurikulum` sekarang hanya berjalan di pratinjau impor. Kurikulum yang
disusun tangan akan melewati mutu yang sama sekali tidak diperiksa — Sub-CPMK
tanpa KKO terukur, CPMK tanpa Sub-CPMK, CPL yatim.

Halaman kurikulum `DRAF` menampilkan hasil `validasiKurikulum` secara langsung,
dan **`Berlakukan` ditolak selama masih ada temuan `PEMBLOKIR`** — ambang yang
sama persis dengan yang dipakai `simpanImpor`. Dua jalur masuk, satu mutu.

---

## BAGIAN 3 — Model data

**Tidak ada tabel baru, tidak ada kolom baru.** Seluruh ruas yang disunting
sudah ada di `prisma/schema.prisma`. Yang selama ini tidak pernah terisi dari
antarmuka mana pun dan kini terjangkau:

| Model | Ruas yang belum pernah dapat diisi |
|---|---|
| `Cpl` | `ranah` (selalu bawaan `KETERAMPILAN_KHUSUS`) |
| `MataKuliah` | `deskripsi`, `status`, `bentukTeori`, `bentukPraktik` |
| `SubCpmk` | `kko`, `mingguDisarankan` |
| `Kurikulum` | `catatan` (hanya terisi kalimat impor) |

Ruas `*En` (dwibahasa, [11](./11-dwibahasa.md)) sengaja **belum** disentuh —
itu lingkup L2–L7 dan punya rancangannya sendiri.

---

## BAGIAN 4 — Antarmuka

Tidak ada halaman baru. Penyunting menempel di tempat datanya sudah tampil,
mengikuti pola `PengelolaProfilLulusan`.

```
/kurikulum
  └─ [+ Susun kurikulum kosong]                            2.5

/kurikulum/[id]                       ← DRAF: dapat disunting
  ├─ panel validator (PEMBLOKIR / PERINGATAN)              2.6
  ├─ Profil Lulusan       ← sudah ada
  ├─ CPL                  ← C/U/D · ranah · KKNI · urutan
  └─ Mata Kuliah          ← C/U/D · semester · sks T/P · bentuk · status

/kurikulum/[id]/mk/[mkId]             ← DRAF: dapat disunting
  ├─ Matriks CPL×MK       ← setel (ganti seluruh himpunan)
  ├─ CPMK                 ← C/U/D · level Bloom · urutan
  │   └─ Peta CPMK×CPL    ← setel
  └─ Sub-CPMK             ← C/U/D · level Bloom · KKO · minggu · urutan
```

Pada kurikulum `BERLAKU`, kedua halaman tampil **persis seperti sekarang** —
baca-saja, dengan spanduk `Lock` dan tombol "Usulkan revisi" yang sudah ada di
halaman MK. Tidak ada yang berubah bagi pengguna kurikulum hidup.

Pemetaan memakai deretan tombol-jungkit dengan tombol "Simpan pemetaan", sama
seperti `PemetaanCpl` — mencentang empat CPL tidak berarti empat kali tulis.

Wewenang: `ADMIN` dan `KAPRODI` dalam cakupan prodinya, sama seperti
`aksi-profil.ts`. Tidak ada peran baru.

---

## BAGIAN 5 — Yang ditegakkan kode

Domain murni, dapat diuji tanpa Prisma — `src/domain/kurikulum/sunting.ts`:

```ts
/** G1. Hanya DRAF. BERLAKU → URK; ARSIP → beku. */
export function bolehSuntingKurikulum(status: StatusKurikulum): HasilGerbang;

/** G2. Rujukan dihitung pemanggil dari basis data; di sini hanya putusannya. */
export function periksaKelayakanHapusMk(r: RujukanMk): HasilGerbang;
export function periksaKelayakanHapusCpmk(r: RujukanCpmk): HasilGerbang;
export function periksaKelayakanHapusSubCpmk(r: RujukanSubCpmk): HasilGerbang;
export function periksaKelayakanHapusCpl(r: RujukanCpl): HasilGerbang;

/** Normalisasi kode: huruf besar, rapat, dan pola per lapisan. */
export function normalkanKode(kode: string): string;
```

Sensus G2 hidup di `src/lib/kurikulum/sunting-inti.ts`, yang menerima klien
Prisma sebagai **parameter** — pola yang sama dengan `usulan-inti.ts`, dan
alasannya sama: sensus inilah yang berdiri di antara satu klik "Hapus" dan
lenyapnya RPKPS terbit beserta salinan bekunya. Sebuah `select` yang salah
relasi tidak akan pernah tertangkap uji domain yang datanya dikarang, jadi
bagian ini dijalankan uji integrasi terhadap Postgres tertanam (bagian 14 pada
`uji/integrasi.ts`). Pembungkus yang mengikatnya ke klien aplikasi ada di
`sunting.ts`.

Berkas aksi (`"use server"`), sejajar `aksi-profil.ts`:

```
aksi-cpl.ts    tambah/perbarui/hapus/geser Cpl
aksi-mk.ts     tambah/perbarui/hapus/geser MataKuliah · setelCplMk
aksi-cpmk.ts   tambah/perbarui/hapus/geser Cpmk & SubCpmk · setelCplCpmk
aksi.ts        + buatKurikulumKosong · perbaruiMetaKurikulum
```

Setiap aksi menempuh urutan yang sama, tanpa jalan pintas:

```
wajibPeran(ADMIN, KAPRODI)
  → cakupanProdi                     wewenang atas prodi
  → bolehSuntingKurikulum            G1
  → periksaKelayakan…                G2 (hanya pada hapus/ubah berdampak)
  → zod                              bentuk & panjang
  → bentrok kode                     @@unique per induk
  → tulis
  → logAudit                         KURIKULUM_DISUNTING
  → segarkan(`/kurikulum/${id}`)     bukan revalidatePath
```

Penyaringan `id` milik induk yang benar dilakukan di setiap aksi pemetaan —
pola yang sudah dipakai `setelCplProfilLulusan`, supaya id CPL dari prodi lain
tidak dapat ditempelkan lewat permintaan buatan.

---

## BAGIAN 6 — Rencana kerja

| Tahap | Isi | Berkas |
|---|---|---|
| **C1** | Domain gerbang + uji (24 uji) | `domain/kurikulum/sunting.ts` + `.test.ts` |
| **C2** | Aksi CPL + panel di halaman kurikulum | `aksi-cpl.ts`, `[id]/cpl.tsx` |
| **C3** | Aksi Mata Kuliah + panel | `aksi-mk.ts`, `[id]/mata-kuliah.tsx` |
| **C4** | Aksi CPMK & Sub-CPMK + panel di halaman MK | `aksi-cpmk.ts`, `[id]/mk/[mkId]/capaian.tsx` |
| **C5** | Kurikulum kosong + panel validator hidup | `aksi.ts`, `page.tsx`, `[id]/page.tsx` |
| **C6** | Kamus `id` + `en`, `npm test`, `npm run typecheck` | `kamus/id.ts`, `kamus/en.ts` |
| **C7** | Sensus terpisah + uji integrasi Postgres (12 pemeriksaan) | `lib/kurikulum/sunting-inti.ts`, `uji/integrasi.ts` |

C1 lebih dulu dan berdiri sendiri: gerbangnya yang paling mahal bila salah.

---

## BAGIAN 7 — Bukan cakupan

- **Menyunting kurikulum `BERLAKU`.** Milik URK, selamanya.
- **Mengisi `pensiunSejakTaId`.** Butuh TA; milik URK (§2.4).
- **Ruas `*En`.** Milik [11](./11-dwibahasa.md) L2–L7.
- **`BahanKajian` dan `MkPrasyarat`.** Dua tabel yang ada di skema tetapi belum
  dipakai satu jalur pun. Menyalakannya di sini berarti merancang maknanya
  sekaligus — pekerjaan tersendiri.
- **Impor Excel diferensial** (impor yang menambal, bukan membuat baru).

---

## Lampiran — satu lubang yang ditemukan saat menyusun ini

Terpisah dari fitur, tetapi ditemukan di jalur yang sama dan ditambal
bersamanya:

`hapusKurikulum` (`aksi.ts`) hanya menolak status `BERLAKU`. Kurikulum `ARSIP`
lolos — padahal `Kurikulum → MataKuliah → Rpkps → RpkpsSnapshot` seluruhnya
`onDelete: Cascade`. Satu klik "Hapus" pada kurikulum yang diarsipkan
melenyapkan **setiap RPKPS terbit beserta salinan bekunya, kelas, peserta, dan
nilai** di bawahnya, tanpa satu pesan pun.

Penambalnya adalah G2 yang sama: `sensusKurikulum` menghitung RPKPS di bawah
kurikulum, dan `hapusKurikulum` menolak bila ada — menyebut jumlah serta nama
dokumennya. **Sudah terpasang.**
