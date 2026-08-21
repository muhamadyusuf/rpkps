import type {
  BentukKebijakan,
  BentukPembelajaran,
  Kebijakan,
  Pagu,
  RencanaMinggu,
  RencanaSemester,
  SpesifikasiMataKuliah,
} from "./tipe";

const PAGU_NOL: Pagu = { tm: 0, pt: 0, bm: 0, total: 0, terjadwal: 0, ruangKhusus: 0 };

export function cariBentuk(
  kebijakan: Kebijakan,
  bentuk: BentukPembelajaran,
): BentukKebijakan {
  const hasil = kebijakan.bentuk.find((b) => b.bentuk === bentuk);
  if (!hasil) {
    throw new Error(
      `Bentuk pembelajaran "${bentuk}" belum diatur pada kebijakan beban belajar.`,
    );
  }
  return hasil;
}

function jumlahkanPagu(...daftar: Pagu[]): Pagu {
  return daftar.reduce<Pagu>(
    (a, b) => ({
      tm: a.tm + b.tm,
      pt: a.pt + b.pt,
      bm: a.bm + b.bm,
      total: a.total + b.total,
      terjadwal: a.terjadwal + b.terjadwal,
      ruangKhusus: a.ruangKhusus + b.ruangKhusus,
    }),
    PAGU_NOL,
  );
}

/** Pagu satu komponen (teori atau praktik) untuk sejumlah sks. */
export function paguKomponen(
  bentuk: BentukKebijakan,
  sks: number,
): Pagu {
  if (sks <= 0) return { ...PAGU_NOL };
  const tm = bentuk.tm * sks;
  const pt = bentuk.pt * sks;
  const bm = bentuk.bm * sks;
  return {
    tm,
    pt,
    bm,
    total: tm + pt + bm,
    terjadwal: bentuk.tmTerjadwal ? tm : 0,
    ruangKhusus: bentuk.butuhRuangKhusus ? tm : 0,
  };
}

/**
 * Pagu satu minggu efektif penuh (komponen teori dan praktik keduanya jalan).
 *   pagu = sksTeori x (tm+pt+bm)[bentukTeori] + sksPraktik x (tm+pt+bm)[bentukPraktik]
 * Acuan: docs/03 §4.1.
 */
export function paguPertemuanEfektif(
  kebijakan: Kebijakan,
  mk: SpesifikasiMataKuliah,
): Pagu {
  return jumlahkanPagu(
    paguKomponen(cariBentuk(kebijakan, mk.bentukTeori), mk.sksTeori),
    paguKomponen(cariBentuk(kebijakan, mk.bentukPraktik), mk.sksPraktik),
  );
}

/**
 * Posisi minggu ujian. Pola lazim: UTS di tengah, UAS di minggu terakhir.
 * Jumlahnya diturunkan dari selisih minggu semester dan pertemuan efektif —
 * bukan angka terpisah — supaya keduanya tidak bisa saling bertentangan.
 */
export function posisiMingguUjian(kebijakan: Kebijakan): number[] {
  const jumlah = Math.max(
    0,
    kebijakan.mingguPerSemester - kebijakan.pertemuanEfektifTeori,
  );
  if (jumlah === 0) return [];
  if (jumlah === 1) return [kebijakan.mingguPerSemester];
  if (jumlah === 2) {
    return [
      Math.ceil(kebijakan.mingguPerSemester / 2),
      kebijakan.mingguPerSemester,
    ];
  }
  // Lebih dari dua: tempatkan di minggu-minggu terakhir.
  return Array.from(
    { length: jumlah },
    (_, i) => kebijakan.mingguPerSemester - jumlah + 1 + i,
  );
}

export function targetMenitSemester(
  kebijakan: Kebijakan,
  sksTotal: number,
): number {
  return kebijakan.jamPerSksPerSemester * 60 * sksTotal;
}

/**
 * Menyusun rencana beban seluruh semester.
 *
 * Pagu minggu ujian TIDAK ditetapkan sebagai angka tetap, melainkan diambil
 * dari SISA target invarian setelah minggu efektif dihitung. Dengan begitu
 * total semester selalu mendarat tepat di 45 jam/sks tanpa penyesuaian manual
 * (docs/03 §4.1), dan pembulatan tidak pernah menumpuk.
 */
