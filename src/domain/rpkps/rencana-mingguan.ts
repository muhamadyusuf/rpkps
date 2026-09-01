import { kodeAsesmenPertemuan } from "@/domain/evaluasi/peta-asesmen";

/**
 * Penyusunan MANUAL tabel rencana kegiatan pembelajaran — docs/09.
 *
 * Sampai sekarang himpunan baris `pertemuan` dibuat sekali oleh `buatRpkps`
 * lalu beku: dosen hanya dapat mengubah ISI baris, tidak jumlah maupun
 * urutannya. Modul ini menyediakan aturan untuk menambah, menyisipkan,
 * menghapus, menggeser, dan mengubah jenis baris.
 *
 * Murni dan tanpa Prisma, karena yang sulit di sini bukan kueri melainkan
 * ARITMETIKANYA. Nomor minggu bukan sekadar label:
 *
 *   1. `@@unique([rpkpsId, minggu])` — menaikkan nomor satu per satu menabrak
 *      baris yang belum bergeser. Penomoran ulang wajib dua fase; modul ini
 *      menghasilkan RENCANANYA, pemanggil yang menjalankan dua fase itu.
 *   2. Pagu beban belajar dipetakan per nomor minggu, jadi baris yang pindah
 *      nomor berganti pagu tanpa isinya disentuh.
 *   3. `tugas.minggu_mulai`, `tugas.minggu_selesai`, dan `linimasa_tugas.minggu`
 *      menyebut nomor minggu sebagai ANGKA — ikut digeser (docs/09 §K3).
 *   4. `nilai_asesmen.asesmen_kode` (`"M5"`) diturunkan dari nomor minggu dan
 *      BUKAN relasi. Tidak ada kunci asing yang akan menggagalkan penomoran
 *      ulang; ia hanya akan salah, diam-diam. Karena itu `pemetaanKodeAsesmen`
 *      memakai `kodeAsesmenPertemuan` yang sama dengan peta asesmen, bukan
 *      salinan aturannya (docs/09 §K4).
 */

export type JenisPertemuanRingkas = "EFEKTIF" | "UTS" | "UAS";

/** Satu baris tabel mingguan, seperlunya untuk menghitung struktur. */
export type BarisMingguan = {
  id: string;
  minggu: number;
  jenis: JenisPertemuanRingkas;
  /** Ikut dihitung karena baris tanpa bobot tidak menghasilkan asesmen. */
  bobot: number;
};

export type Operasi =
  /** Baris baru di akhir tabel. Tidak menomori ulang apa pun. */
  | { jenis: "TAMBAH" }
  /** Baris baru tepat setelah minggu `setelah`; 0 berarti di paling depan. */
  | { jenis: "SISIP"; setelah: number }
  | { jenis: "HAPUS"; minggu: number }
  | { jenis: "GESER"; minggu: number; arah: "NAIK" | "TURUN" }
  | { jenis: "UBAH_JENIS"; minggu: number; ke: JenisPertemuanRingkas };

export type PemetaanMinggu = { id: string; dari: number; ke: number };
export type PemetaanKode = { dari: string; ke: string };

export type RencanaStruktur = {
  /** Kosong bila operasinya tidak sah; selebihnya rencana siap dijalankan. */
  galat: string | null;
  /** Nomor minggu untuk baris baru, atau null bila tidak ada baris baru. */
  nomorBaru: number | null;
  /** Id baris yang dihapus, atau null. */
  idDihapus: string | null;
  /** HANYA baris yang benar-benar berpindah nomor. */
  pemetaan: PemetaanMinggu[];
  /** Keadaan tabel setelah operasi, terurut menurut nomor minggu. */
  sesudah: BarisMingguan[];
};

const GAGAL = (galat: string): RencanaStruktur => ({
  galat,
  nomorBaru: null,
  idDihapus: null,
  pemetaan: [],
  sesudah: [],
});

function urut(daftar: readonly BarisMingguan[]): BarisMingguan[] {
  return [...daftar].sort((a, b) => a.minggu - b.minggu);
}

/**
 * Menghitung akibat sebuah operasi struktur terhadap tabel mingguan.
 *
 * Tidak pernah melempar: operasi yang tidak masuk akal (menggeser baris
 * teratas ke atas, menghapus minggu yang tidak ada) dikembalikan sebagai
 * `galat` yang siap ditampilkan kepada dosen.
 */
