# 28 — Rupa "Pengaturan" identitas-itts untuk area login

Status: **terpasang** (2026-09-25), S1–S5. Verifikasi visual di peramban
belum (§10). Menggantikan sebagian besar `docs/27-rupa-ipad.md` (lihat §8).

## 1. Permintaan dan keputusan

Permintaan (2026-09-25): tampilan setelah login — mulai dari dasbor sampai
seluruh menu — mengikuti tampilan identitas-itts di bagian **/pengaturan**.

| Pertanyaan | Keputusan |
|---|---|
| Layar utama iPad (ikon, Dock, wallpaper) | **Dihapus.** Semua halaman memakai kerangka Pengaturan. Peluncur antar-aplikasi adalah desktop identitas-itts sendiri |
| Warna & huruf | **Ikuti identitas-itts persis**: latar abu netral, butir aktif tinta hitam, aksen jingga "sinyal", huruf Geist + Geist Mono |
| Halaman masuk | **Ikut diubah**: polos ala Pengaturan — latar netral, kartu di tengah, tanpa jam dan wallpaper |
| Katalog publik & cetakan | Tidak berubah (kertas/lumut), seperti docs/27 |

## 2. Acuan: apa itu "rupa Pengaturan" di identitas-itts

Sumbernya `identitas-itts/src/components/shell/{cangkang,sisi,pengaturan,halaman}.tsx`,
`src/components/ui/dasar.tsx`, dan `src/app/pengaturan/page.tsx`.

- **Latar** `--latar` abu-putih netral; halaman menggulir biasa. Tanpa
  wallpaper, tanpa kaca, tanpa jendela melayang.
- **Sidebar tetap di kiri**, lebar 280px (`lg` ke atas), latar `--permukaan-2`,
  tepi kanan satu garis:
  - kepala: tautan kecil **"‹ Desktop"** berwarna sinyal + judul besar 26px;
  - **kartu akun**: avatar, nama, lencana peran monospace, surel;
  - **menu berkelompok**: judul kelompok `label-mikro` (mono, huruf besar),
    tiap kelompok satu kotak bertepi membulat; butir 40px berisi ubin ikon
    berwarna 26px, label, dan `›`; garis pemisah menjorok setelah ubin;
  - butir aktif: **latar tinta hitam, teks putih**;
  - **kaki**: sakelar tema (ikon matahari/bulan/layar) + ID/EN, lalu tombol
    **Keluar** merah-lembut;
  - dapat diciutkan menjadi **lajur ikon 68px** (⌘\ / Ctrl+\), tersimpan di
    cookie; label muncul sebagai petunjuk melayang.
- **Di bawah `lg`**: bilah atas lengket "‹ Desktop · judul · ☰" dan menu
  sebagai **laci dari kanan** dengan tirai gelap.
- **Isi halaman** (`Halaman`): lebar maks 6xl, `pt-10 pb-16`, jarak antar
  bagian 40px. `KepalaHalaman`: judul 22–24px + deskripsi + aksi di kanan.
  Kartu statistik: label mikro + ikon, angka **monospace 32px**. `Bagian`:
  judul 15px dengan **nomor "01/02/03"** monospace. `Kartu`: `rounded-xl`,
  tepi `--garis`, bayang `b1`.

## 3. Mekanisme

Saklar yang sama dengan docs/27 dipertahankan karena alasannya tetap berlaku
(portal dialog/dropdown/toast ke `<body>`): penanda di dalam halaman, token
di akar dokumen, hanya untuk layar.

```css
@media screen {
  :root:has([data-rupa="aplikasi"])  { /* token terang identitas-itts */ }
  .dark:has([data-rupa="aplikasi"])  { /* token gelap identitas-itts  */ }
}
```

Nama penandanya berganti dari `ipad` ke `aplikasi` supaya tidak menyesatkan.
Seluruh blok token iPad, `kaca`, `latar-desktop`, dan `teks-wallpaper` dihapus.

### 3.1 Pemetaan token

