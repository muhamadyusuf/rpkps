# Usulan Revisi Kurikulum (URK)

> Status: **U1–U2 terpasang** (model data, domain + uji, alur usulan manual,
> penerapan ke kurikulum, ledger revisi, pensiun berbasis TA, pratinjau dampak).
> U3–U4 (draf AI dan pemicu relevansi) belum. Menyempurnakan sketsa tabel
> `usulan_revisi_kurikulum` pada [02 §6](./02-template-itts-dan-penyelarasan-industri.md)
> dan menutup janji tombol "Usulkan revisi kurikulum" pada wizard §3.3 langkah 3.

## BAGIAN 1 — Masalah

Aplikasi memegang satu garis keras: **CPL, CPMK, dan Sub-CPMK berasal dari buku
kurikulum dan read-only di penyusun RPKPS.** Garis itu benar — tanpanya pemetaan
CPL prodi rusak dalam satu semester. Tetapi sekarang garis itu buntu: ketika dosen
menemukan Sub-CPMK yang salah rumus, KKO-nya tidak terukur, atau capaiannya sudah
tertinggal dari praktik industri, aplikasi hanya menampilkan kalimat *"perubahan
harus melalui usulan revisi kurikulum"* — dan tidak menyediakan jalannya.

Akibatnya kurikulum hanya berubah lewat impor Excel oleh Kaprodi, yaitu sekali per
siklus kurikulum (4–5 tahun). Padahal yang paling tahu sebuah capaian sudah usang
adalah dosen pengampu, tiap semester.

URK adalah **pintu resmi** yang menembus garis itu tanpa merobohkannya: dosen
mengusulkan, kode memeriksa, Kaprodi memutuskan, sistem menerapkan.

```
Dosen / Koordinator MK          Kaprodi                    Kurikulum
        │                          │                           │
        │ usulan berbutir          │                           │
        │ (draf AI + alasan)  ───► │ tinjau per butir          │
        │                          │ terima / sesuaikan / tolak│
        │                          │           ──── sahkan ──► │ revisi ke-N
        │                          │                           │ berlaku TA X
        │ ◄──── notifikasi ────────┤                           │
```

---

## BAGIAN 2 — Enam keputusan yang membentuk rancangan ini

### 2.1 Usulan itu **berbutir**, bukan naratif

Sketsa lama menyimpan usulan sebagai satu kolom `isi` teks. Itu tidak cukup: kalau
isinya prosa, Kaprodi harus mengetik ulang hasilnya ke kurikulum — salah ketik,
tanpa jejak, dan tidak bisa menyetujui sebagian.

Satu usulan = **amplop** (judul, latar belakang, MK sasaran) + **N butir** bertipe
yang dapat diterapkan kode secara deterministik. Bentuknya meneruskan
`UsulanPerbaikan` di `src/domain/kurikulum/perbaikan.ts`, yang sudah terbukti pada
alur impor.

| Jenis butir | Menyentuh | Dapat diterapkan otomatis |
|---|---|---|
| `CPMK_BARU` | CPMK + Sub-CPMK awal + peta CPL | ya |
| `CPMK_RUMUSAN` | rumusan / level Bloom CPMK | ya |
| `CPMK_PETA_CPL` | daftar CPL yang dijabarkan CPMK | ya |
| `CPMK_PENSIUN` | menonaktifkan CPMK sejak TA tertentu | ya |
| `SUB_BARU` | Sub-CPMK baru pada CPMK yang ada | ya |
| `SUB_RUMUSAN` | rumusan / level / KKO Sub-CPMK | ya |
| `SUB_MINGGU` | usulan minggu pelaksanaan | ya |
| `SUB_PENSIUN` | menonaktifkan Sub-CPMK sejak TA tertentu | ya |
| `CATATAN_CPL` | usulan menyentuh CPL / profil lulusan / struktur MK | **tidak** |

### 2.2 CPL berada **di luar** kewenangan URK

