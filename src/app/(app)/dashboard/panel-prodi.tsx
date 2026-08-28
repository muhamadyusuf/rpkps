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
import { AMBANG_PRODI, type DataProdi } from "@/lib/dasbor/muat";

/**
 * Panel Ketua Program Studi — doc 07 §3.2.
 *
 * Dua pertanyaan, dua bidang: "seberapa jauh prodi saya dari siap" dijawab
 * corong RPKPS, "apakah lulusan saya mencapai apa yang dijanjikan" dijawab
 * capaian CPL. Keduanya sengaja tidak digabung; yang satu tentang dokumen,
 * yang lain tentang hasil belajar.
 */
export function PanelProdi({ data }: { data: DataProdi }) {
  const terbit = data.corong.find((s) => s.kunci === "TERBIT")?.jumlah ?? 0;

  return (
    <Bagian
      judul={`Program Studi ${data.prodi.nama}`}
      keterangan={
        data.kurikulum
          ? `Kurikulum ${data.kurikulum.nama} (${data.kurikulum.tahun}) · ${data.jumlahMk} mata kuliah berlaku`
          : "Belum ada kurikulum berlaku di prodi ini."
      }
      ikon={<Target className="size-4" />}
      aksi={{ href: "/evaluasi", label: "Evaluasi capaian" }}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          judul="Corong RPKPS tahun akademik aktif"
          keterangan={`${terbit} dari ${data.jumlahMk} mata kuliah sudah punya RPKPS terbit.`}
        >
          <BaganTumpuk
            segmen={data.corong}
            sisa={{ label: "Belum ada RPKPS", jumlah: data.mkTanpaRpkps }}
          />

          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border/70 pt-4 text-center">
            <Angka
              label="Usulan menunggu"
              nilai={data.usulanMenunggu}
              sorot={data.usulanMenunggu > 0}
            />
            <Angka
              label="RPKPS menunggu"
              nilai={data.rpkpsMenunggu}
              sorot={data.rpkpsMenunggu > 0}
            />
            <Angka
              label="Kelas belum ditutup"
              nilai={data.kelasBelumDitutup}
              sorot={data.kelasBelumDitutup > 0}
            />
          </dl>
        </Panel>

        <Panel
          judul="Cakupan evaluasi"
          keterangan="Mata kuliah yang evaluasinya sudah ditutup."
        >
          <div className="flex flex-col items-center gap-4 py-2">
            <Cincin
              nilai={data.cakupanPersen}
              label="cakupan MK"
              keterangan={`${data.cplTerukur} dari ${data.cplDibebankan} CPL pernah terukur`}
              nada={data.cakupanPersen >= 75 ? "sukses" : "peringatan"}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          judul="Capaian CPL prodi"
          keterangan="Persen mahasiswa lulus, tertimbang sks. Batang bergaris = belum pernah terukur."
        >
          {data.cpl.length === 0 ? (
            <Kosong pesan="Kurikulum prodi ini belum memuat CPL." />
          ) : (
            <BaganBatang
              ambang={AMBANG_PRODI}
              labelAmbang="ambang ketercapaian"
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
          judul="Tren antar tahun akademik"
          keterangan="Garis putus berarti CPL itu tidak terukur pada tahun tersebut — bukan nol."
        >
          {data.tren.length === 0 || data.trenLabel.length === 0 ? (
            <Kosong pesan="Belum ada evaluasi tertutup yang dapat dibandingkan antar tahun." />
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
          judul="Sebaran antar kelas paralel"
          keterangan="Rencana yang sama dengan hasil jauh berbeda menunjuk pelaksanaan, bukan rancangan."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata kuliah</TableHead>
                <TableHead>CPL</TableHead>
                <TableHead>Tertinggi</TableHead>
                <TableHead>Terendah</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
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
