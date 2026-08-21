import {
  bandingkanLevel,
  deteksiKko,
  deteksiKkoTidakTerukur,
  hitungKkoBerbeda,
  infoLevel,
} from "./bloom";
import type {
  CpmkInput,
  KurikulumInput,
  MataKuliahInput,
  SubCpmkInput,
  TemuanKurikulum,
} from "./tipe";

/**
 * Validator kurikulum.
 * Acuan: docs/00 §3.3 (aturan bobot & penilaian) dan docs/02 §2 (temuan TI214).
 *
 * Aturan pemblokir memastikan rantai CPL -> CPMK -> Sub-CPMK utuh. Temuan B3
 * pada RPKPS TI214 — CPL06 dibebankan tetapi tidak pernah dinilai — persis
 * kelas kesalahan yang dicegah di sini, satu lapis lebih awal.
 */

export function validasiSubCpmk(
  sub: SubCpmkInput,
  cpmk: CpmkInput,
  mk: MataKuliahInput,
): TemuanKurikulum[] {
  const temuan: TemuanKurikulum[] = [];
  const lokasi = { mk: mk.kode, cpmk: cpmk.kode, subCpmk: sub.kode };

  if (sub.rumusan.trim().length < 15) {
    temuan.push({
      kode: "K-SUB-PENDEK",
      tingkat: "PEMBLOKIR",
      pesan: `Rumusan ${sub.kode} terlalu pendek untuk dapat dinilai.`,
      lokasi,
    });
    return temuan;
  }

  const tidakTerukur = deteksiKkoTidakTerukur(sub.rumusan);
  if (tidakTerukur.length > 0) {
    temuan.push({
      kode: "K-SUB-TIDAK-TERUKUR",
      tingkat: "PERINGATAN",
      pesan: `${sub.kode} memakai kata "${tidakTerukur.join('", "')}" yang tidak dapat diamati.`,
      lokasi,
      saran:
        "Ganti dengan kata kerja operasional yang menghasilkan bukti terukur, " +
        'mis. "menjelaskan" (C2) atau "menerapkan" (C3).',
    });
  }

  const terdeteksi = deteksiKko(sub.rumusan);
  if (!terdeteksi && tidakTerukur.length === 0) {
    temuan.push({
      kode: "K-SUB-TANPA-KKO",
      tingkat: "PERINGATAN",
      pesan: `Tidak ditemukan kata kerja operasional yang dikenali pada ${sub.kode}.`,
      lokasi,
    });
  }

  const semuaKko = hitungKkoBerbeda(sub.rumusan);
  if (semuaKko.length > 1) {
    temuan.push({
      kode: "K-SUB-KKO-GANDA",
      tingkat: "PERINGATAN",
      pesan: `${sub.kode} mengandung ${semuaKko.length} kata kerja operasional (${semuaKko.join(", ")}).`,
      lokasi,
      saran: "Pecah menjadi beberapa Sub-CPMK agar penilaiannya tidak ambigu.",
    });
  }

  // Level Sub-CPMK tidak boleh melampaui CPMK induknya: capaian tahapan tidak
  // mungkin lebih tinggi daripada capaian yang ditopangnya.
  const levelSub = sub.levelBloom ?? terdeteksi?.level ?? null;
  if (levelSub && cpmk.levelBloom) {
    const selisih = bandingkanLevel(levelSub, cpmk.levelBloom);
    if (selisih !== null && selisih > 0) {
      temuan.push({
        kode: "K-SUB-LEVEL-LEBIH-TINGGI",
        tingkat: "PEMBLOKIR",
        pesan:
          `${sub.kode} berada di level ${levelSub} (${infoLevel(levelSub).nama}), ` +
          `melampaui ${cpmk.kode} di level ${cpmk.levelBloom} (${infoLevel(cpmk.levelBloom).nama}).`,
        lokasi,
        saran: "Turunkan level Sub-CPMK, atau naikkan level CPMK induknya.",
      });
    }
  }

  return temuan;
}

