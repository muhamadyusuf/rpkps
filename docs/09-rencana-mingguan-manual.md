# Penyusunan Rencana Mingguan Secara Manual

> Status: **TERPASANG (30 Agustus 2026). M1–M5 selesai.**
> Menjawab permintaan: *"agar RPKPS juga bisa disusun manual oleh dosen —
> tambah, edit, dan hapus rencana kegiatan pembelajaran."*
> Bagian 3 memuat keputusan yang perlu ditetapkan lebih dulu; Bagian 4
> rancangan teknisnya.

## BAGIAN 1 — Yang sekarang bisa dan tidak bisa dilakukan dosen

Kerangka mingguan dibuat **sekali**, di dalam `buatRpkps`
(`src/app/(app)/rpkps/aksi.ts`): 16 baris `pertemuan`, nomor minggu berurutan,
jenis (`EFEKTIF`/`UTS`/`UAS`) mengikuti `posisiMingguUjian(kebijakan)`, alokasi
waktu terisi sesuai pagu, Sub-CPMK dibagikan satu per pertemuan efektif.

Setelah itu **bentuk tabelnya beku**. Yang tersedia hanya `simpanPertemuan` —
mengubah ISI satu baris yang sudah ada.

| Yang diminta dosen | Sekarang |
|---|---|
| Mengubah topik, metode, indikator, alokasi waktu minggu ke-*n* | ✅ `/rpkps/[id]/mingguan/[minggu]` |
| Menambah baris pertemuan (mis. pertemuan pengganti, minggu ke-17) | ❌ tidak ada jalan |
| Menghapus baris yang tidak dipakai | ❌ tidak ada jalan |
| Menyisipkan satu pertemuan di tengah, sisanya bergeser | ❌ tidak ada jalan |
| Menukar urutan dua minggu ("materi minggu 5 dipindah ke minggu 7") | ❌ harus mengetik ulang dua baris |
| Mengubah jenis baris (menandai minggu 9 sebagai UTS) | ❌ `jenis` tidak ada di penyunting |
| Menyusun dari tabel kosong, tanpa kerangka otomatis | ❌ kerangka selalu dibuat |

Perhatikan bahwa dari tujuh baris itu, **enam adalah operasi terhadap HIMPUNAN
BARIS**, bukan terhadap isi baris. Itulah yang belum ada — dan itu bukan
kekurangan penyunting, melainkan keputusan rancangan yang belum pernah diambil.

## BAGIAN 2 — Mengapa ini bukan sekadar tombol tambah dan hapus

Empat hal di dalam sistem menempel pada **NOMOR minggu**, bukan pada baris
`pertemuan`. Setiap penambahan, penghapusan, dan penggeseran menyentuh keempatnya.

### 2.1 Nomor minggu itu kunci unik

```prisma
@@unique([rpkpsId, minggu])
```

Menyisipkan baris di posisi 5 berarti minggu 5–16 harus menjadi 6–17. Dikerjakan
satu per satu dari bawah, `UPDATE minggu = 6 WHERE minggu = 5` langsung menabrak
baris minggu 6 yang masih ada. Renumerasi **wajib dua fase di dalam satu
transaksi**: pindahkan dulu ke nomor negatif sementara, baru turunkan ke nomor
tujuan. Ini bukan detail implementasi yang bisa ditunda — ia menentukan bentuk
aksi servernya.

### 2.2 Pagu beban belajar dipetakan per nomor minggu

`susunRencanaSemester` menghasilkan pagu untuk minggu 1..`mingguPerSemester`,
dan halaman mingguan memakainya lewat `paguPerMinggu.get(p.minggu)`. Akibatnya:

- baris yang **pindah nomor** mendapat pagu berbeda bila melewati minggu ujian —
  neraca waktunya berubah tanpa isinya disentuh;
- baris di **luar 1..16** tidak punya pagu sama sekali (`get` mengembalikan
  `undefined`), sehingga lolos dari validasi per-pertemuan tanpa pesan apa pun.

Invarian `total / sks = 45 jam` tetap dijaga lapis kedua (`B5-SEMESTER`), jadi
menit berlebih tetap tertangkap — tetapi lapis pertamanya bolong dan harus
ditutup secara eksplisit.

### 2.3 Validator sudah punya pendirian tentang struktur

