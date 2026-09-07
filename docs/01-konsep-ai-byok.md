# Konsep Integrasi AI (BYOK — Bring Your Own Key)

Lanjutan dari [00-konsep-rpkps.md](./00-konsep-rpkps.md). Dokumen ini merancang lapisan AI: bagaimana pengguna memasukkan token AI miliknya sendiri, di mana AI benar-benar menambah nilai pada alur RPKPS, dan bagaimana menjaganya tetap aman, murah, dan dapat dipertanggungjawabkan secara akademik.

---

## BAGIAN 1 — Prinsip Dasar

Lima prinsip yang mengikat seluruh desain di bawah:

1. **Aplikasi harus tetap utuh tanpa AI.** Semua fitur di dokumen konsep pertama dapat dipakai penuh tanpa satu pun API key. AI adalah akselerator, bukan dependensi. Kampus tanpa anggaran API tetap mendapat aplikasi yang berfungsi.
2. **AI mengusulkan, dosen memutuskan.** Tidak ada satu pun field yang terisi otomatis tanpa persetujuan eksplisit. Semua keluaran AI masuk ke panel usulan, dosen menerima per item.
3. **Kunci tidak pernah menyentuh browser.** Seluruh panggilan LLM dijalankan di server. Setelah disimpan, kunci tidak pernah dikirim balik ke klien dalam bentuk apa pun.
4. **Keluaran terstruktur, bukan teks bebas.** AI mengembalikan JSON sesuai skema yang cocok dengan model data — bukan paragraf yang harus di-parse dengan regex.
5. **Setiap jejak tercatat.** Field hasil AI ditandai (model, waktu, versi prompt, siapa yang menyetujui). Dokumen akademik yang disahkan harus bisa diaudit.

---

## BAGIAN 2 — Model Kepemilikan Kunci

### 2.1 Tiga mode, dikonfigurasi institusi

| Mode | Siapa yang memasukkan kunci | Cocok untuk |
|---|---|---|
| **A — Kunci pengguna (BYOK)** | Setiap dosen memasukkan kuncinya sendiri | Permintaan Anda; dosen menanggung biayanya sendiri, tanpa beban anggaran kampus |
| **B — Kunci institusi** | Admin memasukkan satu kunci, semua dosen memakainya dengan kuota per pengguna | Kampus yang berlangganan; dosen tidak perlu tahu soal API |
| **C — Hibrida** | Kunci institusi sebagai bawaan, dosen boleh menimpanya dengan kuncinya sendiri | **Rekomendasi.** Superset dari A dan B |

