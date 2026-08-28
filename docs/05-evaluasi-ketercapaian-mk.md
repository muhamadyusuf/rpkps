# Evaluasi Ketercapaian Mata Kuliah

> Status: **E1–E6 TERPASANG (24 Agustus 2026).** Seluruh tahapan selesai:
> peta asesmen, nilai, ketercapaian, tindak lanjut, agregasi prodi, analisis butir.
> Cakupan putaran pertama **E1–E4**. Nilai masuk lewat **impor XLSX per kelas**.
> **Kelas paralel umum terjadi di ITTS**, jadi lapisan `Kelas` wajib ada sejak awal.
> Dokumen ini menutup janji [00 §3.4](./00-konsep-rpkps.md) (rumus ketercapaian OBE),
> [00 §4.3](./00-konsep-rpkps.md) modul M13, dan temuan W7 pada
> [02 §2.2](./02-template-itts-dan-penyelarasan-industri.md). Bagian 5 berisi
> keputusan yang **perlu ditetapkan sebelum desain teknis**.

## BAGIAN 1 — Apa yang sebenarnya diminta pada akreditasi

Instrumen akreditasi tidak menanyakan "berapa nilai mahasiswa". Yang ditanyakan
adalah **apakah program studi punya bukti bahwa capaian pembelajaran diukur, hasilnya
dianalisis, dan hasil analisis itu mengubah sesuatu.** Tiga hal, bukan satu.

| Sumber | Yang dituntut |
|---|---|
| Permendikbudristek 53/2023 | SPMI berjalan dengan siklus **PPEPP** (Penetapan → Pelaksanaan → **Evaluasi** → **Pengendalian** → **Peningkatan**). Penilaian formatif *dan* sumatif; penilaian sumatif mengacu pada pemenuhan CPL |
| Instrumen LAM-INFOKOM 2.0 (2025) | Setiap kriteria diukur memakai siklus PPEPP. Kategori "Budaya Mutu" dan "Akuntabilitas" menuntut jejak evaluasi & tindak lanjut, bukan sekadar dokumen rencana |
| Praktik panduan PT (mis. LPMPP Unram 2024) | Evaluasi berjenjang **bottom-up**: mata kuliah → prodi → fakultas → universitas. Hasil tiap jenjang jadi bahan **Rapat Tinjauan Manajemen (RTM)** tiap semester |

Konsekuensinya untuk aplikasi ini: **aplikasi kita saat ini hanya memegang huruf P
pertama.** RPKPS adalah *Penetapan*. Halaman publik dan sidik SHA-256 membuktikan
*Pelaksanaan* terencana. Huruf E, P, dan P berikutnya belum punya tempat sama sekali.

Itulah lubang yang dilihat asesor: dokumen rencana rapi, tetapi tidak ada berkas yang
menjawab *"lalu, tercapai atau tidak? kalau tidak, apa yang Anda ubah?"*

## BAGIAN 2 — Tiga lapisan yang sering tercampur

Istilah "evaluasi mata kuliah" di lapangan menunjuk tiga hal berbeda. Mencampurnya
adalah cara tercepat membangun modul yang salah.

| Lapisan | Isi | Pemilik | Status di aplikasi |
|---|---|---|---|
| **L1 — Evaluasi hasil belajar** | Nilai mahasiswa, konversi huruf, KHS | SIAKAD/LMS | Di luar cakupan. Jangan bersaing |
| **L2 — Evaluasi ketercapaian** | Nilai Sub-CPMK → CPMK → CPL yang dibebankan pada MK, per mahasiswa dan per kelas | Dosen pengampu / koordinator MK | **Belum ada. Inti usulan ini** |
| **L3 — Evaluasi proses & tindak lanjut** | Refleksi, akar masalah, RTL, verifikasi RTL semester berikutnya | Koordinator MK → Kaprodi → GPM | **Belum ada. Ini yang paling dicari asesor** |

L2 tanpa L3 adalah angka tanpa akibat — persis keluhan asesor terhadap kebanyakan
prodi. L3 tanpa L2 adalah narasi tanpa dasar. Keduanya harus lahir bersama.

### 2.1 Portofolio mata kuliah

Bundel bukti yang lazim diminta per MK per semester: RPS/RPKPS yang disahkan, soal
UTS/UAS beserta kisi-kisinya, sampel jawaban (nilai tertinggi–sedang–terendah),
rekap ketercapaian CPMK, dan rencana perbaikan. Empat dari lima sudah dihasilkan
aplikasi ini. Yang hilang hanya dua terakhir — dan justru dua itu yang dinilai.

