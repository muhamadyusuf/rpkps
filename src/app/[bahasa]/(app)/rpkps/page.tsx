import { Tautan } from "@/components/tautan";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { cakupanProdi, wajibAktif } from "@/lib/otorisasi";
import { saringDaftarRpkps } from "@/lib/rpkps/wenang";
import { nilaiTenggatDokumen } from "@/domain/rpkps/tenggat";
import { capRonde } from "@/domain/rpkps/paraf";
import { LencanaTenggat } from "@/components/lencana-tenggat";
import { TombolBuatRpkps } from "./tombol";
import { SaringanUnit } from "@/components/saringan-unit";
import { PetaSemester } from "@/components/peta-semester";
import { bacaTampilan, PengalihTampilan } from "@/components/pengalih-tampilan";
import { bacaSaringanUnit, kopUnit, muatUnit, prodiTersaring, prodiTunggal } from "@/lib/unit";
import { Paginasi } from "@/components/paginasi";
import { bacaHalaman, bacaKata, hitungHalaman, UKURAN_HALAMAN } from "@/lib/paginasi";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).rpkps.metaJudul };
}

/** Arsip ditampilkan sekilas, tidak dihalamankan: ia bukan daftar kerja. */
const ARSIP_TAMPIL = 10;

/**
 * Rupa lencana status. Diangkat ke konstanta saat peta semester menjadi
 * tampilan kedua: dua rangkaian ternary yang harus selalu sama adalah dua
 * tempat yang akan berbeda pada perubahan berikutnya.
 */
const WARNA_STATUS = {
  DRAF: "outline",
  DIAJUKAN: "outline",
  DIREVISI: "destructive",
  DISETUJUI: "outline",
  TERBIT: "default",
  ARSIP: "outline",
} as const;

