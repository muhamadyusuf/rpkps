# Kunci AI Milik Dosen (Mode A)

> Status: **DIPUTUSKAN 24 Agustus 2026, sedang dipasang.**
> Menggantikan keputusan Agustus 2026 pada [01 §2.1](./01-konsep-ai-byok.md) —
> "satu kunci institusi dari variabel lingkungan" — dengan **Mode A**: setiap
> dosen mendaftarkan kuncinya sendiri, dan hanya kunci itu yang dipakai.
> Rancangan antarmuka dan keamanannya sudah ada di [01 §2.2–2.3](./01-konsep-ai-byok.md);
> dokumen ini menetapkan yang belum: resolusi kredensial, model data, dan
> akibat-akibat yang tidak terlihat dari luar.

## BAGIAN 1 — Keputusan

| # | Pertanyaan | Keputusan |
|---|---|---|
| **A1** | Kunci institusi di env dipertahankan? | **Tidak.** Mode A murni. `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `GEMINI_API_KEY`, dan `AI_PENYEDIA` **tidak lagi dibaca** oleh jalur dosen. Dosen tanpa kunci tidak melihat tombol AI |
| **A2** | Bagaimana penyedia dipilih saat menyusun draf? | Dosen menetapkan **satu kunci bawaan**; tombol Susun draf memakainya langsung. Kunci yang akan dipakai tetap **tertulis di panel** beserta pemilih ringkas, sehingga "siapa yang membayar panggilan ini" terbaca sebelum tombol ditekan — bukan tersembunyi di halaman lain |
| **A3** | Fitur mana yang memakai kunci pribadi? | **Semua.** Susun draf RPKPS dan usulan perbaikan impor kurikulum. Satu aturan resolusi untuk seluruh aplikasi |

Konsekuensi A1 yang harus disebut terang-terangan: **fitur AI mati bagi dosen
yang belum mendaftarkan kunci.** Itu memang yang diminta — biaya ditanggung
masing-masing dosen, tanpa beban anggaran kampus — tetapi berarti tombol AI
menjadi fitur bersyarat, dan setiap halaman yang menampilkannya harus siap
tidak menampilkannya.

## BAGIAN 2 — Resolusi kredensial

Satu fungsi, satu aturan, dipakai setiap tugas AI:

```
pakaiKredensial(penggunaId, kredensialId?)
  kredensialId disebut  → kunci itu, WAJIB milik penggunaId dan aktif
  tidak disebut         → kunci bawaan milik penggunaId
  tidak ada bawaan      → satu-satunya kunci aktif miliknya, bila hanya ada satu
  tidak ada sama sekali → GalatAi: "Daftarkan kunci AI Anda di Pengaturan → Kunci AI."
```

Yang **tidak** ada di daftar itu: cadangan ke kunci institusi, cadangan ke
kunci pengguna lain, dan cadangan ke penyedia lain. Kegagalan harus berbunyi
sebagai kegagalan. Kunci milik orang lain tidak pernah dapat dipakai walau
id-nya ditebak dengan benar — kepemilikan diperiksa di kueri, bukan sesudahnya.

### 2.1 Jebakan yang sudah ada di kode

`src/lib/ai/penyedia/anthropic.ts` menyimpan klien SDK pada variabel modul:

```ts
let klien: Anthropic | null = null;
klien ??= new Anthropic({ apiKey });   // apiKey kedua dan seterusnya DIABAIKAN
```

Dengan satu kunci institusi ini tidak kelihatan. Dengan kunci per dosen, dosen
kedua yang memakai fitur AI pada proses server yang sama akan memanggil dengan
**kunci dan tagihan dosen pertama**. Singleton itu harus dibuang; adapter
Gemini dan Mistral sudah benar sejak awal karena meneruskan `apiKey` di setiap
panggilan.

## BAGIAN 3 — Penyimpanan kunci

Mengikuti [01 §2.3](./01-konsep-ai-byok.md), tanpa kelonggaran.

**Enkripsi amplop AES-256-GCM.** Tiap kredensial punya DEK acak 32 bita
sendiri; DEK dibungkus KEK yang dibaca dari `AI_KUNCI_MASTER` (32 bita, base64)
dan tidak pernah masuk repo. Yang tersimpan di kolom adalah satu gumpalan biner
berversi:

```
[0]        versi = 1
[1..13)    iv pembungkus DEK      (12)
[13..29)   tag pembungkus DEK     (16)
[29..61)   DEK terbungkus         (32)
[61..73)   iv kunci API           (12)
[73..89)   tag kunci API          (16)
[89.. ]    kunci API terenkripsi
```

Bita versi di depan supaya rotasi algoritme kelak tidak menuntut migrasi data
sekaligus. GCM berarti perubahan satu bita pada gumpalan membuat pembukaan
GAGAL, bukan menghasilkan sampah yang diam-diam dikirim ke penyedia.

Aturan yang menyertainya:

- **Kunci tidak pernah dapat dibaca kembali** — tidak ada tombol "lihat kunci",
  tidak ada endpoint yang mengembalikannya. Hanya diganti.
- Yang ditampilkan: penyedia, label, dan **empat karakter terakhir** yang
  disimpan terpisah sebagai teks biasa. Empat karakter tidak cukup untuk
  memakai kunci, tetapi cukup untuk dosen mengenali kunci yang mana.
- Kunci tidak pernah masuk log, pesan galat, atau `log_audit`. `GalatAi`
  memang sudah dibuat untuk itu.
- Uji koneksi **wajib berhasil sebelum simpan.** Kunci salah ketik tidak boleh
  tersimpan diam-diam lalu gagal di tengah penyusunan draf yang berjalan lima
  menit.

### 3.1 Model data

```prisma
enum PenyediaAi { ANTHROPIC  MISTRAL  GEMINI }

