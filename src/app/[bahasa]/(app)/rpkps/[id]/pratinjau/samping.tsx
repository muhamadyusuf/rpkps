import { cookies } from "next/headers";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { labelDokumen } from "@/lib/dokumen/label";
import { rakitDariRpkps } from "@/lib/dokumen/rakit-naskah";
import { bacaPreferensiPanel, NAMA_COOKIE_PANEL } from "@/lib/pratinjau/panel";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";
import { NaskahRpkps } from "./naskah";
import { PanelBelah } from "./panel-belah";

/**
 * Membelah sebuah halaman penyunting: isinya di kiri, naskah tercetak di
 * kanan.
 *
 * Dipasang di HALAMAN, bukan di layout `/rpkps/[id]`, dan itu keputusan yang
 * disengaja. Layout tidak menerima data halaman apa pun, jadi ia harus memuat
 * RPKPS-nya sendiri — satu `muatRpkps()` penuh lagi di samping yang sudah
 * dilakukan halaman, pada basis data yang jauh. Halaman sudah memegang
 * barisnya; `rakitDariRpkps` menerimanya apa adanya dan hanya menambah bacaan
 * yang belum ada (salinan beku, tanda tangan, riwayat).
 *
 * Naskah dirender di server dan diteruskan sebagai prop ke panel di sisi
 * klien. Karena itu ia ikut berubah dengan sendirinya: setiap penyunting RPKPS
 * memanggil `router.refresh()` setelah menyimpan, pohon server dirakit ulang,
 * dan panel menerima naskah baru tanpa kehilangan lebar maupun posisi
 * gulungnya.
 *
 * Panel yang TERTUTUP tidak membaca apa pun. Karena itu preferensinya tinggal
 * di cookie, bukan di `localStorage`: keputusannya harus sudah diketahui
 * sebelum halaman dirender.
 */
export async function PratinjauSamping({
  rpkps,
  jangkar,
  children,
}: {
  rpkps: RpkpsLengkap;
  /**
   * Bagian naskah yang layak dilihat lebih dulu — `naskah-minggu-3`,
   * `naskah-tugas-1`. Panel melompat ke sana saat dibuka.
   */
  jangkar?: string;
  children: React.ReactNode;
}) {
  const [jar, k, b] = await Promise.all([cookies(), kamus(), bahasaAktif()]);
  const { terbuka, lebar } = bacaPreferensiPanel(jar.get(NAMA_COOKIE_PANEL)?.value);
  const p = k.rpkps.pratinjau;

  const label = {
    judul: p.judul,
    buka: p.buka,
    tutup: p.tutup,
    penuh: p.penuh,
    seret: p.seret,
  };

  if (!terbuka) {
    return (
      <PanelBelah
        terbuka={false}
        lebarAwal={lebar}
        jalurPenuh={`/rpkps/${rpkps.id}/pratinjau`}
        label={label}
        kiri={children}
        kanan={null}
      />
    );
  }

  const { naskah, riwayat, ttd, sidik } = await rakitDariRpkps(rpkps, { bahasa: b });

  return (
    <PanelBelah
      terbuka
      lebarAwal={lebar}
      jalurPenuh={`/rpkps/${rpkps.id}/pratinjau`}
      jangkar={jangkar}
      label={label}
      kiri={children}
      kanan={
        <NaskahRpkps
          r={naskah}
          L={labelDokumen(b)}
          ttd={ttd}
          riwayat={riwayat}
          sidik={sidik}
          bahasa={b}
        />
      }
    />
  );
}