`CATATAN_CPL` sengaja tidak dapat diterapkan. CPL menyentuh seluruh prodi, matriks
CPL×MK, dan borang akreditasi — ia tidak boleh ditambal per mata kuliah oleh satu
dosen. Butir jenis ini hanya mendarat di antrean bahan **evaluasi kurikulum
berikutnya**, persis seperti kotak "di luar kewenangan" pada panel penyelarasan
industri (02 §4.4). Batas ini yang melindungi fondasi dari perburuan tren.

### 2.3 Setiap butir wajib membawa **dasar**

Inilah yang memisahkan "kurikulum lebih relevan" dari "kurikulum karangan LLM".
Tiap butir menyimpan minimal satu dasar:

| Jenis dasar | Contoh |
|---|---|
| `TEMUAN_VALIDATOR` | `K-SUB-TIDAK-TERUKUR` pada CPMK081-3 |
| `SINYAL_INDUSTRI` | id sinyal di basis data (fase AI-2b) |
| `MASUKAN_DUDI` | id masukan mitra industri |
| `TRACER` | id respons tracer study |
| `CATATAN_DOSEN` | argumen tertulis pengusul, minimal N karakter |

Butir tanpa dasar **ditolak validator domain sebelum sampai ke Kaprodi**. Aturan
ini menurunkan langsung mitigasi "halusinasi tren" pada 02 §7.

### 2.4 Pensiun, bukan hapus

`SubCpmk` dirujuk `PertemuanSubCpmk`, `TugasSubCpmk`, dan `ButirKisiKisi` dengan
`onDelete: Cascade`. Menghapus satu Sub-CPMK yang sedang dipakai akan **menghapus
baris di RPKPS berjalan tanpa jejak** — pertemuan kehilangan capaiannya, butir
kisi-kisi lenyap, bobot penilaian jadi tidak genap.

Maka URK tidak pernah menghapus. `*_PENSIUN` mengisi `pensiunSejakTaId`; data lama
tetap utuh dan tercetak apa adanya, sedangkan RPKPS untuk tahun akademik berikutnya
tidak lagi menawarkan capaian itu.

### 2.5 Revisi berlaku **mulai tahun akademik**, bukan seketika

`proyeksiIsi()` memuat `cpmk` dan `subCpmk`. Artinya mengubah satu rumusan CPMK
akan menggeser sidik SHA-256 **seluruh RPKPS terbit** yang memakai MK itu — dan
`periksaPergeseran()` akan menyalakan bendera pada dokumen yang tidak disentuh
siapa pun. Perilaku ini benar dan memang dirancang begitu; yang salah adalah
membiarkannya terjadi tanpa penjelasan.

Karena itu penerapan URK adalah tiga langkah, bukan satu tulis:

1. **Tulis** perubahan ke kurikulum, dengan `berlakuMulaiTaId` (baku: tahun
   akademik aktif berikutnya, bukan yang sedang berjalan).
2. **Catat** di ledger `RevisiKurikulum` — revisi ke-N, ringkasan, pengesah, TA berlaku.
3. **Tandai** RPKPS terbit yang terdampak dan beri tahu koordinatornya:
   *"Kurikulum direvisi (revisi 3, berlaku 2026/2027-GANJIL). RPKPS ini terbit
   atas rumusan lama; salinan bekunya tidak berubah. Sesuaikan saat menyusun
   RPKPS tahun berikutnya."*

RPKPS yang sudah TERBIT **tidak** ikut berubah: isinya beku di `RpkpsSnapshot` dan
halaman publik membaca salinan beku. Yang berubah hanya data langsung — dan
sekarang benderanya punya asal-usul yang bisa dibaca, bukan misteri.

*Alternatif yang ditolak:* menyalin seluruh kurikulum jadi versi baru tiap revisi.
`@@unique([prodiId, tahun])` menghalanginya, dan menggandakan seluruh pohon demi
satu kalimat itu berlebihan. Ledger revisi + `Kurikulum.revisi` sudah memberi jejak
yang sama dengan biaya jauh lebih kecil.

### 2.6 AI mengusulkan, kode memeriksa, manusia memutuskan