`B6-MINGGU-HILANG` dan `B6-MINGGU-GANDA` menuntut minggu
1..`mingguPerSemester` hadir lengkap dan tidak berulang. Membebaskan dosen
menghapus baris berarti dokumen bisa berada dalam keadaan yang **sengaja
dilarang validator**. Keduanya tidak dapat dibiarkan tanpa keputusan — lihat K1.

Yang belum diatur validator: baris **berlebih** (minggu 17, 18). B6 hanya
memeriksa yang hilang dan yang ganda.

### 2.4 Nomor minggu dirujuk sebagai ANGKA di tiga tempat lain

| Perujuk | Bentuk rujukan | Akibat bila nomor bergeser |
|---|---|---|
| `nilai_asesmen.asesmen_kode` | `"M5"`, diturunkan dari nomor minggu, **bukan relasi** (lihat komentar skema) | Nilai mahasiswa diam-diam berpindah ke asesmen lain |
| `tugas.minggu_mulai` / `minggu_selesai` | angka | Jadwal tugas menunjuk minggu yang isinya sudah lain |
| `linimasa_tugas.minggu` | angka | Tahapan tugas meleset satu minggu |

Baris pertama yang paling berbahaya, dan tidak ada pengaman basis data untuk itu:
`asesmenKode` sengaja bukan relasi (doc 05 §5.3), jadi renumerasi tidak akan
pernah gagal — ia hanya akan salah, tanpa suara. `rpkps_snapshot` justru aman:
salinannya beku dan memang tidak boleh ikut berubah.

## BAGIAN 3 — Keputusan yang perlu ditetapkan

### K1 — Kebebasan di draf, invarian di gerbang penerbitan ✅ usulan

Struktur mingguan **bebas diubah selama status `DRAF` atau `DIREVISI`**. B6 tidak
dilonggarkan sedikit pun; ia tetap memblokir di `ajukanRpkps`. Dosen boleh
bekerja dengan tabel yang untuk sementara belum lengkap, tetapi **tidak dapat
mengajukan** dokumen 13 minggu.

Panel validasi (`panel-validasi.tsx`) sudah menampilkan temuan secara langsung,
jadi keadaan "belum lengkap" terlihat sepanjang penyuntingan, bukan sebagai
kejutan saat menekan Ajukan.

Dua alternatif yang **ditolak**:

- *Struktur tetap terkunci, hanya isi yang bisa disunting.* Tidak menyelesaikan
  apa pun — inilah keadaan sekarang.
- *Melonggarkan B6 agar jumlah minggu bebas.* Dokumen 13 minggu akan lolos
  terbit dan menjadi halaman publik. Jumlah minggu bukan selera dosen; ia
  kebijakan institusi (`kebijakan_beban_belajar.minggu_per_semester`).

### K2 — Lima operasi, bukan tiga

"Tambah, edit, hapus" dalam praktiknya lima operasi dengan risiko berbeda:

| Kode | Operasi | Renumerasi? | Yang hilang |
|---|---|---|---|
| **T** | Tambah pertemuan di akhir | tidak | — |
| **S** | Sisip pertemuan setelah minggu *n* | ya, *n*+1 ke atas naik satu | — |
| **H** | Hapus pertemuan | ya, di bawahnya turun satu | aktivitas, indikator, kaitan Sub-CPMK, kaitan pustaka baris itu (cascade) |
| **G** | Geser naik/turun | ya, tukar dua nomor | — |
| **J** | Ubah jenis (EFEKTIF ⇄ UTS/UAS) | tidak | — |

**H adalah satu-satunya yang menghilangkan data**, dan hilangnya senyap: empat
tabel anak ikut lewat `onDelete: Cascade`. Dialog konfirmasinya harus menyebut
jumlahnya (*"minggu 7 beserta 3 aktivitas, 2 indikator, dan 1 kaitan Sub-CPMK"*),
bukan sekadar "Anda yakin?".

Operasi **J** perlu disebut terpisah karena hari ini `jenis` sama sekali tidak
ada di penyunting — sekali kerangka dibuat, tidak ada cara menandai minggu mana
yang ujian.

### K3 — Renumerasi menyeret rujukan minggu, di transaksi yang sama

