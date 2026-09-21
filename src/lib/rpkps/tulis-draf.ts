import { rencanakanKomponen } from "@/domain/rpkps/komponen-nilai";
import type { DrafRpkps } from "@/domain/rpkps/draf";
import type {
  BentukSoal,
  JenisTugas,
  LevelBloom,
  Prisma,
  SumberIsi,
} from "@/generated/prisma";

/**
 * Inti penulisan `DrafRpkps` ke dokumen — SATU pintu tulis untuk dua sumber:
 * draf AI (`terapkanDrafRpkps`) dan impor template (docs/23 T1).
 *
 * Dua sumber itu berbeda dalam siapa penulisnya (`sumber`) dan jejak apa yang
 * ditinggalkan, tidak dalam cara isinya ditulis. Menyalin fungsi ini ke jalur
 * kedua berarti dua pintu yang lambat laun berbeda aturan komponen nilai.
 *
 * Tidak menandai dirinya `server-only` dan menerima klien transaksi sebagai
 * parameter — alasannya sama dengan `komponen-inti.ts`: yang paling mungkin
 * salah di sini hanya terbukti terhadap Postgres sungguhan.
 *
 * Prasyarat pemanggil, karena berkas ini TIDAK memeriksanya: wewenang
 * (`wenangRpkps`), `bolehSuntingIsi`, dan `periksaDraf` — pada draf yang akan
 * ditulis, terhadap keadaan dokumen saat itu.
 *
 * Sejak ditarik ke sini, penulisan bersifat DI TEMPAT (dicocokkan lewat nomor
 * atau jenis), bukan hapus-lalu-buat-ulang seperti versi lama di
 * `aksi-draf.ts`. Tiga akibat nyata dari cara lama, yang sekarang tertutup:
 *   - `tugas.*En` dan `kriteria_tugas.*En` (terjemahan) lenyap tanpa pesan;
 *   - `linimasa_tugas` ikut terhapus lewat cascade;
 *   - `nilai_butir` — skor mahasiswa — ikut terhapus lewat cascade ketika
 *     kisi-kisi diganti, pada dokumen DIREVISI yang kelasnya sudah bernilai.
 * Kolom `*En` yang tidak ada di draf dibiarkan apa adanya (AGENTS.md:
 * "penyimpanan yang menulis ulang baris wajib membawa medan `*En`").
 */

type Tx = Prisma.TransactionClient;

/** Galat yang dapat dijelaskan ke dosen, dibedakan dari galat basis data. */
export class GalatTulis extends Error {
  constructor(
    readonly kode: "NILAI_TERTAUT",
    readonly rincian: string,
  ) {
    super(`${kode}: ${rincian}`);
    this.name = "GalatTulis";
  }
}

/** Rujukan pustaka yang tidak dapat tertukar: Pustaka unik per (jenis, nomor). */
export function refPustaka(p: { jenis: string; nomor: number }): string {
  return `${p.jenis}-${p.nomor}`;
}

export interface RencanaTulis {
  pertemuan: { p: DrafRpkps["pertemuan"][number]; id: string | undefined; ref: string[] }[];
  ujian: { u: DrafRpkps["ujian"][number]; id: string | undefined }[];
  /** Baris ujian pada kerangka yang tidak disebut draf — bobotnya dinolkan. */
  ujianTakDisebut: string[];
  tugas: { t: DrafRpkps["tugas"][number]; subCpmkId: string[] }[];
  kisi: {
    kk: DrafRpkps["kisiKisi"][number];
    butir: { b: DrafRpkps["kisiKisi"][number]["butir"][number]; subCpmkId: string | undefined }[];
  }[];
}

/**
 * Menyelesaikan kode dan nomor pada draf menjadi id, SEBELUM transaksi.
 *
 * Yang meleset dikumpulkan dan dilaporkan, bukan dilempar sebagai `undefined`:
 * dulu id yang tidak ketemu baru meledak sebagai `PrismaClientValidationError`
 * — galat tanpa kode dan tanpa petunjuk lokasi.
 */
