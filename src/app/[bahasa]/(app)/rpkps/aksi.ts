"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, punyaPeran, punyaPeranDiProdi, wajibPeran } from "@/lib/otorisasi";
import { pesanTerkunci, wenangRpkps } from "@/lib/rpkps/wenang";
import {
  muatKebijakan,
  muatRpkps,
  keRpkpsInput,
  saringSubCpmkMilikRpkps,
} from "@/lib/rpkps/muat";
import { bekukanRpkps, sidikRpkps } from "@/lib/rpkps/snapshot";
import { susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { rancangKerangkaMingguan } from "@/domain/rpkps/kerangka";
import { tulisKerangka } from "@/lib/rpkps/kerangka";
import { validasiRpkps } from "@/domain/rpkps/validator";
import { periksaKesegaran, pesanTertimpa } from "@/domain/rpkps/kunci-optimistik";
import { tulisKomponenNilai } from "@/lib/rpkps/komponen-inti";
import { koordinatorTertugas } from "@/lib/kurikulum/koordinator";
import { susunPengampuAwal } from "@/domain/kurikulum/koordinator";
import {
  kirimNotifikasi,
  penerimaKaprodi,
  penerimaPengampu,
  penerimaPengelola,
  penerimaPenjaminanMutu,
} from "@/lib/notifikasi/kirim";
import type { PeranTtd } from "@/generated/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import type { Kamus } from "@/kamus";
import { MIN_CATATAN_REVISI } from "@/domain/rpkps/tipe";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod, telusuriKamus } from "@/lib/bahasa/zod";
import { teksTemuan } from "@/lib/bahasa/temuan";
import { riwayat } from "@/domain/rpkps/riwayat";
import { barisRiwayat } from "@/lib/rpkps/riwayat";
import { kelengkapanRpkps } from "@/lib/rpkps/terjemahan";

export type Hasil = { ok: boolean; pesan: string; id?: string };

/** Memastikan pengguna berwenang atas RPKPS tertentu. Aturannya di lib/rpkps/wenang.ts. */
const pastikanWenang = wenangRpkps;

/**
 * Membuat RPKPS baru dan, secara bawaan, langsung MENYUSUN KERANGKANYA:
 * 16 pertemuan bernomor, minggu ujian di posisi yang benar, alokasi waktu
 * terisi sesuai pagu, dan Sub-CPMK dari kurikulum tersebar berurutan.
 *
 * Ini yang menghilangkan "halaman kosong" — hambatan terbesar dosen. Dosen
 * mulai dari kerangka yang sudah konsisten, bukan dari tabel kosong.
 *
 * `kerangka: "KOSONG"` melewatkannya untuk dosen yang memang ingin menyusun
 * tabelnya sendiri dari nol (docs/09 §K7). Kerangka tetap dapat dipanggil
 * belakangan lewat `susunUlangKerangka`.
 */
