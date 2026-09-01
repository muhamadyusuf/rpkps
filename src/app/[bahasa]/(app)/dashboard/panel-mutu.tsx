import { Tautan } from "@/components/tautan";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Cincin, KisiPanas } from "@/components/bagan";
import { persen } from "@/domain/dasbor/ringkasan";
import { Bagian, Kosong, Panel } from "./bagian";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { DataMutu } from "@/lib/dasbor/muat";

/**
 * Panel Penjaminan Mutu — doc 07 §3.3.
 *
 * Pertanyaannya bukan "apa yang kurang di prodi saya" melainkan "siapa yang
 * tertinggal". Karena itu bentuk utamanya perbandingan antar prodi, bukan
 * rincian satu prodi: kisi panas menjawabnya dalam sekali pandang, tanpa
 * memaksa membaca dua belas angka satu per satu.
 */
export async function PanelMutu({ data }: { data: DataMutu }) {
  const k = await kamus();
  const totalTemuan =
    data.temuan.belum + data.temuan.tercapai + data.temuan.tidakTercapai;

  return (
    <Bagian
      judul={k.dasbor.mutu.judul}
      keterangan={k.dasbor.mutu.keterangan}
      ikon={<ShieldCheck className="size-4" />}
      aksi={{ href: "/evaluasi", label: k.dasbor.mutu.aksi }}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          judul={k.dasbor.mutu.cakupan.judul}
          keterangan={isi(k.dasbor.mutu.cakupan.keterangan, {
            dievaluasi: data.mkDievaluasi,
            seluruh: data.mkSeluruh,
          })}
        >
          <div className="flex justify-center py-2">
            <Cincin
              nilai={data.cakupanInstitusi}
              label={k.dasbor.mutu.cakupan.label}
              keterangan={k.dasbor.mutu.cakupan.ambang}
              nada={data.cakupanInstitusi >= 75 ? "sukses" : "peringatan"}
            />
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          judul={k.dasbor.mutu.banding.judul}
          keterangan={k.dasbor.mutu.banding.keterangan}
        >
          {data.baris.length === 0 ? (
            <Kosong pesan={k.dasbor.mutu.banding.kosong} />
          ) : (
            <KisiPanas
              ambang={75}
              kolom={[
                k.dasbor.mutu.banding.kolomRpkps,
                k.dasbor.mutu.banding.kolomCakupan,
                k.dasbor.mutu.banding.kolomCpl,
              ]}
              baris={data.baris.map((b) => ({
                label: b.prodi.kode,
                keterangan: b.prodi.nama,
                sel: [
                  b.rpkpsTotal === 0 ? null : persen(b.rpkpsTerbit, b.rpkpsTotal, 0),
                  Math.round(b.cakupanEvaluasi),
                  b.cplDibebankan === 0
                    ? null
                    : persen(b.cplTercapai, b.cplDibebankan, 0),
                ],
              }))}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          judul={k.dasbor.mutu.temuan.judul}
          keterangan={k.dasbor.mutu.temuan.keterangan}
        >
          {totalTemuan === 0 ? (
            <Kosong pesan={k.dasbor.mutu.temuan.kosong} />
          ) : (
            <dl className="space-y-3">
              <BarisTemuan
                label={k.dasbor.mutu.temuan.belum}
                jumlah={data.temuan.belum}
                total={totalTemuan}
                nada="var(--warning)"
              />
              <BarisTemuan
                label={k.dasbor.mutu.temuan.tercapai}
                jumlah={data.temuan.tercapai}
                total={totalTemuan}
                nada="var(--success)"
              />
              <BarisTemuan
                label={k.dasbor.mutu.temuan.tidakTercapai}
                jumlah={data.temuan.tidakTercapai}
                total={totalTemuan}
                nada="var(--destructive)"
              />
            </dl>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          judul={k.dasbor.mutu.terbuka.judul}
          keterangan={k.dasbor.mutu.terbuka.keterangan}
        >
          {data.temuanTerbuka.length === 0 ? (
            <Kosong pesan={k.dasbor.mutu.terbuka.kosong} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{k.dasbor.mutu.terbuka.butir}</TableHead>
                    <TableHead>{k.dasbor.mutu.terbuka.kelas}</TableHead>
                    <TableHead>{k.dasbor.mutu.terbuka.tindakan}</TableHead>
                    <TableHead>{k.dasbor.mutu.terbuka.penanggungJawab}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.temuanTerbuka.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span className="font-mono text-xs">{t.kode}</span>
                        <Badge variant="secondary" className="ml-1.5 text-[10px]">
                          {t.tingkat.replace("_", "-")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {t.mk} · {t.kelas}
                      </TableCell>
                      <TableCell className="max-w-sm truncate text-xs" title={t.tindakan}>
                        {t.tindakan}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.penanggungJawab ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>

      <p className="text-xs text-muted-foreground">
        {k.dasbor.mutu.catatanKaki}{" "}
        <Tautan href="/evaluasi" className="underline underline-offset-4">
          {k.dasbor.mutu.catatanTautan}
        </Tautan>
        .
      </p>
    </Bagian>
  );
}

function BarisTemuan({
  label,
  jumlah,
  total,
  nada,
}: {
  label: string;
  jumlah: number;
  total: number;
  nada: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="font-mono tabular-nums">{jumlah}</dd>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${persen(jumlah, total)}%`,
            backgroundColor: nada,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}
