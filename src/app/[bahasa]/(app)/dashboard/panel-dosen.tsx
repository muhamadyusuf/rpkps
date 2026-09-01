import { Tautan } from "@/components/tautan";
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
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk } from "@/lib/bahasa/teks";
import type { StatusRpkps } from "@/generated/prisma";
import type { DataDosen } from "@/lib/dasbor/muat";

/**
 * Panel dosen dan koordinator mata kuliah — doc 07 §3.4.
 *
 * Kelas diurutkan menurut tahap, bukan menurut kode: yang paling perlu
 * ditengok berada di atas. Tahapnya dihitung dari kelengkapan nilai terhadap
 * peta asesmen, bukan dari tanggal — kalender tidak tahu apa-apa tentang
 * apakah nilai sudah masuk.
 */
export async function PanelDosen({ data }: { data: DataDosen }) {
  const k = await kamus();
  const b = await bahasaAktif();

  return (
    <Bagian
      judul={k.dasbor.dosen.judul}
      keterangan={k.dasbor.dosen.keterangan}
      ikon={<BookOpen className="size-4" />}
      aksi={{ href: "/rpkps", label: k.dasbor.dosen.aksi }}
    >
      <Panel
        judul={k.dasbor.dosen.rpkps.judul}
        keterangan={k.dasbor.dosen.rpkps.keterangan}
      >
        {data.rpkps.length === 0 ? (
          <Kosong pesan={k.dasbor.dosen.rpkps.kosong} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{k.dasbor.dosen.rpkps.mk}</TableHead>
                  <TableHead className="w-48">{k.dasbor.dosen.rpkps.kelengkapan}</TableHead>
                  <TableHead className="text-right">{k.dasbor.dosen.rpkps.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rpkps.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Tautan
                        href={`/rpkps/${r.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {r.kode} — {namaMk(r, b)}
                      </Tautan>
                      <p className="text-xs text-muted-foreground">
                        {r.tahunAkademik.replace("-", " ")}
                        {r.koordinator ? ` · ${k.dasbor.dosen.rpkps.koordinator}` : ""}
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
                        {k.enum.statusRpkps[r.status as StatusRpkps] ?? r.status}
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
        judul={k.dasbor.dosen.kelas.judul}
        keterangan={k.dasbor.dosen.kelas.keterangan}
      >
        {data.kelas.length === 0 ? (
          <Kosong pesan={k.dasbor.dosen.kelas.kosong} />
        ) : (
          <ul className="space-y-2.5">
            {data.kelas.map((kelas) => (
              <li key={kelas.id}>
                <Tautan
                  href={`/rpkps/${kelas.rpkpsId}/kelas/${kelas.id}`}
                  className="grid grid-cols-[9rem_1fr_9rem] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-cahaya/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs">
                      {kelas.mk} · {kelas.kode}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {isi(k.dasbor.dosen.kelas.peserta, { jumlah: kelas.jumlahPeserta })}
                    </span>
                  </span>

                  <span className="relative block h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${kelas.tahap.persenNilai}%`,
                        backgroundColor: WARNA_NADA[kelas.tahap.nada],
                        opacity: 0.85,
                      }}
                    />
                  </span>

                  <span className="text-right">
                    <span
                      className="block text-[11px] font-medium"
                      style={{ color: WARNA_NADA[kelas.tahap.nada] }}
                    >
                      {kelas.tahap.label}
                    </span>
                    <span className="block font-mono text-[10px] tabular-nums text-muted-foreground">
                      {isi(k.dasbor.dosen.kelas.persenNilai, { persen: kelas.tahap.persenNilai })}
                    </span>
                  </span>
                </Tautan>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          judul={k.dasbor.dosen.temuan.judul}
          keterangan={k.dasbor.dosen.temuan.keterangan}
        >
          {data.temuan.length === 0 ? (
            <Kosong pesan={k.dasbor.dosen.temuan.kosong} />
          ) : (
            <ul className="space-y-3">
              {data.temuan.map((t) => (
                <li key={t.id} className="flex items-start gap-2.5 text-sm">
                  <ClipboardList className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {t.mk} · {t.kode}
                      {t.taSasaran
                        ? ` · ${isi(k.dasbor.dosen.temuan.berlaku, { ta: t.taSasaran.replace("-", " ") })}`
                        : ""}
                    </p>
                    <p className="text-xs">{t.tindakan}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          judul={k.dasbor.dosen.usulan.judul}
          keterangan={k.dasbor.dosen.usulan.keterangan}
        >
          {data.usulan.length === 0 ? (
            <Kosong pesan={k.dasbor.dosen.usulan.kosong} />
          ) : (
            <ul className="space-y-2">
              {data.usulan.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3">
                  <Tautan
                    href={`/usulan/${u.id}`}
                    className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {u.mk}
                    </span>{" "}
                    {u.judul}
                  </Tautan>
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
