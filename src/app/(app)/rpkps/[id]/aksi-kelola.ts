"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran } from "@/lib/otorisasi";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import {
  periksaKelayakanArsip,
  periksaKelayakanHapus,
  statusSetelahPulih,
} from "@/domain/rpkps/daur-hidup";
import { MIN_CATATAN_REVISI } from "@/domain/rpkps/tipe";
import type { Prisma } from "@/generated/prisma";

export type Hasil = { ok: boolean; pesan: string; id?: string; alasan?: string[] };

/**
 * Pengelolaan daur hidup dan kepemilikan RPKPS — hapus, arsip, tim pengampu,
 * serah terima, dan salin. Acuan: docs/06.
 *
 * Dipisah dari `../aksi.ts` yang mengurus ISI dokumen. Berkas ini tidak pernah
 * menyentuh isi; ia mengurus keberadaan dokumen dan siapa yang memegangnya.
 */

/** Hanya koordinator RPKPS dan pengelola prodi yang boleh mengubah keberadaannya. */
async function pastikanKelola(rpkpsId: string) {
  const w = await wenangRpkps(rpkpsId);
  return { ...w, bolehKelola: w.koordinator || w.pengelola };
}

const TOLAK_KELOLA =
  "Hanya koordinator RPKPS ini, Kaprodi, atau admin yang dapat melakukannya.";

// ─────────────────────────────────────────────────────────────
// HAPUS DAN ARSIP — docs/06 §2
// ─────────────────────────────────────────────────────────────

/**
 * Menghapus RPKPS beserta seluruh anaknya lewat cascade.
 *
 * Syaratnya diperiksa `periksaKelayakanHapus` di lapisan domain, bukan di
 * sini — dan bukan pula oleh dialog. Sensus dihitung ulang dari basis data
 * tepat sebelum penghapusan, di dalam transaksi yang sama, supaya kelas yang
 * baru saja diisi nilai oleh dosen lain tidak lolos lewat celah waktu antara
 * dialog dibuka dan tombol ditekan.
 */
export async function hapusRpkps(id: string): Promise<Hasil> {
  const { bolehKelola, sesi } = await pastikanKelola(id);
  if (!bolehKelola) return { ok: false, pesan: TOLAK_KELOLA };

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: {
      status: true,
      mataKuliah: { select: { kode: true, nama: true } },
      tahunAkademik: { select: { kode: true } },
      _count: {
        select: { snapshot: true, pertemuan: true, tugas: true, kisiKisi: true, pustaka: true },
      },
      kelas: {
        select: {
          kode: true,
          evaluasi: { select: { id: true } },
          peserta: { select: { _count: { select: { nilai: true } } } },
        },
      },
    },
  });
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan." };

  const kelayakan = periksaKelayakanHapus({
    status: rpkps.status,
    jumlahSnapshot: rpkps._count.snapshot,
    kelas: rpkps.kelas.map((k) => ({
      kode: k.kode,
      jumlahPeserta: k.peserta.length,
      jumlahNilai: k.peserta.reduce((n, p) => n + p._count.nilai, 0),
      adaEvaluasi: k.evaluasi !== null,
    })),
  });
  if (!kelayakan.boleh) {
    return {
      ok: false,
      pesan: "RPKPS ini tidak dapat dihapus — arsipkan saja.",
      alasan: kelayakan.alasan,
    };
  }

  const label = `${rpkps.mataKuliah.kode} ${rpkps.tahunAkademik.kode}`;

  /**
   * Sensus dicatat SEBELUM baris hilang. Baris-barisnya memang lenyap, tetapi
   * pertanyaan "ke mana perginya RPKPS TI214 2025/2026-GENAP?" tetap terjawab.
   */
  await prisma.$transaction([
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "RPKPS_DIHAPUS",
        entitas: "rpkps",
        entitasId: id,
        ringkasan: `${sesi.email} menghapus RPKPS ${label} — ${rpkps.mataKuliah.nama}`,
        data: {
          mataKuliah: rpkps.mataKuliah.kode,
          tahunAkademik: rpkps.tahunAkademik.kode,
          status: rpkps.status,
          pertemuan: rpkps._count.pertemuan,
          tugas: rpkps._count.tugas,
          kisiKisi: rpkps._count.kisiKisi,
          pustaka: rpkps._count.pustaka,
          kelasKosong: rpkps.kelas.map((k) => k.kode),
        },
      },
    }),
    prisma.rpkps.delete({ where: { id } }),
  ]);

  revalidatePath("/rpkps");
  return { ok: true, pesan: `RPKPS ${label} dihapus.` };
}

