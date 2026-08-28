import "server-only";
import type { DrafRpkps } from "@/domain/rpkps/draf";
import { normalisasiKe100 } from "@/domain/rpkps/normalisasi";
import { jalankanTugasAi } from "./gerbang";
import { pakaiKredensial } from "./kredensial";
import {
  SkemaKerangka,
  SkemaPertemuan,
  SkemaTugasKisi,
  type KeluaranKerangka,
  type KeluaranPertemuan,
  type KeluaranTugasKisi,
} from "./skema-draf";

/**
 * Tugas AI: menyusun draf isi RPKPS.
 *
 * Mencakup T4–T8 (materi, metode, aktivitas, lembar tugas) dan T9–T11 (rubrik,
 * kisi-kisi) pada docs/01 §3, dijalankan dalam TIGA panggilan berurutan:
 * kerangka → pertemuan → tugas dan kisi-kisi.
 *
 * # Mengapa tiga panggilan, bukan satu
 *
 * Sebelumnya satu panggilan dengan anggaran 32.000 token keluaran. Bentuk itu
 * paling boros terhadap kuota gratis penyedia:
 *
 * - Kegagalan di menit terakhir — TERPOTONG atau SKEMA_GAGAL — menghanguskan
 *   seluruh anggaran tanpa menghasilkan apa pun. Sekarang yang hangus paling
 *   banyak satu tahap.
 * - Beberapa penyedia menghitung `max_tokens` yang DIMINTA terhadap batas
 *   token-per-menit, bukan yang benar-benar terpakai. Memesan 32.000 untuk
 *   kebutuhan nyata sekitar 7.000 membakar jatah yang tak pernah dipakai.
 * - Grammar structured output tiap tahap kini jauh di bawah ambang ukuran yang
 *   dulu memaksa larangan `.nullable()` (lihat skema-draf.ts).
 *
 * Yang DIBAYAR lebih mahal: jumlah permintaan naik dari satu menjadi tiga.
 * Pada penyedia yang batasnya permintaan-per-hari, itu memburuk. Karena itu
 * PANDUAN_DASAR ditaruh sebagai awalan yang IDENTIK di ketiga tahap — bagian
 * itu kena prompt caching (eksplisit di Anthropic, implisit di Gemini),
 * sehingga ongkos masukan tambahannya tipis.
 *
 * Ketiganya berjalan BERURUTAN, bukan paralel. Tahap 2 dan 3 tidak saling
 * bergantung, tetapi menembakkan keduanya bersamaan menaikkan puncak
 * permintaan-per-menit — batas yang paling cepat tersentuh di tier gratis.
 *
 * Dosen menyetujui seluruh dokumen dengan satu tombol, jadi prompt ini TIDAK
 * boleh menjadi satu-satunya penjaga aturan yang bisa dihitung. Setiap angka
 * yang disebut di sini diperiksa ulang oleh periksaDraf() di domain — atas
 * draf GABUNGAN ketiga tahap, sama seperti sebelumnya.
 */

/**
 * Blok STABIL yang di-cache penyedia — jangan sisipkan apa pun yang berubah.
 *
 * Dipakai sebagai AWALAN yang sama persis di ketiga tahap. Satu byte yang
 * berbeda membatalkan cache, jadi bagian ini tidak boleh menyebut tahap mana
 * pun secara khusus.
 */
