"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsLeft, ChevronsRight, FileText, Maximize2 } from "lucide-react";
import { TautanIkon, TombolIkon } from "@/components/tombol-ikon";
import {
  jepitLebar,
  LEBAR_MAKS,
  LEBAR_MIN,
  NAMA_COOKIE_PANEL,
  tulisPreferensiPanel,
} from "@/lib/pratinjau/panel";

/**
 * Bidang kerja terbelah: penyunting di kiri, naskah di kanan.
 *
 * Naskahnya dirender di SERVER dan masuk ke sini sebagai `kanan` — sebuah
 * prop, bukan sesuatu yang dibangun ulang di peramban. Itulah yang membuatnya
 * ikut berubah sendiri: setiap `router.refresh()` sesudah menyimpan (dan
 * seluruh penyunting RPKPS memanggilnya) menghasilkan pohon server yang baru,
 * dan React menukar isi panel tanpa menyentuh keadaan panelnya — lebar, posisi
 * gulung, dan fokus di kiri tetap di tempatnya.
 *
 * Lebar dijalankan sebagai gaya sebaris selama menyeret, dan baru dicatat ke
 * cookie saat dilepas: menulis cookie tiap gerakan tetikus berarti ratusan
 * penulisan per seretan, dan tidak satu pun dibutuhkan sampai halaman berikut
 * dimuat.
 */
