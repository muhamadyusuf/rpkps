"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Menu, PanelLeft, X } from "lucide-react";
import { Lambang } from "@/components/lambang";
import { Tautan } from "@/components/tautan";
import { useBahasa, useJalurTanpaBahasa } from "@/components/penyedia-bahasa";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AplikasiTerhubung } from "@/domain/rupa/aplikasi";
import { GRUP_MENU, type ButirMenu, type GrupMenu } from "@/lib/menu";
import { cn } from "@/lib/utils";
import { PusatKontrol, type IdentitasSesi } from "./pusat-kontrol";
import { IKON_MODUL, UbinMenu, WARNA_MODUL } from "./ubin";

export type { IdentitasSesi };

export type PropsSisi = {
  menu: readonly ButirMenu[];
  identitas: IdentitasSesi;
  /** Janji daftar aplikasi terhubung — untuk pusat kontrol; TIDAK ditunggu tata letak. */
  aplikasi: Promise<AplikasiTerhubung[]>;
  /** Desktop identitas-itts, atau null bila integrasi belum dikonfigurasi. */
  urlIdentitas: string | null;
};

function sedangAktif(jalur: string, href: string) {
  return jalur === href || jalur.startsWith(`${href}/`);
}

function kelompokkan(menu: readonly ButirMenu[]) {
  return GRUP_MENU.map((grup) => ({ grup, butir: menu.filter((m) => m.grup === grup) })).filter(
    (g) => g.butir.length > 0,
  );
}

/** Judul kelompok. `utama` sengaja tanpa judul, seperti butir "Beranda" identitas-itts. */
function useJudulGrup() {
  const { k } = useBahasa();
  return (grup: GrupMenu): string | null =>
    grup === "utama" ? null : k.rupa.grup[grup];
}

/** Angka belum-dibaca di kanan butir menu penuh. */
function Lencana({ jumlah, aktif }: { jumlah: number; aktif: boolean }) {
  const { k, isi } = useBahasa();
  return (
    <span
      aria-label={isi(k.kerangka.belumDibaca, { jumlah })}
      className={cn(
        "rounded-md px-1.5 font-mono text-[11px] leading-5 font-medium tabular-nums",
        aktif ? "bg-tinta-teks/15 text-tinta-teks" : "bg-sinyal-lembut text-sinyal-teks",
      )}
    >
      {jumlah > 9 ? "9+" : jumlah}
    </span>
  );
}

/* ── Menu penuh ─────────────────────────────────────────────────────────── */

const KELAS_KOTAK = "overflow-hidden rounded-xl border border-garis bg-permukaan shadow-b1";
/** Garis pemisah menjorok setelah ubin — penanda daftar berkelompok. */
const KELAS_PEMISAH =
  "before:absolute before:top-0 before:right-0 before:left-[46px] before:h-px before:bg-garis";
const KELAS_BARIS =
  "relative z-[1] flex h-10 items-center gap-3 px-2.5 text-[13.5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

