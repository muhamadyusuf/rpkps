# 27 — Rupa iPad untuk halaman masuk dan aplikasi

Status: **DIGANTIKAN** oleh `docs/28-rupa-pengaturan-identitas.md` pada hari
yang sama (2026-09-25). Rupa iPad — layar kunci, layar utama, Dock, wallpaper,
kaca — sudah dibongkar. Yang masih berlaku dari dokumen ini hanya **§6.6
registri aplikasi terhubung** (kini ditampilkan di sidebar, docs/28 §4.3);
sisi registrinya ada di identitas-itts `docs/06-masuk-tunggal.md` §5.
Selebihnya disimpan sebagai catatan keputusan.

## 1. Permintaan dan keputusan

Permintaan (2026-09-25): tampilan halaman masuk dan seluruh layar setelah masuk
dibuat seperti **desktop iPad**, **tanpa menghilangkan fitur yang sudah ada**.

Keputusan yang sudah dipilih pengguna:

| Pertanyaan | Pilihan |
|---|---|
| Arah | **Lengkap**: masuk = layar kunci; dasbor = layar utama (ikon modul + Dock); tiap modul terbuka sebagai "jendela" bersidebar gaya iPadOS |
| Material | **Rupa Apple penuh**: wallpaper, kaca beku, huruf sistem (SF), biru sistem |
| Cakupan | **Kerangka + komponen**: masuk, kerangka, dasbor, dan token global (sudut, tombol, kartu, dialog). Isi halaman modul tidak disunting satu per satu |
| Katalog publik | **Tetap kertas/lumut** |
| Dock | Tampil di layar utama; **di dalam modul muncul saat kursor menyentuh tepi bawah**. Memuat modul RPKPS **dan aplikasi terhubung** (identitas-itts + registri) |
| Wallpaper | **Gradien bawaan + opsi foto kampus ITTS**, diatur ADMIN |
| Sumber aplikasi terhubung | **Registri di identitas-itts** (`/klien`), dibaca lewat `GET /api/v1/aplikasi` |

Keputusan ini **menggantikan "Kisi & Cahaya" untuk bagian aplikasi yang
memerlukan login**. Arah kaca beku pernah ditolak pada 2026-08-20; pilihan kali
ini adalah permintaan eksplisit, bukan penyegaran yang ditawarkan.

## 2. Batas: apa yang berubah dan apa yang tidak

**Berubah (hanya lapisan rupa):**
- `/masuk`, `/menunggu-verifikasi`, `/setup`
- seluruh rute di bawah `(app)`: kerangka, dasbor, dan komponen `ui/*` yang
  dipakai di sana (lewat token, bukan lewat penyuntingan per halaman)

**Tidak berubah sama sekali:**
- data, aksi server, wewenang, rute, alur masuk (Google + identitas-itts),
  parameter `lanjut`, notifikasi, pengalih bahasa & tema
- **katalog publik dan pratinjau bertoken** `(publik)` — tetap kertas/lumut
- **hasil cetak** (pratinjau RPKPS → PDF, `@media print`) — tetap seperti
  sekarang
- berkas `.docx`/`.pptx`/`.xlsx`, kop lembaga, sidik — tidak menyentuh rupa layar

Akibat yang disetujui: halaman masuk **tidak lagi serupa** dengan halaman
depan publik. Keputusan 2026-09-21 ("satu produk, satu rupa") kini hanya
berlaku di dalam katalog publik. Rupa area login sekeluarga dengan desktop
identitas-itts: nilai kaca, wallpaper, dan ubin disalin dari sana.

## 3. Mekanisme teknis: satu saklar, dipasang pada `<html>`

Masalahnya: dialog, dropdown, tooltip, combobox, dan toast (`sonner`) dirender
lewat **portal ke `<body>`**, di luar pembungkus halaman mana pun. Token yang
dipasang pada `<div className="rupa-ipad">` tidak akan sampai ke sana, dan
dialog akan tetap berwarna lumut di atas jendela iPad.

Solusinya: token iPad dipasang pada akar dokumen **dengan syarat** ada penanda
di dalam halaman:

