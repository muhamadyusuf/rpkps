"use server";

import { segarkan } from "@/lib/bahasa/segarkan";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kirimNotifikasi } from "@/lib/notifikasi/kirim";
import { cakupanProdi, punyaPeran } from "@/lib/otorisasi";
import { wenangRpkps } from "@/lib/rpkps/wenang";
import {
  MIN_ALASAN_HAPUS_PAKSA,
  periksaKelayakanArsip,
  periksaKelayakanHapus,
  ringkasAkibatHapus,
  statusSetelahPulih,
} from "@/domain/rpkps/daur-hidup";
import { MIN_CATATAN_REVISI } from "@/domain/rpkps/tipe";
import type { Prisma } from "@/generated/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import type { Kamus } from "@/kamus";
import { isi as sisip } from "@/lib/bahasa/teks";
import { pesanZod } from "@/lib/bahasa/zod";
import { riwayat } from "@/domain/rpkps/riwayat";
import { barisRiwayat } from "@/lib/rpkps/riwayat";

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

/** Dipakai beberapa aksi di berkas ini; kalimatnya di `kamus.aksi.rpkps`. */
const tolakKelola = (kam: Kamus) => kam.aksi.rpkps.hanyaKoordinatorKelola;

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
  const kam = await kamusAksi();
  const { bolehKelola, sesi } = await pastikanKelola(id);
  if (!bolehKelola) return { ok: false, pesan: tolakKelola(kam) };

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
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };

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
      pesan: kam.aksi.rpkps.takDapatDihapus,
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

  segarkan("/rpkps");
  return { ok: true, pesan: sisip(kam.aksi.rpkps.dihapus, { label }) };
}

const SkemaAlasanPaksa = z
  .string()
  .trim()
  .min(MIN_ALASAN_HAPUS_PAKSA, "@aksi.periksa.alasanHapusPaksa")
  .max(2000);

/**
 * Penghapusan PAKSA sebuah RPKPS yang sudah disahkan — jalur administrator
 * (docs/06 §2.6).
 *
 * Ini satu-satunya pintu yang melewati `periksaKelayakanHapus`, dan sengaja
 * dipisah dari `hapusRpkps` alih-alih menjadi bendera `paksa: boolean` di
 * dalamnya: sebuah parameter opsional pada aksi yang sudah dipanggil dari
 * dialog biasa cepat sekali berubah menjadi `paksa` yang diteruskan begitu
 * saja dari peramban. Fungsi terpisah berarti jalur paksa punya penjaga
 * sendiri yang tidak dapat dilewati dari jalur biasa.
 *
 * Tiga syarat yang TIDAK dilonggarkan:
 *
 *   1. Peran ADMIN, bukan `bolehKelola`. Koordinator dan Kaprodi tetap
 *      berhenti pada `periksaKelayakanHapus`; yang boleh membatalkan aturan
 *      itu hanya pemegang wewenang institusi.
 *   2. Alasan tertulis minimal `MIN_ALASAN_HAPUS_PAKSA` karakter. Setelah
 *      barisnya lenyap, kalimat inilah satu-satunya yang tersisa.
 *   3. Sensus lengkap — status, sidik SHA-256 tiap salinan beku, kelas
 *      beserta jumlah nilai, dan nama seluruh pengampu — dicatat ke
 *      `log_audit` DI DALAM transaksi yang sama, sebelum `delete()`. Baris
 *      RPKPS-nya memang hilang; pertanyaan "ke mana perginya dokumen terbit
 *      TI214 2025/2026-GENAP, dan sidik mana yang jadi tak bertuan?" tetap
 *      terjawab.
 *
 * Arsip tetap jalur yang benar untuk menarik dokumen dari peredaran — ia
 * mencabut halaman katalog publik tanpa melenyapkan satu baris pun. Yang ini
 * untuk hal yang tidak boleh tetap ada: dokumen yang terbit karena salah
 * mata kuliah, atau memuat data yang harus benar-benar dihapus.
 */
