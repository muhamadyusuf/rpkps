import Link from "next/link";
import { BookOpen, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WARNA_NADA } from "@/components/bagan";
import { Bagian, Kosong, Panel } from "./bagian";
import type { DataDosen } from "@/lib/dasbor/muat";

const LABEL_STATUS: Record<string, string> = {
  DRAF: "Draf",
  DIAJUKAN: "Diajukan",
  DIREVISI: "Perlu revisi",
  DISETUJUI: "Disetujui",
  TERBIT: "Terbit",
  ARSIP: "Arsip",
};

/**
 * Panel dosen dan koordinator mata kuliah — doc 07 §3.4.
 *
 * Kelas diurutkan menurut tahap, bukan menurut kode: yang paling perlu
 * ditengok berada di atas. Tahapnya dihitung dari kelengkapan nilai terhadap
 * peta asesmen, bukan dari tanggal — kalender tidak tahu apa-apa tentang
 * apakah nilai sudah masuk.
 */
export function PanelDosen({ data }: { data: DataDosen }) {
  return (
    <Bagian
      judul="Pekerjaan Anda"
      keterangan="Mata kuliah yang Anda ampu, kelas yang Anda pegang, dan tindak lanjut yang Anda tanggung."
      ikon={<BookOpen className="size-4" />}
      aksi={{ href: "/rpkps", label: "Semua RPKPS" }}
    >
      <Panel
        judul="RPKPS yang Anda ampu"
        keterangan="Batang kemajuan bersifat indikatif; yang menentukan kelayakan terbit tetap validator pada halaman RPKPS."
      >
        {data.rpkps.length === 0 ? (
          <Kosong pesan="Anda belum terdaftar sebagai pengampu RPKPS mana pun." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mata kuliah</TableHead>
                  <TableHead className="w-48">Kelengkapan</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rpkps.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/rpkps/${r.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {r.kode} — {r.nama}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {r.tahunAkademik.replace("-", " ")}
                        {r.koordinator ? " · koordinator" : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-[width] duration-500 ease-presisi"
                            style={{
                              width: `${r.kelengkapan.persen}%`,
                              backgroundColor:
                                r.kelengkapan.persen === 100
                                  ? WARNA_NADA.sukses
                                  : WARNA_NADA.cahaya,
                              opacity: 0.85,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {r.kelengkapan.persen}%
                        </span>
                      </div>
                      {r.kelengkapan.kurang.length > 0 ? (
                        <p
                          className="mt-1 truncate text-[11px] text-muted-foreground"
                          title={r.kelengkapan.kurang.join(" · ")}
                        >
                          {r.kelengkapan.kurang[0]}
                          {r.kelengkapan.kurang.length > 1
                            ? ` (+${r.kelengkapan.kurang.length - 1})`
                            : ""}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          r.status === "TERBIT"
                            ? "default"
                            : r.status === "DIREVISI"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {LABEL_STATUS[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel
        judul="Monitoring kelas"
        keterangan="Tahap dihitung dari kelengkapan nilai terhadap peta asesmen. Yang paling perlu ditengok ada di atas."
      >
        {data.kelas.length === 0 ? (
          <Kosong pesan="Belum ada kelas pada RPKPS yang Anda ampu." />
        ) : (
          <ul className="space-y-2.5">
            {data.kelas.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/rpkps/${k.rpkpsId}/kelas/${k.id}`}
                  className="grid grid-cols-[9rem_1fr_9rem] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-cahaya/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs">
                      {k.mk} · {k.kode}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {k.jumlahPeserta} peserta
                    </span>
                  </span>

                  <span className="relative block h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${k.tahap.persenNilai}%`,
                        backgroundColor: WARNA_NADA[k.tahap.nada],
                        opacity: 0.85,
                      }}
                    />
                  </span>

                  <span className="text-right">
                    <span
                      className="block text-[11px] font-medium"
                      style={{ color: WARNA_NADA[k.tahap.nada] }}
                    >
                      {k.tahap.label}
                    </span>
                    <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">
                      {k.tahap.persenNilai}% nilai
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          judul="Tindak lanjut yang Anda tanggung"
          keterangan="Temuan evaluasi yang belum diverifikasi hasilnya."
        >
          {data.temuan.length === 0 ? (
            <Kosong pesan="Tidak ada temuan atas nama Anda." />
          ) : (
            <ul className="space-y-3">
              {data.temuan.map((t) => (
                <li key={t.id} className="flex items-start gap-2.5 text-sm">
                  <ClipboardList className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {t.mk} · {t.kode}
                      {t.taSasaran ? ` · berlaku ${t.taSasaran.replace("-", " ")}` : ""}
                    </p>
                    <p className="text-xs">{t.tindakan}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          judul="Usulan revisi Anda"
          keterangan="Satu-satunya pintu resmi mengubah CPMK dan Sub-CPMK."
        >
          {data.usulan.length === 0 ? (
            <Kosong pesan="Anda belum mengajukan usulan revisi." />
          ) : (
            <ul className="space-y-2">
              {data.usulan.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3">
                  <Link
                    href={`/usulan/${u.id}`}
                    className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {u.mk}
                    </span>{" "}
                    {u.judul}
                  </Link>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {u.status.toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Bagian>
  );
}
