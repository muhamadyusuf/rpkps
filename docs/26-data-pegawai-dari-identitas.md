# Data pegawai dari identitas-itts — RPKPS tidak menyimpan data pegawai

Status: **terpasang** (2026-09-25), kecuali kontraksi kolom lama (§7), yang dijalankan pengguna.
Melanjutkan `docs/25` (masuk tunggal) dan `docs/24` (pelaporan aktivitas). Sisi penyedia:
`identitas-itts/docs/07-api-pegawai.md`.

## 1. Apa yang berubah

identitas-itts adalah **sumber kebenaran pegawai** (Pegawai, jabatan, penempatan, pemetaan peran).
RPKPS sebelumnya menyimpan salinannya di tabel `pengguna` dan mengatur peran dengan tangan di
`/pengguna`. Kini:

| | Sebelum | Sesudah |
|---|---|---|
| Nama, gelar, NIDN, NIP pegawai | kolom `pengguna` (disalin, diisi tangan) | **dibaca dari identitas-itts** saat dibutuhkan |
| NIK, telepon, foto | kolom `pengguna` | **tidak diambil sama sekali** (tak pernah keluar dari identitas-itts) |
| Peran DOSEN/KAPRODI/GPM/ADMIN | diberikan admin di `/pengguna` | **diturunkan dari jabatan**, disimpan sebagai proyeksi tersinkron |
| Setiap dosen aktif | harus didaftarkan + diberi peran | otomatis **DOSEN** di prodi homebase-nya |
| Asesor, mahasiswa | dibuat admin, tanpa gerbang | tetap dibuat admin di RPKPS (profil minimal lokal), **tak lewat gerbang kepegawaian** |
| Yang disimpan di `pengguna` | semuanya | kunci `identitas_akun_id`, surel, pengaturan RPKPS (bahasa, notifikasi, status), dan `nama` **hanya** untuk pengguna lokal |

Yang **sengaja tidak berubah**: isi dokumen terbit. `rpkps_snapshot.isi`, `tanda_tangan_rpkps.nama/identitas`,
dan `rpkps_riwayat` membekukan nama dan NIDN pada saat kejadian (§8).

## 2. Peta komponen

```
identitas-itts  /api/v1/pegawai (batch ≤100)   /cari   /direktori   status-pegawai   peran-aplikasi
      ▲  Basic client:secret, cakupan kepegawaian.read
      │
src/lib/identitas/klien.ts        ambilDariIdentitas — batas waktu 8 dtk, tanpa cache HTTP, galat berjenis
src/lib/identitas/pegawai.ts      ambilProfil / wajibProfil / cariPegawai — cache memori, batch, dedupe
src/lib/identitas/status.ts       gerbang kepegawaian saat masuk (+ fakta untuk sinkron)
src/lib/identitas/sinkron*.ts     proyeksi peran → penugasan_peran (sinkron-inti.ts diuji di PGlite)
src/domain/identitas/*            murni & diuji: kontrak (validator jawaban), peran, tampilan, cache
src/lib/pengguna/tampilan.ts      tampilanDariRujukan / wajibTampilan / pencariNama — dipakai halaman & aksi
src/lib/rpkps/muat.ts             muatRpkps menghidrasi pengampu dari identitas-itts
```

Jawaban jaringan adalah **data tak tepercaya**: `domain/identitas/kontrak.ts` memeriksa bentuknya tanpa
`as`, dan baris cacat dibuang atau seluruh jawaban ditolak — tidak pernah diteruskan setengah jalan ke
keputusan wewenang.

## 3. Dua jenis pengguna

- **Pegawai** — `pengguna.identitas_akun_id` terisi (= `Akun.id` di identitas-itts). Wajib lolos gerbang
  kepegawaian saat masuk (terdaftar dan aktif). Nama/NIDN/NIP dibaca dari sana; perannya dari jabatan.