export async function buatRpkps(
  mataKuliahId: string,
  tahunAkademikId: string,
  kerangka: "OTOMATIS" | "KOSONG" = "OTOMATIS",
): Promise<Hasil> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("ADMIN", "KAPRODI", "KOORDINATOR_MK", "DOSEN");

  const mk = await prisma.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    include: {
      kurikulum: { select: { prodiId: true, status: true } },
      cpmk: { orderBy: { urutan: "asc" }, include: { subCpmk: { orderBy: { urutan: "asc" } } } },
    },
  });
  if (!mk) return { ok: false, pesan: kam.aksi.takAda.mataKuliah };

  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(mk.kurikulum.prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.atasProdi };
  }

  const sudahAda = await prisma.rpkps.findFirst({
    where: { mataKuliahId, tahunAkademikId },
    select: { id: true },
  });
  if (sudahAda) {
    return { ok: false, pesan: kam.aksi.rpkps.sudahAda, id: sudahAda.id };
  }

  /**
   * Koordinator RPKPS ini datang dari PENUGASAN mata kuliah, bukan dari siapa
   * yang menekan tombolnya (docs/13 §2.3). Tanpa ini, staf prodi yang membantu
   * menyiapkan sepuluh dokumen menjadi penanggung jawab kesepuluhnya.
   */
  const tertugas = await koordinatorTertugas(mataKuliahId, tahunAkademikId);
  const pengampuAwal = susunPengampuAwal(sesi.id, tertugas);

  const { kebijakan } = await muatKebijakan();
  const rencana = susunRencanaSemester(kebijakan, {
    sksTeori: mk.sksTeori,
    sksPraktik: mk.sksPraktik,
    bentukTeori: mk.bentukTeori,
    bentukPraktik: mk.bentukPraktik,
  });

  const semuaSubCpmk = mk.cpmk.flatMap((c) => c.subCpmk);
  const baris =
    kerangka === "KOSONG"
      ? []
      : rancangKerangkaMingguan(
          rencana,
          kebijakan,
          semuaSubCpmk.map((s) => s.id),
        );

  const id = await prisma.$transaction(async (tx) => {
    const rpkps = await tx.rpkps.create({
      data: {
        mataKuliahId,
        tahunAkademikId,
        status: "DRAF",
        deskripsi: mk.deskripsi,
        pengampu: { create: pengampuAwal },
        komponenNilai: {
          create: [
            { nama: "Ujian Tengah Semester", bobot: 15, urutan: 0 },
            { nama: "Ujian Akhir Semester", bobot: 20, urutan: 1 },
            { nama: "Kehadiran / Kuis", bobot: 10, urutan: 2 },
            { nama: "Praktik / Tugas", bobot: 30, urutan: 3 },
            { nama: "Presentasi", bobot: 15, urutan: 4 },
            { nama: "Tugas Kelompok", bobot: 10, urutan: 5 },
          ],
        },
      },
      select: { id: true },
    });

    await tulisKerangka(tx, rpkps.id, baris);

    await tx.rpkpsRiwayat.create({
      data: {
        rpkpsId: rpkps.id,
        versi: 1,
        status: "DRAF",
        ...barisRiwayat(
          kerangka === "KOSONG"
            ? riwayat("DIBUAT_KOSONG")
            : riwayat("DIBUAT_KERANGKA", {
                pertemuan: baris.length,
                subCpmk: semuaSubCpmk.length,
              }),
        ),
        olehId: sesi.id,
      },
    });

    await tx.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "RPKPS_DIBUAT",
        entitas: "rpkps",
        entitasId: rpkps.id,
        ringkasan: `${sesi.email} membuat RPKPS ${mk.kode}`,
      },
    });

    return rpkps.id;
  });

  // Pemegang penugasan diberi kabar: dokumen yang lahir atas namanya tanpa ia
  // ketahui adalah dokumen yang baru ditemukan saat tenggat lewat.
  if (tertugas !== null && tertugas !== sesi.id) {
    const ta = await prisma.tahunAkademik.findUnique({
      where: { id: tahunAkademikId },
      select: { kode: true },
    });
    await kirimNotifikasi(
      [tertugas],
      {
        jenis: "RPKPS_PENGAMPU",
        rpkpsId: id,
        mk: `${mk.kode} ${mk.nama}`,
        ta: ta?.kode.replace("-", " ") ?? "",
        oleh: sesi.namaLengkap,
        peran: "KOORDINATOR",
      },
      sesi.id,
    );
  }

  segarkan("/rpkps");
  const dasar =
    kerangka === "KOSONG"
      ? kam.aksi.rpkps.dibuatKosong
      : kam.aksi.rpkps.dibuatKerangka;

  return {
    ok: true,
    pesan:
      tertugas !== null && tertugas !== sesi.id
        ? `${dasar} Koordinatornya mengikuti penugasan mata kuliah; Anda tercatat sebagai anggota tim pengampu.`
        : dasar,
    id,
  };
}

const SkemaIdentitas = z.object({
  deskripsi: z.string().trim().max(4000).nullable(),
  deskripsiEn: z.string().trim().max(4000).nullable(),
  kalimatPembukaCpmk: z.string().trim().max(1000).nullable(),
  kalimatPembukaCpmkEn: z.string().trim().max(1000).nullable(),
  ambangKelulusanMhs: z.number().min(0).max(100),
  ambangKetercapaianMk: z.number().min(0).max(100),
  minimalKehadiranPersen: z.number().int().min(0).max(100),
});

export async function perbaruiIdentitas(id: string, data: FormData): Promise<Hasil> {
  const kam = await kamusAksi();
  const { boleh, bolehSunting, status, sesi } = await pastikanWenang(id);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.ubahRpkps };
  if (!bolehSunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const kosongJadiNull = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };

  const parsed = SkemaIdentitas.safeParse({
    deskripsi: kosongJadiNull(data.get("deskripsi")),
    deskripsiEn: kosongJadiNull(data.get("deskripsiEn")),
    kalimatPembukaCpmk: kosongJadiNull(data.get("kalimatPembukaCpmk")),
    kalimatPembukaCpmkEn: kosongJadiNull(data.get("kalimatPembukaCpmkEn")),
    ambangKelulusanMhs: Number(data.get("ambangKelulusanMhs")),
    ambangKetercapaianMk: Number(data.get("ambangKetercapaianMk")),
    minimalKehadiranPersen: Number(data.get("minimalKehadiranPersen")),
  });
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }

  await prisma.rpkps.update({ where: { id }, data: parsed.data });
  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "RPKPS_DIPERBARUI",
      entitas: "rpkps",
      entitasId: id,
      ringkasan: `${sesi.email} memperbarui identitas RPKPS`,
    },
  });

  segarkan(`/rpkps/${id}`);
  return { ok: true, pesan: kam.aksi.umum.tersimpan };
}

