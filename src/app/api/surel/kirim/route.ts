import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { kurasAntrianSurel } from "@/lib/surel/kuras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penguras antrian surel — docs/10 §2.5 (tahap N5).
 *
 * Dipanggil PENJADWAL, bukan pengguna. Dua cara memasangnya, dan rute ini
 * melayani keduanya tanpa perubahan kode:
 *
 *   • Vercel Cron — tambahkan `crons` pada konfigurasi proyek, tiap 5 menit.
 *   • Penjadwal kampus — satu baris `curl` di crontab server:
 *       curl -fsS -X POST https://rpkps.itts.ac.id/api/surel/kirim \
 *            -H "Authorization: Bearer $SUREL_CRON_RAHASIA"
 *
 * Rahasianya WAJIB. Rute yang menguras antrian tanpa penjaga adalah rute yang
 * dapat dipakai siapa pun untuk memaksa aplikasi mengirim surel sebanyak yang
 * ia mau — dan kuota Gmail dihitung per hari, bukan per pemanggil.
 *
 * Perbandingannya `timingSafeEqual`, bukan `===`: rahasia yang dibandingkan
 * karakter demi karakter bocor panjangnya lewat waktu balasan.
 */

function rahasiaCocok(diberikan: string, benar: string): boolean {
  const a = Buffer.from(diberikan);
  const b = Buffer.from(benar);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(permintaan: Request) {
  const benar = process.env.SUREL_CRON_RAHASIA?.trim();
  if (!benar) {
    // Belum disetel berarti belum ada penjaganya — dan rute tanpa penjaga
    // tidak boleh bekerja sama sekali.
    return NextResponse.json(
      { pesan: "SUREL_CRON_RAHASIA belum disetel." },
      { status: 503 },
    );
  }

  const kepala = permintaan.headers.get("authorization") ?? "";
  const diberikan = kepala.startsWith("Bearer ") ? kepala.slice(7).trim() : "";
  if (!diberikan || !rahasiaCocok(diberikan, benar)) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const hasil = await kurasAntrianSurel();
  return NextResponse.json(hasil);
}
