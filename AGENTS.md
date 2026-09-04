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
| `docs/04-usulan-revisi-kurikulum.md` | Pintu resmi mengubah CPMK/Sub-CPMK: usulan → Kaprodi → pengesahan. U1–U3 terpasang (draf AI butir usulan dari temuan validator/evaluasi/catatan dosen); U4 menunggu sumber datanya ada. |
| `docs/05-evaluasi-ketercapaian-mk.md` | Evaluasi ketercapaian CPMK/CPL per MK + tindak lanjut (PPEPP). E1–E6 terpasang: peta asesmen, impor nilai, ketercapaian, tindak lanjut, agregasi prodi, analisis butir. |
| `docs/07-dasbor-peran.md` | Dasbor per peran: antrian kerja, panel Kaprodi/GPM/Dosen/Admin/Asesor/Mahasiswa, bagan SVG server. D1–D3 terpasang. |
| `docs/06-daur-hidup-dan-berbagi-rpkps.md` | Hapus/arsip RPKPS, tim pengampu, serah terima, salin, panel bagikan. B1–B4 terpasang beserta hapus paksa admin (§2.6); tautan pratinjau bertoken (B5) ditunda. |
| `docs/08-kunci-ai-per-pengguna.md` | BYOK Mode A: tiap dosen mendaftarkan kunci AI-nya sendiri. Menggantikan kunci institusi lewat env. Terpasang. |
| `docs/09-rencana-mingguan-manual.md` | Penyusunan manual tabel mingguan: tambah, sisip, hapus, geser, ubah jenis. M1–M5 terpasang. |
| `docs/10-notifikasi-dan-tenggat.md` | Notifikasi dalam aplikasi (6 peristiwa) dan tenggat pengajuan per tahun akademik. N1–N4 terpasang; surel (N5) ditunda. |
| `docs/11-dwibahasa.md` | Dwibahasa Indonesia–Inggris: rute `[bahasa]`, kamus antarmuka, kolom `*En` isi RPKPS, ruang sidik kedua, ekspor dua bahasa, terjemahan BYOK. L1–L7 terpasang. |
| `docs/12-draf-ai-tertutup.md` | Draf AI menutup peta asesmennya sendiri: komponen per baris mingguan, bobot ujian, rekonsiliasi `alokasikanAsesmen`. Terpasang. |
| `docs/13-penugasan-koordinator-mk.md` | Penugasan dosen koordinator per mata kuliah dan tahun akademik: papan penugasan Kaprodi, aliran ke RPKPS. K1–K4 terpasang. |
| `docs/14-tenggat-dan-rantai-pengesahan.md` | Tiga tenggat (penyusunan/review/pengesahan) + rantai tanda tangan Koordinator → Kaprodi → Kepala PMI. P1–P7 terpasang. |
| `docs/15-penyuntingan-kurikulum-langsung.md` | CRUD CPL/MK/CPMK/Sub-CPMK langsung di `/kurikulum`, hanya pada kurikulum DRAF. Gerbang dua lapis, kurikulum kosong, validator hidup. C1–C6 terpasang. |
| `docs/16-bahan-ajar.md` | Menu Bahan Ajar: buku ajar per bab disusun AI dari baris mingguan RPKPS, luaran `.docx` siap ISBN + slide `.pptx`. BA1–BA6 terpasang: skema, domain, empat tahap AI, halaman, cetak .docx (`?kunci=0` untuk berkas mahasiswa) dan slide .pptx. |
| `docs/17-ilustrasi-bahan-ajar.md` | Gambar dan diagram dalam buku ajar: diagram vektor ditulis AI sebagai kode (Mermaid/SVG), unggahan dosen, ilustrasi raster (Gemini saja). Sanitasi SVG, rasterisasi di peramban. IL1–IL7 terpasang: skema, domain murni, tahap AI diagram, antarmuka gambar, cetak .docx/.pptx, ilustrasi raster. |
| `docs/18-penyuntingan-gambar-visual.md` | Penyunting diagram visual: lapisan pegangan di atas `<img>`, suntingan menulis ulang KODE (bukan piksel), pembekuan Mermaid ke SVG, potong/putar raster. V1–V5 terpasang. |
| `docs/19-penyuntingan-naskah-dan-kesiapan-terbit.md` | AI sebagai EDITOR: usulan kutipan→pengganti yang disetujui dosen satu per satu, tinjauan lintas bab, pemeriksaan naskah mekanis, kesiapan terbit + sinopsis/kata kunci + blok KDT. E1–E6 terpasang. |

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
- **Draf AI menutup peta asesmennya sendiri.** Setiap baris mingguan berbobot
  yang ditulisnya — termasuk baris UTS dan UAS — wajib menunjuk komponen nilai,
  dan bobot tiap baris DIBAGIKAN dari bobot komponennya oleh `alokasikanAsesmen`
  (`src/domain/rpkps/alokasi-asesmen.ts`), bukan dijumlahkan menjadi bobot
  komponen. Lembar tugas adalah rencana baris itu; memberinya bobot di luar
  komponen yang sudah dirinci baris mingguan membuat tagihan yang sama terhitung
  dua kali — itulah yang dulu memunculkan "total 200%" (docs/12).