export async function hapusPaksaRpkps(id: string, alasan: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { sesi } = await wenangRpkps(id);
  if (!punyaPeran(sesi, "ADMIN")) {
    return { ok: false, pesan: kam.aksi.rpkps.hanyaAdminHapusPaksa };
  }

  const urai = SkemaAlasanPaksa.safeParse(alasan);
  if (!urai.success) {
    return { ok: false, pesan: pesanZod(urai.error, kam, kam.aksi.umum.masukanTidakSah) };
  }

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: {
      status: true,
      versi: true,
      mataKuliah: {
        select: { kode: true, nama: true, kurikulum: { select: { prodi: { select: { kode: true } } } } },
      },
      tahunAkademik: { select: { kode: true } },
      snapshot: { select: { versi: true, sidik: true, dibuatPada: true } },
      pengampu: { select: { peran: true, pengguna: { select: { nama: true, email: true } } } },
      _count: { select: { pertemuan: true, tugas: true, kisiKisi: true, pustaka: true } },
      kelas: {
        select: {
          kode: true,
          evaluasi: { select: { id: true } },
          peserta: { select: { _count: { select: { nilai: true } } } },
        },
      },
    },
  });
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const kelas = rpkps.kelas.map((k) => ({
    kode: k.kode,
    jumlahPeserta: k.peserta.length,
    jumlahNilai: k.peserta.reduce((n, p) => n + p._count.nilai, 0),
    adaEvaluasi: k.evaluasi !== null,
  }));

  const akibat = ringkasAkibatHapus({
    status: rpkps.status,
    jumlahSnapshot: rpkps.snapshot.length,
    kelas,
  });

  const label = `${rpkps.mataKuliah.kode} ${rpkps.tahunAkademik.kode}`;

  await prisma.$transaction([
    prisma.logAudit.create({
      data: {
        penggunaId: sesi.id,
        aksi: "RPKPS_DIHAPUS_PAKSA",
        entitas: "rpkps",
        entitasId: id,
        ringkasan:
          `${sesi.email} menghapus PAKSA RPKPS ${label} — ${rpkps.mataKuliah.nama} ` +
          `(status ${rpkps.status}): ${urai.data}`,
        data: {
          alasan: urai.data,
          prodi: rpkps.mataKuliah.kurikulum.prodi.kode,
          mataKuliah: rpkps.mataKuliah.kode,
          namaMataKuliah: rpkps.mataKuliah.nama,
          tahunAkademik: rpkps.tahunAkademik.kode,
          status: rpkps.status,
          versi: rpkps.versi,
          pertemuan: rpkps._count.pertemuan,
          tugas: rpkps._count.tugas,
          kisiKisi: rpkps._count.kisiKisi,
          pustaka: rpkps._count.pustaka,
          // Sidik salinan beku dicatat utuh: berkas DOCX yang sudah tercetak
          // memuat angka ini, dan setelah barisnya hilang hanya di sinilah ia
          // masih dapat ditelusuri.
          snapshot: rpkps.snapshot.map((s) => ({
            versi: s.versi,
            sidik: s.sidik,
            dibuatPada: s.dibuatPada.toISOString(),
          })),
          pengampu: rpkps.pengampu.map((p) => ({
            nama: p.pengguna.nama,
            email: p.pengguna.email,
            peran: p.peran,
          })),
          kelas,
          akibat: akibat.rincian,
        } satisfies Prisma.InputJsonValue,
      },
    }),
    prisma.rpkps.delete({ where: { id } }),
  ]);

  segarkan("/rpkps");
  segarkan("/katalog");
  return { ok: true, pesan: sisip(kam.aksi.rpkps.dihapusPaksa, { label }) };
}

const SkemaAlasan = z
  .string()
  .trim()
  .min(MIN_CATATAN_REVISI, "@aksi.periksa.alasanArsip")
  .max(1000);

