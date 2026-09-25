"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, LogOut } from "lucide-react";
import type { Peran } from "@/generated/prisma";
import type { AplikasiTerhubung } from "@/domain/rupa/aplikasi";
import { useBahasa } from "@/components/penyedia-bahasa";
import { keluar } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { AvatarInisial } from "./avatar";
import { PengaturanTampilan } from "./tampilan";
import { IKON_APLIKASI, Ubin } from "./ubin";

export type IdentitasSesi = { nama: string; email: string; peran: readonly Peran[] };

/**
 * Pusat kontrol di pojok kanan atas (docs/28 §4.2): siapa yang masuk beserta
 * perannya, aplikasi terhubung, tema, bahasa, dan tombol keluar — dalam satu
 * panel di balik avatar, seperti pusat kontrol desktop identitas-itts. Dulu
 * isinya di kartu akun, kelompok "Aplikasi terhubung", dan kaki sidebar;
 * memindahkannya memberi menu modul seluruh tinggi sidebar.
 *
 * Avatar selalu terlihat: "sedang masuk sebagai siapa" tidak boleh tersembunyi
 * — komputer lab dipakai bergantian.
 */
export function PusatKontrol({
  identitas,
  aplikasi,
  urlIdentitas,
}: {
  identitas: IdentitasSesi;
  /** Janji daftar dari registri identitas-itts — TIDAK ditunggu tata letak. */
  aplikasi: Promise<AplikasiTerhubung[]>;
  /** Desktop identitas-itts, atau null bila integrasi belum dikonfigurasi. */
  urlIdentitas: string | null;
}) {
  const { k, jalur } = useBahasa();
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  const [keluarMemuat, setKeluarMemuat] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terbuka) return;
    const tekan = (e: KeyboardEvent) => e.key === "Escape" && setTerbuka(false);
    const klikLuar = (e: PointerEvent) => {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setTerbuka(false);
    };
    window.addEventListener("keydown", tekan);
    window.addEventListener("pointerdown", klikLuar);
    return () => {
      window.removeEventListener("keydown", tekan);
      window.removeEventListener("pointerdown", klikLuar);
    };
  }, [terbuka]);

  const jalankanKeluar = async () => {
    setKeluarMemuat(true);
    try {
      await keluar();
    } finally {
      router.replace(jalur("/masuk"));
      router.refresh();
    }
  };

  return (
    <div ref={wadah} className="relative">
      <button
        type="button"
        onClick={() => setTerbuka((v) => !v)}
        aria-label={`${k.rupa.pusatKontrol} — ${identitas.nama}`}
        aria-expanded={terbuka}
        aria-haspopup="dialog"
        className={cn(
          "flex items-center rounded-full p-0.5 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
          terbuka && "ring-2 ring-ring/60",
        )}
      >
        <AvatarInisial nama={identitas.nama} ukuran={30} />
      </button>

      {terbuka ? (
        <div
          role="dialog"
          aria-label={k.rupa.pusatKontrol}
          className="anim-pudar absolute top-full right-0 z-50 mt-2 w-[min(300px,calc(100vw-2rem))] space-y-3 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-angkat-lg"
        >
          <div className="flex items-center gap-3 px-1 pt-1">
            <AvatarInisial nama={identitas.nama} ukuran={42} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{identitas.nama}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                {identitas.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 px-1">
            {identitas.peran.length > 0 ? (
              identitas.peran.map((p) => (
                <span
                  key={p}
                  className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide text-secondary-foreground uppercase"
                >
                  {k.enum.peran[p]}
                </span>
              ))
            ) : (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {k.kerangka.tanpaPeran}
              </span>
            )}
          </div>

          <Suspense fallback={null}>
            <AplikasiTerhubungPanel janji={aplikasi} urlIdentitas={urlIdentitas} />
          </Suspense>

          <div className="rounded-lg bg-muted p-2">
            <PengaturanTampilan />
          </div>

          <button
            type="button"
            onClick={jalankanKeluar}
            disabled={keluarMemuat}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-[13px] font-medium text-bahaya-teks shadow-angkat-sm transition-colors outline-none hover:bg-bahaya-lembut focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <LogOut aria-hidden className="size-[15px]" />
            {keluarMemuat ? k.komponen.keluar.sedang : k.komponen.keluar.label}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Kisi aplikasi terhubung di dalam pusat kontrol. Identitas ITTS selalu
 * pertama dan tidak lewat registri — jalan pulang yang paling perlu tetap
 * ada saat registrinya tidak terjangkau. Daftar selebihnya sudah disaring
 * `uraiDaftarAplikasi` (hanya http/https).
 *
 * `<a>` biasa ke tab baru: tujuannya situs lain, pintu masuk tunggal di sana
 * tidak boleh dimuat awal, dan suntingan RPKPS yang belum tersimpan tidak
 * hilang.
 */
function AplikasiTerhubungPanel({
  janji,
  urlIdentitas,
}: {
  janji: Promise<AplikasiTerhubung[]>;
  urlIdentitas: string | null;
}) {
  const daftar = use(janji);
  const { k } = useBahasa();

  const ubin = [
    ...(urlIdentitas
      ? [{ kunci: "identitas-itts", nama: k.rupa.keIdentitas, href: urlIdentitas, ikon: Fingerprint, warna: "jingga" as const }]
      : []),
    ...daftar.map((a) => ({ kunci: a.klienId, nama: a.nama, href: a.href, ikon: IKON_APLIKASI[a.ikon], warna: a.warna })),
  ];
  if (ubin.length === 0) return null;

  return (
    <div className="border-y border-border py-3">
      <p className="label-teknis px-1 pb-2">{k.rupa.grup.aplikasi}</p>
      <ul className="grid grid-cols-4 gap-1">
        {ubin.map((a) => (
          <li key={a.kunci}>
            <a
              href={a.href}
              target="_blank"
              rel="noopener"
              title={a.nama}
              className="group flex flex-col items-center gap-1.5 rounded-lg px-1 py-2 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Ubin
                ikon={a.ikon}
                warna={a.warna}
                className="size-10 rounded-[10px] shadow-angkat-sm group-active:scale-95"
              />
              <span className="w-full truncate text-center text-[11px] leading-tight">{a.nama}</span>
              <span className="sr-only">({k.rupa.bukaDiTabBaru})</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
