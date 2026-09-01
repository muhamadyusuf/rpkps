import { Badge } from "@/components/ui/badge";
import { TombolKeluar } from "@/components/tombol-keluar";
import { NavigasiPonsel, NavigasiSamping } from "@/components/navigasi";
import { TandaAplikasi } from "@/components/lambang";
import { PengalihTema, TombolTema } from "@/components/pengalih-tema";
import { PengalihBahasa, TombolBahasa } from "@/components/pengalih-bahasa";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MENU } from "@/lib/menu";
import { kamus } from "@/lib/bahasa/server";
import { hitungBelumDibaca } from "@/lib/notifikasi/muat";
import { wajibAktif } from "@/lib/otorisasi";
import { punyaPeran } from "@/lib/otorisasi";

export const dynamic = "force-dynamic";

export default async function LayoutAplikasi({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesi = await wajibAktif();
  const k = await kamus();

  const belumDibaca = await hitungBelumDibaca(sesi.id);

  const menuTampil = MENU.filter(
    (m) => m.peran === null || punyaPeran(sesi, ...m.peran),
  ).map((m) => (m.href === "/notifikasi" ? { ...m, lencana: belumDibaca } : m));

  return (
    // Penyedia tooltip dipasang sekali di sini: penjelas yang bersebelahan —
    // deretan ikon pada satu baris tabel — muncul seketika setelah yang
    // pertama terbuka, alih-alih menunggu jeda lagi tiap kali.
    <TooltipProvider>
      <div className="flex min-h-dvh">
        {/* Rel kiri. Tepi kanannya bukan garis rata: ada pendar sian yang
          meluruh dari atas ke bawah, menandai rel sebagai sisi "instrumen". */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -right-px w-px bg-[linear-gradient(180deg,var(--cahaya),transparent_45%)] opacity-30"
          />

          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <TandaAplikasi />
          </div>

          <NavigasiSamping menu={menuTampil} />

          <div className="space-y-3 border-t border-sidebar-border p-2.5">
            <PengalihBahasa />
            <PengalihTema />

            <div className="panel rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="label-teknis mb-1.5 text-muted-foreground/70">
                {k.kerangka.sesi}
              </p>
              <p className="truncate text-sm font-medium">{sesi.namaLengkap}</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {sesi.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {sesi.daftarPeran.length > 0 ? (
                  sesi.daftarPeran.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {k.enum.peran[p]}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {k.kerangka.tanpaPeran}
                  </Badge>
                )}
              </div>
            </div>

            <TombolKeluar className="w-full justify-start" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="material sticky top-0 z-30 border-b md:hidden">
            <header className="flex h-14 items-center justify-between gap-4 px-4">
              <TandaAplikasi />
              <div className="flex items-center gap-0.5">
                <TombolBahasa />
                <TombolTema />
                <TombolKeluar tampilkanLabel={false} />
              </div>
            </header>

            <NavigasiPonsel menu={menuTampil} />
          </div>

          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-9">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