- **LOKAL** — `identitas_akun_id` null: asesor eksternal, mahasiswa, dan admin bootstrap (`ADMIN_AWAL`).
  Hanya `nama` + surel tersimpan di RPKPS.

Aturan gerbang untuk pengguna LOKAL (`bolehLewatGerbangLokal`, `domain/identitas/peran.ts`): **tak bertaut,
AKTIF, dan seluruh perannya (minimal satu) hanya ASESOR/MAHASISWA**. Ciri terakhir yang membedakan asesor
eksternal dari pegawai lama yang barisnya belum ditautkan — pegawai lama itu memegang DOSEN/KAPRODI/GPM/ADMIN,
jadi tetap wajib lolos gerbang; kalau tidak, gerbang kepegawaian kehilangan arti. Admin bootstrap
dikecualikan tersendiri (akun "pecah kaca").

Menambah pengguna di `/pengguna` (Admin):

- **Pegawai** — cari di identitas-itts (`/api/v1/pegawai/cari`), pilih, tambahkan. Baris dibuat dengan
  kuncinya, lalu perannya langsung diturunkan (`sinkronkanPengguna`). Pegawai tanpa jabatan terpetakan tetap
  `MENUNGGU_VERIFIKASI` sampai diberi peran lokal.
- **Asesor / mahasiswa** — formulir nama + surel + peran (hanya ASESOR/MAHASISWA; peran lain membuat orangnya
  tak dapat masuk, `peranLokalBoleh`). Surel yang ternyata pegawai di identitas-itts ditolak: tambahkan lewat pemilih.
- **Impor Excel** hanya untuk ASESOR/MAHASISWA; baris berperan pegawai ditolak di `rakitPenggunaImpor` dan
  diperiksa ulang di server (`simpanImporPengguna`).

Edit profil pegawai **dihapus**: nama, gelar, NIDN, NIP diubah di identitas-itts (halaman detail menautkannya).
Pengguna LOKAL hanya dapat diubah namanya.

## 4. Membaca data pegawai

Pola yang wajib diikuti kode baru:

1. Kueri Prisma memilih baris `pengguna` dengan **`PILIH_RUJUKAN_PENGGUNA`** (`id, email, nama, identitasAkunId`) —
   bukan `nama/gelar/nidn/nip` sebagai data pegawai.
2. Kumpulkan **semua** rujukan yang dibutuhkan halaman/aksi itu, lalu panggil `tampilanDariRujukan` (atau
   `pencariNama`) **sekali** — satu panggilan batch ke identitas-itts, bukan N.
3. Pakai `Map<penggunaId, Tampilan>`: `{nama, gelarDepan, gelarBelakang, namaLengkap, nidn, nip, sumber}`.

`sumber` = `IDENTITAS` (dari identitas-itts), `LOKAL` (kolom `nama`), atau `TAK_DIKETAHUI` (pegawai yang tak dapat
dibaca: nama darurat dari bagian depan surel). Nama lokal **tidak** dipakai sebagai cadangan pegawai: data usang tak
boleh tampak sah.

**Cache** (`lib/identitas/pegawai.ts`): segar 10 menit; basi ≤24 jam dan hanya dipakai bila identitas-itts tak
terjangkau; maks 5000 entri; permintaan serentak atas kunci yang sama menunggu satu panggilan; jawaban "bukan
pegawai" diingat 60 detik. Batch ≤100 per panggilan, karena tiap panggilan membayar `bcrypt` klien (±60–100 ms).
`ambilProfil` **tidak pernah melempar** — halaman tetap terbuka saat identitas-itts padam.

**Operasi hukum** — tanda tangan (paraf/ajukan/setujui/sahkan), pembekuan snapshot, penutupan evaluasi, serah
terima koordinator, riwayat: hanya data **segar**, dan bila tak dapat dipastikan operasinya **ditolak**
(`ProfilTidakTersedia`, gagal-tertutup), bukan dilanjutkan dengan tebakan.
Pintunya `wajibTampilan`/`wajibTampilanDariRujukan`/`wajibPencariNama`, dan `muatRpkps(id, { segar: true })`
(`muatDenganSidik` di `rpkps/aksi.ts` selalu memakainya). Cap tanda tangan dibaca dari profil segar penanda tangan
(`capPenandaTangan`), bukan dari sesi.

