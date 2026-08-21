# Kebijakan Beban Belajar — Spesifikasi Mesin Hitung

Menutup pertanyaan terbuka #13 di [02-template-itts-dan-penyelarasan-industri.md](./02-template-itts-dan-penyelarasan-industri.md). Dokumen ini menggantikan §3.1 dan §3.2 di [00-konsep-rpkps.md](./00-konsep-rpkps.md) dengan spesifikasi yang cukup rinci untuk dikodekan.

---

## BAGIAN 1 — Rekonsiliasi Angka

### 1.1 Rentang "100–170 menit" bukan rentang kebijakan

Sumber-sumber menyebut praktikum "1 sks = 100 hingga 170 menit per minggu". Ini mudah disalahartikan sebagai kebebasan memilih angka mana pun di antaranya. Bukan. Setelah dicocokkan dengan SN-Dikti (Permendikbud 3/2020 Pasal 19), keduanya adalah **dua hal yang berbeda, bukan dua ujung satu rentang**:

| Angka | Artinya | Untuk |
|---|---|---|
| **100 menit** | Tatap muka **terjadwal** saja (di lab/studio/lapangan) | Angka penjadwalan — berapa slot ruang yang dibutuhkan |
| **170 menit** | **Total beban** per sks per minggu | Angka kepatuhan — yang dihitung terhadap 45 jam/semester |
| Selisih 70 menit | Kegiatan terstruktur & mandiri di luar slot terjadwal | Laporan praktikum, persiapan, pengolahan data |

Bukti kecocokan: 100 + 70 = 170 — persis pola SN-Dikti untuk seminar (100 TM + 70 BM). Dan angka 3 sks yang disebut sumber, "300 hingga 510 menit", tepat 3×100 dan 3×170.

**Konsekuensi:** aplikasi harus menyimpan keduanya secara terpisah. `menit_tm` untuk penjadwalan ruang, `menit_pt` + `menit_bm` untuk kepatuhan. Menyimpan satu angka gabungan membuat salah satu pertanyaan tidak terjawab.

### 1.2 Satu invarian yang mengikat semuanya

```
        total beban semester
────────────────────────────────────  =  45 jam   (toleransi ±5%)
              jumlah sks
```

Angka 45 jam/sks/semester adalah patokan Permendikbudristek 53/2023, dan pembagian riilnya diserahkan ke kampus. Maka aplikasi **tidak boleh memaksakan pola 50/60/60**. Yang ditegakkan adalah invarian di atas; pola per minggu jadi konfigurasi.

Verifikasi terhadap pola SN-Dikti klasik:

| Bentuk | Per sks per minggu | × 16 minggu | Per sks | Status |
|---|---|---|---|---|
| Kuliah | 50 + 60 + 60 = 170' | 2.720' | 45,3 jam | ✓ |
| Seminar | 100 + 70 = 170' | 2.720' | 45,3 jam | ✓ |
| Praktikum | 170' | 2.720' | 45,3 jam | ✓ |

Ketiganya menghasilkan angka yang sama. Itu memang disengaja — 170 menit × 16 minggu ≈ 45 jam adalah konstruksi dasar seluruh sistem sks. Bentuk pembelajaran hanya mengubah **komposisi**, tidak pernah **totalnya**.

---

## BAGIAN 2 — Dua Temuan Baru

### 2.1 Minggu ujian harus punya beban, atau invarian jebol

TI214 mewajibkan "14 kali pertemuan perkuliahan", dengan UTS di minggu 8 dan UAS di minggu 16. Kalau hanya 14 pertemuan efektif yang dihitung:

```
14 minggu × 510' = 7.140'  =  119 jam  ÷ 3 sks  =  39,7 jam/sks   ✗ kurang 12%
16 minggu × 510' = 8.160'  =  136 jam  ÷ 3 sks  =  45,3 jam/sks   ✓
```

Selisihnya bukan pembulatan — **kurang 16 jam untuk satu mata kuliah.** Kalau seluruh prodi menghitung dengan cara ini, seluruh kurikulum secara struktural di bawah standar.

Jalan keluarnya bukan menambah pertemuan, melainkan mengakui bahwa **minggu ujian adalah minggu belajar**. Mahasiswa yang menyiapkan UTS jelas sedang belajar mandiri; itu beban nyata yang selama ini tidak pernah dicatat.

Perhitungan yang wajar untuk 3 sks:

| | TM | PT | BM | Total |
|---|---|---|---|---|
| 14 minggu efektif | 150' | 180' | 180' | 510' × 14 = 7.140' |
| Minggu UTS | 120' (pelaksanaan ujian) | — | 360' (persiapan) | 480' |
| Minggu UAS | 120' | — | 360' | 480' |
| **Total semester** | | | | **8.100' = 135 jam = 45,0 jam/sks** ✓ |