- **Identitas baris `komponen_nilai` tidak boleh hilang saat daftarnya
  disimpan.** `pertemuan` dan `tugas` menunjuk komponen lewat id yang
  ber-`onDelete: SetNull`, jadi menyimpan dengan hapus-lalu-buat-ulang melepas
  SELURUH tautan asesmen tanpa satu pesan pun, dan RPKPS yang sah berubah
  menjadi tidak dapat diajukan. Setiap penulisan lewat `rencanakanKomponen`
  (`src/domain/rpkps/komponen-nilai.ts`) dan `tulisKomponenNilai`
  (`src/lib/rpkps/komponen-inti.ts`) — termasuk jalur penerapan draf AI.
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
- **RPKPS tidak dihapus kecuali draf tanpa akibat — kecuali oleh ADMIN, lewat
  satu pintu yang terpisah.** `Rpkps` adalah akar cascade yang menjangkau
  `rpkps_snapshot` (sidik SHA-256 yang sudah tercetak dan menjadi halaman
  publik) serta `kelas → peserta_kelas → nilai` dan `evaluasi_mk`. Syaratnya
  ditegakkan `periksaKelayakanHapus` di `src/domain/rpkps/daur-hidup.ts`, bukan
  oleh dialog. Selebihnya berstatus `ARSIP` — tidak ada baris yang hilang.
  Penghapusan dokumen yang sudah disahkan hanya lewat `hapusPaksaRpkps`
  (docs/06 §2.6): peran `ADMIN`, alasan tertulis wajib, dan sensus lengkap —
  termasuk sidik SHA-256 tiap salinan beku — dicatat ke `log_audit` sebagai
  `RPKPS_DIHAPUS_PAKSA` di dalam transaksi yang sama, sebelum `delete()`.
  Jangan menjadikannya bendera `paksa` pada `hapusRpkps`: bendera opsional pada
  aksi yang dipanggil dari dialog biasa berakhir sebagai nilai yang diteruskan
  begitu saja dari peramban.
- **Penyimpanan yang mengganti seluruh isi baris wajib membawa cap versi.**
  RPKPS disunting beramai-ramai; `simpanPertemuan` dan `simpanTugas` menulis
  ulang baris beserta seluruh anaknya, jadi tanpa cap `diubahPada` dua
  penyunting pada baris yang sama saling menimpa tanpa gejala. Capnya ikut ke
  `where` sebuah `updateMany` — bukan dibaca lalu dibandingkan lebih dulu —
  supaya periksa-dan-tulis tidak dapat disela. Lihat
  `src/domain/rpkps/kunci-optimistik.ts`.
- **Daftar internal dihalamankan dan disaring di database, bukan di memori.**
  ADMIN, GPM, dan asesor bercakupan institusi; memuat seluruh baris lalu
  menyaringnya di JavaScript tumbuh seiring umur aplikasi dan tidak pernah
  menyusut. Nomor halaman datang dari alamat, jadi selalu lewat `bacaHalaman`
  dan `hitungHalaman` (`src/lib/paginasi.ts`) sebelum menjadi `skip`.
- **Wewenang atas satu RPKPS diputuskan di `src/lib/rpkps/wenang.ts`, tidak di
  tempat lain.** Kepengampuan adalah jalur akses tersendiri: `boleh = pengampu
  || (dalamCakupan && ADMIN|KAPRODI|GPM)`. Menyalin ulang aturan ini dengan
  `dalamCakupan &&` di depan akan mematikan team teaching lintas prodi tanpa
  pesan galat apa pun.
