import { Bell, BellOff, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { wajibAktif } from "@/lib/otorisasi";
import { muatNotifikasi } from "@/lib/notifikasi/muat";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { bukaNotifikasi, tandaiSemuaDibaca } from "./aksi";
import { teksNotifikasi } from "@/lib/bahasa/notifikasi";
import { kanalSurelMenyala } from "@/lib/surel/pengirim";
import { prisma } from "@/lib/prisma";
import { SakelarSurel } from "./sakelar-surel";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).notifikasi.judul };
}

/** Sepanjang riwayat yang masih layak dibaca sekali duduk. */
const BATAS = 50;

export default async function HalamanNotifikasi() {
  const sesi = await wajibAktif();
  /*
   * Preferensi surel dibaca berdampingan dengan daftarnya, bukan sesudahnya:
   * keduanya saling bebas, dan basis datanya jauh.
   */
  const [daftar, akun] = await Promise.all([
    muatNotifikasi(sesi.id, BATAS),
    prisma.pengguna.findUnique({
      where: { id: sesi.id },
      select: { surelNotifikasi: true },
    }),
  ]);
  const belum = daftar.filter((n) => n.dibacaPada === null).length;
  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {k.notifikasi.judul}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {k.notifikasi.keterangan}
          </p>
        </div>
        {belum > 0 ? (
          <form action={tandaiSemuaDibaca}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:border-cahaya/35"
            >
              <Check className="size-4" />
              {k.notifikasi.tandaiSemua}
            </button>
          </form>
        ) : null}
      </header>

      {/*
        Sakelar kanal surel hanya tampil bila kanalnya memang menyala di
        server: sakelar yang tidak dapat ditepati aplikasi lebih buruk daripada
        tidak ada sakelar sama sekali (docs/10 §2.5).
      */}
      {kanalSurelMenyala() ? (
        <SakelarSurel nyala={akun?.surelNotifikasi ?? true} />
      ) : null}

      {daftar.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <BellOff className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{k.notifikasi.kosong}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {daftar.map((n) => {
            const baru = n.dibacaPada === null;
            const teks = teksNotifikasi(n.data, n, k);
            return (
              <li key={n.id}>
                {/* Baris adalah tombol kirim, bukan tautan: membukanya sekaligus
                    menandainya terbaca, dan keduanya harus terjadi bersama. */}
                <form action={bukaNotifikasi.bind(null, n.id)}>
                  <button
                    type="submit"
                    className={`panel flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-cahaya/35 ${
                      baru ? "border-cahaya/30 bg-cahaya/[0.06]" : "bg-card"
                    }`}
                  >
                    <Bell
                      className={`mt-0.5 size-4 shrink-0 ${
                        baru ? "text-cahaya" : "text-muted-foreground/60"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className={`text-sm ${baru ? "font-semibold" : "font-medium"}`}>
                          {teks.judul}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {tanggal(n.dibuatPada, b, "waktu")}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {teks.ringkasan}
                      </span>
                    </span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
