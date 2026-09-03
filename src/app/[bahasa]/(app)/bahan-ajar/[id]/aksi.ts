"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { kamusAksi } from "@/lib/bahasa/server";
import { segarkan } from "@/lib/bahasa/segarkan";
import { pesanZod } from "@/lib/bahasa/zod";
import { isi as sisip } from "@/lib/bahasa/teks";
import { GalatAi } from "@/lib/ai/galat";
import {
  susunIsiBab,
  susunKelengkapan,
  susunKerangkaBuku,
  susunSlideBab,
} from "@/lib/ai/buku-ajar";
import {
  konteksBab,
  konteksBuku,
  muatBuku,
  sidikSekarang,
  type BukuLengkap,
} from "@/lib/bahan-ajar/muat";
import { wenangBuku } from "@/lib/bahan-ajar/wenang";
import { periksaKesegaran, pesanTertimpa } from "@/domain/rpkps/kunci-optimistik";
import type { TemuanBahanAjar } from "@/domain/bahan-ajar/tipe";

export type Hasil = { ok: boolean; pesan: string };
export type HasilAi = Hasil & {
  /** Perbaikan deterministik atas keluaran model. Ditampilkan apa adanya. */
  catatan?: TemuanBahanAjar[];
  penyedia?: string;
  model?: string;
};

/**
 * Server Action buku ajar — docs/16 §5.2.
 *
 * Setiap aksi melewati `wenangBuku`, dan tulisnya HANYA untuk pengampu. Tidak
 * ada pemeriksaan `bolehSuntingIsi` di berkas ini, dan itu disengaja: buku ajar
 * tidak ditandatangani siapa pun dan justru dikerjakan setelah RPKPS terbit.
 *
 * Perhatikan bahwa tidak ada satu pun aksi "susun semua bab". Perulangan itu
 * milik antarmuka, yang memanggil `susunBabAi` bab demi bab: satu Server Action
 * yang menunggu empat belas panggilan model akan menabrak batas waktu dan
 * menghanguskan bab yang sudah berhasil bersamanya (docs/16 §3.2).
 */

async function siapkan(bukuId: string) {
  const k = await kamusAksi();
  const w = await wenangBuku(bukuId);
  return { k, w };
}

/** Buku beserta wewenang tulis; satu tempat untuk tiga pemeriksaan yang sama. */
async function bukuUntukTulis(
  bukuId: string,
): Promise<{ ok: true; buku: BukuLengkap; penggunaId: string } | { ok: false; pesan: string }> {
  const { k, w } = await siapkan(bukuId);
  if (!w.ada) return { ok: false, pesan: k.aksi.takAda.bukuAjar };
  if (!w.bolehTulis) return { ok: false, pesan: k.aksi.wenang.tulisBukuAjar };

  const buku = await muatBuku(bukuId);
  if (!buku) return { ok: false, pesan: k.aksi.takAda.bukuAjar };
  return { ok: true, buku, penggunaId: w.sesi.id };
}

function segarkanBuku(bukuId: string, nomor?: number) {
  segarkan(`/bahan-ajar/${bukuId}`);
  if (nomor !== undefined) segarkan(`/bahan-ajar/${bukuId}/bab/${nomor}`);
}

// ─────────────────────────────────────────────────────────────
// METADATA TERBITAN — diisi manusia, tidak pernah AI (docs/16 P5)
// ─────────────────────────────────────────────────────────────

const SkemaMetadata = z.object({
  judul: z.string().trim().min(3, "@aksi.periksa.judulBukuPendek").max(200),
  subjudul: z.string().trim().max(200).nullable(),
  penulis: z.array(z.string().trim().min(1)).max(10),
  afiliasi: z.string().trim().max(200).nullable(),
  penerbit: z.string().trim().max(200).nullable(),
  kotaTerbit: z.string().trim().max(100).nullable(),
  tahunTerbit: z.number().int().min(1900).max(2200).nullable(),
  edisi: z.string().trim().max(50).nullable(),
  isbn: z.string().trim().max(30).nullable(),
  hakCipta: z.string().trim().max(500).nullable(),
});

export type IsiMetadata = z.infer<typeof SkemaMetadata>;

export async function simpanMetadata(bukuId: string, isi: IsiMetadata): Promise<Hasil> {
  const siap = await bukuUntukTulis(bukuId);
  const k = await kamusAksi();
  if (!siap.ok) return { ok: false, pesan: siap.pesan };

  const parsed = SkemaMetadata.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, k, k.aksi.umum.dataTidakValid) };
  }
  const d = parsed.data;

  await prisma.bukuAjar.update({
    where: { id: bukuId },
    data: { ...d, penulis: d.penulis.filter(Boolean) },
  });

  segarkanBuku(bukuId);
  return { ok: true, pesan: k.aksi.bahanAjar.metadataTersimpan };
}

