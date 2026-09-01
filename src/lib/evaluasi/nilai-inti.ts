import type { PrismaClient } from "@/generated/prisma";
import type { BarisNilai } from "@/domain/evaluasi/nilai";

/**
 * Lapisan basis data untuk nilai kelas — doc 05 tahap E2.
 *
 * Klien Prisma diterima sebagai PARAMETER, bukan diimpor dari `@/lib/prisma`,
 * mengikuti alasan yang sama seperti `src/lib/kurikulum/usulan-inti.ts`:
 * penyimpanan nilai adalah bagian yang paling mudah rusak diam-diam — upsert
 * mahasiswa, peserta, dan skor di dalam satu transaksi — sehingga ia harus
 * dapat dijalankan uji integrasi terhadap Postgres sungguhan.
 *
 * BANYAKNYA KUERI PER TRANSAKSI TIDAK BOLEH IKUT BESAR KELAS. Transaksi
 * interaktif Prisma punya batas waktu dinding, dan batas itu dihitung sejak
 * transaksi dibuka — bukan per kueri. Versi pertama modul ini menulis baris
 * per baris: satu kelas 40 mahasiswa dengan 6 asesmen berarti sekitar 400
 * kueri berurutan, dan terhadap Postgres yang tidak berada di mesin yang sama
 * (Neon, misalnya) itu melampaui batas 5 detik pada ukuran kelas yang paling
 * biasa — "A query cannot be executed on an expired transaction". Karena itu
 * tiap tahap di bawah dikerjakan sebagai SATU kueri jamak, dan jumlah kueri
 * per transaksi tetap sekitar sepuluh berapa pun besar kelasnya.
 */

export type Klien = PrismaClient;

/**
 * Batas waktu transaksi. Setelah penulisannya dijamakkan, angka ini adalah
 * MARGIN — bukan perbaikannya: ia menampung koneksi yang sedang lambat atau
 * basis data tanpa server yang baru bangun, bukan kueri per baris.
 */
const OPSI_TRANSAKSI = { timeout: 20_000, maxWait: 10_000 };

export interface HasilSimpanNilai {
  /** Mahasiswa yang belum pernah tercatat di prodi ini. */
  mahasiswaBaru: number;
  /** Peserta yang baru masuk ke kelas ini. */
  pesertaBaru: number;
  skorDisimpan: number;
  skorDihapus: number;
}

/**
 * Kunci gabungan satu sel nilai. Spasi aman sebagai pemisah: kedua sisinya
 * adalah cuid atau kode asesmen, dan keduanya tidak pernah memuat spasi.
 */
function selNilai(pesertaKelasId: string, kolom: string): string {
  return `${pesertaKelasId} ${kolom}`;
}

/**
 * Mengumpulkan pembaruan menurut nilai skornya.
 *
 * `updateMany` hanya dapat menulis SATU nilai untuk sekumpulan baris, jadi
 * baris yang skornya berubah dikelompokkan lebih dulu: jumlah kueri menjadi
 * sebanyak skor berbeda yang berubah, bukan sebanyak sel.
 */
function kelompokkanSkor(perubahan: readonly { id: string; skor: number }[]) {
  const per = new Map<number, string[]>();
  for (const p of perubahan) {
    const daftar = per.get(p.skor);
    if (daftar) daftar.push(p.id);
    else per.set(p.skor, [p.id]);
  }
  return per;
}

/** Sel mana yang dibuat, diubah, dan dihapus — dihitung sebelum menulis. */
function bandingkanSel(
  sel: ReadonlyMap<string, number | null>,
  lama: readonly { id: string; kunci: string; skor: number }[],
) {
  const dihapus: string[] = [];
  const diubah: { id: string; skor: number }[] = [];
  const sudahAda = new Set<string>();

  for (const n of lama) {
    sudahAda.add(n.kunci);
    const baru = sel.get(n.kunci);
    // Sel yang dikosongkan berarti nilainya ditarik kembali, bukan nol.
    if (baru === undefined || baru === null) dihapus.push(n.id);
    else if (n.skor !== baru) diubah.push({ id: n.id, skor: baru });
  }

  const dibuat: { pesertaKelasId: string; kolom: string; skor: number }[] = [];
  for (const [kunci, skor] of sel) {
    if (skor === null || sudahAda.has(kunci)) continue;
    const pisah = kunci.indexOf(" ");
    dibuat.push({
      pesertaKelasId: kunci.slice(0, pisah),
      kolom: kunci.slice(pisah + 1),
      skor,
    });
  }

  // Sel berisi yang kini tersimpan — termasuk yang angkanya sama dengan
  // sebelumnya, seperti dulu ketika tiap sel di-upsert tanpa dibandingkan.
  let terisi = 0;
  for (const skor of sel.values()) if (skor !== null) terisi += 1;

  return { dibuat, diubah, dihapus, terisi };
}