const PANDUAN_DASAR = `Anda menyusun draf Rencana Program dan Kegiatan Pembelajaran
Semester (RPKPS) berbasis Outcome-Based Education untuk satu mata kuliah.
Anda menghasilkan DRAF; dosen pengampu yang menyetujui dan bertanggung jawab
atas dokumen akhirnya.

Penyusunan dibagi menjadi tiga tahap dan Anda mengerjakan SATU tahap tiap
panggilan. Hasil tahap sebelumnya diberikan kepada Anda sebagai keputusan yang
SUDAH FINAL — jangan mengubahnya, jangan mengusulkan penggantinya.

# Yang sudah ditetapkan dan TIDAK boleh Anda ubah

Kerangka RPKPS sudah ada sebelum Anda dipanggil:
- Nomor minggu, mana yang pertemuan efektif dan mana minggu ujian.
- Alokasi menit tatap muka, penugasan terstruktur, dan belajar mandiri tiap
  minggu. Sudah dihitung dari kebijakan beban belajar institusi dan pas dengan
  invarian 45 jam per sks per semester. JANGAN mengusulkan menit apa pun.
- Sub-CPMK yang dijadwalkan pada tiap minggu, berasal dari buku kurikulum.
- Daftar pustaka yang sudah ada.

Isi HANYA minggu yang ditandai EFEKTIF. Minggu ujian tidak diisi.

# Cara mengosongkan sebuah isian

Skema keluaran tidak mengenal null. Isian teks yang tidak berlaku diisi string
KOSONG (""), dan durasi_menit yang belum ditetapkan diisi 0. Jangan menuliskan
kata "null", "-", "tidak ada", atau tanda apa pun sebagai pengganti isi.

# Aturan isi yang berlaku di semua tahap

- Tulis dalam bahasa Indonesia akademik. Rumusan indikator memakai kata kerja
  operasional yang menghasilkan bukti terukur.
- Jangan menyebut nomor peraturan, standar, atau regulasi yang tidak ada di
  konteks.
- Sesuaikan isi dengan substansi mata kuliahnya. Jangan menghasilkan kalimat
  generik yang sama untuk semua minggu — tiap minggu punya topik sendiri.
- Kode Sub-CPMK yang Anda sebut harus berasal dari daftar Sub-CPMK di konteks.
  Jangan mengarang kode.`;

/** Tahap 1: kerangka dokumen dan SELURUH keputusan aritmetika. */
const PANDUAN_KERANGKA = `${PANDUAN_DASAR}

# TAHAP 1 DARI 3 — KERANGKA

Pada tahap ini Anda menetapkan kerangka dokumen dan seluruh angkanya. Isi
tiap minggu disusun pada tahap berikutnya; di sini Anda BELUM menulis topik
maupun aktivitas.

Yang Anda susun:

- deskripsi: deskripsi mata kuliah untuk bagian A template, 3–6 kalimat. Sebut
  posisi mata kuliah dalam kurikulum, cakupan materinya, dan kaitannya dengan
  CPL yang dibebankan.
- kalimat_pembuka_cpmk: satu kalimat sebelum daftar CPMK, mis. "Setelah
  menyelesaikan mata kuliah ini, mahasiswa mampu…".
- komponen_nilai: 3–5 komponen penilaian beserta bobotnya, disesuaikan dengan
  cara mata kuliah ini dinilai. Totalnya harus TEPAT 100.
- pustaka_baru: pustaka yang perlu DITAMBAHKAN. Usulkan hanya pustaka yang
  benar-benar Anda yakini ada. Tulis dalam gaya sitasi lengkap: penulis, tahun,
  judul, penerbit atau URL. JANGAN mengarang ISBN dan JANGAN mengarang nomor
  halaman. Bila tidak yakin sebuah buku benar ada, lebih baik tidak
  menyebutkannya sama sekali. Pustaka yang SUDAH ada pada konteks tidak perlu
  diulang — ia dipertahankan otomatis. Nomor untuk pustaka baru dimulai dari
  "nomorBerikutnya" pada konteks, naik satu per satu untuk tiap jenis. Isi url
  dengan "" bila pustaka itu tidak punya alamat daring.
- bobot_minggu: bobot penilaian tiap minggu EFEKTIF terhadap nilai akhir.
  Minggu yang tidak dinilai diberi bobot 0, dan tetap harus disebut.

# Aritmetika — kerjakan dengan urutan ini, jangan dengan menaksir

Dua deret angka harus berjumlah TEPAT 100: komponen_nilai dan bobot_minggu.
Keduanya tidak perlu cocok baris per baris, hanya jumlahnya yang harus sama.

Aturan yang membuat penjumlahan ini mudah dan jangan dilanggar:

1. SETIAP bobot ditulis dalam KELIPATAN 5 — 5, 10, 15, 20, 25, dan seterusnya.
   Jangan menulis 7, 12,5, atau 33. Angka kelipatan 5 dapat dijumlahkan tanpa
   keliru; angka lain tidak.
2. Pada bobot_minggu, pilih 4–7 minggu yang benar-benar menagih pekerjaan dan
   beri bobot hanya pada minggu itu. SEMUA minggu efektif lain diberi 0.
   Menyebar bobot kecil ke belasan minggu adalah cara tercepat salah hitung,
   dan juga bukan cara mata kuliah dinilai sesungguhnya.
3. Jumlahkan bobot yang bukan nol satu per satu, berurutan dari atas.
   Tuliskan jalannya dalam kepala: 20, lalu 20+15=35, lalu 35+25=60, dan
   seterusnya. Berhenti ketika mencapai 100.
4. Bila hasilnya bukan 100, perbaiki dengan mengubah SATU angka saja — angka
   terbesar — sebesar selisihnya. Jangan menyesuaikan beberapa angka sekaligus;
   itu justru sumber kesalahan berikutnya.

Contoh pembagian yang sah untuk 14 minggu efektif:

  komponen_nilai : Tugas 30, Kuis 15, UTS 25, UAS 30            → 100
  bobot_minggu   : minggu 4 = 15, minggu 7 = 25, minggu 10 = 15,
                   minggu 12 = 15, minggu 14 = 30, sisanya 0    → 100

Kesalahan yang PALING SERING terjadi: bobot_minggu berjumlah 105 atau 110
karena satu minggu terakhir ditambahkan tanpa mengurangi minggu lain. Sebelum
menjawab, jumlahkan sekali lagi dari awal dan pastikan hasilnya 100, bukan
mendekati 100.

Sebarkan bobot secara masuk akal: minggu berbobot besar adalah minggu yang
memang menagih pekerjaan besar. Jangan meratakan begitu saja.`;

