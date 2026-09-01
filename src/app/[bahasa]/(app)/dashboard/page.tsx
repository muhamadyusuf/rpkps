import { CircleAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi } from "@/lib/bahasa/teks";
import { muatDasbor } from "@/lib/dasbor/muat";
import { LencanaTenggat } from "@/components/lencana-tenggat";
import { AntrianKerja } from "./antrian";
import { PanelAdmin } from "./panel-admin";
import { PanelAsesor } from "./panel-asesor";
import { PanelDosen } from "./panel-dosen";
import { PanelMahasiswa } from "./panel-mahasiswa";
import { PanelMutu } from "./panel-mutu";
import { PanelProdi } from "./panel-prodi";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).dasbor.label };
}

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
  const k = await kamus();
  const b = await bahasaAktif();

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
        <p className="label-teknis mb-2 text-muted-foreground/70">{k.dasbor.label}</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {isi(k.dasbor.salam, { nama: sesi.nama.split(" ")[0] })}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {data.tahunAktif
            ? isi(k.dasbor.taAktif, {
                kode: data.tahunAktif.kode.replace("-", " "),
              })
            : k.dasbor.taKosong}
          {sesi.daftarPeran.length > 0
            ? ` · ${sesi.daftarPeran.map((p) => k.enum.peran[p]).join(", ")}`
            : null}
        </p>
        {data.tahunAktif?.tenggatPenyusunan ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {k.dasbor.tenggatRpkps}{" "}
              <strong className="text-foreground">
                {tanggal(data.tahunAktif.tenggatPenyusunan, b, "panjang")}
              </strong>
            </span>
            {data.tenggat ? <LencanaTenggat nilai={data.tenggat} /> : null}
          </p>
        ) : null}
      </header>

      <AntrianKerja butir={data.antrian} />

      {data.kebijakan?.status === "DRAF" && bolehKelolaKebijakan ? (
        <Card className="panel border-l-2 border-l-warning bg-warning/8">
          <CardHeader>
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">
                  {k.dasbor.kebijakanDraf.judul}
                </CardTitle>
                <CardDescription className="mt-1">
                  {k.dasbor.kebijakanDraf.isi}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ButtonLink variant="outline" href="/kebijakan">
              {k.dasbor.kebijakanDraf.aksi}
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
            <CardTitle className="text-base">{k.dasbor.tanpaPeran.judul}</CardTitle>
            <CardDescription className="mt-1">{k.dasbor.tanpaPeran.isi}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