export async function simpanNilaiKelas(
  klien: Klien,
  arg: {
    kelasId: string;
    prodiId: string;
    baris: readonly BarisNilai[];
    /** Hanya kolom yang benar-benar ada di berkas yang disentuh. */
    kolomDikenal: readonly string[];
  },
): Promise<HasilSimpanNilai> {
  // NIM ganda sudah menjadi pemblokir di `bacaNilai`, tetapi modul ini juga
  // dipanggil dari uji dan skrip: menyaringnya di sini menjaga kueri jamak di
  // bawah tetap berkunci unik. Baris terakhir menang, sama seperti dulu ketika
  // tiap baris di-upsert berurutan.
  const perNim = new Map<string, BarisNilai>();
  for (const b of arg.baris) perNim.set(b.nim, b);
  const baris = [...perNim.values()];

  const hasil: HasilSimpanNilai = {
    mahasiswaBaru: 0,
    pesertaBaru: 0,
    skorDisimpan: 0,
    skorDihapus: 0,
  };
  if (baris.length === 0) return hasil;

  const kolom = [...arg.kolomDikenal];

  await klien.$transaction(async (tx) => {
    // ── Mahasiswa ─────────────────────────────────────────────────────
    // Dibuat sambil jalan. Mewajibkan pendaftaran lebih dulu adalah gesekan
    // yang membuat modul analitik berakhir kosong (docs/00 §7 — "data nilai
    // per butir tidak pernah diisi").
    //
    // `skipDuplicates` menjadikan sisipan ini "buat yang belum ada": mahasiswa
    // yang sudah tercatat dilewati apa adanya, sehingga berkas nilai tidak
    // pernah menimpa nama yang sudah ada.
    const dibuatMhs = await tx.mahasiswa.createMany({
      data: baris.map((b) => ({
        prodiId: arg.prodiId,
        nim: b.nim,
        nama: b.nama || b.nim,
        angkatan: b.angkatan,
      })),
      skipDuplicates: true,
    });
    hasil.mahasiswaBaru = dibuatMhs.count;

    const mahasiswa = await tx.mahasiswa.findMany({
      where: { prodiId: arg.prodiId, nim: { in: baris.map((b) => b.nim) } },
      select: { id: true, nim: true, angkatan: true },
    });
    const idPerNim = new Map(mahasiswa.map((m) => [m.nim, m.id]));

    // Angkatan hanya DIISI, tidak pernah ditimpa: berkas nilai bukan sumber
    // kebenaran data mahasiswa, ia hanya kebetulan membawanya. Yang baru
    // dibuat di atas sudah membawa angkatannya sendiri, jadi yang tersisa di
    // sini hanya mahasiswa lama yang angkatannya masih kosong.
    const perluAngkatan = new Map<number, string[]>();
    for (const m of mahasiswa) {
      if (m.angkatan !== null) continue;
      const angkatan = perNim.get(m.nim)?.angkatan;
      if (angkatan === null || angkatan === undefined) continue;
      const daftar = perluAngkatan.get(angkatan);
      if (daftar) daftar.push(m.id);
      else perluAngkatan.set(angkatan, [m.id]);
    }
    for (const [angkatan, ids] of perluAngkatan) {
      await tx.mahasiswa.updateMany({
        where: { id: { in: ids }, angkatan: null },
        data: { angkatan },
      });
    }

    // ── Peserta kelas ─────────────────────────────────────────────────
    const mahasiswaIds = [...idPerNim.values()];
    const dibuatPeserta = await tx.pesertaKelas.createMany({
      data: mahasiswaIds.map((mahasiswaId) => ({ kelasId: arg.kelasId, mahasiswaId })),
      skipDuplicates: true,
    });
    hasil.pesertaBaru = dibuatPeserta.count;

    const peserta = await tx.pesertaKelas.findMany({
      where: { kelasId: arg.kelasId, mahasiswaId: { in: mahasiswaIds } },
      select: { id: true, mahasiswaId: true },
    });
    const pesertaPerMhs = new Map(peserta.map((p) => [p.mahasiswaId, p.id]));

    // ── Skor ──────────────────────────────────────────────────────────
    // Yang disentuh hanya perpotongan peserta-di-berkas × kolom-di-berkas:
    // kolom yang tidak ada di berkas tidak diapa-apakan sama sekali.
    const sel = new Map<string, number | null>();
    const pesertaIds: string[] = [];
    for (const b of baris) {
      const mahasiswaId = idPerNim.get(b.nim);
      const pesertaKelasId = mahasiswaId === undefined ? undefined : pesertaPerMhs.get(mahasiswaId);
      if (pesertaKelasId === undefined) continue;
      pesertaIds.push(pesertaKelasId);
      for (const kode of kolom) sel.set(selNilai(pesertaKelasId, kode), b.skor[kode] ?? null);
    }

    const lama = await tx.nilaiAsesmen.findMany({
      where: { pesertaKelasId: { in: pesertaIds }, asesmenKode: { in: kolom } },
      select: { id: true, pesertaKelasId: true, asesmenKode: true, skor: true },
    });

    // Baris yang sudah ada DIPERBARUI di tempat, tidak dihapus lalu dibuat
    // ulang: `dibuat_pada` sebuah nilai adalah kapan angka itu pertama masuk,
    // dan mengunggah ulang satu kolom tidak boleh menuliskan ulang tanggal itu
    // untuk seluruh kelas.
    const beda = bandingkanSel(
      sel,
      lama.map((n) => ({
        id: n.id,
        kunci: selNilai(n.pesertaKelasId, n.asesmenKode),
        skor: Number(n.skor),
      })),
    );

    if (beda.dihapus.length > 0) {
      const hapus = await tx.nilaiAsesmen.deleteMany({ where: { id: { in: beda.dihapus } } });
      hasil.skorDihapus = hapus.count;
    }
    if (beda.dibuat.length > 0) {
      await tx.nilaiAsesmen.createMany({
        data: beda.dibuat.map((d) => ({
          pesertaKelasId: d.pesertaKelasId,
          asesmenKode: d.kolom,
          skor: d.skor,
        })),
      });
    }
    for (const [skor, ids] of kelompokkanSkor(beda.diubah)) {
      await tx.nilaiAsesmen.updateMany({ where: { id: { in: ids } }, data: { skor } });
    }

    hasil.skorDisimpan = beda.terisi;
  }, OPSI_TRANSAKSI);

  return hasil;
}

