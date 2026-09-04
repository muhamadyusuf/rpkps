# Penyuntingan Naskah dan Kesiapan Terbit

> Status: **TERPASANG (E1–E6).**
> Dua tahap baru di antara "bab sudah ditulis" dan "buku diserahkan ke
> penerbit": **penyuntingan naskah** oleh AI sebagai editor, dan **pemeriksaan
> kesiapan terbit**.

Keputusan yang sudah diambil:

| Pertanyaan | Keputusan |
|---|---|
| Bentuk hasil | Usulan yang disetujui dosen SATU PER SATU |
| Cakupan | Konsistensi istilah, pengulangan & urutan, keselarasan tujuan, bahasa & keterbacaan |
| Penandaan | Menerima usulan DIHITUNG sebagai suntingan manusia |
| Tambahan | Tahapan yang membuat buku siap terbit |

---

## BAGIAN 1 — Editor, bukan penulis kedua

Tahap ini bukan penulisan ulang. Model diminta bekerja sebagaimana editor
naskah bekerja: menunjuk kalimat tertentu, mengusulkan penggantinya, dan
**menyebut alasannya**. Dosen membaca keduanya berdampingan lalu memutuskan.

**E1 · Usulan, bukan penerapan.** Tidak ada satu pun jalur yang membuat model
menulis langsung ke naskah pada tahap ini. Alasannya bukan kehati-hatian
belaka: naskah hasil dua lapis tulisan model tanpa satu pun pembacaan manusia
adalah persis keadaan yang peringatan di halaman hak cipta ada untuk
mencegahnya (docs/16 P4).

**E2 · Tidak ada "terima semua".** Ditolak dengan sadar. Begitu tombol itu ada,
ia yang akan dipakai, dan seluruh tahap ini berubah menjadi penulisan ulang
dengan satu langkah tambahan.

**E3 · Menerima usulan DIHITUNG sebagai suntingan manusia.** Dosen membaca
kutipan aslinya, membaca penggantinya, membaca alasannya, lalu memutuskan —
itu pembacaan yang sesungguhnya. Karena itu `disuntingPada` terisi, dan
`BA-SELURUHNYA-AI` padam. Penandaan ini sah HANYA selama E2 berlaku; bila
kelak ada tombol terima-semua, penandaan ini harus ikut dicabut.

**E4 · Yang dapat dihitung mesin tidak dikirim ke model.** Panjang kalimat,
panjang paragraf, ejaan istilah yang tidak konsisten, kata kerja tujuan
pembelajaran yang tidak pernah muncul di uraian — semuanya deterministik,
gratis, dan dapat diuji. Mengirimkannya ke model berarti menyuruh dosen
membayar token untuk pekerjaan yang jawabannya pasti, dan menerima jawaban
yang kadang berbeda tiap kali ditanya.

---

## BAGIAN 2 — Pembagian kerja

### 2.1 Mekanis — `src/domain/bahan-ajar/naskah.ts`, murni

| Kode | Yang ditemukan |
|---|---|
| `NS-KALIMAT-PANJANG` | kalimat melebihi 30 kata |
| `NS-PARAGRAF-PANJANG` | paragraf melebihi 150 kata |
| `NS-ISTILAH-TAK-SERAGAM` | satu istilah ditulis beberapa cara (huruf besar, tanda hubung) |
| `NS-TUJUAN-TAK-TERSENTUH` | kata kerja operasional sebuah tujuan tidak pernah muncul di uraian babnya |
| `NS-BAB-TIMPANG` | panjang sebuah bab jauh di luar rata-rata buku |
| `NS-PUSTAKA-TAK-DISITIR` | pustaka yang tidak pernah dirujuk bab mana pun |
| `NS-BAB-TANPA-SITIRAN` | bab yang tidak merujuk satu pustaka pun |
| `NS-GLOSARIUM-TAK-DIPAKAI` | istilah glosarium yang tidak muncul di bab mana pun |

Satu batas yang disadari: `NS-ISTILAH-TAK-SERAGAM` bekerja PER KATA, jadi
"Sub-CPMK" dan "Sub CPMK" tidak dapat dibandingkan — yang kedua terpecah
menjadi dua kata sebelum sempat dinilai. Menangkapnya menuntut pencarian
frasa, dan frasa dua kata yang kebetulan berdampingan melahirkan lebih banyak
gangguan daripada temuan. Yang seperti itu diserahkan ke `TINJAU_NASKAH`.

`NS-TUJUAN-TAK-TERSENTUH` memakai kamus KKO yang sudah ada
(`src/domain/kurikulum/bloom.ts`). Inilah pemeriksaan yang paling khas OBE di
seluruh aplikasi: bab yang menjanjikan "mahasiswa mampu menghitung" tetapi
tidak pernah menghitung apa pun tidak melanggar tata bahasa mana pun — ia
hanya gagal mengajar apa yang dijanjikannya.

Temuan mekanis TIDAK disimpan. Ia deterministik, jadi menghitungnya ulang
tiap kali halaman dibuka lebih murah daripada menjaga baris basi tetap sejalan.

### 2.2 Pertimbangan — dua tugas AI

**`SUNTING_BAB`**, per bab. Diberi uraian bab beserta tujuannya, mengembalikan
daftar usulan: kutipan asli yang PERSIS ada di dalam uraian, penggantinya, dan
alasannya.

**`TINJAU_NASKAH`**, sekali untuk seluruh buku. Diberi judul dan RINGKASAN tiap
bab beserta daftar istilah, mengembalikan temuan lintas bab: pengulangan,
lompatan urutan (istilah dipakai jauh sebelum didefinisikan), dan istilah yang
sebaiknya diseragamkan. Ringkasan, bukan naskah penuh — alasannya sama dengan
tahap kelengkapan (docs/16 §3.4).