- **Koordinator RPKPS baru berasal dari penugasan mata kuliah, bukan dari
  pembuatnya.** `buatRpkps` melewatkan `koordinatorTertugas()` ke
  `susunPengampuAwal` (`src/domain/kurikulum/koordinator.ts`); menuliskan
  kembali `{ penggunaId: sesi.id, peran: "KOORDINATOR" }` di sana membuat staf
  prodi yang membantu menyiapkan sepuluh dokumen menjadi penanggung jawab
  kesepuluhnya. Penetapan koordinator MK juga menyerahterimakan RPKPS tahun
  akademik itu bila sudah ada — dua daftar yang tidak sinkron lebih buruk
  daripada satu daftar (docs/13 §2.3).
- **Penyuntingan langsung lapisan kurikulum melewati DUA gerbang, dan status
  saja bukan salah satunya.** `bolehSuntingKurikulum` hanya mengizinkan
  `DRAF`, tetapi itu belum cukup: `ubahStatusKurikulum` menawarkan
  `ARSIP → DRAF`, sehingga kurikulum yang menggantung RPKPS terbit dapat
  kembali berstatus `DRAF` dan statusnya berbohong. Gerbang kedua —
  `periksaKelayakanHapusMk`/`Cpmk`/`SubCpmk`/`Cpl` di
  `src/domain/kurikulum/sunting.ts` — menghitung rujukan NYATA dari basis data.
  Menambah aksi tulis baru di `aksi-cpl.ts`/`aksi-mk.ts`/`aksi-cpmk.ts` tanpa
  melewati `pastikanWenangSunting` membuka kembali pintu belakang yang doc 04
  ada untuk menutupnya.

- **Menyalin RPKPS antar mata kuliah melepas seluruh pemetaan Sub-CPMK.**
  Sub-CPMK milik mata kuliah, bukan milik RPKPS; kisi-kisi tidak ikut sama
  sekali karena `butir_kisi_kisi.sub_cpmk_id` wajib isi.
- **RPKPS terbit di cap TERAKHIR, dan cap itu milik Penjaminan Mutu.** Rantai
  pengesahan berjalan `paraf pengampu → koordinator (DIAJUKAN) → Kaprodi
  (DISETUJUI) → GPM (TERBIT)`, sesuai tiga blok tanda tangan pada Halaman
  Pengesahan ITTS. `bekukanRpkps` dipanggil di `sahkanRpkps`, bukan saat
  Kaprodi menyetujui — memindahkannya kembali membuat dokumen resmi menyatakan
  telah diperiksa Penjaminan Mutu padahal Penjaminan Mutu tidak pernah
  membukanya. Penanda tangan diperiksa dengan `punyaPeranDiProdi(…, "KAPRODI")`
  dan `punyaPeran(…, "GPM")`, BUKAN `wenang.pengelola`: untuk sebuah tombol
  keputusan menerima ADMIN masuk akal, untuk sebuah tanda tangan tidak.
- **Tanda tangan menyebut sidik isi yang ditandatangani.** Setiap baris
  `tanda_tangan_rpkps` menyimpan sidik saat itu, dan `periksaSidikCap` menolak
  persetujuan maupun pengesahan bila isi sudah bergeser — biasanya karena
  revisi kurikulum yang berlaku di sela rantai. Paraf pengampu dinilai dengan
  aturan yang sama (`statusParaf` + `sidikSekarang`): paraf atas isi yang sudah
  diganti rekan setim tidak dihitung. Pengembalian untuk revisi menaikkan
  `versi`, dan kenaikan itulah yang menggugurkan seluruh ronde — barisnya tidak
  pernah dihapus.
- **Isi RPKPS hanya boleh disunting saat `DRAF` atau `DIREVISI`, dan aturan itu
  hanya ada di `bolehSuntingIsi`** (`src/lib/rpkps/wenang.ts`). Aturan ini
  pernah disalin di tiga berkas aksi dan hilang sama sekali di `rpkps/aksi.ts`
  — akibatnya identitas, baris mingguan, pustaka, dan komponen nilai masih
  dapat diubah setelah dokumen diajukan. Dengan rantai tiga cap, celah itu
  berarti Kaprodi menandatangani dokumen A dan Penjaminan Mutu mengesahkan
  dokumen B. Pengelolaan tim pengampu (`aksi-kelola.ts`) sengaja di luar kunci
  ini: ia mengurus pemegang dokumen, bukan isinya.
- **Serah terima koordinator tidak menyentuh salinan beku.** Nama pengampu di
  `rpkps_snapshot` adalah nama saat pengesahan; memperbaruinya menggeser sidik
  seluruh dokumen terbit.