model KredensialAi {
  id               String     @id @default(cuid())
  penggunaId       String     @map("pengguna_id")
  penyedia         PenyediaAi
  label            String
  kunciTerenkripsi Bytes      @map("kunci_terenkripsi")
  ekor             String                          // 4 karakter terakhir
  model            String?                         // kosong = model bawaan adapter
  bawaan           Boolean    @default(false)
  terakhirDipakai  DateTime?  @map("terakhir_dipakai")
  ...
  @@unique([penggunaId, penyedia, label])
}
```

`scope` dari [01 §2.1](./01-konsep-ai-byok.md) **tidak dibuat.** Mode A hanya
mengenal kunci pengguna; menambahkan kolom yang selalu bernilai sama adalah
kolom mati. Bila kelak Mode C dibangun, kolom itu ditambahkan bersama jalur
cadangan yang memakainya — bukan sekarang, sebagai ornamen.

Kredensial **tidak dipensiunkan seperti capaian**: menghapusnya tidak melenyapkan
apa pun yang bergantung padanya. Draf yang sudah diterapkan adalah baris RPKPS
biasa bertanda `sumber = AI`; jejak pemakaiannya ada di `log_audit`, yang
memakai `onDelete: SetNull` pada penggunanya dan tidak menyimpan id kredensial
sebagai relasi.

## BAGIAN 4 — Yang berubah di kode

| Berkas | Perubahan |
|---|---|
| `src/lib/kripto/amplop.ts` (baru) | Enkripsi amplop murni + uji bolak-balik, kunci salah, dan gumpalan yang diutak-atik |
| `src/lib/ai/kredensial.ts` (baru) | Simpan, daftar, uji, jadikan bawaan, hapus, dan `pakaiKredensial()` |
| `src/lib/ai/klien.ts` | Tidak lagi membaca env. Menjadi pemetaan `PenyediaAi → adapter` |
| `src/lib/ai/gerbang.ts` | `jalankanTugasAi` menerima penyedia yang SUDAH dipilih pemanggil — draf tiga tahap tidak boleh mendekripsi kunci tiga kali |
| `src/lib/ai/penyedia/anthropic.ts` | Singleton klien dibuang (§2.1) |
| `src/app/(app)/pengaturan/ai/` (baru) | Halaman kelola kunci |
| `src/app/(app)/rpkps/[id]/panel-draf.tsx` | Menampilkan kunci yang akan dipakai + pemilih ringkas |
| `src/app/(app)/kurikulum/impor/` | `aiTersedia()` menjadi per pengguna |

`AI_MODEL` juga dipensiunkan: model kini melekat pada kredensial, karena nama
model tidak pernah cocok lintas penyedia — persis alasan yang membuat variabel
lintas-penyedia itu janggal sejak awal.