Tidak ada jalur baru menuju model. Tugas AI baru `USULAN_REVISI` lewat
`jalankanTugasAi()` yang sudah ada, dengan blok PANDUAN stabil (kamus KKO dirender
dari `LEVEL_BLOOM`, sama seperti `perbaikan-kurikulum.ts`) dan blok permintaan
berisi konteks MK. Keluarannya divalidasi skema Zod, lalu dilewatkan validator
domain murni sebelum tampil.

Provenance dipertahankan jujur: rumusan yang lahir dari draf AI tetap tersimpan
`sumber = AI` meski sudah disahkan, dan UI menampilkannya sebagai
*"draf AI · disahkan <Kaprodi> <tanggal>"*. Asesor berhak tahu, dan pengesahan
manusia adalah jawaban yang kuat — bukan sesuatu yang perlu disembunyikan.

---

## BAGIAN 3 — Alur & peran

```
StatusUsulan:  DRAF ──ajukan──► DIAJUKAN ──┬─ setuju ──► DISETUJUI ──terap──► DITERAPKAN
                  ▲                        ├─ revisi ──► DIREVISI ──┘(kembali ke pengusul)
                  └────────────────────────┴─ tolak ───► DITOLAK
                                            
StatusButir:   BARU · DITERIMA · DISESUAIKAN · DITOLAK
```

| Peran | Kewenangan |
|---|---|
| DOSEN / KOORDINATOR_MK | membuat, menyusun butir, meminta draf AI, mengajukan, menarik usulan sendiri |
| GPM | memberi catatan mutu pada usulan yang diajukan (tidak memblokir) |
| KAPRODI | memutuskan per butir, menetapkan TA berlaku, mengesahkan |
| ADMIN | sama seperti Kaprodi (pola yang sudah berlaku di aplikasi) |
| ASESOR | membaca usulan yang sudah diterapkan beserta dasarnya |

**Setuju sebagian adalah hal biasa.** Kaprodi memutuskan per butir; usulan berstatus
DISETUJUI bila minimal satu butir DITERIMA/DISESUAIKAN. Butir DITOLAK wajib
bercatatan — sama seperti `MIN_CATATAN_REVISI` pada `putuskanRpkps`.

**`DISETUJUI` dan `DITERAPKAN` sengaja dipisah.** Menyetujui adalah keputusan
akademik; menerapkan adalah mutasi pada sumber kebenaran, dan harus melewati
pratinjau dampak (§4) serta pemilihan TA berlaku. Kaprodi yang menekan keduanya,
tetapi ia melihat akibatnya sebelum menekan yang kedua.

---

## BAGIAN 4 — Pemeriksaan sebelum sahkan

Modul murni `src/domain/kurikulum/usulan.ts` (tanpa Prisma, tanpa React), memakai
ulang aturan yang sudah ada di `validator.ts` dan `perbaikan.ts`:

| Pemeriksaan | Menolak butir bila |
|---|---|
| Rujukan | MK / CPMK / Sub-CPMK yang disebut tidak ada di kurikulum |
| Kode baru | kode sudah dipakai, **termasuk oleh entitas yang sudah pensiun** (kode tidak boleh didaur ulang — nomor CPMK di dokumen lama harus tetap berarti satu hal) |
| Peta CPL | CPL tidak ada, atau ada tetapi tidak dibebankan pada MK itu |
| Rumusan | tanpa KKO, KKO tidak terukur, KKO ganda, atau terlalu pendek |
| Bloom | level Sub-CPMK melampaui level CPMK induknya |
| CPMK baru | tanpa Sub-CPMK, atau tanpa peta CPL |
| Pensiun | ia satu-satunya CPMK yang menjabarkan sebuah CPL pada MK itu → CPL jadi tak terjabarkan (`K-MK-CPL-TIDAK-DIJABARKAN`) |
| Dasar | butir tidak membawa satu pun dasar (§2.3) |

Di atasnya, **pratinjau dampak** (butuh Prisma, jadi di `src/lib/kurikulum/`):

