# Notifikasi dan Tenggat Semester

> Status: **TERPASANG (N1–N4 30 Agustus 2026; N5 surel 4 September 2026).**
> Menjawab temuan: seluruh alur kerja aplikasi ini bersifat *tarik*. Kaprodi
> baru tahu ada RPKPS menunggu keputusan bila ia membuka dasbor; dosen yang
> dokumennya dikembalikan baru tahu saat masuk berikutnya. Untuk aplikasi yang
> beban kerjanya menumpuk pada dua minggu sebelum semester dimulai, itu adalah
> kekurangan operasional, bukan kekurangan tampilan.

## BAGIAN 1 — Dua hal yang berbeda

| | Notifikasi | Tenggat |
|---|---|---|
| Sifat | peristiwa; terjadi sekali | keadaan; berlaku sepanjang semester |
| Sumber | aksi seseorang | tanggal pada tahun akademik |
| Sasaran | satu orang tertentu | semua yang belum mengajukan |
| Bila diabaikan | tetap ada, menumpuk | makin merah |

Keduanya dikerjakan bersama karena menjawab satu pertanyaan yang sama —
*"apa yang menuntut perhatian saya, dan seberapa cepat?"* — dan keduanya
bermuara ke antrian kerja yang sudah ada di dasbor (docs/07).

## BAGIAN 2 — Notifikasi

### 2.1 Peristiwa yang layak mengganggu orang

Enam, tidak lebih. Daftar yang selalu penuh berhenti dibaca, dan yang berhenti
dibaca sama saja dengan tidak ada.

| Jenis | Kapan | Penerima |
|---|---|---|
| `RPKPS_DIAJUKAN` | dosen menekan "Ajukan" | Kaprodi prodi itu + GPM |
| `RPKPS_DISETUJUI` | Kaprodi menyetujui | seluruh pengampu |
| `RPKPS_DIREVISI` | Kaprodi mengembalikan | seluruh pengampu, **beserta catatannya** |
| `RPKPS_PENGAMPU` | ditambahkan ke tim / serah terima koordinator | orang yang ditunjuk |
| `USULAN_DIAJUKAN` | usulan revisi kurikulum diajukan | Kaprodi prodi itu + GPM |
| `USULAN_DIPUTUSKAN` | disahkan / dikembalikan / ditolak | pengusul |

**ADMIN sengaja tidak menerima apa-apa.** Cakupannya seluruh institusi, jadi ia
akan menerima setiap pengajuan dari setiap prodi. Antrian kerja di dasbor tetap
menampilkannya.

### 2.2 Tiga aturan pengiriman

Ditegakkan `kirimNotifikasi` di `src/lib/notifikasi/kirim.ts`:

1. **Pelaku tidak dikabari perbuatannya sendiri.** Kaprodi yang baru menekan
   "setujui" tidak perlu diberi tahu bahwa dokumen itu disetujui.
2. **Gagal mengirim tidak menggagalkan pekerjaan.** Notifikasi adalah layanan
   tambahan di atas aksi yang sudah berhasil — polanya sama dengan pencatatan
   pemakaian AI di `lib/ai/gerbang.ts`.
3. **Pengiriman di LUAR transaksi aksi.** Kabar tentang perubahan yang kemudian
   dibatalkan lebih buruk daripada tidak ada kabar.

### 2.3 Kalimatnya murni

`susunNotifikasi` (`src/domain/notifikasi/pesan.ts`) menyusun judul dan
ringkasan dari peristiwa, tanpa menyentuh basis data. Setiap kalimat menyebut
tiga hal: **apa yang terjadi, pada dokumen mana, oleh siapa** — karena
notifikasi dibaca sekilas, dan judul kabur ("RPKPS diperbarui") memaksa orang
membuka halaman hanya untuk mencari tahu apa yang terjadi.

Catatan revisi ikut terbawa, dipotong 160 karakter. Catatan itulah isi
keputusannya; tanpa itu penerima harus membuka dokumen untuk tahu apa yang
salah.