```css
@media screen {
  :root:has([data-rupa="ipad"])       { /* token terang iPad */ }
  .dark:has([data-rupa="ipad"])       { /* token gelap iPad  */ }
}
```

- `data-rupa="ipad"` dipasang oleh `(app)/layout.tsx` dan halaman masuk /
  menunggu-verifikasi / setup. Halaman publik tidak memasangnya → tetap
  kertas/lumut, tanpa root layout kedua dan tanpa muat ulang penuh saat
  berpindah antar grup rute.
- Spesifisitas `:root:has(…)` (0,2,0) mengalahkan `:root`/`.dark` (0,1,0),
  jadi tidak perlu `!important`.
- Dibungkus `@media screen`: blok `@media print` yang ada tetap berlaku tanpa
  diubah, dan cetakan tidak ikut berwarna biru/kaca.
- `:has()` didukung Safari 15.4+, Chrome 105+, Firefox 121+. Peramban lebih
  tua jatuh ke palet kertas — tetap berfungsi, hanya tidak ber-rupa iPad.

Komponen `ui/*` sudah membaca sudut, warna, dan bayangan dari token
(`--radius`, `--primary`, `--card`, `--bayang*`), jadi sebagian besar
perubahan terjadi tanpa menyentuh berkas komponennya.

## 4. Token

### 4.1 Warna (warna sistem Apple)

| Token | Terang | Gelap | Keterangan |
|---|---|---|---|
| `--background` | `#f2f2f7` | `#0b0b0d` | systemGroupedBackground |
| `--card` | `#ffffff` | `#1c1c1e` | secondarySystemGrouped |
| `--popover` | `#ffffffeb` + blur | `#2c2c2eeb` + blur | |
| `--foreground` | `#1c1c1e` | `#f5f5f7` | label |
| `--muted-foreground` | `#6e6e73` | `#98989f` | secondaryLabel (pekat, kontras ≥ 4.5 : 1) |
| `--border` | `#dcdce0` | `#38383a` | separator |
| `--primary` / `--cahaya` / `--ring` | `#007aff` | `#0a84ff` | biru sistem |
| `--success` | `#34c759` (teks `#248a3d`) | `#30d158` | |
| `--warning` | `#ff9500` (teks `#c93400`) | `#ff9f0a` | |
| `--destructive` | `#ff3b30` (teks `#d70015`) | `#ff453a` | |
| `--sidebar` | `#f5f5f7c7` + blur | `#1c1c1ec7` + blur | |

Varian teks (`*-foreground`) memakai varian aksesibel Apple supaya kontras
teks status di atas putih ≥ 4.5 : 1.

### 4.2 Bentuk dan huruf

- `--radius`: 0.3rem → **0.75rem** (tombol & input ±10px, kartu ±16px,
  jendela & Dock 22px, ikon modul squircle 22.5% dari sisinya).