/** Tahap 2: isi tiap minggu. Bobot sudah ditetapkan, jadi ini murni prosa. */
const PANDUAN_PERTEMUAN = `${PANDUAN_DASAR}

# TAHAP 2 DARI 3 — ISI PERTEMUAN

Kerangka dan seluruh angkanya sudah ditetapkan pada tahap sebelumnya dan
diberikan kepada Anda di dalam konteks. Bobot tiap minggu TIDAK Anda tentukan
lagi dan tidak ada pada skema keluaran tahap ini.

Untuk TIAP minggu efektif, susun:

- topik: satu frasa, pokok bahasan minggu itu.
- subtopik: 2–5 butir sub-pokok bahasan.
- metode_narasi: metode pembelajaran yang dipakai, mis. "Kuliah interaktif,
  diskusi kelompok kecil, dan latihan terbimbing". Pilih metode yang sesuai
  level Bloom Sub-CPMK minggu itu — level tinggi menuntut metode aktif, bukan
  ceramah satu arah.
- aktivitas_dosen dan aktivitas_mahasiswa: apa yang masing-masing lakukan.
- tugas_terstruktur: pekerjaan di luar kelas, atau "" bila tidak ada.
- penilaian_jenis dan penilaian_sistem: bentuk penilaian minggu itu dan cara
  penyekorannya. Isi keduanya "" bila bobot minggu itu 0; isi keduanya bila
  bobotnya lebih dari 0.
- indikator: indikator pencapaian yang dapat diamati. WAJIB ada bila bobot
  minggu itu lebih dari 0.
- pustaka_ref: rujukan pustaka yang dipakai minggu itu, disalin PERSIS dari
  kolom "ref". Dua sumber yang sah dan HANYA dua ini: daftar pustaka di dalam
  <rpkps>, dan pustaka baru pada <kerangka> yang sudah ditetapkan tahap 1.
  Jangan merujuk apa pun di luar kedua daftar itu.

Sebutkan SELURUH minggu efektif yang ada pada konteks, tidak boleh ada yang
terlewat dan tidak boleh ada minggu ujian yang ikut disebut.`;

