# Masuk lewat identitas-itts — masuk tunggal (SSO)

Status: **terpasang** (2026-09-24). Sejak `docs/26`, pegawai yang masuk tidak lagi disalin
namanya ke RPKPS: yang tersimpan hanya kunci `identitas_akun_id`, dan perannya diturunkan dari jabatan. Melengkapi `docs/24` (pelaporan aktivitas) dan
gerbang kepegawaian di `src/lib/identitas/status.ts`. Sisi penyedia dan
konvensinya ada di `docs/06-masuk-tunggal.md` repositori identitas-itts.

## 1. Apa yang berubah bagi pengguna

Sebelumnya RPKPS hanya bisa dimasuki dengan **Google** (Firebase). Kini ada jalan
kedua, dan keduanya berujung pada sesi RPKPS yang sama:

| Jalan | Titik mulai | Perilaku |
|---|---|---|
| Google | tombol "Masuk dengan Google" | tidak berubah |
| Identitas ITTS | tombol "Masuk dengan Identitas ITTS", atau tautan **Aplikasi → RPKPS** di sidebar identitas-itts | pengguna yang **sudah masuk di identitas-itts** langsung tiba di RPKPS dalam keadaan masuk, tanpa layar apa pun; yang belum diminta masuk di identitas-itts dulu |

Tombol Identitas ITTS hanya tampil bila `IDENTITAS_ITTS_*` terisi.

## 2. Alur

```
peramban ── GET /api/identitas/masuk?lanjut=/rpkps/abc ──────────────► RPKPS
   ◄── 307 → identitas-itts/oauth/authorize?...&state=…&code_challenge=…
       + cookie sso_alur (state, verifier, lanjut)                       │
peramban ── GET /oauth/authorize ────────────────────────────────────► identitas-itts
   (sudah masuk di sana + klien dipercaya → tanpa layar)
   ◄── 302 → RPKPS/api/identitas/callback?code=…&state=…
peramban ── GET /api/identitas/callback (+ cookie sso_alur) ─────────► RPKPS
                 │ 1. batas laju per IP
                 │ 2. cookie alur utuh & belum kedaluwarsa, state cocok
                 │ 3. POST identitas-itts/oauth/token   (client_secret + code_verifier)
                 │ 4. id_token diverifikasi: RS256 via JWKS, iss, aud, exp
                 │ 5. jembatan ke Firebase → ID token
                 │ 6. selesaikanMasuk(): gerbang kepegawaian → siapkanPengguna
                 │    → cookie sesi → log_audit
   ◄── 307 → /{bahasa}{lanjut ?? /dashboard} + cookie sesi
```

## 3. Berkas

| Berkas | Isi |
|---|---|
| `src/domain/identitas/sso.ts` | Murni: PKCE, keadaan alur, tautan otorisasi, `lanjutAman`, klaim, kode galat. Diuji `sso.test.ts`. |
| `src/lib/identitas/sso.ts` | Jaringan: tukar kode, verifikasi id_token (JWKS), jembatan Firebase. |
| `src/lib/masuk.ts` | **Satu-satunya** pintu id token → sesi (`selesaikanMasuk`, `pasangCookieMasuk`). Dipakai `/api/sesi` dan callback. |
| `src/app/api/identitas/masuk/route.ts` | Memulai alur. |
| `src/app/api/identitas/callback/route.ts` | Menyelesaikan alur. |
| `src/app/[bahasa]/masuk/` | Tombol kedua dan pesan galat `?galat=`. |

## 4. Konfigurasi

Di RPKPS: `IDENTITAS_ITTS_URL`, `IDENTITAS_ITTS_CLIENT_ID`,
`IDENTITAS_ITTS_CLIENT_SECRET` (sama dengan gerbang kepegawaian),
`NEXT_PUBLIC_URL_SITUS` (dipakai membentuk alamat balik), opsional
`IDENTITAS_ITTS_PENERBIT` (bawaan `identitas-itts`).

Di identitas-itts, halaman **/klien → rpkps** harus memuat:

- **Alamat pengalihan:** `${NEXT_PUBLIC_URL_SITUS}/api/identitas/callback` — persis,
  tanpa garis miring akhir; satu entri per lingkungan (`http://localhost:3000/…`
  dan alamat produksi).
- **Cakupan:** `openid`. Klaim `email` dan `name` sudah ikut di id_token.
- **Dipercaya pihak pertama:** menyala. Tanpa itu setiap masuk berhenti di layar
  persetujuan, dan "buka RPKPS tanpa masuk lagi" tidak terwujud.

Gejala bila salah: `redirect_uri` tak terdaftar / cakupan tak diizinkan →
layar galat di identitas-itts (`/oauth/authorize/galat`), bukan di RPKPS.

## 5. Keputusan dan alasannya

- **Firebase tetap satu-satunya bentuk sesi.** Sesi RPKPS adalah cookie sesi
  Firebase, dan Firebase hanya menerbitkannya dari ID token. Alih-alih membangun
  sistem sesi kedua (yang harus dikenali `verifikasiCookieSesi`, pencabutan,
  proxy, dan seluruh `sesiSaatIni`), identitas yang sudah terverifikasi
  dijembatani: cari/buat pengguna Firebase dengan surel itu → token kustom →
  ID token (REST `signInWithCustomToken`) → `selesaikanMasuk`. Surel adalah
  kunci penyatu, sama seperti Google: pengguna yang pernah masuk dengan Google
  mendapat `uid` yang **sama**, jadi peran dan datanya utuh.