**Portofolio bukan modul baru; ia adalah satu tombol ekspor** di atas data yang sudah
ada plus hasil evaluasi. Perlakukan begitu, jangan jadikan entitas tersendiri.

### 2.2 Asesmen langsung dan tidak langsung

- **Langsung (direct):** ujian, tugas, laporan praktikum, presentasi, observasi —
  semuanya sudah terpetakan ke Sub-CPMK di `pertemuan`, `tugas`, dan `butir_kisi_kisi`.
- **Tidak langsung (indirect):** EPBM/kuesioner mahasiswa, tracer study, masukan DUDI.

Ketercapaian **hanya boleh dihitung dari asesmen langsung.** Asesmen tidak langsung
masuk sebagai konteks pada narasi evaluasi, tidak pernah sebagai angka capaian.

## BAGIAN 3 — Rumus dan ambang

Rumus sudah ditetapkan di [00 §3.4](./00-konsep-rpkps.md); dokumen ini hanya
mempertegas satu hal yang di sana masih kabur.

```
Nilai Sub-CPMK (mhs) = Σ(skor asesmen_i × bobot_i) / Σ bobot_i
Nilai CPMK     (mhs) = Σ(Nilai Sub-CPMK_j × bobot_j) / Σ bobot_j
Capaian CPL(MK)(mhs) = Σ(Nilai CPMK_k × kontribusi_k) / Σ kontribusi_k
Nilai akhir MK (mhs) = Σ(skor komponen × bobot komponen)
```

### 3.1 Dua ambang, dua pertanyaan berbeda

`Rpkps` sudah menyimpan `ambangKelulusanMhs` (ITTS: 55) dan `ambangKetercapaianMk`
(ITTS: 85). Keduanya sekarang **hanya dicetak di dokumen, tidak pernah dihitung**.
Keduanya menjawab pertanyaan yang berlainan dan laporan wajib memuat dua-duanya:

```
Lulus CPMK (per mahasiswa) : Nilai CPMK ≥ ambangKelulusanMhs        (55)
CPMK tercapai (per kelas)  : %mahasiswa lulus ≥ ambangKetercapaianMk (85%)
```

Melaporkan rata-rata kelas saja menyembunyikan sebaran: rata-rata 70 bisa berarti
semua di 70, bisa berarti separuh di 95 dan separuh di 45. Untuk akreditasi, **proporsi
yang lulus** adalah angka utama; rata-rata adalah pelengkap.

### 3.2 Kategori pelaporan

Panduan PT umumnya memakai empat pita — KURANG / SEDANG / BAIK / SANGAT BAIK. Batas
pita adalah **konfigurasi prodi**, sejajar dengan `kebijakan_bentuk` pada doc 03.
Jangan di-hardcode.

## BAGIAN 4 — Apa yang sudah ada, apa yang hilang

Kabar baiknya: seluruh **penyebut** sudah terpasang. Yang hilang hanya pembilangnya.

| Kebutuhan | Sudah ada? | Di mana |
|---|---|---|
| CPL dibebankan pada MK | ✅ | `matriks_cpl_mk` |
| CPMK → CPL | ✅ | `peta_cpmk_cpl` |
| Sub-CPMK → CPMK | ✅ | `sub_cpmk.cpmkId` |
| Asesmen → Sub-CPMK | ✅ | `pertemuan_sub_cpmk`, `tugas_sub_cpmk`, `butir_kisi_kisi.subCpmkId` |
| Bobot asesmen | ✅ | `pertemuan.bobot`, `tugas.bobot`, `kriteria_tugas.bobot`, `butir_kisi_kisi.skor`, `komponen_nilai.bobot` |
| Ambang | ✅ (tak terpakai) | `rpkps.ambangKelulusanMhs`, `ambangKetercapaianMk` |
| Validator Σbobot = 100% | ✅ | `B1`, `B2`, `I-BOBOT-KRITERIA` |
| **Mahasiswa** | ❌ | — |
| **Kelas / rombel** | ❌ | — |
| **Skor per mahasiswa per asesmen** | ❌ | — |
| **Hasil ketercapaian & pembekuannya** | ❌ | — |
| **Tindak lanjut (RTL) & verifikasinya** | ❌ | — |

### 4.1 Tiga masalah struktural yang harus dijawab lebih dulu