**Hidrasi pengampu**: `muatRpkps` mengisi `pengampu[i].pengguna` dengan bentuk lama
`{id, nama, gelarDepan, gelarBelakang, nidn, nip}` dari identitas-itts. Bentuknya sama, jadi seluruh konsumen
hilir (`keRpkpsInput`, `proyeksiIsi`, naskah, `.docx`) tak berubah. Hasil yang pengampunya bernama darurat ditandai
(`dataPengampuTakPasti`, WeakSet — tidak ikut terserialisasi ke snapshot); halaman RPKPS dan pratinjau lalu
menampilkan peringatan dan **tidak** menuduh "dokumen bergeser".

**Audit memakai surel, bukan nama**: `log_audit.ringkasan` baru menyebut surel pelaku. Baris lama tak disentuh.

**Sesi**: `PenggunaSesi.nama/namaLengkap/nidn/nip` dihidrasi dari identitas-itts (tak pernah melempar; darurat =
surel). Foto tidak disimpan maupun ditampilkan (avatar = inisial).

## 5. Peran dari jabatan

Pemetaan (di identitas-itts, `namaPeran` berawalan `rpkps:`; sisi RPKPS di `domain/identitas/peran.ts`):

| Sumber di identitas-itts | Peran RPKPS |
|---|---|
| `rpkps:admin` | ADMIN (institusi) |
| `rpkps:gpm` | GPM (institusi) |
| `rpkps:kaprodi` — jabatan di unit jenis PRODI | KAPRODI di prodi yang dipetakan dari unit itu |
| `jenisPegawai = DOSEN` + homebase | DOSEN di prodi yang dipetakan dari homebase |

Tidak dipetakan (tetap milik RPKPS): KOORDINATOR_MK (penetapan per mata kuliah), ASESOR, MAHASISWA.

**Gagal-tertutup pada prodi**: di RPKPS `prodiId = null` berarti cakupan **institusi**, dan `DOSEN` termasuk
`PERAN_PENGUSUL`. Karena itu peran yang butuh prodi **tidak diberikan sama sekali** bila unitnya belum dipetakan
ke prodi — bukan diberikan dengan `null` (yang membuat dosen dapat mengusulkan revisi di semua prodi).
Pemetaan unit ↔ prodi: `prodi.identitas_unit_id` (unik), diisi skrip pengisian (§6) atau Admin di
`/master/prodi/[id]` → kartu "Pemetaan ke identitas-itts".

**Proyeksi**: `penugasan_peran.sumber` = `LOKAL` (dibuat admin) atau `IDENTITAS` (dihasilkan sinkron). Sinkron hanya
mengubah baris `IDENTITAS`:

- diinginkan tapi belum ada → dibuat `IDENTITAS`; sudah ada sebagai `LOKAL` → **dipromosikan** (tanpa baris ganda);
- `IDENTITAS` yang tak lagi dikehendaki → dihapus;
- `LOKAL` peran turunan yang tak didukung identitas-itts → **dilaporkan, tidak dihapus** (keadaan peralihan yang
  sah; menghapusnya diam-diam mengunci orang). Baru dihapus bila `SINKRON_HAPUS_LOKAL=1`; admin bootstrap
  selalu dilindungi;
- `KOORDINATOR_MK`, `ASESOR`, `MAHASISWA` tak pernah disentuh.

Status pengguna setelah sinkron (`statusSetelahSinkron`): pegawai nonaktif → `NONAKTIF`; `MENUNGGU_VERIFIKASI`
→ `AKTIF` begitu punya peran. **`NONAKTIF` tak pernah diaktifkan kembali oleh sinkron** — sinkron tak dapat
membedakan penonaktifan oleh admin RPKPS dari akibat identitas-itts; mengaktifkan kembali = tindakan admin.

