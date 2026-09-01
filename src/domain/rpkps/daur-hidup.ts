/**
 * Aturan daur hidup RPKPS: kapan sebuah dokumen boleh benar-benar DIHAPUS,
 * dan kapan ia hanya boleh DIARSIPKAN. Acuan: docs/06 §2.
 *
 * Murni dan tanpa Prisma — sama seperti `periksaJalurRalat` pada usulan
 * revisi, syaratnya ditegakkan KODE, bukan oleh centang "saya paham risikonya"
 * di antarmuka.
 *
 * Yang dipertaruhkan: `Rpkps` adalah akar cascade yang menjangkau
 * `rpkps_snapshot` (salinan beku + sidik SHA-256 yang sudah tercetak di berkas
 * DOCX dan menjadi halaman katalog publik) serta `kelas → peserta_kelas →
 * nilai` dan `evaluasi_mk` (bukti pelaksanaan yang diminta asesor). Satu
 * `delete()` yang lolos melenyapkan semuanya tanpa jejak dan tanpa pemulihan.
 */

export type StatusRpkpsRingkas =
  | "DRAF"
  | "DIAJUKAN"
  | "DIREVISI"
  | "DISETUJUI"
  | "TERBIT"
  | "ARSIP";

/** Kelas beserta jejak pelaksanaannya. Kelas kosong tidak menghalangi. */
export type KelasSensus = {
  kode: string;
  jumlahPeserta: number;
  jumlahNilai: number;
  adaEvaluasi: boolean;
};

export type SensusRpkps = {
  status: StatusRpkpsRingkas;
  /** Banyaknya salinan beku. > 0 berarti dokumen pernah disahkan. */
  jumlahSnapshot: number;
  kelas: readonly KelasSensus[];
};

export type Kelayakan = {
  boleh: boolean;
  /** Kosong bila boleh. Ditulis untuk dibaca dosen, lengkap dengan angkanya. */
  alasan: string[];
};

const DAPAT_DIHAPUS: readonly StatusRpkpsRingkas[] = ["DRAF", "DIREVISI"];

/**
 * Empat syarat pada docs/06 §2.2. Semuanya harus terpenuhi; alasan penolakan
 * dikembalikan SELURUHNYA, bukan yang pertama saja — dosen berhak tahu semua
 * yang menghalangi dalam satu kali baca.
 */
export function periksaKelayakanHapus(sensus: SensusRpkps): Kelayakan {
  const alasan: string[] = [];

  if (!DAPAT_DIHAPUS.includes(sensus.status)) {
    alasan.push(
      sensus.status === "DIAJUKAN"
        ? "RPKPS sedang diajukan dan menunggu keputusan Kaprodi. Tarik pengajuannya lebih dulu."
        : sensus.status === "DISETUJUI"
          ? "RPKPS sudah ditandatangani Kaprodi dan menunggu pengesahan Penjaminan Mutu. Kembalikan untuk revisi lebih dulu."
          : `RPKPS berstatus ${sensus.status} tidak dapat dihapus, hanya diarsipkan.`,
    );
  }

  if (sensus.jumlahSnapshot > 0) {
    alasan.push(
      `RPKPS ini pernah disahkan dan memiliki ${sensus.jumlahSnapshot} salinan beku. ` +
        "Menghapusnya membatalkan sidik SHA-256 yang sudah tercetak pada berkas yang beredar.",
    );
  }

  const berjejak = kelasBerjejak(sensus.kelas);
  if (berjejak.length > 0) {
    alasan.push(
      `Sudah ada kelas berjalan: ${sebutKelas(berjejak)}. Bukti pelaksanaan tidak boleh lenyap.`,
    );
  }

  return { boleh: alasan.length === 0, alasan };
}

/** Kelas yang sudah meninggalkan jejak pelaksanaan. Kelas kosong tidak masuk. */
function kelasBerjejak(kelas: readonly KelasSensus[]): KelasSensus[] {
  return kelas.filter((k) => k.jumlahPeserta > 0 || k.jumlahNilai > 0 || k.adaEvaluasi);
}

/** "B (31 peserta, 124 nilai, evaluasi capaian); C (12 peserta)" */
function sebutKelas(kelas: readonly KelasSensus[]): string {
  return kelas
    .map((k) => {
      const bagian = [`${k.jumlahPeserta} peserta`];
      if (k.jumlahNilai > 0) bagian.push(`${k.jumlahNilai} nilai`);
      if (k.adaEvaluasi) bagian.push("evaluasi capaian");
      return `${k.kode} (${bagian.join(", ")})`;
    })
    .join("; ");
}

/**
 * Panjang minimal alasan penghapusan paksa.
 *
 * Lebih panjang daripada catatan revisi biasa dengan sengaja: setelah barisnya
 * lenyap, kalimat inilah SATU-SATUNYA keterangan yang tersisa di `log_audit`
 * tentang mengapa sebuah dokumen resmi tidak ada lagi. "salah" tidak menjawab
 * pertanyaan siapa pun setahun kemudian.
 */
