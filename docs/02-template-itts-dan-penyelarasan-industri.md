# Template ITTS & Fitur Penyelarasan Industri

Revisi konsep berdasarkan contoh nyata: **RPKPS ITTS (2025) — Basis Data (TI214)**. Dokumen ini menggantikan sebagian asumsi di [00-konsep-rpkps.md](./00-konsep-rpkps.md) yang tadinya memakai format generik Diktiristek.

Dua perubahan besar dari konsep sebelumnya:

1. **Titik mulai bergeser.** Nama MK, kode, CPL, CPMK, dan Sub-CPMK **sudah ada** dari buku kurikulum prodi. Aplikasi tidak merumuskannya — aplikasi **mengembangkannya** menjadi RPKPS lengkap. Wizard 11 langkah di dokumen pertama harus dirombak.
2. **Fitur baru: Penyelarasan Industri.** Menjaga RPKPS tetap relevan dengan praktik industri terkini, dan menyalurkan konteks itu sampai ke mahasiswa.

---

## BAGIAN 1 — Anatomi Template ITTS

### 1.1 Struktur dokumen (dari contoh TI214)

```
HALAMAN PENGESAHAN
  Nama MK, Kode MK, Koordinator MK
  Tim Dosen Pengampu (tabel: No, Nama, NIDN/NIP/NIK, Tanda Tangan) — 5 baris
  Tiga blok tanda tangan + tanggal:
    · Koordinator Mata Kuliah    (a.n Tim penyusun RPKPS)
    · Ketua Program Studi        (Disetujui oleh)
    · Kepala Penjaminan Mutu Internal (Telah diperiksa dan sesuai standar ITTS)
  Footer: Prodi — Tahun Akademik

HEADER MK
  NAMA MATA KULIAH · KODE MK / SKS · SEMESTER · MK PRASYARAT · STATUS MATAKULIAH

A. DESKRIPSI MATA KULIAH
B. CAPAIAN PEMBELAJARAN
   B.1  CPL Prodi terkait MK    (+ Tingkat KKNI)
   B.2  CPMK                    (dengan kalimat pembuka prodi)
   B.3  Sub-CPMK                (dikelompokkan per CPMK)
C. ANALISIS PEMBELAJARAN        (gambar/bagan terlampir)
D. TOPIK PEMBELAJARAN           (daftar bernomor, 14 topik)
E. EVALUASI PEMBELAJARAN
   · Aturan kehadiran (min. 11 dari 14 pertemuan)
   · Komponen nilai + bobot
   · Tabel Distribusi Penilaian: CPL × CPMK × Sub-CPMK × komponen (tanda √)
   · Penilaian Akhir: rentang skor → huruf → angka → keterangan
F. AMBANG BATAS KELULUSAN       (mahasiswa & MK)
G. REFERENSI DAN SUMBER PEMBELAJARAN
   · Sumber Utama · Sumber Pendukung · Sumber Daring · Perangkat Lunak & Tools
H. RENCANA PEMBELAJARAN MINGGUAN (tabel inti — §1.2)
I. DETAIL TUGAS / PROYEK
   Identitas tugas · Aktivitas Individu · Tugas Terstruktur · Format & Luaran
   · Indikator/Kriteria/Bobot · Linimasa Proyek · Ketentuan lain · Referensi
LAMPIRAN                        (bagan analisis capaian, kisi UTS/UAS)
J. HISTORI REVISI               (Kode MK, No. Revisi, Tanggal Berlaku, Deskripsi Perubahan)
```

### 1.2 Tabel mingguan ITTS — 7 kolom, bukan 9

Berbeda dari format generik Diktiristek. Kolom "Penilaian" bercabang tiga:

| Kolom | Isi pada contoh TI214 |
|---|---|
| Minggu ke | 1–15 (8 dan 16 tidak diberi nomor — lihat §2) |
| Sub-CPMK | Kode + rumusan lengkap, mis. `CPMK081-3 Mahasiswa mampu merancang model konseptual…` |
| Topik & Subtopik | `Topik:` satu baris, `Subtopik:` daftar bernomor |
| Metode dan Aktivitas Pembelajaran | Blok terstruktur: **Metode** (Tatap muka sinkron + menit; Tidak tatap muka asinkron + menit) → **Aktivitas** (Dosen: … / Mahasiswa: …) → **Tugas/PT** |
| Alokasi Waktu | `TM: 2x60'` / `PT: 3x60'` / `BM: 4x70'` |
| Penilaian → Jenis & Sistem Penilaian | `Penilaian:` bentuk tagihan; `Sistem Penilaian:` kriteria |
| Penilaian → Indikator | 2–3 indikator terukur per Sub-CPMK |
| Penilaian → Bobot | Persen |
| Referensi | Butir bertanda • merujuk pustaka bagian G |

**Konsekuensi desain yang menegaskan konsep awal:** template dokumen **wajib jadi data, bukan kode.** ITTS punya 7 kolom dengan sub-kolom; kampus lain punya 9 kolom datar. Dua-duanya harus dilayani mesin ekspor yang sama.

### 1.3 Pemetaan template → model data