Pas. Dan realistis — 6 jam belajar mandiri untuk menyiapkan satu ujian bukan angka mengada-ada.

**Aturan validator baru:** baris UTS dan UAS di tabel mingguan wajib mengisi kolom Alokasi Waktu. Pada contoh TI214, kedua baris itu hanya berisi bobot (15% dan 20%) dan dibiarkan kosong — itulah sumber kekurangan 16 jam.

### 2.2 Pemecahan sks Teori/Praktik mengubah penjadwalan, bukan total

TI214 tercatat "TI214 / 3" tanpa pemecahan T/P, padahal isinya jelas campuran: minggu 1–7 dominan teori, minggu 9–15 hampir seluruhnya praktikum lab (Live Coding, Praktikum Lab, Problem Solving Lab, Roleplay Lab).

Bandingkan dua deklarasi untuk MK 3 sks yang sama:

| | Terjadwal (butuh ruang/lab) | Mandiri & terstruktur | Total |
|---|---|---|---|
| **3 sks teori murni** | TM 150' | 360' | **510'** |
| **2 sks teori + 1 sks praktik** | TM teori 100' + praktikum 170' = **270'** | 240' | **510'** |

Totalnya identik — invarian 45 jam tetap terpenuhi. Yang berubah drastis adalah **beban terjadwal: dari 150' menjadi 270', naik 80%.** Itu berarti hampir dua kali lipat kebutuhan slot ruang, jam mengajar dosen, dan kapasitas laboratorium.

Karena itu `sks_teori` dan `sks_praktik` harus jadi field terpisah sejak awal, bukan satu angka `sks`. Tanpa pemecahan itu, prodi tidak bisa menghitung kebutuhan lab, dan RPKPS mata kuliah praktik akan selalu tampak "muat" padahal jadwalnya tidak mungkin.

### 2.3 Praktikum dengan pertemuan lebih sedikit

Sumber menyebut praktikum umumnya berjalan 12–14 pertemuan, bukan 16. Kalau begitu, durasi per pertemuan harus naik agar invarian tetap terpenuhi:

| Jumlah pertemuan | Menit/sks/pertemuan yang dibutuhkan | 3 sks per pertemuan |
|---|---|---|
| 16 | 2.700 ÷ 16 = 169' | 507' ≈ 8,5 jam |
| 14 | 2.700 ÷ 14 = 193' | 579' ≈ 9,6 jam |
| 12 | 2.700 ÷ 12 = 225' | 675' ≈ 11,3 jam |

Angka-angka itu tidak masuk akal sebagai sesi lab tunggal — yang berarti sisanya memang harus jatuh ke pekerjaan terstruktur di luar sesi (laporan, pengolahan data, persiapan). Mesin hitung harus menampilkan konsekuensi ini secara eksplisit, supaya dosen memutuskan sadar: **"praktikum 12 pertemuan berarti 4,5 jam sesi lab + 6,8 jam kerja di luar sesi per minggu."**

---

## BAGIAN 3 — Skema Konfigurasi

```sql
kebijakan_beban_belajar
  id, institusi_id, nama, berlaku_dari, berlaku_sampai, status
  minggu_per_semester           int  default 16
  pertemuan_efektif_teori       int  default 14
  pertemuan_efektif_praktik     int  default 14
  hitung_minggu_ujian           bool default true   -- §2.1
  jam_per_sks_per_semester      dec  default 45
  toleransi_semester_persen     dec  default 5
  toleransi_pertemuan_persen    dec  default 10

kebijakan_bentuk                -- satu baris per bentuk pembelajaran
  kebijakan_id, bentuk, menit_tm_per_sks, menit_pt_per_sks,
  menit_bm_per_sks, tm_terjadwal(bool), butuh_ruang_khusus(bool)
```

Baris bawaan (dapat disunting Penjaminan Mutu):

| bentuk | TM | PT | BM | Σ | terjadwal | ruang khusus |
|---|---|---|---|---|---|---|
| `kuliah` / `responsi` / `tutorial` | 50 | 60 | 60 | 170 | ✓ | — |
| `seminar` | 100 | 0 | 70 | 170 | ✓ | — |
| `praktikum` | 100 | 40 | 30 | 170 | ✓ | ✓ |
| `praktik_studio` / `bengkel` | 100 | 40 | 30 | 170 | ✓ | ✓ |
| `praktik_lapangan` / `pkl` | 170 | 0 | 0 | 170 | ✓ | — |
| `penelitian` / `pkm` / `kkn` | 0 | 170 | 0 | 170 | — | — |

Baris `praktikum` sengaja memecah 100/40/30 alih-alih 170/0/0 — hasil rekonsiliasi §1.1. Kampus yang ingin memakai 170 terjadwal penuh tinggal menyuntingnya; totalnya tetap 170 sehingga invarian aman.