**Pagar penghapusan massal** (`pagarPenghapusan`): sinkron menyeluruh yang akan mencabut lebih dari
`max(5, 25% peran turunan yang ada)` **ditolak seluruhnya** (tak satu baris pun berubah); direktori kosong padahal
ada yang bertaut juga ditolak. identitas-itts yang keliru (pemetaan terhapus, jabatan kosong tak sengaja) tak boleh
menjadi pencabutan serentak.

**Tiga pemicu** (kegagalan tak pernah menggagalkan login atau halaman — peran yang ada dipertahankan):

1. **Saat masuk** — `sinkronkanSaatMasuk`, memakai fakta yang sudah dipegang gerbang: peran siap sebelum
   halaman pertama.
2. **Malar** — `jadwalkanSinkron` dari `sesiSaatIni`: bila sinkron terakhir > 15 menit, disegarkan di belakang layar
   (`after`) tanpa menahan halaman.
3. **Menyeluruh** — `sinkronkanSemua`: tombol admin "Sinkronkan sekarang" di `/pengguna`, dan rute
   `GET|POST /api/identitas/sinkron-peran` (Bearer `CRON_SECRET`; 502 bila identitas-itts gagal). Ia juga
   membuatkan cangkang `pengguna` untuk dosen aktif yang belum pernah membuka RPKPS, dan melaporkan unit yang belum
   dipetakan. **`vercel.json` tidak diubah**: cron harian opsional — tambahkan sendiri bila paketnya mengizinkan;
   tanpa itu, sinkron saat masuk + malar + tombol sudah menutup kebutuhan.

## 6. Penerapan (urut) dan penjaga

Migrasi `20260925000000_rujukan_identitas` **hanya menambah** (tak ada yang dibuang): aman didahulukan dan aman
dibatalkan dengan men-deploy versi lama. Kode RPKPS baru memilih kolom barunya, jadi migrasi **harus** diterapkan
**sebelum** kode baru berjalan.

1. Deploy identitas-itts (API `/api/v1/pegawai*`, status-pegawai & peran-aplikasi yang diperluas).
2. Di identitas-itts `/klien` → klien `rpkps` → Ubah: tambahkan cakupan **`kepegawaian.read`** (tanpa itu jawabannya
   403 dengan petunjuk). Pastikan jabatan yang relevan punya pemetaan peran `rpkps:kaprodi` / `rpkps:gpm` / `rpkps:admin`.
3. **Cadangkan Neon** (`DATABASE_URL` RPKPS menunjuk **produksi**).
4. `npm run db:migrate:pg` — menerapkan migrasi expand.
5. `npx tsx prisma/isi-rujukan-identitas.ts` (LAPORAN, tidak menulis). Baca: pengguna tanpa pasangan (asesor/mahasiswa
   memang lokal; **DOSEN/KAPRODI/GPM/ADMIN tanpa pasangan harus didaftarkan di identitas-itts atau diperbaiki
   surelnya sebelum deploy**), **selisih nama/NIDN** pengampu dokumen berjalan/terbit (§8), dan usulan pemetaan
   prodi. Bila sudah benar: `--terapkan`. Prodi yang tak dapat dipastikan dipetakan tangan di `/master/prodi/[id]`.
6. Deploy RPKPS. Masuk sekali sebagai Admin, lalu `/pengguna` → **Sinkronkan sekarang**; periksa pesannya
   (unit yang belum dipetakan disebut di sana).
7. Verifikasi (§9). Kontraksi (§7) menyusul, **tidak** dalam langkah ini.

Variabel: `IDENTITAS_ITTS_URL`, `_CLIENT_ID`, `_CLIENT_SECRET` (sudah ada dari docs/25), `CRON_SECRET` (bila memakai
cron), `SINKRON_HAPUS_LOKAL` (bawaan mati).