/**
 * Medan berbahasa Inggris WAJIB ikut dalam muatan simpan.
 *
 * Penyimpanan ini mengganti seluruh isi baris. Kalau `*En` tidak ikut, dosen
 * yang menyunting tab Indonesia akan menghapus terjemahan rekannya tanpa satu
 * pesan pun — kegagalan senyap dengan bentuk persis sama seperti hilangnya id
 * `komponen_nilai` (docs/11 §5.3). Karena itu tidak ada "simpan hanya bahasa
 * Inggris": penyunting selalu mengirim kedua bahasa dalam satu muatan, di
 * bawah satu cap versi, dalam satu transaksi.
 */
const SkemaPertemuan = z.object({
  topik: z.string().trim().max(500).nullable(),
  topikEn: z.string().trim().max(500).nullable(),
  subtopik: z.array(z.string().trim().min(1)).max(30),
  subtopikEn: z.array(z.string().trim()).max(30),
  metodeNarasi: z.string().trim().max(4000).nullable(),
  metodeNarasiEn: z.string().trim().max(4000).nullable(),
  aktivitasDosen: z.string().trim().max(2000).nullable(),
  aktivitasDosenEn: z.string().trim().max(2000).nullable(),
  aktivitasMahasiswa: z.string().trim().max(2000).nullable(),
  aktivitasMahasiswaEn: z.string().trim().max(2000).nullable(),
  tugasTerstruktur: z.string().trim().max(2000).nullable(),
  tugasTerstrukturEn: z.string().trim().max(2000).nullable(),
  penilaianJenis: z.string().trim().max(500).nullable(),
  penilaianJenisEn: z.string().trim().max(500).nullable(),
  penilaianSistem: z.string().trim().max(1000).nullable(),
  penilaianSistemEn: z.string().trim().max(1000).nullable(),
  bobot: z.number().min(0).max(100),
  /// Komponen nilai yang menampung bobot pertemuan ini. Dipakai untuk
  /// menyusun tabel distribusi penilaian (bagian E template ITTS).
  komponenNilaiId: z.string().nullable(),
  subCpmkId: z.array(z.string()).max(10),
  indikator: z
    .array(z.object({ teks: z.string().trim().min(1), teksEn: z.string().trim().nullable() }))
    .max(20),
  aktivitas: z
    .array(
      z.object({
        nama: z.string().trim().min(1),
        namaEn: z.string().trim().nullable(),
        kategori: z.enum(["TM", "PT", "BM"]),
        menit: z.number().int().min(0).max(2000),
      }),
    )
    .max(30),
  pustakaId: z.array(z.string()).max(20),
});

export type IsiPertemuan = z.infer<typeof SkemaPertemuan>;