- **Kredensial SMTP hidup di `src/lib/surel/pengirim.ts` saja, dan surel tidak
  pernah dikirim di dalam jalur aksi.** Alasan yang pertama sama dengan kunci
  AI: kredensial yang boleh dibaca dari banyak tempat cepat atau lambat
  tercetak di salah satunya, dan sandi yang sekali masuk log atau kolom
  `surel_galat` ada di cadangan basis data selamanya — karena itu `ringkasGalat`
  menyamarkannya lebih dulu (pesan bawaan SMTP kadang menyertakan nama akun).
  Yang kedua: mengirim di dalam aksi membuat dosen menunggu jabat tangan SMTP
  sebelum tombolnya merespons, dan satu gangguan penyedia surel menggagalkan
  pengajuan yang sebenarnya sudah tersimpan. Antriannya menumpang tabel
  `notifikasi` dan dikuras `POST /api/surel/kirim` yang dijaga
  `SUREL_CRON_RAHASIA`. Kanal luar yang gagal TIDAK boleh menghilangkan
  kabarnya: notifikasi dalam aplikasi tetap ada apa pun yang terjadi
  (docs/10 §2.5). Penjaganya `src/lib/surel/rahasia.test.ts`.
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
- **Ada DUA pintu tanpa login, dan keduanya tertutup rapat pada berkasnya
  masing-masing** (docs/06 §4.3). `src/lib/publik/muat.ts` melayani katalog:
  hanya `TERBIT`, hanya salinan beku, terindeks. `src/lib/berbagi/muat.ts`
  melayani tautan pratinjau: hanya lewat token yang sah dan belum kedaluwarsa,
  membaca data LANGSUNG, selalu bertanda draf, tidak pernah terindeks, dan
  tanpa sidik — sidik hanya milik salinan beku. **Berkas yang satu tidak boleh
  memanggil berkas yang lain**, dan halaman pratinjau tidak boleh menyentuh
  kelas, nilai, maupun evaluasi: nilai mahasiswa tidak punya jalur tanpa login.
  Penjaganya `src/lib/berbagi/pintu.test.ts`.
- **Halaman publik hanya membaca salinan beku, dan hanya status `TERBIT`.**
  Semua kueri lewat `src/lib/publik/muat.ts`; isi dokumen selalu lewat
  `dokumenPublik()` yang dibangun di atas `proyeksiIsi` — jangan mengirim baris
  Prisma mentah ke komponen publik.
- **Setiap alamat aplikasi berawalan bahasa, dan tidak ada yang menulisnya
  sendiri.** Seluruh `href`/`redirect` ditulis TANPA bahasa; awalannya dipasang
  `Tautan` (`src/components/tautan.tsx`), `useBahasa().jalur`, atau
  `jalurAktif` (`src/lib/bahasa/server.ts`). Menulis `<Link href="/rpkps">`
  langsung tetap dikompilasi dan tetap dirender — ia hanya melempar pengguna
  berbahasa Inggris kembali ke bahasa Indonesia saat diklik. Karena itu
  `next/link` ditolak ESLint di `src/app` dan `src/components`.
- **Penyegaran cache selalu lewat `segarkan`, tidak pernah `revalidatePath`.**
  Setelah alamat berawalan, `revalidatePath("/rpkps")` tidak cocok dengan
  halaman mana pun: tidak ada galat, hanya data basi sampai ada yang mengeluh.
  `segarkan` (`src/lib/bahasa/segarkan.ts`) menyegarkan kedua bahasa, dan
  `revalidatePath` langsung ditolak ESLint.
- **Kamus `en.ts` bertipe `typeof id`.** Itulah yang menjamin kelengkapan
- **Terjemahan AI tidak pernah menulis langsung.** `usulkanTerjemahan` hanya
  mengembalikan draf; `terapkanTerjemahan` menulis setelah dosen mencentang.
  Alamat medan (`tabel:id:kolom`) datang dari peramban, jadi ia disahkan dua
  lapis: daftar putih kolom `*En`, dan pencocokan dengan `medanRpkps(rpkps)` —
  id baris bersifat global, dan wewenang yang diperiksa hanya berlaku untuk
  RPKPS ini. Penerapan menulis kolom `*En` SAJA, bukan lewat
  `simpanPertemuan`/`simpanTugas` yang akan menimpa suntingan Indonesia yang
  terjadi selama model bekerja. `sumber = AI` TIDAK dipasang pada baris hasil
  terjemahan: medan itu menandai asal isi Indonesia, dan menaikkannya akan
  menyatakan rumusan dosen lahir dari model. Penjaganya
  `src/lib/ai/terjemahan-rpkps.test.ts` (docs/11 §8.1–8.4).