export function validasiCpmk(
  cpmk: CpmkInput,
  mk: MataKuliahInput,
  kodeCplTersedia: Set<string>,
): TemuanKurikulum[] {
  const temuan: TemuanKurikulum[] = [];
  const lokasi = { mk: mk.kode, cpmk: cpmk.kode };

  if (cpmk.cplKode.length === 0) {
    temuan.push({
      kode: "K-CPMK-TANPA-CPL",
      tingkat: "PEMBLOKIR",
      pesan: `${cpmk.kode} tidak terpetakan ke CPL mana pun.`,
      lokasi,
      saran: "Setiap CPMK harus menjabarkan minimal satu CPL prodi.",
    });
  }

  for (const kode of cpmk.cplKode) {
    if (!kodeCplTersedia.has(kode)) {
      temuan.push({
        kode: "K-CPMK-CPL-TIDAK-ADA",
        tingkat: "PEMBLOKIR",
        pesan: `${cpmk.kode} merujuk ${kode}, yang tidak ada di daftar CPL kurikulum.`,
        lokasi,
      });
    }
    if (!mk.cplKode.includes(kode)) {
      temuan.push({
        kode: "K-CPMK-CPL-DILUAR-MK",
        tingkat: "PEMBLOKIR",
        pesan:
          `${cpmk.kode} menjabarkan ${kode}, tetapi ${kode} tidak dibebankan ` +
          `pada ${mk.kode} di matriks CPL x MK.`,
        lokasi,
        saran: `Tambahkan ${kode} ke matriks, atau lepaskan dari ${cpmk.kode}.`,
      });
    }
  }

  if (cpmk.subCpmk.length === 0) {
    temuan.push({
      kode: "K-CPMK-TANPA-SUB",
      tingkat: "PEMBLOKIR",
      pesan: `${cpmk.kode} belum memiliki Sub-CPMK.`,
      lokasi,
      saran: "Sub-CPMK adalah tahapan belajar mingguan; tanpa itu RPKPS tidak dapat disusun.",
    });
  }

  const kodeSub = cpmk.subCpmk.map((s) => s.kode);
  const ganda = kodeSub.filter((k, i) => kodeSub.indexOf(k) !== i);
  if (ganda.length > 0) {
    temuan.push({
      kode: "K-SUB-KODE-GANDA",
      tingkat: "PEMBLOKIR",
      pesan: `Kode Sub-CPMK berulang pada ${cpmk.kode}: ${[...new Set(ganda)].join(", ")}.`,
      lokasi,
    });
  }

  for (const sub of cpmk.subCpmk) {
    temuan.push(...validasiSubCpmk(sub, cpmk, mk));
  }

  return temuan;
}

export function validasiMataKuliah(
  mk: MataKuliahInput,
  kodeCplTersedia: Set<string>,
): TemuanKurikulum[] {
  const temuan: TemuanKurikulum[] = [];
  const lokasi = { mk: mk.kode };
  const sksTotal = mk.sksTeori + mk.sksPraktik;

  if (sksTotal <= 0) {
    temuan.push({
      kode: "K-MK-SKS-NOL",
      tingkat: "PEMBLOKIR",
      pesan: `${mk.kode} tidak memiliki sks.`,
      lokasi,
    });
  }

  if (mk.semester < 1 || mk.semester > 14) {
    temuan.push({
      kode: "K-MK-SEMESTER",
      tingkat: "PERINGATAN",
      pesan: `Semester ${mk.semester} pada ${mk.kode} di luar rentang wajar.`,
      lokasi,
    });
  }

  if (mk.cplKode.length === 0) {
    temuan.push({
      kode: "K-MK-TANPA-CPL",
      tingkat: "PEMBLOKIR",
      pesan: `${mk.kode} tidak dibebani CPL mana pun.`,
      lokasi,
    });
  }

  if (mk.cpmk.length === 0) {
    temuan.push({
      kode: "K-MK-TANPA-CPMK",
      tingkat: "PEMBLOKIR",
      pesan: `${mk.kode} belum memiliki CPMK.`,
      lokasi,
    });
  }

  // Setiap CPL yang dibebankan harus benar-benar dijabarkan oleh CPMK.
  // Inilah temuan B3 pada TI214, dicegah satu lapis lebih awal.
  const cplTerjabarkan = new Set(mk.cpmk.flatMap((c) => c.cplKode));
  for (const kode of mk.cplKode) {
    if (!cplTerjabarkan.has(kode)) {
      temuan.push({
        kode: "K-MK-CPL-TIDAK-DIJABARKAN",
        tingkat: "PEMBLOKIR",
        pesan:
          `${kode} dibebankan pada ${mk.kode}, tetapi tidak ada satu pun CPMK ` +
          `yang menjabarkannya — CPL ini tidak akan pernah dinilai.`,
        lokasi,
        saran: `Tambahkan CPMK yang menjabarkan ${kode}, atau lepaskan ${kode} dari matriks.`,
      });
    }
  }

  const kodeCpmk = mk.cpmk.map((c) => c.kode);
  const ganda = kodeCpmk.filter((k, i) => kodeCpmk.indexOf(k) !== i);
  if (ganda.length > 0) {
    temuan.push({
      kode: "K-CPMK-KODE-GANDA",
      tingkat: "PEMBLOKIR",
      pesan: `Kode CPMK berulang pada ${mk.kode}: ${[...new Set(ganda)].join(", ")}.`,
      lokasi,
    });
  }

  for (const cpmk of mk.cpmk) {
    temuan.push(...validasiCpmk(cpmk, mk, kodeCplTersedia));
  }

  return temuan;
}