const SkemaAlasan = z
  .string()
  .trim()
  .min(
    MIN_CATATAN_REVISI,
    `Alasan pengarsipan wajib diisi, minimal ${MIN_CATATAN_REVISI} karakter.`,
  )
  .max(1000);

/**
 * Menarik RPKPS dari peredaran tanpa melenyapkan apa pun.
 *
 * Untuk dokumen TERBIT ini sekaligus MENCABUT halaman katalog publiknya:
 * `src/lib/publik/muat.ts` hanya melayani status TERBIT, jadi tidak ada kode
 * tambahan yang perlu ditulis di sisi publik (docs/06 keputusan K3).
 */
export async function arsipkanRpkps(id: string, alasan: string): Promise<Hasil> {
  const { bolehKelola, sesi } = await pastikanKelola(id);
  if (!bolehKelola) return { ok: false, pesan: TOLAK_KELOLA };

  const urai = SkemaAlasan.safeParse(alasan);
  if (!urai.success) {
    return { ok: false, pesan: urai.error.issues[0]?.message ?? "Alasan tidak sah." };
  }

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: { status: true, versi: true, mataKuliah: { select: { kode: true } } },
  });
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan." };

  const kelayakan = periksaKelayakanArsip(rpkps.status);
  if (!kelayakan.boleh) {
    return { ok: false, pesan: kelayakan.alasan[0] ?? "Tidak dapat diarsipkan." };
  }

  const terbit = rpkps.status === "TERBIT";

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status: "ARSIP" } }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status: "ARSIP",
        deskripsi: `Diarsipkan: ${urai.data}`,
        olehId: sesi.id,
      },
    }),
  ]);

  revalidatePath(`/rpkps/${id}`);
  revalidatePath("/rpkps");
  revalidatePath("/katalog");
  return {
    ok: true,
    pesan: terbit
      ? "RPKPS diarsipkan dan ditarik dari katalog publik. Seluruh isinya tetap utuh."
      : "RPKPS diarsipkan. Seluruh isinya tetap utuh.",
  };
}

export async function pulihkanRpkps(id: string): Promise<Hasil> {
  const { bolehKelola, sesi } = await pastikanKelola(id);
  if (!bolehKelola) return { ok: false, pesan: TOLAK_KELOLA };

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: {
      status: true,
      versi: true,
      snapshot: { where: {}, select: { versi: true } },
    },
  });
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan." };
  if (rpkps.status !== "ARSIP") {
    return { ok: false, pesan: "RPKPS ini tidak sedang diarsipkan." };
  }

  const status = statusSetelahPulih(rpkps.snapshot.some((s) => s.versi === rpkps.versi));

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status } }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status,
        deskripsi:
          status === "TERBIT"
            ? "Dikembalikan dari arsip; salinan beku dan halaman publiknya berlaku lagi"
            : "Dikembalikan dari arsip sebagai draf",
        olehId: sesi.id,
      },
    }),
  ]);

  revalidatePath(`/rpkps/${id}`);
  revalidatePath("/rpkps");
  revalidatePath("/katalog");
  return {
    ok: true,
    pesan:
      status === "TERBIT"
        ? "RPKPS kembali terbit dan tampil lagi di katalog publik."
        : "RPKPS kembali menjadi draf.",
  };
}

