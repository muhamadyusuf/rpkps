/**
 * Gerbang penyuntingan langsung lapisan kurikulum: kapan sebuah CPL, mata
 * kuliah, CPMK, atau Sub-CPMK boleh diubah dan dihapus dari halaman kurikulum.
 * Acuan: docs/15 §2.
 *
 * Murni dan tanpa Prisma — sama seperti `periksaKelayakanHapus` pada
 * `src/domain/rpkps/daur-hidup.ts`, yang bentuk hasilnya ditiru di sini.
 *
 * Yang dipertaruhkan ada dua, dan keduanya gagal secara SENYAP:
 *
 * 1. **Sidik dokumen.** Kode, nama, sks, dan seluruh rumusan CPL/CPMK/Sub-CPMK
 *    ikut `proyeksiIsi()` (`src/domain/rpkps/proyeksi.ts`). Menyunting satu
 *    huruf menggeser sidik SHA-256 SELURUH RPKPS terbit pada mata kuliah itu,
 *    dan `periksaSidikCap` mulai menolak persetujuan atas pergeseran yang tidak
 *    dilakukan siapa pun.
 * 2. **Cascade.** `MataKuliah → Rpkps → RpkpsSnapshot` dan `SubCpmk →
 *    PertemuanSubCpmk | TugasSubCpmk | ButirKisiKisi` seluruhnya
 *    `onDelete: Cascade`. Satu `delete()` yang lolos melenyapkan baris RPKPS
 *    berjalan, salinan beku, kelas, dan nilai tanpa satu pesan pun.
 *
 * Karena itu gerbangnya DUA lapis, dan keduanya wajib lolos:
 *
 *   G1  `bolehSuntingKurikulum`   — status kurikulum
 *   G2  `periksaKelayakan…`       — akibat nyata baris yang disentuh
 *
 * G2 tidak dapat digantikan G1. `ubahStatusKurikulum` mengizinkan
 * `ARSIP → DRAF`, sehingga kurikulum yang pernah menggantung puluhan RPKPS
 * terbit dapat kembali berstatus `DRAF` — statusnya berbohong tentang apa yang
 * bergantung padanya (docs/15 §2.2).
 */

export type StatusKurikulumRingkas = "DRAF" | "BERLAKU" | "ARSIP";

/**
 * Hasil sebuah gerbang. Bentuknya sengaja sama dengan `Kelayakan` pada
 * daur-hidup RPKPS: alasan dikembalikan SELURUHNYA, bukan yang pertama saja,
 * supaya yang membacanya tahu semua yang menghalangi dalam satu kali baca.
 */
export type Kelayakan = {
  boleh: boolean;
  alasan: string[];
};

const LOLOS: Kelayakan = { boleh: true, alasan: [] };

function tolak(...alasan: string[]): Kelayakan {
  return { boleh: false, alasan };
}

/* ------------------------------------------------------------------ */
/* G1 — status kurikulum                                              */
/* ------------------------------------------------------------------ */

/**
 * Lapis pertama: kurikulum ini boleh disunting langsung?
 *
 * Hanya `DRAF`. `BERLAKU` diarahkan ke Usulan Revisi Kurikulum — itulah satu-
 * satunya pintu resmi mengubah kurikulum hidup (docs/04), dan CRUD ini tidak
 * boleh menjadi pintu belakangnya. `ARSIP` beku seluruhnya.
 *
 * Profil lulusan TIDAK memakai gerbang ini: ia di luar `proyeksiIsi()` dan
 * punya aturannya sendiri di `aksi-profil.ts`.
 */
export function bolehSuntingKurikulum(status: StatusKurikulumRingkas): Kelayakan {
  switch (status) {
    case "DRAF":
      return LOLOS;
    case "BERLAKU":
      return tolak(
        "Kurikulum ini sedang berlaku dan menjadi dasar RPKPS yang disusun di " +
          "atasnya. Perubahan CPL, mata kuliah, CPMK, dan Sub-CPMK harus lewat " +
          "Usulan Revisi Kurikulum kepada Ketua Program Studi.",
      );
    case "ARSIP":
      return tolak("Kurikulum yang diarsipkan tidak dapat disunting.");
  }
}

/* ------------------------------------------------------------------ */
/* G2 — akibat nyata                                                  */
/* ------------------------------------------------------------------ */

/** Satu RPKPS yang bergantung pada baris yang hendak disentuh. */
export type RpkpsPenggantung = {
  /** Mis. "TI214 · 2025/2026 Ganjil" — dibaca manusia, bukan id. */
  label: string;
  status: string;
  /** > 0 berarti dokumen pernah disahkan dan sidiknya sudah beredar. */
  jumlahSnapshot: number;
};

function rincianRpkps(daftar: readonly RpkpsPenggantung[]): string {
  return daftar
    .map((r) => {
      const beku =
        r.jumlahSnapshot > 0 ? `, ${r.jumlahSnapshot} salinan beku` : "";
      return `${r.label} (${r.status.toLowerCase()}${beku})`;
    })
    .join("; ");
}

