<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:proyek -->

# Proyek RPKPS ITTS

Aplikasi penyusunan Rencana Program dan Kegiatan Pembelajaran Semester berbasis OBE.
Konsep lengkap ada di `docs/` — **baca sebelum menambah fitur**:

| Berkas | Isi |
|---|---|
| `docs/00-konsep-rpkps.md` | Domain RPKPS, modul, model data. §3.1–3.2 sudah digantikan doc 03. |
| `docs/01-konsep-ai-byok.md` | Lapisan AI, kunci API milik pengguna (BYOK) |
| `docs/02-template-itts-dan-penyelarasan-industri.md` | Template ITTS asli, aturan validator, fitur penyelarasan industri |
| `docs/03-kebijakan-beban-belajar.md` | Spesifikasi mesin hitung beban belajar |
| `docs/04-usulan-revisi-kurikulum.md` | Pintu resmi mengubah CPMK/Sub-CPMK: usulan → Kaprodi → pengesahan. U1–U2 terpasang; draf AI (U3) belum. |
| `docs/05-evaluasi-ketercapaian-mk.md` | Evaluasi ketercapaian CPMK/CPL per MK + tindak lanjut (PPEPP). E1–E6 terpasang: peta asesmen, impor nilai, ketercapaian, tindak lanjut, agregasi prodi, analisis butir. |
| `docs/07-dasbor-peran.md` | Dasbor per peran: antrian kerja, panel Kaprodi/GPM/Dosen/Admin/Asesor/Mahasiswa, bagan SVG server. D1–D3 terpasang. |
| `docs/06-daur-hidup-dan-berbagi-rpkps.md` | Hapus/arsip RPKPS, tim pengampu, serah terima, salin, panel bagikan. B1–B4 terpasang; tautan pratinjau bertoken (B5) ditunda. |
| `docs/08-kunci-ai-per-pengguna.md` | BYOK Mode A: tiap dosen mendaftarkan kunci AI-nya sendiri. Menggantikan kunci institusi lewat env. |

## Aturan yang mengikat

- **CPL, CPMK, dan Sub-CPMK berasal dari buku kurikulum dan bersifat read-only** di
  penyusun RPKPS. Perubahan harus lewat Usulan Revisi Kurikulum ke Kaprodi
  (`/usulan`, lihat doc 04) — bukan lewat penyuntingan langsung.
- **Capaian dipensiunkan, tidak pernah dihapus.** `SubCpmk` dirujuk
  `PertemuanSubCpmk`, `TugasSubCpmk`, dan `ButirKisiKisi` dengan `onDelete: Cascade`;
  menghapusnya melenyapkan baris RPKPS berjalan tanpa jejak. Isi `pensiunSejakTaId`.
- **Revisi kurikulum berlaku mulai tahun akademik, bukan seketika.** Satu-satunya
  pengecualian adalah jalur ralat, dan syaratnya ditegakkan kode di
  `periksaJalurRalat` — bukan pengakuan pengusul.
- **Profil lulusan tidak boleh masuk ke `proyeksiIsi()`.** Proyeksi itu dasar
  sidik SHA-256; menambah apa pun ke sana mengubah sidik SELURUH RPKPS terbit
  dan memunculkan peringatan pergeseran palsu. Profil lulusan hidup di lapisan
  kurikulum, bukan lapisan mata kuliah.
- **Bobot penilaian punya satu buku besar: `komponen_nilai`.** Sebuah komponen
  dirinci baris mingguan ATAU lembar tugas — tidak pernah keduanya, atau tagihan
  yang sama terhitung dua kali dan angka capaian jadi karangan. Aturan ini
  ditegakkan `susunPetaAsesmen` di `src/domain/evaluasi/peta-asesmen.ts`; jangan
  menjumlahkan `pertemuan.bobot`, `tugas.bobot`, dan `butir_kisi_kisi.skor`
  secara langsung di tempat lain.
- **Invarian beban belajar: total / sks = 45 jam per semester.** Jangan pernah
  meng-hardcode pola 50/60/60 — itu konfigurasi (`kebijakan_bentuk`), bukan konstanta.