> **Status implementasi (24 Agustus 2026): MODE A TERPASANG.** Kunci institusi
> lewat variabel lingkungan sudah **dicabut** — `AI_PENYEDIA`, `AI_MODEL`, dan
> ketiga `*_API_KEY` tidak lagi dibaca. Setiap dosen mendaftarkan kuncinya
> sendiri di **Pengaturan → Kunci AI**, tersimpan terenkripsi amplop AES-256-GCM
> pada tabel `kredensial_ai`, dan resolusinya ada di `src/lib/ai/kredensial.ts`.
> Spesifikasi lengkapnya di [docs/08](./08-kunci-ai-per-pengguna.md); §2.2 dan
> §2.3 di bawah adalah rancangan yang dipakai apa adanya. Mode B dan C belum
> ada, dan kolom `scope` sengaja belum dibuat.
> Penyedia dipilih lewat `AI_PENYEDIA`: **Anthropic** (bawaan, satu-satunya
> dengan prompt caching yang dapat diatur sendiri), **Mistral**, atau
> **Gemini** (caching-nya implisit, berjalan tanpa pengaturan). Adapternya ada
> di `src/lib/ai/penyedia/`, di balik antarmuka `Penyedia` — dan penambahan
> Gemini membuktikan janji §2.4: satu berkas baru plus satu baris di
> `klien.ts`, tanpa menyentuh gerbang, skema draf, maupun domain.
> Fitur yang memakainya baru satu: usulan perbaikan temuan saat impor
> kurikulum (§3.1 T1–T3, dipersempit) — lihat `src/lib/ai/perbaikan-kurikulum.ts`.
> Keputusan prodi yang menyertainya: **AI boleh mengusulkan Sub-CPMK dan
> pemetaan CPL yang belum ada**, tidak hanya memperbaiki rumusan. Isi hasil
> usulan yang diterima ditandai `sumber = AI` pada tabel `cpmk`/`sub_cpmk`.
>
> **Draf RPKPS disusun tiga tahap (Agustus 2026).** Semula satu panggilan
> dengan anggaran 32.000 token keluaran. Bentuk itu paling boros terhadap kuota
> gratis: kegagalan di menit terakhir menghanguskan seluruh anggaran, dan
> penyedia yang menghitung `max_tokens` yang DIMINTA terhadap batas
> token-per-menit ikut membakar jatah yang tak pernah dipakai. Sekarang
> kerangka (4.000) → pertemuan (14.000) → tugas dan kisi-kisi (10.000), berurutan.
> Seluruh aritmetika diputuskan di tahap pertama, sehingga dua tahap berikutnya
> tidak dapat merusak jumlah bobot. Yang dibayar: permintaan naik dari satu
> menjadi tiga — memburuk bagi penyedia yang batasnya permintaan-per-hari.
> Blok panduan dasar (~515 token) sengaja identik sebagai awalan ketiga tahap
> agar kena prompt caching. `periksaDraf()` tetap memeriksa draf GABUNGAN.
>
> Fitur kedua: **penyusunan draf RPKPS utuh** (T4–T11 dipersempit) —
> `src/lib/ai/draf-rpkps.ts` dan `src/domain/rpkps/draf.ts`. Menyimpang dari
> §4.7 dalam dua hal: persetujuan dosen berupa SATU tombol untuk seluruh
> dokumen (bukan per item seperti §4.5), dan **AI juga mengusulkan daftar
> pustaka** — yang §4.7 tandai sebagai risiko halusinasi nomor satu. Peredamnya:
> pustaka yang sudah dosen masukkan tidak pernah disentuh, yang baru hanya
> ditambahkan, ditandai `sumber = AI`, dan pratinjau memperingatkan agar
> judul/penulis/tahun diverifikasi sebelum disetujui. Kompensasinya `periksaDraf()` menolak draf yang melanggar
> invarian mana pun, dan `sumber = AI` dicatat pada `pertemuan`/`tugas`/
> `kisi_kisi`.
>
> **Dosen dapat menambahkan arahannya sendiri (5 September 2026).** Draf semula
> hanya berbicara dengan konteks yang dirakit server dari basis data, sehingga
> buta terhadap hal yang tidak ada di sana: cara mata kuliah benar-benar
> berjalan, konteks kasus yang dipilih prodi, bentuk asesmen yang disepakati
> tim. Sekarang ada satu medan teks bebas (maksimal 1.000 karakter, tersimpan
> pada `Rpkps.arahanAi`) yang dikirim ke KETIGA tahap sebagai blok
> `<arahan_dosen>` di dalam bagian `permintaan` — tidak pernah di dalam
> `PANDUAN_*`, yang harus tetap stabil agar kena prompt caching. Arahan
> berkedudukan sebagai preferensi ISI dan tidak dapat melonggarkan aturan mana
> pun; penjaganya tetap `periksaDraf()`. Spesifikasinya di
> [docs/20](./20-arahan-dosen-pada-draf-ai.md).

Realitas lapangan: sebagian besar dosen belum punya API key dan tidak akan membuatnya. Bangun Mode A dulu (sesuai permintaan), tapi rancang skemanya agar Mode B hanya menambah satu baris `scope` — bukan perombakan.