/**
 * Menarik RPKPS dari peredaran tanpa melenyapkan apa pun.
 *
 * Untuk dokumen TERBIT ini sekaligus MENCABUT halaman katalog publiknya:
 * `src/lib/publik/muat.ts` hanya melayani status TERBIT, jadi tidak ada kode
 * tambahan yang perlu ditulis di sisi publik (docs/06 keputusan K3).
 */
export async function arsipkanRpkps(id: string, alasan: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { bolehKelola, sesi } = await pastikanKelola(id);
  if (!bolehKelola) return { ok: false, pesan: tolakKelola(kam) };

  const urai = SkemaAlasan.safeParse(alasan);
  if (!urai.success) {
    return { ok: false, pesan: pesanZod(urai.error, kam, kam.aksi.umum.masukanTidakSah) };
  }

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: { status: true, versi: true, mataKuliah: { select: { kode: true } } },
  });
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const kelayakan = periksaKelayakanArsip(rpkps.status);
  if (!kelayakan.boleh) {
    return { ok: false, pesan: kelayakan.alasan[0] ?? kam.aksi.rpkps.takDapatDihapus };
  }

  const terbit = rpkps.status === "TERBIT";

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status: "ARSIP" } }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status: "ARSIP",
        ...barisRiwayat(riwayat("DIARSIPKAN", { alasan: urai.data })),
        olehId: sesi.id,
      },
    }),
  ]);

  segarkan(`/rpkps/${id}`);
  segarkan("/rpkps");
  segarkan("/katalog");
  return {
    ok: true,
    pesan: terbit
      ? kam.aksi.rpkps.diarsipkan
      : kam.aksi.lain.diarsipkanDraf,
  };
}

