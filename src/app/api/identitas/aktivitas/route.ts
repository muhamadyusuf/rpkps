import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { laporkanAktivitas } from "@/lib/identitas/aktivitas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Isian mundur riwayat panjang diteruskan beberapa putaran; satu putaran berhenti sendiri di ±45 detik. */
export const maxDuration = 60;

/**
 * Penyelaras aktivitas → identitas-itts — docs/24.
 *
 * Dipanggil PENJADWAL, bukan pengguna, dengan pola penjaga yang sama seperti
 * `/api/surel/kirim`:
 *
 *   • GET  — Vercel Cron Jobs (`vercel.json`), header
 *     `Authorization: Bearer $CRON_SECRET` disisipkan Vercel sendiri.
 *   • POST — pemanggilan manual, mis. menjalankan isian mundur sampai tuntas:
 *       curl -fsS -X POST https://rpkps.itts.ac.id/api/identitas/aktivitas \
 *            -H "Authorization: Bearer $CRON_SECRET"
 *     Tambahkan `?ulang=1` untuk mengirim ulang SELURUH riwayat (aman —
 *     identitas-itts idempoten), mis. setelah pegawai yang dulu ditolak
 *     akhirnya didaftarkan di identitas-itts.
 *
 * Jawaban memuat `tuntas` per sumber; selama masih `false`, panggil lagi.
 */

function rahasiaCocok(diberikan: string, benar: string): boolean {
  const a = Buffer.from(diberikan);
  const b = Buffer.from(benar);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function jalankan(permintaan: Request, ulang: boolean) {
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
    return NextResponse.json(await laporkanAktivitas({ ulang }));
  } catch (e) {
    // identitas-itts padam atau menolak kredensial: kursor tidak maju,
    // putaran berikutnya mengulang dari tempat yang sama.
    return NextResponse.json({ pesan: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function GET(permintaan: Request) {
  return jalankan(permintaan, false);
}

export async function POST(permintaan: Request) {
  return jalankan(permintaan, new URL(permintaan.url).searchParams.get("ulang") === "1");
}