```
ai_credential.scope ∈ { 'user', 'prodi', 'institusi' }
Resolusi saat runtime: kunci milik pengguna → kunci prodi → kunci institusi → tolak (fitur AI mati)
```

### 2.2 Alur pengguna memasukkan kunci

```
Pengaturan → AI & Token
  ┌──────────────────────────────────────────────┐
  │  Penyedia AI    [ Anthropic (Claude)    ▾ ]  │
  │  Label          [ Kunci pribadi saya      ]  │
  │  API Key        [ sk-ant-••••••••••••     ]  │
  │  Model bawaan   [ claude-sonnet-5       ▾ ]  │
  │                                              │
  │  [ Uji Koneksi ]              [ Simpan ]     │
  └──────────────────────────────────────────────┘

  Kunci tersimpan:
  ┌──────────────────────────────────────────────┐
  │ ● Anthropic · Kunci pribadi saya             │
  │   sk-ant-…4f2a · aktif · dipakai 2 jam lalu  │
  │   Bulan ini: 412.500 token · ± Rp 18.700     │
  │   [ Uji ] [ Ganti kunci ] [ Nonaktifkan ] [ Hapus ] │
  └──────────────────────────────────────────────┘
```

Aturan UI:
- **Uji Koneksi wajib berhasil sebelum Simpan.** Panggilan termurah yang mungkin (satu permintaan token minimal, atau endpoint daftar model). Kunci yang salah ketik tidak boleh tersimpan diam-diam.
- Setelah disimpan, hanya 4 karakter terakhir yang ditampilkan. **Tidak ada tombol "lihat kunci"** — kunci tidak dapat dibaca kembali, hanya diganti.
- Estimasi biaya ditampilkan dalam Rupiah dengan kurs yang dapat dikonfigurasi, agar dosen paham konsekuensinya.
- Pesan bantuan singkat: di mana membuat kunci, perkiraan biaya menyusun satu RPKPS lengkap, dan penegasan bahwa kunci hanya dipakai atas perintah dosen sendiri.

### 2.3 Keamanan penyimpanan — tidak bisa ditawar

| Aspek | Aturan |
|---|---|
| Enkripsi saat diam | AES-256-GCM dengan *envelope encryption*: DEK per kredensial, KEK di KMS atau variabel lingkungan yang tidak masuk repo. **Jangan pernah menyimpan plaintext, jangan hanya base64.** |
| Enkripsi saat transit | HTTPS wajib; HSTS aktif |
| Akses | Dekripsi hanya di proses server, hanya saat memanggil penyedia. Tidak pernah masuk respons API, log, pesan error, atau *stack trace* |
| Pencatatan | Redaksi otomatis pada semua log: pola `sk-`, `Bearer `, header `Authorization`, `x-api-key` |
| Kepemilikan | Kunci pengguna hanya dapat diresolusi oleh sesi pengguna itu. Admin institusi **tidak bisa** memakai kunci dosen |
| Pencabutan | Nonaktifkan (langsung berhenti dipakai) terpisah dari hapus (kredensial hilang permanen) |
| Rotasi | Ganti kunci membuat versi baru; versi lama langsung tidak dapat dipakai |
| Batas | Maksimal ~3 kredensial aktif per pengguna, agar permukaan serangan tidak melebar |
| Pekerjaan latar | Kunci pengguna **tidak dipakai** untuk pekerjaan terjadwal/batch kecuali pengguna mencentang izin eksplisit |

> **Konsekuensi hukum & kepercayaan:** menyimpan kredensial pihak ketiga milik dosen adalah tanggung jawab yang serius. Cantumkan pernyataan singkat di halaman pengaturan: apa yang disimpan, bagaimana dienkripsi, kapan dipakai, dan bagaimana menghapusnya.

### 2.4 Abstraksi penyedia

Satu antarmuka internal, banyak adapter. Aplikasi berbicara dalam istilah `chat(schema, context, options)`, bukan dalam istilah SDK.

