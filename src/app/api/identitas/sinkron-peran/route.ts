import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sinkronkanSemua } from "@/lib/identitas/sinkron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sinkron peran dari identitas-itts — docs/26 §5. Menyelaraskan SEMUA pegawai:
 * peran turunan dari jabatan, cangkang untuk dosen yang belum pernah masuk,
 * dan pencabutan bagi yang tak lagi aktif.
 *
 * Dipanggil PENJADWAL, bukan pengguna, dengan pola penjaga yang sama seperti
 * `/api/identitas/aktivitas` dan `/api/surel/kirim`:
 *
 *   • GET  — Vercel Cron Jobs (`vercel.json`), header
 *     `Authorization: Bearer $CRON_SECRET` disisipkan Vercel sendiri.
 *   • POST — pemanggilan manual:
 *       curl -fsS -X POST https://rpkps.itts.ac.id/api/identitas/sinkron-peran \
 *            -H "Authorization: Bearer $CRON_SECRET"
 *
 * Jawaban adalah laporan (jumlah, peran yang diabaikan beserta sebabnya, unit yang
 * perlu dipetakan ke prodi). `ditolak` terisi bila pagar penghapusan massal
 * menahan sinkron — dalam kasus itu tidak ada satu baris pun yang diubah.
 */

function rahasiaCocok(diberikan: string, benar: string): boolean {
  const a = Buffer.from(diberikan);
  const b = Buffer.from(benar);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function jalankan(permintaan: Request) {
  const rahasia = process.env.CRON_SECRET?.trim();
  if (!rahasia) {
    // Rute tanpa penjaga tidak boleh bekerja sama sekali.
    return NextResponse.json({ pesan: "CRON_SECRET belum disetel." }, { status: 503 });
  }
  const kepala = permintaan.headers.get("authorization") ?? "";
  if (!kepala.startsWith("Bearer ") || !rahasiaCocok(kepala.slice(7).trim(), rahasia)) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  try {
    return NextResponse.json(await sinkronkanSemua(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // identitas-itts padam, menolak kredensial, atau belum memberi cakupan: tak ada yang diubah.
    return NextResponse.json({ pesan: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function GET(permintaan: Request) {
  return jalankan(permintaan);
}

export async function POST(permintaan: Request) {
  return jalankan(permintaan);
}
