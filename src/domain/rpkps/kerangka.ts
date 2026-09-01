import type {
  Kebijakan,
  KategoriWaktu,
  RencanaSemester,
} from "@/domain/beban-belajar/tipe";

/**
 * Perancang kerangka tabel mingguan — 16 baris bernomor, minggu ujian di
 * posisinya, alokasi waktu sesuai pagu, Sub-CPMK tersebar berurutan.
 *
 * Inilah yang menghilangkan "halaman kosong", hambatan terbesar dosen: ia
 * mulai dari kerangka yang sudah konsisten, bukan dari tabel kosong.
 *
 * Dipisahkan dari `buatRpkps` karena dipakai DUA kali: saat RPKPS dibuat, dan
 * saat dosen menyusun ulang kerangkanya setelah menyunting struktur secara
 * manual (docs/09 §K7). Salinan kedua akan berarti dua kerangka yang perlahan
 * berbeda — dan yang membedakannya adalah nomor minggu ujian.
 */

export type AktivitasKerangka = {
  nama: string;
  kategori: KategoriWaktu;
  menit: number;
  urutan: number;
};

export type BarisKerangka = {
  minggu: number;
  jenis: "EFEKTIF" | "UTS" | "UAS";
  topik: string | null;
  aktivitas: AktivitasKerangka[];
  /** Sub-CPMK yang dijadwalkan pada pertemuan ini, bila masih tersisa. */
  subCpmkId: string | null;
};

export function rancangKerangkaMingguan(
  rencana: RencanaSemester,
  kebijakan: Kebijakan,
  subCpmkId: readonly string[],
): BarisKerangka[] {
  const mingguEfektif = rencana.minggu.filter((m) => m.jenis === "EFEKTIF");

  return rencana.minggu.map((m) => {
    const ujian = m.jenis === "UJIAN";
    // UTS bila masih di paruh pertama semester, selebihnya UAS.
    const uts = m.minggu < kebijakan.mingguPerSemester;
    const indeks = mingguEfektif.findIndex((x) => x.minggu === m.minggu);

    const aktivitas: AktivitasKerangka[] = [];
    if (m.pagu.tm > 0) {
      aktivitas.push({
        nama: ujian ? "Pelaksanaan ujian" : "Tatap muka",
        kategori: "TM",
        menit: m.pagu.tm,
        urutan: 0,
      });
    }
    if (m.pagu.pt > 0) {
      aktivitas.push({
        nama: "Penugasan terstruktur",
        kategori: "PT",
        menit: m.pagu.pt,
        urutan: 1,
      });
    }
    if (m.pagu.bm > 0) {
      aktivitas.push({
        nama: ujian ? "Persiapan ujian" : "Belajar mandiri",
        kategori: "BM",
        menit: m.pagu.bm,
        urutan: 2,
      });
    }

    return {
      minggu: m.minggu,
      jenis: ujian ? (uts ? "UTS" : "UAS") : "EFEKTIF",
      topik: ujian
        ? uts
          ? "Ujian Tengah Semester"
          : "Ujian Akhir Semester"
        : null,
      aktivitas,
      // Sub-CPMK dibagikan berurutan, satu per pertemuan efektif.
      subCpmkId: !ujian && indeks >= 0 ? (subCpmkId[indeks] ?? null) : null,
    };
  });
}
