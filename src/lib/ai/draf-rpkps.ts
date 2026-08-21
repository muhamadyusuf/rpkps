import "server-only";
import type { DrafRpkps } from "@/domain/rpkps/draf";
import { jalankanTugasAi } from "./gerbang";
import { SkemaKeluaranDraf } from "./skema-draf";

/**
 * Tugas AI: menyusun draf isi RPKPS secara utuh.
 *
 * Mencakup T4–T8 (materi, metode, aktivitas, lembar tugas) dan T9–T11 (rubrik,
 * kisi-kisi) pada docs/01 §3, dijalankan sekali untuk satu dokumen penuh.
 *
 * Dosen menyetujui seluruh dokumen dengan satu tombol, jadi prompt ini TIDAK
 * boleh menjadi satu-satunya penjaga aturan yang bisa dihitung. Setiap angka
 * yang disebut di sini diperiksa ulang oleh periksaDraf() di domain sebelum
 * apa pun ditulis.
 *
 * Skema keluarannya ada di skema-draf.ts, beserta alasan mengapa ia tidak
 * boleh memuat null — batas ukuran grammar structured output.
 */

/** Blok STABIL yang di-cache penyedia — jangan sisipkan apa pun yang berubah. */
const PANDUAN = `Anda menyusun draf Rencana Program dan Kegiatan Pembelajaran
Semester (RPKPS) berbasis Outcome-Based Education untuk satu mata kuliah.
Anda menghasilkan DRAF; dosen pengampu yang menyetujui dan bertanggung jawab
atas dokumen akhirnya.

# Yang sudah ditetapkan dan TIDAK boleh Anda ubah

Kerangka RPKPS sudah ada sebelum Anda dipanggil:
- Nomor minggu, mana yang pertemuan efektif dan mana minggu ujian.
- Alokasi menit tatap muka, penugasan terstruktur, dan belajar mandiri tiap
  minggu. Sudah dihitung dari kebijakan beban belajar institusi dan pas dengan
  invarian 45 jam per sks per semester. JANGAN mengusulkan menit apa pun.
- Sub-CPMK yang dijadwalkan pada tiap minggu, berasal dari buku kurikulum.
- Daftar komponen nilai beserta bobotnya.
- Daftar pustaka.

Isi HANYA minggu yang ditandai EFEKTIF. Minggu ujian tidak diisi.

# Cara mengosongkan sebuah isian

Skema keluaran tidak mengenal null. Isian teks yang tidak berlaku diisi string
KOSONG (""), dan durasi_menit yang belum ditetapkan diisi 0. Jangan menuliskan
kata "null", "-", "tidak ada", atau tanda apa pun sebagai pengganti isi.

# Yang Anda susun

Pertama, tiga bagian tingkat dokumen:
- deskripsi: deskripsi mata kuliah untuk bagian A template, 3–6 kalimat. Sebut
  posisi mata kuliah dalam kurikulum, cakupan materinya, dan kaitannya dengan
  CPL yang dibebankan.
- kalimat_pembuka_cpmk: satu kalimat sebelum daftar CPMK, mis. "Setelah
  menyelesaikan mata kuliah ini, mahasiswa mampu…".
- komponen_nilai: komponen penilaian beserta bobotnya, disesuaikan dengan cara
  mata kuliah ini dinilai. Totalnya harus TEPAT 100.
- pustaka_baru: pustaka yang perlu DITAMBAHKAN. Lihat aturan 12. Isi url dengan
  "" bila pustaka itu tidak punya alamat daring.

Lalu untuk tiap pertemuan efektif:
- topik: satu frasa, pokok bahasan minggu itu.
- subtopik: 2–5 butir sub-pokok bahasan.
- metode_narasi: metode pembelajaran yang dipakai, mis. "Kuliah interaktif,
  diskusi kelompok kecil, dan latihan terbimbing". Pilih metode yang sesuai
  level Bloom Sub-CPMK minggu itu — level tinggi menuntut metode aktif, bukan
  ceramah satu arah.
- aktivitas_dosen dan aktivitas_mahasiswa: apa yang masing-masing lakukan.
- tugas_terstruktur: pekerjaan di luar kelas, atau "" bila tidak ada.
- penilaian_jenis dan penilaian_sistem: bentuk penilaian minggu itu dan cara
  penyekorannya, keduanya "" bila minggu itu tidak dinilai.
- bobot: persentase terhadap nilai akhir. Nol untuk minggu yang tidak dinilai.
- indikator: indikator pencapaian yang dapat diamati. Wajib ada bila bobot > 0.
- pustaka_ref: rujukan pustaka yang dipakai minggu itu, disalin PERSIS dari
  kolom "ref" pada daftar pustaka di konteks, mis. "UTAMA-1" atau "PENDUKUNG-2".

Lalu lembar rencana tugas dan kisi-kisi UTS/UAS.

Jenis tugas HANYA "INDIVIDU" atau "KELOMPOK" — tidak ada nilai lain. Bila tugas
berupa proyek, studi kasus, atau praktikum, pilih salah satu dari dua nilai itu
sesuai cara pengerjaannya, lalu jelaskan bentuknya pada deskripsi.

# Aturan aritmetika — diperiksa ulang oleh sistem

1. Jumlah seluruh bobot pertemuan harus TEPAT 100, dan harus sama dengan total
   bobot komponen_nilai yang Anda susun sendiri — yang juga harus TEPAT 100.
2. Bobot kriteria di dalam satu tugas harus berjumlah TEPAT 100.
3. Skor seluruh butir dalam satu kisi-kisi harus berjumlah TEPAT 100.
4. Bobot tiap tugas harus muat di dalam komponen nilai yang menampungnya, dan
   nama komponen yang Anda sebut harus persis seperti pada komponen_nilai
   yang Anda susun.

Draf yang melanggar salah satu aturan ini akan ditolak seluruhnya. Hitung dan
periksa jumlahnya sebelum menjawab.

# Aturan isi

5. pustaka_ref HANYA boleh memuat "ref" dari daftar pustaka pada konteks ATAU
   dari pustaka_baru yang Anda usulkan sendiri. Jangan merujuk apa pun di luar
   kedua daftar itu.
12. pustaka_baru: usulkan pustaka yang benar-benar Anda yakini ada. Tulis dalam
   gaya sitasi lengkap: penulis, tahun, judul, penerbit atau URL. JANGAN
   mengarang ISBN dan JANGAN mengarang nomor halaman. Bila tidak yakin sebuah
   buku benar ada, lebih baik tidak menyebutkannya sama sekali.
   Pustaka yang SUDAH ada pada konteks tidak perlu Anda ulang — ia dipertahankan
   otomatis. Nomor untuk pustaka baru dimulai dari "nomorBerikutnya" pada
   konteks, naik satu per satu untuk tiap jenis.
6. Kode Sub-CPMK yang Anda sebut pada tugas dan kisi-kisi harus berasal dari
   daftar Sub-CPMK di konteks. Jangan mengarang kode.
7. Kisi-kisi UTS hanya menguji Sub-CPMK yang dijadwalkan SEBELUM minggu UTS;
   UAS menguji yang setelahnya. Seluruh Sub-CPMK harus teruji di salah satunya.
8. level_bloom tiap butir ujian tidak boleh melampaui level Sub-CPMK yang diuji.
9. Tulis dalam bahasa Indonesia akademik. Rumusan indikator memakai kata kerja
   operasional yang menghasilkan bukti terukur.
10. Jangan menyebut nomor peraturan, standar, atau regulasi yang tidak ada di
    konteks.
11. Sesuaikan isi dengan substansi mata kuliahnya. Jangan menghasilkan kalimat
    generik yang sama untuk semua minggu — tiap minggu punya topik sendiri.`;