- **Apa yang dihitung kelengkapan terjemahan wajib dapat dikerjakan AI.**
  `pasanganTerjemahan` DITURUNKAN dari `medanRpkps`
  (`src/lib/rpkps/terjemahan.ts`); menuliskannya kembali sebagai daftar kedua
  memunculkan lagi bug docs/11 §8.7 — penyebutnya memuat medan yang tidak
  pernah ditawarkan ke model, dan angka kelengkapan menjadi target yang tidak
  dapat dicapai siapa pun. Kolom larik (`subtopik`, `rincian`) ikut lewat
  alamat berindeks `tabel:id:kolom#i`, disusun HANYA oleh `susunAlamat` /
  `uraiAlamat`, dan ditulis dengan mengganti larik UTUH di atas larik yang
  sekarang — `SET kolom[i] = …` meninggalkan NULL yang tidak dapat dibaca
  `String[]` Prisma. Setiap kolom `*En` baru harus masuk `MEDAN_BOLEH` DAN
  disusun menjadi alamat; penjaganya `terjemahan-cakupan.test.ts`.
- **Satu tugas terjemahan bukan satu permintaan jaringan.** Kuncinya dibuka
  sekali (`pakaiKredensial`), tetapi medannya dikirim bergelombang dengan ronde
  ulang yang mengecil (`UKURAN_RONDE` di `src/lib/ai/terjemahan-rpkps.ts`).
  Mengembalikannya menjadi satu panggilan raksasa menghidupkan lagi dua
  kegagalan senyap: model menjatuhkan sebagian medan tanpa melanggar skema, dan
  jawaban yang terpotong menghanguskan SELURUH pekerjaan yang sudah benar. Sisa
  yang tetap tak terjawab dilaporkan sebagai `kurang`, tidak dibulatkan menjadi
  sukses.
- **Pengenal berkas Excel tetap bahasa Indonesia.** Berkas nilai dan templat
  impor kurikulum dibaca ulang dengan MENCOCOKKAN TEKS judul kolom dan nama
  lembarnya, jadi "NIM", "Nama", "Angkatan", "Nilai", "Kode MK", "Level Bloom",
  dan kerabatnya tidak boleh masuk `src/lib/dokumen/label.ts`. Menerjemahkannya
  membuat berkas yang diunduh dalam bahasa Inggris tidak dapat diunggah kembali,
  dan gagalnya senyap — pembaca hanya melaporkan "kolom tidak ditemukan".
  Yang diterjemahkan hanya lembar Petunjuk. Penjaganya
  `src/lib/dokumen/label.test.ts` (docs/11 §7.1).
- **Berkas cetak berbahasa Inggris mencetak `sidikEn`, bukan `sidik`.**
  Mencetak sidik Indonesia pada berkas Inggris membuat pembacanya
  membandingkan dua isi yang berbeda dan menyimpulkan dokumennya bergeser.
  Halaman pengesahan berkas Inggris wajib membawa keterangan bahwa naskah
  Indonesia adalah yang sah (docs/11 §7).
- **Isi RPKPS berbahasa Inggris punya ruang sidiknya sendiri.**
  `proyeksiIsi()` dan `sidikDokumen()` TIDAK BOLEH mengenal satu pun medan
  `*En`; versi Inggris hidup di `src/domain/rpkps/proyeksi-en.ts` dan membeku
  ke `rpkps_snapshot.isi_en`/`sidik_en`. Menambahkan medan Inggris ke ruang
  pertama menggeser sidik SELURUH dokumen yang sudah ditandatangani.
  Penjaganya `src/domain/rpkps/proyeksi.test.ts`, yang mengunci sidik sebuah
  dokumen contoh sebagai nilai harfiah — bila ia gagal, JANGAN perbarui
  angkanya; cari apa yang menyentuh proyeksi (docs/11 §6.1–6.2).