export function selesaikanRujukan(
  pertemuan: readonly { id: string; minggu: number; jenis: string }[],
  subCpmk: readonly { id: string; kode: string }[],
  draf: DrafRpkps,
): { hilang: string[]; rencana: RencanaTulis } {
  const idPertemuan = new Map(pertemuan.map((p) => [p.minggu, p.id]));
  const idSubCpmk = new Map(subCpmk.map((s) => [s.kode, s.id]));

  const hilang: string[] = [];
  const wajib = <T>(nilai: T | undefined, apa: string): T | undefined => {
    if (nilai === undefined) hilang.push(apa);
    return nilai;
  };

  const ujianDisebut = new Set(draf.ujian.map((u) => u.minggu));

  const rencana: RencanaTulis = {
    pertemuan: draf.pertemuan.map((p) => ({
      p,
      id: wajib(idPertemuan.get(p.minggu), `pertemuan minggu ${p.minggu}`),
      // Rujukan ganda pada satu minggu melanggar kunci gabungan PertemuanPustaka.
      // Id-nya BELUM dapat diselesaikan di sini: sebagian pustaka baru dibuat di
      // dalam transaksi. Kesahihan rujukannya sudah dijamin periksaDraf().
      ref: [...new Set(p.pustakaRef)],
    })),
    ujian: draf.ujian.map((u) => ({
      u,
      id: wajib(idPertemuan.get(u.minggu), `baris ujian minggu ${u.minggu}`),
    })),
    ujianTakDisebut: pertemuan
      .filter((p) => p.jenis !== "EFEKTIF" && !ujianDisebut.has(p.minggu))
      .map((p) => p.id),
    tugas: draf.tugas.map((t) => ({
      t,
      subCpmkId: [...new Set(t.subCpmkKode)]
        .map((kode) => wajib(idSubCpmk.get(kode), `Sub-CPMK ${kode} pada tugas ${t.nomor}`))
        .filter((x): x is string => Boolean(x)),
    })),
    kisi: draf.kisiKisi.map((kk) => ({
      kk,
      butir: kk.butir.map((b) => ({
        b,
        subCpmkId: wajib(
          idSubCpmk.get(b.subCpmkKode),
          `Sub-CPMK ${b.subCpmkKode} pada butir ${b.nomor} ${kk.jenis}`,
        ),
      })),
    })),
  };
  return { hilang, rencana };
}

const atauNull = (s: string): string | null => (s.trim() === "" ? null : s);

/**
 * Menulis draf ke dokumen di dalam transaksi milik pemanggil.
 *
 * `sumber` menandai asal isi: `AI` untuk draf model, `KURIKULUM` (bawaan
 * kolom, artinya "ditulis manusia") untuk impor. Baris yang tadinya bertanda
 * `AI` dan kini ditimpa tulisan dosen diturunkan ke `KURIKULUM` — lencana AI
 * yang tertinggal menyesatkan pemeriksa.
 */