export async function pulihkanRpkps(id: string): Promise<Hasil> {
  const kam = await kamusAksi();
  const { bolehKelola, sesi } = await pastikanKelola(id);
  if (!bolehKelola) return { ok: false, pesan: tolakKelola(kam) };

  const rpkps = await prisma.rpkps.findUnique({
    where: { id },
    select: {
      status: true,
      versi: true,
      snapshot: { where: {}, select: { versi: true } },
    },
  });
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };
  if (rpkps.status !== "ARSIP") {
    return { ok: false, pesan: kam.aksi.rpkps.takSedangArsip };
  }

  const status = statusSetelahPulih(rpkps.snapshot.some((s) => s.versi === rpkps.versi));

  await prisma.$transaction([
    prisma.rpkps.update({ where: { id }, data: { status } }),
    prisma.rpkpsRiwayat.create({
      data: {
        rpkpsId: id,
        versi: rpkps.versi,
        status,
        ...barisRiwayat(
          riwayat(status === "TERBIT" ? "DARI_ARSIP_TERBIT" : "DARI_ARSIP_DRAF"),
        ),
        olehId: sesi.id,
      },
    }),
  ]);

  segarkan(`/rpkps/${id}`);
  segarkan("/rpkps");
  segarkan("/katalog");
  return {
    ok: true,
    pesan:
      status === "TERBIT"
        ? kam.aksi.rpkps.kembaliTerbit
        : kam.aksi.lain.kembaliDraf,
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
/**
 * Nama dokumen untuk kalimat notifikasi. Dibaca terpisah, bukan dititipkan ke
 * pemeriksaan wewenang: yang di sana memuat apa yang perlu untuk MEMUTUSKAN,
 * dan menambahinya demi teks membuat setiap penjaga ikut menanggung beban itu.
 */
async function identitasRpkps(rpkpsId: string) {
  const r = await prisma.rpkps.findUnique({
    where: { id: rpkpsId },
    select: {
      mataKuliah: { select: { kode: true, nama: true } },
      tahunAkademik: { select: { kode: true } },
    },
  });
  if (!r) return null;
  return {
    mk: `${r.mataKuliah.kode} ${r.mataKuliah.nama}`,
    ta: r.tahunAkademik.kode.replace("-", " "),
  };
}

export async function tambahPengampu(
  rpkpsId: string,
  penggunaId: string,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const { bolehKelola, sesi } = await pastikanKelola(rpkpsId);
  if (!bolehKelola) return { ok: false, pesan: tolakKelola(kam) };

  const calon = await prisma.pengguna.findUnique({
    where: { id: penggunaId },
    select: {
      nama: true,
      status: true,
      penugasan: { select: { peran: true } },
    },
  });
  if (!calon) return { ok: false, pesan: kam.aksi.takAda.dosen };
  if (calon.status !== "AKTIF") {
    return { ok: false, pesan: sisip(kam.aksi.pengampu.belumAktif, { nama: calon.nama }) };
  }
  if (!calon.penugasan.some((p) => (PERAN_DOSEN as readonly string[]).includes(p.peran))) {
    return { ok: false, pesan: sisip(kam.aksi.pengampu.bukanDosen, { nama: calon.nama }) };
  }

  const sudah = await prisma.rpkpsPengampu.findUnique({
    where: { rpkpsId_penggunaId: { rpkpsId, penggunaId } },
    select: { id: true },
  });
  if (sudah) return { ok: false, pesan: sisip(kam.aksi.pengampu.sudahAda, { nama: calon.nama }) };

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

  const identitas = await identitasRpkps(rpkpsId);
  if (identitas) {
    await kirimNotifikasi(
      [penggunaId],
      {
        jenis: "RPKPS_PENGAMPU",
        rpkpsId,
        ...identitas,
        oleh: sesi.namaLengkap,
        peran: "ANGGOTA",
      },
      sesi.id,
    );
  }

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan("/rpkps");
  return { ok: true, pesan: sisip(kam.aksi.pengampu.ditambahkan, { nama: calon.nama }) };
}

/**
 * Melepas anggota dari tim pengampu. Tidak menghapus apa pun yang sudah ia
 * tulis — isi RPKPS tidak menyimpan kepemilikan per baris.
 */
export async function lepasPengampu(
  rpkpsId: string,
  penggunaId: string,
): Promise<Hasil> {
  const kam = await kamusAksi();
  const { bolehKelola, sesi } = await pastikanKelola(rpkpsId);
  if (!bolehKelola) return { ok: false, pesan: tolakKelola(kam) };

  const baris = await prisma.rpkpsPengampu.findUnique({
    where: { rpkpsId_penggunaId: { rpkpsId, penggunaId } },
    select: { peran: true, pengguna: { select: { nama: true } } },
  });
  if (!baris) return { ok: false, pesan: kam.aksi.pengampu.bukanPengampu };

  // Tanpa pagar ini sebuah RPKPS bisa berakhir tanpa penanggung jawab.
  if (baris.peran === "KOORDINATOR") {
    return {
      ok: false,
      pesan:
        kam.aksi.rpkps.koordinatorTakDilepas,
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

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan("/rpkps");
  return { ok: true, pesan: sisip(kam.aksi.pengampu.dilepas, { nama: baris.pengguna.nama }) };
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
  const kam = await kamusAksi();
  const { bolehKelola, sesi } = await pastikanKelola(rpkpsId);
  if (!bolehKelola) return { ok: false, pesan: tolakKelola(kam) };

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
  if (!rpkps) return { ok: false, pesan: kam.aksi.takAda.rpkps };

  const calon = rpkps.pengampu.find((p) => p.penggunaId === penggunaId);
  if (!calon) {
    return {
      ok: false,
      pesan: kam.aksi.pengampu.tambahDuluKeTim,
    };
  }
  if (calon.peran === "KOORDINATOR") {
    return { ok: false, pesan: sisip(kam.aksi.pengampu.sudahKoordinator, { nama: calon.pengguna.nama }) };
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
        ...barisRiwayat(
          lama.length > 0
            ? riwayat("KOORDINASI_DIALIHKAN", {
                dari: lama.map((p) => p.pengguna.nama).join(", "),
                kepada: calon.pengguna.nama,
              })
            : riwayat("KOORDINASI_DISERAHKAN", { kepada: calon.pengguna.nama }),
        ),
        olehId: sesi.id,
      },
    }),
  ]);

  const identitasSerah = await identitasRpkps(rpkpsId);
  if (identitasSerah) {
    await kirimNotifikasi(
      [penggunaId],
      {
        jenis: "RPKPS_PENGAMPU",
        rpkpsId,
        ...identitasSerah,
        oleh: sesi.namaLengkap,
        peran: "KOORDINATOR",
      },
      sesi.id,
    );
  }

  segarkan(`/rpkps/${rpkpsId}`);
  segarkan("/rpkps");
  return { ok: true, pesan: sisip(kam.aksi.pengampu.kiniKoordinator, { nama: calon.pengguna.nama }) };
}