### 2.4 Bukan `log_audit`

`log_audit` adalah catatan resmi: tidak dialamatkan kepada siapa pun, tidak
pernah dihapus, dan dibaca saat menelusuri kejadian. `notifikasi` dialamatkan,
boleh basi, dan ditandai terbaca. Keduanya tetap ditulis untuk peristiwa yang
sama, dan itu bukan duplikasi.

### 2.5 N5 — surel, di atas tabel `notifikasi` yang sama

**Terpasang 4 September 2026.** Ketiga syarat yang dulu menundanya —
kredensial layanan luar, antrian kirim, dan penanganan gagal-kirim yang
berumur panjang — sekarang ada. WhatsApp tetap tidak ada.

Kanalnya **SMTP Gmail**, karena surel kampus ITTS berjalan di Google. Yang
dibutuhkan hanya satu akun pengirim beserta App Password-nya; bila kuota
harian kelak tidak cukup, host diganti ke `smtp-relay.gmail.com` tanpa satu
baris kode pun berubah. Rinciannya di `.env.example`.

#### Antriannya menumpang, bukan tabel tersendiri

Sesuai janji paragraf lama: "kanal luar menyusul di atas tabel `notifikasi`
yang sama". Lima kolom bertambah pada `notifikasi` (`surel_status`,
`surel_percobaan`, `surel_kirim_setelah`, `surel_terkirim_pada`,
`surel_galat`), bukan tabel outbox baru. Dua tabel yang harus tetap sejalan
hanya menambah satu tempat lagi untuk menyimpang — dan yang dikirim memang
notifikasi yang sama.

Kolomnya berbawaan `DILEWATI`, bukan `MENUNGGU`. Seluruh baris yang sudah ada
ditulis sebelum kanal ini ada, dan menyalakan migrasinya tidak boleh
mengirimkan surel untuk peristiwa berbulan-bulan lalu.

#### Kalimatnya dirakit saat DIKIRIM

Bukan saat ditulis. Sebuah notifikasi ditulis sekali dan dikirim beberapa menit
kemudian, kepada orang yang boleh berbahasa lain dari pelakunya — jadi bahasa
yang berlaku adalah bahasa PENERIMA (`pengguna.bahasa`), persis seperti saat
dibaca di layar (docs/11 §4.2). Sampulnya (`kamus.surel`) hanya sapaan, ajakan
membuka, dan cara berhenti; isinya tetap `pesanNotifikasi` yang sama.

#### Kelayakan diputuskan dua kali

Saat menulis, dan sekali lagi saat menguras. Yang pertama menghormati
preferensi orang **pada saat peristiwa terjadi**; yang kedua menangkap orang
yang mematikan surelnya atau dinonaktifkan di antara keduanya. Syaratnya empat
dan tidak satu pun boleh dilewati: kanal menyala, orangnya belum menolak,
alamatnya berbentuk alamat, dan akunnya masih `AKTIF`.

#### Gagal kirim tidak menghilangkan kabarnya

Lima percobaan dengan jeda menaik — 1 menit, 5, 25, 2 jam, 10 jam — lalu
`GAGAL`. **Notifikasi dalam aplikasinya tetap ada apa pun yang terjadi**;
surel adalah lapisan tambahan di atasnya, bukan penggantinya. Jeda yang menaik
tajam melayani dua bentuk kegagalan SMTP sekaligus: gangguan sesaat yang pulih
dalam hitungan menit, dan kredensial atau kuota yang tidak akan pulih sampai
ada manusia yang menyentuhnya.

#### Yang menguras adalah penjadwal, bukan pengguna

`POST /api/surel/kirim`, dijaga `SUREL_CRON_RAHASIA` dengan perbandingan
`timingSafeEqual`. Mengirim surel di dalam jalur aksi berarti dosen menunggu
jabat tangan SMTP sebelum tombolnya merespons, dan satu gangguan pada penyedia
surel menggagalkan pengajuan RPKPS yang sebenarnya sudah tersimpan.

