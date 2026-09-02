import { writeFileSync } from "node:fs";
import JSZip from "jszip";
import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma";
import { buatDokumenRpkps } from "@/lib/dokumen/rpkps-docx";
import { sidikDokumen } from "@/domain/rpkps/proyeksi";
import { cairkanSnapshot } from "@/domain/rpkps/sidik";
import { keRpkpsInput } from "@/domain/rpkps/pemetaan";
import { BENTUK_BAWAAN, KEBIJAKAN_BAWAAN } from "@/domain/beban-belajar/kebijakan-bawaan";
import { susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { validasiRpkps } from "@/domain/rpkps/validator";
import { validasiKurikulum } from "@/domain/kurikulum/validator";
import { validasiKisiKisi } from "@/domain/rpkps/kisi-kisi";
import { periksaKelayakanHapus, statusSetelahPulih } from "@/domain/rpkps/daur-hidup";
import {
  bolehSuntingKurikulum,
  periksaKelayakanHapusCpl,
  periksaKelayakanHapusCpmk,
  periksaKelayakanHapusMk,
  periksaKelayakanHapusSubCpmk,
} from "@/domain/kurikulum/sunting";
import {
  sensusCpl,
  sensusCpmk,
  sensusKurikulum,
  sensusMataKuliah,
  sensusSubCpmk,
  setelMatriksCplMk,
} from "@/lib/kurikulum/sunting-inti";
import { tulisKomponenNilai } from "@/lib/rpkps/komponen-inti";
import { kelompokkanTerjemahan, tulisTerjemahan } from "@/lib/rpkps/terjemahan-tulis";
import { simpanNilaiKelas, simpanSkorButir } from "@/lib/evaluasi/nilai-inti";
import { nilaiTenggatDokumen } from "@/domain/rpkps/tenggat";
import {
  barisMingguan,
  susunUlangKerangkaDb,
  terapkanStruktur,
} from "@/lib/rpkps/struktur";
import { periksaPenerapan, periksaUsulanRevisi } from "@/domain/kurikulum/usulan";
import {
  keUsulanInput,
  muatKurikulumInput,
  muatUsulan,
  terapkanUsulan,
} from "@/lib/kurikulum/usulan-inti";
import type { KategoriWaktu } from "@/generated/prisma";
import { pesanTemuanId } from "@/lib/bahasa/temuan";

function cek(nama: string, syarat: boolean, detail?: string) {
  console.log(`${syarat ? "  OK  " : " GAGAL"} ${nama}${detail ? ` — ${detail}` : ""}`);
  if (!syarat) process.exitCode = 1;
}

async function main() {
  // ── 1 · Master data ────────────────────────────────────────────
  const institusi = await prisma.institusi.create({
    data: { id: "itts", nama: "Institut Teknologi Tangerang Selatan", namaSingkat: "ITTS" },
  });
  const fakultas = await prisma.fakultas.create({
    data: { kode: "FTI", nama: "Fakultas Teknologi Industri", institusiId: institusi.id },
  });
  const prodi = await prisma.prodi.create({
    data: { kode: "TI", nama: "Teknologi Informasi", fakultasId: fakultas.id },
  });
  const tahun = await prisma.tahunAkademik.create({
    data: { kode: "2025/2026-GENAP", tahunMulai: 2025, tahunSelesai: 2026, semester: "GENAP", aktif: true },
  });
  await prisma.kebijakanBebanBelajar.create({
    data: {
      institusiId: institusi.id,
      nama: "Kebijakan bawaan",
      status: "BERLAKU",
      berlakuDari: new Date(),
      bentuk: {
        create: BENTUK_BAWAAN.map((b) => ({
          bentuk: b.bentuk,
          menitTmPerSks: b.tm,
          menitPtPerSks: b.pt,
          menitBmPerSks: b.bm,
          tmTerjadwal: b.tmTerjadwal,
          butuhRuangKhusus: b.butuhRuangKhusus,
        })),
      },
    },
  });
  cek("master data tersimpan", true);

  // ── 2 · Kurikulum: TI214 seperti dokumen ITTS ───────────────────
  const kurikulum = await prisma.kurikulum.create({
    data: { prodiId: prodi.id, nama: "Kurikulum TI 2025", tahun: 2025, status: "BERLAKU" },
  });
  const cpl06 = await prisma.cpl.create({
    data: { kurikulumId: kurikulum.id, kode: "CPL06", deskripsi: "Mampu menerapkan pemikiran logis, kritis, dan sistematis.", tingkatKkni: 6, urutan: 0 },
  });
  const cpl08 = await prisma.cpl.create({
    data: { kurikulumId: kurikulum.id, kode: "CPL08", deskripsi: "Mampu merancang dan mengimplementasi solusi berbasis computing.", tingkatKkni: 6, urutan: 1 },
  });

  const mk = await prisma.mataKuliah.create({
    data: {
      kurikulumId: kurikulum.id,
      kode: "TI214",
      nama: "Basis Data",
      semester: 2,
      sksTeori: 2,
      sksPraktik: 1,
      deskripsi: "Mata kuliah Basis Data memberikan pemahaman komprehensif mengenai konsep dasar, perancangan, dan implementasi sistem basis data relasional.",
      cpl: { create: [{ cplId: cpl06.id }, { cplId: cpl08.id }] },
    },
  });

  // 2 CPMK x 7 Sub-CPMK = 14, persis seperti dokumen aslinya
  for (const [i, spec] of [
    { kode: "CPMK081", cplId: cpl08.id, level: "C6" as const },
    { kode: "CPMK082", cplId: cpl06.id, level: "C3" as const },
  ].entries()) {
    const cpmk = await prisma.cpmk.create({
      data: {
        mataKuliahId: mk.id,
        kode: spec.kode,
        rumusan: `Rumusan ${spec.kode} yang cukup panjang untuk dinilai.`,
        levelBloom: spec.level,
        urutan: i,
        cpl: { create: { cplId: spec.cplId } },
      },
    });
    await prisma.subCpmk.createMany({
      data: Array.from({ length: 7 }, (_, j) => ({
        cpmkId: cpmk.id,
        kode: `${spec.kode}-${j + 1}`,
        rumusan: `Mahasiswa mampu menjelaskan pokok bahasan ke-${j + 1} pada ${spec.kode}.`,
        levelBloom: "C2" as const,
        urutan: j,
        mingguDisarankan: [],
      })),
    });
  }
  cek("kurikulum tersimpan", true, "2 CPL, 1 MK, 2 CPMK, 14 Sub-CPMK");

  // Validator kurikulum harus lolos
  const cplRows = await prisma.cpl.findMany({ where: { kurikulumId: kurikulum.id } });
  const mkRow = await prisma.mataKuliah.findUniqueOrThrow({
    where: { id: mk.id },
    include: { cpl: { include: { cpl: true } }, cpmk: { include: { cpl: { include: { cpl: true } }, subCpmk: true } } },
  });
  const vk = validasiKurikulum({
    nama: "Kurikulum TI 2025",
    tahun: 2025,
    cpl: cplRows.map((c) => ({ kode: c.kode, deskripsi: c.deskripsi })),
    mataKuliah: [{
      kode: mkRow.kode, nama: mkRow.nama, semester: mkRow.semester,
      sksTeori: mkRow.sksTeori, sksPraktik: mkRow.sksPraktik,
      cplKode: mkRow.cpl.map((x) => x.cpl.kode),
      cpmk: mkRow.cpmk.map((c) => ({
        kode: c.kode, rumusan: c.rumusan, levelBloom: c.levelBloom,
        cplKode: c.cpl.map((x) => x.cpl.kode),
        subCpmk: c.subCpmk.map((s) => ({ kode: s.kode, rumusan: s.rumusan, levelBloom: s.levelBloom })),
      })),
    }],
  });
  cek("validator kurikulum lolos", vk.lolos, vk.pemblokir.map((t) => t.kode).join(",") || "tanpa pemblokir");

  // ── 3 · Menyusun kerangka RPKPS (logika buatRpkps) ─────────────
  const kebijakan = KEBIJAKAN_BAWAAN;
  const rencana = susunRencanaSemester(kebijakan, {
    sksTeori: mk.sksTeori, sksPraktik: mk.sksPraktik,
    bentukTeori: mk.bentukTeori, bentukPraktik: mk.bentukPraktik,
  });
  const semuaSub = await prisma.subCpmk.findMany({
    where: { cpmk: { mataKuliahId: mk.id } },
    orderBy: [{ cpmk: { urutan: "asc" } }, { urutan: "asc" }],
  });
  const mingguEfektif = rencana.minggu.filter((m) => m.jenis === "EFEKTIF");

  const pengguna = await prisma.pengguna.create({
    data: { firebaseUid: "uji-1", email: "yusuf@itts.ac.id", nama: "Muhamad Yusuf", nidn: "0412129501", status: "AKTIF" },
  });

  const rpkps = await prisma.rpkps.create({
    data: {
      mataKuliahId: mk.id,
      tahunAkademikId: tahun.id,
      deskripsi: mk.deskripsi,
      pengampu: { create: { penggunaId: pengguna.id, peran: "KOORDINATOR" } },
      komponenNilai: {
        create: [
          { nama: "UTS", bobot: 15, urutan: 0 },
          { nama: "UAS", bobot: 15, urutan: 1 },
          { nama: "Tugas", bobot: 70, urutan: 2 },
        ],
      },
      pustaka: {
        create: [{ jenis: "UTAMA", nomor: 1, teks: "Silberschatz, A. (2019). Database System Concepts (7th ed.)." }],
      },
    },
  });

  for (const m of rencana.minggu) {
    const ujian = m.jenis === "UJIAN";
    const idx = mingguEfektif.findIndex((x) => x.minggu === m.minggu);
    const sub = !ujian && idx >= 0 ? semuaSub[idx] : undefined;
    const aktivitas: { nama: string; kategori: KategoriWaktu; menit: number; urutan: number }[] = [];
    if (m.pagu.tm > 0) aktivitas.push({ nama: ujian ? "Pelaksanaan ujian" : "Tatap muka", kategori: "TM", menit: m.pagu.tm, urutan: 0 });
    if (m.pagu.pt > 0) aktivitas.push({ nama: "Penugasan terstruktur", kategori: "PT", menit: m.pagu.pt, urutan: 1 });
    if (m.pagu.bm > 0) aktivitas.push({ nama: ujian ? "Persiapan ujian" : "Belajar mandiri", kategori: "BM", menit: m.pagu.bm, urutan: 2 });

    await prisma.pertemuan.create({
      data: {
        rpkpsId: rpkps.id,
        minggu: m.minggu,
        jenis: ujian ? (m.minggu < 16 ? "UTS" : "UAS") : "EFEKTIF",
        topik: ujian ? "Ujian" : `Topik minggu ${m.minggu}`,
        subtopik: ujian ? [] : ["Subtopik A", "Subtopik B"],
        bobot: ujian ? 15 : 5,
        penilaianJenis: ujian ? "Tes tertulis" : "Tugas",
        aktivitas: { create: aktivitas },
        indikator: { create: [{ teks: "Indikator terukur pertama", urutan: 0 }] },
        pustaka: { create: { pustakaId: (await prisma.pustaka.findFirstOrThrow({ where: { rpkpsId: rpkps.id } })).id } },
        ...(sub ? { subCpmk: { create: { subCpmkId: sub.id } } } : {}),
      },
    });
  }
  // Tugas / proyek — bagian I template ITTS
  const subUntukTugas = semuaSub.slice(2, 5);
  await prisma.tugas.create({
    data: {
      rpkpsId: rpkps.id,
      nomor: 1,
      nama: "Proyek Akhir Basis Data",
      jenis: "KELOMPOK",
      mingguMulai: 9,
      mingguSelesai: 16,
      bobot: 20,
      deskripsi:
        "Mahasiswa membangun purwarupa sistem basis data fungsional untuk menyelesaikan masalah nyata, mulai dari analisis kebutuhan, perancangan ERD, normalisasi, implementasi DBMS, hingga integrasi dengan aplikasi.",
      formatLuaran: "Source code, dokumentasi perancangan, laporan pengujian, slide presentasi.",
      subCpmk: { create: subUntukTugas.map((s) => ({ subCpmkId: s.id })) },
      kriteria: {
        create: [
          { nomor: 1, indikator: "Desain & pemodelan", rincian: ["Ketepatan entitas dan kardinalitas pada ERD", "Skema memenuhi 3NF"], bobot: 25 },
          { nomor: 2, indikator: "Implementasi SQL & integritas", rincian: ["DDL dan DML berjalan tanpa galat", "PK/FK mencegah data yatim"], bobot: 30 },
          { nomor: 3, indikator: "Integrasi & pengujian", rincian: ["CRUD dari antarmuka berhasil", "Laporan EXPLAIN terdokumentasi"], bobot: 20 },
          { nomor: 4, indikator: "Presentasi & demo", rincian: ["Penyampaian jelas dan terstruktur"], bobot: 15 },
          { nomor: 5, indikator: "Refleksi individu", rincian: ["Kedalaman analisis kritis"], bobot: 10 },
        ],
      },
      linimasa: {
        create: [
          { minggu: 12, tahapan: "Pembagian kelompok & tema", aktivitas: "Instruksi proyek, pembagian kelompok 2-3 orang, pemilihan studi kasus." },
          { minggu: 13, tahapan: "Fase desain", aktivitas: "Penyusunan business rules, ERD, dan normalisasi tabel." },
          { minggu: 14, tahapan: "Fase basis data", aktivitas: "Implementasi DDL, penetapan constraint, pengisian data." },
          { minggu: 15, tahapan: "Otomasi & integrasi", aktivitas: "Stored procedure, trigger, uji performa, integrasi antarmuka." },
          { minggu: 16, tahapan: "Laporan & presentasi", aktivitas: "Pengumpulan laporan dan demo aplikasi." },
        ],
      },
    },
  });

  cek("kerangka RPKPS tersusun", true, `${rencana.minggu.length} pertemuan`);

  // ── 4 · Verifikasi hasil kerangka ─────────────────────────────
  const muat = await prisma.rpkps.findUniqueOrThrow({
    where: { id: rpkps.id },
    include: {
      tahunAkademik: true,
      mataKuliah: {
        include: {
          kurikulum: { select: { id: true, nama: true, tahun: true, prodiId: true, prodi: { select: { nama: true, kode: true } } } },
          cpl: { include: { cpl: { select: { id: true, kode: true, deskripsi: true } } } },
          cpmk: { orderBy: { urutan: "asc" }, include: { cpl: { include: { cpl: { select: { kode: true } } } }, subCpmk: { orderBy: { urutan: "asc" } } } },
        },
      },
      pengampu: { include: { pengguna: { select: { id: true, nama: true, gelarDepan: true, gelarBelakang: true, nidn: true, nip: true } } } },
      pustaka: true,
      komponenNilai: true,
      tugas: {
        orderBy: { nomor: "asc" },
        include: {
          subCpmk: { include: { subCpmk: { select: { id: true, kode: true } } } },
          kriteria: { orderBy: { nomor: "asc" } },
          linimasa: { orderBy: { minggu: "asc" } },
        },
      },
      pertemuan: {
        orderBy: { minggu: "asc" },
        include: {
          subCpmk: { include: { subCpmk: { select: { id: true, kode: true, rumusan: true } } } },
          aktivitas: true, indikator: true,
          pustaka: { include: { pustaka: { select: { nomor: true, jenis: true } } } },
        },
      },
    },
  });

  cek("16 pertemuan bernomor lengkap", muat.pertemuan.length === 16, `${muat.pertemuan.length}`);
  cek("minggu ujian di posisi 8 dan 16",
    muat.pertemuan.filter((p) => p.jenis !== "EFEKTIF").map((p) => p.minggu).join(",") === "8,16");

  const totalMenit = muat.pertemuan.reduce((s, p) => s + p.aktivitas.reduce((t, a) => t + a.menit, 0), 0);
  const jamPerSks = totalMenit / 60 / (mk.sksTeori + mk.sksPraktik);
  cek("total beban tepat 45 jam/sks", Math.abs(jamPerSks - 45) < 0.01, `${jamPerSks.toFixed(2)} jam/sks`);

  const m1 = muat.pertemuan.find((p) => p.minggu === 1)!;
  cek("pagu minggu efektif 510 menit", m1.aktivitas.reduce((s, a) => s + a.menit, 0) === 510);
  const m8 = muat.pertemuan.find((p) => p.minggu === 8)!;
  cek("minggu ujian punya alokasi waktu", m8.aktivitas.reduce((s, a) => s + a.menit, 0) === 480);

  const terjadwal = muat.pertemuan.flatMap((p) => p.subCpmk.map((s) => s.subCpmk.kode));
  cek("14 Sub-CPMK terjadwal otomatis", terjadwal.length === 14, terjadwal.slice(0, 3).join(", ") + ", …");

  // ── 5 · Validator RPKPS terhadap data nyata ───────────────────
  //
  // Rantai pengesahan (docs/14 §2.2): sebelum ada paraf, dokumen selengkap
  // apa pun tetap tertahan — dan itulah yang diperiksa lebih dulu.
  // Sidik penuh dihitung dari muatan lengkap (§9 di bawah); di sini yang
  // diuji adalah gerbangnya, jadi cukup satu nilai yang konsisten. Aturan
  // "paraf gugur saat isinya berubah" punya ujinya sendiri di
  // src/domain/rpkps/paraf.test.ts.
  const sidikParaf = "uji-integrasi-sidik-paraf";
  const tanpaParaf = validasiRpkps(keRpkpsInput(muat), kebijakan);
  cek(
    "tanpa paraf pengampu, pengajuan tertahan",
    tanpaParaf.pemblokir.some((t) => t.kode === "B-PARAF-BELUM-LENGKAP"),
    tanpaParaf.pemblokir.map((t) => t.kode).join(", ") || "tidak ada pemblokir",
  );

  await prisma.tandaTanganRpkps.createMany({
    data: muat.pengampu.map((p) => ({
      rpkpsId: rpkps.id,
      versi: muat.versi,
      peran: "PENGAMPU" as const,
      penggunaId: p.penggunaId,
      nama: p.pengguna.nama,
      identitas: p.pengguna.nidn ?? p.pengguna.nip,
      sidik: sidikParaf,
    })),
  });
  const ttdParaf = await prisma.tandaTanganRpkps.findMany({
    where: { rpkpsId: rpkps.id },
    orderBy: [{ versi: "desc" }, { ditandatanganiPada: "asc" }],
  });

  const input = keRpkpsInput({ ...muat, tandaTangan: ttdParaf });
  const hasil = validasiRpkps(input, kebijakan);
  cek("validator RPKPS lolos", hasil.lolos,
    hasil.lolos ? "tanpa pemblokir" : hasil.pemblokir.map((t) => `${t.kode}: ${pesanTemuanId(t)}`).join(" | "));
  cek("bobot mingguan 100%", hasil.ringkasan.totalBobotMingguan === 100, `${hasil.ringkasan.totalBobotMingguan}%`);
  cek("seluruh Sub-CPMK terjadwal", hasil.ringkasan.subCpmkBelumDijadwalkan.length === 0);
  cek("satu tugas tersimpan", hasil.ringkasan.jumlahTugas === 1);
  cek("bobot indikator tugas 100%", !hasil.temuan.some((t) => t.kode === "I-BOBOT-KRITERIA"));

  // ── 6 · Uji negatif: rusakkan bobot, harus tertangkap ─────────
  await prisma.pertemuan.update({ where: { id: m1.id }, data: { bobot: 25 } });
  const ulang = await prisma.pertemuan.findMany({
    where: { rpkpsId: rpkps.id },
    orderBy: { minggu: "asc" },
    include: {
      subCpmk: { include: { subCpmk: { select: { kode: true } } } },
      aktivitas: true,
      indikator: true,
      pustaka: { include: { pustaka: { select: { nomor: true } } } },
    },
  });
  const hasilRusak = validasiRpkps(
    { ...input, pertemuan: keRpkpsInput({ ...muat, pertemuan: ulang }).pertemuan },
    kebijakan,
  );
  cek(
    "uji negatif: bobot 120% tertangkap validator",
    !hasilRusak.lolos && hasilRusak.pemblokir.some((t) => t.kode === "B1-BOBOT-MINGGUAN"),
    hasilRusak.pemblokir.map((t) => t.kode).join(", "),
  );

  // ── 7 · Ekspor DOCX ────────────────────────────────────────────
  await prisma.pertemuan.update({ where: { id: m1.id }, data: { bobot: 5 } }); // pulihkan
  // Tanda centang pada tabel distribusi berasal dari kaitan pertemuan ->
  // komponen nilai, dan pertemuan itu harus punya Sub-CPMK. Minggu ujian
  // tidak punya Sub-CPMK, jadi kaitannya dipasang pada minggu efektif.
  const komponenUts = await prisma.komponenNilai.findFirstOrThrow({
    where: { rpkpsId: rpkps.id, nama: "UTS" },
  });
  const komponenTugas = await prisma.komponenNilai.findFirstOrThrow({
    where: { rpkpsId: rpkps.id, nama: "Tugas" },
  });
  await prisma.pertemuan.updateMany({
    where: { rpkpsId: rpkps.id, jenis: "UTS" },
    data: { komponenNilaiId: komponenUts.id },
  });
  await prisma.pertemuan.updateMany({
    where: { rpkpsId: rpkps.id, jenis: "EFEKTIF" },
    data: { komponenNilaiId: komponenTugas.id },
  });

  const bentukMuat = {
      tahunAkademik: true,
      mataKuliah: {
        include: {
          kurikulum: { select: { id: true, nama: true, tahun: true, prodiId: true, prodi: { select: { nama: true, kode: true } } } },
          cpl: { include: { cpl: { select: { id: true, kode: true, deskripsi: true } } } },
          cpmk: { orderBy: { urutan: "asc" }, include: { cpl: { include: { cpl: { select: { kode: true } } } }, subCpmk: { orderBy: { urutan: "asc" } } } },
        },
      },
      pengampu: { orderBy: { urutan: "asc" }, include: { pengguna: { select: { id: true, nama: true, gelarDepan: true, gelarBelakang: true, nidn: true, nip: true } } } },
      tandaTangan: { orderBy: [{ versi: "desc" as const }, { ditandatanganiPada: "asc" as const }] },
      pustaka: { orderBy: [{ jenis: "asc" }, { nomor: "asc" }] },
      komponenNilai: { orderBy: { urutan: "asc" } },
      tugas: {
        orderBy: { nomor: "asc" },
        include: {
          subCpmk: { include: { subCpmk: { select: { id: true, kode: true } } } },
          kriteria: { orderBy: { nomor: "asc" } },
          linimasa: { orderBy: { minggu: "asc" } },
          komponenNilai: { select: { nama: true } },
        },
      },
      kisiKisi: {
        orderBy: { jenis: "asc" },
        include: {
          butir: {
            orderBy: { nomor: "asc" },
            include: { subCpmk: { select: { id: true, kode: true, rumusan: true } } },
          },
        },
      },
      pertemuan: {
        orderBy: { minggu: "asc" },
        include: {
          subCpmk: { include: { subCpmk: { select: { id: true, kode: true, rumusan: true } } } },
          aktivitas: { orderBy: { urutan: "asc" } },
          indikator: { orderBy: { urutan: "asc" } },
          pustaka: { include: { pustaka: { select: { nomor: true, jenis: true } } } },
        },
      },
  } satisfies Prisma.RpkpsInclude;

  // Kisi-kisi UTS: tujuh Sub-CPMK pertama, total skor 100.
  const subSebelumUts = semuaSub.slice(0, 7);
  await prisma.kisiKisi.create({
    data: {
      rpkpsId: rpkps.id,
      jenis: "UTS",
      totalSkor: 100,
      durasiMenit: 120,
      butir: {
        create: subSebelumUts.map((s, i) => ({
          nomor: i + 1,
          subCpmkId: s.id,
          levelBloom: "C3" as const,
          bentuk: "ESAI" as const,
          jumlahButir: 2,
          skor: i === 6 ? 100 - 6 * 14 : 14,
          indikator: `Ketepatan menjawab pokok bahasan ke-${i + 1}`,
        })),
      },
    },
  });

  const untukDocx = await prisma.rpkps.findUniqueOrThrow({
    where: { id: rpkps.id },
    include: bentukMuat,
  });

  const buffer = await buatDokumenRpkps(untukDocx, [
    { versi: 1, dibuatPada: new Date(), deskripsi: "Kerangka dibuat otomatis" },
  ]);
  cek("DOCX terbentuk", buffer.length > 10_000, `${(buffer.length / 1024).toFixed(1)} KB`);

  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file("word/document.xml")!.async("string");
  cek("berkas .docx sah (berisi word/document.xml)", docXml.length > 0);
  cek("memuat judul RPKPS ITTS", docXml.includes("INSTITUT TEKNOLOGI TANGERANG SELATAN"));
  cek("memuat halaman pengesahan", docXml.includes("HALAMAN PENGESAHAN"));
  for (const bagian of [
    "DESKRIPSI MATA KULIAH", "CAPAIAN PEMBELAJARAN", "ANALISIS PEMBELAJARAN",
    "TOPIK PEMBELAJARAN", "EVALUASI PEMBELAJARAN", "AMBANG BATAS KELULUSAN",
    "REFERENSI DAN SUMBER PEMBELAJARAN", "RENCANA PEMBELAJARAN MINGGUAN",
    "DETAIL TUGAS / PROYEK", "HISTORI REVISI",
  ]) {
    cek(`bagian "${bagian}" ada`, docXml.includes(bagian));
  }
  cek("kode MK muncul", docXml.includes("TI214"));
  cek("Sub-CPMK muncul di tabel", docXml.includes("CPMK081-1"));
  cek("tabel distribusi bertanda centang", docXml.includes("√"));
  cek("halaman mingguan mendatar", docXml.includes("landscape"));
  cek("bagian I tugas muncul di dokumen", docXml.includes("DETAIL TUGAS"));
  cek("nama tugas muncul", docXml.includes("Proyek Akhir Basis Data"));
  cek("linimasa tugas muncul", docXml.includes("Fase desain"));
  cek("lampiran kisi-kisi muncul", docXml.includes("LAMPIRAN — KISI-KISI UJIAN"));
  cek("judul UTS pada lampiran", docXml.includes("Ujian Tengah Semester"));
  cek("indikator soal muncul", docXml.includes("Ketepatan menjawab pokok bahasan ke-1"));

  // Validator kisi-kisi terhadap data nyata di database.
  const kk = await prisma.kisiKisi.findFirstOrThrow({
    where: { rpkpsId: rpkps.id, jenis: "UTS" },
    include: { butir: { include: { subCpmk: true } }, },
  });
  const kodeSebelum = [...new Set(
    untukDocx.pertemuan
      .filter((p) => p.minggu < 8)
      .flatMap((p) => p.subCpmk.map((s) => s.subCpmk.kode)),
  )];
  const hasilKk = validasiKisiKisi(
    {
      jenis: "UTS",
      totalSkor: Number(kk.totalSkor),
      butir: kk.butir.map((b) => ({
        nomor: b.nomor,
        subCpmkKode: b.subCpmk.kode,
        levelBloom: b.levelBloom,
        jumlahButir: b.jumlahButir,
        skor: Number(b.skor),
      })),
    },
    {
      subCpmkSebelumUts: kodeSebelum,
      subCpmkSetelahUts: [...new Set(
        untukDocx.pertemuan
          .filter((p) => p.minggu > 8)
          .flatMap((p) => p.subCpmk.map((s) => s.subCpmk.kode)),
      )],
      levelSubCpmk: Object.fromEntries(semuaSub.map((s) => [s.kode, s.levelBloom])),
      bobotSubCpmk: Object.fromEntries(semuaSub.map((s) => [s.kode, 5])),
    },
  );
  cek(
    "validator kisi-kisi lolos terhadap data nyata",
    hasilKk.lolos,
    hasilKk.lolos ? "tanpa pemblokir" : hasilKk.pemblokir.map((t) => t.kode).join(", "),
  );
  cek("seluruh Sub-CPMK pra-UTS teruji", hasilKk.ringkasan.subCpmkTercakup === 7);
  const jumlahSel = (docXml.match(/<w:tbl>/g) ?? []).length;
  cek("empat tabel terbentuk (tim, distribusi, skala, mingguan, riwayat)", jumlahSel >= 5, `${jumlahSel} tabel`);

  // ── 8 · Penguncian versi saat terbit ───────────────────────────
  const sidikSebelum = sidikDokumen(untukDocx as never);
  const isiBeku = {
    dokumen: JSON.parse(JSON.stringify(untukDocx)),
    riwayat: [{ versi: 1, dibuatPada: new Date().toISOString(), deskripsi: "Terbit" }],
  };
  await prisma.rpkpsSnapshot.create({
    data: { rpkpsId: rpkps.id, versi: 1, isi: isiBeku as never, sidik: sidikSebelum },
  });
  await prisma.rpkps.update({ where: { id: rpkps.id }, data: { status: "TERBIT" } });
  cek("salinan beku tersimpan", sidikSebelum.length === 64, sidikSebelum.slice(0, 16) + "…");

  // Sidik harus stabil bila tidak ada yang berubah.
  const ulangMuat = async () =>
    prisma.rpkps.findUniqueOrThrow({ where: { id: rpkps.id }, include: bentukMuat });
  cek("sidik stabil tanpa perubahan", sidikDokumen((await ulangMuat()) as never) === sidikSebelum);

  // Sekarang kurikulum disunting — persis skenario yang harus terdeteksi.
  const cpmkPertama = await prisma.cpmk.findFirstOrThrow({ where: { mataKuliahId: mk.id } });
  await prisma.cpmk.update({
    where: { id: cpmkPertama.id },
    data: { rumusan: cpmkPertama.rumusan + " (rumusan direvisi prodi)" },
  });
  const sidikSesudah = sidikDokumen((await ulangMuat()) as never);
  cek("perubahan kurikulum mengubah sidik", sidikSesudah !== sidikSebelum);

  const snapshot = await prisma.rpkpsSnapshot.findUniqueOrThrow({
    where: { rpkpsId_versi: { rpkpsId: rpkps.id, versi: 1 } },
  });
  cek("salinan beku tidak ikut berubah", snapshot.sidik === sidikSebelum);

  const beku = cairkanSnapshot<typeof untukDocx>(snapshot.isi as never);
  const docBeku = await buatDokumenRpkps(beku.rpkps, beku.riwayat, snapshot.sidik);
  const zipBeku = await JSZip.loadAsync(docBeku);
  const xmlBeku = await zipBeku.file("word/document.xml")!.async("string");
  cek(
    "dokumen resmi tidak memuat rumusan yang direvisi",
    !xmlBeku.includes("rumusan direvisi prodi"),
  );
  cek("dokumen resmi mencantumkan sidik", xmlBeku.includes(sidikSebelum.slice(0, 8)));

  // ── 9 · Usulan Revisi Kurikulum: usul → putus → sahkan ─────────
  // Doc 04. Yang dibuktikan di sini bukan sekadar "data tersimpan", melainkan
  // dua janji yang paling mudah dilanggar: pensiun TIDAK menghapus baris RPKPS
  // yang merujuknya, dan salinan beku RPKPS terbit tidak ikut berubah.
  const tahunDepan = await prisma.tahunAkademik.create({
    data: {
      kode: "2026/2027-GANJIL",
      tahunMulai: 2026,
      tahunSelesai: 2027,
      semester: "GANJIL",
    },
  });

  const subDiubah = await prisma.subCpmk.findFirstOrThrow({ where: { kode: "CPMK082-3" } });
  const subDipensiun = await prisma.subCpmk.findFirstOrThrow({ where: { kode: "CPMK082-7" } });
  const rujukanSebelum = await prisma.pertemuanSubCpmk.count({
    where: { subCpmkId: subDipensiun.id },
  });

  const usulanBaru = await prisma.usulanRevisi.create({
    data: {
      kurikulumId: kurikulum.id,
      mataKuliahId: mk.id,
      judul: "Penyegaran capaian normalisasi",
      latar:
        "Rumusan CPMK082-3 belum menyebut sampai bentuk normal keberapa mahasiswa dituntut bekerja, sehingga penilaiannya tidak konsisten antar-dosen.",
      diajukanOlehId: pengguna.id,
      butir: {
        create: [
          {
            urutan: 1,
            jenis: "SUB_RUMUSAN",
            cpmkKode: "CPMK082",
            subCpmkKode: "CPMK082-3",
            rumusan:
              "Mahasiswa mampu menjelaskan normalisasi hingga bentuk normal ketiga pada skema relasional.",
            levelBloom: "C2",
            alasan: "Rumusan lama tidak menyebut batas bentuk normal yang dituntut.",
            dasar: {
              create: {
                jenis: "CATATAN_DOSEN",
                kutipan: "Tiga dosen pengampu menilai batas normalisasi berbeda-beda.",
              },
            },
          },
          {
            urutan: 2,
            jenis: "SUB_PENSIUN",
            cpmkKode: "CPMK082",
            subCpmkKode: "CPMK082-7",
            alasan: "Materinya sudah ditampung Sub-CPMK lain sejak tabel mingguan disusun ulang.",
            dasar: {
              create: {
                jenis: "CATATAN_DOSEN",
                kutipan: "Tumpang tindih dengan CPMK082-5 pada dua semester terakhir.",
              },
            },
          },
          {
            urutan: 3,
            jenis: "CATATAN_CPL",
            cpmkKode: "CPMK082",
            alasan: "Gudang data belum tertampung CPL mana pun; perlu dibahas di evaluasi kurikulum.",
            dasar: {
              create: {
                jenis: "CATATAN_DOSEN",
                kutipan: "Permintaan kompetensi OLAP muncul berulang pada masukan mitra.",
              },
            },
          },
        ],
      },
    },
    select: { id: true },
  });

  const kurikulumInput = await muatKurikulumInput(prisma, kurikulum.id);
  const usulanDiajukan = await muatUsulan(prisma, usulanBaru.id);
  const periksaAjuan = periksaUsulanRevisi(kurikulumInput!, keUsulanInput(usulanDiajukan!));
  cek(
    "usulan lolos pemeriksaan pengajuan",
    periksaAjuan.lolos,
    periksaAjuan.pemblokir.map((t) => t.kode).join(",") || "tanpa pemblokir",
  );

  // Kaprodi memutuskan: dua butir diterima, catatan CPL dibiarkan sebagai bahan
  // evaluasi kurikulum — ia memang tidak pernah diterapkan.
  await prisma.usulanRevisi.update({
    where: { id: usulanBaru.id },
    data: { status: "DIAJUKAN", diajukanPada: new Date() },
  });
  await prisma.butirUsulan.updateMany({
    where: { usulanId: usulanBaru.id, jenis: { not: "CATATAN_CPL" } },
    data: { status: "DITERIMA" },
  });

  const usulanDiputus = await muatUsulan(prisma, usulanBaru.id);
  const periksaTerap = periksaPenerapan(kurikulumInput!, keUsulanInput(usulanDiputus!));
  cek("penerapan lolos pemeriksaan akibat", periksaTerap.lolos);

  const hasilTerap = await terapkanUsulan(
    prisma,
    usulanDiputus!,
    pengguna.id,
    tahunDepan.id,
  );
  cek("revisi tercatat sebagai revisi ke-1", hasilTerap.revisiKe === 1, hasilTerap.ringkasan);

  const kurikulumSesudah = await prisma.kurikulum.findUniqueOrThrow({
    where: { id: kurikulum.id },
    include: { daftarRevisi: true },
  });
  cek("penghitung revisi kurikulum naik", kurikulumSesudah.revisi === 1);
  cek(
    "ledger revisi terisi dan menandai pengesahan mandiri",
    kurikulumSesudah.daftarRevisi.length === 1 &&
      kurikulumSesudah.daftarRevisi[0].disahkanSendiri &&
      kurikulumSesudah.daftarRevisi[0].berlakuMulaiTaId === tahunDepan.id,
  );

  const subSesudah = await prisma.subCpmk.findUniqueOrThrow({ where: { id: subDiubah.id } });
  cek("rumusan Sub-CPMK ikut berubah", subSesudah.rumusan.includes("bentuk normal ketiga"));

  const pensiunSesudah = await prisma.subCpmk.findUniqueOrThrow({
    where: { id: subDipensiun.id },
  });
  cek("Sub-CPMK dipensiunkan sejak TA berlaku", pensiunSesudah.pensiunSejakTaId === tahunDepan.id);

  const rujukanSesudah = await prisma.pertemuanSubCpmk.count({
    where: { subCpmkId: subDipensiun.id },
  });
  cek(
    "pensiun tidak menghapus baris RPKPS yang merujuknya",
    rujukanSebelum > 0 && rujukanSesudah === rujukanSebelum,
    `${rujukanSesudah} pertemuan tetap utuh`,
  );

  const kurikulumBerlaku = await muatKurikulumInput(prisma, kurikulum.id);
  const subAktif = kurikulumBerlaku!.mataKuliah[0].cpmk.flatMap((c) => c.subCpmk.map((s) => s.kode));
  cek(
    "capaian pensiun tidak lagi ditawarkan untuk RPKPS baru",
    !subAktif.includes("CPMK082-7") && subAktif.includes("CPMK082-3"),
  );

  const butirSesudah = await prisma.butirUsulan.findMany({
    where: { usulanId: usulanBaru.id },
    orderBy: { urutan: "asc" },
  });
  cek(
    "butir tertaut balik ke capaian hasilnya",
    butirSesudah[0].subCpmkId === subDiubah.id && butirSesudah[2].subCpmkId === null,
  );

  const snapshotSesudahRevisi = await prisma.rpkpsSnapshot.findUniqueOrThrow({
    where: { rpkpsId_versi: { rpkpsId: rpkps.id, versi: 1 } },
  });
  cek(
    "salinan beku RPKPS tidak tersentuh revisi kurikulum",
    snapshotSesudahRevisi.sidik === sidikSebelum,
  );

  const usulanAkhir = await prisma.usulanRevisi.findUniqueOrThrow({
    where: { id: usulanBaru.id },
  });
  cek("usulan berstatus diterapkan", usulanAkhir.status === "DITERAPKAN");

  // ── 9 · Daur hidup: hapus, arsip, salin (docs/06) ──────────────
  const sensusTerbit = await prisma.rpkps.findUniqueOrThrow({
    where: { id: rpkps.id },
    select: {
      status: true,
      _count: { select: { snapshot: true } },
      kelas: {
        select: {
          kode: true,
          evaluasi: { select: { id: true } },
          peserta: { select: { _count: { select: { nilai: true } } } },
        },
      },
    },
  });
  const kelayakanTerbit = periksaKelayakanHapus({
    status: sensusTerbit.status,
    jumlahSnapshot: sensusTerbit._count.snapshot,
    kelas: sensusTerbit.kelas.map((k) => ({
      kode: k.kode,
      jumlahPeserta: k.peserta.length,
      jumlahNilai: k.peserta.reduce((n, x) => n + x._count.nilai, 0),
      adaEvaluasi: k.evaluasi !== null,
    })),
  });
  cek(
    "RPKPS bersalinan beku ditolak untuk dihapus",
    !kelayakanTerbit.boleh && kelayakanTerbit.alasan.some((a) => a.includes("SHA-256")),
    kelayakanTerbit.alasan.length + " alasan",
  );

  // Draf bersih pada tahun berikutnya: satu-satunya bentuk yang boleh dihapus.
  const drafBersih = await prisma.rpkps.create({
    data: {
      mataKuliahId: mk.id,
      tahunAkademikId: tahunDepan.id,
      status: "DRAF",
      pertemuan: { create: [{ minggu: 1, topik: "Pendahuluan" }, { minggu: 2 }] },
      komponenNilai: { create: [{ nama: "UTS", bobot: 40, urutan: 0 }] },
      kelas: { create: [{ kode: "A" }] },
    },
    select: { id: true },
  });

  const sensusDraf = await prisma.rpkps.findUniqueOrThrow({
    where: { id: drafBersih.id },
    select: {
      status: true,
      _count: { select: { snapshot: true } },
      kelas: {
        select: {
          kode: true,
          evaluasi: { select: { id: true } },
          peserta: { select: { _count: { select: { nilai: true } } } },
        },
      },
    },
  });
  cek(
    "draf berkelas KOSONG tetap boleh dihapus",
    periksaKelayakanHapus({
      status: sensusDraf.status,
      jumlahSnapshot: sensusDraf._count.snapshot,
      kelas: sensusDraf.kelas.map((k) => ({
        kode: k.kode,
        jumlahPeserta: k.peserta.length,
        jumlahNilai: 0,
        adaEvaluasi: k.evaluasi !== null,
      })),
    }).boleh,
  );

  await prisma.rpkps.delete({ where: { id: drafBersih.id } });
  const sisa =
    (await prisma.pertemuan.count({ where: { rpkpsId: drafBersih.id } })) +
    (await prisma.komponenNilai.count({ where: { rpkpsId: drafBersih.id } })) +
    (await prisma.kelas.count({ where: { rpkpsId: drafBersih.id } }));
  cek("penghapusan menyapu bersih seluruh anak lewat cascade", sisa === 0);

  // Arsip menarik dari katalog publik tanpa melenyapkan apa pun.
  const snapshotSebelumArsip = await prisma.rpkpsSnapshot.count({
    where: { rpkpsId: rpkps.id },
  });
  await prisma.rpkps.update({ where: { id: rpkps.id }, data: { status: "ARSIP" } });
  const takTampilPublik = await prisma.rpkps.count({
    where: { id: rpkps.id, status: "TERBIT" },
  });
  const snapshotSesudahArsip = await prisma.rpkpsSnapshot.count({
    where: { rpkpsId: rpkps.id },
  });
  cek(
    "arsip menghilangkan RPKPS dari saringan publik tanpa menyentuh salinan beku",
    takTampilPublik === 0 && snapshotSesudahArsip === snapshotSebelumArsip,
    `${snapshotSesudahArsip} salinan beku utuh`,
  );
  cek(
    "pemulihan mengembalikan status TERBIT karena salinan beku versi ini ada",
    statusSetelahPulih(snapshotSesudahArsip > 0) === "TERBIT",
  );
  await prisma.rpkps.update({ where: { id: rpkps.id }, data: { status: "TERBIT" } });

  // ── 10 · Struktur mingguan manual (docs/09) ────────────────────
  //
  // Bagian ini menguji yang TIDAK dapat diuji secara murni: penomoran ulang
  // yang harus lolos `@@unique([rpkpsId, minggu])`, dan pemindahan
  // `nilai_asesmen.asesmen_kode` yang harus lolos
  // `@@unique([pesertaKelasId, asesmenKode])`.
  const struktur = await prisma.rpkps.create({
    data: {
      mataKuliahId: mk.id,
      tahunAkademikId: tahunDepan.id,
      status: "DRAF",
      pertemuan: {
        create: [
          { minggu: 1, topik: "Mg1", bobot: 10 },
          { minggu: 2, topik: "Mg2", bobot: 20 },
          { minggu: 3, topik: "Mg3", bobot: 0 },
          { minggu: 4, topik: "Mg4", bobot: 30 },
          { minggu: 5, topik: "Mg5", bobot: 40 },
        ],
      },
      komponenNilai: { create: [{ nama: "UTS", bobot: 100, urutan: 0 }] },
      tugas: {
        create: [
          {
            nomor: 1,
            nama: "Tugas besar",
            mingguMulai: 2,
            mingguSelesai: 4,
            deskripsi: "Rancang dan bangun.",
            linimasa: { create: [{ minggu: 3, tahapan: "Proposal", aktivitas: "Menyusun proposal" }] },
          },
        ],
      },
      kelas: { create: [{ kode: "A" }] },
    },
    select: { id: true, kelas: { select: { id: true } } },
  });

  const mhs = await prisma.mahasiswa.create({
    data: { prodiId: prodi.id, nim: "2025001", nama: "Mahasiswa Uji" },
  });
  const peserta = await prisma.pesertaKelas.create({
    data: { kelasId: struktur.kelas[0].id, mahasiswaId: mhs.id },
  });
  await prisma.nilaiAsesmen.createMany({
    data: [
      { pesertaKelasId: peserta.id, asesmenKode: "M1", skor: 70 },
      { pesertaKelasId: peserta.id, asesmenKode: "M2", skor: 80 },
      { pesertaKelasId: peserta.id, asesmenKode: "M4", skor: 90 },
      { pesertaKelasId: peserta.id, asesmenKode: "M5", skor: 60 },
    ],
  });

  const petaTopik = async () =>
    (await barisMingguan(prisma, struktur.id)).length === 0
      ? ""
      : (
          await prisma.pertemuan.findMany({
            where: { rpkpsId: struktur.id },
            orderBy: { minggu: "asc" },
            select: { minggu: true, topik: true },
          })
        )
          .map((p) => `${p.minggu}:${p.topik ?? "-"}`)
          .join(" ");

  const petaNilai = async () =>
    (
      await prisma.nilaiAsesmen.findMany({
        where: { peserta: { kelas: { rpkpsId: struktur.id } } },
        orderBy: { skor: "asc" },
        select: { asesmenKode: true, skor: true },
      })
    )
      .map((n) => `${n.asesmenKode}=${Number(n.skor)}`)
      .join(" ");

  // Sisip setelah minggu 1: 2→3, 3→4, 4→5, 5→6 — pergeseran yang menabrak
  // dirinya sendiri bila dikerjakan satu fase.
  const hasilSisip = await terapkanStruktur(prisma, struktur.id, { jenis: "SISIP", setelah: 1 });
  cek("sisip pertemuan berhasil", hasilSisip.ok, hasilSisip.pesan);
  cek(
    "isi baris ikut bergeser bersama nomornya, baris baru kosong di minggu 2",
    (await petaTopik()) === "1:Mg1 2:- 3:Mg2 4:Mg3 5:Mg4 6:Mg5",
    await petaTopik(),
  );
  cek(
    "nilai ikut berpindah kode: M2→M3, M4→M5, M5→M6 (M3 lama tanpa bobot tak berkode)",
    (await petaNilai()) === "M6=60 M1=70 M3=80 M5=90",
    await petaNilai(),
  );

  const tugasSesudah = await prisma.tugas.findFirstOrThrow({
    where: { rpkpsId: struktur.id },
    select: { mingguMulai: true, mingguSelesai: true, linimasa: { select: { minggu: true } } },
  });
  cek(
    "rujukan minggu pada tugas dan linimasa ikut digeser",
    tugasSesudah.mingguMulai === 3 &&
      tugasSesudah.mingguSelesai === 5 &&
      tugasSesudah.linimasa[0]?.minggu === 4,
    `${tugasSesudah.mingguMulai}–${tugasSesudah.mingguSelesai}, linimasa ${tugasSesudah.linimasa[0]?.minggu}`,
  );

  // Geser: tukar dua nomor sekaligus — kasus tabrakan paling langsung.
  const hasilGeser = await terapkanStruktur(prisma, struktur.id, {
    jenis: "GESER",
    minggu: 3,
    arah: "NAIK",
  });
  cek("geser pertemuan berhasil", hasilGeser.ok, hasilGeser.pesan);
  cek(
    "dua baris bertukar nomor tanpa menabrak kunci unik",
    (await petaTopik()) === "1:Mg1 2:Mg2 3:- 4:Mg3 5:Mg4 6:Mg5",
    await petaTopik(),
  );
  cek(
    "nilai baris yang digeser ikut pindah: M3→M2",
    (await petaNilai()) === "M6=60 M1=70 M2=80 M5=90",
    await petaNilai(),
  );

  // Hapus: nilai baris yang lenyap TIDAK ikut dihapus, hanya menganggur.
  const hasilHapus = await terapkanStruktur(prisma, struktur.id, { jenis: "HAPUS", minggu: 2 });
  cek("hapus pertemuan berhasil", hasilHapus.ok, hasilHapus.pesan);
  cek(
    "baris sesudahnya naik satu nomor",
    (await petaTopik()) === "1:Mg1 2:- 3:Mg3 4:Mg4 5:Mg5",
    await petaTopik(),
  );
  cek(
    "nilai M2 menganggur, tidak ikut terhapus; sisanya bergeser turun",
    (await petaNilai()) === "M5=60 M1=70 M2=80 M4=90",
    await petaNilai(),
  );

  const hasilTambah = await terapkanStruktur(prisma, struktur.id, { jenis: "TAMBAH" });
  cek(
    "tambah pertemuan mendarat di akhir dengan alokasi waktu terisi",
    hasilTambah.ok && hasilTambah.nomorBaru === 6,
    `minggu ${hasilTambah.nomorBaru}`,
  );
  const menitBaru = await prisma.aktivitasBelajar.aggregate({
    where: { pertemuan: { rpkpsId: struktur.id, minggu: 6 } },
    _sum: { menit: true },
  });
  const paguMinggu6 = rencana.minggu.find((m) => m.minggu === 6)?.pagu.total ?? 0;
  cek(
    "alokasi baris baru sama dengan pagu minggunya",
    (menitBaru._sum.menit ?? 0) === paguMinggu6,
    `${menitBaru._sum.menit} dari pagu ${paguMinggu6}`,
  );

  const hasilJenis = await terapkanStruktur(prisma, struktur.id, {
    jenis: "UBAH_JENIS",
    minggu: 4,
    ke: "UTS",
  });
  cek("ubah jenis pertemuan berhasil", hasilJenis.ok, hasilJenis.pesan);
  cek(
    "nilai M4 berpindah ke kode UTS mengikuti jenis barisnya",
    (await petaNilai()) === "M5=60 M1=70 M2=80 UTS=90",
    await petaNilai(),
  );

  const hasilSusunUlang = await susunUlangKerangkaDb(prisma, struktur.id);
  cek(
    "susun ulang kerangka mengembalikan tabel utuh sesuai kebijakan",
    hasilSusunUlang.ok &&
      (await prisma.pertemuan.count({ where: { rpkpsId: struktur.id } })) ===
        KEBIJAKAN_BAWAAN.mingguPerSemester,
    hasilSusunUlang.pesan,
  );
  cek(
    "nilai mahasiswa tetap ada setelah kerangka disusun ulang, hanya menganggur",
    (await prisma.nilaiAsesmen.count({
      where: { peserta: { kelas: { rpkpsId: struktur.id } } },
    })) === 4,
  );

  await prisma.rpkps.delete({ where: { id: struktur.id } });

  // ── 11 · Komponen nilai: identitas baris harus bertahan ────────
  //
  // Menyimpan daftar dengan cara hapus-lalu-buat-ulang memberi tiap komponen
  // id baru, sehingga `onDelete: SetNull` melepas SELURUH tautan pertemuan dan
  // tugas tanpa pesan apa pun. Uji domain tidak dapat melihatnya; hanya
  // Postgres sungguhan yang bisa.
  const tugasProyek = await prisma.tugas.findFirstOrThrow({ where: { rpkpsId: rpkps.id } });
  await prisma.tugas.update({
    where: { id: tugasProyek.id },
    data: { komponenNilaiId: komponenTugas.id },
  });

  /** Tautan dicatat sebagai id, bukan nama, supaya kebal terhadap penggantian nama. */
  const petaTautan = async () => {
    const p = await prisma.pertemuan.findMany({
      where: { rpkpsId: rpkps.id, komponenNilaiId: { not: null } },
      select: { minggu: true, komponenNilaiId: true },
      orderBy: { minggu: "asc" },
    });
    const t = await prisma.tugas.findMany({
      where: { rpkpsId: rpkps.id, komponenNilaiId: { not: null } },
      select: { nomor: true, komponenNilaiId: true },
      orderBy: { nomor: "asc" },
    });
    return [
      ...p.map((b) => `M${b.minggu}=${b.komponenNilaiId}`),
      ...t.map((b) => `T${b.nomor}=${b.komponenNilaiId}`),
    ].join(" ");
  };
  const daftarKomponen = () =>
    prisma.komponenNilai.findMany({
      where: { rpkpsId: rpkps.id },
      orderBy: { urutan: "asc" },
      select: { id: true, nama: true, bobot: true },
    });
  const kirim = (
    baris: { id: string; nama: string; bobot: unknown }[],
    ubah: (k: { id: string; nama: string }) => string = (k) => k.nama,
  ) => baris.map((k) => ({ id: k.id, nama: ubah(k), namaEn: null, bobot: Number(k.bobot) }));

  /** Rangkuman pendek untuk keluaran; perbandingannya tetap atas peta lengkap. */
  const ringkas = (peta: string) => `${peta.split(" ").filter(Boolean).length} tautan`;

  const tautanAwal = await petaTautan();
  cek("tautan awal terpasang", tautanAwal.includes("T1="), ringkas(tautanAwal));

  const simpanUlang = await tulisKomponenNilai(prisma, rpkps.id, kirim(await daftarKomponen()));
  cek(
    "menyimpan daftar yang sama tidak melepas satu tautan pun",
    simpanUlang.ok && (await petaTautan()) === tautanAwal,
    ringkas(await petaTautan()),
  );

  const hasilGanti = await tulisKomponenNilai(prisma, rpkps.id, [
    ...kirim(await daftarKomponen(), (k) => (k.nama === "Tugas" ? "Tugas Besar" : k.nama)),
    { id: null, nama: "Kuis", namaEn: null, bobot: 0 },
  ]);
  cek(
    "ganti nama dan tambah komponen tidak menyentuh tautan yang ada",
    hasilGanti.ok && (await petaTautan()) === tautanAwal,
    ringkas(await petaTautan()),
  );
  cek(
    "komponen baru bertambah tanpa membuat ulang yang lama",
    (await prisma.komponenNilai.count({ where: { rpkpsId: rpkps.id } })) === 4,
  );

  const hasilTukar = await tulisKomponenNilai(
    prisma,
    rpkps.id,
    kirim(await daftarKomponen(), (k) =>
      k.nama === "UTS" ? "UAS" : k.nama === "UAS" ? "UTS" : k.nama,
    ),
  );
  cek(
    "menukar nama dua komponen tidak menabrak @@unique([rpkpsId, nama])",
    hasilTukar.ok && (await petaTautan()) === tautanAwal,
    hasilTukar.ok ? ringkas(await petaTautan()) : hasilTukar.galat,
  );

  const sisaKomponen = (await daftarKomponen()).filter((k) => k.id !== komponenTugas.id);
  const hasilBuangKomponen = await tulisKomponenNilai(prisma, rpkps.id, kirim(sisaKomponen));
  cek(
    "membuang komponen melaporkan berapa baris yang kehilangan tautannya",
    hasilBuangKomponen.ok && hasilBuangKomponen.lepasTugas === 1 && hasilBuangKomponen.lepasPertemuan > 0,
    hasilBuangKomponen.ok ? `${hasilBuangKomponen.lepasPertemuan} pertemuan, ${hasilBuangKomponen.lepasTugas} tugas` : hasilBuangKomponen.galat,
  );
  cek(
    "hanya baris milik komponen yang dibuang yang terlepas",
    (await petaTautan()) ===
      tautanAwal
        .split(" ")
        .filter((x) => !x.endsWith(`=${komponenTugas.id}`))
        .join(" "),
    ringkas(await petaTautan()),
  );

  // ── 12 · Notifikasi: urutan "belum dibaca lebih dulu" ─────────
  //
  // Yang diuji di sini bukan kalimatnya — itu murni dan sudah diuji domain —
  // melainkan hal yang hanya database yang tahu: enum `JenisNotifikasi` yang
  // baru, dan pengurutan `dibaca_pada` dengan NULL didahulukan, yang gagal
  // saat dijalankan bila sintaksnya tidak diterima.
  const kabar = async (judul: string, dibacaPada: Date | null) =>
    prisma.notifikasi.create({
      data: {
        penggunaId: pengguna.id,
        jenis: "RPKPS_DIAJUKAN",
        judul,
        ringkasan: `ringkasan ${judul}`,
        tautan: `/rpkps/${rpkps.id}`,
        entitas: "rpkps",
        entitasId: rpkps.id,
        dibacaPada,
        dibuatPada: new Date(Date.now() - (dibacaPada ? 0 : 60_000)),
      },
    });
  await kabar("sudah dibaca", new Date());
  await kabar("belum dibaca A", null);
  await kabar("belum dibaca B", null);

  const belum = await prisma.notifikasi.count({
    where: { penggunaId: pengguna.id, dibacaPada: null },
  });
  cek("notifikasi belum dibaca terhitung", belum === 2, `${belum}`);

  const urut = await prisma.notifikasi.findMany({
    where: { penggunaId: pengguna.id },
    orderBy: [{ dibacaPada: { sort: "asc", nulls: "first" } }, { dibuatPada: "desc" }],
    select: { judul: true },
  });
  cek(
    "yang belum dibaca berada di atas, yang terbaru lebih dulu",
    urut.map((n) => n.judul).join(" | ") ===
      "belum dibaca B | belum dibaca A | sudah dibaca",
    urut.map((n) => n.judul).join(" | "),
  );

  await prisma.notifikasi.updateMany({
    where: { penggunaId: pengguna.id, dibacaPada: null },
    data: { dibacaPada: new Date() },
  });
  cek(
    "tandai semua dibaca menyisakan nol",
    (await prisma.notifikasi.count({
      where: { penggunaId: pengguna.id, dibacaPada: null },
    })) === 0,
  );

  // Tenggat: kolom baru pada tahun akademik, dinilai domain yang sama dengan UI.
  await prisma.tahunAkademik.update({
    where: { id: tahun.id },
    data: { tenggatPenyusunan: new Date(Date.now() - 2 * 86_400_000) },
  });
  const taTenggat = await prisma.tahunAkademik.findUniqueOrThrow({ where: { id: tahun.id } });
  const nilai = nilaiTenggatDokumen({
    status: "DRAF",
    tenggat: {
      penyusunan: taTenggat.tenggatPenyusunan,
      review: taTenggat.tenggatReview,
      pengesahan: taTenggat.tenggatPengesahan,
    },
    diajukanPada: null,
    disetujuiPada: null,
    jaminanHari: taTenggat.jaminanHariPutusan,
    sekarang: new Date(),
  });
  cek("tenggat terbaca kembali dan dinilai terlambat", nilai.tingkat === "LEWAT", nilai.label);

  // ── 13 · Kunci optimistik: penyimpanan yang kalah balapan ─────
  //
  // Yang dibuktikan di sini adalah mekanismenya, bukan aksinya: (a) `@updatedAt`
  // benar-benar bergerak setiap kali baris ditulis — bila tidak, kunci ini tidak
  // pernah menyala sama sekali; dan (b) `updateMany` dengan cap pada `where`
  // menolak penulisan basi TANPA menyentuh isi baris.
  const barisM1 = await prisma.pertemuan.findFirstOrThrow({
    where: { rpkpsId: rpkps.id, minggu: 1 },
    select: { id: true, topik: true, diubahPada: true },
  });
  const capLama = barisM1.diubahPada;

  // Penyunting kedua menyimpan lebih dahulu.
  await prisma.pertemuan.update({
    where: { id: barisM1.id },
    data: { topik: "Ditulis penyunting kedua" },
  });
  const setelahOrangLain = await prisma.pertemuan.findUniqueOrThrow({
    where: { id: barisM1.id },
    select: { topik: true, diubahPada: true },
  });
  cek(
    "cap diubah_pada bergerak setiap penyimpanan",
    setelahOrangLain.diubahPada.getTime() > capLama.getTime(),
    `${capLama.toISOString()} → ${setelahOrangLain.diubahPada.toISOString()}`,
  );

  // Penyunting pertama menekan simpan dengan cap yang sudah basi.
  const kalah = await prisma.pertemuan.updateMany({
    where: { id: barisM1.id, diubahPada: capLama },
    data: { topik: "Ditulis penyunting pertama" },
  });
  const setelahKalah = await prisma.pertemuan.findUniqueOrThrow({
    where: { id: barisM1.id },
    select: { topik: true },
  });
  cek(
    "penyimpanan dengan cap basi ditolak dan tidak menimpa apa pun",
    kalah.count === 0 && setelahKalah.topik === "Ditulis penyunting kedua",
    `count=${kalah.count} topik="${setelahKalah.topik}"`,
  );

  // Setelah memuat ulang, penyimpanan yang sama berhasil.
  const menang = await prisma.pertemuan.updateMany({
    where: { id: barisM1.id, diubahPada: setelahOrangLain.diubahPada },
    data: { topik: "Ditulis setelah memuat ulang" },
  });
  cek(
    "dengan cap segar, penyimpanan yang sama diterima",
    menang.count === 1 &&
      (await prisma.pertemuan.findUniqueOrThrow({
        where: { id: barisM1.id },
        select: { topik: true },
      })).topik === "Ditulis setelah memuat ulang",
    `count=${menang.count}`,
  );


  // ── 14 · Gerbang penyuntingan kurikulum langsung (docs/15) ─────
  //
  // Yang diuji di sini BUKAN putusannya — itu sudah ditutup uji domain dengan
  // data karangan. Yang diuji adalah SENSUS-nya: apakah kueri Prisma benar
  // menemukan RPKPS terbit, salinan beku, dan baris mingguan yang menggantung
  // pada capaian. Sensus yang salah relasi membuat gerbang menjawab "boleh"
  // untuk baris yang sesungguhnya menopang dokumen sah.

  cek(
    "G1 menolak kurikulum BERLAKU dan mengarahkan ke usulan revisi",
    !bolehSuntingKurikulum("BERLAKU").boleh &&
      bolehSuntingKurikulum("BERLAKU").alasan.join(" ").includes("Usulan Revisi"),
  );
  cek("G1 mengizinkan kurikulum DRAF", bolehSuntingKurikulum("DRAF").boleh);

  // TI214 menggantung RPKPS terbit bersalinan beku (bagian 8).
  const sensusMk = await sensusMataKuliah(prisma, mk.id);
  cek(
    "sensus mata kuliah menemukan RPKPS beserta salinan bekunya",
    sensusMk !== null &&
      sensusMk.rpkps.length > 0 &&
      sensusMk.rpkps.some((r) => r.jumlahSnapshot > 0),
    `${sensusMk?.rpkps.length ?? 0} RPKPS`,
  );
  const hapusMk = periksaKelayakanHapusMk(sensusMk!);
  cek(
    "mata kuliah ber-RPKPS ditolak untuk dihapus, menyebut kodenya",
    !hapusMk.boleh && hapusMk.alasan.join(" ").includes(mk.kode),
    hapusMk.alasan.join(" ").slice(0, 90),
  );

  // Sub-CPMK yang dirujuk baris mingguan: cascade-nya melenyapkan baris itu.
  const subTerpakai = await prisma.subCpmk.findFirstOrThrow({
    where: { cpmk: { mataKuliahId: mk.id }, pertemuan: { some: {} } },
    select: { id: true, kode: true, cpmkId: true },
  });
  const sensusSub = await sensusSubCpmk(prisma, subTerpakai.id);
  cek(
    "sensus Sub-CPMK menghitung rujukan baris mingguan",
    sensusSub !== null && sensusSub.jumlahPertemuan > 0,
    `${sensusSub?.jumlahPertemuan} pertemuan, ${sensusSub?.jumlahTugas} tugas, ${sensusSub?.jumlahButirKisiKisi} butir`,
  );
  const hapusSub = periksaKelayakanHapusSubCpmk(sensusSub!);
  cek(
    "Sub-CPMK terpakai ditolak — capaian dipensiunkan, tidak dihapus",
    !hapusSub.boleh && hapusSub.alasan.join(" ").includes("dipensiunkan"),
  );

  // CPMK mewarisi penolakan dari Sub-CPMK di bawahnya.
  const sensusCpmkTerpakai = await sensusCpmk(prisma, subTerpakai.cpmkId);
  const hapusCpmkTerpakai = periksaKelayakanHapusCpmk(sensusCpmkTerpakai!);
  cek(
    "CPMK mewarisi penolakan dari Sub-CPMK yang dirujuk dokumen",
    !hapusCpmkTerpakai.boleh &&
      hapusCpmkTerpakai.alasan.join(" ").includes(subTerpakai.kode),
    `${hapusCpmkTerpakai.alasan.length} alasan`,
  );

  // CPL yang dibebankan pada MK ber-RPKPS.
  const sensusCplBeban = await sensusCpl(prisma, cpl06.id);
  cek(
    "sensus CPL menembus matriks CPL×MK sampai ke RPKPS",
    sensusCplBeban !== null && sensusCplBeban.rpkps.length > 0,
    `${sensusCplBeban?.rpkps.length ?? 0} RPKPS, ${sensusCplBeban?.jumlahCpmk ?? 0} CPMK`,
  );
  cek(
    "CPL yang menopang dokumen terbit ditolak untuk dihapus",
    !periksaKelayakanHapusCpl(sensusCplBeban!).boleh,
  );

  // Lubang yang ditambal bersama fitur ini (docs/15, lampiran): kurikulum
  // ARSIP pun menjangkau rpkps_snapshot lewat cascade.
  const gantungKurikulum = await sensusKurikulum(prisma, kurikulum.id);
  cek(
    "sensus kurikulum menemukan seluruh RPKPS di bawahnya",
    gantungKurikulum.length > 0,
    `${gantungKurikulum.length} RPKPS — hapusKurikulum wajib menolak`,
  );

  // Matriks CPL×MK: melepas CPL harus ikut merapikan peta CPMK×CPL, kalau
  // tidak ada CPMK yang menunjuk CPL yang tak lagi dibebankan padanya.
  const petaSebelum = await prisma.petaCpmkCpl.count({
    where: { cpmk: { mataKuliahId: mk.id }, cplId: cpl06.id },
  });
  await setelMatriksCplMk(prisma, mk.id, [cpl08.id]);
  const petaSesudah = await prisma.petaCpmkCpl.count({
    where: { cpmk: { mataKuliahId: mk.id }, cplId: cpl06.id },
  });
  cek(
    "melepas CPL dari mata kuliah ikut melepas peta CPMK×CPL yang basi",
    petaSebelum > 0 && petaSesudah === 0,
    `${petaSebelum} → ${petaSesudah}`,
  );

  // notIn: [] pada Prisma bernilai selalu benar — tanpa CPL yang dibebankan,
  // tak satu pun pemetaan CPMK→CPL masih sah.
  await setelMatriksCplMk(prisma, mk.id, []);
  const petaKosong = await prisma.petaCpmkCpl.count({
    where: { cpmk: { mataKuliahId: mk.id } },
  });
  cek(
    "melepas SELURUH CPL mengosongkan peta CPMK×CPL (notIn: [] = selalu benar)",
    petaKosong === 0,
    `sisa ${petaKosong}`,
  );

  // ── E2 · Unggah nilai kelas ────────────────────────────────────
  //
  // `simpanNilaiKelas` menulis mahasiswa, peserta, dan skor sekaligus di dalam
  // satu transaksi interaktif. Versi pertamanya melakukannya baris per baris
  // dan melewati batas waktu transaksi pada ukuran kelas biasa; yang diperiksa
  // di sini adalah bahwa versi jamaknya tetap punya SEMANTIK yang sama —
  // termasuk pada bagian yang mudah hilang saat penulisan dijamakkan.
  //
  // Fixture-nya berdiri sendiri: RPKPS `struktur` sudah dihapus bagian daur
  // hidup di atas, dan uji ini tidak boleh bergantung pada urutan itu.
  const taNilai = await prisma.tahunAkademik.create({
    data: {
      kode: "2029/2030-GANJIL",
      tahunMulai: 2029,
      tahunSelesai: 2030,
      semester: "GANJIL",
    },
  });
  const subUntukButir = await prisma.subCpmk.findFirstOrThrow({
    where: { cpmk: { mataKuliahId: mk.id } },
    select: { id: true },
  });
  const rpkpsNilai = await prisma.rpkps.create({
    data: {
      mataKuliahId: mk.id,
      tahunAkademikId: taNilai.id,
      status: "DRAF",
      kisiKisi: {
        create: {
          jenis: "UTS",
          butir: {
            create: [
              { nomor: 1, subCpmkId: subUntukButir.id, levelBloom: "C2", skor: 50 },
              { nomor: 2, subCpmkId: subUntukButir.id, levelBloom: "C3", skor: 50 },
            ],
          },
        },
      },
    },
    select: { id: true },
  });

  const kelasNilai = await prisma.kelas.create({
    data: { rpkpsId: rpkpsNilai.id, kode: "Z" },
    select: { id: true },
  });

  const unggah1 = await simpanNilaiKelas(prisma, {
    kelasId: kelasNilai.id,
    prodiId: prodi.id,
    kolomDikenal: ["M1", "M3"],
    baris: [
      { nim: "2026001", nama: "Adi", angkatan: 2026, skor: { M1: 70, M3: 80 } },
      { nim: "2026002", nama: "Budi", angkatan: null, skor: { M1: 60, M3: null } },
    ],
  });
  cek(
    "unggah pertama membuat mahasiswa, peserta, dan skor",
    unggah1.mahasiswaBaru === 2 && unggah1.pesertaBaru === 2 && unggah1.skorDisimpan === 3,
    `mhs ${unggah1.mahasiswaBaru}, peserta ${unggah1.pesertaBaru}, skor ${unggah1.skorDisimpan}`,
  );

  const bacaNilaiKelas = async () =>
    (
      await prisma.nilaiAsesmen.findMany({
        where: { peserta: { kelasId: kelasNilai.id } },
        orderBy: [{ peserta: { mahasiswa: { nim: "asc" } } }, { asesmenKode: "asc" }],
        select: {
          id: true,
          asesmenKode: true,
          skor: true,
          dibuatPada: true,
          peserta: { select: { mahasiswa: { select: { nim: true } } } },
        },
      })
    ).map((n) => ({ ...n, nim: n.peserta.mahasiswa.nim }));

  const sesudah1 = await bacaNilaiKelas();
  cek(
    "sel kosong tidak menjadi nol — ia memang tidak ditulis",
    sesudah1.map((n) => `${n.nim}/${n.asesmenKode}=${Number(n.skor)}`).join(" ") ===
      "2026001/M1=70 2026001/M3=80 2026002/M1=60",
    sesudah1.map((n) => `${n.nim}/${n.asesmenKode}=${Number(n.skor)}`).join(" "),
  );

  // Kolom di luar `kolomDikenal` tidak boleh tersentuh unggahan berikutnya:
  // berkas yang hanya memuat sebagian asesmen adalah hal biasa.
  const pesertaAdi = await prisma.pesertaKelas.findFirstOrThrow({
    where: { kelasId: kelasNilai.id, mahasiswa: { nim: "2026001" } },
    select: { id: true },
  });
  await prisma.nilaiAsesmen.create({
    data: { pesertaKelasId: pesertaAdi.id, asesmenKode: "M5", skor: 55 },
  });

  const idSebelum = new Map(sesudah1.map((n) => [`${n.nim}/${n.asesmenKode}`, n.id]));
  const dibuatSebelum = new Map(
    sesudah1.map((n) => [`${n.nim}/${n.asesmenKode}`, n.dibuatPada.getTime()]),
  );

  const unggah2 = await simpanNilaiKelas(prisma, {
    kelasId: kelasNilai.id,
    prodiId: prodi.id,
    kolomDikenal: ["M1", "M3"],
    baris: [
      // M1 tetap 70 (tak berubah), M3 dikosongkan → ditarik kembali.
      { nim: "2026001", nama: "Adi Diganti", angkatan: 2020, skor: { M1: 70, M3: null } },
      // Skor berubah, dan angkatan yang tadinya kosong kini terisi.
      { nim: "2026002", nama: "Budi", angkatan: 2026, skor: { M1: 65, M3: 90 } },
    ],
  });
  cek(
    "unggah ulang tidak membuat mahasiswa atau peserta baru",
    unggah2.mahasiswaBaru === 0 && unggah2.pesertaBaru === 0,
    `mhs ${unggah2.mahasiswaBaru}, peserta ${unggah2.pesertaBaru}`,
  );
  cek(
    "sel yang dikosongkan dihapus, bukan disimpan sebagai nol",
    unggah2.skorDihapus === 1,
    `dihapus ${unggah2.skorDihapus}`,
  );

  const sesudah2 = await bacaNilaiKelas();
  const peta2 = new Map(sesudah2.map((n) => [`${n.nim}/${n.asesmenKode}`, n]));
  cek(
    "kolom di luar berkas tidak tersentuh",
    Number(peta2.get("2026001/M5")?.skor) === 55,
    `M5 = ${peta2.get("2026001/M5")?.skor}`,
  );
  cek(
    "baris yang sudah ada diperbarui di tempat — id dan dibuat_pada bertahan",
    peta2.get("2026001/M1")?.id === idSebelum.get("2026001/M1") &&
      peta2.get("2026002/M1")?.id === idSebelum.get("2026002/M1") &&
      peta2.get("2026001/M1")?.dibuatPada.getTime() === dibuatSebelum.get("2026001/M1") &&
      peta2.get("2026002/M1")?.dibuatPada.getTime() === dibuatSebelum.get("2026002/M1"),
    `M1 Budi ${Number(peta2.get("2026002/M1")?.skor)}`,
  );

  const mhsSesudah = await prisma.mahasiswa.findMany({
    where: { prodiId: prodi.id, nim: { in: ["2026001", "2026002"] } },
    orderBy: { nim: "asc" },
    select: { nim: true, nama: true, angkatan: true },
  });
  cek(
    "angkatan hanya DIISI bila kosong, dan nama tidak pernah ditimpa berkas nilai",
    mhsSesudah[0].angkatan === 2026 &&
      mhsSesudah[0].nama === "Adi" &&
      mhsSesudah[1].angkatan === 2026,
    mhsSesudah.map((m) => `${m.nim} ${m.nama} ${m.angkatan}`).join(" | "),
  );

  // Sekelas penuh sekaligus: yang dijaga adalah jumlah kueri per transaksi
  // tidak ikut membesar. Di sini yang dapat diperiksa hasilnya — 60 × 8 sel
  // masuk utuh dalam satu transaksi, tanpa dipecah per baris.
  const kelasBesar = await prisma.kelas.create({
    data: { rpkpsId: rpkpsNilai.id, kode: "Y" },
    select: { id: true },
  });
  const kolomBesar = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8"];
  const unggahBesar = await simpanNilaiKelas(prisma, {
    kelasId: kelasBesar.id,
    prodiId: prodi.id,
    kolomDikenal: kolomBesar,
    baris: Array.from({ length: 60 }, (_, i) => ({
      nim: `2027${String(i).padStart(3, "0")}`,
      nama: `Mahasiswa ${i}`,
      angkatan: 2027,
      skor: Object.fromEntries(kolomBesar.map((k, j) => [k, (i + j) % 101])),
    })),
  });
  const selBesar = await prisma.nilaiAsesmen.count({
    where: { peserta: { kelasId: kelasBesar.id } },
  });
  cek(
    "satu kelas penuh (60 × 8 sel) masuk dalam satu transaksi",
    unggahBesar.pesertaBaru === 60 && selBesar === 480,
    `peserta ${unggahBesar.pesertaBaru}, sel ${selBesar}`,
  );

  // Skor per butir mengikuti aturan yang sama, ditambah satu: NIM yang belum
  // terdaftar di kelas DILEWATI, bukan dibuat.
  const butirUji = await prisma.butirKisiKisi.findMany({
    where: { kisiKisi: { rpkpsId: rpkpsNilai.id } },
    orderBy: { nomor: "asc" },
    select: { id: true, nomor: true },
    take: 2,
  });
  if (butirUji.length === 2) {
    const butirId = new Map(butirUji.map((b) => [b.nomor, b.id]));
    const hasilButir = await simpanSkorButir(prisma, {
      kelasId: kelasNilai.id,
      butirId,
      peserta: [
        { nim: "2026001", skor: { [butirUji[0].nomor]: 5, [butirUji[1].nomor]: null } },
        { nim: "9999999", skor: { [butirUji[0].nomor]: 5 } },
      ],
    });
    const selButir = await prisma.nilaiButir.count({
      where: { peserta: { kelasId: kelasNilai.id } },
    });
    cek(
      "skor butir tersimpan, NIM asing dilaporkan tanpa membuat peserta baru",
      hasilButir.skorDisimpan === 1 &&
        selButir === 1 &&
        hasilButir.nimTakDikenal.join() === "9999999",
      `disimpan ${hasilButir.skorDisimpan}, sel ${selButir}, asing ${hasilButir.nimTakDikenal.join()}`,
    );
  }

  // ── 15 · Penerapan terjemahan: satu kueri per kolom (docs/11 §8.5) ──
  //
  // Satu-satunya SQL tulis-tangan di aplikasi ini. `Prisma.raw` tidak
  // memvalidasi apa pun — nama tabel yang salah, cast yang kurang, atau
  // `VALUES` yang tidak dapat ditentukan tipenya baru terlihat saat
  // dieksekusi. Karena itu ia dijalankan di sini, terhadap Postgres sungguhan.
  const barisTerjemah = await prisma.pertemuan.findMany({
    where: { rpkpsId: rpkps.id },
    orderBy: { minggu: "asc" },
    take: 3,
    select: { id: true, minggu: true, topik: true },
  });
  const tugasTerjemah = await prisma.tugas.findFirstOrThrow({
    where: { rpkpsId: rpkps.id },
    select: { id: true, nama: true },
  });

  const alamatSah = [
    ...barisTerjemah.map((b) => `pertemuan:${b.id}:topikEn`),
    ...barisTerjemah.map((b) => `pertemuan:${b.id}:metodeNarasiEn`),
    `tugas:${tugasTerjemah.id}:namaEn`,
  ];
  const pilihanTerjemah = [
    ...alamatSah.map((alamat, i) => ({ alamat, teks: `EN ${i + 1}` })),
    // Racun 1: kolom bahasa Indonesia. Racun 2: baris milik dokumen lain.
    { alamat: `pertemuan:${barisTerjemah[0].id}:topik`, teks: "ditimpa" },
    { alamat: `pertemuan:tidak-ada-baris-ini:topikEn`, teks: "ditimpa" },
    // Racun 3: teks kosong bukan terjemahan, ia hanya centang yang terlanjur.
    { alamat: `tugas:${tugasTerjemah.id}:deskripsiEn`, teks: "   " },
  ];

  const { kelompok, jumlah } = kelompokkanTerjemahan(new Set(alamatSah), pilihanTerjemah);
  cek(
    "pilihan dikelompokkan per kolom, bukan per baris",
    jumlah === alamatSah.length && kelompok.length === 3,
    `${jumlah} medan dalam ${kelompok.length} kueri`,
  );

  await tulisTerjemahan(prisma, kelompok);

  const sesudahTerjemah = await prisma.pertemuan.findMany({
    where: { id: { in: barisTerjemah.map((b) => b.id) } },
    orderBy: { minggu: "asc" },
    select: { id: true, topik: true, topikEn: true, metodeNarasiEn: true },
  });
  const tugasTerjemahSesudah = await prisma.tugas.findUniqueOrThrow({
    where: { id: tugasTerjemah.id },
    select: { nama: true, namaEn: true, deskripsiEn: true },
  });

  cek(
    "kolom *En terisi pada seluruh baris kelompok",
    sesudahTerjemah.every((b) => (b.topikEn ?? "").startsWith("EN ")) &&
      sesudahTerjemah.every((b) => (b.metodeNarasiEn ?? "").startsWith("EN ")) &&
      tugasTerjemahSesudah.namaEn === `EN ${alamatSah.length}`,
    sesudahTerjemah.map((b) => b.topikEn).join(" | "),
  );
  cek(
    "tiap baris menerima teksnya sendiri, bukan teks baris pertama",
    new Set(sesudahTerjemah.map((b) => b.topikEn)).size === sesudahTerjemah.length,
    sesudahTerjemah.map((b) => b.topikEn).join(" | "),
  );
  cek(
    "kolom Indonesia tidak tersentuh, alamat asing dan teks kosong ditolak",
    sesudahTerjemah.every(
      (b, i) => b.topik === barisTerjemah[i].topik && b.topik !== "ditimpa",
    ) &&
      tugasTerjemahSesudah.nama === tugasTerjemah.nama &&
      tugasTerjemahSesudah.deskripsiEn === null,
    `${sesudahTerjemah[0].topik} · ${tugasTerjemahSesudah.deskripsiEn}`,
  );

  writeFileSync("uji/keluaran-rpkps.docx", buffer);
  console.log("     dokumen contoh: uji/keluaran-rpkps.docx");

  console.log("\nSelesai.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
