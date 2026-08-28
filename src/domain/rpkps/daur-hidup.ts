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
        : `RPKPS berstatus ${sensus.status} tidak dapat dihapus, hanya diarsipkan.`,
    );
  }

  if (sensus.jumlahSnapshot > 0) {
    alasan.push(
      `RPKPS ini pernah disahkan dan memiliki ${sensus.jumlahSnapshot} salinan beku. ` +
        "Menghapusnya membatalkan sidik SHA-256 yang sudah tercetak pada berkas yang beredar.",
    );
  }

  const berjejak = sensus.kelas.filter(
    (k) => k.jumlahPeserta > 0 || k.jumlahNilai > 0 || k.adaEvaluasi,
  );
  if (berjejak.length > 0) {
    const rincian = berjejak
      .map((k) => {
        const bagian = [`${k.jumlahPeserta} peserta`];
        if (k.jumlahNilai > 0) bagian.push(`${k.jumlahNilai} nilai`);
        if (k.adaEvaluasi) bagian.push("evaluasi capaian");
        return `${k.kode} (${bagian.join(", ")})`;
      })
      .join("; ");
    alasan.push(`Sudah ada kelas berjalan: ${rincian}. Bukti pelaksanaan tidak boleh lenyap.`);
  }

  return { boleh: alasan.length === 0, alasan };
}

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