Palet identitas-itts dipetakan ke token shadcn yang sudah dibaca seluruh
komponen `ui/*` — jadi halaman modul ikut berubah tanpa disunting:

| Token RPKPS | Dari identitas-itts |
|---|---|
| `--background` | `--latar` |
| `--card`, `--popover` | `--permukaan` |
| `--muted`, `--secondary`, `--accent` | `--permukaan-2` / `--permukaan-3` |
| `--foreground` / `--muted-foreground` | `--teks` / `--teks-2` |
| `--border` / `--input` | `--garis` / `--garis-kuat` |
| `--primary` / `--primary-foreground` | `--tinta` / `--tinta-teks` (tombol utama hitam) |
| `--cahaya`, `--ring` | `--sinyal` (jingga — fokus dan hal yang butuh perhatian) |
| `--warning` / `-foreground` | `--sinyal` / `--sinyal-teks` |
| `--success`, `--destructive` | `--sukses*`, `--bahaya*` |
| `--sidebar` | `--permukaan-2` |
| `--bayang-sm/…/lg` | `--bayang-1/2/3` |

Nilai persisnya disalin dari `identitas-itts/src/app/globals.css` (terang dan
`data-theme="gelap"`), dalam oklch seperti aslinya. RPKPS tetap memakai
`next-themes` (`.dark`), jadi blok gelapnya dipasang di bawah `.dark`.

### 3.2 Huruf

**Geist** + **Geist Mono** lewat `next/font` di tata letak akar, dengan
`preload: false`: variabelnya tersedia di semua halaman, tetapi katalog
publik (yang tetap memakai Inter/Space Grotesk) tidak ikut mengunduhnya.
`.label-teknis` dibentuk ulang menjadi `label-mikro` identitas-itts (mono
10.5px, huruf besar, `--teks-3`) — kelasnya tetap, puluhan halaman tidak
disentuh.

## 4. Kerangka (`(app)/layout.tsx`)

Komponen docs/27 — `Kerangka`, `BilahStatus`, `PusatKontrol`, `Dock`,
`GridModul`, `Wallpaper`, `LayarKunci`, `jam.tsx` — **dihapus**. Diganti:

```
lg ke atas                                     di bawah lg
┌───────────────┬────────────────────────┐    ┌──────────────────────────┐
│ ‹ Identitas   │                        │    │ ‹ Identitas  RPKPS (YM)☰ │
│ RPKPS      ◧  │  Judul halaman  [aksi] │    ├──────────────────────────┤
│ ┌───────────┐ │  deskripsi…            │    │  isi halaman             │
│ │▣ Dasbor  ›│ │  isi halaman           │    └──────────────────────────┘
│ │▣ Notif 3 ›│ │  (tidak disunting)     │      ☰ → laci dari kanan: menu
│ └───────────┘ │                        │      (YM) → pusat kontrol
│ AKADEMIK      │                        │
│ ┌───────────┐ │                        │
│ │▣ Kurik.  ›│ │                        │
│ │▣ RPKPS   ›│ │                        │
│ └───────────┘ │                        │
│ …             │                        │
└───────────────┴────────────────────────┘
  bilah atas kolom isi: ……………………… (YM) ▾ → nama, peran, tema, ID/EN, Keluar
```

### 4.1 Kepala sidebar

- **"‹ Identitas ITTS"** — padanan "‹ Desktop" di identitas-itts: kembali ke
  desktop identitas-itts, yang kini menjadi satu-satunya peluncur antar
  aplikasi. Alamatnya dari `IDENTITAS_ITTS_URL`; bila integrasi belum
  dikonfigurasi, tautan ini tidak tampil.
- Judul besar **"RPKPS"** (padanan "Pengaturan").
- Tombol ciutkan di kanan judul (layar lebar saja).

### 4.2 Pusat kontrol di pojok kanan atas