- **Penyimpanan yang menulis ulang baris wajib membawa medan `*En`.**
  `simpanPertemuan`, `simpanTugas`, `simpanKisiKisi`, dan `tulisKomponenNilai`
  mengganti SELURUH isi baris; kolom `*En` yang tertinggal dari muatan simpan
  akan terhapus setiap kali dosen menyunting tab Indonesia — tanpa galat,
  tanpa jejak, dan `tsc` tidak dapat melihatnya karena Prisma menerima `data`
  parsial. Penjaganya `src/lib/rpkps/terjemahan.test.ts`, yang membaca
  `schema.prisma`. Cadangan tampilan hanya SATU ARAH: `pilihTeks`
  (`src/lib/bahasa/teks.ts`) memberi pembaca Inggris teks Indonesia bila
  terjemahannya kosong, tidak pernah sebaliknya. `komponen_nilai.nama_en`
  TIDAK boleh masuk `@@unique` maupun pencocokan `rencanakanKomponen`
  (docs/11 §5.2, §5.3, §5.4).
- **Nama mata kuliah dwibahasa, dan yang sah tetap yang Indonesia.**
  `mata_kuliah.nama_en` — bersama `deskripsi_en`, `profil_lulusan.deskripsi_en`,
  `cpl.deskripsi_en`, `cpmk.rumusan_en`, dan `sub_cpmk.rumusan_en` — disunting
  HANYA lewat `aksi-profil.ts`/`aksi-mk.ts`/`aksi-cpl.ts`/`aksi-cpmk.ts` pada
  kurikulum DRAF, melewati
  `pastikanWenangSunting` dan `periksaKelayakanUbahMk` yang sama seperti nama
  Indonesianya: nama Inggris ikut ruang sidik `proyeksiIsiEn()`, jadi
  mengubahnya setelah ada salinan beku sama saja dengan menggeser sidik
  dokumen terbit. Untuk MENAMPILKAN nama mata kuliah selalu `namaMk()`
  (`src/lib/bahasa/teks.ts`), tidak pernah `mataKuliah.nama` telanjang —
  pemuat data mengembalikan KEDUA kolom dan tampilanlah yang memilih
  bahasanya. Penjaganya `src/lib/kurikulum/terjemahan.test.ts`. Yang tidak
  ikut berbahasa Inggris dan memang tidak boleh: `log_audit.ringkasan`,
  `params` notifikasi/riwayat yang sudah tertulis, dan kode mata kuliah
  (docs/11 §5.1b).
- **Temuan validator berupa kode dan parameter, bukan kalimat.** `TemuanRpkps`,
  `TemuanKurikulum`, dan `TemuanValidasi` tidak punya medan `pesan` maupun
  `saran`; kalimatnya di `src/kamus/temuan-id.ts`/`temuan-en.ts` berkunci kode
  temuan, dirakit `teksTemuan` saat dibaca. Satu kode = satu kalimat: kode yang
  dipakai dua aturan berbeda harus dipecah, bukan diberi kalimat lewat ternary.
  Durasi masuk sebagai `{ menit: n }`, TIDAK sebagai hasil `formatMenit()` —
  "2 jam 30 menit" adalah kalimat Indonesia yang lolos `tsc` karena bertipe
  `string`. Penjaganya `src/lib/bahasa/temuan.test.ts`.
- **Pesan pemeriksaan Zod ditulis sebagai kunci, bukan kalimat.** Skema hidup
  di lingkup modul — kamus belum ada di sana. Yang ditulis pada skema adalah
  `"@aksi.periksa.namaKunci"`, dan pelaporannya SELALU lewat `pesanZod`
  (`src/lib/bahasa/zod.ts`), tidak pernah `error.issues[0].message` langsung;
  angka `{n}` diambil dari batas skema itu sendiri, jangan ditulis ulang di
  kamus. Kunci yang salah ketik lolos dari `tsc` dan hanya tampak sebagai
  "Data tidak valid." di layar — penjaganya `src/lib/bahasa/zod.test.ts`.
- **Kalimat yang disimpan ke basis data menyimpan peristiwanya, bukan
  kalimatnya.** `notifikasi.data` dan `rpkps_riwayat.data` berisi
  `{ kunci, params }`; kalimatnya dirakit `teksNotifikasi`/`teksRiwayat` saat
  DIBACA, dalam bahasa pembacanya. Keduanya dibaca ulang berbulan-bulan
  kemudian, termasuk di katalog publik. Riwayat SELALU ditulis lewat
  `barisRiwayat` (`src/lib/rpkps/riwayat.ts`) yang mengisi `data` beserta
  cadangan `deskripsi`-nya sekaligus. Kolom cadangan itu jangan dihapus:
  salinan beku yang dibuat sebelum L3 hanya punya itu, dan salinan beku tidak
  pernah ditulis ulang. `log_audit.ringkasan` tetap bahasa Indonesia selamanya
  — itu jejak audit (docs/11 §4.2, §4.2c).
  terjemahan; jangan melonggarkan tipenya untuk membungkam galat kompilasi —
  galat itu memang pesan bahwa ada kunci yang belum diterjemahkan.