/** Tahap 3: lampiran — lembar rencana tugas dan kisi-kisi ujian. */
const PANDUAN_TUGAS_KISI = `${PANDUAN_DASAR}

# TAHAP 3 DARI 3 — TUGAS DAN KISI-KISI

Kerangka, angka, dan isi tiap minggu sudah ditetapkan pada tahap sebelumnya
dan diberikan kepada Anda di dalam konteks. Sekarang susun lampirannya.

Jenis tugas HANYA "INDIVIDU" atau "KELOMPOK" — tidak ada nilai lain. Bila tugas
berupa proyek, studi kasus, atau praktikum, pilih salah satu dari dua nilai itu
sesuai cara pengerjaannya, lalu jelaskan bentuknya pada deskripsi.

# Aritmetika — kerjakan dengan urutan ini, jangan dengan menaksir

1. Bobot kriteria di dalam SATU tugas harus berjumlah TEPAT 100. Pakai 3–5
   kriteria dan tulis bobotnya dalam KELIPATAN 5, mis. 25 + 25 + 30 + 20 = 100.
   Jumlahkan satu per satu sebelum berpindah ke tugas berikutnya; tiap tugas
   dihitung sendiri-sendiri dan tidak saling menutupi.
2. Skor seluruh butir dalam SATU kisi-kisi harus berjumlah TEPAT 100. Pakai
   KELIPATAN 5 di sini juga. Bila jumlahnya meleset, perbaiki dengan mengubah
   SATU butir berskor terbesar sebesar selisihnya — bukan beberapa butir
   sekaligus. Kisi-kisi UTS dan UAS masing-masing berjumlah 100, bukan 100
   untuk keduanya digabung.
3. Bobot tiap tugas harus muat di dalam komponen nilai yang menampungnya, dan
   nama komponen yang Anda sebut harus PERSIS seperti pada komponen_nilai yang
   sudah ditetapkan tahap 1 dan diberikan di konteks.

# Aturan kisi-kisi

4. Kisi-kisi UTS hanya menguji Sub-CPMK yang dijadwalkan SEBELUM minggu UTS;
   UAS menguji yang setelahnya. Seluruh Sub-CPMK harus teruji di salah satunya.
5. level_bloom tiap butir ujian tidak boleh melampaui level Sub-CPMK yang diuji.
6. Indikator butir sebaiknya bersandar pada topik minggu yang bersangkutan,
   yang sudah tersedia di konteks.

Draf yang melanggar aturan ini ditolak seluruhnya. Sebelum menjawab,
jumlahkan sekali lagi tiap deret dari awal dan pastikan hasilnya 100, bukan
mendekati 100.`;

/**
 * Anggaran keluaran tiap tahap.
 *
 * Angkanya diturunkan dari kebutuhan nyata, bukan dari cadangan berlebihan:
 * kerangka menulis beberapa paragraf dan dua daftar pendek; pertemuan menulis
 * ~250 token × jumlah minggu efektif; tugas dan kisi-kisi menulis dua lampiran.
 * Sisanya adalah ruang untuk token penalaran, yang pada model berpikir ikut
 * ditagih sebagai keluaran.
 */
const ANGGARAN = {
  kerangka: 4_000,
  pertemuan: 14_000,
  tugasKisi: 10_000,
} as const;

export interface HasilDraf {
  draf: DrafRpkps;
  penyedia: string;
  model: string;
  /**
   * Penyesuaian aritmetika yang dilakukan server atas keluaran model, untuk
   * ditunjukkan kepada dosen sebelum ia menyetujui. Kosong berarti angka yang
   * dibaca dosen persis seperti yang diusulkan model.
   */
  catatan: string[];
}