export function susunRencanaSemester(
  kebijakan: Kebijakan,
  mk: SpesifikasiMataKuliah,
): RencanaSemester {
  const sksTotal = mk.sksTeori + mk.sksPraktik;
  if (sksTotal <= 0) {
    throw new Error("Jumlah sks mata kuliah harus lebih dari nol.");
  }

  const bentukTeori = cariBentuk(kebijakan, mk.bentukTeori);
  const bentukPraktik = cariBentuk(kebijakan, mk.bentukPraktik);
  // Minggu ujian tetap ada apa pun nilai hitungMingguUjian; flag itu hanya
  // menentukan apakah minggu tersebut MENDAPAT pagu (docs/03 §2.1).
  const mingguUjian = new Set(posisiMingguUjian(kebijakan));

  const nomorEfektif: number[] = [];
  for (let m = 1; m <= kebijakan.mingguPerSemester; m += 1) {
    if (!mingguUjian.has(m)) nomorEfektif.push(m);
  }

  // Praktikum boleh berjalan lebih sedikit pertemuan daripada teori
  // (docs/03 §2.3). Diambil dari minggu efektif paling awal.
  const batasPraktik = Math.min(
    kebijakan.pertemuanEfektifPraktik,
    nomorEfektif.length,
  );
  const mingguBerpraktik = new Set(nomorEfektif.slice(0, batasPraktik));

  const batasTeori = Math.min(
    kebijakan.pertemuanEfektifTeori,
    nomorEfektif.length,
  );
  const mingguBerteori = new Set(nomorEfektif.slice(0, batasTeori));

  const mingguEfektif: RencanaMinggu[] = nomorEfektif.map((m) => {
    const adaTeori = mingguBerteori.has(m) && mk.sksTeori > 0;
    const adaPraktik = mingguBerpraktik.has(m) && mk.sksPraktik > 0;
    const pagu = jumlahkanPagu(
      adaTeori ? paguKomponen(bentukTeori, mk.sksTeori) : PAGU_NOL,
      adaPraktik ? paguKomponen(bentukPraktik, mk.sksPraktik) : PAGU_NOL,
    );
    return { minggu: m, jenis: "EFEKTIF" as const, adaTeori, adaPraktik, pagu };
  });

  const totalEfektif = mingguEfektif.reduce((s, m) => s + m.pagu.total, 0);
  const target = targetMenitSemester(kebijakan, sksTotal);

  const nomorUjian = [...mingguUjian].sort((a, b) => a - b);
  const mingguUjianRencana: RencanaMinggu[] = [];

  if (nomorUjian.length > 0) {
    const sisa = kebijakan.hitungMingguUjian
      ? Math.max(0, target - totalEfektif)
      : 0;
    const dasar = Math.floor(sisa / nomorUjian.length);
    // Sisa pembagian ditaruh di minggu ujian terakhir agar total tetap eksak.
    const koreksi = sisa - dasar * nomorUjian.length;

    nomorUjian.forEach((m, i) => {
      const alokasi = dasar + (i === nomorUjian.length - 1 ? koreksi : 0);
      const tm = Math.min(kebijakan.menitTmPerUjian, alokasi);
      const bm = alokasi - tm;
      mingguUjianRencana.push({
        minggu: m,
        jenis: "UJIAN",
        adaTeori: false,
        adaPraktik: false,
        pagu: {
          tm,
          pt: 0,
          bm,
          total: alokasi,
          terjadwal: tm,
          ruangKhusus: 0,
        },
      });
    });
  }

  const minggu = [...mingguEfektif, ...mingguUjianRencana].sort(
    (a, b) => a.minggu - b.minggu,
  );
  const totalMenit = minggu.reduce((s, m) => s + m.pagu.total, 0);
  const selisihMenit = totalMenit - target;

  return {
    mk,
    sksTotal,
    minggu,
    paguMingguEfektif: paguPertemuanEfektif(kebijakan, mk),
    totalMenit,
    targetMenit: target,
    totalJam: bulatkan(totalMenit / 60, 2),
    jamPerSks: bulatkan(totalMenit / 60 / sksTotal, 2),
    selisihMenit,
    selisihPersen: target === 0 ? 0 : bulatkan((selisihMenit / target) * 100, 2),
  };
}

export function bulatkan(nilai: number, desimal = 2): number {
  const f = 10 ** desimal;
  return Math.round(nilai * f) / f;
}

/** "8 jam 30 menit" — untuk tampilan. */
export function formatMenit(menit: number): string {
  const negatif = menit < 0;
  const abs = Math.abs(Math.round(menit));
  const jam = Math.floor(abs / 60);
  const sisa = abs % 60;
  const teks =
    jam === 0 ? `${sisa} menit` : sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
  return negatif ? `-${teks}` : teks;
}