- **Template dokumen adalah data, bukan kode.** ITTS memakai tabel mingguan 7 kolom;
  kampus lain 9 kolom.
- **Hasil evaluasi tidak boleh masuk `proyeksiIsi()`.** Ia punya ruang sidik
  sendiri di `src/domain/evaluasi/proyeksi.ts`. Alasannya sama dengan profil
  lulusan: menambah apa pun ke proyeksi RPKPS menggeser sidik SELURUH RPKPS
  terbit. Evaluasi adalah dokumen berdampingan, bukan bagian RPKPS.
- **Evaluasi menempel pada `Kelas`, bukan pada `Rpkps`.** Satu RPKPS dipakai
  beberapa kelas paralel; menggabungkan nilainya menyembunyikan temuan yang
  paling berguna — rencana sama, capaian jauh berbeda berarti yang bermasalah
  adalah pelaksanaan, bukan rancangan.
- **RPKPS tidak dihapus kecuali draf tanpa akibat.** `Rpkps` adalah akar
  cascade yang menjangkau `rpkps_snapshot` (sidik SHA-256 yang sudah tercetak
  dan menjadi halaman publik) serta `kelas → peserta_kelas → nilai` dan
  `evaluasi_mk`. Syaratnya ditegakkan `periksaKelayakanHapus` di
  `src/domain/rpkps/daur-hidup.ts`, bukan oleh dialog. Selebihnya berstatus
  `ARSIP` — tidak ada baris yang hilang.
- **Wewenang atas satu RPKPS diputuskan di `src/lib/rpkps/wenang.ts`, tidak di
  tempat lain.** Kepengampuan adalah jalur akses tersendiri: `boleh = pengampu
  || (dalamCakupan && ADMIN|KAPRODI|GPM)`. Menyalin ulang aturan ini dengan
  `dalamCakupan &&` di depan akan mematikan team teaching lintas prodi tanpa
  pesan galat apa pun.
- **Menyalin RPKPS antar mata kuliah melepas seluruh pemetaan Sub-CPMK.**
  Sub-CPMK milik mata kuliah, bukan milik RPKPS; kisi-kisi tidak ikut sama
  sekali karena `butir_kisi_kisi.sub_cpmk_id` wajib isi.
- **Serah terima koordinator tidak menyentuh salinan beku.** Nama pengampu di
  `rpkps_snapshot` adalah nama saat pengesahan; memperbaruinya menggeser sidik
  seluruh dokumen terbit.
- **Fitur AI memakai kunci milik dosen, bukan kunci institusi.** Resolusinya
  hanya di `pakaiKredensial()` (`src/lib/ai/kredensial.ts`), tanpa cadangan ke
  env, ke kunci pengguna lain, atau ke penyedia lain. Kunci dibuka SEKALI per
  tugas lalu diteruskan ke gerbang; jangan membuat adapter penyedia di luar
  berkas itu, dan jangan pernah menyimpan klien SDK pada variabel modul —
  kunci dosen berikutnya akan diabaikan dan tagihannya salah alamat.
- **Kunci API tidak pernah dapat dibaca kembali.** Yang boleh keluar dari
  `kredensial.ts` adalah adapter `Penyedia` yang sudah jadi, bukan string
  kunci. Ke log, pesan galat, dan `log_audit` hanya masuk penyedia, model,
  id kredensial, dan empat karakter terakhir.
- **Halaman publik hanya membaca salinan beku, dan hanya status `TERBIT`.**
  Semua kueri lewat `src/lib/publik/muat.ts`; isi dokumen selalu lewat
  `dokumenPublik()` yang dibangun di atas `proyeksiIsi` — jangan mengirim baris
  Prisma mentah ke komponen publik.
- Domain `src/domain/` harus murni: tanpa Prisma, tanpa React, agar dapat diuji.
- Bahasa antarmuka dan penamaan domain: Indonesia. Tabel database snake_case
  lewat `@@map`/`@map`.

## Perintah

```
npm run dev         npm test          npm run typecheck
npm run db:push     npm run db:seed   npm run db:studio
```

<!-- END:proyek -->