| Penyedia | Status | Catatan |
|---|---|---|
| **Anthropic (Claude)** | **Terpasang** (bawaan) | Kualitas terbaik untuk penalaran akademik berbahasa Indonesia; dukungan *structured output* dan *prompt caching* matang |
| Mistral | **Terpasang** | REST langsung, tanpa SDK. Tanpa prompt caching |
| **Google Gemini** | **Terpasang** | REST langsung. Caching implisit pada model 2.5 ke atas; `responseSchema` hanya menerima sebagian JSON Schema, jadi skema Zod disaring lebih dulu |
| OpenAI | Rencana | Banyak dosen sudah punya kunci |
| OpenAI-compatible | Rencana | Menampung DeepSeek, Qwen, Ollama lokal, atau server kampus — penting untuk kampus dengan kebijakan data ketat |

Model Claude yang relevan (harga per 1 juta token, masukan/keluaran):

| Model | ID | Konteks | Harga | Pakai untuk |
|---|---|---|---|---|
| Claude Opus 5 | `claude-opus-5` | 1M | $5 / $25 | Tugas berat: menurunkan CPL→CPMK→Sub-CPMK satu MK penuh, audit konsistensi dokumen |
| Claude Sonnet 5 | `claude-sonnet-5` | 1M | $3 / $15 | **Bawaan.** Sebagian besar tugas: rubrik, kisi-kisi, butir soal, materi |
| Claude Haiku 4.5 | `claude-haiku-4-5` | 200K | $1 / $5 | Tugas ringan: pemeriksa KKO, terjemahan, klasifikasi level Bloom |

Model bawaan dapat dikonfigurasi per jenis tugas, sehingga pekerjaan ringan tidak dibebankan ke model mahal.

---

## BAGIAN 3 — Di Mana AI Menambah Nilai

Dipetakan langsung ke wizard 11 langkah. Setiap baris adalah satu "tugas AI" dengan skema keluaran sendiri.

### 3.1 Tahap perencanaan

| # | Tugas AI | Masukan | Keluaran (terstruktur) |
|---|---|---|---|
| T1 | Rumuskan **CPMK** | CPL terpilih, deskripsi MK, sks, semester | 3–6 CPMK + peta ke CPL + level Bloom |
| T2 | Turunkan **Sub-CPMK** | CPMK, jumlah pertemuan | 12–16 Sub-CPMK + usulan urutan minggu |
| T3 | **Periksa KKO & Bloom** | Teks CPMK/Sub-CPMK | Daftar temuan: kata tak terukur, level melampaui induk, kata kerja ganda + usulan perbaikan |
| T4 | Usulkan **bahan kajian & materi** | Sub-CPMK, daftar pustaka yang dosen masukkan | Pokok & sub-pokok bahasan + rujukan **hanya dari pustaka yang ada** |
| T5 | Usulkan **metode pembelajaran** | Sub-CPMK + level Bloom + mode luring/daring | Metode per pertemuan + alasan singkat |
| T6 | Susun **aktivitas + durasi** | Pagu waktu mingguan, metode, sks | Daftar aktivitas dengan kategori TM/PT/BM dan menit — **wajib pas dengan pagu** |
| T7 | Tulis **lembar rencana tugas** | Sub-CPMK, jenis tugas | Tujuan, uraian, luaran, kriteria, jadwal |
| T8 | Buat **pemicu forum** | Sub-CPMK, materi | Kasus/pertanyaan pemicu + aturan partisipasi |

### 3.2 Tahap asesmen

| # | Tugas AI | Keluaran |
|---|---|---|
| T9 | Susun **rubrik analitik** | 3–5 kriteria × 4 level, deskriptor tiap sel, bobot |
| T10 | Susun **kisi-kisi UTS/UAS** | Matriks Sub-CPMK × jumlah butir × level Bloom × bentuk × skor, total 100 |
| T11 | Tulis **butir soal** | Soal + kunci + pembahasan + tag Sub-CPMK + level Bloom + tingkat kesukaran |
| T12 | **Tinjau butir soal** | Temuan: ambigu, kunci ganda, petunjuk tak sengaja, level tak sesuai |