// ─────────────────────────────────────────────────────────────
// TIM PENGAMPU DAN SERAH TERIMA — docs/06 §3.2–3.3
// ─────────────────────────────────────────────────────────────

const PERAN_DOSEN = ["DOSEN", "KOORDINATOR_MK", "KAPRODI"] as const;

/**
 * Menambahkan dosen sebagai ANGGOTA tim pengampu.
 *
 * Calon tidak disaring per prodi: team teaching lintas prodi nyata (MK wajib
 * umum, MK layanan, dosen tamu), dan sejak docs/06 §3.4 kepengampuan memang
 * menjadi jalur akses tersendiri — yang ditambahkan memperoleh akses ke RPKPS
 * INI saja, bukan ke prodi pemiliknya.
 */
export async function tambahPengampu(
  rpkpsId: string,
  penggunaId: string,
): Promise<Hasil> {
  const { bolehKelola, sesi } = await pastikanKelola(rpkpsId);
  if (!bolehKelola) return { ok: false, pesan: TOLAK_KELOLA };

  const calon = await prisma.pengguna.findUnique({
    where: { id: penggunaId },
    select: {
      nama: true,
      status: true,
      penugasan: { select: { peran: true } },
    },
  });
  if (!calon) return { ok: false, pesan: "Dosen tidak ditemukan." };
  if (calon.status !== "AKTIF") {
    return { ok: false, pesan: `${calon.nama} belum berstatus aktif.` };
  }
  if (!calon.penugasan.some((p) => (PERAN_DOSEN as readonly string[]).includes(p.peran))) {
    return { ok: false, pesan: `${calon.nama} tidak memegang peran dosen.` };
  }

  const sudah = await prisma.rpkpsPengampu.findUnique({
    where: { rpkpsId_penggunaId: { rpkpsId, penggunaId } },
    select: { id: true },
  });
  if (sudah) return { ok: false, pesan: `${calon.nama} sudah ada di tim pengampu.` };

  const terakhir = await prisma.rpkpsPengampu.aggregate({
    where: { rpkpsId },
    _max: { urutan: true },
  });

  await prisma.$transaction([
    prisma.rpkpsPengampu.create({
      data: {
        rpkpsId,
        penggunaId,
        peran: "ANGGOTA",
        urutan: (terakhir._max.urutan ?? -1) + 1,
      },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "PENGAMPU_DITAMBAH",
        entitas: "rpkps",
        entitasId: rpkpsId,
        ringkasan: `${sesi.email} menambahkan ${calon.nama} sebagai pengampu`,
      },
    }),
  ]);

  revalidatePath(`/rpkps/${rpkpsId}`);
  revalidatePath("/rpkps");
  return { ok: true, pesan: `${calon.nama} ditambahkan ke tim pengampu.` };
}

/**
 * Melepas anggota dari tim pengampu. Tidak menghapus apa pun yang sudah ia
 * tulis — isi RPKPS tidak menyimpan kepemilikan per baris.
 */
export async function lepasPengampu(
  rpkpsId: string,
  penggunaId: string,
): Promise<Hasil> {
  const { bolehKelola, sesi } = await pastikanKelola(rpkpsId);
  if (!bolehKelola) return { ok: false, pesan: TOLAK_KELOLA };

  const baris = await prisma.rpkpsPengampu.findUnique({
    where: { rpkpsId_penggunaId: { rpkpsId, penggunaId } },
    select: { peran: true, pengguna: { select: { nama: true } } },
  });
  if (!baris) return { ok: false, pesan: "Dosen tersebut bukan pengampu RPKPS ini." };

  // Tanpa pagar ini sebuah RPKPS bisa berakhir tanpa penanggung jawab.
  if (baris.peran === "KOORDINATOR") {
    return {
      ok: false,
      pesan:
        "Koordinator tidak dapat dilepas begitu saja. Lakukan serah terima ke dosen lain lebih dulu.",
    };
  }

  await prisma.$transaction([
    prisma.rpkpsPengampu.delete({
      where: { rpkpsId_penggunaId: { rpkpsId, penggunaId } },
    }),
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "PENGAMPU_DILEPAS",
        entitas: "rpkps",
        entitasId: rpkpsId,
        ringkasan: `${sesi.email} melepas ${baris.pengguna.nama} dari tim pengampu`,
      },
    }),
  ]);

  revalidatePath(`/rpkps/${rpkpsId}`);
  revalidatePath("/rpkps");
  return { ok: true, pesan: `${baris.pengguna.nama} dilepas dari tim pengampu.` };
}

