# Tiga Tenggat dan Rantai Pengesahan

> Status: **P1–P4 TERPASANG (31 Agustus 2026).** Skema, domain murni + uji,
> kunci penyuntingan, dan empat aksi rantai sudah berjalan. P5–P7 (antrian per
> jalur dengan jaminan N hari, notifikasi minta paraf, halaman pengesahan DOCX
> terisi) belum.
> Menggantikan docs/10 §3 (satu tenggat) dan melengkapi docs/02 §1.1
> (Halaman Pengesahan) yang blok tanda tangannya sampai sekarang dicetak
> kosong lalu diisi tangan.

## BAGIAN 1 — Yang diminta, dan apa yang ternyata terlibat

Permintaannya tiga tenggat: **penyusunan**, **review**, **pengesahan**. Tetapi
tenggat hanya punya arti bila ada tahap yang ia batasi, dan di aplikasi ini
tahapnya belum ada. Hari ini keputusan Kaprodi menerbitkan dokumen seketika —
`putuskanRpkps` menulis `TERBIT` langsung (`src/app/[bahasa]/(app)/rpkps/aksi.ts:554`),
membekukan sidik di sana, dan Kepala Penjaminan Mutu tidak pernah disentuh
aplikasi sama sekali. Status `DISETUJUI` sudah ada di enum, sudah punya label
dan warna di dasbor, tetapi tidak pernah ditulis siapa pun.

Padahal halaman pengesahan ITTS sudah menyebut rantainya dengan jelas
(docs/02 §1.1), dan itu pula yang diminta:

```
a.n Tim penyusun RPKPS   →   Disetujui oleh,        →   Telah diperiksa dan dinyatakan
Koordinator Mata Kuliah      Ketua Program Studi        sesuai dengan standar ITTS
                                                        Kepala Penjaminan Mutu Internal
```

didahului kolom **Tanda Tangan** pada tabel Tim Dosen Pengampu — paraf tiap
dosen yang terlibat, sebelum koordinator menandatangani atas nama mereka.

Jadi pekerjaan ini dua hal yang saling mengunci:

1. **Rantai pengesahan** — empat cap berurutan, masing-masing punya pemilik.
2. **Tiga tenggat** — satu batas untuk tiap petak tanggung jawab di rantai itu.