export function susunRencanaStruktur(
  sebelum: readonly BarisMingguan[],
  op: Operasi,
): RencanaStruktur {
  const awal = urut(sebelum);

  switch (op.jenis) {
    case "TAMBAH": {
      const nomorBaru = (awal.at(-1)?.minggu ?? 0) + 1;
      return {
        galat: null,
        nomorBaru,
        idDihapus: null,
        pemetaan: [],
        sesudah: [
          ...awal,
          { id: BARIS_BARU, minggu: nomorBaru, jenis: "EFEKTIF", bobot: 0 },
        ],
      };
    }

    case "SISIP": {
      if (!Number.isInteger(op.setelah) || op.setelah < 0) {
        return GAGAL("Posisi sisip tidak sah.");
      }
      if (op.setelah > 0 && !awal.some((b) => b.minggu === op.setelah)) {
        return GAGAL(`Minggu ${op.setelah} tidak ada pada tabel.`);
      }

      const nomorBaru = op.setelah + 1;
      const pemetaan = awal
        .filter((b) => b.minggu >= nomorBaru)
        .map((b) => ({ id: b.id, dari: b.minggu, ke: b.minggu + 1 }));

      return {
        galat: null,
        nomorBaru,
        idDihapus: null,
        pemetaan,
        sesudah: urut([
          ...awal.map((b) =>
            b.minggu >= nomorBaru ? { ...b, minggu: b.minggu + 1 } : b,
          ),
          { id: BARIS_BARU, minggu: nomorBaru, jenis: "EFEKTIF", bobot: 0 },
        ]),
      };
    }

    case "HAPUS": {
      const sasaran = awal.find((b) => b.minggu === op.minggu);
      if (!sasaran) return GAGAL(`Minggu ${op.minggu} tidak ada pada tabel.`);
      if (awal.length === 1) {
        return GAGAL("Tabel mingguan tidak boleh kosong sama sekali.");
      }

      const sisa = awal.filter((b) => b.id !== sasaran.id);
      const pemetaan = sisa
        .filter((b) => b.minggu > op.minggu)
        .map((b) => ({ id: b.id, dari: b.minggu, ke: b.minggu - 1 }));

      return {
        galat: null,
        nomorBaru: null,
        idDihapus: sasaran.id,
        pemetaan,
        sesudah: sisa.map((b) =>
          b.minggu > op.minggu ? { ...b, minggu: b.minggu - 1 } : b,
        ),
      };
    }

    case "GESER": {
      const indeks = awal.findIndex((b) => b.minggu === op.minggu);
      if (indeks < 0) return GAGAL(`Minggu ${op.minggu} tidak ada pada tabel.`);

      const indeksLawan = op.arah === "NAIK" ? indeks - 1 : indeks + 1;
      const lawan = awal[indeksLawan];
      if (!lawan) {
        return GAGAL(
          op.arah === "NAIK"
            ? "Baris ini sudah paling awal."
            : "Baris ini sudah paling akhir.",
        );
      }

      const ini = awal[indeks];
      // Yang ditukar NOMORNYA, bukan isinya: seluruh anak baris (aktivitas,
      // indikator, kaitan Sub-CPMK) ikut pindah karena menempel pada id.
      const pemetaan: PemetaanMinggu[] = [
        { id: ini.id, dari: ini.minggu, ke: lawan.minggu },
        { id: lawan.id, dari: lawan.minggu, ke: ini.minggu },
      ];

      return {
        galat: null,
        nomorBaru: null,
        idDihapus: null,
        pemetaan,
        sesudah: urut(
          awal.map((b) => {
            if (b.id === ini.id) return { ...b, minggu: lawan.minggu };
            if (b.id === lawan.id) return { ...b, minggu: ini.minggu };
            return b;
          }),
        ),
      };
    }

    case "UBAH_JENIS": {
      const sasaran = awal.find((b) => b.minggu === op.minggu);
      if (!sasaran) return GAGAL(`Minggu ${op.minggu} tidak ada pada tabel.`);

      return {
        galat: null,
        nomorBaru: null,
        idDihapus: null,
        pemetaan: [],
        sesudah: awal.map((b) =>
          b.id === sasaran.id ? { ...b, jenis: op.ke } : b,
        ),
      };
    }
  }
}

/** Penanda baris yang belum punya id karena belum ditulis ke basis data. */
export const BARIS_BARU = "__baru__";

/**
 * Menerjemahkan sebuah rujukan nomor minggu (mis. `tugas.mingguMulai`)
 * mengikuti penomoran ulang. Nomor yang tidak tersentuh dikembalikan apa
 * adanya — termasuk nomor baris yang dihapus, yang kini ditempati baris
 * sesudahnya. Itu perilaku yang benar untuk sebuah RENCANA: tugas minggu 7
 * tetap tugas minggu 7, sekarang dengan materi yang sudah bergeser.
 */
export function geserRujukan(
  pemetaan: readonly PemetaanMinggu[],
  minggu: number,
): number {
  return pemetaan.find((p) => p.dari === minggu)?.ke ?? minggu;
}