- **SVG adalah data tidak tepercaya, dan dirender HANYA di dalam `<img>`.**
  Ia dapat memuat `<script>`, `onload`, `<foreignObject>`, dan rujukan ke
  alamat luar. Sanitasinya di `src/domain/bahan-ajar/svg-aman.ts` dengan daftar
  PUTIH, berjalan DI SERVER sebelum disimpan, dan MENOLAK — tidak pernah
  menambal, supaya tidak ada celah antara yang diperiksa dan yang disimpan.
  Lapis kedua: peramban hanya merender lewat `data:` URI di dalam `<img>`;
  `innerHTML` dan `dangerouslySetInnerHTML` tidak boleh menyentuh isi gambar
  mana pun, dan penjaganya `src/lib/bahan-ajar/gambar-aman.test.ts`.
- **Penyuntingan naskah oleh AI menghasilkan USULAN, tidak pernah naskah.**
  Skema `SUNTING_BAB` hanya menerima pasangan kutipan–pengganti–alasan; medan
  bernama `uraian`/`naskah` di sana akan membuka kembali jalur yang tahap ini
  ada untuk menutupnya. Satu-satunya tempat yang menulis `bab.uraian` adalah
  `putuskanUsulan`, dan **tidak boleh ada aksi "terima semua"** — begitu
  tombol itu ada, ia yang dipakai, dan penandaan "menerima usulan dihitung
  sebagai suntingan manusia" (docs/19 E3) kehilangan dasarnya. Usulan yang
  kutipannya sudah tidak ada di naskah menjadi `KEDALUWARSA`, tidak
  dipaksakan: menerapkannya berarti menimpa suntingan dosen dengan usulan atas
  naskah lama. Penjaganya `src/lib/ai/skema-sunting.test.ts`.
- **Yang dapat dihitung mesin tidak dikirim ke model.** Panjang kalimat dan
  paragraf, ejaan istilah yang tidak seragam, kata kerja tujuan pembelajaran
  yang tidak muncul di uraian, dan seluruh daftar periksa kesiapan terbit ada
  di `src/domain/bahan-ajar/naskah.ts` dan `kesiapan-terbit.ts` — deterministik,
  gratis, dan tidak disimpan karena menghitung ulang lebih murah daripada
  menjaga baris basi tetap sejalan.
- **Penyunting visual menyunting KODE, dan lewat lapisannya sendiri.** Setiap
  geseran menulis ulang SVG lewat `src/domain/bahan-ajar/svg-model.ts` —
  penggantian potongan teks pada offset yang diketahui, bukan penyusunan ulang
  pohon, supaya komentar dan format berkas dosen tidak lenyap tiap kali sebuah
  kotak digeser. Pegangan seleksi adalah `<div>` milik kita di ATAS `<img>`,
  bukan penangan klik pada elemen SVG: `<img>` buram bagi DOM, dan itulah
  harga yang dibayar demi docs/17 I2. Penyunting visual juga tidak boleh
  menjadi pintu belakang cetakan gaya — warnanya terbatas pada palet, dan
  ukuran huruf tidak pernah turun di bawah ambang.
- **Diagram disimpan sebagai kode; PNG hanyalah turunannya.** Sumber
  kebenarannya Mermaid atau SVG. PNG wajib ada karena `docx` menerima SVG hanya
  bila disertai cadangan raster — bukan karena ia dokumennya. PNG dirasterkan
  PERAMBAN saat dosen menyetujui: server tidak punya Times New Roman, dan
  labelnya akan bergeser tanpa satu galat pun.
- **Mermaid dirender dengan `htmlLabels: false`, dan kodenya diperiksa
  `mermaid-aman.ts`.** Label `foreignObject` tidak dirender di dalam `<img>` —
  diagramnya tercetak berisi kotak kosong tanpa pesan galat. `click`,
  `%%{init}%%`, dan `style`/`classDef` ditolak: yang pertama membuka alamat,
  yang kedua mematikan penjaganya sendiri, yang ketiga merebut tema dari buku.