Saat S/H/G mengubah nomor, `tugas.mingguMulai`, `tugas.mingguSelesai`, dan
`linimasa_tugas.minggu` **ikut digeser dengan pemetaan yang sama**, di dalam
transaksi yang sama. Alasannya: keduanya adalah *rencana yang menunjuk minggu*,
bukan catatan pelaksanaan. Membiarkannya berarti tugas yang dijadwalkan minggu
5–7 tiba-tiba menunjuk materi yang lain.

Kisi-kisi tidak menyebut nomor minggu sama sekali (`butir_kisi_kisi` menempel ke
Sub-CPMK), jadi tidak ikut.

### K4 — Struktur tetap boleh diubah walau nilai sudah masuk ✅ ditetapkan

Ditetapkan: sisip/hapus/geser **tidak diblokir** oleh keberadaan nilai. Yang
menghalangi hanya status — struktur hanya dapat diubah selama `DRAF` atau
`DIREVISI`, sama seperti seluruh penyuntingan RPKPS lain.

Tetapi peringatan saja tidak cukup, karena §2.4: `nilai_asesmen.asesmen_kode`
(`"M5"`) diturunkan dari nomor minggu tanpa relasi, jadi renumerasi tanpa
tindakan apa pun akan membuat nilai berpindah materi **tanpa gagal dan tanpa
jejak**. Maka:

1. **Renumerasi ikut memindahkan `asesmen_kode`** dengan pemetaan yang sama,
   di transaksi yang sama, dua fase (kuncinya `@@unique([pesertaKelasId,
   asesmenKode])` juga bisa bertabrakan). `M5 → M6` mengikuti barisnya.
2. **Penghapusan tidak memindahkan apa-apa** — asesmennya memang lenyap.
   Barisnya `nilai_asesmen` **tidak ikut dihapus**: ia menganggur dengan kode
   yang tak lagi dikenal peta asesmen, dan dapat dipulihkan bila barisnya
   dibuat kembali. Menghapusnya berarti melenyapkan nilai mahasiswa lewat
   sebuah tombol tata letak tabel.
3. **Dialog menyebut angka sebenarnya**, dihitung server sebelum aksi
   dijalankan: berapa nilai yang ikut berpindah, dan berapa yang menganggur.

`hitungDampakStruktur` di `src/domain/rpkps/rencana-mingguan.ts` yang
menurunkan angka-angka itu, murni dan teruji.

### K5 — Jenis baris bebas ditentukan dosen, posisinya diperingatkan

Setelah J tersedia, posisi ujian pilihan dosen bisa berbeda dari
`posisiMingguUjian(kebijakan)`. Ini **peringatan, bukan pemblokir** — kalender
akademik prodi kadang memang menggeser UTS. Yang tetap memblokir adalah
`B5-UJIAN-TANPA-ALOKASI`: baris ujian wajib punya alokasi waktu.

Temuan baru: `W-UJIAN-DI-LUAR-POSISI`.

### K6 — Baris di luar 1..N ditandai, tidak dilarang

Menutup lubang §2.2. Baris berminggu > `mingguPerSemester` diberi pagu nol,
ditandai di tabel, dan memunculkan temuan baru `W-MINGGU-BERLEBIH`
(peringatan). Menitnya tetap masuk hitungan semester, jadi `B5-SEMESTER` tetap
menangkap kelebihan bebannya sebagai pemblokir.

### K7 — Membuat RPKPS tanpa kerangka otomatis ✅ ditetapkan

Opsi "mulai dari tabel kosong" pada dialog buat RPKPS. Kerangka otomatis tetap
menjadi bawaan — ia menghilangkan halaman kosong, hambatan terbesar dosen
(komentar `buatRpkps`). Ditambah satu aksi `susunUlangKerangka` untuk memulihkan
kerangka pada RPKPS yang sudah telanjur diacak, dengan syarat K4 dan konfirmasi
penuh karena ia menghapus seluruh baris yang ada.

## BAGIAN 4 — Rancangan teknis

### 4.1 Domain murni — `src/domain/rpkps/rencana-mingguan.ts`

Tanpa Prisma, tanpa React, dapat diuji sendiri:

```ts
export type PemetaanMinggu = { dari: number; ke: number };

/** Rencana renumerasi untuk sisip/hapus/geser. Hanya baris yang berubah. */
export function rencanaSisip(terpakai: number[], setelah: number): PemetaanMinggu[];
export function rencanaHapus(terpakai: number[], minggu: number): PemetaanMinggu[];
export function rencanaGeser(terpakai: number[], minggu: number, arah: "NAIK" | "TURUN"): PemetaanMinggu[];

/** Menerapkan pemetaan pada rujukan angka (tugas, linimasa). */
export function geserRujukan(pemetaan: PemetaanMinggu[], minggu: number): number;

/** Syarat K4. Mengembalikan SELURUH alasan penolakan, bukan yang pertama. */
export function periksaKelayakanUbahStruktur(sensus: SensusStruktur): Kelayakan;
```

Berkas uji `rencana-mingguan.test.ts` mengikuti pola `daur-hidup.test.ts`.

### 4.2 Mekanisme — `src/lib/rpkps/struktur.ts`, aksi — `mingguan/aksi.ts`

`terapkanStruktur(db, rpkpsId, op)` menjalankan seluruh operasi dalam satu
transaksi. Ia menerima klien Prisma sebagai PARAMETER dan tidak menandai
dirinya `server-only` — pola `lib/kurikulum/usulan-inti.ts` — supaya
`uji/integrasi.ts` dapat menjalankannya terhadap Postgres sungguhan. Itu bukan
kemewahan: yang paling mungkin salah di seluruh fitur ini adalah renumerasi
yang menabrak kunci unik, dan itu tidak akan pernah terlihat pada uji domain
yang murni.

Aksi servernya tipis: `tambahPertemuan`, `sisipPertemuan`, `hapusPertemuan`,
`geserPertemuan`, `ubahJenisPertemuan`, `susunUlangKerangka` — masing-masing
`wenangRpkps` + `periksaKelayakanUbahStruktur`, panggil mekanismenya, tulis
`log_audit`, `revalidatePath`. Urutan di dalam transaksi:

```
fase 1: minggu → -(minggu + 1000)   untuk seluruh baris terdampak
fase 2: -(…)   → nomor tujuan
fase 3: geser tugas.minggu_mulai/selesai dan linimasa_tugas.minggu
```

Baris baru dibuat dengan aktivitas terisi pagu minggunya (mengikuti pola
`buatRpkps`), bukan kosong — supaya tidak langsung melanggar neraca waktu.

`simpanPertemuan` yang ada ditambah bidang `jenis` pada `SkemaPertemuan`.

### 4.3 Antarmuka

- `mingguan/page.tsx` — kolom aksi per baris (sisip di bawah, naik, turun,
  hapus) + tombol **Tambah pertemuan**; baris di luar 1..N ditandai; ringkasan
  kelayakan ditampilkan bila struktur terkunci (mis. "kelas sudah berisi nilai").
- `mingguan/[minggu]/editor.tsx` — pemilih **Jenis pertemuan**.
- Komponen tombol klien menyusul pola `tugas/tombol.tsx`.

### 4.4 Validator — `src/domain/rpkps/validator.ts`

Dua temuan baru, keduanya PERINGATAN: `W-MINGGU-BERLEBIH` (K6),
`W-UJIAN-DI-LUAR-POSISI` (K5). B6 tidak diubah.

## BAGIAN 5 — Tahapan

| Tahap | Isi | Bergantung |
|---|---|---|
| **M1** | Domain `rencana-mingguan.ts` + uji | — |
| **M2** | Aksi server T/S/H/G + renumerasi dua fase + geser rujukan tugas | M1 |
| **M3** | Antarmuka tabel mingguan: tambah, sisip, geser, hapus | M2 |
| **M4** | Jenis pertemuan (J) + dua temuan validator baru | M3 |
| **M5** | K7 — buat RPKPS tanpa kerangka + susun ulang kerangka | M2 |

## BAGIAN 6 — Di mana M1–M5 berada