| Bagian ITTS | Entitas | Catatan |
|---|---|---|
| Halaman Pengesahan | `rpkps`, `rpkps_pengampu`, `alur_persetujuan` | Tiga peran penandatangan: Koordinator MK, Ka.Prodi, Kepala PMI. Simpan NIDN/NIP/NIK |
| Header MK | `mata_kuliah`, `mk_kurikulum` | `status_mk` (Wajib/Pilihan) dan `tingkat_kkni` adalah field baru |
| A | `rpkps.deskripsi` | |
| B.1 | `matriks_cpl_mk` | **Read-only dari kurikulum** |
| B.2 | `cpmk` | **Read-only.** `rpkps.kalimat_pembuka_cpmk` untuk template prodi |
| B.3 | `sub_cpmk` | **Read-only.** Pola kode ITTS `CPMK081-1` → `pola_kode_sub_cpmk` per institusi |
| C | `lampiran` (jenis: bagan analisis) | Bisa dihasilkan otomatis dari peta prasyarat Sub-CPMK |
| D | `topik` | Turunan dari `pertemuan.topik` — jangan disimpan ganda |
| E | `komponen_nilai`, `matriks_penilaian`, `skala_nilai` | `skala_nilai` per institusi (A/A-/B+/…/E/F) |
| F | `rpkps.ambang_kelulusan_mhs`, `ambang_ketercapaian_mk` | ITTS: 55 dan 85% |
| G | `pustaka` dengan `jenis ∈ {utama, pendukung, daring, tools}` | Kategori "tools" tidak ada di format generik — penting untuk MK praktik |
| H | `pertemuan`, `aktivitas_belajar`, `indikator`, `pertemuan_pustaka` | |
| I | `tugas`, `kriteria_tugas`, `linimasa_tugas` | Satu tugas bisa lintas banyak minggu (9–16 pada contoh) |
| J | `rpkps_versi` | ITTS mencatat revisi di dalam dokumen — otomatis dari riwayat versi |

---

## BAGIAN 2 — Temuan dari Dokumen Contoh

Contoh TI214 memang "setengah jadi", dan justru itu berharga: **temuan di bawah adalah spesifikasi validator yang paling konkret yang bisa didapat.** Setiap baris adalah aturan yang harus dijalankan aplikasi.

### 2.1 Temuan pemblokir (harus dicegah sebelum pengesahan)

| # | Temuan | Bukti | Aturan validator |
|---|---|---|---|
| B1 | **Total bobot mingguan 120%, bukan 100%** | 5+5+10+10+5+5+5 = 45; UTS 15 → 60; 5+5+10+5+5+5+5 = 40 → 100; UAS 20 → **120** | `Σ bobot kolom mingguan = 100` |
| B2 | **Bobot mingguan tidak rekonsiliasi dengan komponen nilai** | Komponen di bagian E berjumlah tepat 100% (UTS 15 + UAS 20 + Kehadiran/Kuis 10 + Praktik/Tugas 30 + Presentasi 15 + Tugas Kelompok 10). Kolom mingguan berjumlah 120% | Dua total harus sama dan setiap baris mingguan harus terpetakan ke satu komponen |
| B3 | **CPL06 dibebankan tapi tidak pernah dinilai** | B.1 menyebut CPL06 dan CPL08; tabel distribusi penilaian hanya memuat CPL08 | `setiap CPL terbeban → ≥1 CPMK → ≥1 asesmen` |
| B4 | **Alokasi waktu bertentangan di dalam baris yang sama** | Kolom Metode: "sinkron 120 menit" + "asinkron 360 menit" = **480'**. Kolom Alokasi Waktu: TM 120' + PT 180' + BM 280' = **580'** | Menit di narasi metode harus sama dengan kolom alokasi |
| B5 | **Beban semester melampaui pagu 3 sks** | 580'/minggu × 16 = 9.280' = 154,7 jam = **51,6 jam/sks** (batas 45 jam/sks → 135 jam untuk 3 sks) | Neraca Waktu — §2.3 |
| B6 | **Minggu 8 dan 16 tidak bernomor** | Penomoran melompat 7 → 9; UTS & UAS disisipkan tanpa label minggu | Struktur 16 minggu wajib lengkap dan bernomor |

### 2.2 Temuan peringatan (boleh terbit, tapi ditandai)

| # | Temuan | Bukti |
|---|---|---|
| W1 | **Header/footer menyebut MK yang salah** | Setiap halaman: *"Rencana Pembelajaran : Pemrograman Front-End"* — padahal MK-nya Basis Data. Sisa salin-tempel dari template MK lain |
| W2 | **Tahun akademik tidak konsisten** | Hal. 1 & 3–22: "Genap 2025/2026". Hal. 2 & 8: "Ganjil 2025/2026" |
| W3 | **Placeholder belum diisi** | Nama Ka.Prodi tertulis `xxx`; baris 2–5 Tim Dosen kosong |
| W4 | **Format bobot tidak seragam** | Minggu 6 ditulis `5` tanpa tanda persen |
| W5 | **Rentang minggu tugas tidak konsisten** | Header tugas: "Minggu : 9-16". Linimasa proyek: Minggu 12–16 |
| W6 | **Skala nilai punya dua entri untuk angka 0** | `0–44,99 → E → 0` dan baris terpisah `F → 0 → Gagal` tanpa rentang skor |
| W7 | **Tabel distribusi hanya bertanda √, tanpa bobot numerik** | Akibatnya ketercapaian CPMK tidak bisa dihitung — hanya "terkait/tidak terkait" |