- Huruf: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
  var(--font-inter), system-ui, sans-serif`. SF tidak boleh dimuat sebagai
  web font (lisensi), jadi di Mac/iPad tampil SF asli dan di Windows/Android
  jatuh ke **Inter** yang sudah dimuat — paling mirip SF. Judul memakai
  tumpukan yang sama (Space Grotesk tidak dipakai di area login).
- Mono: `ui-monospace, "SF Mono", var(--font-jetbrains-mono), monospace`.
  Angka tabular tetap dipertahankan (`tabular-nums`) — SF mendukungnya.
- `.label-teknis` di bawah rupa iPad menjadi judul bagian gaya daftar
  berkelompok iOS: huruf sistem, tebal 600, huruf besar, spasi 0.04em —
  bukan mono. Kelasnya tetap; hanya definisinya yang dilingkupi.
- `.siku` (palang aksen kiri) dan kisi `body::before` **dimatikan** di bawah
  rupa iPad. Kedalaman datang dari wallpaper, kaca, dan bayangan lembut.

### 4.3 Material kaca

Utilitas `kaca` dan `kaca-tebal` (`@utility`, supaya dapat diberi varian
seperti `max-md:kaca`), nilainya sama dengan identitas-itts:

```css
background: var(--kaca);                    /* putih 62% / gelap 58% */
border: 1px solid var(--kaca-garis);
backdrop-filter: blur(28px) saturate(170%);
```

Dipakai pada: **Dock, pusat kontrol, widget layar utama, kartu layar kunci,
bilah ponsel**. Sidebar memakai `--sidebar` tembus pandang + blur; dialog,
dropdown, dan tooltip memakai `--popover` + blur (§6.7).

**Kartu isi halaman tidak memakai `backdrop-filter`**, melainkan permukaan
putih/abu pekat. Alasannya kinerja: halaman seperti penyunting RPKPS memuat
puluhan kartu bertabel panjang, dan blur pada tiap kartu memaksa peramban
menggambar ulang area besar setiap kali digulir. Di iPad pun isi aplikasi
berada di atas latar pekat — kaca hanya pada kerangkanya.

`@media (prefers-reduced-transparency: reduce)` → seluruh `.kaca` menjadi
pekat. `prefers-reduced-motion` yang sudah ada tetap berlaku.

### 4.4 Wallpaper

**Bawaan:** gradien CSS (`.latar-desktop`, sama dengan identitas-itts) —
tanpa unduhan, tajam di semua resolusi, punya varian gelap.

**Foto kampus (opsional, ADMIN):** kartu **Wallpaper** di `/master/prodi`,
di bawah lambang institusi. Admin memilih gradien atau foto; foto dapat
dilepas tanpa dihapus.

- Disimpan sebagai bita di `institusi.wallpaper` (+ `wallpaper_tipe`,
  `wallpaper_aktif`, `wallpaper_diubah`), dengan alasan yang sama dengan logo.
  Migrasi `20260925010000_wallpaper_institusi`.
- Diterima hanya PNG/JPEG menurut **bita ajaib** (`periksaWallpaper`,
  memakai pengurai `ukuranGambar` yang sama dengan logo), ≤ 3 MB (di bawah
  batas Server Action 4 MB), lanskap ≥ 1280×720, ≤ 6000 px. SVG ditolak.
- Dilayani `GET /api/institusi/wallpaper?v=<cap>` — **pintu tanpa login**,
  karena layar kunci menampilkannya sebelum ada sesi; masuk daftar putih
  `proxy.ts`. Pagarnya sama dengan rute lambang: tidak memanggil
  `lib/publik/muat.ts` maupun `lib/berbagi/muat.ts`, dan tidak menyentuh data
  akademik (`src/lib/rupa/wallpaper.test.ts`). `?pratinjau=1` (foto belum
  aktif) hanya untuk ADMIN.
- Di atas foto, teks yang berdiri langsung di wallpaper (`.teks-wallpaper`)
  menjadi putih berbayang; kartu kaca tidak terpengaruh.

## 5. Layar kunci (`/masuk`)

```
┌────────────────────────────────────────────────────────┐
│ 09.41                                  ID  ☾   ▮▮▮    │ ← bilah status (kaca tipis)
│                                                        │
│                       09.41                            │ ← jam besar (klien)
│                 Kamis, 25 September                    │
│                                                        │
│              ╭──────────────────────────╮              │
│              │  [ikon]  RPKPS ITTS      │              │ ← kartu kaca
│              │  tagline + subjudul      │              │
│              │  ┌────────────────────┐  │              │
│              │  │ G  Masuk dg Google │  │              │
│              │  └────────────────────┘  │              │
│              │  ─────── atau ───────    │              │
│              │  ┌────────────────────┐  │              │
│              │  │ 🔑 Identitas ITTS  │  │              │
│              │  └────────────────────┘  │              │
│              │  [galat SSO / langkah]   │              │
│              │  🛡 catatan jaminan       │              │
│              ╰──────────────────────────╯              │
│                    deskripsi aplikasi                  │
└────────────────────────────────────────────────────────┘
```

- **Seluruh logika `tombol-masuk.tsx` tidak disentuh**: Google, SSO
  identitas-itts, pesan `?galat=`, galat langkah konfigurasi, kotak "belum
  dikonfigurasi", penanganan `lanjut`. Yang berubah hanya kelas CSS.
- Pengalih bahasa dan tema pindah ke bilah status.
- Jam dan tanggal dirender **di klien setelah mount** (tempatnya dipesan lebih
  dulu supaya tidak ada lompatan tata letak): server berjalan di UTC,
  pengguna di WIB/WITA/WIT, dan waktu yang dirender server akan salah jam
  sekaligus memicu galat hidrasi. Format lewat `src/lib/bahasa/format.ts`
  sesuai bahasa aktif.
- Semua teks yang sudah ada (tagline, subjudul, catatan, deskripsi) tetap
  tampil — tidak ada yang dibuang demi kebersihan layar kunci.
- `/menunggu-verifikasi` dan `/setup` memakai bingkai layar kunci yang sama.

## 6. Setelah masuk

### 6.1 Kerangka: jendela di atas wallpaper

```
 wallpaper
 ┌──────────────────────────────────────────────────────────┐
 │ 09.41  Kam 25 Sep                  🔔3  ID  ☾   (YM) ▾  │ ← bilah status
 │ ╭──────────────╮╭──────────────────────────────────────╮ │
 │ │ ◧  RPKPS     ││  Judul besar halaman                 │ │
 │ │ ⌂ Beranda    ││                                      │ │
 │ │──────────────││  ╭──────────────────────────────╮    │ │
 │ │ MODUL        ││  │ isi halaman (tidak diubah)   │    │ │
 │ │ ▣ Notifikasi3││  ╰──────────────────────────────╯    │ │
 │ │ ▣ Kurikulum  ││                                      │ │
 │ │ ▣ RPKPS    ● ││                                      │ │
 │ │ ...          ││                                      │ │
 │ │ (YM) Yusuf   ││                                      │ │
 │ ╰──────────────╯╰──────────────────────────────────────╯ │
 └──────────────────────────────────────────────────────────┘