```sql
mata_kuliah
  ..., sks_total, sks_teori, sks_praktik,
  bentuk_teori   default 'kuliah',
  bentuk_praktik default 'praktikum'
  CHECK (sks_teori + sks_praktik = sks_total)
```

---

## BAGIAN 4 — Mesin Hitung

### 4.1 Pagu per pertemuan

```
pagu(pertemuan) =
    sks_teori   × (tm + pt + bm) dari kebijakan_bentuk[bentuk_teori]
  + sks_praktik × (tm + pt + bm) dari kebijakan_bentuk[bentuk_praktik]
```

Untuk minggu ujian (bila `hitung_minggu_ujian = true`), pagu dihitung dari sisa:

```
sisa = (jam_per_sks × 60 × sks_total) − Σ pagu(pertemuan efektif)
pagu(minggu ujian) = sisa ÷ jumlah minggu ujian
```

Cara ini otomatis menyerap selisih pembulatan dan selalu mendaratkan total tepat di 45 jam/sks — jauh lebih baik daripada memberi minggu ujian angka tetap yang harus dicocokkan manual.

### 4.2 Empat lapis validasi

| Lapis | Yang diperiksa | Ambang | Tingkat |
|---|---|---|---|
| **1 · Per pertemuan** | Σ menit aktivitas vs pagu pertemuan itu | ±10% | Peringatan |
| **2 · Per semester** | Σ seluruh pertemuan vs 45 jam × sks | ±5% | **Pemblokir** |
| **3 · Konsistensi narasi** | Menit yang disebut di teks Metode = kolom Alokasi Waktu | harus sama | **Pemblokir** |
| **4 · Kapasitas terjadwal** | Σ TM terjadwal per minggu vs slot ruang/lab tersedia | — | Peringatan (butuh modul jadwal) |

Lapis 2 adalah yang menentukan kepatuhan dan justru yang tidak pernah diperiksa siapa pun. Lapis 3 lahir langsung dari temuan B4 pada TI214 — kontradiksi 480' vs 580' di dalam satu baris.

### 4.3 Tampilan neraca

```
┌─ Neraca Waktu · TI214 Basis Data · 2 sks Teori + 1 sks Praktik ───┐
│                                                                    │
│  Pagu per minggu efektif                                    510'   │
│    Teori 2 sks   TM 100' · PT 120' · BM 120'                340'   │
│    Praktik 1 sks TM 100' · PT  40' · BM  30'                170'   │
│    └ terjadwal 200'/minggu → butuh 1 slot kelas + 1 slot lab       │
│                                                                    │
│  Minggu   1  2  3  4  5  6  7  ·  9 10 11 12 13 14 15             │
│  Terpakai ▓▓ ▓▓ ▓█ ▓▓ ▓▓ ▓░ ▓▓ ·  ▓▓ ▓▓ ▓█ ▓▓ ▓▓ ▓▓ ▓▓             │
│           ✓  ✓  !  ✓  ✓  ⚠  ✓  ·  ✓  ✓  !  ✓  ✓  ✓  ✓             │
│           M3 lebih 8%   M6 kurang 14%   M11 lebih 11%             │
│                                                                    │
│  Minggu ujian    UTS 480'   UAS 480'      (dihitung otomatis)      │
│                                                                    │
│  ─────────────────────────────────────────────────────────────    │
│  TOTAL SEMESTER   8.100 menit = 135,0 jam = 45,0 jam/sks   ✓      │
│                                            target 45 ±5%           │
└────────────────────────────────────────────────────────────────────┘
```

Yang penting bukan detail visualnya, melainkan bahwa **angka total semester selalu terlihat** — bukan tersembunyi di balik pemeriksaan yang harus dijalankan manual.

### 4.4 Beban mahasiswa per semester

Efek samping mesin ini: begitu 45 jam/sks ditegakkan, beban paket semester bisa dihitung dan hasilnya mengejutkan.

| sks diambil | Jam/semester | Jam/minggu (16 mgg) | Setara |
|---|---|---|---|
| 18 | 810 | 50,6 | > pekerjaan penuh waktu |
| 20 | 900 | 56,3 | |
| 22 | 990 | 61,9 | |
| 24 | 1.080 | 67,5 | ~1,7× pekerjaan penuh waktu |

Angka ini layak ditampilkan di dasbor prodi saat menyusun paket semester. Bukan untuk menakut-nakuti, tapi karena beban 24 sks yang di atas kertas "boleh" ternyata menuntut hampir 68 jam per minggu — dan itu penjelasan struktural mengapa tugas menumpuk di akhir semester.

---

## BAGIAN 5 — Uji Ulang TI214