> **W7 adalah temuan paling penting secara struktural.** Tabel √ menyatakan *keterkaitan*, bukan *kontribusi*. Tanpa bobot numerik per sel, capaian CPL tidak dapat dihitung dan seluruh janji OBE berhenti di dokumen. Aplikasi harus mengganti √ dengan angka (atau menurunkan angka otomatis dari bobot mingguan), sambil tetap **mencetak √ pada ekspor** agar dokumen tetap sesuai pakem ITTS. Ini contoh sempurna dari prinsip "data lebih kaya daripada tampilannya".

### 2.3 Neraca Waktu pada kasus nyata TI214

| | TM | PT | BM | Total/minggu | ×16 minggu | Per sks |
|---|---|---|---|---|---|---|
| Tertulis di kolom alokasi (M2–M15) | 2×60' = 120' | 3×60' = 180' | 4×70' = 280' | **580'** | 154,7 jam | **51,6 jam** ❌ |
| Tertulis di narasi metode | 120' | 360' (PT+BM digabung) | — | **480'** | 128 jam | **42,7 jam** ⚠ |
| Minggu 1 (beda sendiri) | 3×40' = 120' | 3×60' = 180' | 3×60' = 180' | **480'** | — | — |
| **Pagu 3 sks (SN-Dikti)** | 3×50' = 150' | 3×60' = 180' | 3×60' = 180' | **510'** | 136 jam | **45,3 jam** ✓ |

Tiga angka berbeda untuk satu mata kuliah, dan tidak satu pun yang pas. Ini persis masalah yang Neraca Waktu selesaikan — dan tidak akan pernah ketahuan lewat pemeriksaan manual.

**Catatan penting:** kebijakan ITTS mungkin memang menetapkan TM 3 sks = 120 menit, dan itu sah di bawah Permendikbudristek 53/2023 selama total 45 jam/sks terpenuhi. Yang **tidak** bisa dibela adalah kontradiksi internal (480' vs 580' di baris yang sama) dan kelebihan total. Aplikasi harus: (a) membiarkan ITTS mendeklarasikan kebijakannya, lalu (b) menegakkan konsistensi terhadap kebijakan itu.

---

## BAGIAN 3 — Alur Baru: Kurikulum Sebagai Masukan Terkunci

### 3.1 Pembagian tanggung jawab

```
┌─ BUKU KURIKULUM PRODI (sumber kebenaran, di luar RPKPS) ──────────┐
│  Profil lulusan · CPL · Bahan kajian · Struktur MK                │
│  CPMK per MK · Sub-CPMK per CPMK · Matriks CPL×MK                 │
│  Dikelola Ka.Prodi. Berubah hanya lewat revisi kurikulum.         │
└───────────────────────────┬───────────────────────────────────────┘
                            │ terkunci, read-only
                            ▼
┌─ RPKPS (yang disusun aplikasi ini, per MK per tahun akademik) ────┐
│  Deskripsi MK · Pustaka & tools · Topik & subtopik                │
│  Rencana mingguan · Metode · Aktivitas · Alokasi waktu            │
│  Indikator · Kriteria · Bobot · Tugas/proyek · Linimasa           │
│  Dikelola Koordinator MK. Berubah tiap semester.                  │
└───────────────────────────────────────────────────────────────────┘
```

Garis ini menentukan seluruh perilaku aplikasi. Kalau dosen ingin mengubah rumusan Sub-CPMK, aplikasi **tidak** mengizinkannya menyunting langsung — ia membuka **Usulan Revisi Kurikulum** yang ditujukan ke Ka.Prodi. Tanpa garis ini, tiap dosen akan mengarang CPMK-nya sendiri dan pemetaan CPL prodi rusak dalam satu semester.

### 3.2 Impor kurikulum

Tiga jalur, urut prioritas:

| Jalur | Bentuk | Untuk |
|---|---|---|
| **Template Excel** | Satu berkas, sheet: `CPL`, `Mata Kuliah`, `CPMK`, `Sub-CPMK`, `Matriks CPL×MK` | Jalur utama. Ka.Prodi mengisi sekali per kurikulum |
| **Impor RPKPS lama** | Unggah `.docx`/`.pdf` RPKPS yang sudah ada → parser + AI mengekstrak CPL/CPMK/Sub-CPMK ke bentuk terstruktur → dosen verifikasi | Bootstrap cepat. Prodi dengan puluhan MK tidak perlu mengetik ulang |
| **Entri manual** | Formulir | Penambahan satuan |

Contoh TI214 membuktikan jalur kedua layak: struktur B.1/B.2/B.3-nya konsisten dan dapat diurai secara andal.

### 3.3 Wizard yang direvisi

Wizard lama (11 langkah, mulai dari merumuskan CPMK) diganti:

```
[Pilih MK & Tahun Akademik]
      ↓  tarik dari kurikulum: sks, semester, prasyarat, status,
         CPL terbeban, CPMK, Sub-CPMK, tingkat KKNI

1  Identitas & Tim Pengampu       koordinator, tim dosen + NIDN, penandatangan
2  Deskripsi Mata Kuliah          (bantuan AI: draf dari CPMK + topik)
3  Verifikasi Capaian             ← READ-ONLY. Konfirmasi & urutkan Sub-CPMK.
                                    Tombol "Usulkan revisi kurikulum" bila janggal
4  ⭐ PENYELARASAN INDUSTRI        ← BARU. Dijalankan SEBELUM menyusun topik
5  Pustaka, Sumber Daring & Tools  (temuan langkah 4 masuk sebagai usulan)
6  Topik & Subtopik per Sub-CPMK   (menghasilkan bagian D otomatis)
7  Rencana Mingguan               metode, aktivitas, alokasi waktu
                                   └ panel kanan: NERACA WAKTU (live)
8  Penilaian                      komponen nilai, matriks distribusi,
                                   indikator, kriteria, bobot
9  Detail Tugas / Proyek          uraian, luaran, rubrik, linimasa
10 Validasi & Pratinjau           checklist B1–B6 + W1–W7 (§2)
11 Ajukan Pengesahan              Koordinator → Ka.Prodi → Kepala PMI
```

**Mengapa penyelarasan industri di langkah 4, bukan di akhir?** Kalau dijalankan setelah topik dan rencana mingguan tersusun, ia jadi tambal sulam — menyisipkan satu subtopik ke minggu yang pagunya sudah penuh. Kalau dijalankan sebelumnya, konteks industri ikut membentuk pilihan topik, studi kasus, tools, dan pustaka sejak awal. Perbedaannya besar sekali di hasil akhir.

---

## BAGIAN 4 — Fitur Penyelarasan Industri

### 4.1 Masalah yang diselesaikan

Pada contoh TI214, pustaka utamanya terbit 2019 dan 2015; pendukungnya 2014, 2007, dan 2015. Untuk mata kuliah yang praktiknya bergerak cepat, sebagian rujukan berumur 10–19 tahun. Isinya tetap sahih secara teori — normalisasi dan aljabar relasional tidak berubah — tapi lanskap praktiknya berubah drastis: basis data terkelola di cloud, NoSQL/dokumen, gudang data kolomnar, ORM dan migrasi skema berversi, *connection pooling*, observabilitas kueri, sampai *vector database* untuk aplikasi AI. Tidak satu pun muncul di RPKPS.

Ini bukan kelalaian dosen. Ini **konsekuensi struktural**: tidak ada mekanisme yang secara rutin mempertemukan RPKPS dengan keadaan industri, dan tidak ada tempat di dokumen untuk menaruh informasi itu.

### 4.2 Batas kewenangan — aturan paling penting di fitur ini

```
╔═══════════════════════════════════════════════════════════════╗
║  TERKUNCI — penyelarasan industri TIDAK BOLEH menyentuh:      ║
║    CPL · CPMK · Sub-CPMK · bobot sks · MK prasyarat           ║
║  Gap sampai level ini → keluar sebagai USULAN REVISI          ║
║  KURIKULUM ke Ka.Prodi, bukan perubahan RPKPS                 ║
╠═══════════════════════════════════════════════════════════════╣
║  BOLEH DISESUAIKAN — lapisan di bawah capaian:                ║
║    Topik & subtopik · Konteks studi kasus · Tools & perangkat ║
║    Pustaka & sumber daring · Bentuk tugas/proyek              ║
║    Metode pembelajaran · Konten wawasan industri (mahasiswa)  ║
╚═══════════════════════════════════════════════════════════════╝
```

Contoh penerapan pada TI214: menambahkan *"perbandingan model relasional vs dokumen"* sebagai subtopik minggu 1 **boleh** — Sub-CPMK `CPMK081-1` ("menjelaskan konsep dasar sistem basis data dan perbedaannya dengan sistem penyimpanan data konvensional") justru terlayani lebih baik. Sebaliknya, menambahkan Sub-CPMK baru tentang *data warehousing* **tidak boleh** — itu memperluas capaian, dan harus lewat Ka.Prodi.

### 4.3 Sumber sinyal industri

Fitur ini hanya sekuat sumbernya. Enam kanal, dengan bobot berbeda:

| Sumber | Bentuk | Bobot | Catatan |
|---|---|---|---|
| **Mitra industri (DUDI)** | Formulir masukan terstruktur untuk perusahaan mitra, hasil kunjungan industri, MoU | ★★★ | Paling relevan konteks Indonesia; paling jarang terdokumentasi |
| **Tracer study & alumni** | Kuesioner: teknologi apa yang Anda pakai di tempat kerja? MK apa yang paling/kurang terpakai? | ★★★ | Data yang sudah wajib dikumpulkan untuk akreditasi — tinggal dimanfaatkan |
| **Lowongan kerja** | Analisis frekuensi skill pada iklan lowongan untuk peran terkait, difilter wilayah Indonesia | ★★★ | Sinyal permintaan pasar yang paling langsung |
| **Sertifikasi & SKKNI** | Silabus sertifikasi vendor (Oracle, AWS, Google Cloud), skema BNSP, SKKNI bidang TI | ★★ | Berguna untuk memetakan MK → sertifikasi yang bisa dikejar mahasiswa |
| **Survei & laporan industri** | Stack Overflow Developer Survey, JetBrains Dev Ecosystem, DB-Engines Ranking, GitHub Octoverse | ★★ | Global; perlu dibaca dengan hati-hati untuk konteks lokal |
| **Kurikulum acuan** | ACM/IEEE Computing Curricula, APTIKOM, kurikulum kampus pembanding | ★ | Bergerak lambat, tapi otoritatif untuk cakupan minimal |

Pencarian web oleh AI dipakai untuk **mengambil dan meringkas** sumber-sumber ini — **bukan** sebagai sumber itu sendiri. Klaim tren tanpa tautan sumber dan tanggal akses ditolak sistem.

### 4.4 Keluaran: Laporan Analisis Kesenjangan

```
┌─ Analisis Kesenjangan Industri · TI214 Basis Data ────────────────┐
│  Dijalankan 16 Agu 2026 · 5 sumber · Skor Kesegaran 58/100       │
│                                                                   │
│  ● Kesegaran pustaka          32/100  ← rata-rata usia 12,4 thn   │
│  ● Cakupan topik industri     61/100  ← 8 dari 21 skill tercakup  │
│  ● Relevansi tools            74/100                              │
│  ● Konteks karier             45/100  ← belum ada peta peran      │
└───────────────────────────────────────────────────────────────────┘

TEMUAN (12) — diurutkan berdasarkan keparahan

┌─ 🔴 HILANG · tinggi ──────────────────────────────────────────────┐
│ Basis data terkelola di cloud (RDS / Cloud SQL / Supabase)        │
│                                                                   │
│ Sinyal   : muncul di 71% lowongan Backend/Data Engineer (n=340,   │
│            Indonesia, Q2 2026) · 3 dari 4 mitra DUDI menyebutkan  │
│ Dampak   : lulusan hanya pernah memasang DBMS lokal               │
│                                                                   │
│ USULAN   : Minggu 13 (DCL & Keamanan) — tambah subtopik           │
│            "Manajemen akses pada DBMS terkelola: IAM, VPC,        │
│             enkripsi saat diam"                                   │
│ Sub-CPMK : CPMK082-5 — TETAP TERCAPAI, konteksnya diperluas       │
│ Waktu    : +30' pada BM (pagu minggu 13 tersisa 40')  ✓ muat      │
│ Pustaka  : + Dokumentasi AWS RDS / Google Cloud SQL (daring)      │
│ Sumber   : [1] [2] [3]  · diakses 14 Agu 2026                     │
│                                                                   │
│ [ Terima ]  [ Terima & sesuaikan ]  [ Tunda ]  [ Tolak + alasan ] │
└───────────────────────────────────────────────────────────────────┘

┌─ 🔴 HILANG · tinggi ──────────────────────────────────────────────┐
│ Migrasi skema berversi (Flyway / Liquibase / Prisma Migrate)      │
│ ... USULAN: Minggu 9 (DDL) — ubah tugas praktikum agar skrip DDL  │
│     dikelola sebagai berkas migrasi bernomor, bukan skrip lepas   │
└───────────────────────────────────────────────────────────────────┘

┌─ 🟡 PORSI · sedang ───────────────────────────────────────────────┐
│ Normalisasi manual mendapat 2 minggu penuh (M4, M6 = 15% bobot)   │
│ Di industri, normalisasi jarang dikerjakan manual dari nol;       │
│ yang lebih sering dituntut adalah membaca & mengevaluasi skema    │
│ yang sudah ada, termasuk denormalisasi yang disengaja untuk OLAP  │
│                                                                   │
│ USULAN : Pertahankan M4 (teori & latihan). Ubah M6 dari           │
│          "peer review skema mahasiswa" → "audit skema nyata dari  │
│          proyek sumber terbuka + diskusi kapan denormalisasi      │
│          justru benar". Sub-CPMK CPMK081-6 tetap tercapai.        │
└───────────────────────────────────────────────────────────────────┘

┌─ 🟡 PUSTAKA · sedang ─────────────────────────────────────────────┐
│ 4 dari 5 sumber cetak berusia >10 tahun                          │
│ Beighley (2007) = 19 thn · Connolly (2014) = 12 thn               │
│ USULAN: pertahankan Silberschatz & Elmasri sebagai landasan       │
│ teori; tambahkan 1 rujukan praktik mutakhir + dokumentasi resmi   │
└───────────────────────────────────────────────────────────────────┘

┌─ ⚪ DI LUAR KEWENANGAN — usulan ke Ka.Prodi ──────────────────────┐
│ Gudang data & analitik (OLAP, star schema, kolomnar)             │
│ Muncul kuat di sinyal industri, tapi tidak dapat ditampung        │
│ Sub-CPMK mana pun di TI214 tanpa memperluas capaian.              │
│ → Usulan: MK pilihan baru, atau revisi CPMK082 di kurikulum       │
│ [ Kirim sebagai Usulan Revisi Kurikulum ]                         │
└───────────────────────────────────────────────────────────────────┘
```