/**
 * Serah terima koordinator: yang lama turun menjadi ANGGOTA, yang baru naik.
 *
 * Tercatat di `rpkps_riwayat`, bukan hanya `log_audit` — pergantian penanggung
 * jawab adalah bagian riwayat dokumen yang dibaca Kaprodi.
 *
 * Yang TIDAK ikut berpindah: salinan beku. Nama pengampu di `rpkps_snapshot`
 * adalah nama saat pengesahan; memperbaruinya akan mengubah `proyeksiIsi()`
 * dan menggeser sidik SHA-256 seluruh dokumen terbit. Serah terima mengganti
 * siapa yang menyunting revisi BERIKUTNYA, bukan siapa yang menandatangani
 * yang sudah sah.
 */
export async function serahTerimaKoordinator(
  rpkpsId: string,
  penggunaId: string,
): Promise<Hasil> {
  const { bolehKelola, sesi } = await pastikanKelola(rpkpsId);
  if (!bolehKelola) return { ok: false, pesan: TOLAK_KELOLA };

  const rpkps = await prisma.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      versi: true,
      status: true,
      pengampu: {
        select: { penggunaId: true, peran: true, pengguna: { select: { nama: true } } },
      },
    },
  });
  if (!rpkps) return { ok: false, pesan: "RPKPS tidak ditemukan." };

  const calon = rpkps.pengampu.find((p) => p.penggunaId === penggunaId);
  if (!calon) {
    return {
      ok: false,
      pesan: "Tambahkan dosen tersebut ke tim pengampu lebih dulu, baru serahkan koordinasinya.",
    };
  }
  if (calon.peran === "KOORDINATOR") {
    return { ok: false, pesan: `${calon.pengguna.nama} sudah menjadi koordinator.` };
  }

  const lama = rpkps.pengampu.filter((p) => p.peran === "KOORDINATOR");

  await prisma.$transaction([
    prisma.rpkpsPengampu.updateMany({
      where: { rpkpsId, peran: "KOORDINATOR" },
      data: { peran: "ANGGOTA" },
    }),
    prisma.rpkpsPengampu.update({
      where: { rpkpsId_penggunaId: { rpkpsId, penggunaId } },
      data: { peran: "KOORDINATOR", urutan: 0 },
    }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId,
        versi: rpkps.versi,
        status: rpkps.status,
        deskripsi:
          lama.length > 0
            ? `Koordinasi diserahkan dari ${lama.map((p) => p.pengguna.nama).join(", ")} kepada ${calon.pengguna.nama}`
            : `Koordinasi diserahkan kepada ${calon.pengguna.nama}`,
        olehId: sesi.id,
      },
    }),
  ]);

  revalidatePath(`/rpkps/${rpkpsId}`);
  revalidatePath("/rpkps");
  return { ok: true, pesan: `${calon.pengguna.nama} kini koordinator RPKPS ini.` };
}

// ─────────────────────────────────────────────────────────────
// SALIN — docs/06 §3.5
// ─────────────────────────────────────────────────────────────

const SkemaSalin = z.object({
  mataKuliahId: z.string().min(1, "Mata kuliah tujuan wajib dipilih."),
  tahunAkademikId: z.string().min(1, "Tahun akademik tujuan wajib dipilih."),
});