| Berkas | Isi |
|---|---|
| `src/domain/rpkps/rencana-mingguan.ts` | Aritmetika struktur: rencana sisip/hapus/geser, pemetaan kode asesmen, dampak terhadap nilai, kelayakan |
| `src/domain/rpkps/kerangka.ts` | Perancang kerangka 16 baris, dipakai `buatRpkps` dan susun ulang |
| `src/domain/evaluasi/peta-asesmen.ts` | `kodeAsesmenPertemuan` — satu-satunya penurun kode `M5`/`UTS` |
| `src/lib/rpkps/struktur.ts` | Transaksi: renumerasi dua fase, geser rujukan tugas, pindah kode nilai |
| `src/lib/rpkps/kerangka.ts` | Penulis kerangka ke basis data |
| `src/lib/rpkps/kebijakan-inti.ts` | Pemuat kebijakan yang menerima klien Prisma |
| `src/app/(app)/rpkps/[id]/mingguan/aksi.ts` | Wewenang, audit, penyegaran halaman |
| `src/app/(app)/rpkps/[id]/mingguan/tombol.tsx` | Tombol baris, dialog berdampak, pemilih jenis, susun ulang |
| `uji/integrasi.ts` §10 | Bukti renumerasi lolos `@@unique` pada Postgres sungguhan |

## BAGIAN 7 — Imbas ke bagian lain, dan bagaimana ditutup

Ditelusuri 30 Agustus 2026, setelah M1–M5 terpasang. Tiga tempat lain diam-diam
mengandaikan tabel mingguan yang bentuknya tidak pernah berubah.

### 7.1 Kisi-kisi memisahkan Sub-CPMK di minggu yang salah

`kisi-kisi/page.tsx` membagi Sub-CPMK menjadi "diuji UTS" dan "diuji UAS"
memakai `posisiMingguUjian(kebijakan)[0]` — posisi UTS menurut KEBIJAKAN. Sejak
K5, dosen dapat memindahkan UTS-nya sendiri; angka kebijakan dan baris nyata
bisa berbeda, dan pemisahannya jatuh di minggu yang salah tanpa tanda apa pun.

**Ditutup:** batasnya kini diambil dari baris berjenis `UTS` yang benar-benar
ada di tabel. Kebijakan hanya menjadi cadangan bila baris ujiannya belum ada.

### 7.2 Dua aturan bertentangan atas baris yang sama

`W-MINGGU-BERLEBIH` (K6) menyatakan pertemuan di luar 16 minggu boleh ada,
cukup diperingatkan. Tetapi `I-MINGGU-DILUAR` **memblokir** tugas yang
dijadwalkan pada minggu itu, memakai `kebijakan.mingguPerSemester` sebagai
batas. Baris yang sama sah bagi satu aturan dan terlarang bagi aturan lain.

**Ditutup:** batas jadwal tugas menjadi minggu TERAKHIR YANG ADA di tabel,
bukan angka kebijakan — di validator maupun di penyunting tugas. Aturannya
sekarang satu kalimat: tugas boleh dijadwalkan pada minggu mana pun yang ada.

### 7.3 Kisi-kisi menggantung tanpa baris ujian

`kisi_kisi` berkunci `[rpkpsId, jenis]` dan **tidak berelasi ke `pertemuan`**.
Menghapus baris UTS, atau mengembalikan jenisnya menjadi EFEKTIF, meninggalkan
kisi-kisinya utuh tanpa satu pun asesmen yang memakainya. Sub-CPMK yang hanya
diukur lewat ujian itu kehilangan bobotnya, dan satu-satunya gejala yang muncul
adalah `PA-SUB-CPMK-TANPA-BOBOT` di ujung rantai — jauh dari sebabnya.

**Ditutup:** temuan baru `PA-KISI-TANPA-UJIAN` (peringatan) di
`susunPetaAsesmen`, tempat data kisi-kisi memang sudah ada. Ia menyebut jumlah
butir yang menganggur dan dua jalan keluarnya.

### 7.4 Yang diperiksa dan ternyata aman

| Bagian | Alasan aman |
|---|---|
| Ekspor DOCX | Menelusuri `r.pertemuan` apa adanya; jumlah baris tidak pernah diandaikan |
| Halaman publik & sidik | Membaca salinan beku, yang tidak tersentuh penyuntingan struktur |
| Draf AI | Konteksnya disusun dari baris yang ada, bukan dari kebijakan |
| Impor nilai & templat XLSX | Kolomnya diturunkan peta asesmen, yang sudah mengikuti baris nyata |
| RPKPS bertabel kosong | Seluruh pemakaian berupa `reduce`/`length`/`find`; tidak ada yang mengindeks langsung |