**Penjaga "RPKPS tanpa data pegawai"** — `uji/periksa-tanpa-data-pegawai.mts` memakai **kompilator**, bukan
pencarian teks: ia menyalin skema tanpa tujuh kolom pribadi (`gelar_depan, gelar_belakang, nidn, nip, nik, telepon,
foto_url`), menghasilkan klien Prisma ke folder sementara, lalu menjalankan `tsc` dengannya — setiap baris yang
masih membaca/menulis kolom itu menjadi galat, persis keadaan setelah kontraksi. Dijalankan `npm run
periksa:tanpa-pegawai` dan sebagai langkah terakhir `npm run test:integrasi`. Bendera `--nama` juga menandai
`nama` (daftar kerja penuh; penulisan `nama` untuk pengguna lokal memang sah). Kode baru **tidak boleh** membaca
kolom itu dari `Pengguna`; satu-satunya pengecualian adalah skrip pengisian (§6 langkah 5), yang membacanya lewat
SQL mentah karena kolomnya akan dibuang.

## 7. Kontraksi (M5) — dijalankan PENGGUNA

Membuang kolom pribadi dari `pengguna`. **Menghapus data dan tak dapat dibatalkan.** Ditunda sampai deploy §6
berjalan cukup lama dan laporan pengisian bersih; sementara itu kolom lama tetap ada (dan tak lagi dibaca/ditulis
untuk pegawai) sehingga rollback = men-deploy versi lama.

Runbook:

1. Prasyarat: §6 selesai; `npm run periksa:tanpa-pegawai` ✔; tak ada pengguna berperan pegawai yang tak bertaut.
2. **Cadangkan Neon** (branch atau snapshot).
3. Di `prisma/schema.prisma` hapus dari model `Pengguna`: `gelarDepan`, `gelarBelakang`, `nidn`, `nip`, `nik`,
   `telepon`, `fotoUrl`. **Pertahankan `nama`** (dipakai pengguna lokal). Perbarui komentar `identitasAkunId`.
4. `npx prisma generate`, lalu `npx tsc --noEmit`, `npm test`, `npm run test:integrasi` — semuanya harus lulus.
5. Deploy kode ini **lebih dulu**: klien yang dihasilkan tak lagi memilih kolom lama, sehingga aman ditinggal di
   basis data. Membuang kolom sebelum deploy mematahkan kode lama yang masih memilihnya.
6. Salin `prisma/kontraksi/buang_data_pegawai.sql` menjadi `prisma/migrations/<stempel>_buang_data_pegawai/migration.sql`,
   lalu `npm run db:migrate:pg`. SQL-nya satu transaksi: mengganti `nama` pegawai bertaut menjadi penampung dari
   surel, lalu membuang tujuh kolom (indeks unik nidn/nip/nik ikut lenyap).
7. Verifikasi: masuk, `/pengguna`, satu RPKPS terbit, unduh `.docx`.

Yang **tidak** disentuh: `rpkps_snapshot.isi`, `tanda_tangan_rpkps.nama/identitas`, `rpkps_riwayat.data`,
`log_audit.ringkasan` — catatan permanen yang memang menyimpan nama sebagai bukti.

## 8. Konsekuensi yang diketahui

- **Nama pada catatan permanen dibekukan.** Snapshot terbit, tanda tangan, dan riwayat memuat nama/NIDN saat
  kejadian. Pegawai yang kelak ganti nama atau gelar tidak mengubah dokumen yang sudah bertanda tangan.
- **Sidik dan nama.** `proyeksiIsi()` memakai `pengampu[].nama` (tanpa gelar) dan `nidn`. Karena kini dibaca dari
  identitas-itts, **mengoreksi nama/NIDN di identitas-itts menggeser sidik** dokumen yang pengampunya orang itu —
  sama seperti dulu mengubah nama di `/pengguna`. Dokumen TERBIT lalu menampilkan "dokumen bergeser" (bentuk
  `proyeksiIsi` tak diubah). Skrip pengisian melaporkan selisih yang sudah ada **sebelum** deploy; setelahnya,
  koreksi nama pengampu dokumen terbit adalah keputusan yang memang mengubah dokumen.