```

- **≥ 1024px**: modul tampil sebagai jendela bersudut 22px yang melayang 10px
  dari tepi wallpaper (kesan Stage Manager). Sidebar kaca menempel di sisi
  kiri jendela, bukan tepi layar.
- **768–1023px**: jendela memenuhi layar (tanpa margin wallpaper), sidebar
  kaca tetap.
- **< 768px**: bilah status + bilah keping modul yang sudah ada
  (`NavigasiPonsel`), disetel ulang menjadi keping membulat gaya iOS.
- Cetak: bilah status, sidebar, wallpaper, dan margin jendela `print:hidden`
  — naskah tetap tercetak rata kertas.

### 6.2 Bilah status (komponen baru `bilah-status.tsx`)

Kiri: lambang + "RPKPS ITTS" (jalan pulang ke layar utama). Kanan: jam +
tanggal singkat, lonceng notifikasi berlencana merah, dan avatar inisial
yang membuka **pusat kontrol** (nama, surel, daftar peran, pengalih bahasa,
pengalih tema, tombol keluar). Ini **menampung ulang** isi kaki rel samping
sebelumnya — tidak ada yang hilang, hanya berpindah tempat, dan kini juga
tersedia di ponsel.

### 6.3 Sidebar (`rel-samping.tsx` + `navigasi.tsx`, logika tetap)

Yang dipertahankan persis:
- penyaringan menu per peran (`MENU` + `punyaPeran`) dan lencana
  notifikasi — dirakit di server seperti sekarang
- ciut/lebar dengan cookie `NAMA_COOKIE_REL` dan keadaan di klien tanpa
  `router.refresh()`; tombolnya menjadi ikon "sidebar" iPadOS di kepala
  sidebar, dan rel ciut menampilkan ikon squircle + tooltip
- `aria-current`, `aria-label` saat ciut, tooltip, `Tautan` berawalan bahasa

Yang berubah: butir aktif ditandai **latar biru membulat berteks putih**
(gaya sidebar iPadOS) menggantikan batang aksen kiri; ikon tiap butir
menjadi squircle kecil berwarna (§6.5). Kaki sidebar tinggal penanda orang
yang sedang masuk (avatar + nama + surel; avatar + tooltip saat ciut) —
komputer lab dipakai bergantian. Pengalih dan tombol keluar ada di pusat
kontrol.

### 6.4 Layar utama (`/dashboard`)

```
 09.41 ─ bilah status ─────────────────────────────────────
        Selamat pagi, Yusuf
        TA 2026 Ganjil · Dosen, Kaprodi · tenggat 30 Sep [7 hari]

 ╭─ widget ──────────────╮ ╭─ widget ──────────────╮
 │ Antrian kerja (n)     │ │ Kebijakan beban DRAF  │   ← bila ada
 ╰───────────────────────╯ ╰───────────────────────╯

   [▣]      [▣]      [▣]      [▣]      [▣]      [▣]
 Kurikulum Usulan   RPKPS  Bahan Ajar Evaluasi  Beban     ← ikon modul
   [▣]      [▣]      [▣]
  Prodi   Tahun   Pengguna …                                (menu yang lolos peran)

 ╭─ widget ── Panel Prodi ──────────────────────────────╮
 │ (isi PanelProdi yang sekarang, tidak diubah)          │   ← panel per peran,
 ╰───────────────────────────────────────────────────────╯     bertumpuk seperti
 ╭─ widget ── Panel Dosen ──────────────────────────────╮      sekarang
 ╰───────────────────────────────────────────────────────╯

          ╭───────────────────────────────────╮
          │  ⌂   🔔³   ▣   ▣   ▣   ▣  │  ▣  │           ← Dock (kaca, menempel bawah)
          ╰───────────────────────────────────╯