export interface HasilDraf {
  draf: DrafRpkps;
  penyedia: string;
  model: string;
}

export async function susunDraf(opsi: {
  penggunaId: string;
  rpkpsId: string;
  konteks: unknown;
}): Promise<HasilDraf> {
  const hasil = await jalankanTugasAi({
    kodeTugas: "DRAF_RPKPS",
    penggunaId: opsi.penggunaId,
    entitasId: opsi.rpkpsId,
    panduan: PANDUAN,
    permintaan:
      "Susun draf RPKPS untuk mata kuliah berikut.\n\n<rpkps>\n" +
      JSON.stringify(opsi.konteks, null, 2) +
      "\n</rpkps>",
    skema: SkemaKeluaranDraf,
    // Satu dokumen penuh: 14 pertemuan, lembar tugas, dan dua kisi-kisi.
    maxTokens: 32000,
  });

  const d = hasil.data;
  return {
    penyedia: hasil.penyedia,
    model: hasil.model,
    draf: {
      deskripsi: d.deskripsi.trim(),
      kalimatPembukaCpmk: d.kalimat_pembuka_cpmk.trim(),
      komponenNilai: d.komponen_nilai.map((k) => ({ nama: k.nama.trim(), bobot: k.bobot })),
      pustakaBaru: d.pustaka_baru.map((b) => ({
        jenis: b.jenis,
        nomor: b.nomor,
        teks: b.teks.trim(),
        url: teksAtauNull(b.url),
      })),
      pertemuan: d.pertemuan.map((p) => ({
        minggu: p.minggu,
        topik: p.topik.trim(),
        subtopik: bersihkanDaftar(p.subtopik),
        metodeNarasi: p.metode_narasi.trim(),
        aktivitasDosen: p.aktivitas_dosen.trim(),
        aktivitasMahasiswa: p.aktivitas_mahasiswa.trim(),
        tugasTerstruktur: teksAtauNull(p.tugas_terstruktur),
        penilaianJenis: teksAtauNull(p.penilaian_jenis),
        penilaianSistem: teksAtauNull(p.penilaian_sistem),
        bobot: p.bobot,
        indikator: bersihkanDaftar(p.indikator),
        pustakaRef: p.pustaka_ref.map((r) => r.trim().toUpperCase()),
      })),
      tugas: d.tugas.map((t) => ({
        nomor: t.nomor,
        nama: t.nama.trim(),
        jenis: t.jenis,
        mingguMulai: t.minggu_mulai,
        mingguSelesai: t.minggu_selesai,
        bobot: t.bobot,
        komponenNilai: teksAtauNull(t.komponen_nilai),
        deskripsi: t.deskripsi.trim(),
        uraianTugas: teksAtauNull(t.uraian_tugas),
        formatLuaran: teksAtauNull(t.format_luaran),
        subCpmkKode: t.sub_cpmk_kode.map((k) => k.trim().toUpperCase()),
        kriteria: t.kriteria.map((k) => ({
          nomor: k.nomor,
          indikator: k.indikator.trim(),
          rincian: bersihkanDaftar(k.rincian),
          bobot: k.bobot,
        })),
      })),
      kisiKisi: d.kisi_kisi.map((k) => ({
        jenis: k.jenis,
        durasiMenit: k.durasi_menit > 0 ? k.durasi_menit : null,
        butir: k.butir.map((b) => ({
          nomor: b.nomor,
          subCpmkKode: b.sub_cpmk_kode.trim().toUpperCase(),
          levelBloom: b.level_bloom,
          bentuk: b.bentuk,
          jumlahButir: b.jumlah_butir,
          skor: b.skor,
          indikator: teksAtauNull(b.indikator),
        })),
      })),
    },
  };
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