### 3.3 Tahap tinjauan & evaluasi

| # | Tugas AI | Keluaran |
|---|---|---|
| T13 | **Reviewer virtual GPM** | Audit seluruh RPKPS terhadap 9 komponen wajib + konsistensi CPL↔CPMK↔asesmen. Daftar temuan berbobot |
| T14 | **Terjemahan bilingual** | CPL/CPMK/Sub-CPMK versi Inggris untuk akreditasi internasional |
| T15 | **Analisis capaian CPL** | Narasi + usulan tindak lanjut untuk Sub-CPMK bercapaian rendah |
| T16 | **Analisis butir** | Interpretasi daya beda & tingkat kesukaran menjadi rekomendasi perbaikan soal |

### 3.4 Tahap bahan ajar

| # | Tugas AI | Keluaran |
|---|---|---|
| T17 | **Kerangka modul ajar** | Outline bab, tujuan, ringkasan, latihan — dosen yang mengisi substansinya |
| T18 | **Kerangka slide** | Judul slide + poin kunci per pertemuan |
| T19 | **Ringkas pustaka** | Ringkasan bab dari dokumen yang dosen unggah, untuk mengisi kolom materi |

> **Tiga fitur paling berdampak** kalau harus memilih untuk MVP: **T1–T2** (menghilangkan halaman kosong yang paling ditakuti dosen), **T6** (satu-satunya cara neraca waktu terisi tanpa kerja manual berjam-jam), dan **T13** (mengubah proses review prodi dari berminggu-minggu jadi hitungan menit).

---

## BAGIAN 4 — Cara Kerja Teknis

### 4.1 Gerbang AI (AI Gateway)

Satu modul server yang dilewati semua panggilan:

```
Aksi pengguna ("Usulkan CPMK")
        ↓
[1] Otorisasi        — boleh tidak pengguna ini menyentuh RPKPS ini?
[2] Resolusi kredensial — kunci pengguna → prodi → institusi
[3] Cek kuota        — batas harian/bulanan pengguna belum terlampaui?
[4] Susun konteks    — ambil data dari DB, rakit sesuai urutan cache
[5] Estimasi token   — tolak lebih awal bila melebihi jendela konteks
[6] Panggil penyedia — dengan skema JSON + prompt caching + streaming
[7] Validasi keluaran — parse & validasi terhadap skema (Zod); ulangi 1× bila gagal
[8] Catat pemakaian  — token masuk/keluar, cache hit, biaya, latensi
[9] Simpan usulan    — status 'diusulkan', belum menyentuh dokumen
        ↓
UI panel usulan → dosen menerima per item → baru menulis ke tabel
```

Tidak ada satu pun panggilan LLM di luar gerbang ini. Itu yang membuat kuota, audit, dan keamanan kunci dapat ditegakkan di satu tempat.

### 4.2 Keluaran terstruktur — wajib

Semua tugas mendefinisikan skema JSON. Contoh T2 (Sub-CPMK):

```jsonc
{
  "type": "object",
  "properties": {
    "sub_cpmk": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "kode":         { "type": "string" },        // "Sub-CPMK-3"
          "cpmk_kode":    { "type": "string" },        // induk
          "rumusan":      { "type": "string" },
          "kko":          { "type": "string" },        // kata kerja utama
          "level_bloom":  { "type": "string", "enum": ["C1","C2","C3","C4","C5","C6"] },
          "minggu":       { "type": "array", "items": { "type": "integer" } },
          "alasan":       { "type": "string" }         // untuk ditampilkan ke dosen
        },
        "required": ["kode","cpmk_kode","rumusan","kko","level_bloom","minggu"],
        "additionalProperties": false
      }
    }
  },
  "required": ["sub_cpmk"],
  "additionalProperties": false
}
```

