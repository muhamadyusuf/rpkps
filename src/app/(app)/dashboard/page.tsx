import { CircleAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LABEL_PERAN, punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { muatDasbor } from "@/lib/dasbor/muat";
import { AntrianKerja } from "./antrian";
import { PanelAdmin } from "./panel-admin";
import { PanelAsesor } from "./panel-asesor";
import { PanelDosen } from "./panel-dosen";
import { PanelMahasiswa } from "./panel-mahasiswa";
import { PanelMutu } from "./panel-mutu";
import { PanelProdi } from "./panel-prodi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dasbor" };

/**
 * Dasbor — docs/07-dasbor-peran.md.
 *
 * Panel dipilih menurut peran yang dipegang akun, dan BERTUMPUK: Kaprodi yang
 * juga mengampu mata kuliah melihat panel prodi dan panel dosen sekaligus.
 * Tidak ada "peran tertinggi" yang menelan peran lain — justru itu yang akan
 * menyembunyikan sebagian pekerjaan orangnya.
 *
 * Halaman ini hanya MEMBACA. Setiap kartu adalah pintu ke halaman modul yang
 * berwenang, sehingga otorisasi tetap tinggal di satu tempat.
 */
export default async function HalamanDasbor() {
  const sesi = await wajibAktif();
  const data = await muatDasbor(sesi);

  const bolehKelolaKebijakan = punyaPeran(sesi, "ADMIN", "GPM");
  const tanpaPanel =
    data.prodi.length === 0 &&
    !data.mutu &&
    !data.dosen &&
    !data.admin &&
    !data.asesor &&
    !data.mahasiswa;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">Dasbor</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Selamat datang, {sesi.nama.split(" ")[0]}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {data.tahunAktif
            ? `Tahun akademik aktif: ${data.tahunAktif.kode.replace("-", " ")}`
            : "Belum ada tahun akademik yang ditandai aktif."}
          {sesi.daftarPeran.length > 0
            ? ` · ${sesi.daftarPeran.map((p) => LABEL_PERAN[p]).join(", ")}`
            : null}
        </p>
      </header>

      <AntrianKerja butir={data.antrian} />

      {data.kebijakan?.status === "DRAF" && bolehKelolaKebijakan ? (
        <Card className="panel border-l-2 border-l-warning bg-warning/8">
          <CardHeader>
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">
                  Kebijakan beban belajar belum diberlakukan
                </CardTitle>
                <CardDescription className="mt-1">
                  Angkanya masih bawaan SN-Dikti. Konfirmasi enam pertanyaan ke
                  Penjaminan Mutu sebelum RPKPS pertama disimpan — memperbaikinya
                  setelah ada dokumen terbit berarti menghitung ulang semuanya.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ButtonLink variant="outline" href="/kebijakan">
              Tinjau kebijakan
            </ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      {data.prodi.map((p) => (
        <PanelProdi key={p.prodi.id} data={p} />
      ))}

      {data.mutu ? <PanelMutu data={data.mutu} /> : null}
      {data.dosen ? <PanelDosen data={data.dosen} /> : null}
      {data.admin ? <PanelAdmin data={data.admin} /> : null}
      {data.asesor ? <PanelAsesor data={data.asesor} /> : null}
      {data.mahasiswa ? <PanelMahasiswa data={data.mahasiswa} /> : null}

      {tanpaPanel ? (
        <Card className="panel">
          <CardHeader>
            <CardTitle className="text-base">Akun Anda belum punya peran</CardTitle>
            <CardDescription className="mt-1">
              Administrator perlu mengisi NIDN/NIP, peran, dan program studi
              sebelum modul kurikulum, RPKPS, dan evaluasi terbuka untuk Anda.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