**(a) Bobot berserakan di tiga tempat — risiko hitung ganda.**
Sebuah Sub-CPMK bisa dinilai lewat baris mingguan *dan* lewat tugas *dan* lewat butir
kisi-kisi. `komponen_nilai` adalah satu-satunya yang dijamin berjumlah 100%.
Mesin evaluasi butuh **satu daftar asesmen kanonik** — kalau tidak, satu tugas bisa
terhitung dua kali dan angka capaian jadi karangan.

**(b) Satu RPKPS, banyak kelas paralel.**
`Rpkps` unik pada `(mataKuliahId, tahunAkademikId)`. **Dikonfirmasi: di ITTS satu MK
umum punya kelas A/B/C dengan dosen berbeda.** Ketercapaian **selalu milik kelas**,
sedangkan dokumen rencana milik MK. Maka `EvaluasiMk` menempel pada `Kelas`, tidak
pernah langsung pada `Rpkps`, dan tingkat MK selalu berupa **agregat lintas kelas**
— termasuk ketika kelasnya hanya satu.

Ikutannya: sebaran antar kelas jadi temuan tersendiri. Bila kelas A mencapai 92% dan
kelas B 61% atas rencana yang sama, yang bermasalah adalah pelaksanaan, bukan
rancangan — dan itu kesimpulan yang tidak akan pernah muncul dari angka gabungan.

**(c) W7 belum tuntas.**
Tabel distribusi ITTS memakai √ tanpa bobot numerik. Angka sudah tersedia di
`pertemuan.bobot`, jadi masalahnya bukan data — masalahnya **kontribusi CPMK→CPL
belum pernah dinyatakan sebagai angka**. Rumus `Capaian CPL(MK)` di §3 menuntut
`kontribusi_k`. Sekarang `peta_cpmk_cpl` hanya menyatakan keterkaitan, bukan besaran.

## BAGIAN 5 — Keputusan yang sudah ditetapkan

### 5.1 Dari mana skor mahasiswa masuk?

| Opsi | Untung | Rugi |
|---|---|---|
| **A. Impor XLSX per kelas** (rekomendasi) | Cocok dengan kebiasaan dosen; tanpa integrasi; bisa jalan minggu depan. Pola impor sudah terbukti di `src/lib/kurikulum/excel.ts` | Impor ulang tiap semester; perlu validasi kolom yang ketat |
| B. Entri manual di aplikasi | Tanpa berkas perantara | Dosen mengetik ulang nilai yang sudah ada di Excel/LMS — penyebab nomor satu modul analitik jadi kosong (00 §7) |
| C. Integrasi SIAKAD/LMS | Sekali sambung, seterusnya jalan | SIAKAD menyimpan nilai **komponen**, bukan skor per Sub-CPMK. Integrasi tidak menghilangkan kebutuhan pemetaan |

**Ditetapkan: A — impor XLSX per kelas.** C menyusul bila integrasi tersedia.
Bentuk berkas impor diturunkan otomatis
dari peta asesmen RPKPS itu sendiri (satu kolom per asesmen), sehingga templatnya
selalu cocok dan tidak perlu dokumentasi terpisah.

### 5.2 Seberapa banyak data mahasiswa disimpan?

**Ditetapkan: seminimal mungkin** — NIM, nama, angkatan, kelas. Cukup untuk
menghitung sebaran dan untuk menelusuri sampel jawaban saat asesor bertanya; tidak
cukup untuk berubah jadi SIAKAD bayangan. NIM disimpan karena capaian CPL tingkat
prodi (rumus di 00 §3.4 baris terakhir) menuntut penelusuran mahasiswa lintas MK.

### 5.3 Satu daftar asesmen kanonik

**Ditetapkan: turunkan, jangan simpan ganda.** *(Terpasang di `susunPetaAsesmen`.)*
Satu fungsi domain murni memproyeksikan
`pertemuan` + `tugas` + `kisi_kisi` menjadi daftar `Asesmen { kode, nama, komponenNilai,
subCpmk[], bobot }`, lalu **memvalidasi Σbobot = 100% dan tidak ada bobot terhitung dua
kali** sebelum evaluasi boleh dibuka. Daftar itu dibekukan saat evaluasi ditutup.

*Alternatif yang ditolak:* tabel `asesmen` yang diisi manual. Itu menambah tempat
keempat untuk bobot dan menjamin ketiga tempat lain menyimpang darinya.