Tenggat tanpa rantai akan mengukur sesuatu yang tidak ada (tidak ada "tahap
pengesahan" untuk dilewati). Rantai tanpa tenggat mengulang masalah yang sama:
dokumen menganggur di meja seseorang tanpa ada yang tahu sudah berapa lama.

---

## BAGIAN 2 — Rantai pengesahan

### 2.1 Empat cap, empat keadaan, empat pemilik

Tidak ada status baru. `DISETUJUI` yang selama ini menganggur akhirnya menjadi
keadaan yang sebenarnya: **sudah disetujui Kaprodi, belum disahkan Penjaminan
Mutu.**

| Keadaan | Artinya | Yang ditunggu | Tindakan yang membawanya ke sini |
|---|---|---|---|
| `DRAF` | sedang disusun; paraf tim dikumpulkan di sini | pengampu & koordinator | pembuatan |
| `DIAJUKAN` | koordinator menandatangani a.n tim penyusun | **Kaprodi** | `ajukanRpkps` |
| `DISETUJUI` | Kaprodi menandatangani "Disetujui oleh" | **Kepala Penjaminan Mutu** | `setujuiRpkps` |
| `TERBIT` | PMI menyatakan sesuai standar ITTS; sidik dibekukan; halaman publik hidup | — | `sahkanRpkps` |
| `DIREVISI` | dikembalikan — oleh Kaprodi **atau** oleh PMI | pengampu | `kembalikanRpkps` |

**Yang berubah paling tajam: `TERBIT` bukan lagi milik Kaprodi.** Menyetujui
dan mengesahkan dua perbuatan berbeda oleh dua jabatan berbeda, dan menyatukan
keduanya seperti sekarang berarti kolom ketiga pada halaman pengesahan
selamanya kosong — dokumen resmi yang menyatakan telah diperiksa Penjaminan
Mutu padahal Penjaminan Mutu tidak pernah membukanya.

`bekukanRpkps` ikut berpindah: dari `putuskanRpkps` ke `sahkanRpkps`. Salinan
beku adalah dokumen resmi, dan dokumen resmi lahir di cap terakhir.

### 2.2 Paraf tim mendahului pengajuan

Kolom **Tanda Tangan** pada tabel Tim Dosen Pengampu bukan hiasan: ia
pernyataan tiap pengampu bahwa dokumen ini benar-benar rencana yang akan ia
jalankan. Karena itu:

> **Koordinator baru dapat mengajukan setelah seluruh pengampu memberi paraf.**

Ditegakkan sebagai **temuan pemblokir pada validator** (`validasiRpkps`),
bukan sebagai penjagaan diam-diam di tombol. Alasannya sama dengan seluruh
temuan pemblokir lain: dosen harus melihat apa yang kurang di panel validasi,
bukan menemukan tombol yang mati tanpa keterangan.

Dua pelonggaran yang perlu, dan hanya dua:

- **Koordinator yang mengampu sendirian** memarafi dan mengajukan dalam satu
  tindakan — tidak ada orang lain yang ditunggu.
- **Paraf koordinator adalah pengajuan itu sendiri.** Ia tidak memaraf dua
  kali; menekan "Ajukan" menuliskan baris `KOORDINATOR` sekaligus.

Koordinator dapat menekan **"Minta paraf"** yang mengirim notifikasi ke
pengampu yang belum. Itu satu-satunya cara mendorong; tidak ada mekanisme
memaraf atas nama orang lain.

### 2.3 Isi harus terkunci selama rantai berjalan — celah yang wajib ditutup

Hari ini **tidak ada** yang mencegah penyuntingan RPKPS berstatus `DIAJUKAN`.
`ajukanRpkps` memeriksa status, tetapi `simpanIdentitas`, `simpanPertemuan`,
`simpanTugas`, dan `tulisKomponenNilai` hanya memeriksa wewenang — bukan
keadaan. Selama keputusan terjadi dalam hitungan menit hal itu tidak terasa.
Begitu ada rantai berisi tiga cap yang berjalan berhari-hari, ia menjadi cacat
serius: **Kaprodi menandatangani dokumen A, PMI mengesahkan dokumen B.**

Karena itu bagian dari pekerjaan ini adalah satu penjaga tunggal:

```
bolehSuntingIsi(status) = status === "DRAF" || status === "DIREVISI"
```

Diletakkan di `src/lib/rpkps/wenang.ts` — tempat yang sudah menjadi
satu-satunya rumah aturan wewenang atas sebuah RPKPS — dan dipanggil setiap
aksi penulisan isi. Bukan disalin ke tiap berkas aksi; itulah kesalahan yang
dulu melahirkan `wenang.ts`.

Aturannya sendiri ternyata sudah ada, disalin apa adanya di tiga berkas
(tugas, kisi-kisi, draf AI) dan **sama sekali tidak ada** di `rpkps/aksi.ts`.
Ketiganya kini memanggil `bolehSuntingIsi`, dan lima aksi yang selama ini
tanpa penjaga — identitas, baris mingguan, pustaka (tambah & hapus), komponen
nilai — ikut memakainya. Penolakannya menyebut alasan lewat `pesanTerkunci`,
bukan lagi "RPKPS sudah diajukan atau terbit" untuk semua keadaan.

Pengelolaan tim pengampu (`aksi-kelola.ts`) sengaja TIDAK ikut terkunci: ia
mengurus siapa pemegang dokumen, bukan isinya, dan serah terima koordinator
memang harus tetap mungkin pada dokumen yang sudah terbit (docs/06).

### 2.4 Yang ditandatangani adalah sidik, bukan tanggal

Tanda tangan yang tidak menyebut apa yang ditandatangani tidak membuktikan
apa-apa. Setiap baris tanda tangan menyimpan **sidik SHA-256 isi dokumen saat
itu**, dihitung dengan `sidikRpkps` yang sudah ada — fungsi yang sama yang
mencetak sidik pada dokumen terbit.

`sahkanRpkps` menghitung ulang sidik dan **menolak** bila berbeda dari yang
ditandatangani koordinator dan Kaprodi:

> "Isi dokumen berubah setelah ditandatangani. Kembalikan untuk revisi agar
> ditandatangani ulang."

Ketidakcocokan ini **bukan kasus hipotetis**. Setelah §2.3 menutup
penyuntingan, isi masih dapat bergeser dari arah lain: revisi kurikulum yang
berlaku di sela-sela rantai mengubah CPL/CPMK/Sub-CPMK yang ikut masuk
`proyeksiIsi`. Aplikasi ini sudah punya deteksinya (`periksaPergeseran` di
`src/lib/rpkps/snapshot.ts`); yang belum ada adalah tempat pemeriksaan itu
menghentikan sesuatu. Kini ada dua: `setujuiRpkps` dan `sahkanRpkps`, keduanya
lewat `periksaSidikCap`.

**Paraf pun gugur dengan cara yang sama, dan ini tidak ada di rancangan awal.**
Dokumen masih boleh disunting selama berstatus draf, jadi seorang pengampu
dapat memaraf rencananya, lalu rekan setimnya menggantinya, dan koordinator
mengajukan sesuatu yang tidak pernah disetujui siapa-siapa. Karena itu
`statusParaf` menerima `sidikSekarang`: paraf yang mencap isi yang sudah
berbeda **tidak dihitung**, dan orangnya kembali muncul di daftar "belum
memaraf". Memaraf ulang cukup menekan tombol yang sama. Yang parafnya masih
mencap isi berjalan tidak terganggu — hanya yang benar-benar berubah di
bawahnya yang ditanya ulang.

### 2.5 Dikembalikan berarti ronde baru; paraf gugur, tidak dihapus

Dikembalikan untuk revisi menaikkan `versi` — perilaku yang sudah berjalan
hari ini. Tanda tangan terikat pada `versi`, jadi kenaikan itu otomatis
**menggugurkan seluruh paraf ronde sebelumnya**: dokumen yang berubah harus
ditandatangani ulang oleh semua orang, termasuk yang parafnya sudah ada.

Barisnya **tidak dihapus**. Sejalan dengan aturan pensiun-bukan-hapus di
seluruh aplikasi ini, riwayat siapa menandatangani isi yang mana adalah
justru bagian yang paling berguna saat ada sengketa.

### 2.6 Model data

```prisma
enum PeranTtd {
  PENGAMPU        // kolom "Tanda Tangan" pada tabel Tim Dosen Pengampu
  KOORDINATOR     // "a.n Tim penyusun RPKPS"
  KAPRODI         // "Disetujui oleh,"
  PENJAMINAN_MUTU // "Telah diperiksa dan dinyatakan sesuai dengan standar ITTS"
}

model TandaTanganRpkps {
  id                 String   @id @default(cuid())
  rpkpsId            String   @map("rpkps_id")
  /// Ronde persetujuan. Ikut `rpkps.versi` saat ditandatangani; kenaikan
  /// versi menggugurkan seluruh tanda tangan ronde sebelumnya.
  versi              Int
  peran              PeranTtd
  penggunaId         String   @map("pengguna_id")
  /// Nama dan identitas SAAT menandatangani — dibekukan, sama alasannya
  /// dengan nama pengampu pada `rpkps_snapshot`: memperbarui nama yang sudah
  /// tercetak menggeser dokumen yang sudah resmi.
  nama               String
  identitas          String?  // NIDN / NIP / NIK saat itu
  /// Sidik isi yang ditandatangani. Inilah yang membuat tanda tangan berarti.
  sidik              String
  ditandatanganiPada DateTime @default(now()) @map("ditandatangani_pada")

  rpkps    Rpkps    @relation(fields: [rpkpsId], references: [id], onDelete: Cascade)
  pengguna Pengguna @relation(fields: [penggunaId], references: [id], onDelete: Restrict)

  @@unique([rpkpsId, versi, peran, penggunaId])
  @@index([rpkpsId, versi])
  @@map("tanda_tangan_rpkps")
}
```

`onDelete: Restrict` pada pengguna disengaja: pengguna yang pernah
menandatangani dokumen resmi tidak boleh lenyap dari basis data dan
meninggalkan tanda tangan tanpa penanda tangan.

Kolom `catatan` yang sempat dirancang di sini **dibuang saat implementasi**.
Pengembalian untuk revisi bukan tanda tangan; menulisnya sebagai baris
berperan `KAPRODI` membuat penolakan terbaca sebagai persetujuan oleh setiap
kode yang mencari cap Kaprodi pada ronde itu. Catatannya tetap di
`rpkps_riwayat`, tempatnya sejak dulu.

Tabel ini juga **menghapus kebutuhan kolom `diajukanPada`/`disetujuiPada`
pada `rpkps`**: waktu pengajuan adalah `ditandatanganiPada` baris
`KOORDINATOR` pada versi berjalan, waktu persetujuan adalah baris `KAPRODI`.
Dua sumber untuk satu fakta selalu berakhir dengan keduanya berbeda.

### 2.7 Siapa boleh menandatangani apa

| Cap | Syarat |
|---|---|
| `PENGAMPU` | terdaftar di `rpkps_pengampu` dokumen itu |
| `KOORDINATOR` | `wenang.koordinator` **dan** semua pengampu sudah memaraf **dan** validator lolos |
| `KAPRODI` | `punyaPeranDiProdi(sesi, prodiId, "KAPRODI")` — bukan sekadar `pengelola` |
| `PENJAMINAN_MUTU` | `punyaPeran(sesi, "GPM")` |

Perhatikan penyempitan pada baris ketiga. Hari ini `putuskanRpkps` menerima
`pengelola`, yang berarti ADMIN dan GPM juga boleh memutuskan. Untuk sebuah
tombol keputusan itu masuk akal; untuk sebuah **tanda tangan** tidak — kolom
itu berbunyi "Ketua Program Studi", dan yang menandatanganinya harus Ketua
Program Studi. ADMIN tetap dapat membaca, mengarsipkan, dan membetulkan data;
ADMIN tidak menandatangani.

Peran `GPM` boleh dipegang lebih dari satu orang, dan siapa pun pemegangnya
dapat mengesahkan — nama yang tercetak adalah nama yang benar-benar
menandatangani. Itu jawaban yang cukup untuk Kepala PMI yang sedang cuti,
tanpa perlu model pelaksana tugas tersendiri.

---

## BAGIAN 3 — Tiga tenggat

### 3.1 Satu dokumen, satu tenggat aktif, dan pemiliknya berpindah

Ini inti perubahannya. Tenggat bukan tiga penanda yang menyala bersamaan pada
satu dokumen; ia **satu penanda yang berpindah tangan** mengikuti keadaan:

| Keadaan | Tenggat yang berlaku | Pemiliknya |
|---|---|---|
| `DRAF`, `DIREVISI` | penyusunan | pengampu & koordinator |
| `DIAJUKAN` | review | Kaprodi |
| `DISETUJUI` | pengesahan | Kepala Penjaminan Mutu |
| `TERBIT`, `ARSIP` | — (`SELESAI`) | — |

Akibatnya `SELESAI` berganti makna. Hari ini "sudah diajukan" berarti tenggat
tidak lagi berlaku — benar dari sudut pandang dosen, tetapi itu justru
keadaan yang dulu menyembunyikan masalah sebenarnya: dokumen yang mengendap
sebulan di meja pemutus tampak "selesai" di setiap layar.

Aturan tampilannya: **lencana menampilkan tenggat aktif dokumen kepada siapa
pun yang membukanya** — itu keadaan dokumen, bukan rahasia — sementara
**antrian kerja hanya menaikkan kegentingan butir di jalur pembacanya
sendiri.** Dosen tidak perlu dibuat cemas oleh tenggat yang bukan miliknya.

### 3.2 Tanggal tetap, dengan jaminan N hari bagi pemutus

Tenggat penyusunan lugas: satu tanggal semester, sama untuk semua dokumen.

Tenggat review dan pengesahan tidak bisa begitu saja meniru bentuk itu.
Dokumen yang diajukan H-1 memberi Kaprodi waktu satu hari, dan tenggat yang
menyalahkan orang atas keterlambatan orang lain akan berhenti dipercaya pada
semester pertama. Karena itu:

```
batasReview     = terkemudian( tenggatReview,     ttdKoordinator + N hari )
batasPengesahan = terkemudian( tenggatPengesahan, ttdKaprodi     + N hari )
```

**N hari adalah lantai, bukan langit-langit.** Dokumen yang masuk jauh-jauh
hari tetap terikat tanggal semester — pemutus tidak mendapat perpanjangan
karena orang lain rajin. Dokumen yang masuk terlambat memberi pemutusnya N
hari penuh, dihitung sejak dokumen benar-benar sampai di mejanya.

Keterlambatan penyusunan tidak hilang karena ini: ia sudah tercatat pada
tahap penyusunan, terbaca di panel Kaprodi dan riwayat dokumen. Yang ditolak
hanyalah memindahkan tanggungannya ke orang berikutnya di rantai.

### 3.3 Kolom pada `tahun_akademik`

```prisma
/// Batas dosen mengajukan. Kelanjutan `tenggat_rpkps` — namanya diperjelas
/// karena sekarang ada tiga.
tenggatPenyusunan   DateTime? @map("tenggat_penyusunan")
/// Batas Kaprodi memutuskan dokumen yang sudah diajukan.
tenggatReview       DateTime? @map("tenggat_review")
/// Batas Penjaminan Mutu mengesahkan dokumen yang sudah disetujui.
tenggatPengesahan   DateTime? @map("tenggat_pengesahan")
/// Hari yang dijamin bagi pemutus, dihitung sejak dokumen sampai padanya.
jaminanHariPutusan  Int       @default(7) @map("jaminan_hari_putusan")
```

`tenggat_rpkps` berganti nama menjadi `tenggat_penyusunan` — migrasi ganti
nama, bukan kolom baru, sehingga tanggal yang sudah diisi Admin tidak hilang.

Ketiganya tetap **boleh kosong**, dan urutannya menaik
(`penyusunan ≤ review ≤ pengesahan`) diperiksa saat Admin menyimpan. Tenggat
review yang jatuh sebelum tenggat penyusunan menuntut Kaprodi memutuskan
dokumen yang belum boleh diajukan.

Satu angka `jaminanHariPutusan` untuk kedua tahap, bukan dua. Kalau ternyata
review dan pengesahan menuntut waktu yang berbeda, memecahnya nanti tidak
memerlukan pembongkaran apa pun.

### 3.4 Tetap lunak — seluruhnya

Sesuai docs/10 §3.2 dan sesuai keputusan yang diambil: **tidak satu pun dari
ketiga tenggat mengunci apa pun.** Lewat tenggat penyusunan, tombol Ajukan
tetap hidup. Lewat tenggat pengesahan, PMI tetap dapat mengesahkan. Yang
berubah hanya urutan, warna, dan kalimat.

Aturan keras milik validator. Tenggat adalah alat bantu perhatian, dan tenggat
yang mengunci akan melahirkan permintaan dispensasi administratif untuk hal
yang sebetulnya cukup diselesaikan.

### 3.5 Penilaiannya tetap murni

`src/domain/rpkps/tenggat.ts` diperluas, bukan diganti:

```ts
export type TahapTenggat = "PENYUSUNAN" | "REVIEW" | "PENGESAHAN" | "SELESAI";

/** Tahap mana yang sedang berjalan — murni dari status. */
export function tahapTenggat(status: StatusRingkasTenggat): TahapTenggat;

/** Batas efektif tahap berjalan, termasuk jaminan N hari. */
export function batasTahap(arg: {
  tahap: TahapTenggat;
  tenggat: { penyusunan: Date | null; review: Date | null; pengesahan: Date | null };
  sejak: Date | null;          // ttd koordinator / ttd kaprodi
  jaminanHari: number;
}): Date | null;

/** Tidak berubah bentuknya; menerima batas yang sudah dihitung. */
export function nilaiTenggat(arg: {
  batas: Date | null;
  sekarang: Date;
  tahap: TahapTenggat;
}): NilaiTenggat;   // { tahap, tingkat, hari, label }
```

`TingkatTenggat` (`LEWAT`/`DEKAT`/`AMAN`/`TIDAK_ADA`/`SELESAI`),
`AMBANG_DEKAT_HARI`, dan `bandingkanUrgensi` tidak berubah sama sekali.
Labelnya menyebut tahap — "review terlambat 3 hari", bukan "terlambat 3 hari"
— karena sebuah label tenggat yang tidak menyebut tenggat apa memaksa
pembacanya membuka dokumen hanya untuk tahu itu urusan siapa.

---

## BAGIAN 4 — Antrian, lencana, notifikasi

### 4.1 Antrian kerja

Dua butir baru, dan kegentingan tenggat kini per jalur:

| Kunci | Judul | Pemilik | Tenggat yang menaikkan |
|---|---|---|---|
| `rpkps-paraf` | "RPKPS menunggu paraf Anda" | pengampu | penyusunan |
| `rpkps-menunggu` | "RPKPS menunggu putusan Anda" *(sudah ada)* | Kaprodi | **review** |
| `rpkps-pengesahan` | "RPKPS menunggu pengesahan Anda" | GPM | **pengesahan** |
| `rpkps-draf`, `rpkps-dikembalikan` *(sudah ada)* | | pengampu | penyusunan |

`SumberAntrian.tenggat` yang tunggal menjadi tiga bidang, satu per jalur.
Nilainya adalah **yang terparah di jalur itu** — dibandingkan dengan
`bandingkanUrgensi` yang sudah ada — dan dihitung di basis data lewat satu
agregat `min(ditandatangani_pada)` per jalur, bukan dengan memuat seluruh
dokumen lalu menyaringnya di JavaScript. Kaprodi bercakupan prodi dan GPM
bercakupan institusi; daftar itu hanya bertambah panjang setiap semester.

`karenaTenggat` tidak berubah: menaikkan, tidak pernah menurunkan.

### 4.2 Notifikasi

docs/10 §2.1 menetapkan enam peristiwa, "tidak lebih". Rantai ini menambah
tiga, dan penambahannya perlu dibenarkan, bukan sekadar dilakukan:

| Jenis | Kapan | Penerima |
|---|---|---|
| `RPKPS_MINTA_PARAF` | koordinator menekan "Minta paraf" | pengampu yang belum memaraf |
| `RPKPS_MENUNGGU_PENGESAHAN` | Kaprodi menyetujui | pemegang peran GPM |
| `RPKPS_DISAHKAN` | PMI mengesahkan; dokumen jadi publik | seluruh pengampu + Kaprodi |

Alasannya: aturan "enam, tidak lebih" menjaga agar daftar tidak diencerkan
oleh kabar yang tidak menuntut perbuatan. Ketiganya justru sebaliknya —
masing-masing adalah **serah terima**, titik ketika seseorang mulai menjadi
penghambat orang lain tanpa mengetahuinya. Itulah keadaan yang sejak awal
menjadi alasan adanya notifikasi (docs/10, paragraf pembuka).

Satu kalimat lama berubah maknanya: `RPKPS_DISETUJUI` tidak lagi berarti
"diterbitkan" melainkan "disetujui Kaprodi, menunggu pengesahan Penjaminan
Mutu". Yang mengabarkan terbit sekarang `RPKPS_DISAHKAN`.

**Tidak ada notifikasi otomatis untuk tenggat yang terlewat.** Tenggat adalah
keadaan, bukan peristiwa (docs/10 §1); ia sudah terbaca di antrian dan
lencana. Notifikasi harian "masih terlambat" adalah cara tercepat melatih
orang mengabaikan lonceng.

---

## BAGIAN 5 — Dokumen tercetak dan halaman publik

Halaman pengesahan berhenti mencetak kotak kosong:

- **Kolom "Tanda Tangan"** pada tabel Tim Dosen Pengampu berisi tanggal paraf.
- **Tiga blok** terisi nama, jabatan, dan tanggal penanda tangan sebenarnya —
  bukan nama koordinator/Kaprodi hari ini, melainkan nama yang dibekukan di
  baris tanda tangan.
- Di bawah tiap blok: `Ditandatangani secara elektronik · a1b2c3d4 · e5f6g7h8`
  — sidik yang ditandatangani, dalam bentuk `sidikRingkas` yang sudah ada.
- Blok yang belum ditandatangani tetap kosong. Draf boleh dicetak; ia hanya
  belum sah, dan halaman yang kosong itulah yang mengatakannya.

Halaman publik (`src/lib/publik/muat.ts`) menampilkan ketiga pengesah beserta
tanggalnya. Aturannya tidak berubah: hanya `TERBIT`, hanya dari salinan beku.
Karena `TERBIT` sekarang lahir di cap terakhir, halaman publik dengan
sendirinya berarti "sudah lengkap tiga tanda tangan" — hari ini ia berarti
"Kaprodi menekan setuju".

**Dokumen lama tidak diberi tanda tangan susulan.** RPKPS yang sudah `TERBIT`
sebelum perubahan ini tetap terbit dengan blok kosong seperti sekarang.
Mengarang baris tanda tangan untuk orang yang tidak pernah menekan tombolnya
adalah hal yang justru dicegah oleh seluruh rancangan ini.

---

## BAGIAN 6 — Yang sengaja tidak dikerjakan

| | Alasan |
|---|---|
| Tanda tangan kriptografis / e-Meterai / PKI | Menuntut penyedia sertifikat, penyimpanan kunci, dan pencabutan. Yang dibutuhkan sekarang adalah **jejak yang dapat dipertanggungjawabkan**: siapa, kapan, atas isi bersidik apa — dan itu tercatat penuh. |
| Gambar tanda tangan pindaian | Berkas gambar yang dapat disalin ke dokumen mana pun justru lebih lemah daripada baris berstempel waktu, dan menuntut penyimpanan berkas yang belum ada. |
| Perpanjangan / dispensasi tenggat | Tenggat tidak mengunci apa pun (§3.4), jadi tidak ada yang perlu dibuka. |
| Notifikasi surel saat tenggat lewat | N5 di docs/10 masih ditunda; kanal luar menyusul di atas tabel `notifikasi` yang sama. |
| Pelaksana tugas / delegasi tanda tangan | Peran `GPM` dan `KAPRODI` sudah boleh dipegang lebih dari satu orang (§2.7). |
| Menandatangani dari halaman publik | Rantai ini seluruhnya di dalam aplikasi, di belakang sesi. |

---

## BAGIAN 7 — Tahapan pekerjaan

| | Isi | Berkas utama |
|---|---|---|
| **P1** ✅ | Migrasi: `tanda_tangan_rpkps` + `PeranTtd`, ganti nama `tenggat_rpkps` → `tenggat_penyusunan`, dua kolom tenggat baru, `jaminan_hari_putusan` | `prisma/schema.prisma`, `prisma/migrations/20260831000000_rantai_pengesahan_tenggat` |
| **P2** ✅ | Domain murni + uji: `tahapTenggat`, `batasTahap`, `nilaiTenggatDokumen`, `statusParaf`, `capRonde`; pemblokir `B-PARAF-BELUM-LENGKAP` | `src/domain/rpkps/{tenggat,paraf,validator}.ts` |
| **P3** ✅ | Kunci isi selama rantai berjalan: `bolehSuntingIsi` + `pesanTerkunci` di `wenang.ts`, dipanggil delapan aksi penulisan | `src/lib/rpkps/wenang.ts` + berkas aksi |
| **P4** ✅ | Aksi rantai: `parafPengampu`, `ajukanRpkps` (cap koordinator), `setujuiRpkps`, `sahkanRpkps` (memindahkan `bekukanRpkps`), `kembalikanRpkps` | `src/app/[bahasa]/(app)/rpkps/{aksi.ts,tombol.tsx,[id]/page.tsx}` |
| **P5** | Tenggat per jalur pada antrian (jaminan N hari lewat agregat `min(ditandatangani_pada)`), lencana tahap di daftar | `src/domain/dasbor/antrian.ts`, `src/lib/dasbor/muat.ts` |
| **P6** | Notifikasi `RPKPS_MINTA_PARAF` + tombol "Minta paraf" | `src/domain/notifikasi/pesan.ts` |
| **P7** | Halaman pengesahan DOCX terisi; panel pengesah di halaman publik | `src/lib/dokumen/rpkps-docx.ts`, `src/lib/publik/muat.ts` |

P1–P4 satu kesatuan: rantai yang setengah terpasang lebih buruk daripada satu
tombol yang jujur.

**Tiga hal ditarik maju dari P5/P6 karena tanpanya P1–P4 tidak jujur:**

1. **Tiga kolom tenggat di `/master/tahun-akademik`.** Tenggat review dan
   pengesahan yang tidak dapat diisi Admin sama saja dengan tidak ada.
2. **Butir antrian `rpkps-pengesahan`, dan pemilik butir `rpkps-menunggu`
   dipersempit ke Kaprodi.** Sejak menyetujui bukan lagi menerbitkan, butir
   "menunggu putusan Anda" yang tetap muncul bagi GPM dan ADMIN menunjuk
   pekerjaan yang tidak dapat mereka kerjakan.
3. **Dua notifikasi serah terima** — `RPKPS_MENUNGGU_PENGESAHAN` dan
   `RPKPS_DISAHKAN` — beserta kalimat `RPKPS_DISETUJUI` yang tidak lagi
   berbunyi "siap diterbitkan". Tanpa keduanya, Penjaminan Mutu tidak pernah
   tahu ada dokumen di mejanya, dan pengampu mengira dokumennya sudah resmi.

Ikut berubah di luar daftar: `periksaKelayakanArsip` dan `periksaKelayakanHapus`
kini menahan status `DISETUJUI` dengan alasan yang sama seperti `DIAJUKAN` —
mengarsipkan dokumen yang menunggu cap terakhir meninggalkan antrean pengesahan
yang tidak pernah dapat diselesaikan.

---

## BAGIAN 8 — Menerapkan migrasinya

Dua berkas migrasi, sengaja terpisah: PostgreSQL menolak PEMAKAIAN nilai enum
baru di dalam transaksi yang sama dengan `ALTER TYPE … ADD VALUE`, dan penerap
di `prisma/terapkan-migrasi.mts` membungkus satu berkas sebagai satu transaksi.

```
npm run db:migrate:pg
```

Dokumen yang sudah `TERBIT` sebelum migrasi ini tidak diberi tanda tangan
susulan; blok tanda tangannya tetap kosong seperti sebelumnya.

---

## BAGIAN 9 — Yang masih perlu dipastikan ke ITTS

1. **Apakah Kaprodi boleh mengesahkan RPKPS prodinya sendiri bila Kepala PMI
   tak kunjung bertindak?** Rancangan ini menjawab **tidak** — dan menyerahkan
   desakannya kepada tenggat serta antrian. Menambah jalan pintas berarti
   kolom ketiga halaman pengesahan berbohong.
2. **Berapa hari `jaminanHariPutusan`?** Diusulkan 7, sama dengan
   `AMBANG_DEKAT_HARI` yang sudah dipakai untuk "dekat".
3. **Apakah paraf pengampu wajib bagi RPKPS yang diampu banyak dosen lintas
   prodi?** Rancangan ini mewajibkan seluruh pengampu terdaftar, tanpa
   pengecualian selain koordinator tunggal (§2.2).