- **Format nama kanonik** identitas-itts: `Dr. Nama, M.Kom.` (`gabungNama`; gelar belakang berkoma lama tak
  digandakan komanya). Nama pada `tanda_tangan_rpkps` baru memakainya.
- **identitas-itts padam**: halaman tetap terbuka dengan cache (≤24 jam) lalu nama darurat dari surel;
  peringatan tampil di halaman RPKPS/pratinjau; paraf, ajukan, setujui, sahkan, tutup evaluasi, dan serah terima
  koordinator **ditolak** sampai data dapat dipastikan. Pesan penolakannya (`ProfilTidakTersedia`) saat ini hanya
  berbahasa Indonesia.
- **Latensi**: cache dingin (instans serverless baru) = satu panggilan batch ke identitas-itts. Bila terasa,
  langkah lanjut adalah menyimpan hasil verifikasi rahasia klien di identitas-itts.
- **Kebijakan**: setiap dosen aktif langsung berperan DOSEN di prodi homebase-nya, tanpa persetujuan admin RPKPS.
- **Pencarian di `/pengguna`**: nama/NIDN/NIP dicari di identitas-itts (≤20 hasil per pencarian); surel dan nama
  pengguna lokal dicari di sini. Daftar diurutkan menurut status lalu surel (nama pegawai tak ada di basis data
  ini untuk `ORDER BY`).
- **Sambungan nama ke notifikasi** (`oleh: …`): teks notifikasi yang sudah terkirim membeku, tak diperbarui.

## 9. Verifikasi

- Unit: `npm test` — kontrak, turunan peran, rekonsiliasi + pagar, cache, tampilan, `peranLokalBoleh`, impor.
- Integrasi (PGlite, tanpa Neon): `npm run test:integrasi` — termasuk `uji/sinkron-peran.ts` (constraint unik,
  gagal-tertutup, promosi, pagar) dan penjaga kompilator.
- Manual: masuk lewat identitas-itts → peran benar menurut jabatan; ubah gelar di identitas-itts → tampil di RPKPS
  ≤10 menit; matikan identitas-itts → halaman tetap terbuka, mengesahkan ditolak.

## 10. Berkas

| Berkas | Isi |
|---|---|
| `src/domain/identitas/{kontrak,peran,cache,tampilan}.ts` | murni: validator jawaban, turunan peran, rekonsiliasi, cache, tampilan (`pegawai.test.ts`) |
| `src/lib/identitas/{klien,status,pegawai,sinkron,sinkron-inti}.ts` | jaringan, gerbang, profil + pencarian, sinkron |
| `src/lib/pengguna/tampilan.ts` | `tampilanDariRujukan`, `wajib*`, `pencariNama` |
| `src/lib/rpkps/muat.ts` | `muatRpkps` (hidrasi), `dataPengampuTakPasti` |
| `src/app/api/identitas/sinkron-peran/route.ts` | sinkron menyeluruh untuk cron |
| `src/app/[bahasa]/(app)/pengguna/*` | daftar, tambah (pegawai / non-pegawai), detail, sinkron |
| `src/app/[bahasa]/(app)/master/prodi/[id]` | kartu pemetaan unit ↔ prodi (Admin) |
| `prisma/migrations/20260925000000_rujukan_identitas` | migrasi expand |
| `prisma/isi-rujukan-identitas.ts` | pengisian + laporan selisih (dijalankan pengguna) |
| `prisma/kontraksi/buang_data_pegawai.sql` | kontraksi (dijalankan pengguna, §7) |
| `uji/periksa-tanpa-data-pegawai.mts`, `uji/sinkron-peran.ts` | penjaga kompilator, uji integrasi sinkron |
