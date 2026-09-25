import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { sinkronkanAktivitas, type HasilSinkron } from "./aktivitas-inti";

/**
 * Pelaporan aktivitas ke identitas-itts (docs/24), dengan konfigurasi yang
 * sama dengan gerbang kepegawaian (`IDENTITAS_ITTS_*`). Belum dikonfigurasi =
 * dilewati, bukan galat — sama seperti gerbangnya.
 */
export async function laporkanAktivitas(opsi: { ulang?: boolean } = {}): Promise<HasilSinkron | { dilewati: true }> {
  const konfig = env.identitasItts;
  if (!konfig) return { dilewati: true };
  return sinkronkanAktivitas(prisma, konfig, opsi);
}