/**
 * Menyalin isi sebuah RPKPS ke pasangan (mata kuliah, tahun akademik) lain.
 *
 * Yang TIDAK PERNAH ikut: `rpkps_snapshot`, `rpkps_riwayat`, `kelas`, nilai,
 * dan `evaluasi_mk`. Salinan lahir sebagai DRAF versi 1 dengan pemohon sebagai
 * koordinator; riwayatnya dimulai dari satu baris "Disalin dari …".
 *
 * Aturan yang paling mudah dilanggar ada pada Sub-CPMK. Sub-CPMK milik MATA
 * KULIAH, bukan milik RPKPS. Menyalin pemetaannya ke mata kuliah lain akan
 * menempelkan capaian milik MK lain ke pertemuan — persis yang dicegah
 * `saringSubCpmkMilikRpkps` pada jalur penyuntingan biasa. Karena itu:
 *
 *   - MK sama, TA berbeda  → pemetaan Sub-CPMK dan kisi-kisi ikut disalin.
 *   - MK berbeda           → pemetaan DILEPAS, kisi-kisi TIDAK disalin sama
 *                            sekali (`butir_kisi_kisi.sub_cpmk_id` wajib isi).
 *
 * Hasil salinan lintas MK memang perlu dipetakan ulang oleh dosen; panel
 * validasi akan menandainya sebagai pemblokir, dan itu perilaku yang benar.
 */
