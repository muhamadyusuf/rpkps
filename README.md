# RPKPS ITTS

Aplikasi penyusunan **Rencana Program dan Kegiatan Pembelajaran Semester** berbasis
_Outcome-Based Education_ untuk Institut Teknologi Tangerang Selatan.

Status: **perencanaan lengkap, dengan lapisan AI**. Satu mata kuliah dapat
disusun dari nol sampai berkas Word bersidik yang siap tanda tangan — termasuk
tugas/proyek dan kisi-kisi UTS/UAS — dan dokumen yang sudah terbit tidak lagi
berubah meski kurikulumnya disunting. Draf isinya dapat diusulkan AI, tetapi
tidak ada satu pun angka darinya yang masuk dokumen tanpa dihitung ulang.
Berikutnya: pelaksanaan (nilai per butir) dan analitik ketercapaian CPL.

## Yang sudah ada

| Modul | Keterangan |
|---|---|
| Autentikasi | Login Google via Firebase, sesi cookie HttpOnly |
| Pengguna & peran | 7 peran dengan cakupan prodi; profil NIDN/NIP dikelola admin |
| Master data | Institusi, fakultas, program studi, tahun akademik |
| Beban belajar | Konfigurasi kebijakan + kalkulator + 4 lapis validasi |
| Kurikulum | Impor Excel (CPL, MK, CPMK, Sub-CPMK) + validator rantai capaian |
| RPKPS | Kerangka 16 pertemuan otomatis, editor mingguan, neraca waktu langsung, alur pengesahan |
| Tugas/proyek | Bagian I: uraian, indikator berbobot, linimasa mingguan |
| Kisi-kisi ujian | Blueprint UTS/UAS: Sub-CPMK × level Bloom × bentuk × skor |
| Ekspor | Dokumen `.docx` sesuai template ITTS bagian A–J, tabel mingguan mendatar |
| Penguncian versi | Salinan beku bersidik SHA-256 saat terbit + deteksi pergeseran isi |
| Lapisan AI | Draf RPKPS utuh dan usulan perbaikan kurikulum — opsional, mati bila kunci tidak dipasang |
| Audit | Pencatatan aksi penting ke `log_audit`, termasuk penyedia, model, dan pemakaian token |

Identitas login ditangani Firebase; **profil kepegawaian dan peran tetap berada di
database institusi**, tidak di layanan pihak ketiga.

## Menjalankan

### 1. Dependensi

```bash
npm install
```

### 2. Database