- **Satu pintu, bukan dua.** Gerbang kepegawaian, pengecualian admin bootstrap,
  `siapkanPengguna`, dan audit ada di `selesaikanMasuk`. Jalan masuk baru yang
  menulis ulang urutan itu adalah gerbang yang bisa terlewat tanpa disadari.
  `log_audit` mencatat `… masuk lewat identitas-itts`.
- **Gerbang kepegawaian tetap berlaku.** Token identitas-itts hanya menjamin
  akunnya AKTIF; `status-pegawai` juga memeriksa `statusPegawai`. Admin
  bootstrap tetap dikecualikan (akun "pecah kaca").
- **`state` di cookie, bukan di server.** Tak ada tabel baru. Cookie `HttpOnly`,
  `SameSite=Lax` (navigasi balik lintas situs tingkat atas tidak membawa cookie
  `Strict`), umur 10 menit, dan **sekali pakai**: dibuang pada setiap jawaban
  callback. Di produksi berawalan `__Host-` supaya tak dapat ditimpa dari
  subdomain lain di bawah itts.ac.id — penimpaan itu satu-satunya cara membuat
  peramban korban memegang `state`/`verifier` milik penyerang.
- **id_token tetap diverifikasi** walau diterima langsung dari `/oauth/token`
  lewat TLS (yang menurut OIDC Core §3.1.3.7 boleh melewatkan tanda tangan):
  murah, dan menutup kelas salah-konfigurasi seperti `IDENTITAS_ITTS_URL` yang
  menunjuk ke penyedia lain. `aud` harus `rpkps`, `alg` dikunci RS256.
- **Tanpa `nonce` dan tanpa `prompt=none`.** Penyedia belum mendukungnya. `nonce`
  menangkal penyuntikan id_token pada alur implisit/hybrid; di alur kode dengan
  PKCE + `client_secret` + penukaran server-ke-server, penangkalnya sudah ada.
  SSO "senyap" (otomatis mengalihkan tamu tanpa sesi) sengaja tidak dibuat —
  RPKPS punya katalog publik dan jalan Google; masuk tunggal adalah pilihan
  eksplisit lewat tombol atau tautan dari identitas-itts.
- **`lanjut` hanya alamat dalam situs, bukan `/api`.** Aturan yang sama dengan
  halaman masuk Google, ditambah `/api` supaya `lanjut=/api/identitas/masuk`
  tidak menjadi putaran tak berujung. Diperiksa saat dibuat **dan** saat cookie
  dibuka kembali.
- **Pesan galat dari daftar tertutup.** `?galat=` hanya diterjemahkan bila kodenya
  dikenal (`KODE_GALAT_SSO`); nilai lain diabaikan, tidak pernah dipantulkan.

## 6. Batasan yang diketahui

- **Keluar tidak menyebar.** Keluar dari identitas-itts tidak mengeluarkan dari
  RPKPS (sesi 5 hari) dan sebaliknya — belum ada *logout* saluran belakang.
- **Penonaktifan pegawai** menutup masuk BARU (gerbang kepegawaian + token
  ditolak), tetapi sesi RPKPS yang sudah ada berlaku sampai kedaluwarsa atau
  dicabut. Peristiwa webhook `akun.status_diubah` bisa dipakai kelak untuk
  mencabut sesi Firebase-nya.
- **`NEXT_PUBLIC_URL_SITUS` harus sama dengan tempat pengguna berada.** Alamat
  balik dibentuk darinya; bila pengguna membuka RPKPS lewat alamat lain (mis.
  IP jaringan), cookie alur tak ikut ke callback dan hasilnya "kedaluwarsa".
- **Cookie `sesi` dibagi antarporta di `localhost`.** Cookie tidak mengenal porta,
  jadi RPKPS (:3000) dan identitas-itts (:3001) dulu saling menimpa `sesi`.
  identitas-itts kini memakai `identitas_sesi`; RPKPS tetap `sesi`. Bila kelak ada
  aplikasi ketiga di localhost, beri cookie sesinya nama sendiri.
- **Bila masuk berhenti di identitas-itts** (RPKPS tak pernah menerima
  `/api/identitas/callback`), penyebabnya hampir selalu pendaftaran klien
  `rpkps`. Layar galat di sana menampilkan rincian untuk admin, dan
  identitas-itts `docs/06` §7 memetakan gejala ke perbaikan.
- **Pengguna baru** dibuatkan pengguna Firebase (surel terverifikasi) dan
  berstatus `MENUNGGU_VERIFIKASI`, kecuali sudah diundang admin lewat `/pengguna`.

## 7. Verifikasi

Diuji lokal terhadap penyedia OIDC tiruan (RS256 sungguhan) dengan Firebase
dan basis data asli: alur sukses, `state` palsu, cookie alur rusak/kedaluwarsa,
`code` karangan/dipakai ulang/milik alur lain (PKCE), `id_token` dengan
tanda tangan kunci lain, `aud`/`iss` salah, kedaluwarsa, `alg: none`, tanpa
surel, `/oauth/token` 500, pegawai nonaktif/tidak terdaftar, pembatas laju,
dan pantulan `?galat=`. Tak satu pun kasus gagal menghasilkan cookie sesi.
Belum diuji: klik nyata di peramban terhadap identitas-itts sungguhan (perlu
klien `rpkps` terdaftar sesuai §4).
