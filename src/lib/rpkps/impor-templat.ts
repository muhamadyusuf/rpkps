import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ringkasDraf } from "@/domain/rpkps/draf";
import {
  periksaBerkas,
  periksaIsiZip,
  rakitTemplat,
  type HasilTemplat,
  type TemuanImpor,
} from "@/domain/rpkps/templat";
import { konteksDomain, muatKonteks, type Konteks } from "@/lib/rpkps/konteks-draf";
import { bacaTemplat } from "@/lib/rpkps/templat-excel";

/**
 * Analisis berkas template terhadap keadaan RPKPS saat ini (docs/23 §3.2).
 *
 * Dipakai DUA kali — pratinjau dan penerapan — dan itu disengaja: penerapan
 * menerima BERKAS yang sama lagi dan menganalisisnya dari awal, bukan draf
 * hasil pratinjau. Pratinjau bukan otorisasi (docs/23 T3); draf yang dikirim
 * balik peramban dapat dikarang, sedangkan berkas yang dibaca ulang tidak
 * dapat menghasilkan sesuatu yang berbeda dari yang diperiksa.
 */

export type Analisis =
  | { ok: false; temuan: TemuanImpor[] }
  | {
      ok: true;
      k: Konteks;
      hasil: HasilTemplat;
      /** SHA-256 berkas — untuk jejak audit, bukan isinya. */
      sidikBerkas: string;
    };

export async function analisisBerkas(rpkpsId: string, berkas: File): Promise<Analisis> {
  const kepala = new Uint8Array(await berkas.slice(0, 4).arrayBuffer());
  const salah = periksaBerkas({ nama: berkas.name, ukuran: berkas.size, kepala });
  if (salah) return { ok: false, temuan: [salah] };

  const isi = await berkas.arrayBuffer();
  const rusak = periksaIsiZip(new Uint8Array(isi));
  if (rusak) return { ok: false, temuan: [rusak] };

  const [k, terbaca] = await Promise.all([
    muatKonteks(prisma, rpkpsId),
    bacaTemplat(isi).then(
      (v) => ({ ok: true as const, v }),
      () => ({ ok: false as const }),
    ),
  ]);
  if (!k) return { ok: false, temuan: [{ kode: "I-BERKAS-RUSAK" }] };
  if (!terbaca.ok) return { ok: false, temuan: [{ kode: "I-BERKAS-RUSAK" }] };

  const hasil = rakitTemplat(terbaca.v, {
    rpkpsId,
    kodeMk: k.mataKuliah.kode,
    batas: konteksDomain(k),
  });
  return {
    ok: true,
    k,
    hasil,
    sidikBerkas: createHash("sha256").update(Buffer.from(isi)).digest("hex"),
  };
}

export { ringkasDraf };