export async function susunDraf(opsi: {
  penggunaId: string;
  rpkpsId: string;
  konteks: unknown;
  /** Kosong berarti kunci bawaan dosen. */
  kredensialId?: string | null;
}): Promise<HasilDraf> {
  const konteksTeks = JSON.stringify(opsi.konteks, null, 2);

  // Kredensial dibuka SEKALI untuk ketiga tahap. Selain menghemat dua
  // dekripsi, ini yang menjamin ketiganya memakai kunci — dan tagihan — yang
  // sama meski dosen mengubah kunci bawaannya di tengah penyusunan.
  const terpilih = await pakaiKredensial(opsi.penggunaId, opsi.kredensialId);
  const dasar = { penggunaId: opsi.penggunaId, entitasId: opsi.rpkpsId, terpilih };

  // ── Tahap 1 · kerangka dan seluruh angkanya ─────────────────────────
  const kerangka = await jalankanTugasAi({
    ...dasar,
    kodeTugas: "DRAF_KERANGKA",
    panduan: PANDUAN_KERANGKA,
    permintaan:
      "Susun kerangka RPKPS untuk mata kuliah berikut.\n\n<rpkps>\n" +
      konteksTeks +
      "\n</rpkps>",
    skema: SkemaKerangka,
    maxTokens: ANGGARAN.kerangka,
  });
  const k: KeluaranKerangka = kerangka.data;

  // Keputusan tahap 1 diteruskan sebagai fakta, bukan sebagai saran. Bentuknya
  // ringkas supaya ongkos masukan tahap berikutnya tidak membengkak.
  const putusanKerangka = {
    komponenNilai: k.komponen_nilai,
    bobotMinggu: k.bobot_minggu,
    pustakaBaru: k.pustaka_baru.map((b) => ({
      ref: `${b.jenis}-${b.nomor}`,
      teks: b.teks,
    })),
  };

  // ── Tahap 2 · isi tiap minggu ───────────────────────────────────────
  const pertemuan = await jalankanTugasAi({
    ...dasar,
    kodeTugas: "DRAF_PERTEMUAN",
    panduan: PANDUAN_PERTEMUAN,
    permintaan:
      "Susun isi tiap pertemuan. Kerangka berikut sudah final.\n\n<rpkps>\n" +
      konteksTeks +
      "\n</rpkps>\n\n<kerangka>\n" +
      JSON.stringify(putusanKerangka, null, 2) +
      "\n</kerangka>",
    skema: SkemaPertemuan,
    maxTokens: ANGGARAN.pertemuan,
  });
  const p: KeluaranPertemuan = pertemuan.data;

  // ── Tahap 3 · tugas dan kisi-kisi ───────────────────────────────────
  // Topik tiap minggu ikut dikirim: kisi-kisi yang menguji materi yang benar
  // memerlukan pengetahuan tentang apa yang sebenarnya diajarkan minggu itu.
  const tugasKisi = await jalankanTugasAi({
    ...dasar,
    kodeTugas: "DRAF_TUGAS_KISI",
    panduan: PANDUAN_TUGAS_KISI,
    permintaan:
      "Susun lembar rencana tugas dan kisi-kisi. Dua tahap sebelumnya sudah final.\n\n<rpkps>\n" +
      konteksTeks +
      "\n</rpkps>\n\n<kerangka>\n" +
      JSON.stringify(putusanKerangka, null, 2) +
      "\n</kerangka>\n\n<topik>\n" +
      JSON.stringify(
        p.pertemuan.map((x) => ({ minggu: x.minggu, topik: x.topik })),
        null,
        2,
      ) +
      "\n</topik>",
    skema: SkemaTugasKisi,
    maxTokens: ANGGARAN.tugasKisi,
  });
  const t: KeluaranTugasKisi = tugasKisi.data;

  const { draf, catatan } = gabungkan(k, p, t);

  return {
    // Penyedia dan model dilaporkan dari tahap terakhir; ketiganya memakai
    // resolusi yang sama, jadi nilainya identik.
    penyedia: tugasKisi.penyedia,
    model: tugasKisi.model,
    draf,
    catatan,
  };
}