Pada Claude ini dikirim lewat `output_config.format` (`type: "json_schema"`), atau dengan `strict: true` bila dibungkus sebagai tool. Field `alasan` penting: dosen perlu tahu *mengapa* AI mengusulkan itu untuk bisa menilai usulannya.

### 4.3 Perakitan konteks & prompt caching

Prompt caching bekerja dengan **pencocokan awalan (prefix)** — satu byte berubah di depan membatalkan seluruh cache setelahnya. Urutan render: `tools` → `system` → `messages`. Maka konteks disusun dari yang paling stabil ke yang paling berubah:

```
┌─ STABIL (cache 1 jam) ─────────────────────────────┐
│ Panduan penyusunan RPKPS + kamus KKO Bloom         │
│ Kebijakan sks institusi + template dokumen         │
│ ← titik cache_control di sini                      │
├─ SEMI-STABIL (cache 5 menit) ──────────────────────┤
│ Kurikulum prodi: profil lulusan, seluruh CPL       │
│ ← titik cache_control kedua                        │
├─ BERUBAH ──────────────────────────────────────────┤
│ Mata kuliah ini: identitas, sks, pustaka, CPMK     │
│ Permintaan spesifik dosen                          │
└────────────────────────────────────────────────────┘
```

Blok pertama sama untuk **semua** dosen di institusi yang sama — dan pada BYOK, cache bersifat per-kunci, jadi tiap dosen membangun cache-nya sendiri. Itu justru alasan blok stabil harus benar-benar stabil: jangan pernah menyisipkan `new Date()`, ID sesi, atau nama pengguna ke dalamnya. Verifikasi dengan `usage.cache_read_input_tokens` — kalau selalu nol, ada yang membatalkan cache secara diam-diam.

Minimum blok yang bisa di-cache: 512 token pada Opus 5, 1024 pada Sonnet 5. Blok panduan RPKPS jauh melebihi itu, jadi aman.

### 4.4 Kendala yang harus dimasukkan ke prompt

Beberapa aturan hanya bisa ditegakkan bila dinyatakan eksplisit — dan diverifikasi ulang di kode:

| Kendala | Cara |
|---|---|
| Alokasi waktu harus pas dengan pagu | Sebutkan pagu di prompt (`TM 150', PT 180', BM 180'`), **lalu jumlahkan ulang di server**. Bila meleset >5%, minta perbaikan sekali; bila masih meleset, tampilkan apa adanya dengan peringatan |
| Rujukan hanya dari pustaka yang ada | Sertakan daftar pustaka bernomor; instruksikan hanya boleh merujuk nomor tersebut. **Tolak keluaran yang menyebut sumber di luar daftar** — ini menutup halusinasi ISBN/halaman |
| Bobot total 100% | Validasi di server, bukan percaya pada aritmetika model |
| Level Bloom tidak melampaui induk | Bandingkan di server terhadap CPMK induk |
| Tidak mengarang nomor regulasi | Injeksikan teks kebijakan yang berlaku; larang menyebut nomor peraturan yang tidak ada dalam konteks |

Pola umumnya: **prompt untuk mengarahkan, kode untuk memvalidasi.** Jangan pernah menjadikan model sebagai satu-satunya penjaga aturan yang bisa dihitung.

### 4.5 Pola interaksi — usulan, bukan penulisan

```
┌─ Sub-CPMK (4 usulan dari AI) ────────────────── Sonnet 5 · 14 dtk ─┐
│                                                                     │
│ ☐ Sub-CPMK-1  Mahasiswa mampu menjelaskan konsep normalisasi       │
│               basis data hingga bentuk 3NF (C2)                     │
│               ↳ Dari CPMK-1 · Minggu 3                              │
│               ↳ Alasan: prasyarat untuk perancangan skema di M5     │
│               [ Terima ]  [ Sunting lalu terima ]  [ Tolak ]        │
│                                                                     │
│ ☐ Sub-CPMK-2  …                                                     │
│                                                                     │
│ [ Terima semua ]   [ Buat ulang dengan catatan… ]   [ Tutup ]       │
└─────────────────────────────────────────────────────────────────────┘
```