```

- **Semua isi dasbor sekarang tetap ada**: salam, tahun akademik aktif,
  daftar peran, tenggat + `LencanaTenggat`, antrian kerja, kartu kebijakan
  DRAF, panel Prodi/Mutu/Dosen/Admin/Asesor/Mahasiswa yang bertumpuk menurut
  peran, dan kartu "tanpa peran". Panel hanya dibungkus bingkai widget
  (sudut 22px, judul kecil) — isi dan bagan SVG-nya tidak diubah.
- Grid ikon memakai `menuTampil` yang sama dengan sidebar (tidak ada daftar
  menu kedua), diteruskan lewat konteks `PenyediaMenu` — tanpa hitung
  notifikasi kedua ke basis data. Lencana notifikasi tampil sebagai bulatan merah di pojok ikon.
- **Dock** berisi Dasbor, Notifikasi, RPKPS, Kurikulum, Bahan Ajar,
  Evaluasi (yang lolos peran), lalu pemisah dan aplikasi terhubung (§6.6).
  Di layar utama ia selalu tampil. Di dalam modul ia bersembunyi dan muncul
  lewat (1) kursor di tepi bawah layar, (2) fokus papan ketik, atau
  (3) ketukan pada batang indikator di tepi bawah (perangkat sentuh).
  Berpindah halaman menyembunyikannya lagi.
- Ikon modul punya efek tekan (skala 0.92) dan fokus papan ketik yang
  terlihat; ikon adalah `Tautan` biasa, bukan tombol JavaScript.

### 6.5 Ikon modul

Squircle bergradien lembut dengan ikon lucide putih. Warna ditetapkan per
kunci ikon (`KunciIkon`) di **komponen** — `src/lib/menu.ts` tetap tidak
tahu soal rupa:

| Modul | Warna | Modul | Warna |
|---|---|---|---|
| Beranda | abu | Beban belajar | teal |
| Notifikasi | merah | Program studi | ungu |
| Kurikulum | nila | Tahun akademik | merah muda |
| Usulan | oranye | Pengguna | abu |
| RPKPS | biru | Kunci AI | kuning |
| Bahan Ajar | cokelat | Perangkap | grafit |
| Evaluasi | hijau | | |

`Record<KunciIkon, …>` membuat kompilator menolak kunci ikon baru yang lupa
diberi warna.

### 6.6 Aplikasi terhubung di Dock

Daftarnya datang dari **registri di identitas-itts** — satu daftar untuk
desktop identitas-itts dan Dock setiap aplikasi klien. Admin mengisi
**/klien → (aplikasi) → Desktop & Dock**: alamat, tampil/tidak, ikon, warna.

```
identitas-itts  klien_oidc.url_aplikasi / tampil_di_desktop / ikon_desktop / warna_desktop
      │  GET /api/v1/aplikasi   (Basic client_id:client_secret)
      ▼
