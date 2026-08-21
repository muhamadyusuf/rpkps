# Uji integrasi

Menjalankan seluruh alur — master data → kurikulum → kerangka RPKPS → validator —
terhadap **Postgres sungguhan**, tanpa perlu memasang apa pun. Databasenya adalah
PGlite (Postgres yang dikompilasi ke WebAssembly) yang berjalan di memori dan
melayani protokol Postgres di `127.0.0.1:5433`.

```bash
npm run test:integrasi
```

Skrip akan menyalakan database, menerapkan skema, menjalankan 49 pemeriksaan —
termasuk membongkar berkas `.docx` hasil ekspor untuk memastikan seluruh bagian
A–J ada — lalu mematikannya kembali. Tidak ada berkas yang tersisa dan tidak ada database Anda
yang tersentuh.

Bila salah satu pemeriksaan gagal, keluarannya menandai baris mana yang gagal
dan proses keluar dengan kode bukan-nol.

## Memeriksa dokumen hasil ekspor

Uji integrasi menulis contoh dokumen ke `uji/keluaran-rpkps.docx`. Untuk membaca
isi teksnya tanpa membuka Word:

```bash
npx tsx uji/baca-docx.mjs
```
