import { cookies } from "next/headers";
import { Cangkang } from "@/components/rupa/cangkang";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MENU } from "@/lib/menu";
import { bacaRelCiut, NAMA_COOKIE_REL } from "@/lib/tata-letak/rel";
import { hitungBelumDibaca } from "@/lib/notifikasi/muat";
import { muatAplikasiTerhubung, tautanIdentitasItts } from "@/lib/identitas/aplikasi";
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
   * Keduanya saling bebas: jumlah notifikasi milik pengguna, lebar sidebar
   * milik peramban. Berurutan mereka membayar dua tunggu untuk pekerjaan yang
   * muat dalam satu.
   */
  const [belumDibaca, jar] = await Promise.all([
    hitungBelumDibaca(sesi.id),
    cookies(),
  ]);

  // TIDAK di-`await`: daftar aplikasi terhubung datang dari layanan lain, dan
  // halaman tidak boleh menunggu jaringan demi satu kelompok menu. Janjinya
  // dibuka sidebar di balik Suspense (docs/28 §4.3); pemuatnya tidak pernah
  // menolak.
  const aplikasi = muatAplikasiTerhubung();

  const menuTampil = MENU.filter(
    (m) => m.peran === null || punyaPeran(sesi, ...m.peran),
  ).map((m) => (m.href === "/notifikasi" ? { ...m, lencana: belumDibaca } : m));

  return (
    // Penyedia tooltip dipasang sekali di sini: penjelas yang bersebelahan —
    // deretan ikon pada satu baris tabel, atau lajur sidebar yang ringkas —
    // muncul seketika setelah yang pertama terbuka, alih-alih menunggu jeda
    // lagi tiap kali.
    <TooltipProvider>
      <Cangkang
        ringkasAwal={bacaRelCiut(jar.get(NAMA_COOKIE_REL)?.value)}
        menu={menuTampil}
        identitas={{
          nama: sesi.namaLengkap,
          email: sesi.email,
          peran: sesi.daftarPeran,
        }}
        aplikasi={aplikasi}
        urlIdentitas={tautanIdentitasItts()}
      >
        {children}
      </Cangkang>
    </TooltipProvider>
  );
}