export async function simpanPertemuan(
  pertemuanId: string,
  isi: IsiPertemuan,
  /**
   * Cap `diubahPada` baris ini saat penyunting membukanya. RPKPS disunting
   * beramai-ramai (tim pengampu, koordinator, Kaprodi), dan penyimpanan ini
   * mengganti SELURUH isi baris — tanpa cap, dua orang pada minggu yang sama
   * saling menimpa tanpa gejala.
   */
  capVersi?: string | null,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: pertemuanId },
    select: { id: true, rpkpsId: true, minggu: true },
  });
  if (!pertemuan) return { ok: false, pesan: kam.aksi.takAda.pertemuan };

  const sebutan = `Minggu ${pertemuan.minggu}`;
  const kesegaran = periksaKesegaran(capVersi, sebutan);
  if (!kesegaran.segar) return { ok: false, pesan: kesegaran.pesan };

  const { boleh, bolehSunting, status, sesi } = await pastikanWenang(pertemuan.rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.ubahRpkps };
  if (!bolehSunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const parsed = SkemaPertemuan.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, kam, kam.aksi.umum.dataTidakValid) };
  }
  const d = parsed.data;

  // Sub-CPMK harus benar-benar milik mata kuliah ini — data dari klien
  // tidak dipercaya begitu saja.
  const { sah: subCpmkSah, asing } = await saringSubCpmkMilikRpkps(
    pertemuan.rpkpsId,
    d.subCpmkId,
  );
  if (asing.length > 0) {
    return { ok: false, pesan: kam.aksi.tugas.subDiLuarMk };
  }

  // Anak-anak pertemuan diganti seluruhnya, bukan di-diff: jumlahnya kecil dan
  // penggantian utuh menghindari kondisi balapan saat dua tab terbuka.
  //
  // Baris induknya ditulis lewat `updateMany` dengan cap versi ikut di `where`
  // — bukan dibaca lalu dibandingkan lebih dulu. Dengan begitu pemeriksaan dan
  // penulisan menjadi SATU pernyataan yang tidak dapat disela: bila ada yang
  // menyimpan lebih dahulu, `count` bernilai 0 dan tidak satu pun anak baris
  // tersentuh.
  const menang = await prisma.$transaction(async (tx) => {
    const hasil = await tx.pertemuan.updateMany({
      where: { id: pertemuanId, diubahPada: kesegaran.cap },
      data: {
        topik: d.topik,
        topikEn: d.topikEn,
        subtopik: d.subtopik,
        subtopikEn: d.subtopikEn,
        metodeNarasi: d.metodeNarasi,
        metodeNarasiEn: d.metodeNarasiEn,
        aktivitasDosen: d.aktivitasDosen,
        aktivitasDosenEn: d.aktivitasDosenEn,
        aktivitasMahasiswa: d.aktivitasMahasiswa,
        aktivitasMahasiswaEn: d.aktivitasMahasiswaEn,
        tugasTerstruktur: d.tugasTerstruktur,
        tugasTerstrukturEn: d.tugasTerstrukturEn,
        penilaianJenis: d.penilaianJenis,
        penilaianJenisEn: d.penilaianJenisEn,
        penilaianSistem: d.penilaianSistem,
        penilaianSistemEn: d.penilaianSistemEn,
        bobot: d.bobot,
        komponenNilaiId: d.komponenNilaiId,
      },
    });
    if (hasil.count === 0) return false;

    await tx.aktivitasBelajar.deleteMany({ where: { pertemuanId } });
    await tx.aktivitasBelajar.createMany({
      data: d.aktivitas.map((a, i) => ({
        pertemuanId,
        nama: a.nama,
        namaEn: a.namaEn,
        kategori: a.kategori,
        menit: a.menit,
        urutan: i,
      })),
    });
    await tx.indikator.deleteMany({ where: { pertemuanId } });
    await tx.indikator.createMany({
      data: d.indikator.map((x, i) => ({
        pertemuanId,
        teks: x.teks,
        teksEn: x.teksEn,
        urutan: i,
      })),
    });
    await tx.pertemuanSubCpmk.deleteMany({ where: { pertemuanId } });
    await tx.pertemuanSubCpmk.createMany({
      data: subCpmkSah.map((subCpmkId) => ({ pertemuanId, subCpmkId })),
    });
    await tx.pertemuanPustaka.deleteMany({ where: { pertemuanId } });
    await tx.pertemuanPustaka.createMany({
      data: d.pustakaId.map((pustakaId) => ({ pertemuanId, pustakaId })),
    });
    return true;
  });

  if (!menang) return { ok: false, pesan: pesanTertimpa(sebutan) };

  await prisma.logAudit.create({
    data: {
      penggunaId: sesi.id,
      aksi: "PERTEMUAN_DISIMPAN",
      entitas: "pertemuan",
      entitasId: pertemuanId,
      ringkasan: `${sesi.email} menyimpan minggu ${pertemuan.minggu}`,
    },
  });

  segarkan(`/rpkps/${pertemuan.rpkpsId}`);
  segarkan(`/rpkps/${pertemuan.rpkpsId}/mingguan`);
  return { ok: true, pesan: sisip(kam.aksi.mingguan.tersimpan, { minggu: pertemuan.minggu }) };
}

export async function tambahPustaka(
  rpkpsId: string,
  jenis: "UTAMA" | "PENDUKUNG" | "DARING" | "TOOLS",
  teks: string,
  url?: string,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const { boleh, bolehSunting, status } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.umum };
  if (!bolehSunting) return { ok: false, pesan: pesanTerkunci(status, kam) };
  if (teks.trim().length < 5) return { ok: false, pesan: kam.aksi.pustaka.teksTerlaluPendek };

  const terakhir = await prisma.pustaka.findFirst({
    where: { rpkpsId, jenis },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });

  await prisma.pustaka.create({
    data: {
      rpkpsId,
      jenis,
      nomor: (terakhir?.nomor ?? 0) + 1,
      teks: teks.trim(),
      url: url?.trim() || null,
    },
  });

  segarkan(`/rpkps/${rpkpsId}`);
  return { ok: true, pesan: kam.aksi.pustaka.ditambahkan };
}