// ─────────────────────────────────────────────────────────────
// SALIN — docs/06 §3.5
// ─────────────────────────────────────────────────────────────

const SkemaSalin = z.object({
  mataKuliahId: z.string().min(1, "@aksi.periksa.mkTujuanWajib"),
  tahunAkademikId: z.string().min(1, "@aksi.periksa.tahunTujuanWajib"),
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
  const kam = await kamusAksi();
  const { bolehLihat, sesi } = await wenangRpkps(sumberId);
  if (!bolehLihat) return { ok: false, pesan: kam.aksi.wenang.rpkpsAsal };

  if (!punyaPeran(sesi, "ADMIN", "KAPRODI", "KOORDINATOR_MK", "DOSEN")) {
    return { ok: false, pesan: kam.aksi.wenang.buatRpkps };
  }

  const urai = SkemaSalin.safeParse(masukan);
  if (!urai.success) {
    return { ok: false, pesan: pesanZod(urai.error, kam, kam.aksi.umum.masukanTidakSah) };
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
  if (!sumber) return { ok: false, pesan: kam.aksi.takAda.rpkpsAsal };

  const tujuan = await prisma.mataKuliah.findUnique({
    where: { id: mataKuliahId },
    select: {
      kode: true,
      nama: true,
      kurikulum: { select: { prodiId: true, status: true } },
    },
  });
  if (!tujuan) return { ok: false, pesan: kam.aksi.takAda.mataKuliahTujuan };
  if (tujuan.kurikulum.status !== "BERLAKU") {
    return { ok: false, pesan: kam.aksi.rpkps.kurikulumTujuanBelumBerlaku };
  }

  // Salin BUKAN jalur memindahkan isi antar prodi tanpa sepengetahuan Kaprodi.
  const cakupan = cakupanProdi(sesi);
  if (cakupan !== null && !cakupan.includes(tujuan.kurikulum.prodiId)) {
    return { ok: false, pesan: kam.aksi.wenang.prodiTujuan };
  }

  const ta = await prisma.tahunAkademik.findUnique({
    where: { id: tahunAkademikId },
    select: { kode: true },
  });
  if (!ta) return { ok: false, pesan: kam.aksi.takAda.tahunAkademikTujuan };

  const bentrok = await prisma.rpkps.findFirst({
    where: { mataKuliahId, tahunAkademikId },
    select: { id: true },
  });
  if (bentrok) {
    return {
      ok: false,
      pesan: sisip(kam.aksi.rpkps.tujuanSudahPunya, { kode: tujuan.kode, ta: ta.kode.replace("-", " ") }),
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
        ...barisRiwayat(
          riwayat(mkSama ? "DISALIN" : "DISALIN_LINTAS_MK", { asal }),
        ),
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

  segarkan("/rpkps");
  return {
    ok: true,
    pesan: sisip(
      mkSama ? kam.aksi.lain.disalinKe : kam.aksi.lain.disalinKeLepasPemetaan,
      { tujuan: `${tujuan.kode} ${ta.kode.replace("-", " ")}` },
    ),
    id: idBaru,
  };
}