Empat hal yang membuat panel ini berguna dan bukan sekadar daftar keluhan:

1. **Setiap temuan membawa sinyal dengan angka dan sumber**, bukan pendapat.
2. **Setiap temuan membawa usulan penempatan konkret** — minggu berapa, sebagai apa.
3. **Setiap usulan menyatakan dampaknya pada pagu waktu**, dan ditolak sendiri kalau tidak muat.
4. **Setiap usulan menegaskan Sub-CPMK tetap tercapai** — atau jujur mengaku di luar kewenangan.

### 4.5 Skor Kesegaran

Satu angka 0–100 per RPKPS, agregasi empat dimensi. Bukan untuk menghakimi dosen, tapi untuk memberi prodi peta prioritas: MK mana yang paling perlu disegarkan lebih dulu.

| Dimensi | Cara hitung | Bobot |
|---|---|---|
| Kesegaran pustaka | Fungsi usia rata-rata pustaka utama & pendukung, dengan *paruh waktu* per rumpun ilmu (rumpun teknologi meluruh cepat, rumpun matematika hampir tidak) | 25% |
| Cakupan topik industri | Rasio skill bersinyal-tinggi yang tersinggung minimal satu subtopik | 35% |
| Relevansi tools | Rasio tools yang masih aktif dipakai industri terhadap total tools tercantum | 20% |
| Konteks karier | Ada tidaknya peta peran karier, sertifikasi terkait, dan wawasan industri terkurasi | 20% |

Dasbor prodi menampilkannya sebagai matriks MK × semester, dengan penanda mana yang belum pernah disegarkan.

### 4.6 Siklus penyegaran

```
Awal semester ──▶ Analisis otomatis dijalankan untuk semua MK aktif
                  (batch, memakai kunci institusi bila ada)
                        ↓
              Koordinator MK menerima ringkasan: "3 temuan berat"
                        ↓
              Buka RPKPS → panel temuan → terima/tolak per item
                        ↓
              Perubahan yang diterima → versi baru RPKPS
                        ↓
              Deskripsi perubahan otomatis mengisi HISTORI REVISI (bagian J)
                        ↓
              Temuan di luar kewenangan → antrean Usulan Revisi Kurikulum
                        ↓
              Ka.Prodi meninjau antrean saat siklus evaluasi kurikulum
```

Bagian J pada template ITTS jadi tempat pendaratan alami: *"Revisi 2 — 12 Sep 2026 — Penyelarasan industri: penambahan subtopik basis data terkelola (M13), perubahan bentuk tugas M9 ke migrasi berversi, pembaruan 2 pustaka daring."* Ini juga jejak audit yang bagus untuk asesor akreditasi.

---

## BAGIAN 5 — Kanal ke Mahasiswa

Permintaan Anda: *"agar mahasiswa juga bisa mengetahui perkembangan matkul di industri saat ini."* Analisis kesenjangan di atas menghasilkan bahan bakunya; bagian ini menyalurkannya.

**Aturan mutlak: tidak ada konten yang sampai ke mahasiswa tanpa kurasi dosen.** Keluaran AI masuk sebagai draf berstatus `belum terbit`; koordinator MK menyunting dan menerbitkan.

### 5.1 Empat bentuk tampilan

**(a) Panel "Di Dunia Kerja" — per pertemuan**

Muncul di bawah materi minggu berjalan pada portal mahasiswa:

```
┌─ Minggu 4 · Normalisasi Basis Data ───────────────────────────────┐
│ 💼 DI DUNIA KERJA                                                 │
│                                                                   │
│ Normalisasi sampai 3NF adalah standar untuk basis data transaksi  │
│ (OLTP) — yang menopang aplikasi kasir, e-commerce, dan perbankan. │
│ Tapi di sistem analitik (dashboard, laporan), tim data justru     │
│ sengaja melakukan DENORMALISASI agar kueri laporan lebih cepat.   │
│ Tahu kapan menormalisasi dan kapan tidak — itu yang membedakan    │
│ junior dan senior.                                                │
│                                                                   │
│ 🔗 Sumber: [Dokumentasi arsitektur data …] · diakses 14 Agu 2026  │
│ 👤 Dipakai oleh: Backend Developer · Data Engineer · DBA          │
│ ✅ Dikurasi oleh Muhamad Yusuf, S.Kom., M.Kom. · 16 Agu 2026      │
└───────────────────────────────────────────────────────────────────┘
```

**(b) Peta Karier Mata Kuliah**

Satu halaman per MK: peran pekerjaan yang bertumpu pada MK ini, skill yang dituntut untuk tiap peran, sertifikasi yang relevan, dan pemetaan skill → Sub-CPMK mana yang membekalinya. Menjawab pertanyaan yang paling sering ditanyakan mahasiswa: *"ini nanti dipakai buat apa?"*

**(c) Radar Teknologi MK**