### 5.4 Kontribusi CPMK → CPL: angka dari mana?

**Ditetapkan: turunkan dari bobot asesmen**, bukan minta dosen mengisi matriks lagi.
Kontribusi CPMK terhadap sebuah CPL = Σ bobot asesmen Sub-CPMK di bawah CPMK itu,
dinormalkan terhadap seluruh CPMK yang memetakan ke CPL tersebut. Dosen sudah
menyatakan bobotnya di tabel mingguan; meminta angka kedua hanya menciptakan dua
kebenaran yang saling bertentangan.

### 5.5 Hasil evaluasi dibekukan — dengan sidik sendiri

Nilai berubah setelah remedial, ralat entri, atau susulan. Laporan akreditasi harus
bisa diulang persis. Maka evaluasi punya `EvaluasiSnapshot` + sidik SHA-256 sendiri,
mengikuti pola `RpkpsSnapshot`.

> **Garis keras:** hasil evaluasi **tidak boleh masuk `proyeksiIsi()`.** Menambahkannya
> menggeser sidik SELURUH RPKPS terbit dan memunculkan peringatan pergeseran palsu —
> aturan yang sama yang melindungi profil lulusan (AGENTS.md). Evaluasi adalah dokumen
> **berdampingan**, bukan bagian dari RPKPS.

### 5.6 Tindak lanjut adalah warga kelas satu — dan menyambung ke doc 04

Inilah yang menutup siklus PPEPP, dan satu-satunya bagian yang tidak bisa dihitung
mesin. Satu temuan evaluasi menyimpan: capaian terukur, akar masalah, tindakan,
penanggung jawab, TA sasaran, lalu **status verifikasi pada semester berikutnya**.

Sambungan yang membuat seluruh rangkaian ini bernilai: `TEMUAN_EVALUASI` menjadi
`JenisDasar` baru pada [Usulan Revisi Kurikulum](./04-usulan-revisi-kurikulum.md) §2.3.
Dengan itu jalurnya lengkap dan dapat ditelusuri asesor dalam satu tarikan:

```
RPKPS terbit → nilai masuk → ketercapaian dihitung → CPMK di bawah ambang
   → temuan + RTL → usulan revisi kurikulum → Kaprodi sahkan → berlaku TA berikutnya
   → RPKPS baru → dievaluasi lagi → RTL diverifikasi tercapai/tidak
```

Tidak ada modul lain di aplikasi ini yang bisa menghasilkan kalimat itu. Ini nilai
jual terbesar modul evaluasi, bukan grafiknya.

### 5.7 Aturan penutup hitung ganda (hasil E1)

Pertanyaan yang tersisa dari §4.1(a) — *siapa yang menang ketika baris mingguan dan
lembar tugas menunjuk komponen yang sama* — dijawab begini di `susunPetaAsesmen`:

1. `komponen_nilai` adalah **buku besar** bobot; totalnya wajib 100%.
2. Sebuah komponen dirinci baris mingguan **atau** lembar tugas, tidak pernah keduanya.
   Bila baris mingguan sudah merincinya, lembar tugas dibaca sebagai *rencana* baris
   itu — bobotnya **tidak** ditambahkan. Selisih angka keduanya jadi peringatan
   `PA-TUGAS-BEDA-BOBOT`, bukan pemblokir: yang salah adalah lembarnya, bukan hitungannya.
3. Komponen yang tidak dirinci siapa pun adalah pemblokir — ada nilai yang tidak akan
   pernah bisa dikumpulkan.
4. Bobot tiap asesmen dibagi ke Sub-CPMK yang ditagihnya: mengikuti skor butir
   kisi-kisi bila ada, selebihnya rata. Pembagian rata pada ujian ditandai
   `PA-UJIAN-TANPA-KISI-KISI` — capaiannya tetap terhitung, tetapi dasarnya tebakan.

Temuan peta **tidak memblokir penerbitan RPKPS** (`validasiRpkps` tetap penentu itu).
Yang diblokirnya adalah pembukaan evaluasi pada E3: capaian tidak boleh dihitung di
atas peta bobot yang belum tertutup.

