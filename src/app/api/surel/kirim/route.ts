import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { kurasAntrianSurel } from "@/lib/surel/kuras";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penguras antrian surel — docs/10 §2.5 (tahap N5).
 *
 * Dipanggil PENJADWAL, bukan pengguna. Dua jalur, dua rahasia — karena
 * Vercel Cron Jobs HANYA memanggil lewat GET (menyisipkan header
 * `Authorization: Bearer $CRON_SECRET` sendiri, lihat `vercel.json`), rute
 * POST semula tidak pernah tersentuh olehnya walau `vercel.json` sudah
 * dipasang:
 *
 *   • GET  — Vercel Cron Jobs. Cukup setel env `CRON_SECRET` di proyek
 *     Vercel; Vercel yang mengirim headernya, tidak ada yang perlu dipanggil
 *     manual.
 *   • POST — penjadwal lain (crontab kampus, pemanggilan manual/uji coba):
 *       curl -fsS -X POST https://rpkps.itts.ac.id/api/surel/kirim \
 *            -H "Authorization: Bearer $SUREL_CRON_RAHASIA"
 *
 * Salah satu rahasia sudah cukup untuk mengizinkan permintaan mana pun —
 * keduanya WAJIB disetel sendiri-sendiri sebelum jalurnya masing-masing
 * hidup. Rute yang menguras antrian tanpa penjaga adalah rute yang dapat
 * dipakai siapa pun untuk memaksa aplikasi mengirim surel sebanyak yang ia
 * mau — dan kuota Gmail dihitung per hari, bukan per pemanggil.
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

/** Cocok dengan salah satu rahasia yang sudah disetel (env kosong = tidak ikut diperiksa). */
function berwenang(permintaan: Request): boolean {
  const kepala = permintaan.headers.get("authorization") ?? "";
  const diberikan = kepala.startsWith("Bearer ") ? kepala.slice(7).trim() : "";
  if (!diberikan) return false;

  return [process.env.CRON_SECRET, process.env.SUREL_CRON_RAHASIA]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v))
    .some((benar) => rahasiaCocok(diberikan, benar));
}

async function kurasJikaBerwenang(permintaan: Request) {
  const adaPenjaga = process.env.CRON_SECRET?.trim() || process.env.SUREL_CRON_RAHASIA?.trim();
  if (!adaPenjaga) {
    // Belum disetel berarti belum ada penjaganya — dan rute tanpa penjaga
    // tidak boleh bekerja sama sekali.
    return NextResponse.json(
      { pesan: "CRON_SECRET maupun SUREL_CRON_RAHASIA belum disetel." },
      { status: 503 },
    );
  }

  if (!berwenang(permintaan)) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 401 });
  }

  const hasil = await kurasAntrianSurel();
  return NextResponse.json(hasil);
}

export async function GET(permintaan: Request) {
  return kurasJikaBerwenang(permintaan);
}

export async function POST(permintaan: Request) {
  return kurasJikaBerwenang(permintaan);
}