/**
 * Perpindahan kode asesmen akibat sebuah operasi struktur.
 *
 * Diturunkan dengan membandingkan kode SEBELUM dan SESUDAH untuk baris yang
 * sama (dicocokkan lewat id), memakai `kodeAsesmenPertemuan` — aturan yang
 * sama persis dengan yang dipakai peta asesmen dan impor nilai.
 *
 * Baris baru tidak punya kode sebelumnya, dan baris yang dihapus tidak punya
 * kode sesudahnya; keduanya tidak menghasilkan perpindahan.
 */
export function pemetaanKodeAsesmen(
  sebelum: readonly BarisMingguan[],
  sesudah: readonly BarisMingguan[],
): PemetaanKode[] {
  const kodeSebelum = new Map(
    kodeAsesmenPertemuan(sebelum).map((k) => [k.baris.id, k.kode]),
  );
  const kodeSesudah = new Map(
    kodeAsesmenPertemuan(sesudah).map((k) => [k.baris.id, k.kode]),
  );

  const pemetaan: PemetaanKode[] = [];
  for (const [id, dari] of kodeSebelum) {
    const ke = kodeSesudah.get(id);
    if (ke !== undefined && ke !== dari) pemetaan.push({ dari, ke });
  }
  return pemetaan;
}

/** Kode asesmen yang lenyap: barisnya hilang, atau bobotnya jatuh ke nol. */
export function kodeMenganggur(
  sebelum: readonly BarisMingguan[],
  sesudah: readonly BarisMingguan[],
): string[] {
  const bertahan = new Set(
    kodeAsesmenPertemuan(sesudah).map((k) => k.baris.id),
  );
  return kodeAsesmenPertemuan(sebelum)
    .filter((k) => !bertahan.has(k.baris.id))
    .map((k) => k.kode);
}

export type DampakStruktur = {
  /** Nilai yang ikut berpindah kode, sehingga tetap menempel pada materinya. */
  berpindah: { dari: string; ke: string; jumlah: number }[];
  /** Nilai yang kehilangan asesmennya karena barisnya dihapus. */
  menganggur: { kode: string; jumlah: number }[];
  totalBerpindah: number;
  totalMenganggur: number;
};

/**
 * Menimbang berapa banyak nilai mahasiswa yang tersentuh sebuah operasi.
 *
 * Inilah angka yang WAJIB muncul di dialog konfirmasi (docs/09 §K4.3):
 * struktur boleh diubah walau nilai sudah masuk, tetapi tidak boleh diubah
 * tanpa dosen tahu berapa banyak yang ikut bergerak.
 *
 * `jumlahNilaiPerKode` datang dari `groupBy` pada `nilai_asesmen`.
 */
export function hitungDampakStruktur(
  sebelum: readonly BarisMingguan[],
  sesudah: readonly BarisMingguan[],
  jumlahNilaiPerKode: Readonly<Record<string, number>>,
): DampakStruktur {
  const berpindah = pemetaanKodeAsesmen(sebelum, sesudah)
    .map((p) => ({ ...p, jumlah: jumlahNilaiPerKode[p.dari] ?? 0 }))
    .filter((p) => p.jumlah > 0);

  const menganggur = kodeMenganggur(sebelum, sesudah)
    .map((kode) => ({ kode, jumlah: jumlahNilaiPerKode[kode] ?? 0 }))
    .filter((m) => m.jumlah > 0);

  return {
    berpindah,
    menganggur,
    totalBerpindah: berpindah.reduce((s, p) => s + p.jumlah, 0),
    totalMenganggur: menganggur.reduce((s, m) => s + m.jumlah, 0),
  };
}

export type Kelayakan = { boleh: boolean; alasan: string[] };

const DAPAT_DISUNTING = ["DRAF", "DIREVISI"] as const;

/**
 * Syarat mengubah STRUKTUR tabel mingguan (docs/09 §K4).
 *
 * Sengaja lebih longgar daripada `periksaKelayakanHapus`: yang menghalangi
 * hanya status dokumen. Nilai yang sudah masuk TIDAK memblokir, karena
 * kodenya ikut dipindahkan — lihat `pemetaanKodeAsesmen`. Yang wajib
 * dilakukan pemanggil adalah menyebut dampaknya lebih dulu, bukan menolak.
 */
export function periksaKelayakanUbahStruktur(sensus: {
  status: string;
}): Kelayakan {
  const alasan: string[] = [];

  if (!(DAPAT_DISUNTING as readonly string[]).includes(sensus.status)) {
    alasan.push(
      sensus.status === "DIAJUKAN"
        ? "RPKPS sedang diajukan dan menunggu keputusan Kaprodi. Tarik pengajuannya lebih dulu."
        : `RPKPS berstatus ${sensus.status} tidak dapat disunting.`,
    );
  }

  return { boleh: alasan.length === 0, alasan };
}