export async function tulisDraf(
  tx: Tx,
  rpkpsId: string,
  draf: DrafRpkps,
  rencana: RencanaTulis,
  sumber: SumberIsi,
): Promise<void> {
  // ── Bagian A, pembuka CPMK, komponen nilai, pustaka ─────────────────
  await tx.rpkps.update({
    where: { id: rpkpsId },
    data: { deskripsi: draf.deskripsi, kalimatPembukaCpmk: draf.kalimatPembukaCpmk },
  });

  // Komponen nilai DISELARASKAN dengan draf, bukan dihapus lalu dibuat ulang:
  // baris mingguan yang sudah ditautkan menunjuk komponen lewat id, dan id itu
  // harus selamat. Draf tidak membawa id, jadi pemasangannya lewat nama —
  // karena itu tidak ada penggantian nama di jalur ini, dan langkah nama
  // sementara tidak diperlukan.
  const adaKomponen = await tx.komponenNilai.findMany({
    where: { rpkpsId },
    select: { id: true, nama: true },
  });
  const rencanaKomponen = rencanakanKomponen(
    draf.komponenNilai.map((n) => ({ id: null, nama: n.nama, namaEn: null, bobot: n.bobot })),
    adaKomponen,
  );
  if (rencanaKomponen.hapus.length > 0) {
    await tx.komponenNilai.deleteMany({ where: { id: { in: rencanaKomponen.hapus } } });
  }
  for (const k of rencanaKomponen.perbarui) {
    await tx.komponenNilai.update({
      where: { id: k.id },
      data: { nama: k.nama, bobot: k.bobot, urutan: k.urutan, sumber },
    });
  }
  if (rencanaKomponen.tambah.length > 0) {
    await tx.komponenNilai.createMany({
      data: rencanaKomponen.tambah.map((k) => ({
        rpkpsId,
        nama: k.nama,
        bobot: k.bobot,
        urutan: k.urutan,
        sumber,
      })),
    });
  }

  // Pustaka lama DIPERTAHANKAN apa adanya — yang baru hanya ditambahkan.
  if (draf.pustakaBaru.length > 0) {
    await tx.pustaka.createMany({
      data: draf.pustakaBaru.map((b) => ({
        rpkpsId,
        jenis: b.jenis,
        nomor: b.nomor,
        teks: b.teks,
        url: b.url,
        sumber,
      })),
    });
  }

  // Dibaca SETELAH pustaka baru dibuat, supaya rujukan ke keduanya dapat
  // diselesaikan.
  const idPustaka = new Map<string, string>(
    (
      await tx.pustaka.findMany({
        where: { rpkpsId },
        select: { id: true, nomor: true, jenis: true },
      })
    ).map((b) => [refPustaka(b), b.id]),
  );

  // Peta komponen dibaca SETELAH penyelarasan di atas dan SEBELUM baris
  // mingguan ditulis, karena baris mingguan pun menunjuk komponen (docs/12).
  const komponenBaru = new Map<string, string>(
    (
      await tx.komponenNilai.findMany({ where: { rpkpsId }, select: { id: true, nama: true } })
    ).map((n) => [n.nama, n.id]),
  );
  const idKomponen = (nama: string | null) => (nama ? (komponenBaru.get(nama) ?? null) : null);

  // ── Pertemuan ─────────────────────────────────────────────────────────
  for (const { p, id, ref } of rencana.pertemuan) {
    if (!id) continue;
    await tx.pertemuan.update({
      where: { id },
      data: {
        topik: p.topik,
        subtopik: p.subtopik,
        metodeNarasi: atauNull(p.metodeNarasi),
        aktivitasDosen: atauNull(p.aktivitasDosen),
        aktivitasMahasiswa: atauNull(p.aktivitasMahasiswa),
        tugasTerstruktur: p.tugasTerstruktur,
        penilaianJenis: p.penilaianJenis,
        penilaianSistem: p.penilaianSistem,
        bobot: p.bobot,
        komponenNilaiId: idKomponen(p.komponenNilai),
        sumber,
      },
    });
    // Menit aktivitas TM/PT/BM sengaja tidak disentuh: sudah pas dengan pagu
    // beban belajar sejak kerangka dibuat.

    // Indikator diselaraskan menurut urutannya: `teksEn` baris yang ada tidak
    // ikut hilang. Menghapus lalu membuat ulang membuang terjemahannya.
    const indikatorAda = await tx.indikator.findMany({
      where: { pertemuanId: id },
      orderBy: { urutan: "asc" },
      select: { id: true },
    });
    for (let i = 0; i < p.indikator.length; i++) {
      const ada = indikatorAda[i];
      if (ada) {
        await tx.indikator.update({ where: { id: ada.id }, data: { teks: p.indikator[i], urutan: i } });
      } else {
        await tx.indikator.create({ data: { pertemuanId: id, teks: p.indikator[i], urutan: i } });
      }
    }
    if (indikatorAda.length > p.indikator.length) {
      await tx.indikator.deleteMany({
        where: { id: { in: indikatorAda.slice(p.indikator.length).map((x) => x.id) } },
      });
    }

    await tx.pertemuanPustaka.deleteMany({ where: { pertemuanId: id } });
    await tx.pertemuanPustaka.createMany({
      data: ref
        .map((r) => idPustaka.get(r))
        .filter((x): x is string => Boolean(x))
        .map((pustakaId) => ({ pertemuanId: id, pustakaId })),
    });
  }

  // ── Baris ujian: HANYA bobot dan komponennya ─────────────────────────
  // Topik, jenis, dan menit aktivitas baris ujian tidak disentuh — isinya
  // bukan urusan draf. Baris ujian yang tidak disebut draf dinolkan: draf
  // sudah diperiksa jumlahnya 100 TANPA baris itu, jadi bobot lamanya tidak
  // boleh tertinggal di dokumen.
  for (const { u, id } of rencana.ujian) {
    if (!id) continue;
    await tx.pertemuan.update({
      where: { id },
      data: { bobot: u.bobot, komponenNilaiId: idKomponen(u.komponenNilai), sumber },
    });
  }
  if (rencana.ujianTakDisebut.length > 0) {
    await tx.pertemuan.updateMany({
      where: { id: { in: rencana.ujianTakDisebut } },
      data: { bobot: 0, komponenNilaiId: null },
    });
  }

  // ── Tugas: dicocokkan menurut nomor, dan yang tak disebut dihapus ────
  const tugasAda = new Map(
    (await tx.tugas.findMany({ where: { rpkpsId }, select: { id: true, nomor: true } })).map(
      (t) => [t.nomor, t.id],
    ),
  );
  for (const { t, subCpmkId } of rencana.tugas) {
    const data = {
      nama: t.nama,
      jenis: t.jenis as JenisTugas,
      mingguMulai: t.mingguMulai,
      mingguSelesai: t.mingguSelesai,
      bobot: t.bobot,
      komponenNilaiId: idKomponen(t.komponenNilai),
      deskripsi: t.deskripsi,
      uraianTugas: t.uraianTugas,
      formatLuaran: t.formatLuaran,
      sumber,
    };
    const id = tugasAda.get(t.nomor);
    if (!id) {
      await tx.tugas.create({
        data: {
          rpkpsId,
          nomor: t.nomor,
          ...data,
          subCpmk: { create: subCpmkId.map((s) => ({ subCpmkId: s })) },
          kriteria: {
            create: t.kriteria.map((c) => ({
              nomor: c.nomor,
              indikator: c.indikator,
              rincian: c.rincian,
              bobot: c.bobot,
            })),
          },
        },
      });
      continue;
    }

    await tx.tugas.update({ where: { id }, data });
    await tx.tugasSubCpmk.deleteMany({ where: { tugasId: id } });
    await tx.tugasSubCpmk.createMany({
      data: subCpmkId.map((s) => ({ tugasId: id, subCpmkId: s })),
    });

    const kriteriaAda = new Map(
      (await tx.kriteriaTugas.findMany({ where: { tugasId: id }, select: { id: true, nomor: true } })).map(
        (k) => [k.nomor, k.id],
      ),
    );
    for (const c of t.kriteria) {
      const kid = kriteriaAda.get(c.nomor);
      const isi = { indikator: c.indikator, rincian: c.rincian, bobot: c.bobot };
      if (kid) await tx.kriteriaTugas.update({ where: { id: kid }, data: isi });
      else await tx.kriteriaTugas.create({ data: { tugasId: id, nomor: c.nomor, ...isi } });
    }
    await tx.kriteriaTugas.deleteMany({
      where: { tugasId: id, nomor: { notIn: t.kriteria.map((c) => c.nomor) } },
    });
  }
  await tx.tugas.deleteMany({
    where: { rpkpsId, nomor: { notIn: rencana.tugas.map(({ t }) => t.nomor) } },
  });

  // ── Kisi-kisi: dicocokkan menurut jenis, butir menurut nomor ─────────
  const kisiAda = await tx.kisiKisi.findMany({
    where: { rpkpsId },
    select: { id: true, jenis: true, butir: { select: { id: true, nomor: true } } },
  });

  // Butir yang akan hilang tidak boleh membawa skor mahasiswa: `nilai_butir`
  // ber-cascade, dan skor yang lenyap tidak dapat dibangun ulang.
  const butirBaru = new Map(rencana.kisi.map(({ kk, butir }) => [kk.jenis, new Set(butir.map(({ b }) => b.nomor))]));
  const butirAkanHilang = kisiAda.flatMap((k) =>
    k.butir.filter((b) => !butirBaru.get(k.jenis)?.has(b.nomor)).map((b) => ({ id: b.id, jenis: k.jenis, nomor: b.nomor })),
  );
  if (butirAkanHilang.length > 0) {
    const bernilai = await tx.nilaiButir.findMany({
      where: { butirKisiKisiId: { in: butirAkanHilang.map((b) => b.id) } },
      distinct: ["butirKisiKisiId"],
      select: { butirKisiKisiId: true },
    });
    if (bernilai.length > 0) {
      const ids = new Set(bernilai.map((n) => n.butirKisiKisiId));
      const daftar = butirAkanHilang
        .filter((b) => ids.has(b.id))
        .map((b) => `${b.jenis} #${b.nomor}`)
        .slice(0, 5)
        .join(", ");
      throw new GalatTulis("NILAI_TERTAUT", daftar);
    }
  }

  for (const { kk, butir } of rencana.kisi) {
    const ada = kisiAda.find((k) => k.jenis === kk.jenis);
    const butirAda = new Map((ada?.butir ?? []).map((b) => [b.nomor, b.id]));
    const isiKisi = { totalSkor: 100, durasiMenit: kk.durasiMenit, sumber };
    const kisiId = ada
      ? (await tx.kisiKisi.update({ where: { id: ada.id }, data: isiKisi })).id
      : (await tx.kisiKisi.create({ data: { rpkpsId, jenis: kk.jenis, ...isiKisi } })).id;

    for (const { b, subCpmkId } of butir) {
      const isi = {
        subCpmkId: subCpmkId as string,
        levelBloom: b.levelBloom as LevelBloom,
        bentuk: b.bentuk as BentukSoal,
        jumlahButir: b.jumlahButir,
        skor: b.skor,
        indikator: b.indikator,
      };
      const bid = butirAda.get(b.nomor);
      if (bid) await tx.butirKisiKisi.update({ where: { id: bid }, data: isi });
      else await tx.butirKisiKisi.create({ data: { kisiKisiId: kisiId, nomor: b.nomor, ...isi } });
    }
    await tx.butirKisiKisi.deleteMany({
      where: { kisiKisiId: kisiId, nomor: { notIn: butir.map(({ b }) => b.nomor) } },
    });
  }
  // Kisi-kisi yang tidak disebut draf dihapus (sudah dipastikan tanpa nilai).
  const jenisBaru = rencana.kisi.map(({ kk }) => kk.jenis);
  await tx.kisiKisi.deleteMany({ where: { rpkpsId, jenis: { notIn: jenisBaru } } });
}

/** Ringkasan satu baris untuk riwayat dan jejak audit. */
export function ringkasTulis(draf: DrafRpkps): string {
  return (
    `${draf.pertemuan.length} pertemuan, ${draf.ujian.filter((u) => u.bobot > 0).length} baris ujian berbobot, ` +
    `${draf.tugas.length} tugas, ` +
    `${draf.kisiKisi.reduce((s, x) => s + x.butir.length, 0)} butir kisi-kisi, ` +
    `${draf.komponenNilai.length} komponen nilai, ` +
    `${draf.pustakaBaru.length} pustaka baru, deskripsi dan pembuka CPMK`
  );
}