---

## BAGIAN 3 — Usulan disimpan, tidak menguap

Berbeda dari usulan diagram yang berumur satu layar, usulan penyuntingan
DISIMPAN. Satu tinjauan atas buku empat belas bab menghasilkan puluhan usulan,
dan tidak ada dosen yang menyelesaikannya dalam satu duduk.

```prisma
// Bernama panjang karena `StatusUsulan` sudah dipakai usulan revisi
// kurikulum (docs/04) — dua benda berbeda tidak boleh berbagi satu nama enum.
enum JenisUsulanSunting  { BAHASA, ISTILAH, PENGULANGAN, TUJUAN, STRUKTUR }
enum StatusUsulanSunting { TERBUKA, DITERIMA, DITOLAK, KEDALUWARSA }

model UsulanSunting {
  id         String
  bukuAjarId String
  /// Null untuk temuan lintas bab.
  babId      String?
  jenis      JenisUsulanSunting
  /// Kutipan PERSIS dari uraian bab. Null berarti usulan bersifat nasihat —
  /// tidak ada yang dapat diganti otomatis.
  kutipan    String?
  usul       String
  alasan     String
  status     StatusUsulanSunting
  dibuatPada DateTime
  diputusPada DateTime?
}
```

Menerima usulan bertkutipan mengganti **kemunculan pertama** kutipan itu di
dalam `bab.uraian`. Bila kutipannya sudah tidak ada — dosen menyuntingnya lebih
dulu — usulan itu ditandai kedaluwarsa, bukan dipaksakan: mengganti teks yang
sudah berubah berarti menimpa suntingan dosen dengan usulan atas naskah lama.

Usulan yang ditolak TIDAK dihapus. Menjalankan tinjauan ulang tidak boleh
memunculkan kembali usulan yang sudah ditolak sekali — itu cara tercepat
membuat dosen berhenti membacanya.

---

## BAGIAN 4 — Kesiapan terbit

Halaman sampul buku mendapat satu bagian baru: daftar periksa yang menjawab
satu pertanyaan — apakah naskah ini dapat diserahkan.

| Kode | Syarat |
|---|---|
| `KT-METADATA` | judul, penulis, penerbit, kota, tahun terisi |
| `KT-ISBN` | ISBN terisi dan digit periksanya sah |
| `KT-HALAMAN` | taksiran tebal naskah ≥ 49 halaman |
| `KT-BAB-KOSONG` | masih ada bab tanpa uraian |
| `KT-BELUM-DISUNTING` | masih ada bab yang belum tersentuh manusia |
| `KT-USULAN-TERBUKA` | masih ada usulan penyuntingan yang belum diputus |
| `KT-TANPA-PRAKATA` | prakata belum ditulis |
| `KT-TANPA-GLOSARIUM` | glosarium kosong |
| `KT-TANPA-PUSTAKA` | daftar pustaka kosong |
| `KT-TANPA-SINOPSIS` | sinopsis dan kata kunci belum ada |

**Empat puluh sembilan halaman** bukan angka karangan: itu batas UNESCO yang
memisahkan buku dari pamflet, dan dipakai luas dalam praktik penerbitan.
Taksirannya dari jumlah kata dengan asumsi ±350 kata per halaman B5 — dan
disebut sebagai TAKSIRAN di layar, karena tebal sesungguhnya baru diketahui
setelah ditata.

### 4.1 Sinopsis dan kata kunci

Tugas AI ketiga, `BUKU_SINOPSIS`, menyusun sinopsis sampul belakang (satu
paragraf, 80–120 kata) dan 5–8 kata kunci. Keduanya diminta penerbit dan
pendaftaran ISBN, dan keduanya adalah tulisan — bukan metadata terbitan, jadi
larangan docs/16 P5 tidak berlaku di sini. Dosen tetap menyuntingnya.

### 4.2 Halaman KDT

Berkas cetak mendapat blok **Katalog Dalam Terbitan** pada halaman hak cipta:
judul, penulis, penerbit, tahun, tebal, ISBN, dan kata kuncinya, ditutup satu
baris yang menyatakan data katalog resmi diisi Perpustakaan Nasional. Blok itu
hanya dicetak bila ISBN sudah ada — halaman KDT pada buku yang belum
didaftarkan adalah halaman yang menjanjikan sesuatu yang belum terjadi.

---

## BAGIAN 5 — Yang sengaja TIDAK dikerjakan

- **Tombol terima semua** (E2).
- **Penyuntingan otomatis tanpa persetujuan.**
- **Pemeriksa plagiarisme.** Tetap di luar; aplikasi tidak menjanjikan apa yang
  tidak dapat ditepatinya.
- **Pengajuan ISBN otomatis ke Perpusnas.** Tidak ada antarmuka mesin untuk
  itu, dan mengarang alurnya akan membuat dosen mengira pendaftarannya berjalan.
- **Indeks berhalaman.** Alasannya sama dengan docs/17 §7.1.

---

## BAGIAN 6 — Rencana pemasangan

| Tahap | Isi | Status |
|---|---|---|
| E1 | Skema: `UsulanSunting`, `sinopsis`, `kataKunci` | ✅ |
| E2 | Domain murni: `naskah.ts` (delapan pemeriksaan mekanis), `kesiapan-terbit.ts` | ✅ |
| E3 | Tugas AI: `SUNTING_BAB`, `TINJAU_NASKAH`, `BUKU_SINOPSIS` | ✅ |
| E4 | Aksi dan antarmuka: panel usulan per bab, panel kesiapan di sampul | ✅ |
| E5 | Cetak: blok KDT, halaman sinopsis, kata kunci | ✅ |
| E6 | Kamus dua bahasa, uji, aturan `AGENTS.md` | ✅ |