export async function salinRpkps(
  sumberId: string,
  masukan: z.input<typeof SkemaSalin>,
): Promise<Hasil> {
  const { bolehLihat, sesi } = await wenangRpkps(sumberId);
  if (!bolehLihat) return { ok: false, pesan: "Anda tidak berwenang atas RPKPS asal." };

  if (!punyaPeran(sesi, "ADMIN", "KAPRODI", "KOORDINATOR_MK", "DOSEN")) {
    return { ok: false, pesan: "Anda tidak berwenang membuat RPKPS." };
  }

  const urai = SkemaSalin.safeParse(masukan);
  if (!urai.success) {
    return { ok: false, pesan: urai.error.issues[0]?.message ?? "Masukan tidak sah." };
  }
  const { mataKuliahId, tahunAkademikId } = urai.data;

  const sumber = await prisma.rpkps.findUnique({
    where: { id: sumberId },
    include: {
      mataKuliah: { select: { id: true, kode: true } },
      tahunAkademik: { select: { kode: true } },
      pustaka: { orderBy: [{ jenis: "asc" }, { nomor: "asc" }] },
      komponenNilai: { orderBy: { urutan: "asc" } },
      pertemuan: {
        orderBy: { minggu: "asc" },
        include: {
          aktivitas: { orderBy: { urutan: "asc" } },
          indikator: { orderBy: { urutan: "asc" } },
          subCpmk: { select: { subCpmkId: true } },
          pustaka: { select: { pustakaId: true } },
          komponenNilai: { select: { nama: true } },
        },
      },
      tugas: {
        orderBy: { nomor: "asc" },
        include: {
          kriteria: { orderBy: { nomor: "asc" } },
          linimasa: { orderBy: { minggu: "asc" } },
          subCpmk: { select: { subCpmkId: true } },
          komponenNilai: { select: { nama: true } },
        },
      },
      kisiKisi: {
        orderBy: { jenis: "asc" },
        include: { butir: { orderBy: { nomor: "asc" } } },
      },
    },
  });
  if (!sumber) return { ok: false, pesan: "RPKPS asal tidak ditemukan." };

  const tujuan = await prisma.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    select: {
      kode: true,
      nama: true,
      kurikulum: { select: { prodiId: true, status: true } },
    },
  });
  if (!tujuan) return { ok: false, pesan: "Mata kuliah tujuan tidak ditemukan." };
  if (tujuan.kurikulum.status !== "BERLAKU") {
    return { ok: false, pesan: "Kurikulum mata kuliah tujuan belum berlaku." };
  }

  // Salin BUKAN jalur memindahkan isi antar prodi tanpa sepengetahuan Kaprodi.
  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(tujuan.kurikulum.prodiId)) {
    return { ok: false, pesan: "Anda tidak berwenang atas program studi tujuan." };
  }

  const ta = await prisma.tahunAkademik.findUnique({
    where: { id: tahunAkademikId },
    select: { kode: true },
  });
  if (!ta) return { ok: false, pesan: "Tahun akademik tujuan tidak ditemukan." };

  const bentrok = await prisma.rpkps.findFirst({
    where: { mataKuliahId, tahunAkademikId },
    select: { id: true },
  });
  if (bentrok) {
    return {
      ok: false,
      pesan: `${tujuan.kode} sudah punya RPKPS untuk ${ta.kode.replace("-", " ")}.`,
      id: bentrok.id,
    };
  }

  const mkSama = sumber.mataKuliah.id === mataKuliahId;
  const asal = `${sumber.mataKuliah.kode} ${sumber.tahunAkademik.kode.replace("-", " ")}`;

  const idBaru = await prisma.$transaction(async (tx) => {
    const baru = await tx.rpkps.create({
      data: {
        mataKuliahId,
        tahunAkademikId,
        status: "DRAF",
        versi: 1,
        deskripsi: sumber.deskripsi,
        kalimatPembukaCpmk: sumber.kalimatPembukaCpmk,
        ambangKelulusanMhs: sumber.ambangKelulusanMhs,
        ambangKetercapaianMk: sumber.ambangKetercapaianMk,
        minimalKehadiranPersen: sumber.minimalKehadiranPersen,
        pengampu: { create: { penggunaId: sesi.id, peran: "KOORDINATOR", urutan: 0 } },
      },
      select: { id: true },
    });

    // Pustaka dan komponen nilai lebih dulu: pertemuan dan tugas merujuk
    // keduanya, dan rujukan itu harus menunjuk ke baris SALINAN, bukan ke
    // baris milik RPKPS asal.
    const petaPustaka = new Map<string, string>();
    for (const p of sumber.pustaka) {
      const salinan = await tx.pustaka.create({
        data: {
          rpkpsId: baru.id,
          jenis: p.jenis,
          nomor: p.nomor,
          teks: p.teks,
          url: p.url,
          sumber: p.sumber,
        },
        select: { id: true },
      });
      petaPustaka.set(p.id, salinan.id);
    }

    const petaKomponen = new Map<string, string>();
    for (const k of sumber.komponenNilai) {
      const salinan = await tx.komponenNilai.create({
        data: { rpkpsId: baru.id, nama: k.nama, bobot: k.bobot, urutan: k.urutan },
        select: { id: true },
      });
      petaKomponen.set(k.id, salinan.id);
    }

    for (const p of sumber.pertemuan) {
      await tx.pertemuan.create({
        data: {
          rpkpsId: baru.id,
          minggu: p.minggu,
          jenis: p.jenis,
          topik: p.topik,
          subtopik: p.subtopik,
          metodeNarasi: p.metodeNarasi,
          aktivitasDosen: p.aktivitasDosen,
          aktivitasMahasiswa: p.aktivitasMahasiswa,
          tugasTerstruktur: p.tugasTerstruktur,
          penilaianJenis: p.penilaianJenis,
          penilaianSistem: p.penilaianSistem,
          bobot: p.bobot,
          sumber: p.sumber,
          komponenNilaiId: p.komponenNilaiId
            ? (petaKomponen.get(p.komponenNilaiId) ?? null)
            : null,
          aktivitas: {
            create: p.aktivitas.map((a) => ({
              nama: a.nama,
              kategori: a.kategori,
              menit: a.menit,
              urutan: a.urutan,
            })),
          },
          indikator: {
            create: p.indikator.map((i) => ({ teks: i.teks, urutan: i.urutan })),
          },
          pustaka: {
            create: p.pustaka
              .map((x) => petaPustaka.get(x.pustakaId))
              .filter((id): id is string => id !== undefined)
              .map((pustakaId) => ({ pustakaId })),
          },
          // Sub-CPMK hanya ikut bila mata kuliahnya sama. Lihat komentar di
          // atas: capaian milik MK lain tidak boleh menempel di sini.
          ...(mkSama && p.subCpmk.length > 0
            ? { subCpmk: { create: p.subCpmk.map((s) => ({ subCpmkId: s.subCpmkId })) } }
            : {}),
        },
      });
    }

    for (const t of sumber.tugas) {
      await tx.tugas.create({
        data: {
          rpkpsId: baru.id,
          nomor: t.nomor,
          nama: t.nama,
          jenis: t.jenis,
          mingguMulai: t.mingguMulai,
          mingguSelesai: t.mingguSelesai,
          bobot: t.bobot,
          deskripsi: t.deskripsi,
          uraianTugas: t.uraianTugas,
          formatLuaran: t.formatLuaran,
          ketentuanLain: t.ketentuanLain,
          sumber: t.sumber,
          komponenNilaiId: t.komponenNilaiId
            ? (petaKomponen.get(t.komponenNilaiId) ?? null)
            : null,
          kriteria: {
            create: t.kriteria.map((k) => ({
              nomor: k.nomor,
              indikator: k.indikator,
              bobot: k.bobot,
            })),
          },
          linimasa: {
            create: t.linimasa.map((l) => ({
              minggu: l.minggu,
              tahapan: l.tahapan,
              aktivitas: l.aktivitas,
            })),
          },
          ...(mkSama && t.subCpmk.length > 0
            ? { subCpmk: { create: t.subCpmk.map((s) => ({ subCpmkId: s.subCpmkId })) } }
            : {}),
        },
      });
    }

    // Kisi-kisi hanya untuk MK yang sama: `butir_kisi_kisi.sub_cpmk_id` wajib
    // isi, sehingga butir tidak punya bentuk yang sah di mata kuliah lain.
    if (mkSama) {
      for (const k of sumber.kisiKisi) {
        await tx.kisiKisi.create({
          data: {
            rpkpsId: baru.id,
            jenis: k.jenis,
            totalSkor: k.totalSkor,
            durasiMenit: k.durasiMenit,
            catatan: k.catatan,
            sumber: k.sumber,
            butir: {
              create: k.butir.map((b) => ({
                nomor: b.nomor,
                subCpmkId: b.subCpmkId,
                levelBloom: b.levelBloom,
                bentuk: b.bentuk,
                jumlahButir: b.jumlahButir,
                skor: b.skor,
                indikator: b.indikator,
              })),
            },
          },
        });
      }
    }

    await tx.rpkpsRiwayat.create({
      data: {
        rpkpsId: baru.id,
        versi: 1,
        status: "DRAF",
        deskripsi: mkSama
          ? `Disalin dari ${asal}`
          : `Disalin dari ${asal}; pemetaan Sub-CPMK dan kisi-kisi tidak ikut karena mata kuliahnya berbeda`,
        olehId: sesi.id,
      },
    });

    await tx.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "RPKPS_DISALIN",
        entitas: "rpkps",
        entitasId: baru.id,
        ringkasan: `${sesi.email} menyalin ${asal} ke ${tujuan.kode} ${ta.kode}`,
        data: { sumberId, mataKuliahSama: mkSama } satisfies Prisma.InputJsonValue,
      },
    });

    return baru.id;
  });

  revalidatePath("/rpkps");
  return {
    ok: true,
    pesan: mkSama
      ? `Disalin ke ${tujuan.kode} ${ta.kode.replace("-", " ")}.`
      : `Disalin ke ${tujuan.kode} ${ta.kode.replace("-", " ")}. Pemetaan Sub-CPMK dan kisi-kisi tidak ikut — petakan ulang sebelum diajukan.`,
    id: idBaru,
  };
}