Visual empat cincin — **Adopsi / Coba / Amati / Tahan** — untuk domain MK. Untuk Basis Data misalnya: PostgreSQL di Adopsi; vector database di Coba; basis data multi-model di Amati; teknologi yang ditinggalkan di Tahan. Memberi mahasiswa peta lanskap, bukan sekadar daftar.

**(d) Kartu "Dari Kelas ke Industri" — per Sub-CPMK**

Satu kartu ringkas: apa yang dipelajari → bagaimana bentuknya di tempat kerja → apa yang berbeda dari versi kelas. Bahan bagus untuk kuis pemantik dan diskusi forum.

### 5.2 Manfaat sampingan yang tidak disengaja

Panel (a) dan kartu (d) adalah materi yang secara alami memancing diskusi. Menautkannya sebagai pemicu forum di pertemuan yang sama membuat modul Forum (M9 di konsep awal) punya isi bermutu sejak hari pertama — bukan forum kosong yang dosen bingung mau diisi apa.

---

## BAGIAN 6 — Tambahan Model Data

```
-- Sumber & sinyal
sumber_industri       id, jenis('dudi'|'tracer'|'lowongan'|'sertifikasi'
                      |'survei'|'kurikulum_acuan'), nama, url, penerbit,
                      wilayah, tanggal_terbit, tanggal_akses, bobot_kredibilitas
sinyal_industri       id, sumber_id, skill_atau_topik, kategori, frekuensi,
                      ukuran_sampel, arah_tren('naik'|'stabil'|'turun'),
                      periode, wilayah
peran_karier          id, nama, deskripsi, rumpun
peran_skill           peran_id, skill, tingkat_kepentingan
sertifikasi           id, nama, penyelenggara, url_silabus, skill[]

-- Masukan langsung
mitra_industri        id, nama, bidang, pic, status_mou
masukan_dudi          id, mitra_id, prodi_id, mk_id?, isi, tanggal, ditindaklanjuti
tracer_response       id, alumni_id, angkatan, peran_sekarang, teknologi_dipakai[],
                      mk_paling_terpakai[], mk_kurang_terpakai[], saran, tanggal

-- Analisis
analisis_kesenjangan  id, rpkps_id, dijalankan_pada, dijalankan_oleh,
                      skor_kesegaran, skor_pustaka, skor_cakupan, skor_tools,
                      skor_karier, sumber_dipakai[], generation_id
temuan_kesenjangan    id, analisis_id, jenis('hilang'|'usang'|'porsi'|'pustaka'
                      |'tools'|'luar_kewenangan'), keparahan('tinggi'|'sedang'
                      |'rendah'), judul, ringkasan_sinyal, sinyal_id[],
                      target_pertemuan_id?, target_entitas, usulan_perubahan,
                      dampak_menit, sub_cpmk_terdampak[],
                      status('baru'|'diterima'|'disesuaikan'|'ditunda'|'ditolak'),
                      alasan_penolakan, diputuskan_oleh, diputuskan_pada
usulan_revisi_kurikulum id, prodi_id, mk_id?, asal_temuan_id, isi, status,
                      diajukan_oleh, ditinjau_oleh, ditinjau_pada

-- Konten untuk mahasiswa
wawasan_industri      id, rpkps_id, pertemuan_id?, sub_cpmk_id?,
                      jenis('panel_pertemuan'|'kartu_sub_cpmk'|'peta_karier'
                      |'radar'), judul, isi, sitasi[], berlaku_sampai,
                      status('draf'|'terbit'|'kedaluwarsa'),
                      dikurasi_oleh, diterbitkan_pada, generation_id
radar_teknologi       id, rpkps_id, teknologi, cincin('adopsi'|'coba'|'amati'
                      |'tahan'), catatan, sumber_id[], diperbarui_pada
```

Dua kolom yang mudah dilewatkan dan mahal ditambahkan belakangan: **`berlaku_sampai`** pada `wawasan_industri` (tanpa itu, konten "terkini" jadi konten basi tanpa ada yang tahu) dan **`sinyal_id[]`** pada `temuan_kesenjangan` (tanpa itu, dosen tidak bisa memeriksa dasar sebuah usulan).

---

## BAGIAN 7 — Risiko Khusus Fitur Ini