// ─────────────────────────────────────────────────────────────
// TAHAP AI
// ─────────────────────────────────────────────────────────────

/** Tahap 1: judul buku dan alur antarbab. Tidak menulis isi bab mana pun. */
export async function susunKerangkaAi(
  bukuId: string,
  kredensialId?: string | null,
): Promise<HasilAi> {
  const siap = await bukuUntukTulis(bukuId);
  const k = await kamusAksi();
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku } = siap;

  try {
    const { hasil, penyedia, model } = await susunKerangkaBuku({
      penggunaId: siap.penggunaId,
      bukuId,
      rpkpsId: buku.rpkpsId,
      konteks: konteksBuku(buku),
      kredensialId,
    });

    /*
     * Judul bab dan nomornya TIDAK diambil dari model — keduanya milik baris
     * mingguan RPKPS. Yang diterapkan hanya judul buku, subjudulnya, dan
     * kalimat alur tiap bab; bab dicocokkan lewat NOMOR, sehingga bab yang
     * tidak disebut model tetap utuh apa adanya.
     */
    const alur = new Map(hasil.bab.map((b) => [b.nomor, b.alur?.trim() ?? ""]));

    await prisma.$transaction([
      prisma.bukuAjar.update({
        where: { id: bukuId },
        data: {
          judul: hasil.judul_buku.trim() || buku.judul,
          subjudul: hasil.subjudul.trim() || null,
          sumber: "AI",
        },
      }),
      ...buku.bab
        .filter((b) => (alur.get(b.nomor) ?? "") !== "")
        .map((b) =>
          prisma.babBukuAjar.update({
            where: { id: b.id },
            data: { alur: alur.get(b.nomor) },
          }),
        ),
    ]);

    segarkanBuku(bukuId);
    return { ok: true, pesan: k.aksi.bahanAjar.kerangkaTersusun, penyedia, model };
  } catch (galat) {
    return gagalAi(galat, k.aksi.bahanAjar.gagalKerangka);
  }
}

/**
 * Tahap 2: isi SATU bab, disimpan begitu selesai.
 *
 * Penyimpanan per bab inilah alasan tahap ini dipecah: kegagalan di bab 9
 * tidak boleh menghanguskan bab 1–8 yang sudah dibayar kuota dosen.
 */
export async function susunBabAi(
  bukuId: string,
  nomor: number,
  kredensialId?: string | null,
): Promise<HasilAi> {
  const siap = await bukuUntukTulis(bukuId);
  const k = await kamusAksi();
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku } = siap;

  const bab = buku.bab.find((b) => b.nomor === nomor);
  if (!bab) return { ok: false, pesan: k.aksi.takAda.babBukuAjar };

  try {
    const { hasil, catatan, penyedia, model } = await susunIsiBab({
      penggunaId: siap.penggunaId,
      bukuId,
      konteks: konteksBuku(buku),
      bab: { ...konteksBab(buku, bab), alur: bab.alur ?? undefined },
      kredensialId,
    });

    // Sitiran sudah disaring `rapikanIsiBab` terhadap nomor pustaka RPKPS;
    // di sini nomor itu diterjemahkan menjadi id barisnya.
    const idPustaka = new Map(buku.rpkps.pustaka.map((p) => [p.nomor, p.id]));
    const sidik = sidikSekarang(buku);

    await prisma.$transaction(async (tx) => {
      await tx.babBukuAjar.update({
        where: { id: bab.id },
        data: {
          uraian: hasil.uraian,
          studiKasus: hasil.studiKasus,
          ringkasan: hasil.ringkasan,
          sumber: "AI",
          // Sidik dicatat SAAT bab disusun. Perubahan rencana mingguan
          // sesudah ini yang menyalakan penanda "bab bergeser".
          sidikSumber: bab.pertemuanId ? (sidik.get(bab.pertemuanId) ?? null) : null,
        },
      });

      await tx.latihanBab.deleteMany({ where: { babId: bab.id } });
      if (hasil.latihan.length > 0) {
        await tx.latihanBab.createMany({
          data: hasil.latihan.map((l) => ({
            babId: bab.id,
            nomor: l.nomor,
            soal: l.soal,
            kunci: l.kunci,
            bloom: l.bloom,
          })),
        });
      }

      await tx.babPustaka.deleteMany({ where: { babId: bab.id } });
      const pustakaId = hasil.sitiran
        .map((n) => idPustaka.get(n))
        .filter((x): x is string => Boolean(x));
      if (pustakaId.length > 0) {
        await tx.babPustaka.createMany({
          data: pustakaId.map((id) => ({ babId: bab.id, pustakaId: id })),
        });
      }
    });

    segarkanBuku(bukuId, nomor);
    return {
      ok: true,
      pesan: sisip(k.aksi.bahanAjar.babTersusun, { nomor }),
      catatan,
      penyedia,
      model,
    };
  } catch (galat) {
    return gagalAi(galat, sisip(k.aksi.bahanAjar.gagalBab, { nomor }));
  }
}

