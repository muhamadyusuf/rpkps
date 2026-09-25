import { CalendarRange, CircleAlert, Inbox, Timer } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { punyaPeran, wajibAktif } from "@/lib/otorisasi";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { tanggal } from "@/lib/bahasa/format";
import { isi } from "@/lib/bahasa/teks";
import { muatDasbor } from "@/lib/dasbor/muat";
import { LencanaTenggat } from "@/components/lencana-tenggat";
import { teksTenggat } from "@/lib/bahasa/tenggat";
import { AntrianKerja } from "./antrian";
import { Bagian, KartuAngka } from "./bagian";
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
  // Saling bebas: kamus dan bahasa tidak menunggu data dasbor.
  const [data, k, b] = await Promise.all([muatDasbor(sesi), kamus(), bahasaAktif()]);

  const bolehKelolaKebijakan = punyaPeran(sesi, "ADMIN", "GPM");
  const tanpaPanel =
    data.prodi.length === 0 &&
    !data.mutu &&
    !data.dosen &&
    !data.admin &&
    !data.asesor &&
    !data.mahasiswa;

  /*
   * Nomor bagian mengikuti urutan yang BENAR-BENAR tampil — panel bergantung
   * pada peran, jadi nomornya dihitung, bukan ditulis tangan.
   */
  let urut = 0;
  const nomor = () => String(++urut).padStart(2, "0");

  const jumlahAntrian = data.antrian.length;
  const antrianGenting = data.antrian.some((x) => x.kegentingan === "TINGGI");
  const tenggatMendesak =
    data.tenggat?.tingkat === "DEKAT" || data.tenggat?.tingkat === "LEWAT";

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Kepala halaman gaya `KepalaHalaman` identitas-itts (docs/28 §5). */}
      <header className="anim-muncul flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-balance sm:text-2xl">
            {isi(k.dasbor.salam, { nama: sesi.nama.split(" ")[0] ?? sesi.nama })}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-pretty text-muted-foreground">
            {sesi.daftarPeran.length > 0
              ? sesi.daftarPeran.map((p) => k.enum.peran[p]).join(", ")
              : k.kerangka.tanpaPeran}
          </p>
        </div>
        {data.tahunAktif?.tenggatPenyusunan && data.tenggat ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{k.dasbor.tenggatRpkps}</span>
            <LencanaTenggat nilai={data.tenggat} />
          </div>
        ) : null}
      </header>

      {/* Kartu statistik — hanya dari data yang SUDAH dimuat `muatDasbor`. */}
      <div className="anim-muncul grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KartuAngka
          judul={k.dasbor.statAntrian}
          angka={jumlahAntrian}
          keterangan={
            jumlahAntrian > 0
              ? isi(k.dasbor.statAntrianRincian, { n: jumlahAntrian })
              : k.dasbor.statAntrianKosong
          }
          sorot={antrianGenting}
          ikon={<Inbox />}
        />
        <KartuAngka
          judul={k.dasbor.statTenggat}
          angka={
            data.tahunAktif?.tenggatPenyusunan
              ? tanggal(data.tahunAktif.tenggatPenyusunan, b, "pendek")
              : "—"
          }
          keterangan={
            data.tenggat
              ? teksTenggat(data.tenggat, k, b)
              : k.dasbor.statTenggatKosong
          }
          sorot={tenggatMendesak}
          ikon={<Timer />}
        />
        <KartuAngka
          judul={k.dasbor.statTahun}
          angka={data.tahunAktif ? data.tahunAktif.kode.replace("-", " ") : "—"}
          keterangan={
            data.tahunAktif
              ? isi(k.dasbor.taAktif, { kode: data.tahunAktif.kode.replace("-", " ") })
              : k.dasbor.statTahunKosong
          }
          ikon={<CalendarRange />}
        />
      </div>

      {data.kebijakan?.status === "DRAF" && bolehKelolaKebijakan ? (
        <Card className="border-warning/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/12 text-warning-foreground">
                <CircleAlert className="size-4" />
              </span>
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

      <Bagian judul={k.dasbor.judulAntrian} nomor={nomor()}>
        <AntrianKerja butir={data.antrian} />
      </Bagian>

      {data.prodi.map((p) => (
        <PanelProdi key={p.prodi.id} data={p} nomor={nomor()} />
      ))}

      {data.mutu ? <PanelMutu data={data.mutu} nomor={nomor()} /> : null}
      {data.dosen ? <PanelDosen data={data.dosen} nomor={nomor()} /> : null}
      {data.admin ? <PanelAdmin data={data.admin} nomor={nomor()} /> : null}
      {data.asesor ? <PanelAsesor data={data.asesor} nomor={nomor()} /> : null}
      {data.mahasiswa ? <PanelMahasiswa data={data.mahasiswa} nomor={nomor()} /> : null}

      {tanpaPanel ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.dasbor.tanpaPeran.judul}</CardTitle>
            <CardDescription className="mt-1">{k.dasbor.tanpaPeran.isi}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