Butuh Postgres. Cara tercepat tanpa instalasi lokal: buat proyek gratis di
[neon.tech](https://neon.tech), lalu salin connection string.

```bash
cp .env.example .env
# isi DATABASE_URL di .env
npm run db:push
npm run db:seed
```

### 3. Firebase

1. [Firebase Console](https://console.firebase.google.com) → buat proyek
2. **Authentication** → Sign-in method → aktifkan **Google**
3. **Project settings → General → Your apps** → tambah Web app → salin nilainya ke
   `NEXT_PUBLIC_FIREBASE_*`
4. **Project settings → Service accounts** → _Generate new private key_ → salin
   `project_id`, `client_email`, `private_key` ke `FIREBASE_*`

> `FIREBASE_PRIVATE_KEY` memuat baris baru. Tulis dalam satu baris dengan `\n`
> literal, dibungkus tanda kutip ganda.

5. Isi `ADMIN_BOOTSTRAP_EMAILS` dengan email Google Anda — akun itu otomatis
   menjadi administrator saat pertama kali masuk. Pengguna lain berstatus
   _menunggu verifikasi_ sampai admin memberinya peran.

### 4. AI (opsional)

Lewati bila belum diperlukan — tanpa kunci, seluruh tombol AI tidak dirender dan
sisa aplikasi berjalan utuh.

```bash
AI_PENYEDIA="anthropic"      # atau "mistral"
ANTHROPIC_API_KEY="sk-ant-…" # console.anthropic.com → API keys
AI_MODEL=""                  # kosongkan: tiap penyedia memakai bawaannya
```

Kuncinya milik institusi, satu untuk semua pengguna — lihat
[Lapisan AI](#lapisan-ai).

### 5. Jalankan

```bash
npm run dev
```

Buka <http://localhost:3000>. Bila konfigurasi belum lengkap, buka
<http://localhost:3000/setup> untuk melihat apa yang masih kurang.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm test` | Uji unit: beban belajar, kurikulum, RPKPS, tugas, kisi-kisi, sidik, skema AI (142 tes) |
| `npm run test:integrasi` | Uji integrasi terhadap Postgres tertanam (tanpa instalasi) |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm run lint` | ESLint |
| `npm run db:migrate:pg` | Terapkan migrasi lewat node-postgres (jalur IPv4) |
| `npm run periksa` | Diagnosa: database, migrasi, kredensial Firebase |
| `npm run db:seed` | Data awal (ITTS, prodi TI, kebijakan bawaan) |
| `npm run db:studio` | Prisma Studio |

## Arsitektur

```
src/
  domain/beban-belajar/   Logika murni — tanpa Prisma, tanpa React, teruji
  domain/kurikulum/       Taksonomi Bloom, kamus KKO, validator kurikulum
  domain/rpkps/           Validator RPKPS (aturan B1–B6 dari dokumen 02)
  lib/                    Prisma, Firebase, sesi, otorisasi, env
  lib/ai/                 Gerbang AI, adapter penyedia, prompt, skema keluaran
  app/(app)/              Halaman terproteksi (guard di layout)
  app/masuk, /setup       Halaman publik
prisma/                   Skema, migrasi, seed
uji/                      Uji integrasi (Postgres tertanam via PGlite)
docs/                     Dokumen konsep — baca sebelum menambah fitur
```

**Otorisasi** dijalankan di layout dan server action, bukan di `proxy.ts`.
Firebase Admin SDK tidak dapat berjalan di runtime Edge, sehingga proxy hanya
memeriksa keberadaan cookie untuk kenyamanan navigasi — bukan sebagai pengaman.

## Kebijakan beban belajar

Menegakkan satu invarian: **total beban ÷ sks = 45 jam per semester**
(Permendikbudristek 53/2023). Pola menit per minggu adalah konfigurasi per
institusi, bukan konstanta di kode.

Empat lapis pemeriksaan:

| Lapis | Yang diperiksa | Tingkat |
|---|---|---|
| 1 | Beban per pertemuan vs pagunya (±10%) | peringatan |
| 2 | Total semester vs 45 jam × sks (±5%) | **pemblokir** |
| 3 | Menit di narasi metode = kolom alokasi | **pemblokir** |
| 4 | Kebutuhan slot terjadwal vs kapasitas | peringatan |

Rinciannya di [`docs/03-kebijakan-beban-belajar.md`](docs/03-kebijakan-beban-belajar.md).

## Kurikulum

CPL, CPMK, dan Sub-CPMK diimpor dari buku kurikulum lewat template Excel empat
lembar, lalu bersifat **read-only** di penyusun RPKPS. Perubahan rumusan harus
melalui usulan revisi kurikulum ke Ketua Program Studi — tanpa batas ini,
pemetaan CPL program studi rusak dalam satu semester.

Validator menolak kurikulum yang rantai capaiannya putus:

| Aturan | Tingkat |
|---|---|
| CPL tidak dibebankan pada mata kuliah mana pun | pemblokir |
| CPL dibebankan tetapi tidak dijabarkan CPMK mana pun | pemblokir |
| CPMK tanpa Sub-CPMK, atau tanpa CPL | pemblokir |
| Level Bloom Sub-CPMK melampaui CPMK induknya | pemblokir |
| Rumusan memakai kata tak terukur ("memahami", "mengetahui") | peringatan |
| Satu Sub-CPMK memuat lebih dari satu kata kerja operasional | peringatan |

Aturan kedua adalah temuan nyata pada RPKPS TI214: CPL06 dibebankan di bagian
B.1 tetapi tidak pernah muncul di tabel penilaian, sehingga tidak akan pernah
dinilai. Validator menangkapnya satu lapis lebih awal.


## Penyusun RPKPS

Saat RPKPS dibuat, kerangkanya langsung tersusun: 16 pertemuan bernomor, minggu
ujian pada posisi yang benar, alokasi waktu terisi sesuai pagu, dan Sub-CPMK dari
kurikulum tersebar berurutan. Dosen mulai dari kerangka yang sudah konsisten,
bukan dari tabel kosong.

Validator menolak pengajuan yang mengulang kesalahan dokumen nyata:

| Kode | Aturan | Asal temuan |
|---|---|---|
| B1 | Total bobot mingguan harus 100% | TI214 berjumlah 120% |
| B2 | Bobot mingguan harus sama dengan total komponen nilai | Dua tabel tidak rekonsiliasi |
| B3 | Setiap Sub-CPMK harus dijadwalkan | — |
| B4 | Menit pada narasi metode harus sama dengan rincian aktivitas | TI214: 480′ vs 580′ dalam satu baris |
| B5 | Minggu ujian wajib punya alokasi waktu; total harus 45 jam/sks | Kekurangan 16 jam per mata kuliah |
| B6 | Struktur 16 minggu lengkap dan bernomor | Minggu 8 dan 16 tidak bernomor |
| I | Bobot indikator tiap tugas harus 100%; Sub-CPMK dan rentang minggu harus sah | — |


## Ekspor dokumen

Tombol **Unduh DOCX** pada halaman RPKPS menghasilkan berkas Word sesuai
template ITTS, bagian A sampai J:

| Bagian | Isi |
|---|---|
| Pengesahan | Identitas MK, tabel tim dosen + NIDN, tiga blok tanda tangan |
| A–B | Deskripsi, CPL, CPMK, Sub-CPMK (ditarik dari kurikulum) |
| C–D | Analisis pembelajaran, daftar topik |
| E | Aturan kehadiran, komponen nilai, tabel distribusi penilaian, skala nilai |
| F–G | Ambang kelulusan, referensi (utama/pendukung/daring/tools) |
| H | Tabel mingguan 7 kolom pada halaman **mendatar** |
| I | Detail tugas/proyek: uraian, tabel indikator berbobot, linimasa |
| Lampiran | Kisi-kisi UTS dan UAS |
| J | Histori revisi |

Tabel distribusi penilaian dicetak dengan tanda √ mengikuti pakem ITTS, tetapi
**di basis data tersimpan sebagai kaitan bernomor** antara Sub-CPMK dan komponen
nilai. Tanpa itu ketercapaian CPMK tidak dapat dihitung dan janji OBE berhenti
di dokumen (lihat temuan W7 pada `docs/02`).



## Kisi-kisi ujian

Tiap butir terikat ke satu **Sub-CPMK** dan satu **level Bloom**, sehingga skor
butir nanti dapat mengalir langsung ke perhitungan ketercapaian CPMK tanpa
pemetaan ulang.

Validator memeriksa enam hal:

| Kode | Aturan | Tingkat |
|---|---|---|
| `KK-TOTAL-SKOR` | Skor seluruh butir harus sama dengan total yang ditetapkan | pemblokir |
| `KK-SUB-CPMK-TIDAK-DIUJI` | Sub-CPMK yang diajarkan sebelum ujian harus diuji | pemblokir |
| `KK-SUB-CPMK-ASING` | Butir tidak boleh merujuk Sub-CPMK di luar mata kuliah | pemblokir |
| `KK-LEVEL-MELAMPAUI` | Menguji di atas level Sub-CPMK yang diajarkan | peringatan |
| `KK-BLOOM-TIMPANG` | Lebih dari 80% skor berada di C1–C2 | peringatan |
| `KK-PROPORSI` | Porsi skor ujian melenceng jauh dari porsi pembelajaran | peringatan |

Aturan `KK-PROPORSI` membandingkan bobot mingguan tiap Sub-CPMK dengan porsinya
di ujian: materi yang diajarkan dua minggu sebaiknya tidak hanya mendapat satu
butir soal, dan sebaliknya.

## Lapisan AI

Opsional dan mati secara bawaan. Dua tugas, keduanya **mengusulkan, bukan
memutuskan**:

| Tugas | Muncul di | Yang diusulkan |
|---|---|---|
| Perbaikan kurikulum | Halaman impor, setelah validator menemukan pelanggaran | Rumusan ulang Sub-CPMK/CPMK, Sub-CPMK baru, pemetaan CPL |
| Draf RPKPS | RPKPS berstatus draf atau perlu revisi | Deskripsi, komponen nilai, isi seluruh pertemuan efektif, pustaka tambahan, lembar tugas, kisi-kisi UTS/UAS |

Batasnya sama untuk keduanya: **keluaran model tidak pernah langsung ditulis.**
`periksaDraf()` di `src/domain/rpkps/draf.ts` menghitung ulang setiap angka yang
disebut model — total bobot 100%, bobot kriteria tiap tugas, skor tiap
kisi-kisi, keabsahan tiap kode Sub-CPMK dan rujukan pustaka — lalu draf yang
melanggar dikembalikan beserta temuannya dan tidak dapat diterapkan.

Pemeriksaan itu bukan pelengkap. Persetujuan dosen berupa satu tombol untuk
seluruh dokumen, jadi tidak ada lagi manusia yang membaca baris per baris;
konsekuensinya semua invarian yang dapat dihitung harus ditegakkan di kode,
bukan diserahkan pada kepatuhan model terhadap prompt.

Yang tetap tidak boleh disentuh AI: alokasi menit TM/PT/BM — sudah pas dengan
pagu beban belajar sejak kerangka dibuat, mengubahnya berarti melanggar
invarian 45 jam/sks — serta nomor minggu, jenis pertemuan, dan daftar Sub-CPMK
yang berasal dari kurikulum.

### Kunci dan penyedia

Tahap ini memakai **satu kunci institusi per penyedia** lewat variabel
lingkungan, bukan kunci per dosen. `docs/01` merancang cakupan
`user | prodi | institusi`; bila kelak BYOK per dosen dibangun, lapisannya masuk
di `src/lib/ai/klien.ts` saja dan tanda tangan pemanggil tidak berubah.

`src/lib/ai/penyedia/` memuat adapter Anthropic dan Mistral di balik satu
antarmuka sempit: satu blok panduan yang stabil, satu blok permintaan yang
berubah, satu skema keluaran. Fitur khas satu penyedia — prompt caching
Anthropic, `reasoning_effort` Mistral — diurus di dalam adapternya dan tidak
bocor ke pemanggil, sehingga mengganti penyedia tidak menyentuh satu pun aturan
akademik di `src/domain`.

Seluruh panggilan melewati satu gerbang, `src/lib/ai/gerbang.ts`, yang mencatat
penyedia, model, status berhenti, latensi, dan pemakaian token ke `log_audit` —
termasuk token yang terbaca dari cache.

### Batas skema keluaran

Structured output mengekang jawaban model lewat grammar hasil kompilasi skema,
dan grammar itu punya batas ukuran. Yang membebaninya adalah **percabangan,
bukan panjang skema**: satu `.nullable()` menjadi `anyOf` dan berharga sekitar
dua setengah field biasa — skema yang lebih pendek tetapi lebih bercabang justru
ditolak lebih dulu.

Skema draf RPKPS berada dekat batas itu, jadi ia tidak memuat null sama sekali:
"tidak ada" diwakili string kosong (atau 0 untuk durasi), lalu dikembalikan
menjadi null di `susunDraf()`. Ambangnya dijaga uji di
`src/lib/ai/skema-draf.test.ts`; angka pengukuran dan alasannya ada di kepala
`src/lib/ai/skema-draf.ts`. Bila skema itu kelak perlu tumbuh lagi, jalannya
bukan menambal melainkan memecah penyusunan draf menjadi beberapa panggilan.

## Penguncian versi

Saat RPKPS disetujui, seluruh isinya dibekukan menjadi salinan resmi beserta
**sidik SHA-256** yang dicetak di dokumen. Sejak titik itu:

- Unduhan selalu dirender dari salinan beku, bukan dari data langsung.
- Menyunting kurikulum — memperbaiki rumusan CPMK, menambah Sub-CPMK — **tidak
  mengubah** berkas yang sudah ditandatangani.
- Halaman RPKPS membandingkan sidik salinan resmi dengan isi sekarang, dan
  memberi tahu bila keduanya berbeda.

Tanpa ini, berkas yang dicetak hari ini bisa berbeda dari yang disahkan Ketua
Program Studi tanpa jejak apa pun — hal yang tidak dapat dipertanggungjawabkan
saat akreditasi.

Sidik dihitung atas **proyeksi isi**: hanya yang tercetak, tanpa id maupun cap
waktu. Kalau `diubahPada` ikut di-hash, sidik berubah setiap baris disentuh
meski isinya sama, dan deteksi pergeseran jadi tidak berarti. Serialisasinya
mengurutkan kunci objek lebih dulu, karena urutan kunci JSON tidak dijamin
stabil antar runtime.

## Pengujian

Dua lapis, keduanya tanpa perlu memasang database:

```bash
npm test              # 142 uji unit terhadap logika murni
npm run test:integrasi   # alur penuh terhadap Postgres sungguhan
```

Uji integrasi menyalakan PGlite — Postgres yang dikompilasi ke WebAssembly —
di memori, menerapkan skema, lalu menjalankan alur master data → kurikulum →
kerangka RPKPS → validator → ekspor DOCX → penguncian versi. Berkas hasilnya
dibongkar untuk memastikan seluruh bagian A–J ada, dan kurikulum sengaja
disunting untuk membuktikan dokumen resmi tidak ikut berubah. 49 pemeriksaan.
Lihat [`uji/README.md`](uji/README.md).

## Deploy

Klien Prisma dihasilkan ke `src/generated/prisma`, dan folder itu **tidak
masuk repositori** (`.gitignore`). Karena Vercel membangun dari checkout git
yang bersih, klien itu tidak ada di sana — build gagal dengan
`Module not found: Can't resolve '@/generated/prisma'` sebelum sempat merender
apa pun. Karena itu `prisma generate` dirangkai ke dua tempat:

| Skrip | Kapan menolong |
|---|---|
| `build` | Setiap deploy — jaminan utama, selalu berjalan |
| `postinstall` | `git clone && npm install` di mesin baru, sebelum `npm run dev` |

`prisma generate` tidak menyentuh database dan tidak memerlukan `DATABASE_URL`,
jadi aman berjalan sebelum variabel lingkungan lengkap.

### Versi Node

`package.json` menyatakan `engines.node: ">=22.12.0"`. Bukan sekadar
kerapian — `firebase-admin` menuntut Node >= 22, dan `jwks-rsa` di dalamnya
menuntut `^20.19 || ^22.12 || >=23`, yaitu daftar versi Node yang mendukung
`require()` terhadap modul ESM. `jose@6` yang dipakainya sudah ESM-only,
sedangkan `jwks-rsa` masih CommonJS.

Pada Node yang lebih tua, build tetap lolos tetapi **halaman gagal saat
dibuka**:

```
Failed to load external module firebase-admin-…/auth:
ERR_REQUIRE_ESM: require() of ES Module …/jose/dist/webapi/index.js
from …/jwks-rsa/src/utils.js not supported
```

Kegagalannya di runtime, bukan build, karena `firebase-admin` sengaja tidak
dibundel — Next memuatnya dari `node_modules` saat permintaan pertama tiba.
Bila galat ini muncul lagi, periksa **Vercel → Settings → Node.js Version**;
setelan proyek dapat mengalahkan `engines`.

Yang harus diisi di **Vercel → Settings → Environment Variables**:

| Variabel | Wajib | Catatan |
|---|---|---|
| `DATABASE_URL` | ya | Koneksi ber-pooler |
| `DIRECT_URL` | ya | Koneksi langsung, dipakai migrasi |
| `NEXT_PUBLIC_FIREBASE_*` | ya | Empat nilai; ikut terkirim ke peramban |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | ya | Service account |
| `ADMIN_BOOTSTRAP_EMAILS` | ya | Tanpa ini tidak ada yang bisa menjadi admin |
| `AI_PENYEDIA`, `ANTHROPIC_API_KEY` / `MISTRAL_API_KEY` | tidak | Tombol AI tersembunyi bila kosong |

`FIREBASE_PRIVATE_KEY` memuat baris baru. Tempelkan sebagai satu baris dengan
`\n` literal — bukan baris baru sungguhan, yang akan terpotong di kotak isian
Vercel.

## Catatan

- `npm audit` melaporkan kerentanan transitif di bawah `prisma` dan
  `firebase-admin` (perkakas build dan server). Belum ada perbaikan non-breaking;
  memaksa `audit fix --force` akan menurunkan versi Prisma.