export async function hapusPustaka(pustakaId: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const p = await prisma.pustaka.findUnique({
    where: { id: pustakaId },
    select: { id: true, rpkpsId: true },
  });
  if (!p) return { ok: false, pesan: kam.aksi.takAda.pustaka };

  const { boleh, bolehSunting, status } = await pastikanWenang(p.rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.umum };
  if (!bolehSunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  await prisma.pustaka.delete({ where: { id: pustakaId } });
  segarkan(`/rpkps/${p.rpkpsId}`);
  return { ok: true, pesan: kam.aksi.pustaka.dihapus };
}

/**
 * Menyimpan daftar komponen nilai dengan mempertahankan identitas barisnya.
 *
 * Yang dikirim formulir adalah id tiap baris, bukan sekadar nama dan bobot:
 * tanpa id, mengganti nama sebuah komponen tidak dapat dibedakan dari membuang
 * yang lama lalu menambah yang baru — dan bedanya besar, karena `pertemuan`
 * serta `tugas` menunjuk komponen lewat id yang ber-`onDelete: SetNull`.
 * Penulisannya di `lib/rpkps/komponen-inti.ts`, yang diuji terhadap Postgres.
 */
export async function simpanKomponenNilai(
  rpkpsId: string,
  komponen: { id: string | null; nama: string; namaEn: string | null; bobot: number }[],
): Promise<Hasil> {
  const kam = await kamusAksi();
  const { boleh, bolehSunting, status } = await pastikanWenang(rpkpsId);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.umum };
  if (!bolehSunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const hasil = await tulisKomponenNilai(prisma, rpkpsId, komponen);
  if (!hasil.ok) {
    // `galat` adalah kunci kamus, bukan kalimat — domain tidak berbahasa.
    return {
      ok: false,
      pesan:
        telusuriKamus(kam, hasil.galat.replace(/^@/, "")) ?? kam.aksi.umum.dataTidakValid,
    };
  }

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan(`/rpkps/${rpkpsId}/mingguan`);
  segarkan(`/rpkps/${rpkpsId}/asesmen`);

  const terdampak = [
    hasil.lepasPertemuan > 0 ? `${hasil.lepasPertemuan} baris mingguan` : null,
    hasil.lepasTugas > 0 ? `${hasil.lepasTugas} lembar tugas` : null,
  ].filter((x): x is string => x !== null);

  return {
    ok: true,
    pesan:
      terdampak.length > 0
        ? sisip(kam.aksi.lain.komponenTersimpanLepas, {
            terdampak: terdampak.join(" dan "),
          })
        : kam.aksi.lain.komponenTersimpan,
  };
}

// ─────────────────────────────────────────────────────────────
// RANTAI PENGESAHAN — docs/14 §2
//
// Empat cap berurutan, persis seperti Halaman Pengesahan template ITTS:
//
//   paraf tiap pengampu
//     → koordinator  "a.n Tim penyusun RPKPS"          → DIAJUKAN
//     → Ketua Prodi  "Disetujui oleh,"                 → DISETUJUI
//     → Kepala PMI   "Telah diperiksa dan dinyatakan
//                     sesuai dengan standar ITTS"      → TERBIT
//
// Cap terakhir itulah yang MENERBITKAN dokumen, bukan persetujuan Kaprodi —
// dan di situ pula isinya dibekukan. Menyatukan keduanya seperti dulu berarti
// kolom ketiga halaman pengesahan selamanya kosong: dokumen resmi yang
// menyatakan telah diperiksa Penjaminan Mutu, padahal Penjaminan Mutu tidak
// pernah membukanya.
// ─────────────────────────────────────────────────────────────

/**
 * Nama dan identitas dibekukan apa adanya saat menandatangani. Alasannya sama
 * dengan nama pengampu pada `rpkps_snapshot`: memperbarui nama yang sudah
 * tercetak pada dokumen resmi menggeser dokumen itu sendiri.
 */
function capPenandaTangan(sesi: { namaLengkap: string; nidn: string | null; nip: string | null }) {
  return { nama: sesi.namaLengkap, identitas: sesi.nidn ?? sesi.nip ?? null };
}

/**
 * Memuat dokumen beserta sidik isinya saat ini.
 *
 * Sidik dihitung dari data langsung, bukan dari salinan beku — itulah yang
 * membuatnya berguna: ia ikut bergerak bila kurikulum di bawahnya berubah di
 * sela-sela rantai.
 */
async function muatDenganSidik(id: string) {
  const rpkps = await muatRpkps(id);
  if (!rpkps) return null;
  return { rpkps, sidik: sidikRpkps(rpkps) };
}

/**
 * Cap yang sudah turun pada ronde berjalan harus mencap ISI YANG SAMA.
 *
 * Bukan kasus hipotetis: penyuntingan memang sudah terkunci begitu dokumen
 * diajukan, tetapi isi masih dapat bergeser dari arah lain — revisi kurikulum
 * yang berlaku di sela rantai mengubah CPL/CPMK/Sub-CPMK yang ikut masuk
 * `proyeksiIsi`. Tanpa pemeriksaan ini, Kaprodi menandatangani dokumen A dan
 * Penjaminan Mutu mengesahkan dokumen B.
 */
function periksaSidikCap(
  tandaTangan: readonly { versi: number; peran: PeranTtd; sidik: string }[],
  versi: number,
  sidikSekarang: string,
  kam: Kamus,
): { cocok: true } | { cocok: false; pesan: string } {
  const bergeser = tandaTangan.some(
    (t) => t.versi === versi && t.peran !== "PENGAMPU" && t.sidik !== sidikSekarang,
  );
  if (!bergeser) return { cocok: true };
  return {
    cocok: false,
    pesan: kam.aksi.rpkps.sidikBergeser,
  };
}

/**
 * Paraf seorang pengampu pada halaman pengesahan (docs/14 §2.2).
 *
 * Bukan sekadar tombol setuju: yang dicatat adalah sidik isi yang diparaf,
 * sehingga paraf atas rencana yang kemudian diganti rekan setim tidak lagi
 * dihitung. Memaraf ulang setelah perubahan cukup menekan tombol yang sama.
 */
export async function parafPengampu(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { pengampu, bolehSunting, status, sesi } = await pastikanWenang(id);
  if (!pengampu) {
    return { ok: false, pesan: kam.aksi.wenang.hanyaPengampuParaf };
  }
  if (!bolehSunting) return { ok: false, pesan: pesanTerkunci(status, kam) };

  const dokumen = await muatDenganSidik(id);
  if (!dokumen) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const kunci = {
    rpkpsId_versi_peran_penggunaId: {
      rpkpsId: id,
      versi: dokumen.rpkps.versi,
      peran: "PENGAMPU" as const,
      penggunaId: sesi.id,
    },
  };
  const cap = { ...capPenandaTangan(sesi), sidik: dokumen.sidik };

  await prisma.tandaTanganRpkps.upsert({
    where: kunci,
    update: { ...cap, ditandatanganiPada: new Date() },
    create: {
      rpkpsId: id,
      versi: dokumen.rpkps.versi,
      peran: "PENGAMPU",
      penggunaId: sesi.id,
      ...cap,
    },
  });

  segarkan(`/rpkps/${id}`);
  return { ok: true, pesan: kam.aksi.rpkps.parafTercatat };
}

/**
 * Mengajukan RPKPS untuk disetujui — sekaligus membubuhkan cap koordinator
 * "a.n Tim penyusun RPKPS". Divalidasi ulang di server.
 *
 * Hanya KOORDINATOR, bukan sembarang pengampu maupun pengelola prodi: kolom
 * yang ditandatangani berbunyi "Koordinator Mata Kuliah", dan yang
 * menandatanganinya harus koordinator mata kuliah itu.
 */
export async function ajukanRpkps(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { boleh, koordinator, sesi, prodiId } = await pastikanWenang(id);
  if (!boleh) return { ok: false, pesan: kam.aksi.wenang.umum };
  if (!koordinator) {
    return {
      ok: false,
      pesan:
        kam.aksi.rpkps.hanyaKoordinatorAjukan,
    };
  }

  const dokumen = await muatDenganSidik(id);
  if (!dokumen) return { ok: false, pesan: kam.aksi.takAda.rpkps };
  const { rpkps, sidik } = dokumen;

  if (rpkps.status !== "DRAF" && rpkps.status !== "DIREVISI") {
    return { ok: false, pesan: kam.aksi.rpkps.sudahDiajukan };
  }

  const { kebijakan } = await muatKebijakan();
  const hasil = validasiRpkps(
    {
      ...keRpkpsInput({ ...rpkps, sidikSekarang: sidik }),
      terjemahanSebagian: kelengkapanRpkps(rpkps).sebagian,
    },
    kebijakan,
  );
  if (!hasil.lolos) {
    const paraf = hasil.pemblokir.find((t) => t.kode === "B-PARAF-BELUM-LENGKAP");
    return {
      ok: false,
      // Paraf yang kurang disebut apa adanya: itu satu-satunya pemblokir yang
      // tidak dapat diselesaikan sendiri oleh yang menekan tombol.
      pesan: paraf
        ? teksTemuan(paraf, kam).pesan
        : sisip(kam.aksi.lain.masihAdaPemblokir, { n: hasil.pemblokir.length }),
    };
  }

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status: "DIAJUKAN" } }),
    prisma.tandaTanganRpkps.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        peran: "KOORDINATOR",
        penggunaId: sesi.id,
        ...capPenandaTangan(sesi),
        sidik,
      },
    }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status: "DIAJUKAN",
        ...barisRiwayat(riwayat("DIPARAF_KOORDINATOR", { sidik: sidik.slice(0, 16) })),
        olehId: sesi.id,
      },
    }),
  ]);

  // Di luar transaksi: kabar tentang perubahan yang gagal disimpan lebih buruk
  // daripada tidak ada kabar sama sekali.
  if (prodiId) {
    await kirimNotifikasi(
      await penerimaPengelola(prodiId),
      {
        jenis: "RPKPS_DIAJUKAN",
        rpkpsId: id,
        mk: `${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama}`,
        ta: rpkps.tahunAkademik.kode.replace("-", " "),
        oleh: sesi.namaLengkap,
      },
      sesi.id,
    );
  }

  segarkan(`/rpkps/${id}`);
  segarkan("/rpkps");
  return { ok: true, pesan: kam.aksi.rpkps.diajukan };
}

