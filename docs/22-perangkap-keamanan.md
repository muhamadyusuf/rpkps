# Perangkap dan penguatan keamanan

Status: terpasang (PK1–PK4). Menambah lapisan pendeteksi di depan aplikasi dan
menutup celah yang ditemukan pada tinjauan keamanan.

## 1. Temuan tinjauan dan perbaikannya

| # | Temuan | Perbaikan |
|---|---|---|
| 1 | Tidak ada header keamanan (dapat dibingkai situs lain, `<base>` disusupi, formulir dibelokkan) | `next.config.ts`: nosniff, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy, COOP `same-origin-allow-popups`, CSP direktif non-skrip. `poweredByHeader: false` |
| 2 | `/api/sesi` dan unduhan DOCX publik tanpa pembatas laju | `lib/keamanan/laju.ts` + `domain/keamanan/batas-laju.ts` (jendela tetap, per instans) |
| 3 | `log_audit.ip` menyimpan `x-forwarded-for` mentah (dapat dipalsukan) | `ambilIpKlien()` — kepala platform dulu, nilai bukan-IP dibuang |
| 4 | `/setup` terbuka dan tiap kunjungan memicu panggilan keluar 6 detik; pesan galat jaringan tampil | cache 60 dtk pada `periksaFirebaseAuth`; pesan mentah hanya di luar produksi |
| 5 | `lanjut` pada halaman masuk menerima `//host` dan `\` | ditolak |
| 6 | `next` 16.3.1 (kritis: RCE tanpa autentikasi pada Windows) | naik ke 16.3.5; `npm audit fix` (19 → 8 temuan) |

Sisa 8 temuan `npm audit` hanya tersedia perbaikannya lewat *downgrade*
(`prisma@6`, `exceljs@3`, `pptxgenjs@2`) dan menyangkut perkakas CLI atau
pengurai gambar milik kita sendiri — bukan masukan pengguna. Tidak dipaksa.

Yang diperiksa dan TIDAK bermasalah: seluruh Server Action dan rute API
memeriksa sesi dan wewenang; tautan pratinjau memakai token 256-bit; `.env`
tidak ada di git; tidak ada `dangerouslySetInnerHTML`.

## 2. Perangkap

Alamat umpan — `*.php`, `/wp-admin`, `/.env`, `/.git`, `/phpmyadmin`, `/admin`,
`/backup.sql`, `/actuator`, dan sejenisnya (`domain/keamanan/perangkap.ts`) —
tidak ada di aplikasi ini, sehingga siapa pun yang membukanya sedang memindai.
Sinyalnya bersih: tidak ada positif palsu.

Alur: `proxy.ts` mengalihkan (rewrite) ke `/api/perangkap` sebelum bahasa dan
sesi diperiksa → rute umpan menjawab (formulir masuk palsu untuk alamat panel,
404 untuk lainnya) → `after()` menulis ke `perangkap_temuan` tanpa membuat
pemindai menunggu.

Yang dicatat: IP, rantai `x-forwarded-for` mentah, alamat, metode, User-Agent,
bahasa, sidik perangkat (pengelompok lintas-IP), kepala bukti (tanpa cookie dan
Authorization), lokasi perkiraan (kepala geolokasi Vercel, dilengkapi
ipwho.is: kota, koordinat, penyedia, ASN). Satu baris = satu (ip, jalur,
metode) per 30 menit; sisanya menaikkan `jumlah`.

**Yang tidak pernah disimpan:** sandi yang dicoba — hanya panjangnya. Sandi
tebakan sering kali sandi sungguhan milik orang lain; menyimpannya menjadikan
basis data ini kumpulan kredensial curian.

Papan admin: `/perangkap` (ADMIN), rincian per temuan, status
(Baru/Ditinjau/Dilaporkan/Diabaikan) dan catatan. Temuan tidak dapat dihapus
dari antarmuka.

## 3. Yang TIDAK dibangun, dan mengapa

**Foto pelaku dan titik GPS.** Peramban hanya menyerahkan kamera dan lokasi
presisi setelah pemilik perangkat menekan "Izinkan"; server tidak dapat
mengambilnya diam-diam. Membujuk pengunjung mengizinkannya lewat dalih palsu
(mis. "verifikasi identitas") berarti mengumpulkan data biometrik dari siapa
saja yang tiba di alamat itu — termasuk perayap, pemindai otomatis, dan orang
yang salah ketik — dan itu bertentangan dengan UU PDP. Untuk laporan ke
penegak hukum, IP + waktu + isi permintaan + penyedia (ASN) sudah cukup;
identitas pemilik IP diminta penegak hukum kepada penyedia.

## 4. Keterbatasan yang diketahui

- Pembatas laju per instans, bukan global. Serangan volumetrik ditahan WAF
  platform, bukan kode ini.
- Lokasi IP tingkat kota; VPN/seluler menunjuk gerbang penyedia.
- `ambilIpKlien` percaya kepala platform. Di belakang proksi yang MENAMBAHKAN ke
  `x-forwarded-for`, elemen pertama dapat dipalsukan — karena itu rantai mentah
  ikut disimpan.
- CSP tanpa `script-src` (lihat komentar di `next.config.ts`).

## 5. Menerapkan

```
npm run db:migrate:pg   # membuat tabel perangkap_temuan
```