/** Tahap 3: slide satu bab, disusun dari isi bab yang sudah ada. */
export async function susunSlideAi(
  bukuId: string,
  nomor: number,
  kredensialId?: string | null,
): Promise<HasilAi> {
  const siap = await bukuUntukTulis(bukuId);
  const k = await kamusAksi();
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku } = siap;

  const bab = buku.bab.find((b) => b.nomor === nomor);
  if (!bab) return { ok: false, pesan: k.aksi.takAda.babBukuAjar };
  // Slide adalah ringkasan bahan yang sama; menyusunnya dari bab kosong hanya
  // menghasilkan slide karangan.
  if (!bab.uraian?.trim()) {
    return { ok: false, pesan: sisip(k.aksi.bahanAjar.babBelumBerisi, { nomor }) };
  }

  try {
    const { hasil, catatan, penyedia, model } = await susunSlideBab({
      penggunaId: siap.penggunaId,
      bukuId,
      bahasa: buku.bahasa,
      bab: {
        nomor: bab.nomor,
        judul: bab.judul,
        tujuan: bab.tujuan,
        uraian: bab.uraian,
        ringkasan: bab.ringkasan,
      },
      kredensialId,
    });

    await prisma.$transaction(async (tx) => {
      await tx.slideBab.deleteMany({ where: { babId: bab.id } });
      if (hasil.length > 0) {
        await tx.slideBab.createMany({
          data: hasil.map((s) => ({
            babId: bab.id,
            nomor: s.nomor,
            judul: s.judul,
            butir: s.butir,
            catatan: s.catatan,
          })),
        });
      }
    });

    segarkanBuku(bukuId, nomor);
    return {
      ok: true,
      pesan: sisip(k.aksi.bahanAjar.slideTersusun, { jumlah: hasil.length, nomor }),
      catatan,
      penyedia,
      model,
    };
  } catch (galat) {
    return gagalAi(galat, sisip(k.aksi.bahanAjar.gagalSlide, { nomor }));
  }
}

/** Tahap 4: prakata, pendahuluan, glosarium, dan kerangka biografi. */
export async function susunKelengkapanAi(
  bukuId: string,
  kredensialId?: string | null,
): Promise<HasilAi> {
  const siap = await bukuUntukTulis(bukuId);
  const k = await kamusAksi();
  if (!siap.ok) return { ok: false, pesan: siap.pesan };
  const { buku } = siap;

  const berisi = buku.bab.filter((b) => b.uraian?.trim());
  if (berisi.length === 0) {
    return { ok: false, pesan: k.aksi.bahanAjar.belumAdaBabBerisi };
  }

  try {
    const { hasil, catatan, penyedia, model } = await susunKelengkapan({
      penggunaId: siap.penggunaId,
      bukuId,
      konteks: konteksBuku(buku),
      // Ringkasan, bukan isi penuh: tahap ini akan lebih besar daripada
      // seluruh tahap lain digabung bila diberi naskah lengkap (docs/16 §3.4).
      ringkasanBab: berisi.map((b) => ({
        nomor: b.nomor,
        judul: b.judul,
        ringkasan: b.ringkasan ?? b.uraian!.slice(0, 400),
      })),
      kredensialId,
    });

    await prisma.bukuAjar.update({
      where: { id: bukuId },
      data: {
        prakata: hasil.prakata,
        pendahuluan: hasil.pendahuluan,
        glosarium: hasil.glosarium,
        biografi: hasil.biografi,
      },
    });

    segarkanBuku(bukuId);
    return { ok: true, pesan: k.aksi.bahanAjar.kelengkapanTersusun, catatan, penyedia, model };
  } catch (galat) {
    return gagalAi(galat, k.aksi.bahanAjar.gagalKelengkapan);
  }
}

// ─────────────────────────────────────────────────────────────
// SUNTINGAN MANUSIA
// ─────────────────────────────────────────────────────────────