/**
 * Cap kedua: Ketua Program Studi, "Disetujui oleh,".
 *
 * `punyaPeranDiProdi(…, "KAPRODI")` — bukan `wenang.pengelola`. Untuk sebuah
 * tombol keputusan, menerima ADMIN dan GPM masuk akal; untuk sebuah TANDA
 * TANGAN tidak — kolomnya berbunyi "Ketua Program Studi". Admin tetap dapat
 * membaca, mengarsipkan, dan membetulkan data; Admin tidak menandatangani.
 */
export async function setujuiRpkps(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { sesi, prodiId, dalamCakupan } = await pastikanWenang(id);
  if (!prodiId) return { ok: false, pesan: kam.aksi.takAda.rpkps };
  if (!dalamCakupan || !punyaPeranDiProdi(sesi, prodiId, "KAPRODI")) {
    return { ok: false, pesan: kam.aksi.wenang.hanyaKaprodiIni };
  }

  const dokumen = await muatDenganSidik(id);
  if (!dokumen) return { ok: false, pesan: kam.aksi.takAda.rpkps };
  const { rpkps, sidik } = dokumen;

  if (rpkps.status !== "DIAJUKAN") {
    return { ok: false, pesan: kam.aksi.rpkps.hanyaDiajukanDisetujui };
  }

  const sidikCocok = periksaSidikCap(rpkps.tandaTangan, rpkps.versi, sidik, kam);
  if (!sidikCocok.cocok) return { ok: false, pesan: sidikCocok.pesan };

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status: "DISETUJUI" } }),
    prisma.tandaTanganRpkps.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        peran: "KAPRODI",
        penggunaId: sesi.id,
        ...capPenandaTangan(sesi),
        sidik,
      },
    }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status: "DISETUJUI",
        ...barisRiwayat(riwayat("DISETUJUI_KAPRODI", { sidik: sidik.slice(0, 16) })),
        olehId: sesi.id,
      },
    }),
  ]);

  const sasaran = {
    rpkpsId: id,
    mk: `${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama}`,
    ta: rpkps.tahunAkademik.kode.replace("-", " "),
    oleh: sesi.namaLengkap,
  };
  await kirimNotifikasi(await penerimaPengampu(id), { jenis: "RPKPS_DISETUJUI", ...sasaran }, sesi.id);
  await kirimNotifikasi(
    await penerimaPenjaminanMutu(),
    {
      jenis: "RPKPS_MENUNGGU_PENGESAHAN",
      ...sasaran,
      prodi: rpkps.mataKuliah.kurikulum.prodi.nama,
    },
    sesi.id,
  );

  segarkan(`/rpkps/${id}`);
  segarkan("/rpkps");
  return {
    ok: true,
    pesan: kam.aksi.rpkps.disetujui,
  };
}