Dengan mesin di atas, dokumen contoh diuji terhadap tiga kandidat deklarasi:

| Deklarasi | Pagu/minggu efektif | Tertulis di dokumen | Total semester | Per sks | Vonis |
|---|---|---|---|---|---|
| 3 sks teori murni | 510' | 580' (M2–M15) | 9.280' + ujian | 51,6+ jam | ✗ kelebihan >14% |
| 3 sks teori murni | 510' | 480' (narasi metode) | 7.680' + ujian | 42,7 jam | ⚠ kurang, bisa ditolong minggu ujian |
| 2T + 1P | 510' | — | — | — | perlu deklarasi ulang |

Hasilnya sama apa pun kandidatnya: **angka yang tertulis di dokumen tidak konsisten dengan dirinya sendiri**, dan itulah yang harus diperbaiki lebih dulu sebelum bicara kepatuhan. Kontradiksi 480' vs 580' di baris yang sama tidak dapat dibela oleh kebijakan mana pun.

Rekomendasi perbaikan konkret untuk TI214:

```
Deklarasi   : 2 sks Teori (kuliah) + 1 sks Praktik (praktikum)
Pagu/minggu : 510'  →  TM 200' (100 kelas + 100 lab) · PT 160' · BM 150'
M1–M7, M9–M15 (14 pertemuan)            : 510' × 14 = 7.140'
Minggu UTS  : TM 120' + BM 360'          =    480'
Minggu UAS  : TM 120' + BM 360'          =    480'
───────────────────────────────────────────────────
TOTAL                                    =  8.100' = 135 jam = 45,0 jam/sks ✓
```

Perhatikan bahwa TM di kolom Alokasi Waktu jadi 200', bukan 120' seperti yang tertulis sekarang. Ini konsekuensi jujur dari mengakui bahwa separuh semester TI214 dijalankan sebagai praktikum lab — dan berarti prodi perlu mengalokasikan slot lab yang selama ini tidak tercatat di RPKPS.

---

## BAGIAN 6 — Yang Perlu Dipastikan ke Penjaminan Mutu ITTS

Enam pertanyaan, jawabannya langsung mengisi tabel konfigurasi di §3. Sebaiknya diajukan sekali sebagai formulir, bukan dicicil:

| # | Pertanyaan | Mengisi field | Bawaan bila tidak dijawab |
|---|---|---|---|
| 1 | Berapa menit tatap muka untuk 1 sks kuliah teori? | `kuliah.menit_tm_per_sks` | 50 |
| 2 | Berapa menit tatap muka terjadwal untuk 1 sks praktikum? | `praktikum.menit_tm_per_sks` | 100 |
| 3 | Berapa minggu satu semester, dan berapa pertemuan efektif? | `minggu_per_semester`, `pertemuan_efektif_*` | 16 dan 14 |
| 4 | Apakah minggu UTS dan UAS dihitung sebagai beban belajar? | `hitung_minggu_ujian` | ya (§2.1) |
| 5 | Apakah MK dideklarasikan dengan pemecahan sks T/P? | `sks_teori`, `sks_praktik` | ya, wajib |
| 6 | Toleransi penyimpangan yang dapat diterima per semester? | `toleransi_semester_persen` | 5% |

Pertanyaan 4 dan 5 kemungkinan besar belum pernah ditetapkan secara eksplisit — keduanya baru terlihat sebagai keputusan begitu perhitungannya dijalankan sampai tuntas. Justru itu yang membuatnya perlu dijawab sekarang, sebelum ada satu pun RPKPS tersimpan dengan asumsi yang salah.

---

## BAGIAN 7 — Dampak ke Dokumen Lain

| Dokumen | Bagian yang digantikan |
|---|---|
| `00-konsep-rpkps.md` | §3.1 (tabel Mode A/B) dan §3.2 (rumus neraca) — digantikan oleh dokumen ini |
| `02-template-itts…md` | §2.3 (uji neraca TI214) — diperluas oleh §5 di sini. Aturan validator B4 dan B5 diperjelas, ditambah aturan baru: minggu ujian wajib beralokasi waktu |
| `01-konsep-ai-byok.md` | Tugas AI **T6** (susun aktivitas + durasi) sekarang punya kendala yang jauh lebih tajam: pagu dihitung dari `kebijakan_bentuk` per MK, bukan konstanta. Prompt harus menerima pagu sebagai parameter, dan server tetap menjumlahkan ulang |

Roadmap: **kebijakan beban belajar naik ke F0 (Fondasi)**, sebelum modul kurikulum. Alasannya sederhana — setiap RPKPS yang tersimpan sebelum kebijakan ditetapkan akan memakai asumsi yang mungkin salah, dan memperbaikinya belakangan berarti menghitung ulang seluruh dokumen yang sudah terbit.