| Kode | Tingkat | Arti |
|---|---|---|
| `PA-KOSONG` | pemblokir | Tidak ada satu pun asesmen berbobot |
| `PA-TANPA-KOMPONEN` | pemblokir | Baris/tugas berbobot tidak masuk komponen nilai |
| `PA-KOMPONEN-TANPA-ASESMEN` | pemblokir | Komponen berbobot tidak dirinci apa pun |
| `PA-KOMPONEN-TIDAK-COCOK` | pemblokir | Σ asesmen dalam komponen ≠ bobot komponen |
| `PA-TOTAL` | pemblokir | Σ seluruh asesmen ≠ 100% |
| `PA-ASESMEN-TANPA-SUB-CPMK` | pemblokir | Bobot tidak mengalir ke capaian mana pun |
| `PA-SUB-CPMK-TANPA-BOBOT` | pemblokir | Sub-CPMK tidak pernah dinilai |
| `PA-SUB-CPMK-ASING` | pemblokir | Asesmen menagih Sub-CPMK milik MK lain |
| `PA-CPL-TANPA-BOBOT` | pemblokir | CPL dibebankan tetapi tidak pernah dinilai (B3 doc 02) |
| `PA-TUGAS-BEDA-BOBOT` | peringatan | Lembar tugas menyebut bobot berbeda dari baris mingguan |
| `PA-UJIAN-TANPA-KISI-KISI` | peringatan | Bobot ujian terpaksa dibagi rata |

### 5.8 Tabel distribusi penilaian memakai peta yang sama (hasil E1)

Tabel distribusi pada bagian E dokumen ITTS dulu menurunkan tanda √ langsung
dari `pertemuan.subCpmk`. Akibatnya kolom **UTS dan UAS selalu kosong**: baris
ujian pada tabel mingguan memang tidak menempel Sub-CPMK — Sub-CPMK ujian hidup
di kisi-kisi. Dokumen resmi karena itu menyatakan, hitam di atas putih, bahwa
ujian tidak mengukur capaian apa pun.

Sekarang sumbernya `petaKomponenSubCpmk`, sehingga dari mana pun bobot sebuah
komponen dirinci — baris mingguan, lembar tugas, atau butir kisi-kisi —
Sub-CPMK yang ditagihnya sampai ke tabel yang sama. Yang dicetak tetap √, sesuai
pakem ITTS; yang disimpan tetap angka (docs/02 §2.2).

> **Catatan untuk RPKPS yang sudah terbit.** Salinan bekunya tidak berubah dan
> sidik SHA-256-nya tetap sama — `proyeksiIsi()` tidak disentuh sama sekali.
> Yang berubah hanya cara salinan itu **dicetak**: kolom ujian yang dulu kosong
> kini terisi. Berkas DOCX-nya karena itu tidak lagi identik bita-per-bita
> dengan yang diunduh sebelum perbaikan ini, meskipun isinya sama persis.

### 5.9 Nilai masuk setelah dokumen terbit (hasil E2)

Satu perbedaan yang mudah terlewat: penyuntingan RPKPS dikunci begitu status
menjadi DIAJUKAN atau TERBIT, tetapi **nilai justru baru masuk setelah itu** —
saat semester berjalan dan berakhir. Wewenang kelas dan nilai karena itu tidak
memakai `dapatDisunting`; yang dijaga hanya cakupan prodi dan kepengampuan.

Aturan penyimpanan yang dipilih, semuanya bertumpu pada satu prinsip — berkas
nilai adalah sumber kebenaran untuk **kolom yang ada di dalamnya**, dan bukan
untuk apa pun di luar itu:

| Keadaan | Perlakuan |
|---|---|
| NIM belum pernah tercatat | Mahasiswa dibuat sambil jalan. Mewajibkan pendaftaran lebih dulu adalah gesekan yang membuat modul analitik berakhir kosong (00 §7) |
| Sel diisi angka | Disimpan; `0` berarti dinilai nol |
| Sel dikosongkan | Nilai lama **dihapus** — dikosongkan berarti ditarik kembali |
| Kolom tidak ada di berkas | Tidak disentuh sama sekali |
| Peserta lama tidak ada di berkas | Dibiarkan. Menghapusnya akan melenyapkan nilainya lewat cascade |
| Angkatan | Hanya **diisi**, tidak pernah ditimpa — berkas nilai bukan sumber kebenaran data mahasiswa |
| Kelas berisi nilai | Tidak dapat dihapus. Nilai adalah bukti pelaksanaan |

Templat XLSX **dihasilkan ulang setiap kali diunduh**, bukan disimpan: judul
kolomnya adalah kode asesmen dari peta asesmen yang berlaku saat itu, dan nilai
yang sudah tersimpan ikut terisi. Unduhan berikutnya adalah lanjutan, bukan
mulai dari kosong.