Aturan:
- Panel tidak pernah menimpa isian yang sudah ada — selalu tampilkan berdampingan bila field terisi.
- "Buat ulang dengan catatan" mengirim ulang dengan arahan dosen (mis. *"terlalu teoretis, tambah porsi praktik"*) — jauh lebih berguna daripada tombol regenerate buta.
- Setiap field yang diterima dicatat: `sumber = 'ai'`, model, waktu, versi prompt, siapa yang menerima.
- Dosen yang menandatangani RPKPS tetap penanggung jawab penuh. AI tidak pernah muncul sebagai penulis.

### 4.6 Kendali biaya

| Mekanisme | Detail |
|---|---|
| Estimasi sebelum kirim | Tampilkan perkiraan token & biaya untuk operasi besar ("Turunkan seluruh Sub-CPMK: ± 12.000 token, ± Rp 900") |
| Kuota per pengguna | Batas harian & bulanan (jumlah panggilan dan/atau token). Dikonfigurasi admin; berlaku juga pada Mode A agar kunci dosen tidak terkuras oleh bug |
| Pemilihan model per tugas | Haiku untuk pemeriksa KKO & terjemahan, Sonnet untuk mayoritas, Opus hanya untuk penurunan CPL dan audit dokumen |
| Prompt caching | Pemangkasan terbesar untuk konteks kurikulum yang dipakai berulang |
| Dasbor pemakaian | Per pengguna: panggilan, token, cache hit, biaya, tugas termahal. Per institusi bila Mode B |
| Anti-double-submit | Kunci idempotensi per (rpkps_id, tugas, hash_input) — klik ganda tidak menagih dua kali |

### 4.7 Pengaman & risiko

| Risiko | Mitigasi |
|---|---|
| **Halusinasi pustaka** — mengarang judul, ISBN, nomor halaman | Rujukan wajib berasal dari daftar pustaka yang dosen masukkan; keluaran di luar daftar ditolak validator |
| **Mengarang regulasi** — menyebut pasal yang tidak ada | Teks kebijakan diinjeksikan; klaim regulasi di luar konteks ditolak |
| **Injeksi prompt dari berkas unggahan** — PDF pustaka berisi instruksi tersembunyi | Perlakukan isi dokumen sebagai **data tak tepercaya**, bukan instruksi. Batasi dalam penanda yang jelas; jangan pernah mengeksekusi perintah dari dalamnya |
| **Data mahasiswa bocor ke LLM** | Nama & NIM **tidak pernah** dikirim secara bawaan. Untuk analisis capaian, kirim data teragregasi/teranonimkan |
| **Ketergantungan berlebih** | Panel usulan selalu menuntut keputusan manusia; tidak ada mode "isi otomatis semua" |
| **Kebijakan data kampus** | Pakai API (bukan antarmuka chat konsumen) — data API tidak dipakai untuk pelatihan model. Sediakan opsi penyedia lokal/on-prem untuk kampus dengan aturan ketat |
| **Kunci bocor** | Enkripsi + redaksi log + rotasi + pencabutan (§2.3). Sediakan tombol "cabut semua kunci saya" |
| **Transparansi** | Toggle institusi: apakah dokumen mencantumkan catatan "disusun dengan bantuan AI, diverifikasi oleh dosen pengampu" |

### 4.8 Tambahan model data