/**
 * Menormalkan sederet bobot menjadi tepat 100 dan mencatat penyesuaiannya.
 *
 * Penyesuaian TIDAK disembunyikan: dosen menyetujui seluruh dokumen dengan
 * satu tombol, jadi ia berhak tahu angka mana yang bukan lagi angka model.
 */
function rapikan(
  nilai: number[],
  label: string,
  catatan: string[],
  // Skor butir ujian bukan persen — ia angka dari 100. Menuliskannya dengan
  // tanda persen akan membuat dosen mengira ada bobot ketiga di dokumen.
  satuan: "%" | "" = "%",
): number[] {
  const h = normalisasiKe100(nilai);
  if (h.disesuaikan) {
    catatan.push(
      `${label} disesuaikan dari ${h.totalAsli}${satuan} menjadi 100${satuan}; perbandingan antar angkanya dipertahankan.`,
    );
  }
  return h.nilai;
}

/**
 * Menyatukan keluaran tiga tahap menjadi satu draf.
 *
 * Bobot pertemuan diambil dari tahap 1, bukan dari tahap 2 — tahap 2 memang
 * tidak memilikinya. Minggu yang bobotnya tidak disebut tahap 1 dianggap 0.
 *
 * # Mengapa aritmetikanya dinormalkan di sini
 *
 * Empat deret angka pada draf wajib berjumlah tepat 100: bobot komponen nilai,
 * bobot mingguan, bobot kriteria tiap tugas, dan skor butir tiap kisi-kisi.
 * Menjumlahkan belasan angka dalam kepala adalah hal yang tidak dapat
 * diandalkan dari sebuah model bahasa, dan meleset sedikit saja membuat
 * periksaDraf() menolak SELURUH draf — dosen kehilangan isi yang sebenarnya
 * bagus gara-gara jumlah yang 110, bukan gara-gara isinya.
 *
 * Karena itu jumlahnya dirapikan di sini, deterministik, dengan proporsi
 * antar angka dipertahankan. Prompt tetap meminta jumlah yang tepat — makin
 * jarang penormalan terpakai, makin dekat hasilnya dengan maksud model — dan
 * periksaDraf() tetap penjaga terakhir untuk keluaran yang jumlahnya terlalu
 * jauh untuk disebut kesalahan hitung (lihat normalisasi.ts).
 *
 * Penormalan sengaja dikerjakan DI SINI, bukan tepat setelah tahap 1. Artinya
 * tahap 3 masih melihat bobot komponen versi model saat menakar bobot tiap
 * tugas. Itu dapat diterima karena bobot tugas tidak diadu secara angka dengan
 * komponen nilai oleh periksaDraf() — yang diperiksa hanya nama komponennya.
 * Memindahkannya ke muka akan lebih rapi dan sudah dipertimbangkan; syaratnya
 * susunDraf() disentuh, dan itu ditahan selama alur kredensial di sana masih
 * berubah.
 */