### 5.11 Agregasi prodi ditimbang sks (hasil E5)

Rumus terakhir docs/00 §3.4 — `Capaian CPL Prodi = Σ(Capaian CPL(MK) × sks_MK) / Σ sks_MK`
— punya satu konsekuensi yang mudah terlewat: **rata-rata polos memberi hasil
yang berbeda dan lebih menyanjung.** Pada data uji, empat evaluasi menghasilkan
82,15% bila ditimbang sks dan 85,5% bila tidak; selisihnya cukup untuk memindahkan
sebuah CPL dari "belum tercapai" ke "tercapai". Mata kuliah 1 sks yang menyentuh
CPL sekilas tidak boleh setara dengan mata kuliah 4 sks yang menanggungnya.

Tiga aturan lain yang dipilih:

- **Hanya evaluasi berstatus DITUTUP yang dihitung.** Kalau tidak, angka prodi
  bergerak setiap kali seorang dosen menyunting satu nilai.
- **Cakupan dilaporkan, bukan disembunyikan.** `AG-CAKUPAN-RENDAH` menyala di
  bawah 75% mata kuliah — ambang yang lazim dituntut panduan penjaminan mutu.
  Capaian 90% atas 20% mata kuliah bukan capaian prodi, itu sampel yang dipilih.
- **CPL tanpa data adalah pemblokir, bukan sel kosong.** Selama sebuah CPL belum
  pernah terukur, prodi tidak dapat menyatakan capaian lulusannya — hanya menduga.

Lembar "Rincian" pada ekspor XLSX memuat baris asal tiap angka agregat sampai ke
kelas dan tahun akademiknya. Pertanyaan pertama asesor selalu *"angka ini dari
mana"*, dan jawabannya harus ada di berkas yang sama.

### 5.12 Analisis butir bersifat opsional (hasil E6)

Analisis butir butuh skor **per soal**, sedangkan capaian hanya butuh skor per
asesmen. Karena itu `NilaiButir` dipisah dari `NilaiAsesmen`, dan lembar butir
pada templat nilai boleh dibiarkan kosong — prodi yang tidak merekamnya tetap
mendapat seluruh E1–E5.

| Ukuran | Rumus | Kategori |
|---|---|---|
| Tingkat kesukaran `P` | rerata skor butir / skor maksimum | SUKAR < 0,3 · SEDANG · MUDAH > 0,7 |
| Daya beda `D` | (rerata 27% atas − rerata 27% bawah) / skor maksimum | BURUK < 0 · JELEK < 0,2 · CUKUP < 0,3 · BAIK < 0,4 · SANGAT BAIK |
| Reliabilitas `α` | Cronbach: (k/(k−1)) × (1 − Σσ²ᵢ / σ²ₜ) | memadai bila ≥ 0,7 |

Kelompok 27% adalah proporsi baku Kelley. Peserta yang skornya tidak lengkap
dikeluarkan: total yang tidak setara membuat pemeringkatan atas–bawah menyesatkan.

**Tidak satu pun temuannya memblokir apa pun** — termasuk daya beda negatif.
Butir dengan `D < 0` berarti mahasiswa berperingkat atas justru lebih sering
salah, yang hampir selalu menandakan kunci keliru atau pertanyaan bermakna
ganda. *Hampir* selalu: mesin tidak dapat membedakannya dari butir sukar yang
membuat mahasiswa terbaik berpikir terlalu jauh. Menyandera penutupan evaluasi
atas dugaan itu akan menjebak pengguna tanpa jalan keluar, jadi modul ini
menunjukkannya dengan tegas dan menyerahkan putusannya pada dosen.

## BAGIAN 6 — Sketsa model data (usulan, belum final)

Seluruhnya sudah terpasang (E2–E6).

```
Kelas            rpkpsId, kode ("A"), dosenId                        ✅
Mahasiswa        prodiId, nim, nama, angkatan?                       ✅
PesertaKelas     kelasId, mahasiswaId                                ✅
NilaiAsesmen     pesertaKelasId, asesmenKode, skor(0-100)            ✅
EvaluasiMk       kelasId, status(DRAF|DIHITUNG|DITUTUP), versi,
                 ambang tersalin, catatanProses, ditutupOlehId          ✅
HasilCapaian     evaluasiId, tingkat(SUB_CPMK|CPMK|CPL), kode,
                 rerata, persenLulus, tercapai, pita, jumlahDinilai     ✅
TemuanEvaluasi   evaluasiId, tingkat, kode, capaianTerukur, akarMasalah,
                 tindakan, penanggungJawabId, taSasaranId,
                 statusVerifikasi, usulanId                             ✅
EvaluasiSnapshot evaluasiId, versi, isi(Json), sidik(SHA-256)           ✅
NilaiButir       pesertaKelasId, butirKisiKisiId, skor  — opsional (E6)  ✅
```