```
┌─ Dampak penerapan · revisi 3 · berlaku 2026/2027-GANJIL ──────────┐
│ 2 CPMK diubah rumusannya · 1 Sub-CPMK baru · 1 Sub-CPMK pensiun   │
│                                                                    │
│ RPKPS terbit yang terdampak: 3                                     │
│   TI214 2025/2026-GENAP  · rumusan CPMK081 berubah                 │
│   TI214 2024/2025-GENAP  · rumusan CPMK081 berubah                 │
│   TI318 2025/2026-GANJIL · CPMK082 dipetakan ulang ke CPL04        │
│   → salinan beku & halaman publik TIDAK berubah                    │
│                                                                    │
│ Sub-CPMK yang dipensiunkan masih dirujuk:                          │
│   4 pertemuan · 1 tugas · 2 butir kisi-kisi (RPKPS berjalan)       │
│   → tetap utuh; tidak ditawarkan lagi mulai TA berlaku             │
└────────────────────────────────────────────────────────────────────┘
```

---

## BAGIAN 5 — Model data

Tambahan (nama tabel snake_case lewat `@@map`, seperti konvensi skema):

```prisma
enum StatusUsulan  { DRAF DIAJUKAN DIREVISI DISETUJUI DITOLAK DITERAPKAN DITARIK }
enum StatusButir   { BARU DITERIMA DISESUAIKAN DITOLAK }
enum JenisButir    { CPMK_BARU CPMK_RUMUSAN CPMK_PETA_CPL CPMK_PENSIUN
                     SUB_BARU SUB_RUMUSAN SUB_MINGGU SUB_PENSIUN CATATAN_CPL }
enum JenisDasar    { TEMUAN_VALIDATOR SINYAL_INDUSTRI MASUKAN_DUDI TRACER CATATAN_DOSEN }

UsulanRevisi    id, kurikulumId, mataKuliahId?, judul, latar, status,
                diajukanOlehId, diajukanPada?, diputuskanOlehId?, diputuskanPada?,
                catatanPemutus?, berlakuMulaiTaId?, diterapkanPada?
ButirUsulan     id, usulanId, urutan, jenis, status, catatanPemutus?,
                cpmkKode?, subCpmkKode?, rumusan?, rumusanEn?, levelBloom?, kko?,
                cplKode String[], mingguDisarankan Int[], alasan,
                sumber SumberIsi,           // KURIKULUM = manual, AI = draf model
                cpmkId?, subCpmkId?         // terisi setelah diterapkan → provenance
DasarButir      id, butirId, jenis JenisDasar, ref?, kutipan
RevisiKurikulum id, kurikulumId, revisiKe, usulanId, ringkasan,
                olehId, berlakuMulaiTaId, dibuatPada
```

Perubahan pada model yang sudah ada:

```prisma
Kurikulum  + revisi Int @default(0)
Cpmk       + pensiunSejakTaId String?   + butirUsulanId String?
SubCpmk    + pensiunSejakTaId String?   + butirUsulanId String?
```

`pensiunSejakTaId` null = aktif. Kueri penyusun RPKPS menyaring capaian yang sudah
pensiun terhadap tahun akademik RPKPS-nya; `proyeksiIsi` tidak berubah sama sekali
— sidik dokumen tetap dihitung dari capaian yang benar-benar dipakai dokumen itu.

---

## BAGIAN 6 — Antarmuka

| Titik masuk | Di mana |
|---|---|
| "Usulkan revisi" per CPMK/Sub-CPMK | halaman MK kurikulum (`/kurikulum/[id]/mk/[mkId]`) |
| "Usulkan revisi kurikulum" | langkah Verifikasi Capaian di penyusun RPKPS (janji 02 §3.3) |
| "Kirim sebagai Usulan Revisi" | temuan "di luar kewenangan" pada panel penyelarasan industri (fase AI-2b) |
| Menu **Usulan Revisi** | dengan lencana jumlah menunggu untuk KAPRODI/GPM |