export function PanelBelah({
  terbuka,
  lebarAwal,
  jalurPenuh,
  jangkar,
  label,
  kiri,
  kanan,
}: {
  terbuka: boolean;
  lebarAwal: number;
  /** Alamat pratinjau satu halaman penuh — tempat mengganti bahasa dan mencetak. */
  jalurPenuh: string;
  /** Id elemen di dalam naskah yang layak dilihat lebih dulu, mis. minggu ini. */
  jangkar?: string;
  label: {
    judul: string;
    buka: string;
    tutup: string;
    penuh: string;
    seret: string;
  };
  kiri: React.ReactNode;
  kanan: React.ReactNode;
}) {
  const router = useRouter();
  const [lebar, setLebar] = useState(lebarAwal);
  /** Lebar terkini selama seretan — dibaca saat penunjuk dilepas. */
  const lebarKini = useRef(lebarAwal);
  /**
   * Wadah GULUNG, bukan isinya. Yang diukur harus elemen yang TIDAK membawa
   * `zoom`: lebar elemen ber-zoom dilaporkan dalam sistem koordinatnya sendiri,
   * jadi mengukurnya untuk menghitung zoom berikutnya membuat keduanya saling
   * mengejar dan skalanya berayun tanpa pernah tenang.
   */
  const gulung = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);

  const simpan = useCallback((berikutnya: { terbuka: boolean; lebar: number }) => {
    document.cookie = `${NAMA_COOKIE_PANEL}=${tulisPreferensiPanel(berikutnya)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);

  const alihkan = useCallback(() => {
    simpan({ terbuka: !terbuka, lebar });
    // Naskah hanya dimuat server ketika panel terbuka, jadi membukanya perlu
    // satu perjalanan — dan menutupnya membebaskan kueri itu untuk seterusnya.
    router.refresh();
  }, [lebar, router, simpan, terbuka]);

  /**
   * Seretan pemisah. `setPointerCapture` dipakai supaya penunjuk yang melaju
   * melewati tepi panel tetap terlacak; tanpanya seretan cepat lepas begitu
   * kursor menyeberang ke dalam iframe atau ke luar jendela.
   */
  const mulaiSeret = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const pegangan = e.currentTarget;
      pegangan.setPointerCapture(e.pointerId);
      const awalX = e.clientX;
      const awalLebar = lebarKini.current;

      const gerak = (ev: PointerEvent) => {
        // Panel di KANAN: menyeret ke kiri melebarkannya.
        lebarKini.current = jepitLebar(awalLebar - (ev.clientX - awalX));
        setLebar(lebarKini.current);
      };
      /*
        Lebar akhir dibaca dari ref, bukan dari pembaruan keadaan berbentuk
        fungsi: React boleh memanggil fungsi pembaru itu lebih dari sekali, dan
        menulis cookie di dalamnya berarti efek samping yang ikut berlipat.
        `pointercancel` ditangani sama seperti `pointerup` — tanpa itu, seretan
        yang direbut peramban (mis. gerakan sistem) meninggalkan pendengar yang
        tidak pernah dilepas.
      */
      const lepas = (ev: PointerEvent) => {
        if (pegangan.hasPointerCapture(ev.pointerId)) {
          pegangan.releasePointerCapture(ev.pointerId);
        }
        pegangan.removeEventListener("pointermove", gerak);
        pegangan.removeEventListener("pointerup", lepas);
        pegangan.removeEventListener("pointercancel", lepas);
        simpan({ terbuka: true, lebar: lebarKini.current });
      };
      pegangan.addEventListener("pointermove", gerak);
      pegangan.addEventListener("pointerup", lepas);
      pegangan.addEventListener("pointercancel", lepas);
    },
    [simpan],
  );

  /** Papan tik: pemisah harus dapat digeser tanpa tetikus. */
  const tombolSeret = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const langkah = e.shiftKey ? 64 : 16;
      const arah = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
      if (arah === 0) return;
      e.preventDefault();
      const baru = jepitLebar(lebarKini.current + arah * langkah);
      lebarKini.current = baru;
      setLebar(baru);
      simpan({ terbuka: true, lebar: baru });
    },
    [simpan],
  );

  /**
   * Lembar A4 berukuran tetap 21 cm; panel hampir tidak pernah selebar itu.
   * Alih-alih memotongnya, seluruh naskah dikecilkan supaya lebar lembar potret
   * pas — persis seperti "fit width" pada pembaca PDF. Lembar mendatar tetap
   * lebih lebar dan menggulung sendiri di dalam wadahnya.
   */
  useEffect(() => {
    const wadah = gulung.current;
    if (!wadah) return;
    const A4 = 794; // 21 cm pada 96 dpi
    const hitung = () => {
      const tersedia = wadah.clientWidth - 8;
      setSkala(Math.min(1, Math.max(0.35, tersedia / A4)));
    };
    hitung();
    const pengamat = new ResizeObserver(hitung);
    pengamat.observe(wadah);
    return () => pengamat.disconnect();
  }, [terbuka]);

  /**
   * Melompat ke bagian naskah yang sedang disunting — minggu ini, tugas ini.
   * Bergantung pada `jangkar` SAJA: menyegarkan setelah menyimpan tidak boleh
   * melempar balik posisi gulung yang sudah digeser dosen sendiri.
   */
  useEffect(() => {
    if (!terbuka || !jangkar) return;
    const sasaran = document.getElementById(jangkar);
    sasaran?.scrollIntoView({ block: "center" });
  }, [jangkar, terbuka]);

  if (!terbuka) {
    return (
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">{kiri}</div>
        {/*
          Rel tipis, bukan tombol melayang: melayang berarti menutupi isi
          halaman pada lebar layar yang tidak terduga, dan panel ini justru
          soal ruang.
        */}
        <div className="sticky top-6 hidden shrink-0 lg:block print:hidden">
          <button
            type="button"
            onClick={alihkan}
            title={label.buka}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-1.5 py-3 text-xs text-muted-foreground transition-colors hover:border-cahaya/45 hover:text-foreground"
          >
            <ChevronsLeft className="size-4" />
            <span className="[writing-mode:vertical-rl] tracking-wide">
              {label.judul}
            </span>
            <FileText className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-stretch">
      <div className="min-w-0 flex-1">{kiri}</div>

      {/*
        Pemisah. `role="separator"` beserta nilai aria-nya membuat lebar panel
        dapat diubah dari papan tik — pengaturan tata letak yang hanya bisa
        diseret adalah pengaturan yang tidak dapat dipakai sebagian orang.
      */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label.seret}
        aria-valuenow={lebar}
        aria-valuemin={LEBAR_MIN}
        aria-valuemax={LEBAR_MAKS}
        tabIndex={0}
        onPointerDown={mulaiSeret}
        onKeyDown={tombolSeret}
        className="group/pemisah relative hidden w-3 shrink-0 cursor-col-resize touch-none lg:block print:hidden"
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover/pemisah:bg-cahaya/60 group-focus-visible/pemisah:bg-cahaya" />
      </div>

      <aside
        style={{ width: lebar }}
        className="hidden shrink-0 lg:block print:hidden"
      >
        <div className="sticky top-6 flex max-h-[calc(100dvh-3rem)] flex-col rounded-xl border bg-muted/40">
          <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{label.judul}</p>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {Math.round(skala * 100)}%
            </span>
            <TautanIkon href={jalurPenuh} petunjuk={label.penuh}>
              <Maximize2 />
            </TautanIkon>
            <TombolIkon petunjuk={label.tutup} onClick={alihkan}>
              <ChevronsRight />
            </TombolIkon>
          </header>

          <div ref={gulung} className="min-h-0 grow overflow-auto p-1">
            <div style={{ zoom: skala }}>
              {kanan}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
