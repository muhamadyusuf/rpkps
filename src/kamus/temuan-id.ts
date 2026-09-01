/**
 * Kalimat temuan validator — bahasa Indonesia.
 *
 * Dipisah dari `id.ts` karena isinya 119 entri dan tumbuh setiap kali sebuah
 * aturan baru ditambahkan; menaruhnya di kamus utama membuat berkas itu tidak
 * dapat dibaca lagi. Kuncinya adalah `kode` temuan apa adanya, jadi menelusuri
 * dari layar ke aturan yang memunculkannya cukup dengan mencari kodenya.
 *
 * Setiap `{penanda}` diisi dari `temuan.params` yang disusun validator. Nama
 * penandanya harus sama persis di `temuan-en.ts` — dijaga uji, bukan disiplin.
 */

const SARAN_RALAT =
  "Lepaskan tanda ralat; usulan ini berlaku mulai tahun akademik berikutnya.";

export const temuanId = {
  "AG-CAKUPAN-RENDAH": {
    pesan:
      "Baru {dievaluasi} dari {total} mata kuliah ({persen}%) yang evaluasinya ditutup.",
    saran:
      "Panduan penjaminan mutu lazim menuntut cakupan sekurang-kurangnya {minimal}%.",
  },
  "AG-CPL-BELUM-TERCAPAI": {
    pesan: "CPL {daftar} berada di bawah ambang {ambang}%.",
    saran:
      "Bahan utama evaluasi kurikulum berikutnya, bukan urusan satu mata kuliah.",
  },
  "AG-CPL-TANPA-DATA": {
    pesan:
      "{jumlah} CPL belum pernah terukur oleh evaluasi mana pun: {daftar}.",
    saran:
      "Selama CPL ini kosong, prodi tidak dapat menyatakan capaian lulusannya — hanya menduga.",
  },
  "AG-SEBARAN-KELAS": {
    pesan:
      "{jumlah} mata kuliah menunjukkan selisih capaian antar kelas di atas {ambang} poin: {daftar}.",
    saran:
      "Rencana yang sama dengan hasil jauh berbeda menunjuk pelaksanaan, bukan rancangan.",
  },
  "B-DESKRIPSI": {
    pesan: "Deskripsi mata kuliah belum diisi.",
  },
  "B-PARAF-BELUM-LENGKAP": {
    pesan: "{jumlah} pengampu belum memaraf halaman pengesahan: {daftar}.",
    saran:
      'Koordinator menandatangani atas nama tim penyusun, jadi paraf timnya harus lengkap lebih dulu. Kirim pengingat lewat tombol "Minta paraf".',
  },
  "B-TANPA-CPL": {
    pesan: "Tidak ada CPL yang dibebankan pada mata kuliah ini di kurikulum.",
  },
  "B-TANPA-PENGAMPU": {
    pesan: "Belum ada dosen pengampu.",
  },
  "B-TANPA-PUSTAKA": {
    pesan: "Belum ada pustaka utama.",
  },
  "B1-BOBOT-MINGGUAN": {
    pesan: "Total bobot pada tabel mingguan {total}%, seharusnya 100%.",
    saran: "Selisihnya {selisih}% — sesuaikan bobot salah satu pertemuan.",
  },
  "B2-BOBOT-KOMPONEN": {
    pesan: "Total bobot komponen nilai {total}%, seharusnya 100%.",
  },
  "B2-KOMPONEN-KOSONG": {
    pesan: "Belum ada komponen nilai (UTS, UAS, tugas, dan seterusnya).",
  },
  "B2-TIDAK-REKONSILIASI": {
    pesan:
      "Bobot mingguan berjumlah {mingguan}% sedangkan komponen nilai {komponen}%. Keduanya harus sama.",
  },
  "B3-SUB-CPMK-ASING": {
    pesan: "Pertemuan merujuk {kode}, yang bukan milik mata kuliah ini.",
  },
  "B3-SUB-CPMK-TIDAK-DIJADWALKAN": {
    pesan:
      "{jumlah} Sub-CPMK tidak dijadwalkan pada pertemuan mana pun: {daftar}.",
    saran: "Sub-CPMK yang tidak diajarkan tidak akan pernah dicapai mahasiswa.",
  },
  "B4-NARASI-BEDA": {
    pesan:
      "Minggu {minggu}: narasi metode menyebut total {narasi}, sedangkan aktivitas berjumlah {aktivitas}.",
    saran: "Samakan angka pada narasi dengan rincian aktivitas.",
  },
  "B5-SEMESTER-KURANG": {
    pesan:
      "Total beban semester {jam} jam/sks, kurang dari target {target} jam/sks. Selisih {selisih}.",
  },
  "B5-SEMESTER-LEBIH": {
    pesan:
      "Total beban semester {jam} jam/sks, melebihi target {target} jam/sks. Selisih {selisih}.",
  },
  "B5-UJIAN-TANPA-ALOKASI": {
    pesan:
      "Minggu {minggu} (ujian) belum memiliki alokasi waktu. Pagunya {pagu} — persiapan ujian adalah beban belajar nyata.",
  },
  "B6-MINGGU-GANDA": {
    pesan: "Minggu {daftar} muncul lebih dari sekali.",
  },
  "B6-MINGGU-HILANG": {
    pesan: "Minggu {daftar} belum ada pada tabel mingguan.",
    saran: "Minggu ujian tetap harus muncul sebagai baris bernomor.",
  },
  "BS-BUTIR-SUKAR": {
    pesan: "Butir {daftar} tergolong sukar (P < 0,3).",
    saran:
      "Periksa apakah materinya memang sempat diajarkan pada porsi yang memadai.",
  },
  "BS-DAYA-BEDA-NEGATIF": {
    pesan:
      "Butir {daftar} pada {label} punya daya beda negatif — mahasiswa berperingkat atas justru lebih sering salah.",
    saran:
      "Hampir selalu kunci jawaban keliru atau pertanyaan bermakna ganda. Skornya mencemari capaian Sub-CPMK yang bergantung padanya.",
  },
  "BS-DAYA-BEDA-RENDAH": {
    pesan: "Butir {daftar} hampir tidak membedakan tingkat penguasaan.",
  },
  "BS-PESERTA-SEDIKIT": {
    pesan: "Hanya {jumlah} peserta berskor lengkap pada {label}.",
    saran:
      "Di bawah {minimal} peserta, daya beda dan reliabilitas tidak layak dipercaya.",
  },
  "BS-RELIABILITAS-RENDAH": {
    pesan: "Reliabilitas {label} (Cronbach α) {nilai}, di bawah {minimal}.",
    saran: "Butir-butirnya kurang konsisten mengukur hal yang sama.",
  },
  "BS-SELURUHNYA-MUDAH": {
    pesan:
      "Seluruh butir {label} tergolong mudah — ujian ini tidak mengukur batas atas penguasaan.",
  },
  "BS-SKOR-TIDAK-LENGKAP": {
    pesan:
      "{jumlah} peserta tidak punya skor lengkap dan dikeluarkan dari analisis.",
  },
  "BS-TANPA-DATA": {
    pesan: "Belum ada skor per butir untuk {label}.",
    saran: "Analisis butir bersifat opsional; capaian tetap dihitung tanpanya.",
  },
  "BT-NIM-ASING": {
    pesan:
      "{jumlah} NIM pada lembar butir {jenis} tidak terdaftar di kelas ini dan dilewati.",
  },
  "BT-BUKAN-ANGKA": {
    pesan:
      'Baris {baris} butir {nomor} pada {label} berisi "{isi}", yang bukan angka.',
  },
  "BT-DILUAR-RENTANG": {
    pesan:
      "Baris {baris} butir {nomor} pada {label} berisi {angka}, di luar 0–{batas}.",
  },
  "EV-BELUM-LENGKAP": {
    pesan: "{terisi} dari {total} sel nilai belum terisi ({persen}% lengkap).",
    saran:
      "Angka capaian tetap dihitung dari yang ada, tetapi evaluasi tidak boleh ditutup di atas data sebagian.",
  },
  "EV-CPMK-BELUM-TERCAPAI": {
    pesan: "{jumlah} CPMK belum tercapai: {daftar}.",
    saran:
      "Ambang ketercapaian {ambang}% mahasiswa lulus. Setiap CPMK ini wajib punya tindak lanjut sebelum evaluasi ditutup.",
  },
  "EV-TANPA-PESERTA": {
    pesan:
      "Kelas ini belum punya peserta, sehingga tidak ada yang dapat dihitung.",
  },
  "I-BOBOT-KRITERIA": {
    pesan: "Bobot indikator {label} berjumlah {total}%, seharusnya 100%.",
  },
  "I-DESKRIPSI-PENDEK": {
    pesan: "Deskripsi {label} terlalu ringkas untuk dikerjakan mahasiswa.",
  },
  "I-MINGGU-DILUAR": {
    pesan:
      "{label} dijadwalkan minggu {mulai}–{selesai}, di luar rentang 1–{terakhir}.",
    saran:
      "Tugas hanya dapat dijadwalkan pada minggu yang ada di tabel mingguan.",
  },
  "I-MINGGU-TERBALIK": {
    pesan:
      "{label}: minggu mulai ({mulai}) melebihi minggu selesai ({selesai}).",
  },
  "I-SUB-CPMK-ASING": {
    pesan: "{label} merujuk {kode}, yang bukan milik mata kuliah ini.",
  },
  "I-TANPA-KRITERIA": {
    pesan: "{label} ({nama}) belum punya indikator penilaian.",
    saran:
      "Tanpa indikator berbobot, tugas tidak dapat dinilai secara konsisten.",
  },
  "I-TANPA-LINIMASA": {
    pesan: "{label} belum punya linimasa tahapan.",
  },
  "I-TANPA-SUB-CPMK": {
    pesan: "{label} belum dikaitkan ke Sub-CPMK mana pun.",
  },
  "K-CPL-KODE-GANDA": {
    pesan: "Kode CPL berulang: {daftar}.",
  },
  "K-CPL-PL-TIDAK-ADA": {
    pesan: "{kode} merujuk {profil}, yang tidak ada di daftar profil lulusan.",
  },
  "K-CPL-TANPA-MK": {
    pesan: "{kode} tidak dibebankan pada mata kuliah mana pun.",
    saran: "Bebankan pada minimal satu mata kuliah, atau hapus dari kurikulum.",
  },
  "K-CPL-TANPA-PL": {
    pesan: "{kode} tidak menopang profil lulusan mana pun.",
    saran:
      "Petakan ke minimal satu profil agar capaian ini punya alasan keberadaan yang terlacak.",
  },
  "K-CPMK-CPL-DILUAR-MK": {
    pesan:
      "{kode} menjabarkan {cpl}, tetapi {cpl} tidak dibebankan pada {mk} di matriks CPL x MK.",
    saran: "Tambahkan {kode} ke matriks, atau lepaskan dari {cpl}.",
  },
  "K-CPMK-CPL-TIDAK-ADA": {
    pesan: "{kode} merujuk {cpl}, yang tidak ada di daftar CPL kurikulum.",
  },
  "K-CPMK-KODE-GANDA": {
    pesan: "Kode CPMK berulang pada {kode}: {daftar}.",
  },
  "K-CPMK-TANPA-CPL": {
    pesan: "{kode} tidak terpetakan ke CPL mana pun.",
    saran: "Setiap CPMK harus menjabarkan minimal satu CPL prodi.",
  },
  "K-CPMK-TANPA-SUB": {
    pesan: "{kode} belum memiliki Sub-CPMK.",
    saran:
      "Sub-CPMK adalah tahapan belajar mingguan; tanpa itu RPKPS tidak dapat disusun.",
  },
  "K-MK-CPL-TIDAK-DIJABARKAN": {
    pesan:
      "{kode} dibebankan pada {mk}, tetapi tidak ada satu pun CPMK yang menjabarkannya — CPL ini tidak akan pernah dinilai.",
    saran:
      "Tambahkan CPMK yang menjabarkan {kode}, atau lepaskan {kode} dari matriks.",
  },
  "K-MK-KODE-GANDA": {
    pesan: "Kode mata kuliah berulang: {daftar}.",
  },
  "K-MK-SEMESTER": {
    pesan: "Semester {semester} pada {kode} di luar rentang wajar.",
  },
  "K-MK-SKS-NOL": {
    pesan: "{kode} tidak memiliki sks.",
  },
  "K-MK-TANPA-CPL": {
    pesan: "{kode} tidak dibebani CPL mana pun.",
  },
  "K-MK-TANPA-CPMK": {
    pesan: "{kode} belum memiliki CPMK.",
  },
  "K-PL-BELUM-DIISI": {
    pesan: "Kurikulum belum mencantumkan profil lulusan.",
    saran:
      "Isi lembar Profil Lulusan pada berkas impor, atau tambahkan lewat halaman kurikulum. Tanpa itu, CPL tidak dapat ditelusuri ke janji program studi kepada lulusannya.",
  },
  "K-PL-DESKRIPSI-PENDEK": {
    pesan: "Rumusan {kode} terlalu pendek untuk menggambarkan sebuah profil.",
    saran:
      'Sebutkan peran beserta ranah kerjanya, mis. "Pengembang perangkat lunak untuk sistem informasi kesehatan".',
  },
  "K-PL-KODE-GANDA": {
    pesan: "Kode profil lulusan berulang: {daftar}.",
  },
  "K-PL-TANPA-CPL": {
    pesan: "{kode} tidak ditopang CPL mana pun.",
    saran:
      "Petakan minimal satu CPL ke {kode}, atau hapus profil itu dari kurikulum.",
  },
  "K-SUB-KKO-GANDA": {
    pesan: "{kode} mengandung {jumlah} kata kerja operasional ({daftar}).",
    saran: "Pecah menjadi beberapa Sub-CPMK agar penilaiannya tidak ambigu.",
  },
  "K-SUB-KODE-GANDA": {
    pesan: "Kode Sub-CPMK berulang pada {kode}: {daftar}.",
  },
  "K-SUB-LEVEL-LEBIH-TINGGI": {
    pesan:
      "{kode} berada di level {level} ({nama}), melampaui {kodeInduk} di level {levelInduk} ({namaInduk}).",
    saran: "Turunkan level Sub-CPMK, atau naikkan level CPMK induknya.",
  },
  "K-SUB-PENDEK": {
    pesan: "Rumusan {kode} terlalu pendek untuk dapat dinilai.",
  },
  "K-SUB-TANPA-KKO": {
    pesan: "Tidak ditemukan kata kerja operasional yang dikenali pada {kode}.",
  },
  "K-SUB-TIDAK-TERUKUR": {
    pesan: '{kode} memakai kata "{kata}" yang tidak dapat diamati.',
    saran:
      'Ganti dengan kata kerja operasional yang menghasilkan bukti terukur, mis. "menjelaskan" (C2) atau "menerapkan" (C3).',
  },
  "KK-BLOOM-TIMPANG": {
    pesan: "{persen}% skor {label} berada di level C1–C2.",
    saran:
      "Ujian yang hampir seluruhnya mengingat dan memahami tidak mengukur penerapan.",
  },
  "KK-JUMLAH-BUTIR": {
    pesan: "Baris {nomor} pada {label} memiliki jumlah butir kurang dari satu.",
  },
  "KK-KOSONG": {
    pesan: "Kisi-kisi {label} belum memiliki butir.",
  },
  "KK-LEVEL-MELAMPAUI": {
    pesan:
      "Butir {nomor} menguji {kode} pada level {level} ({nama}), lebih tinggi daripada level Sub-CPMK-nya {levelKurikulum}.",
    saran:
      "Menguji di atas level yang diajarkan membuat hasilnya sulit dipertanggungjawabkan.",
  },
  "KK-PROPORSI": {
    pesan:
      "{kode} mendapat {persenAjar}% porsi pembelajaran tetapi {persenUji}% skor {label}.",
  },
  "KK-SKOR-NOL": {
    pesan:
      "Baris {nomor} pada {label} berskor nol — butir tanpa skor tidak mengukur apa pun.",
  },
  "KK-SUB-CPMK-ASING": {
    pesan:
      "{label} menguji {kode}, yang tidak dijadwalkan pada mata kuliah ini.",
  },
  "KK-SUB-CPMK-BELUM-DIAJARKAN": {
    pesan: "{label} menguji {kode}, yang dijadwalkan {sebelum} ujian ini.",
  },
  "KK-SUB-CPMK-TIDAK-DIUJI": {
    pesan:
      "{jumlah} Sub-CPMK diajarkan sebelum {label} tetapi tidak diuji: {daftar}.",
    saran:
      "Tambahkan butir untuk Sub-CPMK tersebut, atau pindahkan ke ujian yang lain.",
  },
  "KK-TOTAL-SKOR": {
    pesan:
      "Total skor butir {label} berjumlah {total}, seharusnya {seharusnya}.",
  },
  "L1-KELEBIHAN": {
    pesan: "Beban melebihi pagu {persen}% ({terpakai} dari pagu {pagu}).",
  },
  "L1-KEKURANGAN": {
    pesan: "Beban kurang dari pagu {persen}% ({terpakai} dari pagu {pagu}).",
  },
  "L2-KELEBIHAN": {
    pesan:
      "Total beban semester {jamPerSks} jam/sks, melebihi target {target} jam/sks (toleransi {toleransi}%). Selisih {selisih}.",
  },
  "L2-KEKURANGAN": {
    pesan:
      "Total beban semester {jamPerSks} jam/sks, kurang dari target {target} jam/sks (toleransi {toleransi}%). Selisih {selisih}.",
  },
  "L1-TANPA-PAGU": {
    pesan: "Ada {total} aktivitas pada minggu tanpa pagu.",
  },
  "L1-TM-LEBIH": {
    pesan:
      "Tatap muka {terpakai} melampaui pagu TM {pagu} — butuh slot jadwal tambahan.",
  },
  "L2-UJIAN-TANPA-BEBAN": {
    pesan:
      "{jumlah} minggu ujian tidak dihitung sebagai beban belajar. Padahal mahasiswa yang menyiapkan ujian memang sedang belajar — tanpa itu invarian 45 jam/sks tidak akan pernah tercapai.",
  },
  "L3-NARASI-BEDA": {
    pesan:
      "Narasi metode menyebut {narasi}, sedangkan kolom alokasi waktu {kolom}. Keduanya harus sama.",
  },
  "L4-SLOT-KURANG": {
    pesan: "Minggu {minggu} butuh {butuh} slot terjadwal, tersedia {tersedia}.",
  },
  "NL-BELUM-LENGKAP": {
    pesan: "{kosong} dari {total} sel nilai masih kosong.",
    saran:
      "Boleh disimpan sebagian; capaian baru dapat ditutup setelah seluruhnya terisi.",
  },
  "NL-KOLOM-ASING": {
    pesan: "Kolom {daftar} tidak dikenali sebagai asesmen dan diabaikan.",
    saran:
      "Biasanya berkas berasal dari RPKPS lain, atau rencana sudah berubah sejak templat diunduh.",
  },
  "NL-KOLOM-HILANG": {
    pesan: "Asesmen {daftar} tidak ada kolomnya pada berkas.",
    saran: "Capaian yang bergantung pada asesmen itu tidak akan lengkap.",
  },
  "NL-NAMA-KOSONG": {
    pesan: "Baris {baris} (NIM {nim}) tidak punya nama.",
  },
  "NL-NIM-GANDA": {
    pesan: "NIM {nim} muncul dua kali, pada baris {sebelumnya} dan {baris}.",
  },
  "NL-NIM-KOSONG": {
    pesan: "Baris {baris} berisi nilai tetapi tidak punya NIM.",
  },
  "NL-SKOR-BUKAN-ANGKA": {
    pesan: 'Baris {baris} kolom {kode} berisi "{isi}", yang bukan angka.',
  },
  "NL-SKOR-DILUAR-RENTANG": {
    pesan:
      "Baris {baris} kolom {kode} berisi {angka}, di luar rentang {min}–{maks}.",
  },
  "PA-ASESMEN-TANPA-SUB-CPMK": {
    pesan:
      "{kode} ({nama}) berbobot {bobot}% tetapi tidak menagih Sub-CPMK mana pun.",
    saran:
      "Bobotnya tidak mengalir ke capaian mana pun — nilainya hanya jadi angka akhir.",
  },
  "PA-CPL-TANPA-BOBOT": {
    pesan:
      "CPL {daftar} dibebankan pada mata kuliah ini tetapi tidak pernah dinilai.",
    saran:
      "Beban CPL tanpa asesmen adalah temuan B3 pada docs/02 §2.1 — janji kurikulum yang tak bisa dibuktikan.",
  },
  "PA-KISI-TANPA-UJIAN": {
    pesan:
      "Kisi-kisi {jenis} berisi {jumlah} butir, tetapi tidak ada baris ujian {jenis} berbobot pada tabel mingguan.",
    saran:
      "Tandai satu baris sebagai {jenis} dan beri bobot, atau hapus kisi-kisinya — selama menggantung, butirnya tidak menyumbang capaian Sub-CPMK mana pun.",
  },
  "PA-KOMPONEN-TANPA-ASESMEN": {
    pesan:
      'Komponen "{nama}" berbobot {bobot}% tetapi tidak dirinci baris mingguan maupun lembar tugas.',
    saran:
      "Komponen tanpa asesmen berarti ada nilai yang tidak pernah bisa dikumpulkan.",
  },
  "PA-KOMPONEN-TIDAK-COCOK": {
    pesan:
      'Asesmen pada komponen "{nama}" berjumlah {dirinci}%, sedangkan komponennya {bobot}%.',
  },
  "PA-KOSONG": {
    pesan: "Belum ada satu pun asesmen berbobot pada mata kuliah ini.",
  },
  "PA-SUB-CPMK-ASING": {
    pesan: "Asesmen menagih {kode}, yang bukan milik mata kuliah ini.",
  },
  "PA-SUB-CPMK-TANPA-BOBOT": {
    pesan: "{jumlah} Sub-CPMK tidak mendapat bobot penilaian: {daftar}.",
    saran:
      "Capaiannya tidak akan pernah terukur, sehingga CPL di atasnya ikut menggantung.",
  },
  "PA-TANPA-KOMPONEN": {
    pesan:
      "{kode} ({nama}) berbobot {bobot}% tetapi tidak masuk komponen nilai mana pun.",
    saran:
      "Tanpa komponen, bobotnya tidak dapat direkonsiliasi dan nilainya tidak dapat dikumpulkan.",
  },
  "PA-TOTAL": {
    pesan: "Seluruh asesmen berjumlah {total}%, seharusnya 100%.",
  },
  "PA-TUGAS-BEDA-BOBOT": {
    pesan:
      'Lembar tugas pada komponen "{nama}" menyebut bobot {bobotTugas}%, sedangkan baris mingguan komponen itu berjumlah {bobotMingguan}%.',
    saran:
      "Bobot diambil dari baris mingguan. Samakan angkanya agar lembar tugas tidak menyesatkan.",
  },
  "PA-UJIAN-TANPA-KISI-KISI": {
    pesan:
      "Bobot {kode} dibagi rata ke {jumlah} Sub-CPMK karena kisi-kisinya belum diisi.",
    saran:
      "Kisi-kisi membuat porsi tiap Sub-CPMK mengikuti skor butir, bukan tebakan rata.",
  },
  "TL-AKAR-PENDEK": {
    pesan: "Akar masalah {kode} terlalu pendek (minimal {minimal} karakter).",
    saran:
      '"Mahasiswa kurang belajar" bukan akar masalah — sebut apa pada rancangan atau pelaksanaan yang membuatnya begitu.',
  },
  "TL-CPL-BELUM-TERCAPAI": {
    pesan: "CPL {daftar} belum tercapai pada mata kuliah ini.",
    saran:
      "Bawa ke evaluasi kurikulum tingkat prodi; satu mata kuliah tidak menanggung CPL sendirian.",
  },
  "TL-TANPA-REFLEKSI": {
    pesan:
      "Catatan proses pembelajaran belum diisi (minimal {minimal} karakter).",
    saran: "Apa yang berjalan seperti rencana, apa yang tidak, dan mengapa.",
  },
  "TL-TANPA-RTL": {
    pesan:
      "{jumlah} CPMK tidak tercapai dan belum punya tindak lanjut: {daftar}.",
    saran:
      "Inilah yang membedakan evaluasi dari laporan nilai. CPMK yang gagal tanpa tindak lanjut berarti siklus PPEPP berhenti di huruf E.",
  },
  "TL-TANPA-TA-SASARAN": {
    pesan:
      "Tindakan untuk {kode} belum menyebut tahun akademik pemberlakuannya.",
    saran:
      "Tanpa TA sasaran, tindak lanjut tidak pernah punya waktu jatuh tempo dan tidak dapat diverifikasi.",
  },
  "TL-TINDAKAN-PENDEK": {
    pesan: "Tindakan untuk {kode} terlalu pendek (minimal {minimal} karakter).",
    saran:
      "Tindakan harus dapat diperiksa semester depan: apa yang diubah, oleh siapa.",
  },
  "U-ALASAN-PENDEK": {
    pesan: "Butir {kode} belum menyertakan alasan yang dapat dinilai.",
    saran:
      "Sebutkan apa yang salah pada rumusan sekarang, bukan hanya bahwa ia perlu diganti.",
  },
  "U-CPL-DILUAR-MK": {
    pesan: "CPL {kode} tidak dibebankan pada {mk}.",
    saran:
      "Membebankan CPL baru pada mata kuliah adalah keputusan matriks CPL×MK — di luar kewenangan usulan ini.",
  },
  "U-CPL-TIDAK-ADA": { pesan: "CPL {kode} tidak ada di kurikulum ini." },
  "U-CPMK-BARU-TANPA-CPL": {
    pesan: "{kode} belum dipetakan ke satu pun CPL.",
    saran: "CPMK yang tidak menjabarkan CPL apa pun memutus rantai penelusuran OBE.",
  },
  "U-CPMK-BARU-TANPA-SUB": {
    pesan: "{kode} belum diuraikan menjadi Sub-CPMK.",
    saran: "Tambahkan minimal satu butir SUB_BARU pada usulan yang sama.",
  },
  "U-CPMK-TIDAK-ADA": { pesan: "CPMK {kode} tidak ada pada {mk}." },
  "U-DASAR-TANPA-RUJUKAN": {
    pesan: "Dasar {jenis} pada butir {kode} tidak menyebut sumber yang dapat ditelusuri.",
    saran: "Hanya CATATAN_DOSEN yang boleh tanpa rujukan.",
  },
  "U-KODE-DIPAKAI-CPMK": {
    pesan: "Kode {kode} sudah dipakai CPMK lain pada {mk}.",
    saran:
      "Kode tidak boleh didaur ulang — nomor CPMK di dokumen lama harus tetap berarti satu hal.",
  },
  "U-KODE-DIPAKAI-SUB": {
    pesan: "Kode {kode} sudah dipakai Sub-CPMK lain pada {mk}.",
  },
  "U-RUMUSAN-KOSONG": { pesan: "Butir {jenis} pada {kode} belum berisi rumusan." },
  "U-SUB-KODE-KOSONG": { pesan: "Sub-CPMK baru pada {kode} belum diberi kode." },
  "U-SUB-SASARAN-KOSONG": { pesan: "Butir {jenis} harus menyebut Sub-CPMK sasaran." },
  "U-SUB-TIDAK-ADA": { pesan: "Sub-CPMK {kode} tidak ada pada {mk}." },
  "U-TANPA-DASAR": {
    pesan: "Butir {kode} tidak membawa satu pun dasar.",
    saran:
      "Lampirkan temuan validator, sinyal industri, masukan DUDI, tracer study, atau argumen tertulis.",
  },
  "U-INDUK-DITOLAK": {
    pesan: "{kode} diterima, tetapi CPMK induknya ({induk}) ditolak.",
    saran: "Tolak juga Sub-CPMK ini, atau terima CPMK induknya.",
  },
  "U-MK-TIDAK-ADA": {
    pesan: "Mata kuliah {kode} tidak ada di kurikulum ini.",
  },
  "U-RALAT-GESER-BLOOM": {
    pesan: "Perbaikan pada {kode} menggeser level Bloom rumusan.",
    saran: SARAN_RALAT,
  },
  "U-RALAT-JENIS-SALAH": {
    pesan: "Butir {jenis} tidak dapat ditempuh lewat jalur ralat.",
    saran: SARAN_RALAT,
  },
  "U-RALAT-TERLALU-JAUH": {
    pesan:
      "Perbaikan pada {kode} mengubah {jarak} karakter, melebihi ambang ralat ({ambang}).",
    saran: SARAN_RALAT,
  },
  "U-RALAT-UBAH-KKO": {
    pesan: "Perbaikan pada {kode} mengubah kata kerja operasionalnya.",
    saran: SARAN_RALAT,
  },
  "U-TANPA-BUTIR": {
    pesan: "Usulan belum berisi satu butir pun.",
  },
  "U-TANPA-BUTIR-DITERIMA": {
    pesan:
      "Tidak ada butir yang diterima, jadi tidak ada yang dapat diterapkan.",
    saran: "Tolak usulan ini, atau kembalikan untuk revisi.",
  },
  "W-MINGGU-BERLEBIH": {
    pesan:
      "Minggu {daftar} berada di luar {minggu} minggu semester menurut kebijakan beban belajar.",
    saran:
      "Baris ini tidak punya pagu waktu, sehingga alokasinya tidak dapat diperiksa per pertemuan.",
  },
  "W-TANPA-BENTUK-NILAI": {
    pesan:
      "Minggu {minggu} punya bobot tetapi bentuk penilaiannya belum ditulis.",
  },
  "W-TANPA-INDIKATOR": {
    pesan:
      "Minggu {minggu} punya bobot {bobot}% tetapi belum ada indikator penilaian.",
  },
  "W-TANPA-REFERENSI": {
    pesan: "Minggu {minggu} belum merujuk pustaka.",
  },
  "W-TANPA-SUB-CPMK": {
    pesan: "Minggu {minggu} belum dikaitkan ke Sub-CPMK mana pun.",
  },
  "W-TANPA-TOPIK": {
    pesan: "Minggu {minggu} belum punya topik.",
  },
  "W-UJIAN-DI-LUAR-POSISI": {
    pesan: "{daftar} — kebijakan menempatkan ujian di minggu {posisi}.",
    saran:
      "Pastikan ini memang mengikuti kalender akademik prodi, bukan pergeseran yang tidak disengaja.",
  },
} as const;

/**
 * Bentuk kamus temuan: kunci dan medan yang sama persis dengan `temuanId`,
 * tetapi nilainya `string` biasa.
 *
 * `as const` di atas membuat tiap kalimat bertipe literal dirinya sendiri —
 * berguna untuk menguncikan daftar kunci, tetapi akan menolak terjemahan apa
 * pun kalau dipakai langsung sebagai tipe `temuanEn`. Pemetaan ini melebarkan
 * nilainya tanpa melepas jaminan yang sesungguhnya penting: kode yang sama,
 * dan medan `saran` yang ada persis di entri yang sama.
 */
export type KamusTemuan = {
  [K in keyof typeof temuanId]: { [M in keyof (typeof temuanId)[K]]: string };
};