Rutenya melayani dua cara pemasangan tanpa perubahan kode: cron platform, atau
satu baris `curl` di crontab server kampus. Tanpa rahasia yang disetel, rute
itu menolak SEMUA permintaan — rute penguras tanpa penjaga dapat dipakai siapa
pun untuk menghabiskan kuota kirim harian.

#### Kredensialnya hidup di satu berkas

`src/lib/surel/pengirim.ts`, dan tidak boleh dibaca dari tempat lain — alasan
yang sama dengan `src/lib/ai/kredensial.ts`. Sandi tidak pernah masuk log
maupun kolom `surel_galat`: pesan bawaan beberapa server SMTP menyertakan nama
akun pengirim, jadi `ringkasGalat` menyamarkannya lebih dulu. Sekali sebuah
sandi tertulis ke basis data, ia ada di cadangannya selamanya. Penjaganya
`src/lib/surel/rahasia.test.ts`.

#### Yang TIDAK dikerjakan

Tetap tidak ada notifikasi tenggat lewat surel. Tenggat adalah keadaan, bukan
peristiwa (§1), dan surel harian "masih terlambat" adalah cara tercepat melatih
orang memasang penyaring.

## BAGIAN 3 — Tenggat

### 3.1 Satu tanggal per semester

`tahun_akademik.tenggat_rpkps`, diatur Admin di `/master/tahun-akademik`.
Bukan per RPKPS: yang berlaku adalah satu batas untuk seluruh dokumen semester
itu, dan menyalinnya ke tiap baris hanya melahirkan angka yang berbeda-beda
tanpa alasan.

### 3.2 Tenggat tidak mengunci apa pun

Melewatinya **tidak** menutup penyuntingan dan **tidak** menolak pengajuan.
Yang berubah hanya urutan dan warna. Aturan keras milik validator; tenggat
adalah alat bantu perhatian, dan mengubahnya menjadi penghalang akan memaksa
orang meminta pengecualian administratif untuk hal yang seharusnya cukup
diselesaikan.

### 3.3 Penilaiannya murni

`nilaiTenggat` (`src/domain/rpkps/tenggat.ts`) → `LEWAT`, `DEKAT` (≤ 7 hari),
`AMAN`, `TIDAK_ADA`, atau `SELESAI`. RPKPS yang sudah diajukan berstatus
`SELESAI` walau tanggalnya lewat: bagian dosen sudah selesai, dan desakan
berpindah ke pemutus. Yang dikembalikan untuk revisi kembali terikat.

### 3.4 Tampilannya diam saat tenang

`LencanaTenggat` tidak menampilkan apa pun untuk `AMAN`, `TIDAK_ADA`, dan
`SELESAI`. Penanda yang selalu muncul berhenti dibaca justru saat ia
dibutuhkan.

Di antrian kerja, tenggat **menaikkan** kegentingan dua butir milik dosen —
"masih draf" dan "dikembalikan untuk direvisi" — dan tidak pernah
menurunkannya (`karenaTenggat` di `src/domain/dasbor/antrian.ts`).

## BAGIAN 4 — Yang terpasang

| | Isi | Berkas |
|---|---|---|
| **N1** | Model `notifikasi` + enum, kolom `tenggat_rpkps` | `prisma/migrations/20260830000000_notifikasi_tenggat` |
| **N2** | Kalimat notifikasi & penilaian tenggat (murni + teruji) | `src/domain/notifikasi/pesan.ts`, `src/domain/rpkps/tenggat.ts` |
| **N3** | Pengiriman, penerima, pembacaan | `src/lib/notifikasi/{kirim,muat}.ts` |
| **N4** | Halaman `/notifikasi`, lencana pada rel menu, kolom tenggat di master, isyarat di dasbor dan daftar RPKPS | `src/app/(app)/notifikasi/`, `src/components/lencana-tenggat.tsx` |
| **N5** ✅ | Kanal surel (SMTP Gmail, antrian di atas tabel `notifikasi`, penguras berjadwal) | 4 September 2026 |