/**
 * Cap terakhir: Kepala Penjaminan Mutu, "Telah diperiksa dan dinyatakan sesuai
 * dengan standar ITTS" — dan hanya di sinilah dokumen terbit serta isinya
 * dibekukan.
 *
 * Peran GPM boleh dipegang lebih dari satu orang, dan siapa pun pemegangnya
 * dapat mengesahkan; nama yang tercetak adalah nama yang benar-benar
 * menandatangani. Itu jawaban yang cukup untuk Kepala PMI yang sedang cuti,
 * tanpa model pelaksana tugas tersendiri.
 */
export async function sahkanRpkps(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const sesi = await wajibPeran("GPM");

  const dokumen = await muatDenganSidik(id);
  if (!dokumen) return { ok: false, pesan: kam.aksi.takAda.rpkps };
  const { rpkps, sidik } = dokumen;

  if (rpkps.status !== "DISETUJUI") {
    return {
      ok: false,
      pesan: kam.aksi.rpkps.hanyaDisetujuiDisahkan,
    };
  }

  const sidikCocok = periksaSidikCap(rpkps.tandaTangan, rpkps.versi, sidik, kam);
  if (!sidikCocok.cocok) return { ok: false, pesan: sidikCocok.pesan };

  // Membekukan isi dokumen SEBELUM status berubah. Setelah ini, perubahan pada
  // kurikulum tidak lagi mengubah berkas yang sudah disahkan.
  const beku = await bekukanRpkps(rpkps, sesi.id);

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status: "TERBIT" } }),
    prisma.tandaTanganRpkps.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        peran: "PENJAMINAN_MUTU",
        penggunaId: sesi.id,
        ...capPenandaTangan(sesi),
        sidik: beku.sidik,
      },
    }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status: "TERBIT",
        ...barisRiwayat(riwayat("DISAHKAN_MUTU", { sidik: beku.sidik.slice(0, 16) })),
        olehId: sesi.id,
      },
    }),
  ]);

  const prodiId = rpkps.mataKuliah.kurikulum.prodiId;
  await kirimNotifikasi(
    [...(await penerimaPengampu(id)), ...(await penerimaKaprodi(prodiId))],
    {
      jenis: "RPKPS_DISAHKAN",
      rpkpsId: id,
      mk: `${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama}`,
      ta: rpkps.tahunAkademik.kode.replace("-", " "),
      oleh: sesi.namaLengkap,
    },
    sesi.id,
  );

  segarkan(`/rpkps/${id}`);
  segarkan("/rpkps");
  return { ok: true, pesan: kam.aksi.rpkps.disahkan };
}