/**
 * Kalimat penolakan yang dipakai bersama tiga gerbang di bawah.
 *
 * Menyebut ANGKA dan NAMA dokumennya, bukan "tidak dapat dihapus": yang
 * membaca pesan ini perlu tahu persis apa yang harus dibereskan lebih dulu.
 */
function alasanRpkps(daftar: readonly RpkpsPenggantung[], perbuatan: string): string {
  const adaBeku = daftar.some((r) => r.jumlahSnapshot > 0);
  return (
    `${daftar.length} RPKPS sudah disusun di atasnya: ${rincianRpkps(daftar)}. ` +
    (adaBeku
      ? `${perbuatan} menggeser sidik SHA-256 yang sudah tercetak pada berkas yang beredar.`
      : `${perbuatan} membatalkan pekerjaan yang sudah berjalan di dokumen itu.`)
  );
}

/* --- Mata kuliah --------------------------------------------------- */

export type SensusMataKuliah = {
  kode: string;
  /** Seluruh RPKPS pada mata kuliah ini, semua tahun akademik. */
  rpkps: readonly RpkpsPenggantung[];
};

/**
 * `MataKuliah` adalah akar cascade terdalam di lapisan kurikulum: ia
 * menjangkau `rpkps → rpkps_snapshot`, `kelas → peserta_kelas → nilai`, dan
 * `evaluasi_mk`. Satu RPKPS saja sudah cukup untuk menolak — tidak ada ambang,
 * tidak ada pengecualian status.
 */
export function periksaKelayakanHapusMk(sensus: SensusMataKuliah): Kelayakan {
  if (sensus.rpkps.length === 0) return LOLOS;
  return tolak(
    `Mata kuliah ${sensus.kode} tidak dapat dihapus. ` +
      alasanRpkps(sensus.rpkps, "Menghapusnya") +
      " Seluruh kelas, peserta, nilai, dan evaluasi di bawahnya ikut lenyap.",
  );
}

/**
 * Menyunting identitas mata kuliah — kode, nama, semester, sks, status.
 *
 * Semuanya ikut `proyeksiIsi()`. Bedanya dengan hapus: yang rusak bukan data,
 * melainkan sidik dokumen yang sudah ditandatangani. Karena itu yang
 * menghalangi hanyalah RPKPS yang sudah PUNYA salinan beku — RPKPS yang masih
 * draf belum menandatangani apa pun.
 */
export function periksaKelayakanUbahMk(sensus: SensusMataKuliah): Kelayakan {
  const bersidik = sensus.rpkps.filter((r) => r.jumlahSnapshot > 0);
  if (bersidik.length === 0) return LOLOS;
  return tolak(
    `Identitas ${sensus.kode} ikut tercetak pada dokumen yang sudah disahkan. ` +
      alasanRpkps(bersidik, "Mengubahnya"),
  );
}

/* --- CPMK ---------------------------------------------------------- */

export type SensusCpmk = {
  kode: string;
  /** Sub-CPMK di bawahnya beserta rujukannya. Ikut lenyap bila CPMK dihapus. */
  subCpmk: readonly SensusSubCpmk[];
  /** RPKPS pada mata kuliah induk. */
  rpkps: readonly RpkpsPenggantung[];
};

/**
 * Menghapus CPMK melenyapkan seluruh Sub-CPMK di bawahnya lewat cascade, dan
 * Sub-CPMK itulah yang dirujuk baris mingguan, lembar tugas, serta kisi-kisi.
 * Jadi kelayakannya adalah kelayakan seluruh anaknya, digabung.
 */
export function periksaKelayakanHapusCpmk(sensus: SensusCpmk): Kelayakan {
  const alasan: string[] = [];

  if (sensus.rpkps.length > 0) {
    alasan.push(
      `CPMK ${sensus.kode} ikut tercetak pada RPKPS mata kuliah ini. ` +
        alasanRpkps(sensus.rpkps, "Menghapusnya"),
    );
  }

  const terpakai = sensus.subCpmk.filter((s) => jumlahRujukan(s) > 0);
  if (terpakai.length > 0) {
    alasan.push(
      `${terpakai.length} Sub-CPMK di bawahnya masih dirujuk dokumen berjalan: ` +
        terpakai.map((s) => `${s.kode} (${rincianRujukan(s)})`).join("; ") +
        ". Capaian dipensiunkan lewat usulan revisi, tidak pernah dihapus.",
    );
  }

  return { boleh: alasan.length === 0, alasan };
}

/* --- Sub-CPMK ------------------------------------------------------ */

/**
 * Rujukan sebuah Sub-CPMK dari dokumen RPKPS. Ketiganya `onDelete: Cascade`:
 * menghapus Sub-CPMK melenyapkan barisnya, bukan menolak penghapusan.
 */
export type SensusSubCpmk = {
  kode: string;
  jumlahPertemuan: number;
  jumlahTugas: number;
  jumlahButirKisiKisi: number;
};

function jumlahRujukan(s: SensusSubCpmk): number {
  return s.jumlahPertemuan + s.jumlahTugas + s.jumlahButirKisiKisi;
}

