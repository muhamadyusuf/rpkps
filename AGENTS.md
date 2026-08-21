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

## Aturan yang mengikat

- **CPL, CPMK, dan Sub-CPMK berasal dari buku kurikulum dan bersifat read-only** di
  penyusun RPKPS. Perubahan harus lewat Usulan Revisi Kurikulum ke Kaprodi.
- **Profil lulusan tidak boleh masuk ke `proyeksiIsi()`.** Proyeksi itu dasar
  sidik SHA-256; menambah apa pun ke sana mengubah sidik SELURUH RPKPS terbit
  dan memunculkan peringatan pergeseran palsu. Profil lulusan hidup di lapisan
  kurikulum, bukan lapisan mata kuliah.
- **Invarian beban belajar: total / sks = 45 jam per semester.** Jangan pernah
  meng-hardcode pola 50/60/60 — itu konfigurasi (`kebijakan_bentuk`), bukan konstanta.
- **Template dokumen adalah data, bukan kode.** ITTS memakai tabel mingguan 7 kolom;
  kampus lain 9 kolom.
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