export const MIN_ALASAN_HAPUS_PAKSA = 25;

export type AkibatHapus = {
  /** Apa yang akan lenyap — satu kalimat per jenis jejak. Kosong = tanpa akibat. */
  rincian: string[];
  /**
   * Yang lenyap melampaui isi draf: salinan beku yang sidiknya sudah tercetak,
   * atau bukti pelaksanaan yang diminta asesor.
   */
  merusakJejak: boolean;
};

/**
 * Inventaris kerusakan penghapusan PAKSA — jalur administrator pada docs/06
 * §2.6.
 *
 * Kembaran `periksaKelayakanHapus`, dengan satu perbedaan yang menentukan:
 * yang di sana adalah PENGHALANG (dokumen tidak jadi dihapus), yang di sini
 * adalah AKIBAT (dokumen tetap dihapus, dan inilah yang hilang bersamanya).
 * Administrator berhak melewati penghalangnya, tetapi tidak berhak tidak tahu
 * apa yang ia hancurkan — karena itu daftarnya dihitung dari basis data dan
 * ditampilkan di dialog, bukan diringkas menjadi "tindakan ini permanen".
 *
 * Tetap murni: yang memutuskan siapa boleh memanggilnya adalah lapisan aksi
 * (`punyaPeran(sesi, "ADMIN")`), bukan fungsi ini.
 */
export function ringkasAkibatHapus(sensus: SensusRpkps): AkibatHapus {
  const rincian: string[] = [];

  if (sensus.jumlahSnapshot > 0) {
    rincian.push(
      `${sensus.jumlahSnapshot} salinan beku ikut lenyap, beserta sidik SHA-256 yang sudah ` +
        "tercetak pada berkas yang beredar — tidak ada lagi yang dapat dicocokkan dengannya.",
    );
  }

  if (sensus.status === "TERBIT") {
    rincian.push(
      "Halaman katalog publiknya hilang; tautan yang sudah dibagikan berakhir 404. " +
        "Mengarsipkan menariknya dari katalog tanpa akibat ini.",
    );
  }

  if (sensus.status === "DIAJUKAN" || sensus.status === "DISETUJUI") {
    rincian.push(
      "Dokumen sedang berjalan di rantai pengesahan; pengajuannya lenyap dari antrean " +
        "penanda tangan tanpa keputusan.",
    );
  }

  const berjejak = kelasBerjejak(sensus.kelas);
  if (berjejak.length > 0) {
    rincian.push(
      `Bukti pelaksanaan ikut lenyap: ${sebutKelas(berjejak)}. Nilai dan evaluasi ` +
        "ketercapaian tidak dapat dipulihkan, termasuk untuk keperluan akreditasi.",
    );
  }

  return {
    rincian,
    merusakJejak: sensus.jumlahSnapshot > 0 || berjejak.length > 0,
  };
}

/**
 * Dokumen yang sedang berjalan di rantai pengesahan tidak boleh diarsipkan —
 * DUA keadaan sejak rantai punya tiga cap (docs/14 §2.1), bukan satu.
 * Mengarsipkan yang menunggu Penjaminan Mutu meninggalkan antrean pengesahan
 * yang tidak pernah dapat diselesaikan, persis seperti yang menunggu Kaprodi.
 */
export function periksaKelayakanArsip(status: StatusRpkpsRingkas): Kelayakan {
  if (status === "ARSIP") return { boleh: false, alasan: ["RPKPS ini sudah diarsipkan."] };
  if (status === "DIAJUKAN") {
    return {
      boleh: false,
      alasan: [
        "RPKPS sedang menunggu keputusan Kaprodi. Mengarsipkannya sekarang " +
          "membuat pengajuan menggantung tanpa keputusan.",
      ],
    };
  }
  if (status === "DISETUJUI") {
    return {
      boleh: false,
      alasan: [
        "RPKPS sudah ditandatangani Kaprodi dan menunggu pengesahan Penjaminan " +
          "Mutu. Kembalikan untuk revisi lebih dulu bila memang tidak jadi terbit.",
      ],
    };
  }
  return { boleh: true, alasan: [] };
}

/**
 * Status yang berlaku setelah arsip dibatalkan.
 *
 * Dokumen yang punya salinan beku untuk versi berjalan kembali menjadi TERBIT
 * — beserta halaman katalog publiknya. Yang tidak pernah disahkan kembali
 * menjadi DRAF. Tidak ada jalan ketiga: mengembalikan ke DIAJUKAN akan
 * memunculkan antrean pengesahan yang sudah lama berlalu.
 */
export function statusSetelahPulih(adaSnapshotVersiIni: boolean): StatusRpkpsRingkas {
  return adaSnapshotVersiIni ? "TERBIT" : "DRAF";
}
