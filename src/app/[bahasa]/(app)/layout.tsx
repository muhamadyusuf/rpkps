import { cookies } from "next/headers";
import { TombolKeluar } from "@/components/tombol-keluar";
import { NavigasiPonsel } from "@/components/navigasi";
import { RelSamping } from "@/components/rel-samping";
import { TandaAplikasi } from "@/components/lambang";
import { TombolTema } from "@/components/pengalih-tema";
import { TombolBahasa } from "@/components/pengalih-bahasa";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MENU } from "@/lib/menu";
import { bacaRelCiut, NAMA_COOKIE_REL } from "@/lib/tata-letak/rel";
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

  /**
   * Keduanya saling bebas: jumlah notifikasi milik pengguna, lebar rel milik
   * peramban. Berurutan mereka membayar dua tunggu untuk pekerjaan yang muat
   * dalam satu.
   */
  const [belumDibaca, jar] = await Promise.all([
    hitungBelumDibaca(sesi.id),
    cookies(),
  ]);

  const menuTampil = MENU.filter(
    (m) => m.peran === null || punyaPeran(sesi, ...m.peran),
  ).map((m) => (m.href === "/notifikasi" ? { ...m, lencana: belumDibaca } : m));

  return (
    // Penyedia tooltip dipasang sekali di sini: penjelas yang bersebelahan —
    // deretan ikon pada satu baris tabel, atau rel navigasi yang sedang ciut —
    // muncul seketika setelah yang pertama terbuka, alih-alih menunggu jeda
    // lagi tiap kali.
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <RelSamping
          ciutAwal={bacaRelCiut(jar.get(NAMA_COOKIE_REL)?.value)}
          menu={menuTampil}
          identitas={{
            nama: sesi.namaLengkap,
            email: sesi.email,
            peran: sesi.daftarPeran,
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="material sticky top-0 z-30 border-b md:hidden print:hidden">
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

          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-9 print:p-0">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