export interface HasilValidasiKurikulum {
  temuan: TemuanKurikulum[];
  pemblokir: TemuanKurikulum[];
  peringatan: TemuanKurikulum[];
  lolos: boolean;
  ringkasan: {
    jumlahCpl: number;
    jumlahMk: number;
    jumlahCpmk: number;
    jumlahSubCpmk: number;
    cplTanpaMk: string[];
  };
}

export function validasiKurikulum(k: KurikulumInput): HasilValidasiKurikulum {
  const temuan: TemuanKurikulum[] = [];
  const kodeCpl = k.cpl.map((c) => c.kode);
  const setCpl = new Set(kodeCpl);

  const cplGanda = kodeCpl.filter((c, i) => kodeCpl.indexOf(c) !== i);
  if (cplGanda.length > 0) {
    temuan.push({
      kode: "K-CPL-KODE-GANDA",
      tingkat: "PEMBLOKIR",
      pesan: `Kode CPL berulang: ${[...new Set(cplGanda)].join(", ")}.`,
    });
  }

  const kodeMk = k.mataKuliah.map((m) => m.kode);
  const mkGanda = kodeMk.filter((m, i) => kodeMk.indexOf(m) !== i);
  if (mkGanda.length > 0) {
    temuan.push({
      kode: "K-MK-KODE-GANDA",
      tingkat: "PEMBLOKIR",
      pesan: `Kode mata kuliah berulang: ${[...new Set(mkGanda)].join(", ")}.`,
    });
  }

  // CPL yang tidak dibebankan pada satu pun mata kuliah tidak akan pernah
  // tercapai oleh mahasiswa mana pun.
  const cplTerpakai = new Set(k.mataKuliah.flatMap((m) => m.cplKode));
  const cplTanpaMk = kodeCpl.filter((c) => !cplTerpakai.has(c));
  for (const kode of cplTanpaMk) {
    temuan.push({
      kode: "K-CPL-TANPA-MK",
      tingkat: "PEMBLOKIR",
      pesan: `${kode} tidak dibebankan pada mata kuliah mana pun.`,
      saran: "Bebankan pada minimal satu mata kuliah, atau hapus dari kurikulum.",
    });
  }

  for (const mk of k.mataKuliah) {
    temuan.push(...validasiMataKuliah(mk, setCpl));
  }

  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");

  return {
    temuan,
    pemblokir,
    peringatan: temuan.filter((t) => t.tingkat === "PERINGATAN"),
    lolos: pemblokir.length === 0,
    ringkasan: {
      jumlahCpl: k.cpl.length,
      jumlahMk: k.mataKuliah.length,
      jumlahCpmk: k.mataKuliah.reduce((s, m) => s + m.cpmk.length, 0),
      jumlahSubCpmk: k.mataKuliah.reduce(
        (s, m) => s + m.cpmk.reduce((t, c) => t + c.subCpmk.length, 0),
        0,
      ),
      cplTanpaMk,
    },
  };
}