| Risiko | Mengapa serius | Mitigasi |
|---|---|---|
| **Halusinasi tren** — AI mengarang statistik lowongan atau nama teknologi | Merusak kredibilitas fitur secara permanen; sekali ketahuan, dosen berhenti percaya | Semua klaim wajib bersitasi ke `sumber_industri` yang ada di basis data. Temuan tanpa `sinyal_id` ditolak validator sebelum ditampilkan |
| **Bias global vs konteks Indonesia** | Tren Silicon Valley belum tentu tren Jakarta; lulusan bekerja di sini | Bobot kredibilitas tertinggi pada DUDI, tracer study, dan lowongan berwilayah Indonesia. Tampilkan asal wilayah tiap sinyal |
| **Bias vendor** | AI cenderung merekomendasikan produk yang paling banyak dibicarakan, bukan yang paling tepat | Wajib menampilkan minimal dua alternatif untuk tiap rekomendasi tool. Larang menyebut merek dalam rumusan capaian |
| **Konten basi diam-diam** | "Terkini" per Agustus 2026 jadi menyesatkan per 2028 | `berlaku_sampai` wajib; sistem menandai kedaluwarsa; wawasan kedaluwarsa otomatis disembunyikan dari mahasiswa |
| **Beban berlebih** — semua usulan diterima, pagu waktu jebol | RPKPS jadi tidak realistis dan mahasiswa kelebihan beban | Setiap usulan menyertakan `dampak_menit`; Neraca Waktu memblokir yang tidak muat; usulan berikutnya harus disertai apa yang dikurangi |
| **Mengejar tren, mengorbankan fondasi** | Aljabar relasional dan normalisasi tetap wajib meski tidak "seksi" | Batas kewenangan §4.2 melindunginya secara struktural: capaian terkunci, hanya konteks yang boleh berubah |
| **Dosen merasa dinilai** | Skor kesegaran rendah bisa terasa seperti tuduhan | Bingkai sebagai alat bantu prioritas, bukan penilaian kinerja. Skor terlihat oleh koordinator MK & Ka.Prodi, **tidak** dipakai untuk evaluasi dosen |
| **Injeksi prompt dari sumber web** | Halaman web bisa berisi instruksi tersembunyi | Isi halaman diperlakukan sebagai data tak tepercaya dalam penanda eksplisit; tidak pernah sebagai instruksi |

---

## BAGIAN 8 — Roadmap yang Direvisi

| Fase | Perubahan dari roadmap awal |
|---|---|
| **F1 — Kurikulum** | Berubah fokus: dari *menyusun* kurikulum menjadi **mengimpor** kurikulum (Excel + parser RPKPS lama) |
| **F2 — Penyusun RPKPS** | Wizard baru §3.3, mulai dari langkah verifikasi capaian. Template ekspor ITTS (7 kolom + sub-kolom) sebagai template pertama |
| **F2b — Validator** | Naik prioritas: aturan B1–B6 dan W1–W7 (§2) sudah tervalidasi terhadap dokumen nyata. Bisa dikerjakan lebih awal karena spesifikasinya sudah jelas |
| **F3 — Asesmen** | Tambahan: matriks distribusi penilaian bergaya ITTS, dengan bobot numerik di balik tampilan √ |
| **AI-2b — Penyelarasan Industri** | **Fase baru.** Sumber & sinyal → analisis kesenjangan → panel temuan. Bergantung pada AI-0 (kredensial) dan F2 |
| **AI-2c — Kanal Mahasiswa** | Panel per pertemuan, peta karier, radar, kartu Sub-CPMK. Bergantung pada AI-2b |
| **F6 — Pelaksanaan** | Wawasan industri jadi pemicu forum siap pakai |

**Usulan batas MVP yang direvisi: F0 → F1(impor) → F2 → F2b → F3 → F4, lalu AI-0 → AI-2b.**

Alasannya: begitu validator (F2b) jalan, aplikasi sudah memberi nilai yang tidak bisa didapat dari Word — menemukan bobot 120% dan kontradiksi alokasi waktu sebelum dokumen naik ke Ka.Prodi. Penyelarasan industri adalah pembeda yang membuat aplikasi ini bukan sekadar formulir digital, jadi ia layak masuk MVP diperluas meski setelah fondasi selesai.

---

## BAGIAN 9 — Keputusan Baru yang Perlu Ditetapkan

Menambah 12 pertanyaan sebelumnya:

13. **Kebijakan sks ITTS** — berapa menit TM resmi untuk 1 sks di ITTS? Contoh TI214 memakai 40 dan 60 menit di tempat berbeda. Angka ini mengunci seluruh Neraca Waktu, jadi harus dipastikan ke Penjaminan Mutu.
14. **Pola kode Sub-CPMK** — ITTS memakai `CPMK081-1`. Apakah dipertahankan (aplikasi menyesuaikan), atau ini saat yang tepat untuk pindah ke `Sub-CPMK-x` yang lebih lazim?
15. **Nasib tabel √** — ganti dengan bobot numerik di layar tapi tetap cetak √ di ekspor (rekomendasi saya), atau ubah sekalian formatnya?
16. **Sumber industri yang tersedia** — apakah ITTS sudah punya data tracer study terstruktur dan daftar mitra DUDI yang bisa dipakai? Kalau belum, fitur ini bergantung pada sumber publik saja dan bobotnya turun.
17. **Akses sumber lowongan kerja** — apakah akan memakai API berbayar, penelusuran web oleh AI, atau input manual dari tim karier kampus?
18. **Siapa yang mengurasi wawasan industri** — koordinator MK saja, atau ada peran khusus (mis. Kepala Laboratorium atau koordinator kerja sama industri)?
19. **Cakupan awal** — apakah aplikasi dipakai satu prodi (Teknologi Informasi) dulu, atau langsung seluruh ITTS?

Yang paling menghambat kalau tidak dijawab: **nomor 13** (mengunci seluruh perhitungan waktu) dan **nomor 16** (menentukan apakah Penyelarasan Industri punya fondasi data atau hanya bertumpu pada sumber publik).
