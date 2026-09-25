# Pelaporan aktivitas ke identitas-itts

> Status: **TERPASANG** (24 September 2026). Tahap K2 dari rencana KPI
> perilaku pegawai di identitas-itts (`identitas-itts/docs/04-kinerja-perilaku-pegawai.md`).
> Kontrak penerimanya ada di sana, §5.

## 1. Yang dilaporkan, dan yang tidak

identitas-itts menilai kinerja perilaku pegawai dari **perbuatan** mereka di
aplikasi-aplikasi institusi. Dari RPKPS, perbuatan yang punya pemilik,
batas waktu, dan akibat adalah rantai pengesahan (docs/14 §2):

| Jenis | Pelaku | `diterimaPada` | `tenggat` | Sumber |
|---|---|---|---|---|
| `rpkps.diajukan` | koordinator | — | tenggat penyusunan | riwayat `DIPARAF_KOORDINATOR` |
| `rpkps.paraf_diberikan` | pengampu | permintaan paraf terakhir pada ronde itu | — | `tanda_tangan_rpkps` peran PENGAMPU |
| `rpkps.disetujui` | Kaprodi | saat diajukan | tenggat review + jaminan N hari | riwayat `DISETUJUI_KAPRODI` |
| `rpkps.dikembalikan_kaprodi` | Kaprodi | saat diajukan | tenggat review + jaminan N hari | riwayat `DIKEMBALIKAN_REVISI` setelah pengajuan |
| `rpkps.disahkan` | Penjaminan Mutu | saat disetujui Kaprodi | tenggat pengesahan + jaminan N hari | riwayat `DISAHKAN_MUTU` |
| `rpkps.dikembalikan_pmi` | Penjaminan Mutu | saat disetujui Kaprodi | tenggat pengesahan + jaminan N hari | riwayat `DIKEMBALIKAN_REVISI` setelah persetujuan |
| `rpkps.terbit` | koordinator | — | — | riwayat `DISAHKAN_MUTU`; `nilai` = berapa kali dikembalikan |

Awalan `rpkps.` sebenarnya `IDENTITAS_ITTS_CLIENT_ID`. identitas-itts menolak
jenis yang tidak berawalan client_id pengirimnya.

Tenggat pemutus dihitung dengan `batasTahap` (`src/domain/rpkps/tenggat.ts`),
fungsi yang sama dengan antrian kerja. Yang dilaporkan adalah batas yang
dilihat orangnya di layar, bukan tafsiran kedua.

**Paraf tidak bertenggat.** Pengampu baru dapat memaraf setelah koordinator
siap dan meminta. Mengukurnya terhadap tenggat penyusunan berarti
menghukumnya atas keterlambatan orang lain. Yang diukur adalah waktu
tanggapnya sejak diminta.

**Yang tidak dilaporkan:**

- **Login, membuka halaman, menyunting isi.** Keaktifan bukan kinerja
  (identitas-itts docs/04 §1).
- **Baris riwayat sebelum docs/14.** Waktu itu Kaprodi menerbitkan langsung.
  Baris tanpa `data.kunci` rantai diabaikan, bukan ditafsirkan.
- **`DARI_ARSIP_TERBIT`.** Statusnya TERBIT, tetapi itu pemulihan arsip,
  bukan pengesahan. Karena itu peristiwa dibaca dari `data.kunci`, bukan
  dari kolom `status`.
- **Usulan revisi kurikulum** dan **tunggakan di akhir semester**. Keduanya
  ada di rencana docs/04 §5.3 identitas-itts, tetapi belum dibangun.

## 2. Cara kerja

```
aksi dosen ──┬─ ubah rpkps ───────────┐  satu transaksi (sudah begitu sejak docs/14)
             └─ tulis rpkps_riwayat ──┘
                         │
     cron harian ────────▼
     GET /api/identitas/aktivitas
       baca per 200 baris setelah kursor (rpkps_riwayat, tanda_tangan_rpkps)
       → petakan (src/domain/identitas/aktivitas.ts)
       → POST identitas-itts /api/v1/aktivitas
       → 200? kursor maju : kursor diam, putaran berikutnya mengulang
```

