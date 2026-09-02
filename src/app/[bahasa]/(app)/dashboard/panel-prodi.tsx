import { GitBranch, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BaganBatang, BaganGaris, BaganTumpuk, Cincin } from "@/components/bagan";
import { Bagian, Kosong, Panel } from "./bagian";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { AMBANG_PRODI, type DataProdi } from "@/lib/dasbor/muat";

/**
 * Panel Ketua Program Studi — doc 07 §3.2.
 *
 * Dua pertanyaan, dua bidang: "seberapa jauh prodi saya dari siap" dijawab
 * corong RPKPS, "apakah lulusan saya mencapai apa yang dijanjikan" dijawab
 * capaian CPL. Keduanya sengaja tidak digabung; yang satu tentang dokumen,
 * yang lain tentang hasil belajar.
 */
export async function PanelProdi({ data }: { data: DataProdi }) {
  const k = await kamus();
  const terbit = data.corong.find((s) => s.kunci === "TERBIT")?.jumlah ?? 0;

  return (
    <Bagian
      judul={isi(k.dasbor.prodi.judul, { nama: data.prodi.nama })}
      keterangan={
        data.kurikulum
          ? isi(k.dasbor.prodi.kurikulum, {
              nama: data.kurikulum.nama,
              tahun: data.kurikulum.tahun,
              jumlah: data.jumlahMk,
            })
          : k.dasbor.prodi.tanpaKurikulum
      }
      ikon={<Target className="size-4" />}
      aksi={{ href: "/evaluasi", label: k.dasbor.prodi.aksi }}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          judul={k.dasbor.prodi.corong.judul}
          keterangan={isi(k.dasbor.prodi.corong.keterangan, {
            terbit,
            total: data.jumlahMk,
          })}
        >
          <BaganTumpuk
            segmen={data.corong}
            sisa={{ label: k.dasbor.prodi.corong.sisa, jumlah: data.mkTanpaRpkps }}
            tanpaData={k.komponen.tanpaData}
          />

          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border/70 pt-4 text-center">
            <Angka
              label={k.dasbor.prodi.usulanMenunggu}
              nilai={data.usulanMenunggu}
              sorot={data.usulanMenunggu > 0}
            />
            <Angka
              label={k.dasbor.prodi.rpkpsMenunggu}
              nilai={data.rpkpsMenunggu}
              sorot={data.rpkpsMenunggu > 0}
            />
            <Angka
              label={k.dasbor.prodi.kelasBelumDitutup}
              nilai={data.kelasBelumDitutup}
              sorot={data.kelasBelumDitutup > 0}
            />
          </dl>
        </Panel>

        <Panel
          judul={k.dasbor.prodi.cakupan.judul}
          keterangan={k.dasbor.prodi.cakupan.keterangan}
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <Cincin
              nilai={data.cakupanPersen}
              label={k.dasbor.prodi.cakupan.label}
              keterangan={isi(k.dasbor.prodi.cakupan.terukur, {
                terukur: data.cplTerukur,
                total: data.cplDibebankan,
              })}
              nada={data.cakupanPersen >= 75 ? "sukses" : "peringatan"}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          judul={k.dasbor.prodi.cpl.judul}
          keterangan={k.dasbor.prodi.cpl.keterangan}
        >
          {data.cpl.length === 0 ? (
            <Kosong pesan={k.dasbor.prodi.cpl.kosong} />
          ) : (
            <BaganBatang
              ambang={AMBANG_PRODI}
              labelAmbang={k.dasbor.prodi.cpl.ambang}
              data={data.cpl.map((c) => ({
                label: c.kode,
                nilai: c.kelasTerukur === 0 ? null : c.persenLulus,
                keterangan: c.deskripsi,
                nada:
                  c.persenLulus === null
                    ? "netral"
                    : c.persenLulus >= AMBANG_PRODI
                      ? "sukses"
                      : "peringatan",
              }))}
            />
          )}
        </Panel>

        <Panel
          judul={k.dasbor.prodi.tren.judul}
          keterangan={k.dasbor.prodi.tren.keterangan}
        >
          {data.tren.length === 0 || data.trenLabel.length === 0 ? (
            <Kosong pesan={k.dasbor.prodi.tren.kosong} />
          ) : (
            <BaganGaris
              ambang={AMBANG_PRODI}
              label={data.trenLabel.map((t) => t.replace("-", " "))}
              deret={data.tren.map((t) => ({ nama: t.kode, titik: t.titik }))}
            />
          )}
        </Panel>
      </div>

      {data.sebaran.length > 0 ? (
        <Panel
          judul={k.dasbor.prodi.sebaran.judul}
          keterangan={k.dasbor.prodi.sebaran.keterangan}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{k.dasbor.prodi.sebaran.mk}</TableHead>
                <TableHead>{k.dasbor.prodi.sebaran.cpl}</TableHead>
                <TableHead>{k.dasbor.prodi.sebaran.tertinggi}</TableHead>
                <TableHead>{k.dasbor.prodi.sebaran.terendah}</TableHead>
                <TableHead className="text-right">{k.dasbor.prodi.sebaran.selisih}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sebaran.map((s, i) => (
                <TableRow key={`${s.mkKode}-${s.cplKode}-${i}`}>
                  <TableCell className="font-mono text-xs">{s.mkKode}</TableCell>
                  <TableCell className="font-mono text-xs">{s.cplKode}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {s.tertinggi.kelas} · {s.tertinggi.persenLulus}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {s.terendah.kelas} · {s.terendah.persenLulus}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    <span className="flex items-center justify-end gap-1.5">
                      <GitBranch className="size-3 text-warning-foreground" />
                      {s.selisih}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      ) : null}
    </Bagian>
  );
}

function Angka({
  label,
  nilai,
  sorot,
}: {
  label: string;
  nilai: number;
  sorot?: boolean;
}) {
  return (
    <div>
      <dt className="label-teknis text-muted-foreground/70">{label}</dt>
      <dd
        className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
          sorot ? "text-warning-foreground" : ""
        }`}
      >
        {nilai}
      </dd>
    </div>
  );
}