RPKPS  muatAplikasiTerhubung()  — cache 10 menit, gagal 1 menit, batas waktu 2,5 dtk
      │  janji TIDAK di-await di tata letak → Dock membukanya di balik Suspense
      ▼
Dock   [ modul RPKPS ] | [ Identitas ITTS ] [ aplikasi lain … ]
```

- **Halaman tidak pernah menunggu jaringan demi Dock**, dan pemuatnya tidak
  pernah melempar: identitas-itts mati = Dock tanpa ikon aplikasi lain.
- Ikon **Identitas ITTS** tidak lewat registri: alamatnya dari
  `IDENTITAS_ITTS_URL`, supaya jalan pulang tetap ada saat registri tak
  terjangkau.
- Jawaban registri diperiksa ulang (`uraiDaftarAplikasi`): hanya http/https
  tanpa kredensial, ikon/warna dari kosakata tetap, maksimal 12, entri RPKPS
  sendiri dibuang. Butir cacat dibuang satu per satu, bukan seluruh daftar.
- Tautan keluar dibuka di **tab baru** (`<a>`, bukan `Tautan`): suntingan yang
  belum tersimpan tidak hilang, dan pintu masuk tunggal di sana tidak dimuat
  awal.
- Cadangan peralihan di identitas-itts: klien yang belum beralamat di registri
  masih memakai `URL_RPKPS`/`URL_KAMPUS_MAPS`.

### 6.7 Komponen `ui/*`

Hampir seluruhnya lewat token (warna, sudut, bayangan). Yang disentuh
langsung hanya permukaan melayang — dialog, dropdown, select, combobox,
tooltip — yang diberi `backdrop-blur`, karena `--popover` di rupa iPad kini
tembus pandang. Pada palet kertas `--popover` pekat, jadi katalog publik tidak
berubah. Nama komponen, props, dan varian tidak berubah.

Tidak dikerjakan (bisa menyusul bila diinginkan): dialog sebagai lembar dari
bawah di layar sempit, dan tab bergaya kontrol bersegmen penuh.

## 7. Teks baru dan bahasa

Teks baru (mis. "Beranda", label Dock, "Buka menu akun", format jam) masuk
ke `src/kamus/id.ts` **dan** `en.ts` (`typeof id` menjamin kelengkapannya).
Seluruh tautan baru lewat `Tautan`/`jalur` — tidak ada `href` berawalan
bahasa yang ditulis tangan.

## 8. Tahapan dan status

| Tahap | Isi | Status |
|---|---|---|
| **R1** | Token iPad, `kaca`/`kaca-tebal` (`@utility`), wallpaper, ubin, penonaktifan kisi/siku | terpasang |
| **R2** | Layar kunci: masuk, menunggu verifikasi, setup (`LayarKunci`) | terpasang |
| **R3** | Kerangka jendela, bilah status, pusat kontrol, sidebar kaca | terpasang |
| **R4** | Layar utama (widget jam + semester, grid ikon), Dock, aplikasi terhubung | terpasang |
| **R5** | Blur permukaan melayang `ui/*` | terpasang |
| **R6** | Verifikasi | `typecheck`, `npm test` (1367 lulus), ESLint lulus; **tangkapan layar di peramban belum** — perlu server dev di-restart (klien Prisma baru) |

Daftar periksa "fitur tidak hilang" untuk R6: masuk Google; masuk
identitas-itts; `?galat=`; `?lanjut=`; pengalih bahasa & tema (3 posisi) di
pusat kontrol; menu per peran; lencana notifikasi (sidebar, bilah status,
ikon, Dock); ciut/lebar rel bertahan setelah muat ulang; identitas sesi +
peran; keluar; navigasi ponsel; semua panel dasbor per peran; cetak pratinjau
RPKPS bersih; katalog publik tetap kertas/lumut; wallpaper foto aktif/lepas.

## 9. Keputusan yang sudah diambil (2026-09-25)

1. Katalog publik tetap kertas/lumut.
2. Dock juga di dalam modul (muncul di tepi bawah), dan memuat identitas-itts
   serta aplikasi terhubung lain.
3. Gradien bawaan + opsi foto kampus yang diatur admin.
4. Daftar aplikasi dari registri identitas-itts, bukan env RPKPS.