/**
 * Skor per butir ujian — bahan analisis butir (E6).
 *
 * Aturannya sama dengan skor asesmen: sel yang dikosongkan berarti nilainya
 * ditarik kembali, dan peserta yang tidak ada di berkas tidak disentuh.
 * Peserta yang belum terdaftar di kelas DILEWATI, bukan dibuat: lembar butir
 * adalah rincian dari lembar Nilai, bukan pintu masuk mahasiswa baru.
 */
export async function simpanSkorButir(
  klien: Klien,
  arg: {
    kelasId: string;
    /** nomor butir → id baris kisi-kisi. */
    butirId: ReadonlyMap<number, string>;
    peserta: readonly { nim: string; skor: Record<number, number | null> }[];
  },
): Promise<{ skorDisimpan: number; skorDihapus: number; nimTakDikenal: string[] }> {
  const daftar = await klien.pesertaKelas.findMany({
    where: { kelasId: arg.kelasId },
    select: { id: true, mahasiswa: { select: { nim: true } } },
  });
  const perNim = new Map(daftar.map((p) => [p.mahasiswa.nim, p.id]));

  // Baris terakhir menang bagi NIM yang muncul dua kali: `bacaSkorButir` tidak
  // menolaknya, dan dulu urutan upsert-lah yang menentukan.
  const pesertaBaris = new Map<string, Record<number, number | null>>();
  const nimTakDikenal: string[] = [];
  for (const p of arg.peserta) {
    if (!perNim.has(p.nim)) {
      if (!nimTakDikenal.includes(p.nim)) nimTakDikenal.push(p.nim);
      continue;
    }
    pesertaBaris.set(p.nim, p.skor);
  }

  let skorDisimpan = 0;
  let skorDihapus = 0;
  if (pesertaBaris.size === 0) return { skorDisimpan, skorDihapus, nimTakDikenal };

  const butirIds = [...arg.butirId.values()];

  await klien.$transaction(async (tx) => {
    const sel = new Map<string, number | null>();
    const pesertaIds: string[] = [];
    for (const [nim, skor] of pesertaBaris) {
      const pesertaKelasId = perNim.get(nim);
      if (pesertaKelasId === undefined) continue;
      pesertaIds.push(pesertaKelasId);
      for (const [nomor, butirKisiKisiId] of arg.butirId) {
        sel.set(selNilai(pesertaKelasId, butirKisiKisiId), skor[nomor] ?? null);
      }
    }

    const lama = await tx.nilaiButir.findMany({
      where: { pesertaKelasId: { in: pesertaIds }, butirKisiKisiId: { in: butirIds } },
      select: { id: true, pesertaKelasId: true, butirKisiKisiId: true, skor: true },
    });

    const beda = bandingkanSel(
      sel,
      lama.map((n) => ({
        id: n.id,
        kunci: selNilai(n.pesertaKelasId, n.butirKisiKisiId),
        skor: Number(n.skor),
      })),
    );

    if (beda.dihapus.length > 0) {
      const hapus = await tx.nilaiButir.deleteMany({ where: { id: { in: beda.dihapus } } });
      skorDihapus = hapus.count;
    }
    if (beda.dibuat.length > 0) {
      await tx.nilaiButir.createMany({
        data: beda.dibuat.map((d) => ({
          pesertaKelasId: d.pesertaKelasId,
          butirKisiKisiId: d.kolom,
          skor: d.skor,
        })),
      });
    }
    for (const [skor, ids] of kelompokkanSkor(beda.diubah)) {
      await tx.nilaiButir.updateMany({ where: { id: { in: ids } }, data: { skor } });
    }

    skorDisimpan = beda.terisi;
  }, OPSI_TRANSAKSI);

  return { skorDisimpan, skorDihapus, nimTakDikenal };
}
