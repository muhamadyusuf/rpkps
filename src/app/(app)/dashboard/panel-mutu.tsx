import Link from "next/link";
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
import type { DataMutu } from "@/lib/dasbor/muat";

/**
 * Panel Penjaminan Mutu — doc 07 §3.3.
 *
 * Pertanyaannya bukan "apa yang kurang di prodi saya" melainkan "siapa yang
 * tertinggal". Karena itu bentuk utamanya perbandingan antar prodi, bukan
 * rincian satu prodi: kisi panas menjawabnya dalam sekali pandang, tanpa
 * memaksa membaca dua belas angka satu per satu.
 */
export function PanelMutu({ data }: { data: DataMutu }) {
  const totalTemuan =
    data.temuan.belum + data.temuan.tercapai + data.temuan.tidakTercapai;

  return (
    <Bagian
      judul="Penjaminan Mutu"
      keterangan="Lintas prodi. Hanya evaluasi berstatus ditutup yang dihitung."
      ikon={<ShieldCheck className="size-4" />}
      aksi={{ href: "/evaluasi", label: "Evaluasi capaian" }}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          judul="Cakupan evaluasi institusi"
          keterangan={`${data.mkDievaluasi} dari ${data.mkSeluruh} mata kuliah berlaku.`}
        >
          <div className="flex justify-center py-2">
            <Cincin
              nilai={data.cakupanInstitusi}
              label="cakupan"
              keterangan="ambang panduan mutu: 75%"
              nada={data.cakupanInstitusi >= 75 ? "sukses" : "peringatan"}
            />
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          judul="Perbandingan antar prodi"
          keterangan="Kolom dalam persen: RPKPS terbit, cakupan evaluasi, CPL tercapai."
        >
          {data.baris.length === 0 ? (
            <Kosong pesan="Belum ada program studi dalam cakupan Anda." />
          ) : (
            <KisiPanas
              ambang={75}
              kolom={["RPKPS terbit", "Cakupan evaluasi", "CPL tercapai"]}
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
          judul="Tindak lanjut (PPEPP)"
          keterangan="Temuan tanpa verifikasi memutus siklus."
        >
          {totalTemuan === 0 ? (
            <Kosong pesan="Belum ada temuan evaluasi." />
          ) : (
            <dl className="space-y-3">
              <BarisTemuan
                label="Belum diverifikasi"
                jumlah={data.temuan.belum}
                total={totalTemuan}
                nada="var(--warning)"
              />
              <BarisTemuan
                label="Tercapai"
                jumlah={data.temuan.tercapai}
                total={totalTemuan}
                nada="var(--success)"
              />
              <BarisTemuan
                label="Tidak tercapai"
                jumlah={data.temuan.tidakTercapai}
                total={totalTemuan}
                nada="var(--destructive)"
              />
            </dl>
          )}
        </Panel>

        <Panel
          className="lg:col-span-2"
          judul="Temuan yang belum diverifikasi"
          keterangan="Rencana tindak lanjut yang belum diperiksa hasilnya pada semester berikutnya."
        >
          {data.temuanTerbuka.length === 0 ? (
            <Kosong pesan="Tidak ada temuan terbuka." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Butir</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Tindakan</TableHead>
                    <TableHead>Penanggung jawab</TableHead>
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
        Angka pada kisi panas adalah ringkasan. Rincian per CPL, tren, dan tabel
        LKPS/LED ada di{" "}
        <Link href="/evaluasi" className="underline underline-offset-4">
          Evaluasi Capaian
        </Link>
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