Halaman usulan menampilkan tiap butir sebagai **perbandingan berdampingan**
(rumusan sekarang → rumusan usulan, dengan level Bloom dan KKO ditandai), disertai
alasan, dasar yang dapat diklik ke sumbernya, dan penanda asal (manual / draf AI).
Kaprodi menekan terima · sesuaikan · tolak per butir; "sesuaikan" membuka penyuntingan
rumusan sehingga keputusan akhir tetap kalimat Kaprodi.

Setelah diterapkan: kartu "Revisi ke-N · berlaku TA X" di halaman kurikulum, dan
riwayat revisi di halaman MK — bahan siap pakai untuk asesor yang bertanya
*"bagaimana kurikulum ini dijaga tetap mutakhir?"*.

---

## BAGIAN 7 — Fase kerja

| Fase | Isi | Status |
|---|---|---|
| **U1** | Model data, `domain/kurikulum/usulan.ts` + uji, alur usulan **manual** ujung ke ujung (buat → ajukan → putuskan per butir) | ✅ terpasang |
| **U2** | Penerapan: ledger revisi, pensiun berbasis TA, pratinjau dampak, penandaan RPKPS terdampak | ✅ terpasang |
| **U3** | Draf AI (`USULAN_REVISI` lewat gerbang yang ada), dari temuan validator & catatan dosen | belum |
| **U4** | Pemicu relevansi: usulan lahir dari sinyal industri / masukan DUDI / tracer | belum, bergantung AI-2b |

### Berkas yang menyusun U1–U2

| Berkas | Isi |
|---|---|
| `src/domain/kurikulum/usulan.ts` | Seluruh aturan. Murni: tanpa Prisma, tanpa React. Simulasi `terapkanKeInput` + selisih temuan `periksaAkibat` + `periksaJalurRalat` |
| `src/domain/kurikulum/usulan.test.ts` | 36 uji unit atas aturan di atas |
| `src/lib/kurikulum/usulan-inti.ts` | Lapisan basis data; klien Prisma diterima sebagai **parameter** agar penerapan dapat diuji integrasi |
| `src/lib/kurikulum/usulan.ts` | Pembungkus `server-only` yang mengikat inti ke klien aplikasi |
| `src/app/(app)/usulan/**` | Halaman daftar, pembuatan, dan keputusan; aksi server |
| `uji/integrasi.ts` §9 | Usul → putus → sahkan terhadap Postgres sungguhan, termasuk bukti pensiun tidak menghapus baris RPKPS |

U1–U2 sudah memberi nilai penuh tanpa AI sama sekali: pintu resmi yang selama ini
buntu jadi terbuka, dengan jejak audit. U3 mempercepatnya. U4 yang menjawab
"relevan dengan keadaan sekarang" secara berbasis bukti.

---

## BAGIAN 8 — Keputusan yang sudah ditetapkan

Ditetapkan 22 Agustus 2026:

1. **Pengesahan mandiri: boleh, tetapi ditandai.** Kaprodi dapat mengesahkan usulan
   yang ia ajukan sendiri — di prodi kecil ia sering satu-satunya yang berwenang.
   Log audit dan kartu revisi menyebutnya terang-terangan ("diajukan dan disahkan
   oleh orang yang sama"). Jangan hambat kerja, jangan sembunyikan fakta.
2. **TA berlaku: baku tahun akademik aktif berikutnya, ditambah jalur ralat.**
   Semester berjalan tidak boleh terganggu. Pengecualian tunggal adalah **ralat**:
   perbaikan ejaan atau salah ketik yang **tidak mengubah makna rumusan**, boleh
   berlaku segera. Kode menegakkan batas itu — sebuah butir hanya boleh ditandai
   ralat bila rumusannya lolos uji kesamaan makna (§4), dan alasannya tetap wajib.
3. **GPM: pemberi catatan, tidak memblokir.** GPM boleh membaca dan mencatat
   pertimbangan mutu pada usulan yang diajukan; Kaprodi tetap pemutus tunggal.
   Sejalan dengan pola `putuskanRpkps` yang sudah berlaku.
4. **Kuota AI: belum dibatasi.** Gerbang sudah mencatat pemakaian token di
   `log_audit`; pembatasan menyusul bila datanya menunjukkan perlu.