- **Tidak ada tabel antrian baru dan tidak ada perubahan pada aksi.**
  `rpkps_riwayat` dan `tanda_tangan_rpkps` sudah ditulis di transaksi yang
  sama dengan perubahannya, jadi keduanya sudah menjadi outbox. Yang disimpan
  hanya kursornya (`kursor_identitas`). Gagal melapor tidak pernah
  menggagalkan pekerjaan dosen, karena pelaporan tidak berjalan di jalur aksi.
- **Kiriman ulang aman.** identitas-itts idempoten atas id aktivitas
  (`riwayat:<id>`, `riwayat:<id>:terbit`, `paraf:<id>`), jadi setelah galat
  di tengah jalan cukup panggil lagi.
- **Jeda mengendap 5 menit.** Cap waktu ditulis sebelum transaksinya selesai,
  jadi baris bercap lebih awal bisa terlihat setelah baris bercap lebih akhir.
  Baris yang lebih muda dari 5 menit menunggu putaran berikutnya.
- **Paraf ulang** dalam satu ronde memperbarui baris yang sama. Barisnya
  terkirim lagi dan dihitung duplikat, sehingga yang tercatat di sana adalah
  paraf pertama.

### 2.1 Isian mundur

Kursor kosong berarti mulai dari baris pertama. Selama kursor belum pernah
menyusul, kiriman bertanda `isianMundur: true`, sehingga baris lama tidak
ditandai "dilaporkan terlambat" di identitas-itts. Riwayat yang panjang
diteruskan beberapa putaran (±45 detik per putaran). Untuk menuntaskannya
sekarang juga, panggil berulang sampai kedua `tuntas` bernilai `true`:

```bash
curl -fsS -X POST https://rpkps.itts.ac.id/api/identitas/aktivitas \
     -H "Authorization: Bearer $CRON_SECRET"
```

`?ulang=1` menghapus kursor dan mengirim ulang seluruh riwayat. Ini aman
karena yang sudah ada dihitung duplikat. Gunanya menyusulkan aktivitas yang
dulu ditolak karena pelakunya belum terdaftar sebagai pegawai di
identitas-itts.

## 3. Menyalakan

1. Di identitas-itts, daftarkan aplikasi `rpkps` (Aplikasi klien), lalu
   simpan `client_secret`-nya.
2. Isi `IDENTITAS_ITTS_URL`, `IDENTITAS_ITTS_CLIENT_ID`, dan
   `IDENTITAS_ITTS_CLIENT_SECRET`. **Konfigurasi ini juga menyalakan gerbang
   kepegawaian saat login** (`src/lib/identitas/status.ts`). Keduanya
   satu integrasi.
3. Setel `CRON_SECRET` di proyek Vercel. Cron `vercel.json` memanggil setiap
   hari pukul 04.00 WIB.
4. Terapkan migrasi `20260924000000_kursor_identitas` (`npm run db:migrate:pg`).
5. Jalankan isian mundur (§2.1). Setelah itu, di identitas-itts buka
   **Aplikasi klien → RPKPS → Aktivitas masuk**. Jenis yang baru masuk
   berstatus belum dikatalogkan. Beri nama dan dimensi perilakunya.

Penolakan per butir, misalnya "pelaku tidak terdaftar sebagai pegawai", tidak
menahan kursor. Penolakan itu terlihat di jawaban rute ini (`contohTolak`)
dan di halaman Aktivitas masuk identitas-itts. Pengguna RPKPS dicocokkan ke
pegawai lewat **surel**, sampai RPKPS menjadi klien OIDC (identitas-itts
docs/00 §9, F6) dan dapat mengirim `sub`.

## 4. Kode dan uji

| Berkas | Isi |
|---|---|
| `src/domain/identitas/aktivitas.ts` | Pemetaan murni riwayat/paraf → aktivitas (+ `aktivitas.test.ts`) |
| `src/lib/identitas/aktivitas-inti.ts` | Kursor, pembacaan per batch, pengiriman. Menerima klien Prisma dan `fetch` |
| `src/lib/identitas/aktivitas.ts` | Pembungkus `server-only` dengan konfigurasi env |
| `src/app/api/identitas/aktivitas/route.ts` | Rute penjadwal, dijaga `CRON_SECRET` |
| `uji/integrasi.ts` §18 | Terhadap Postgres sungguhan dan penerima tiruan: padam → kursor diam, rantai lengkap, isian mundur, jeda mengendap, kirim ulang = duplikat |