```
ai_provider            id, kode, nama, base_url, jenis_auth, aktif
ai_credential          id, scope('user'|'prodi'|'institusi'), owner_id, provider_id,
                       label, ciphertext, iv, auth_tag, dek_terenkripsi,
                       hint_4_terakhir, model_bawaan, status, terakhir_dipakai,
                       terakhir_divalidasi, dibuat_pada
ai_prompt_template     id, kode_tugas, versi, sistem, instruksi, skema_json, aktif
ai_generation          id, kode_tugas, template_versi, rpkps_id, pengguna_id,
                       snapshot_input, keluaran_json, status('usulan'|'diterima'
                       |'ditolak'|'gagal'), diterima_oleh, diterima_pada
ai_usage_log           id, generation_id, provider, model, token_masuk, token_keluar,
                       token_cache_baca, token_cache_tulis, biaya_estimasi,
                       latensi_ms, kode_error, dibuat_pada
ai_quota               scope, owner_id, batas_harian, batas_bulanan, terpakai_hari,
                       terpakai_bulan, direset_pada
field_provenance       tabel, record_id, nama_field, sumber('manusia'|'ai'|'impor'),
                       generation_id, dibuat_pada
```

`field_provenance` adalah tabel yang paling mudah dilupakan dan paling mahal ditambahkan belakangan. Tanpanya, tidak ada cara menjawab pertanyaan asesor: *"bagian mana dari dokumen ini yang dihasilkan AI?"*

---

## BAGIAN 5 — Roadmap AI

Menempel pada roadmap induk, bukan jalur terpisah:

| Fase | Isi | Prasyarat |
|---|---|---|
| **AI-0 — Fondasi** | Manajemen kredensial (Mode A), enkripsi, uji koneksi, adapter Anthropic, gerbang AI, log pemakaian | Setelah F2 (penyusun RPKPS ada isinya) |
| **AI-1 — Perumusan** | T1 CPMK, T2 Sub-CPMK, T3 pemeriksa KKO, panel usulan, provenance | AI-0 |
| **AI-2 — Perencanaan** | T4 materi, T5 metode, T6 aktivitas+durasi (terikat neraca waktu) | AI-1 |
| **AI-3 — Asesmen** | T9 rubrik, T10 kisi-kisi, T11 butir soal, T12 tinjauan soal | F3 |
| **AI-4 — Penjaminan mutu** | T13 reviewer virtual, T14 bilingual | F4 |
| **AI-5 — Multi-penyedia** | Gemini dan Mistral **terpasang**; tersisa OpenAI, OpenAI-compatible, Mode B & C, kuota institusi | AI-1 |
| **AI-6 — Evaluasi** | T15 analisis capaian CPL, T16 analisis butir | F7 |
| **AI-7 — Bahan ajar** | T17–T19, unggah pustaka + ringkasan | F5 |

**Batas MVP AI: AI-0 sampai AI-2.** Itu sudah menyelesaikan bagian tersulit dari menyusun RPKPS (halaman kosong dan perhitungan waktu) dengan satu penyedia saja.

---

## BAGIAN 6 — Keputusan yang Perlu Ditetapkan

Menambah daftar enam pertanyaan di dokumen konsep pertama:

7. **Mode kunci** — mulai dari BYOK murni (Mode A), atau langsung hibrida (Mode C)?
8. **Penyedia awal** — hanya Anthropic dulu, atau multi-penyedia sejak fase pertama?
9. **Kebijakan data institusi** — apakah ada aturan yang melarang mengirim materi kurikulum ke layanan luar negeri? Kalau ya, adapter lokal (Ollama/server kampus) naik prioritas
10. **Transparansi dokumen** — apakah RPKPS yang terbit perlu mencantumkan keterangan bantuan AI?
11. **Kuota bawaan** — berapa batas harian yang wajar per dosen agar kunci pribadi tidak terkuras oleh kesalahan pemakaian?
12. **Data mahasiswa** — apakah analisis capaian CPL boleh menggunakan AI sama sekali, atau tetap murni perhitungan statistik?

Yang paling menentukan arsitektur: **nomor 7 dan 9.**