Revisi 2026-09-25 (permintaan user, "supaya sidebar punya ruang lebih"):
kartu akun dan kaki sidebar **dipindah** ke satu pusat kontrol di pojok
kanan atas, seperti pusat kontrol desktop identitas-itts (dan versi iPad
sebelumnya). Sidebar kini hanya berisi kepala dan menu.

- **Layar lebar:** bilah atas 56px di kolom isi (bukan di atas sidebar),
  **tidak lengket** — ikut tergulir bersama halaman, jadi elemen halaman
  yang `sticky top-6` (pratinjau RPKPS, editor mingguan) tidak tertutup.
  Isinya di kanan: **hari, tanggal, dan jam** ("Jum, 25 Sep 11:19") lalu
  avatar. Bilah tersendiri — bukan avatar yang melayang — supaya tidak
  menimpa tombol aksi di kanan judul halaman.
- **Jam** (`src/components/rupa/jam.tsx`) dirender hanya di peramban (server
  di UTC, pengguna di WIB/WITA/WIT), diperbarui tiap pergantian menit.
  Formatnya `waktuStatus` (`src/lib/bahasa/format.ts`): jam-menit selalu
  bertitik dua, meski bawaan `id-ID` memakai titik.
- **Di bawah `lg`:** avatar yang sama di bilah atas ponsel (lengket, karena
  memuat ☰), di sebelah ☰. Jam tidak ditampilkan di sana — tidak muat.
- **Panel** (klik avatar; Esc/klik di luar menutup), berurutan: avatar + nama
  + surel; semua peran sebagai lencana monospace; **Aplikasi terhubung**
  sebagai kisi ikon (Identitas ITTS lebih dulu, lalu registri — dimuat di
  balik Suspense, tidak pernah ditunggu); sakelar tema + ID/EN; tombol
  **Keluar**. Komponen: `src/components/rupa/pusat-kontrol.tsx`.
- Avatar selalu terlihat — "sedang masuk sebagai siapa" tetap terjawab di
  komputer lab yang dipakai bergantian.

### 4.3 Menu berkelompok

`src/lib/menu.ts` mendapat medan `grup` (urutan dan pengelompokan adalah
struktur menu, bukan rupa); ikon dan warna ubin tetap di komponen.

| Kelompok | Butir | Peran |
|---|---|---|
| — | Dasbor, Notifikasi (lencana jumlah) | semua |
| Akademik | Kurikulum, Usulan Revisi, RPKPS, Bahan Ajar, Evaluasi Capaian | semua |
| Kebijakan | Beban Belajar | ADMIN, GPM |
| Data induk | Program Studi, Tahun Akademik, Pengguna | ADMIN |
| Akun & sistem | Kunci AI, Perangkap | Kunci AI semua; Perangkap ADMIN |
| ~~Aplikasi terhubung~~ | dipindah ke pusat kontrol (§4.2) | — |

Penyaringan per peran, lencana notifikasi, `aria-current`, dan `Tautan`
berawalan bahasa tetap seperti sekarang. Aplikasi terhubung kini di pusat
kontrol (§4.2); aturan pemuatnya (tanpa `await`, tidak pernah melempar)
tetap berlaku.

### 4.4 Kaki sidebar

Dihapus (lihat §4.2) — tema, bahasa, dan keluar ada di pusat kontrol.

### 4.5 Lajur ringkas

Cookie `rel_ciut` yang sudah ada dipakai ulang (server merender lebar yang
benar, tanpa kedipan). Pintasan ⌘\ / Ctrl+\ ditambahkan seperti di
identitas-itts.

### 4.6 Cetak

Sidebar, bilah atas, dan laci `print:hidden`; isi tanpa `padding-left`
sidebar saat dicetak. Pratinjau RPKPS tercetak seperti sekarang.

## 5. Dasbor

Dasbor menjadi halaman bergaya **Ringkasan** identitas-itts, tanpa jam,
widget kaca, maupun ikon modul:

1. `KepalaHalaman`: judul = salam; deskripsi = tahun akademik aktif · peran;
   aksi = tenggat penyusunan + `LencanaTenggat`.