function rincianRujukan(s: SensusSubCpmk): string {
  const bagian: string[] = [];
  if (s.jumlahPertemuan > 0) bagian.push(`${s.jumlahPertemuan} baris mingguan`);
  if (s.jumlahTugas > 0) bagian.push(`${s.jumlahTugas} lembar tugas`);
  if (s.jumlahButirKisiKisi > 0) {
    bagian.push(`${s.jumlahButirKisiKisi} butir kisi-kisi`);
  }
  return bagian.join(", ");
}

/**
 * Inilah tempat aturan **"Capaian dipensiunkan, tidak pernah dihapus"**
 * ditegakkan kode untuk pertama kalinya, bukan lewat kesepakatan.
 */
export function periksaKelayakanHapusSubCpmk(sensus: SensusSubCpmk): Kelayakan {
  if (jumlahRujukan(sensus) === 0) return LOLOS;
  return tolak(
    `Sub-CPMK ${sensus.kode} masih dirujuk ${rincianRujukan(sensus)} pada RPKPS ` +
      "berjalan. Menghapusnya melenyapkan baris-baris itu tanpa jejak; " +
      "capaian dipensiunkan lewat usulan revisi, tidak pernah dihapus.",
  );
}

/* --- CPL ----------------------------------------------------------- */

export type SensusCpl = {
  kode: string;
  /** RPKPS pada seluruh mata kuliah yang dibebani CPL ini. */
  rpkps: readonly RpkpsPenggantung[];
  /** Banyaknya CPMK yang menjabarkan CPL ini, lintas mata kuliah. */
  jumlahCpmk: number;
};

/**
 * CPL tidak dirujuk baris RPKPS mana pun secara langsung, tetapi kode dan
 * deskripsinya ikut `proyeksiIsi()` lewat matriks CPL×MK. Menghapusnya juga
 * memutus `peta_cpmk_cpl`, sehingga CPMK yang menjabarkannya kehilangan
 * pangkal telusur.
 */
export function periksaKelayakanHapusCpl(sensus: SensusCpl): Kelayakan {
  const alasan: string[] = [];

  if (sensus.rpkps.length > 0) {
    alasan.push(
      `CPL ${sensus.kode} dibebankan pada mata kuliah yang sudah punya RPKPS. ` +
        alasanRpkps(sensus.rpkps, "Menghapusnya"),
    );
  }

  if (sensus.jumlahCpmk > 0) {
    alasan.push(
      `${sensus.jumlahCpmk} CPMK menjabarkan ${sensus.kode}. Lepaskan pemetaannya ` +
        "lebih dulu, agar tidak ada CPMK yang kehilangan pangkal telusurnya.",
    );
  }

  return { boleh: alasan.length === 0, alasan };
}

/* ------------------------------------------------------------------ */
/* Normalisasi kode                                                   */
/* ------------------------------------------------------------------ */

/**
 * Kode capaian dan mata kuliah selalu huruf besar tanpa spasi dalam.
 *
 * Bukan kosmetik: `@@unique([mataKuliahId, kode])` peka huruf besar-kecil, jadi
 * "cpmk081" dan "CPMK081" lolos sebagai dua baris berbeda dan menghasilkan
 * kurikulum yang memuat CPMK sama dua kali. Impor Excel sudah menormalkan lewat
 * `rakitKurikulum`; penyuntingan tangan harus menempuh aturan yang sama.
 */
export function normalkanKode(kode: string): string {
  return kode.trim().toUpperCase().replace(/\s+/g, "");
}

/* ------------------------------------------------------------------ */
/* Urutan                                                             */
/* ------------------------------------------------------------------ */

export type Terurut = { id: string; urutan: number };

/**
 * Menukar posisi satu baris dengan tetangganya, dan mengembalikan urutan BARU
 * bagi seluruh daftar.
 *
 * Menulis ulang semuanya, bukan menukar dua baris saja: `urutan` hasil impor
 * dan hasil penghapusan berulang tidak dijamin rapat (0,1,2,…), dan menukar dua
 * nilai yang kebetulan sama tidak mengubah apa pun. Daftar hasil selalu rapat.
 *
 * Mengembalikan `null` bila pergeseran tidak mungkin — baris teratas digeser
 * naik, terbawah digeser turun, atau id tidak ada di daftar. Pemanggil
 * memperlakukannya sebagai bukan-galat: tombolnya memang seharusnya mati.
 */
export function geserUrutan(
  daftar: readonly Terurut[],
  id: string,
  arah: "naik" | "turun",
): Terurut[] | null {
  const urut = [...daftar].sort((a, b) => a.urutan - b.urutan);
  const dari = urut.findIndex((x) => x.id === id);
  if (dari === -1) return null;

  const ke = arah === "naik" ? dari - 1 : dari + 1;
  if (ke < 0 || ke >= urut.length) return null;

  [urut[dari], urut[ke]] = [urut[ke], urut[dari]];
  return urut.map((x, i) => ({ id: x.id, urutan: i }));
}