function gabungkan(
  k: KeluaranKerangka,
  p: KeluaranPertemuan,
  t: KeluaranTugasKisi,
): { draf: DrafRpkps; catatan: string[] } {
  const catatan: string[] = [];
  const bobot = new Map(k.bobot_minggu.map((b) => [b.minggu, b.bobot]));

  const bobotKomponen = rapikan(
    k.komponen_nilai.map((x) => x.bobot),
    "Bobot komponen nilai",
    catatan,
  );

  // Dinormalkan atas minggu yang benar-benar ada pada draf, bukan atas
  // bobot_minggu mentah: itulah deret yang nanti dijumlahkan periksaDraf().
  const bobotMingguan = rapikan(
    p.pertemuan.map((x) => bobot.get(x.minggu) ?? 0),
    "Bobot mingguan",
    catatan,
  );

  const draf: DrafRpkps = {
    deskripsi: k.deskripsi.trim(),
    kalimatPembukaCpmk: k.kalimat_pembuka_cpmk.trim(),
    komponenNilai: k.komponen_nilai.map((x, i) => ({
      nama: x.nama.trim(),
      bobot: bobotKomponen[i],
    })),
    pustakaBaru: k.pustaka_baru.map((b) => ({
      jenis: b.jenis,
      nomor: b.nomor,
      teks: b.teks.trim(),
      url: teksAtauNull(b.url),
    })),
    pertemuan: p.pertemuan.map((x, i) => ({
      minggu: x.minggu,
      topik: x.topik.trim(),
      subtopik: bersihkanDaftar(x.subtopik),
      metodeNarasi: x.metode_narasi.trim(),
      aktivitasDosen: x.aktivitas_dosen.trim(),
      aktivitasMahasiswa: x.aktivitas_mahasiswa.trim(),
      tugasTerstruktur: teksAtauNull(x.tugas_terstruktur),
      penilaianJenis: teksAtauNull(x.penilaian_jenis),
      penilaianSistem: teksAtauNull(x.penilaian_sistem),
      bobot: bobotMingguan[i],
      indikator: bersihkanDaftar(x.indikator),
      pustakaRef: x.pustaka_ref.map((r) => r.trim().toUpperCase()),
    })),
    tugas: t.tugas.map((x) => ({
      nomor: x.nomor,
      nama: x.nama.trim(),
      jenis: x.jenis,
      mingguMulai: x.minggu_mulai,
      mingguSelesai: x.minggu_selesai,
      bobot: x.bobot,
      komponenNilai: teksAtauNull(x.komponen_nilai),
      deskripsi: x.deskripsi.trim(),
      uraianTugas: teksAtauNull(x.uraian_tugas),
      formatLuaran: teksAtauNull(x.format_luaran),
      subCpmkKode: x.sub_cpmk_kode.map((kode) => kode.trim().toUpperCase()),
      kriteria: bobotKriteria(x, catatan),
    })),
    kisiKisi: t.kisi_kisi.map((x) => {
      const skor = rapikan(
        x.butir.map((b) => b.skor),
        `Skor butir kisi-kisi ${x.jenis}`,
        catatan,
        "",
      );
      return {
        jenis: x.jenis,
        durasiMenit: x.durasi_menit > 0 ? x.durasi_menit : null,
        butir: x.butir.map((b, i) => ({
          nomor: b.nomor,
          subCpmkKode: b.sub_cpmk_kode.trim().toUpperCase(),
          levelBloom: b.level_bloom,
          bentuk: b.bentuk,
          jumlahButir: b.jumlah_butir,
          skor: skor[i],
          indikator: teksAtauNull(b.indikator),
        })),
      };
    }),
  };

  return { draf, catatan };
}

/** Kriteria satu lembar tugas, bobotnya sudah dirapikan menjadi 100. */
function bobotKriteria(
  x: KeluaranTugasKisi["tugas"][number],
  catatan: string[],
) {
  const bobot = rapikan(
    x.kriteria.map((c) => c.bobot),
    `Bobot kriteria tugas ${x.nomor}`,
    catatan,
  );
  return x.kriteria.map((c, i) => ({
    nomor: c.nomor,
    indikator: c.indikator.trim(),
    rincian: bersihkanDaftar(c.rincian),
    bobot: bobot[i],
  }));
}

/**
 * Mengembalikan sentinel "kosong" menjadi null.
 *
 * Skema keluaran sengaja tidak memuat null — lihat skema-draf.ts — sehingga
 * "tidak ada" datang sebagai string kosong. Kata "null", "-", dan "tidak ada"
 * ikut disaring: model sesekali menuliskannya alih-alih mengosongkan, dan
 * kalimat itu akan tercetak apa adanya di dokumen dosen bila dibiarkan.
 */
function teksAtauNull(nilai: string): string | null {
  const bersih = nilai.trim();
  if (!bersih || /^(null|-|–|—|n\/a|tidak ada)$/i.test(bersih)) return null;
  return bersih;
}

/** Membuang butir kosong dari daftar teks, dengan alasan yang sama. */
function bersihkanDaftar(daftar: string[]): string[] {
  return daftar.map((t) => t.trim()).filter((t) => teksAtauNull(t) !== null);
}