function DaftarMenu({
  menu,
  onPilih,
}: {
  menu: readonly ButirMenu[];
  onPilih?: () => void;
}) {
  const jalur = useJalurTanpaBahasa();
  const { k } = useBahasa();
  const judul = useJudulGrup();

  return (
    <nav aria-label={k.rupa.menu} className="space-y-5">
      {kelompokkan(menu).map(({ grup, butir }) => (
        <div key={grup}>
          {judul(grup) ? <p className="label-teknis px-3 pb-2">{judul(grup)}</p> : null}
          <ul className={KELAS_KOTAK}>
            {butir.map(({ href, label, ikon, lencana }, i) => {
              const aktif = sedangAktif(jalur, href);
              return (
                <li key={href} className={cn("relative", i > 0 && KELAS_PEMISAH)}>
                  <Tautan
                    href={href}
                    onClick={onPilih}
                    aria-current={aktif ? "page" : undefined}
                    className={cn(
                      KELAS_BARIS,
                      aktif ? "bg-tinta font-medium text-tinta-teks" : "text-teks hover:bg-permukaan-2",
                    )}
                  >
                    <UbinMenu ikon={IKON_MODUL[ikon]} warna={WARNA_MODUL[ikon]} />
                    <span className="min-w-0 flex-1 truncate">{k.menu[label]}</span>
                    {lencana ? <Lencana jumlah={lencana} aktif={aktif} /> : null}
                    <ChevronRight
                      aria-hidden
                      className={cn("size-3.5", aktif ? "text-tinta-teks/70" : "text-teks-3")}
                    />
                  </Tautan>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* ── Lajur ringkas ──────────────────────────────────────────────────────── */

/** Label melayang di kanan elemen pada lajur ringkas. */
function Petunjuk({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex justify-center" />}>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

const KELAS_TOMBOL_IKON =
  "flex size-9 items-center justify-center rounded-lg text-teks-2 transition-colors outline-none hover:bg-permukaan-3 hover:text-teks focus-visible:ring-2 focus-visible:ring-ring";

function DaftarMenuRingkas({ menu }: { menu: readonly ButirMenu[] }) {
  const jalur = useJalurTanpaBahasa();
  const { k } = useBahasa();
  const judul = useJudulGrup();

  return (
    <nav aria-label={k.rupa.menu} className="space-y-2">
      {kelompokkan(menu).map(({ grup, butir }, gi) => (
        <ul
          key={grup}
          aria-label={judul(grup) ?? undefined}
          className={cn("space-y-1", gi > 0 && "border-t border-garis pt-2")}
        >
          {butir.map(({ href, label, ikon, lencana }) => {
            const aktif = sedangAktif(jalur, href);
            const nama = k.menu[label];
            return (
              <li key={href}>
                <Petunjuk label={nama}>
                  <Tautan
                    href={href}
                    aria-current={aktif ? "page" : undefined}
                    // Tautan yang isinya hanya ikon wajib bernama, atau pembaca
                    // layar mendengar dua belas "tautan" yang tak dapat dibedakan.
                    aria-label={nama}
                    className={cn(
                      "flex h-9 w-10 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      aktif ? "bg-tinta" : "hover:bg-permukaan-3",
                    )}
                  >
                    <UbinMenu ikon={IKON_MODUL[ikon]} warna={WARNA_MODUL[ikon]} lencana={lencana} />
                  </Tautan>
                </Petunjuk>
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}

/* ── Kepala ─────────────────────────────────────────────────────────────── */

/**
 * "‹ Identitas ITTS" + judul besar. Padanan "‹ Desktop · Pengaturan"
 * identitas-itts: desktop di sana kini satu-satunya peluncur antar-aplikasi
 * (docs/28 §4.1). `<a>` biasa — situs lain.
 */
function TautanIdentitas({ url }: { url: string | null }) {
  const { k } = useBahasa();
  if (!url) return null;
  return (
    <a
      href={url}
      aria-label={k.rupa.keIdentitasAria}
      className="-ml-1 inline-flex h-7 items-center gap-0.5 rounded-md px-1 text-[13px] font-medium text-sinyal-teks outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {k.rupa.keIdentitas}
    </a>
  );
}

function KepalaSisi({ urlIdentitas, aksi }: { urlIdentitas: string | null; aksi?: ReactNode }) {
  const { k } = useBahasa();
  return (
    <div>
      <TautanIdentitas url={urlIdentitas} />
      <div className="mt-1 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[26px] leading-tight font-semibold tracking-[-0.02em] text-teks">
          <Lambang className="size-6" />
          {k.rupa.judul}
        </h2>
        {aksi}
      </div>
    </div>
  );
}

/* ── Sidebar ────────────────────────────────────────────────────────────── */

function TombolRingkas({ ringkas, onAlih }: { ringkas: boolean; onAlih: () => void }) {
  const { k } = useBahasa();
  const label = ringkas ? k.kerangka.lebarkan : k.kerangka.ciutkan;
  return (
    <Petunjuk label={`${label} (⌘\\ / Ctrl+\\)`}>
      <button
        type="button"
        onClick={onAlih}
        aria-label={label}
        aria-expanded={!ringkas}
        aria-keyshortcuts="Meta+\ Control+\"
        className={KELAS_TOMBOL_IKON}
      >
        <PanelLeft aria-hidden className="size-[18px]" />
      </button>
    </Petunjuk>
  );
}

/**
 * Sidebar gaya /pengaturan identitas-itts (docs/28 §4): kolom 280px di layar
 * lebar yang dapat diciutkan menjadi lajur ikon 68px, dan bilah atas + laci
 * dari kanan di bawah `lg`. Isinya HANYA navigasi: akun, tema, bahasa, dan
 * keluar ada di pusat kontrol pojok kanan atas (§4.2). `print:hidden` di semua bagiannya: yang dicetak
 * dokumennya, bukan antarmukanya.
 */
export function Sisi({
  ringkas,
  alihRingkas,
  menu,
  identitas,
  aplikasi,
  urlIdentitas,
}: PropsSisi & { ringkas: boolean; alihRingkas: () => void }) {
  const { k } = useBahasa();
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => {
    if (!terbuka) return;
    const tekan = (e: KeyboardEvent) => e.key === "Escape" && setTerbuka(false);
    window.addEventListener("keydown", tekan);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tekan);
      document.body.style.overflow = "";
    };
  }, [terbuka]);

  const tutup = () => setTerbuka(false);

  return (
    <>
      {ringkas ? (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[68px] flex-col border-r border-garis bg-permukaan-2 lg:flex print:hidden">
          <div className="flex flex-col items-center gap-1 py-3">
            <TombolRingkas ringkas onAlih={alihRingkas} />
            {urlIdentitas ? (
              <Petunjuk label={k.rupa.keIdentitasAria}>
                <a
                  href={urlIdentitas}
                  aria-label={k.rupa.keIdentitasAria}
                  className={cn(KELAS_TOMBOL_IKON, "text-sinyal-teks hover:text-sinyal-teks")}
                >
                  <ChevronLeft aria-hidden className="size-[18px]" />
                </a>
              </Petunjuk>
            ) : null}
          </div>
          <div className="flex-1 overflow-x-hidden overflow-y-auto border-t border-garis px-2 pt-3 pb-4">
            <DaftarMenuRingkas menu={menu} />
          </div>
        </aside>
      ) : (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-garis bg-permukaan-2 lg:flex print:hidden">
          <div className="space-y-4 px-4 pt-4 pb-5">
            <KepalaSisi
              urlIdentitas={urlIdentitas}
              aksi={<TombolRingkas ringkas={false} onAlih={alihRingkas} />}
            />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <DaftarMenu menu={menu} />
          </div>
        </aside>
      )}

      {/* Ponsel & tablet: bilah atas (kembali · judul · menu) + laci. */}
      <header className="sticky top-0 z-40 grid h-14 grid-cols-[1fr_auto_1fr] items-center border-b border-garis bg-latar/85 px-3 backdrop-blur-md lg:hidden print:hidden">
        <span className="justify-self-start">
          {urlIdentitas ? (
            <a
              href={urlIdentitas}
              aria-label={k.rupa.keIdentitasAria}
              className="inline-flex h-9 items-center gap-0.5 rounded-lg px-1.5 text-[14px] font-medium text-sinyal-teks"
            >
              <ChevronLeft aria-hidden className="size-[18px]" />
              {k.rupa.keIdentitas}
            </a>
          ) : (
            <Lambang className="ml-1.5 size-6" />
          )}
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-teks">{k.rupa.judul}</span>
        <div className="flex items-center gap-2 justify-self-end">
          <PusatKontrol identitas={identitas} aplikasi={aplikasi} urlIdentitas={urlIdentitas} />
          <button
            type="button"
            onClick={() => setTerbuka(true)}
            aria-label={k.rupa.menu}
            aria-expanded={terbuka}
            className="relative flex size-9 items-center justify-center rounded-lg border border-garis bg-permukaan text-teks-2"
          >
            <Menu aria-hidden className="size-[18px]" />
            {menu.some((m) => m.lencana) ? (
              <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-sinyal" />
            ) : null}
          </button>
        </div>
      </header>

      {terbuka ? (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="anim-pudar absolute inset-0 bg-black/30" onClick={tutup} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={k.rupa.menu}
            className="anim-geser absolute inset-y-0 right-0 flex w-[min(320px,88vw)] flex-col border-l border-garis bg-permukaan-2"
          >
            <div className="flex items-start justify-between gap-2 px-4 pt-3">
              <KepalaSisi urlIdentitas={urlIdentitas} />
              <button
                type="button"
                onClick={tutup}
                aria-label={k.rupa.tutupMenu}
                className="flex size-9 items-center justify-center rounded-lg text-teks-2 hover:bg-permukaan-3"
              >
                <X aria-hidden className="size-[18px]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
              <DaftarMenu menu={menu} onPilih={tutup} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
