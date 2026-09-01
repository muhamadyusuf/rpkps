import {
  namaBerganti,
  rencanakanKomponen,
  type KomponenMasuk,
} from "@/domain/rpkps/komponen-nilai";
import type { Klien } from "@/lib/rpkps/kebijakan-inti";

/**
 * Penulisan daftar komponen nilai ke basis data.
 *
 * Terpisah dari server action-nya dengan alasan yang sama seperti
 * `lib/rpkps/struktur.ts`: yang paling mungkin salah di sini justru hal yang
 * tak terlihat pada uji domain murni — tautan `pertemuan.komponen_nilai_id`
 * yang lenyap karena `onDelete: SetNull`, dan `@@unique([rpkpsId, nama])` yang
 * tertabrak saat dua komponen bertukar nama. Keduanya hanya terbukti terhadap
 * Postgres sungguhan, jadi berkas ini menerima klien Prisma sebagai parameter
 * dan tidak menandai dirinya `server-only`.
 *
 * Wewenang dijaga aksi pemanggil, yang selalu lewat `wenangRpkps` lebih dulu.
 */

export type HasilKomponen =
  | { ok: false; galat: string }
  | { ok: true; lepasPertemuan: number; lepasTugas: number };

export async function tulisKomponenNilai(
  db: Klien,
  rpkpsId: string,
  komponen: readonly KomponenMasuk[],
): Promise<HasilKomponen> {
  const ada = await db.komponenNilai.findMany({
    where: { rpkpsId },
    select: { id: true, nama: true },
    orderBy: { urutan: "asc" },
  });

  const rencana = rencanakanKomponen(komponen, ada);
  if (rencana.galat) return { ok: false, galat: rencana.galat };

  return db.$transaction(async (tx) => {
    // Dihitung SEBELUM penghapusan: `SetNull` tidak meninggalkan jejak, jadi
    // setelahnya tidak ada lagi cara mengetahui berapa baris yang kehilangan
    // komponennya — dan dosen berhak diberi tahu.
    const [lepasPertemuan, lepasTugas] =
      rencana.hapus.length > 0
        ? await Promise.all([
            tx.pertemuan.count({ where: { komponenNilaiId: { in: rencana.hapus } } }),
            tx.tugas.count({ where: { komponenNilaiId: { in: rencana.hapus } } }),
          ])
        : [0, 0];

    if (rencana.hapus.length > 0) {
      await tx.komponenNilai.deleteMany({ where: { id: { in: rencana.hapus } } });
    }

    // Nama sementara lebih dulu, supaya menukar nama dua komponen tidak
    // menabrak @@unique([rpkpsId, nama]) di tengah transaksi.
    for (const p of namaBerganti(rencana.perbarui, ada)) {
      await tx.komponenNilai.update({ where: { id: p.id }, data: { nama: `·ganti·${p.id}` } });
    }
    for (const p of rencana.perbarui) {
      await tx.komponenNilai.update({
        where: { id: p.id },
        data: { nama: p.nama, bobot: p.bobot, urutan: p.urutan },
      });
    }
    if (rencana.tambah.length > 0) {
      await tx.komponenNilai.createMany({
        data: rencana.tambah.map((k) => ({
          rpkpsId,
          nama: k.nama,
          bobot: k.bobot,
          urutan: k.urutan,
        })),
      });
    }

    return { ok: true as const, lepasPertemuan, lepasTugas };
  });
}