Catatan yang mengikat: `EvaluasiMk` **tidak pernah dihapus** — sejajar dengan aturan
pensiun capaian pada doc 04 §2.4. Evaluasi yang salah dibatalkan dengan status, bukan
dengan `DELETE`, karena ia adalah bukti bahwa proses pernah dijalankan.

### 5.10 Penutupan evaluasi ditegakkan kode (hasil E3–E4)

Yang membedakan evaluasi dari laporan nilai adalah apa yang terjadi ketika
angkanya jelek. Karena itu penutupan evaluasi punya syarat, dan syaratnya
diperiksa `periksaPenutupan`, bukan diserahkan pada kerelaan pengisi borang:

| Kode | Arti |
|---|---|
| `EV-TANPA-PESERTA` | Kelas belum punya peserta |
| `EV-BELUM-LENGKAP` | Masih ada sel nilai kosong. Angka tetap dihitung dari yang ada, tetapi catatan resmi tidak boleh berdiri di atas data sebagian |
| `TL-TANPA-REFLEKSI` | Catatan proses pembelajaran belum diisi |
| `TL-TANPA-RTL` | **Ada CPMK tidak tercapai yang belum punya tindak lanjut** — di sinilah siklus PPEPP berhenti kalau dibiarkan |
| `TL-AKAR-PENDEK`, `TL-TINDAKAN-PENDEK` | Akar masalah atau tindakan sekadar formalitas |
| `TL-TANPA-TA-SASARAN` | Tindakan tanpa tahun akademik pemberlakuan — tidak pernah jatuh tempo, tidak dapat diverifikasi |

`TL-CPL-BELUM-TERCAPAI` sengaja hanya peringatan: CPL menyentuh seluruh prodi,
dan satu mata kuliah tidak menanggungnya sendirian — batas yang sama dengan
`CATATAN_CPL` pada [doc 04 §2.2](./04-usulan-revisi-kurikulum.md).

**Versi, bukan timpa.** Nilai berubah setelah remedial. Membuka kembali evaluasi
menaikkan versinya dan menulis salinan beku baru; salinan lama tidak disentuh,
sehingga laporan yang pernah disahkan tetap dapat diulang persis. Ambang ikut
**disalin** saat penutupan — kalau prodi mengubah ambangnya tahun depan, catatan
tahun ini tetap terbaca dengan aturan yang berlaku saat itu.

**Verifikasi lintas semester.** `nilaiVerifikasi` membandingkan tindak lanjut
yang dijanjikan semester lalu dengan capaian semester ini, lalu **mengusulkan**
TERCAPAI atau TIDAK_TERCAPAI. Usulan, bukan putusan: capaian bisa naik oleh
sebab lain, dan yang memutuskan tetap manusia.

**Sambungan ke URK.** Tombol "Teruskan jadi usulan revisi" membuat amplop
`UsulanRevisi` berstatus draf dan menautkannya ke temuan. Yang **tidak** dibuat
adalah butir perubahannya: sistem tahu ada yang tidak tercapai, tetapi tidak tahu
rumusan penggantinya — itu keputusan dosen, dan doc 04 §2.1 menuntut butir yang
dapat diterapkan kode secara deterministik. Temuan menjadi **dasar**-nya lewat
`JenisDasar.TEMUAN_EVALUASI` dengan `ref` berisi id temuan.

## BAGIAN 7 — Tahapan yang disarankan