/**
 * Mengembalikan dokumen untuk direvisi. Dapat dilakukan pemegang cap
 * berikutnya di rantai: Kaprodi atas dokumen yang diajukan, Penjaminan Mutu
 * atas dokumen yang sudah disetujui Kaprodi.
 *
 * Versi naik, dan kenaikan itulah yang menggugurkan SELURUH tanda tangan ronde
 * sebelumnya — barisnya tetap tersimpan. Dokumen yang berubah harus
 * ditandatangani ulang oleh semua orang, termasuk yang parafnya sudah ada.
 */
export async function kembalikanRpkps(id: string, catatan: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { sesi, prodiId, dalamCakupan } = await pastikanWenang(id);
  if (!prodiId) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      versi: true,
      mataKuliah: { select: { kode: true, nama: true } },
      tahunAkademik: { select: { kode: true } },
    },
  });
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const kaprodi = dalamCakupan && punyaPeranDiProdi(sesi, prodiId, "KAPRODI");
  const mutu = punyaPeran(sesi, "GPM");
  const berwenang =
    (rpkps.status === "DIAJUKAN" && kaprodi) || (rpkps.status === "DISETUJUI" && mutu);

  if (!berwenang) {
    return {
      ok: false,
      pesan:
        rpkps.status === "DIAJUKAN"
          ? kam.aksi.rpkps.hanyaKaprodiKembalikan
          : rpkps.status === "DISETUJUI"
            ? kam.aksi.rpkps.hanyaGpmKembalikan
            : kam.aksi.rpkps.hanyaMenungguKembalikan,
    };
  }

  /**
   * Catatan WAJIB. Diperiksa di sini, bukan hanya di dialog: aksi ini dapat
   * dipanggil langsung, dan catatan kosong menghasilkan baris histori
   * "Dikembalikan untuk revisi" tanpa keterangan — dosen tidak punya petunjuk
   * apa pun tentang apa yang harus diperbaiki.
   */
  const catatanBersih = catatan.trim();
  if (catatanBersih.length < MIN_CATATAN_REVISI) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.rpkps.catatanRevisiMin, { min: MIN_CATATAN_REVISI }),
    };
  }

  await prisma.$transaction([
    prisma.rpkps.update({
      where: { id },
      data: { status: "DIREVISI", versi: rpkps.versi + 1 },
    }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status: "DIREVISI",
        ...barisRiwayat(riwayat("DIKEMBALIKAN_REVISI", { catatan: catatanBersih })),
        olehId: sesi.id,
      },
    }),
  ]);

  await kirimNotifikasi(
    await penerimaPengampu(id),
    {
      jenis: "RPKPS_DIREVISI",
      rpkpsId: id,
      mk: `${rpkps.mataKuliah.kode} ${rpkps.mataKuliah.nama}`,
      ta: rpkps.tahunAkademik.kode.replace("-", " "),
      oleh: sesi.namaLengkap,
      catatan: catatanBersih,
    },
    sesi.id,
  );

  segarkan(`/rpkps/${id}`);
  segarkan("/rpkps");
  return {
    ok: true,
    pesan: kam.aksi.rpkps.dikembalikan,
  };
}