const SkemaBab = z.object({
  judul: z.string().trim().min(2, "@aksi.periksa.judulBabPendek").max(200),
  tujuan: z.array(z.string().trim().min(1)).max(20),
  uraian: z.string().trim().nullable(),
  studiKasus: z.string().trim().nullable(),
  ringkasan: z.string().trim().nullable(),
  latihan: z
    .array(
      z.object({
        soal: z.string().trim().min(1),
        kunci: z.string().trim().nullable(),
      }),
    )
    .max(50),
  /** Cap `diubahPada` yang dibawa penyunting — kunci optimistiknya. */
  cap: z.string().nullable(),
});

export type IsiBab = z.infer<typeof SkemaBab>;

/**
 * Menyimpan suntingan satu bab.
 *
 * Menulis ulang SELURUH isi bab beserta latihannya, jadi ia membawa cap versi:
 * dua penyunting pada bab yang sama akan saling menimpa tanpa gejala apa pun.
 * Capnya ikut ke `where` sebuah `updateMany` — bukan dibaca lalu dibandingkan
 * lebih dulu — supaya periksa-dan-tulis tidak dapat disela.
 */
export async function simpanBab(
  bukuId: string,
  nomor: number,
  isi: IsiBab,
): Promise<Hasil> {
  const siap = await bukuUntukTulis(bukuId);
  const k = await kamusAksi();
  if (!siap.ok) return { ok: false, pesan: siap.pesan };

  const parsed = SkemaBab.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, k, k.aksi.umum.dataTidakValid) };
  }
  const d = parsed.data;

  const bab = siap.buku.bab.find((b) => b.nomor === nomor);
  if (!bab) return { ok: false, pesan: k.aksi.takAda.babBukuAjar };

  const sebutan = sisip(k.aksi.bahanAjar.sebutanBab, { nomor });
  const segar = periksaKesegaran(d.cap, sebutan);
  if (!segar.segar) return { ok: false, pesan: segar.pesan };

  try {
    const menang = await prisma.$transaction(async (tx) => {
      const hasil = await tx.babBukuAjar.updateMany({
        where: { id: bab.id, diubahPada: segar.cap },
        data: {
          judul: d.judul,
          tujuan: d.tujuan,
          uraian: d.uraian,
          studiKasus: d.studiKasus,
          ringkasan: d.ringkasan,
          // Penanda bahwa manusia sudah menyentuh bab ini — inilah yang
          // memadamkan `BA-SELURUHNYA-AI`.
          disuntingPada: new Date(),
        },
      });
      if (hasil.count === 0) return false;

      await tx.latihanBab.deleteMany({ where: { babId: bab.id } });
      if (d.latihan.length > 0) {
        await tx.latihanBab.createMany({
          data: d.latihan.map((l, i) => ({
            babId: bab.id,
            nomor: i + 1,
            soal: l.soal,
            kunci: l.kunci,
          })),
        });
      }
      return true;
    });

    if (!menang) return { ok: false, pesan: pesanTertimpa(sebutan) };
  } catch (galat) {
    console.error("[bahan-ajar] gagal menyimpan bab:", galat);
    return { ok: false, pesan: k.aksi.bahanAjar.gagalSimpanBab };
  }

  segarkanBuku(bukuId, nomor);
  return { ok: true, pesan: sisip(k.aksi.bahanAjar.babTersimpan, { nomor }) };
}

const SkemaKelengkapan = z.object({
  prakata: z.string().trim().nullable(),
  pendahuluan: z.string().trim().nullable(),
  biografi: z.string().trim().nullable(),
});

export async function simpanKelengkapan(
  bukuId: string,
  isi: z.infer<typeof SkemaKelengkapan>,
): Promise<Hasil> {
  const siap = await bukuUntukTulis(bukuId);
  const k = await kamusAksi();
  if (!siap.ok) return { ok: false, pesan: siap.pesan };

  const parsed = SkemaKelengkapan.safeParse(isi);
  if (!parsed.success) {
    return { ok: false, pesan: pesanZod(parsed.error, k, k.aksi.umum.dataTidakValid) };
  }

  await prisma.bukuAjar.update({ where: { id: bukuId }, data: parsed.data });
  segarkanBuku(bukuId);
  return { ok: true, pesan: k.aksi.bahanAjar.kelengkapanTersimpan };
}

/**
 * Galat AI dilaporkan apa adanya — kuota habis, kunci ditolak, jawaban
 * terpotong. Kalimat itu yang memberi tahu dosen apa yang harus dilakukan;
 * menggantinya dengan "gagal menyusun" membuang satu-satunya petunjuk.
 */
function gagalAi(galat: unknown, cadangan: string): HasilAi {
  if (galat instanceof GalatAi) return { ok: false, pesan: galat.message };
  console.error("[bahan-ajar] gagal memanggil AI:", galat);
  return { ok: false, pesan: cadangan };
}
