import { bulatkan, formatMenit, susunRencanaSemester } from "./kalkulator";
import type {
  Aktivitas,
  Kebijakan,
  Pagu,
  RencanaSemester,
  SpesifikasiMataKuliah,
  TemuanValidasi,
} from "./tipe";

/**
 * Empat lapis validasi dari docs/03 §4.2.
 *
 *   Lapis 1  Per pertemuan     Sigma aktivitas vs pagu pertemuan   +/-10%  peringatan
 *   Lapis 2  Per semester      Sigma seluruh vs 45 jam x sks       +/-5%   PEMBLOKIR
 *   Lapis 3  Konsistensi       menit narasi metode = kolom alokasi  sama   PEMBLOKIR
 *   Lapis 4  Kapasitas         Sigma TM terjadwal vs slot tersedia   -     peringatan
 *
 * Lapis 2 yang menentukan kepatuhan, dan justru yang selama ini tidak
 * pernah diperiksa siapa pun.
 */

export function totalMenitAktivitas(aktivitas: Aktivitas[]): Pagu {
  const tm = aktivitas.filter((a) => a.kategori === "TM").reduce((s, a) => s + a.menit, 0);
  const pt = aktivitas.filter((a) => a.kategori === "PT").reduce((s, a) => s + a.menit, 0);
  const bm = aktivitas.filter((a) => a.kategori === "BM").reduce((s, a) => s + a.menit, 0);
  return { tm, pt, bm, total: tm + pt + bm, terjadwal: 0, ruangKhusus: 0 };
}

/** Lapis 1 — beban satu pertemuan terhadap pagunya. */
export function validasiPertemuan(
  pagu: Pagu,
  aktivitas: Aktivitas[],
  toleransiPersen: number,
  minggu?: number,
): TemuanValidasi[] {
  const temuan: TemuanValidasi[] = [];
  const terpakai = totalMenitAktivitas(aktivitas);

  if (pagu.total === 0) {
    if (terpakai.total > 0) {
      temuan.push({
        kode: "L1-TANPA-PAGU",
        lapis: 1,
        tingkat: "PERINGATAN",
        minggu,
        pesan: `Ada ${formatMenit(terpakai.total)} aktivitas pada minggu tanpa pagu.`,
        detail: { terpakai: terpakai.total },
      });
    }
    return temuan;
  }

  const selisih = terpakai.total - pagu.total;
  const persen = bulatkan((selisih / pagu.total) * 100, 1);

  if (Math.abs(persen) > toleransiPersen) {
    temuan.push({
      kode: selisih > 0 ? "L1-KELEBIHAN" : "L1-KEKURANGAN",
      lapis: 1,
      tingkat: "PERINGATAN",
      minggu,
      pesan:
        selisih > 0
          ? `Beban melebihi pagu ${Math.abs(persen)}% (${formatMenit(terpakai.total)} dari pagu ${formatMenit(pagu.total)}).`
          : `Beban kurang dari pagu ${Math.abs(persen)}% (${formatMenit(terpakai.total)} dari pagu ${formatMenit(pagu.total)}).`,
      detail: { pagu: pagu.total, terpakai: terpakai.total, persen },
    });
  }

  // Kategori TM terjadwal tidak boleh melebihi pagunya: slot ruang itu nyata,
  // tidak bisa "dipinjam" dari waktu mandiri mahasiswa.
  if (terpakai.tm > pagu.tm) {
    temuan.push({
      kode: "L1-TM-LEBIH",
      lapis: 1,
      tingkat: "PERINGATAN",
      minggu,
      pesan: `Tatap muka ${formatMenit(terpakai.tm)} melampaui pagu TM ${formatMenit(pagu.tm)} — butuh slot jadwal tambahan.`,
      detail: { paguTm: pagu.tm, terpakaiTm: terpakai.tm },
    });
  }

  return temuan;
}