| Tahap | Isi | Bisa dipakai untuk |
|---|---|---|
| **E1 — Peta asesmen** ✅ | `src/domain/evaluasi/peta-asesmen.ts` + `pemetaan.ts`, 18 uji, halaman `/rpkps/[id]/asesmen`, ringkasan pada halaman RPKPS | Menutup W7. **Berguna bahkan tanpa satu pun nilai masuk** — menunjukkan MK mana yang rencananya tak terukur |
| **E2 — Nilai masuk** ✅ | Model `Kelas`/`Mahasiswa`/`PesertaKelas`/`NilaiAsesmen`, `src/domain/evaluasi/nilai.ts`, templat & pembaca XLSX, halaman `/rpkps/[id]/kelas` | Dosen berhenti pakai Excel terpisah |
| **E3 — Ketercapaian** ✅ | `capaian.ts` (2 ambang, 4 pita), `proyeksi.ts` + sidik SHA-256 tersendiri, `EvaluasiMk`/`HasilCapaian`/`EvaluasiSnapshot`, halaman `/rpkps/[id]/kelas/[kelasId]` | Laporan ketercapaian per MK siap cetak |
| **E4 — Tindak lanjut** ✅ | `tindak-lanjut.ts` (syarat penutupan, verifikasi lintas semester), `TemuanEvaluasi`, `JenisDasar.TEMUAN_EVALUASI`, ekspor portofolio MK | **Siklus PPEPP tertutup dan terbukti** |
| **E5 — Agregasi prodi** ✅ | `agregasi.ts` (tertimbang sks, tren, sebaran kelas, cakupan), halaman `/evaluasi`, ekspor XLSX LKPS/LED | Bahan borang tingkat prodi |
| **E6 — Analisis butir** ✅ | `analisis-butir.ts` (kesukaran, daya beda 27%, Cronbach α), model `NilaiButir`, lembar butir opsional pada templat nilai | Perbaikan mutu soal |

**Ditetapkan: putaran pertama E1–E4.** E5–E6 kemudian ikut diselesaikan pada
hari yang sama. E1 tetap dikerjakan lebih dulu dan berdiri sendiri: ia berguna
bahkan sebelum satu nilai pun masuk.

## BAGIAN 8 — Risiko

| Risiko | Mitigasi |
|---|---|
| Nilai tidak pernah diisi → modul kosong (00 §7) | E1 berguna tanpa nilai; templat impor diturunkan otomatis dari RPKPS |
| Angka capaian dipakai menilai kinerja dosen | Ikuti sikap yang sudah diambil pada 02 §7 untuk skor kesegaran: hasil terlihat koordinator MK, Kaprodi, GPM; **tidak** dipakai sebagai penilaian dosen. Nyatakan di antarmuka |
| Dosen mengarang capaian agar lolos ambang | Capaian selalu turunan skor mentah yang tersimpan; snapshot bersidik; ambang milik prodi, bukan milik dosen |
| Bobot rencana ≠ bobot yang benar-benar dinilai | Validator hitung-ganda pada E1 + penutupan evaluasi menolak Σbobot ≠ 100% |
| Modul melebar jadi SIAKAD | Data mahasiswa dibatasi empat kolom; tanpa presensi, tanpa KHS, tanpa transkrip |
| Data nilai mahasiswa = data pribadi | Akses per peran; `ASESOR` hanya melihat agregat, tidak melihat NIM |

## Referensi

- [Permendikbudristek No. 53 Tahun 2023 — Penjaminan Mutu Pendidikan Tinggi](https://bpm.unair.ac.id/permendikbudristek-no-53-tahun-2023-tentang-penjaminan-mutu-pendidikan-tinggi/)
- [Panduan Evaluasi Ketercapaian Capaian Pembelajaran — LPMPP Universitas Mataram, 2024](https://pasca.unram.ac.id/gpm/wp-content/uploads/sites/10/2025/05/Buku-Panduan-Evaluasi-Ketercapaian-CPL.pdf)
- [Instrumen Akreditasi Program Studi LAM-INFOKOM](https://laminfokom.or.id/official/img/instrumen/instrumen_4174Lampiran%206%20PerBAN-PT%2015%202021%20Instrumen%20APS%20Sarjana%20Infokom.pdf)
- [Instrumen Akreditasi 2.0 LAM-INFOKOM 2025 — ringkasan perubahan](https://sevima.com/instrumen-akreditasi-2-0-lam-infokom-2025-standar-baru-untuk-prodi-informatika-dan-komputer/)
- [Panduan Monitoring dan Evaluasi Proses Pembelajaran — PGSD Unismuh](https://pgsd.unismuh.ac.id/wp-content/uploads/2024/08/10.-PANDUAN_MONEV-PEMBELAJARAN-EDISI-REVISI-KE1.pdf)
- [Standar Proses Pembelajaran & Penilaian pada Permendikbudristek 53/2023](https://sevima.com/inilah-standar-proses-pembelajaran-dan-penilaian-baru-di-permendikbudristek-no-53-tahun-2023/)