2. Baris **kartu statistik** (angka mono 32px) dari data yang SUDAH dimuat
   `muatDasbor` — tanpa kueri baru: jumlah antrian kerja, hari menuju
   tenggat, dan angka ringkas panel per peran yang tersedia.
3. **Bagian bernomor**: 01 Antrian kerja · 02 panel pertama sesuai peran ·
   03 … Kartu kebijakan DRAF tampil sebagai kartu bertepi sinyal.
4. Isi tiap panel per peran tidak diubah — hanya dibungkus `Bagian`.

## 6. Halaman masuk (dan menunggu verifikasi, setup)

Polos ala Pengaturan: latar `--latar`, sakelar tema/bahasa di pojok kanan
atas, satu `Kartu` 400px di tengah berisi lambang, nama aplikasi, subjudul,
kedua tombol masuk, pesan galat, dan catatan akun institusi; deskripsi
aplikasi kecil di bawahnya. Logika `TombolMasuk` tidak disentuh. Tombol
Google = tombol utama tinta; Identitas ITTS = tombol sekunder bertepi.

## 7. Komponen `ui/*`

Lewat token. Penyesuaian kecil pada berkasnya supaya serupa dasar
identitas-itts: `Card` → tepi `--garis` + bayang `b1`; tab garis bawah tinta
(`kelasTab`); blur permukaan melayang dari docs/27 dilepas (popover kembali
pekat). Nama dan props komponen tidak berubah.

## 8. Yang terjadi pada hasil docs/27

| Bagian docs/27 | Nasib |
|---|---|
| Layar kunci, jam, wallpaper gradien, kaca, bilah status, pusat kontrol, jendela melayang, grid ikon, Dock | **dihapus** |
| Registri aplikasi di identitas-itts + `GET /api/v1/aplikasi` + `uraiDaftarAplikasi` | **dipertahankan** — kini mengisi kelompok "Aplikasi terhubung" di sidebar |
| Wallpaper foto kampus (kolom `institusi.wallpaper*`, rute, kartu admin) | **lihat §9** |
| `Ubin` + `IKON_MODUL`/`WARNA_MODUL` | dipertahankan, ukuran menjadi 26px ala `UbinMenu` |

## 9. Keputusan (2026-09-25)

1. **Wallpaper foto kampus dihapus**: kartu admin, rute
   `/api/institusi/wallpaper`, entri proxy, domain, dan uji. Kolomnya dibuang
   migrasi `20260925020000_hapus_wallpaper_institusi` — **belum diterapkan**
   ke basis data; kode tidak lagi membaca kolom itu, jadi urutan penerapannya
   bebas.
2. Kelompok menu sesuai §4.3 (medan `grup` di `src/lib/menu.ts`).

## 10. Tahapan

| Tahap | Isi |
|---|---|
| **S1** | Token identitas-itts + Geist, hapus token/utilitas iPad |
| **S2** | Kerangka: sidebar Pengaturan (penuh, ringkas, laci), bilah atas ponsel, `grup` di menu, aplikasi terhubung |
| **S3** | Dasbor gaya Ringkasan |
| **S4** | Halaman masuk, menunggu verifikasi, setup |
| **S5** | Penyesuaian `ui/*`, pembersihan komponen docs/27 (+ wallpaper sesuai §9) |
| **S6** | Verifikasi: typecheck, uji (1358 lulus), lint — lulus. Rute aplikasi lolos kompilasi. **Tangkapan layar terang/gelap/ponsel/cetak belum** (peramban otomatis tidak tersedia) |

Komponen `ui/*` akhirnya tidak disunting sama sekali: semuanya ikut lewat token.
Komponen docs/27 yang dihapus: `kerangka`, `bilah-status`, `pusat-kontrol`,
`dock`, `grid-modul`, `wallpaper`, `layar-kunci`, `jam`, serta `rel-samping`
dan `navigasi` lama. Penggantinya: `src/components/rupa/{cangkang,sisi,
tampilan,avatar,halaman-polos,ubin}.tsx`.