/** Lapis 2 — invarian 45 jam per sks per semester. Ini yang memblokir. */
export function validasiSemester(rencana: RencanaSemester, kebijakan: Kebijakan): TemuanValidasi[] {
  const temuan: TemuanValidasi[] = [];
  const persen = Math.abs(rencana.selisihPersen);

  if (persen > kebijakan.toleransiSemesterPersen) {
    const kelebihan = rencana.selisihMenit > 0;
    temuan.push({
      kode: kelebihan ? "L2-KELEBIHAN" : "L2-KEKURANGAN",
      lapis: 2,
      tingkat: "PEMBLOKIR",
      pesan:
        `Total beban semester ${rencana.jamPerSks} jam/sks, ` +
        `${kelebihan ? "melebihi" : "kurang dari"} target ${kebijakan.jamPerSksPerSemester} jam/sks ` +
        `(toleransi ${kebijakan.toleransiSemesterPersen}%). ` +
        `Selisih ${formatMenit(Math.abs(rencana.selisihMenit))}.`,
      detail: {
        jamPerSks: rencana.jamPerSks,
        target: kebijakan.jamPerSksPerSemester,
        selisihMenit: rencana.selisihMenit,
        selisihPersen: rencana.selisihPersen,
      },
    });
  }

  // Kasus khas docs/03 §2.1: minggu ujian tidak dihitung sebagai beban belajar,
  // sehingga semester selalu kekurangan sekitar 12%.
  if (!kebijakan.hitungMingguUjian) {
    const jumlahUjian = rencana.minggu.filter((m) => m.jenis === "UJIAN").length;
    if (jumlahUjian > 0) {
      temuan.push({
        kode: "L2-UJIAN-TANPA-BEBAN",
        lapis: 2,
        tingkat: "PEMBLOKIR",
        pesan:
          `${jumlahUjian} minggu ujian tidak dihitung sebagai beban belajar. ` +
          `Padahal mahasiswa yang menyiapkan ujian memang sedang belajar — ` +
          `tanpa itu invarian 45 jam/sks tidak akan pernah tercapai.`,
        detail: { jumlahMingguUjian: jumlahUjian },
      });
    }
  }

  return temuan;
}

/**
 * Lapis 3 — angka menit yang disebut di narasi metode harus sama dengan
 * kolom alokasi waktu. Lahir dari temuan B4 pada RPKPS TI214: satu baris
 * menyebut 480 menit di narasi dan 580 menit di kolom alokasi.
 */
export function validasiKonsistensiNarasi(
  menitNarasi: number,
  menitKolom: number,
  minggu?: number,
): TemuanValidasi[] {
  if (menitNarasi === menitKolom) return [];
  return [
    {
      kode: "L3-NARASI-BEDA",
      lapis: 3,
      tingkat: "PEMBLOKIR",
      minggu,
      pesan:
        `Narasi metode menyebut ${formatMenit(menitNarasi)}, ` +
        `sedangkan kolom alokasi waktu ${formatMenit(menitKolom)}. Keduanya harus sama.`,
      detail: { menitNarasi, menitKolom, selisih: menitKolom - menitNarasi },
    },
  ];
}

/** Lapis 4 — kebutuhan slot terjadwal terhadap kapasitas. */
export function validasiKapasitasTerjadwal(
  rencana: RencanaSemester,
  slotTersediaMenitPerMinggu?: number,
): TemuanValidasi[] {
  if (slotTersediaMenitPerMinggu === undefined) return [];
  const temuan: TemuanValidasi[] = [];
  for (const m of rencana.minggu) {
    if (m.pagu.terjadwal > slotTersediaMenitPerMinggu) {
      temuan.push({
        kode: "L4-SLOT-KURANG",
        lapis: 4,
        tingkat: "PERINGATAN",
        minggu: m.minggu,
        pesan:
          `Minggu ${m.minggu} butuh ${formatMenit(m.pagu.terjadwal)} slot terjadwal, ` +
          `tersedia ${formatMenit(slotTersediaMenitPerMinggu)}.`,
        detail: { butuh: m.pagu.terjadwal, tersedia: slotTersediaMenitPerMinggu },
      });
    }
  }
  return temuan;
}

export interface HasilPemeriksaan {
  rencana: RencanaSemester;
  temuan: TemuanValidasi[];
  pemblokir: TemuanValidasi[];
  peringatan: TemuanValidasi[];
  lolos: boolean;
}

/** Pemeriksaan tingkat mata kuliah: lapis 2 (+ lapis 4 bila kapasitas diketahui). */
export function periksaMataKuliah(
  kebijakan: Kebijakan,
  mk: SpesifikasiMataKuliah,
  opsi?: { slotTersediaMenitPerMinggu?: number },
): HasilPemeriksaan {
  const rencana = susunRencanaSemester(kebijakan, mk);
  const temuan = [
    ...validasiSemester(rencana, kebijakan),
    ...validasiKapasitasTerjadwal(rencana, opsi?.slotTersediaMenitPerMinggu),
  ];
  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");
  return {
    rencana,
    temuan,
    pemblokir,
    peringatan: temuan.filter((t) => t.tingkat === "PERINGATAN"),
    lolos: pemblokir.length === 0,
  };
}

/** Beban satu paket semester bagi mahasiswa — docs/03 §4.4. */
export function bebanMahasiswa(
  kebijakan: Kebijakan,
  sksDiambil: number,
): { jamSemester: number; jamPerMinggu: number; setaraKerjaPenuh: number } {
  const jamSemester = kebijakan.jamPerSksPerSemester * sksDiambil;
  const jamPerMinggu = jamSemester / kebijakan.mingguPerSemester;
  return {
    jamSemester: bulatkan(jamSemester, 1),
    jamPerMinggu: bulatkan(jamPerMinggu, 1),
    // Pembanding: pekerjaan penuh waktu 40 jam/minggu.
    setaraKerjaPenuh: bulatkan(jamPerMinggu / 40, 2),
  };
}