- **Cetakan gaya diagram ditegakkan kode, bukan panduan.** Gradien,
  transparansi, warna di luar palet, ketebalan garis selain 1.5/2.5, label di
  bawah 12pt, dan font tanpa keluarga generik DITOLAK `gaya-svg.ts` — itulah
  yang membuat diagram tidak berupa "gambar AI". Panduan tahap `BUKU_DIAGRAM`
  MENGAMBIL angka-angka itu dari konstanta domain; menuliskannya ulang membuat
  keduanya menyimpang diam-diam.
- **Ilustrasi raster AI selalu berketerangan asal, dan tidak pernah untuk apa
  pun yang faktual.** `gambar?()` bersifat OPSIONAL pada antarmuka `Penyedia`;
  ketiadaannya tidak boleh menjadi alasan jatuh ke penyedia atau kunci lain.
- **Basis datanya jauh, dan itu mengubah cara kode dibaca.** Postgres terkelola
  di kawasan lain: satu perjalanan pulang-pergi ~25 ms, membuka SATU koneksi
  baru ~500 ms. Tiga hal menjaganya, dan ketiganya mudah dibatalkan tanpa
  gejala apa pun selain aplikasi yang kembali lambat:
  (1) `idleTimeoutMillis: 0` pada kolam `pg` di `src/lib/prisma.ts` — bawaan
  `pg` adalah 10 detik, dan pada aplikasi internal yang sepi jeda antar-klik
  lebih panjang dari itu, sehingga hampir setiap halaman membayar ~500 ms;
  (2) `previewFeatures = ["relationJoins"]` pada skema, ditambah perluasan
  `strategi-gabung` yang memasang `relationLoadStrategy: "join"` untuk seluruh
  operasi BACA — tanpanya satu `muatRpkps()` menjadi 30 kueri, bukan 1;
  (3) `await` berurutan yang sebenarnya saling bebas. Sebelum menambah `await`
  pada sebuah halaman, tanya apakah ia benar-benar menunggu hasil sebelumnya —
  kalau tidak, ia masuk ke `Promise.all` yang sudah ada.
- **Pemeriksaan pencabutan sesi ke Firebase berkala, bukan tiap permintaan.**
  Argumen kedua `verifySessionCookie(cookie, true)` memanggil Identity Toolkit
  lewat jaringan — 290–710 ms, dan dulu itu terjadi pada SETIAP halaman, Server
  Action, dan route handler. Jadwalnya di `src/domain/firebase/cabut-sesi.ts`.
  Yang tetap per permintaan: tanda tangan cookie (lokal) dan `pengguna.status`
  di basis data, sehingga penonaktifan LEWAT APLIKASI INI tetap seketika.
  Mengembalikan `true` tanpa syarat berarti mengembalikan lantai waktu tunggu
  yang tidak dapat ditembus optimasi kueri mana pun.
- **Draf AI usulan revisi boleh menyusun butir, tidak pernah menerbitkan
  dasar.** Aturan "setiap butir wajib membawa dasar" (docs/04 §2.3) adalah
  satu-satunya yang memisahkan kurikulum yang direvisi dari kurikulum karangan
  model, dan runtuhnya tidak terlihat — hasilnya justru lebih rapi daripada
  tulisan tangan dosen. Karena itu skema keluaran `SkemaDrafUsulan` TIDAK punya
  satu pun medan untuk teks dasar: model hanya menyebut `dasar_ref` ke katalog
  yang dirakit server (`rakitBahanDraf`), dan kutipannya DISALIN server dari
  katalog itu. Satu-satunya teks dasar dari model adalah kutipan catatan dosen,
  dan keverbatimannya diuji `saringDrafUsulan`, tidak dipercaya. Penyaringan
  terjadi DUA KALI — sekali sebelum pratinjau, sekali lagi saat penerapan atas
  butir yang dikirim balik peramban, dengan kutipannya dibuang lebih dulu:
  pratinjau bukan otorisasi (docs/04 §9.9). `CPMK_PENSIUN` dan `SUB_PENSIUN`
  di luar `JENIS_BOLEH_AI` selamanya. Penjaganya
  `src/lib/ai/skema-draf-usulan.test.ts` dan `uji/integrasi.ts` §16.
- Domain `src/domain/` harus murni: tanpa Prisma, tanpa React, agar dapat diuji.
- Bahasa antarmuka dan penamaan domain: Indonesia. Tabel database snake_case
  lewat `@@map`/`@map`.

## Perintah

```
npm run dev         npm test          npm run typecheck
npm run db:push     npm run db:seed   npm run db:studio
```

<!-- END:proyek -->