export default async function HalamanRpkps({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesi = await wajibAktif();
  const cakupan = cakupanProdi(sesi);

  const mentah = await searchParams;
  const kata = bacaKata(mentah.q);
  const tampilan = bacaTampilan(mentah.tampilan);

  /*
   * Saringan unit penyelenggara, sama seperti daftar kurikulum. Prodi yang
   * dipilih MEMPERSEMPIT, tidak memperluas: `prodiTersaring` hanya mengenal id
   * dari daftar yang sudah dibatasi cakupan pengguna, dan penyaringnya dipasang
   * sebagai syarat AND di samping `saringDaftarRpkps` — termasuk di atas cabang
   * kepengampuan lintas prodi, karena memilih sebuah prodi berarti meminta
   * prodi itu saja.
   */
  const saringan = bacaSaringanUnit(mentah);
  const unit = await muatUnit(cakupan);
  const terpilih = prodiTersaring(unit, saringan);
  const batasProdi = terpilih ?? cakupan;
  const filterProdi = batasProdi === null ? {} : { prodiId: { in: batasProdi } };
  const saringanUnit =
    terpilih === null ? {} : { mataKuliah: { kurikulum: { prodiId: { in: terpilih } } } };

  // Kop lembar peta, sama seperti halaman kurikulum. Ada hanya bila daftarnya
  // memang tentang satu prodi — lihat `kopUnit`.
  const kop = kopUnit(unit, prodiTunggal(terpilih, cakupan));

  /**
   * Penyaringnya bukan cakupan prodi semata: dosen yang ditunjuk sebagai
   * pengampu lintas prodi harus melihat RPKPS-nya di sini, bukan hanya lewat
   * tautan langsung. Lihat docs/06 §3.4.
   */
  const dasar = saringDaftarRpkps(sesi);
  const pencarian = kata
    ? {
        mataKuliah: {
          OR: [
            { kode: { contains: kata, mode: "insensitive" as const } },
            { nama: { contains: kata, mode: "insensitive" as const } },
          ],
        },
      }
    : {};
  const saringAktif = {
    AND: [dasar, pencarian, saringanUnit, { status: { not: "ARSIP" as const } }],
  };
  const saringArsip = {
    AND: [dasar, pencarian, saringanUnit, { status: "ARSIP" as const }],
  };

  const isiBaris = {
    mataKuliah: {
      select: {
        kode: true,
        nama: true,
        semester: true,
        sksTeori: true,
        sksPraktik: true,
      },
    },
    tahunAkademik: {
      select: {
        kode: true,
        tenggatPenyusunan: true,
        tenggatReview: true,
        tenggatPengesahan: true,
        jaminanHariPutusan: true,
      },
    },
    pengampu: { select: { penggunaId: true, peran: true } },
    /**
     * Hanya dua cap yang menentukan kapan dokumen sampai ke pemutus — dan
     * hanya itu yang dimuat. Disaring di basis data, bukan di memori: daftar
     * ini bercakupan institusi bagi ADMIN dan GPM.
     */
    tandaTangan: {
      where: { peran: { in: ["KOORDINATOR" as const, "KAPRODI" as const] } },
      select: { versi: true, peran: true, ditandatanganiPada: true },
    },
    _count: { select: { pertemuan: true } },
  };

  // Jumlah dihitung lebih dulu supaya nomor halaman dapat dijepit sebelum
  // menjadi `skip`: halaman 999 pada daftar 30 baris harus mendarat di halaman
  // terakhir, bukan mengembalikan tabel kosong.
  const [tahunAktif, jumlahAktif, jumlahArsip] = await Promise.all([
    prisma.tahunAkademik.findFirst({ where: { aktif: true } }),
    prisma.rpkps.count({ where: saringAktif }),
    prisma.rpkps.count({ where: saringArsip }),
  ]);

  const halaman = hitungHalaman(jumlahAktif, bacaHalaman(mentah.hal), UKURAN_HALAMAN);

  /*
   * Urutannya mengikuti tampilan, dan itu disengaja. Peta dibaca sebagai
   * struktur kurikulum: semester lalu kode, persis lembar cetaknya — diurutkan
   * "terakhir disunting", satu halaman peta berisi potongan sewenang-wenang
   * dari delapan semester sekaligus. Tabel rinci tetap antrian kerja, dan
   * antrian kerja diurutkan menurut yang paling baru bergerak.
   */
  const urutan =
    tampilan === "peta"
      ? [
          { mataKuliah: { semester: "asc" as const } },
          { mataKuliah: { kode: "asc" as const } },
        ]
      : [{ diubahPada: "desc" as const }];

  const [aktif, arsip, belum] = await Promise.all([
    prisma.rpkps.findMany({
      where: saringAktif,
      orderBy: urutan,
      skip: halaman.lewati,
      take: halaman.ambil,
      include: isiBaris,
    }),
    // Arsip dipisah, tidak disembunyikan: dokumen yang ditarik tetap harus
    // dapat ditemukan kembali — di situlah tombol "Kembalikan dari arsip".
    prisma.rpkps.findMany({
      where: saringArsip,
      orderBy: [{ diubahPada: "desc" }],
      take: ARSIP_TAMPIL,
      include: isiBaris,
    }),
    tahunAktif
      ? prisma.mataKuliah.findMany({
          where: {
            kurikulum: { status: "BERLAKU", ...filterProdi },
            cpmk: { some: {} },
            // Disaring di database, bukan di memori: sebelumnya seluruh mata
            // kuliah berkurikulum berlaku dimuat hanya untuk membuang yang
            // sudah punya RPKPS tahun ini.
            rpkps: { none: { tahunAkademikId: tahunAktif.id } },
            ...(kata
              ? {
                  OR: [
                    { kode: { contains: kata, mode: "insensitive" as const } },
                    { nama: { contains: kata, mode: "insensitive" as const } },
                  ],
                }
              : {}),
          },
          orderBy: [{ semester: "asc" }, { kode: "asc" }],
          take: UKURAN_HALAMAN,
          select: { id: true, kode: true, nama: true, semester: true },
        })
      : [],
  ]);

  const sekarang = new Date();
  const k = await kamus();

  /**
   * Tenggat sebuah baris. Dipakai kedua tampilan, jadi dihitung satu kali di
   * sini alih-alih disalin ke dalam masing-masing JSX.
   */
  const tenggat = (r: (typeof aktif)[number]) =>
    nilaiTenggatDokumen({
      status: r.status,
      tenggat: {
        penyusunan: r.tahunAkademik.tenggatPenyusunan,
        review: r.tahunAkademik.tenggatReview,
        pengesahan: r.tahunAkademik.tenggatPengesahan,
      },
      diajukanPada:
        capRonde(r.tandaTangan, r.versi, "KOORDINATOR")?.ditandatanganiPada ?? null,
      disetujuiPada:
        capRonde(r.tandaTangan, r.versi, "KAPRODI")?.ditandatanganiPada ?? null,
      jaminanHari: r.tahunAkademik.jaminanHariPutusan,
      sekarang,
    });

  const peranSaya = (r: (typeof aktif)[number]) =>
    r.pengampu.find((p) => p.penggunaId === sesi.id)?.peran ?? null;

  // Saringan ikut ke setiap tautan halaman dan ke pengalih tampilan; tanpa itu
  // berpindah halaman diam-diam membuang prodi yang baru saja dipilih.
  const paramDaftar = {
    q: kata,
    fakultas: saringan.fakultas,
    prodi: saringan.prodi,
  };
  const paramHalaman = {
    ...paramDaftar,
    tampilan: tampilan === "tabel" ? "tabel" : undefined,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.rpkps.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{k.rpkps.judul}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tahunAktif
            ? isi(k.rpkps.taAktif, { kode: tahunAktif.kode.replace("-", " ") })
            : k.rpkps.taKosong}
        </p>
        <SaringanUnit
          action="/rpkps"
          unit={unit}
          nilai={{ ...saringan, q: kata }}
          denganCari
          placeholderCari={k.rpkps.cariPlaceholder}
          className="mt-4"
        />
      </header>

      {aktif.length === 0 && arsip.length === 0 && belum.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">
                  {kata
                    ? isi(k.rpkps.tidakCocokJudul, { kata })
                    : k.rpkps.kosongJudul}
                </CardTitle>
                <CardDescription className="mt-1">
                  {kata ? k.rpkps.tidakCocokIsi : k.rpkps.kosongIsi}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {aktif.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {isi(k.rpkps.daftarJudul, { jumlah: jumlahAktif })}
                </CardTitle>
                <CardDescription className="mt-1">
                  {k.rpkps.daftarKeterangan}
                </CardDescription>
              </div>
              <PengalihTampilan
                basis="/rpkps"
                params={paramDaftar}
                tampilan={tampilan}
              />
            </div>
          </CardHeader>
          <CardContent>
            {tampilan === "peta" ? (
              <PetaSemester
                kop={
                  kop
                    ? {
                        judul: isi(k.rpkps.kopJudul, { prodi: kop.prodi }),
                        baris: [kop.fakultas, kop.institusi],
                      }
                    : undefined
                }
                kosong={k.rpkps.kosongIsi}
                baris={aktif.map((r) => {
                  const peran = peranSaya(r);
                  return {
                    id: r.id,
                    kode: r.mataKuliah.kode,
                    nama: r.mataKuliah.nama,
                    semester: r.mataKuliah.semester,
                    sksTeori: r.mataKuliah.sksTeori,
                    sksPraktik: r.mataKuliah.sksPraktik,
                    href: `/rpkps/${r.id}`,
                    lencana: (
                      <>
                        <Badge
                          variant={WARNA_STATUS[r.status]}
                          className="text-[10px]"
                        >
                          {k.enum.statusRpkps[r.status]}
                        </Badge>
                        {peran ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {peran === "KOORDINATOR"
                              ? k.rpkps.koordinator
                              : k.rpkps.pengampu}
                          </Badge>
                        ) : null}
                        <LencanaTenggat nilai={tenggat(r)} />
                      </>
                    ),
                  };
                })}
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{k.rpkps.kolomMk}</TableHead>
                      <TableHead>{k.rpkps.kolomTa}</TableHead>
                      <TableHead className="text-center">{k.rpkps.kolomPertemuan}</TableHead>
                      <TableHead className="text-center">{k.rpkps.kolomPeran}</TableHead>
                      <TableHead className="text-right">{k.rpkps.kolomStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aktif.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Tautan
                            href={`/rpkps/${r.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {r.mataKuliah.kode} — {r.mataKuliah.nama}
                          </Tautan>
                          <p className="text-xs text-muted-foreground">
                            {isi(k.rpkps.sksRingkas, {
                              total: r.mataKuliah.sksTeori + r.mataKuliah.sksPraktik,
                              teori: r.mataKuliah.sksTeori,
                              praktik: r.mataKuliah.sksPraktik,
                              versi: r.versi,
                            })}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.tahunAkademik.kode.replace("-", " ")}
                          <LencanaTenggat className="mt-1 flex w-fit" nilai={tenggat(r)} />
                        </TableCell>
                        <TableCell className="text-center text-sm tabular-nums">
                          {r._count.pertemuan}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const peran = peranSaya(r);
                            if (!peran) {
                              return <span className="text-xs text-muted-foreground">—</span>;
                            }
                            return (
                              <Badge variant="secondary" className="text-[10px]">
                                {peran === "KOORDINATOR"
                                  ? k.rpkps.koordinator
                                  : k.rpkps.pengampu}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={WARNA_STATUS[r.status]}>
                            {k.enum.statusRpkps[r.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <Paginasi
              className="mt-4"
              halaman={halaman}
              basis="/rpkps"
              params={paramHalaman}
              satuan="rpkps"
            />
          </CardContent>
        </Card>
      ) : null}

      {arsip.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isi(k.rpkps.arsipJudul, { jumlah: jumlahArsip })}
            </CardTitle>
            <CardDescription>
              {k.rpkps.arsipKeterangan}
              {jumlahArsip > arsip.length
                ? isi(k.rpkps.arsipSebagian, {
                    tampil: arsip.length,
                    total: jumlahArsip,
                  })
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {arsip.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <Tautan
                      href={`/rpkps/${r.id}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {r.mataKuliah.kode} — {r.mataKuliah.nama}
                    </Tautan>
                    <p className="text-xs text-muted-foreground">
                      {isi(k.rpkps.arsipBaris, {
                        ta: r.tahunAkademik.kode.replace("-", " "),
                        versi: r.versi,
                      })}
                    </p>
                  </div>
                  <Badge variant="outline">{k.enum.statusRpkps.ARSIP}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {tahunAktif && belum.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {k.rpkps.belumJudul}
              {belum.length < UKURAN_HALAMAN ? ` (${belum.length})` : ""}
            </CardTitle>
            <CardDescription>{k.rpkps.belumKeterangan}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {belum.map((mk) => (
                <div
                  key={mk.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {mk.kode} — {mk.nama}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isi(k.rpkps.semester, { nomor: mk.semester })}
                    </p>
                  </div>
                  <TombolBuatRpkps mataKuliahId={mk.id} tahunAkademikId={tahunAktif.id} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
