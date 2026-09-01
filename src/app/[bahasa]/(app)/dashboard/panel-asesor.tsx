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
import { kamus } from "@/lib/bahasa/server";
import type { DataAsesor } from "@/lib/dasbor/muat";

/**
 * Panel asesor — doc 07 §3.6.
 *
 * Hanya angka yang dapat dipertanggungjawabkan: dokumen yang sudah terbit
 * beserta salinan bekunya yang bersidik. Draf tidak ditampilkan sama sekali —
 * bukan karena disembunyikan, melainkan karena draf bukan bukti apa pun.
 */
export async function PanelAsesor({ data }: { data: DataAsesor }) {
  const k = await kamus();

  return (
    <Bagian
      judul={k.dasbor.asesor.judul}
      keterangan={k.dasbor.asesor.keterangan}
      ikon={<FileCheck2 className="size-4" />}
      aksi={{ href: "/katalog", label: k.dasbor.asesor.aksi }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka
          judul={k.dasbor.asesor.rpkpsTerbit}
          angka={data.rpkpsTerbit}
          keterangan={k.dasbor.asesor.rpkpsTerbitKeterangan}
        />
        <KartuAngka
          judul={k.dasbor.asesor.snapshotRpkps}
          angka={data.snapshotRpkps}
          keterangan={k.dasbor.asesor.snapshotRpkpsKeterangan}
        />
        <KartuAngka
          judul={k.dasbor.asesor.evaluasiDitutup}
          angka={data.evaluasiDitutup}
          keterangan={k.dasbor.asesor.evaluasiDitutupKeterangan}
        />
        <KartuAngka
          judul={k.dasbor.asesor.snapshotEvaluasi}
          angka={data.snapshotEvaluasi}
          keterangan={k.dasbor.asesor.snapshotEvaluasiKeterangan}
        />
      </div>

      <Panel
        judul={k.dasbor.asesor.perProdi.judul}
        keterangan={k.dasbor.asesor.perProdi.keterangan}
      >
        {data.prodi.length === 0 ? (
          <Kosong pesan={k.dasbor.asesor.perProdi.kosong} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{k.dasbor.asesor.perProdi.prodi}</TableHead>
                <TableHead className="text-right">{k.dasbor.asesor.perProdi.terbit}</TableHead>
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
