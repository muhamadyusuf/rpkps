import { FileCheck2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bagian, KartuAngka, Kosong, Panel } from "./bagian";
import type { DataAsesor } from "@/lib/dasbor/muat";

/**
 * Panel asesor — doc 07 §3.6.
 *
 * Hanya angka yang dapat dipertanggungjawabkan: dokumen yang sudah terbit
 * beserta salinan bekunya yang bersidik. Draf tidak ditampilkan sama sekali —
 * bukan karena disembunyikan, melainkan karena draf bukan bukti apa pun.
 */
export function PanelAsesor({ data }: { data: DataAsesor }) {
  return (
    <Bagian
      judul="Berkas untuk Audit"
      keterangan="Dokumen yang sudah disahkan beserta salinan bekunya."
      ikon={<FileCheck2 className="size-4" />}
      aksi={{ href: "/katalog", label: "Katalog publik" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka judul="RPKPS terbit" angka={data.rpkpsTerbit} keterangan="dokumen sah" />
        <KartuAngka
          judul="Snapshot RPKPS"
          angka={data.snapshotRpkps}
          keterangan="salinan beku bersidik SHA-256"
        />
        <KartuAngka
          judul="Evaluasi ditutup"
          angka={data.evaluasiDitutup}
          keterangan="capaian yang sudah dibekukan"
        />
        <KartuAngka
          judul="Snapshot evaluasi"
          angka={data.snapshotEvaluasi}
          keterangan="ruang sidik terpisah dari RPKPS"
        />
      </div>

      <Panel
        judul="Dokumen terbit per program studi"
        keterangan="Isi dokumen publik selalu dibaca dari salinan beku, bukan dari baris berjalan."
      >
        {data.prodi.length === 0 ? (
          <Kosong pesan="Belum ada program studi dalam cakupan Anda." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program studi</TableHead>
                <TableHead className="text-right">RPKPS terbit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.prodi.map((p) => (
                <TableRow key={p.kode}>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{p.kode}</span>{" "}
                    {p.nama}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {p.terbit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Bagian>
  );
}
