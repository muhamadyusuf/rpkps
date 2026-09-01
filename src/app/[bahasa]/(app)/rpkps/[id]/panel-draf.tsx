"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, KeyRound, Loader2, Scale, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button, ButtonLink } from "@/components/ui/button";
import type { Kamus } from "@/kamus";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ringkasDraf, type DrafRpkps, type TemuanDraf } from "@/domain/rpkps/draf";
import {
  periksaKesiapanDraf,
  susunDrafRpkps,
  terapkanDrafRpkps,
  type HasilKesiapan,
} from "./aksi-draf";

/**
 * Tahap yang BENAR-BENAR dilalui, bukan tebakan dari waktu berjalan.
 *
 * "kesiapan" dan "susun" adalah dua pemanggilan server terpisah, jadi peralihan
 * di antaranya nyata. "periksa" selesai bersamaan dengan kembalinya "susun",
 * karena validasi berjalan di server sebelum jawabannya dikirim.
 */
type Tahap = "kesiapan" | "susun" | "periksa";
type StatusTahap = "menunggu" | "berjalan" | "selesai";

/** Urutan tahap. Kalimatnya di `kamus.rpkps.draf`, dipilih saat render. */
const URUT_TAHAP: { kunci: Tahap; label: keyof Kamus["rpkps"]["draf"] }[] = [
  { kunci: "kesiapan", label: "tahapKesiapan" },
  { kunci: "susun", label: "tahapSusun" },
  { kunci: "periksa", label: "tahapPeriksa" },
];

function status(tahap: Tahap, berjalan: Tahap | null, selesai: Set<Tahap>): StatusTahap {
  if (selesai.has(tahap)) return "selesai";
  return berjalan === tahap ? "berjalan" : "menunggu";
}

/**
 * Waktu berjalan, dihitung dari denyut interval.
 *
 * Sengaja TIDAK memanggil Date.now() saat render — render harus murni — dan
 * tidak mereset dirinya di dalam effect. Peresetan dilakukan pemanggil di
 * penangan klik, satu-satunya tempat yang memang tahu penyusunan dimulai ulang.
 */
function useDenyutDetik(aktif: boolean, setDetik: (f: (n: number) => number) => void) {
  useEffect(() => {
    if (!aktif) return;
    const jam = setInterval(() => setDetik((n) => n + 1), 1000);
    return () => clearInterval(jam);
  }, [aktif, setDetik]);
}

function formatDetik(detik: number): string {
  const m = Math.floor(detik / 60);
  const d = detik % 60;
  return m > 0 ? `${m}m ${String(d).padStart(2, "0")}d` : `${d} detik`;
}

function DaftarTahap({
  berjalan,
  selesai,
  detik,
  ringkas,
}: {
  berjalan: Tahap | null;
  selesai: Set<Tahap>;
  detik: number;
  ringkas: HasilKesiapan["ringkas"];
}) {
  const { k, isi } = useBahasa();

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <ul className="space-y-2">
        {URUT_TAHAP.map((t) => {
          const st = status(t.kunci, berjalan, selesai);
          return (
            <li key={t.kunci} className="flex items-center gap-2.5 text-sm">
              <span className="flex size-4 shrink-0 items-center justify-center">
                {st === "selesai" ? (
                  <Check className="size-4 text-success-foreground" />
                ) : st === "berjalan" ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                )}
              </span>
              <span className={st === "menunggu" ? "text-muted-foreground" : undefined}>
                {k.rpkps.draf[t.label]}
              </span>
              {t.kunci === "susun" && st === "berjalan" ? (
                <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDetik(detik)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {ringkas ? (
        <p className="mt-2.5 border-t pt-2.5 text-xs text-muted-foreground">
          {isi(k.rpkps.draf.ringkasKesiapan, {
            minggu: ringkas.mingguEfektif,
            sub: ringkas.subCpmk,
            pustaka: ringkas.pustaka,
            komponen: ringkas.komponenNilai,
          })}
        </p>
      ) : null}
    </div>
  );
}

/** Kerangka berkedip di area pratinjau selagi draf disusun. */
function KerangkaPratinjau() {
  return (
    <div className="space-y-3 rounded-lg border p-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse space-y-2 border-b pb-3 last:border-0 last:pb-0">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-4 rounded bg-muted" style={{ width: `${38 + i * 9}%` }} />
          </div>
          <div className="h-3 w-11/12 rounded bg-muted/70" />
          <div className="h-3 rounded bg-muted/70" style={{ width: `${55 + i * 7}%` }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Menyusun seluruh isi RPKPS dengan AI, lalu dosen menyetujuinya sekali.
 *
 * Draf ditampilkan UTUH sebelum disetujui — bukan sekadar ringkasan angka —
 * karena satu tombol persetujuan berarti ini satu-satunya kesempatan dosen
 * membaca apa yang akan tertulis atas namanya.
 */
export type KunciPilihan = {
  id: string;
  penyedia: "ANTHROPIC" | "MISTRAL" | "GEMINI";
  label: string;
  ekor: string;
  modelEfektif: string;
  bawaan: boolean;
  aktif: boolean;
};

export function PanelDraf({
  rpkpsId,
  kredensial,
}: {
  rpkpsId: string;
  /**
   * Kunci AI milik dosen yang membuka halaman. Bentuknya ditulis ulang di
   * berkas ini, bukan diimpor dari `@/lib/ai/kredensial`, supaya komponen
   * klien tidak pernah menarik modul `server-only`.
   */
  kredensial: KunciPilihan[];
}) {
  const { k, isi } = useBahasa();
  const [draf, setDraf] = useState<DrafRpkps | null>(null);
  const [temuan, setTemuan] = useState<TemuanDraf[]>([]);
  const [catatan, setCatatan] = useState<string[]>([]);
  const [asal, setAsal] = useState<string | null>(null);
  // SENGAJA tanpa useTransition. Pembaruan state di dalam startTransition
  // bersifat non-urgent: React menahan UI lama sampai transisi selesai, jadi
  // tahap, spinner, dan penghitung waktu tidak pernah sempat tergambar —
  // hanya isPending yang berubah. Alur ini justru hidup dari keadaan antara,
  // maka pembaruannya harus urgent.
  const [berjalan, setBerjalan] = useState<Tahap | null>(null);
  const [selesai, setSelesai] = useState<Set<Tahap>>(new Set());
  const [kesiapan, setKesiapan] = useState<HasilKesiapan["ringkas"]>(undefined);
  const [msModel, setMsModel] = useState<number | null>(null);
  const [detik, setDetik] = useState(0);
  useDenyutDetik(berjalan === "susun", setDetik);
  const [menerapkan, mulaiTerap] = useTransition();
  const router = useRouter();

  /**
   * Panggilan ini memakai kunci API MILIK DOSEN dan menagih ke akunnya sendiri
   * (docs/08). Karena itu kunci yang akan dipakai tertulis di panel, bukan
   * tersembunyi di halaman pengaturan: yang menanggung biaya berhak melihatnya
   * sebelum menekan tombol. Bawaannya sudah terpilih, jadi tetap satu klik.
   */
  const aktif = kredensial.filter((k) => k.aktif);
  const [kunciId, setKunciId] = useState<string>(
    () => (aktif.find((k) => k.bawaan) ?? aktif[0])?.id ?? "",
  );
  const kunci = aktif.find((k) => k.id === kunciId) ?? null;

  const sedangSusun = berjalan !== null;
  const ringkas = draf ? ringkasDraf(draf) : null;
  const bolehSetuju = draf !== null && temuan.length === 0 && !menerapkan;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Sparkles className="size-4 shrink-0 text-primary" />
          {k.rpkps.draf.judul}
          {asal ? (
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {asal}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          {k.rpkps.draf.keterangan}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {aktif.length === 0 ? (
          <div className="rounded-lg border border-warning/25 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <div className="min-w-0 space-y-2">
                <p className="text-sm">
                  <strong>{k.rpkps.draf.tanpaKunciTebal}</strong>{" "}
                  {k.rpkps.draf.tanpaKunciIsi}
                </p>
                <ButtonLink size="sm" variant="outline" href="/pengaturan/ai">
                  <KeyRound />
                  {k.rpkps.draf.daftarkanKunci}
                </ButtonLink>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-72 space-y-1.5">
              <label htmlFor="kunci-ai" className="label-teknis text-muted-foreground/80">
                {k.rpkps.draf.kunciDipakai}
              </label>
              <Select value={kunciId} onValueChange={(v) => setKunciId(v ?? "")}>
                <SelectTrigger id="kunci-ai" disabled={sedangSusun}>
                  <SelectValue placeholder={k.rpkps.draf.pilihKunci} />
                </SelectTrigger>
                <SelectContent>
                  {aktif.map((kr) => (
                    <SelectItem key={kr.id} value={kr.id}>
                      {k.enum.penyediaAi[kr.penyedia]} · {kr.label} · …{kr.ekor}
                      {kr.bawaan ? k.rpkps.draf.kunciBawaan : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kunci ? (
              <p className="pb-2 font-mono text-[11px] text-muted-foreground">
                {kunci.modelEfektif}
              </p>
            ) : null}
          </div>
        )}

        <Button
          variant={draf ? "outline" : "default"}
          disabled={sedangSusun || kunci === null}
          onClick={async () => {
            setDraf(null);
            setTemuan([]);
            setCatatan([]);
            setMsModel(null);
            setSelesai(new Set());
            setKesiapan(undefined);

            setBerjalan("kesiapan");
            const siap = await periksaKesiapanDraf(rpkpsId);
            if (!siap.ok) {
              setBerjalan(null);
              toast.error(siap.pesan ?? k.rpkps.kembalikan.belumSiapDisusun);
              return;
            }
            setKesiapan(siap.ringkas);
            setSelesai(new Set<Tahap>(["kesiapan"]));

            setBerjalan("susun");
            setDetik(0);
            const hasil = await susunDrafRpkps(rpkpsId, kunciId || null);
            setBerjalan(null);
            setSelesai(new Set<Tahap>(["kesiapan", "susun", "periksa"]));

            setDraf(hasil.draf ?? null);
            setTemuan(hasil.temuan ?? []);
            setCatatan(hasil.catatan ?? []);
            setMsModel(hasil.msModel ?? null);
            setAsal(hasil.model ? `${hasil.penyedia} · ${hasil.model}` : null);
            if (!hasil.draf) toast.error(hasil.pesan ?? k.rpkps.draf.gagalSusun);
            else if (hasil.temuan?.length) toast.error(k.rpkps.draf.melanggarAturan);
            else toast.success(k.rpkps.draf.siapDitinjau);
          }}
        >
          <Sparkles />
          {sedangSusun
            ? berjalan === "kesiapan"
              ? k.rpkps.draf.memeriksaKesiapan
              : k.rpkps.draf.menyusunDraf
            : draf
              ? k.rpkps.draf.susunUlang
              : k.rpkps.draf.susunDraf}
        </Button>

        {sedangSusun ? (
          <>
            <DaftarTahap
              berjalan={berjalan}
              selesai={selesai}
              detik={detik}
              ringkas={kesiapan}
            />
            {berjalan === "susun" ? <KerangkaPratinjau /> : null}
          </>
        ) : null}

        {temuan.length > 0 ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0 text-destructive" />
              <p className="text-sm font-medium">
                {isi(k.rpkps.draf.temuanJudul, { jumlah: temuan.length })}
              </p>
            </div>
            <ul className="space-y-1 text-sm">
              {temuan.slice(0, 10).map((t, i) => (
                <li key={i}>
                  {t.lokasi ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {t.lokasi}{" "}
                    </span>
                  ) : null}
                  {t.pesan}
                </li>
              ))}
              {temuan.length > 10 ? (
                <li className="text-muted-foreground">
                  {isi(k.rpkps.draf.temuanLain, { jumlah: temuan.length - 10 })}
                </li>
              ) : null}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {k.rpkps.draf.temuanSaran}
            </p>
          </div>
        ) : null}

        {catatan.length > 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Scale className="size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium">
                {isi(k.rpkps.draf.catatanJudul, { jumlah: catatan.length })}
              </p>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {catatan.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {k.rpkps.draf.catatanKeterangan}
            </p>
          </div>
        ) : null}

        {draf && ringkas ? (
          <>
            {msModel !== null ? (
              <p className="text-xs text-muted-foreground">
                {isi(k.rpkps.draf.durasi, {
                  waktu: formatDetik(Math.round(msModel / 1000)),
                })}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Angka
                label={k.rpkps.draf.angkaPertemuan}
                nilai={ringkas.jumlahPertemuan}
              />
              <Angka
                label={k.rpkps.draf.angkaIndikator}
                nilai={ringkas.jumlahIndikator}
              />
              <Angka label={k.rpkps.draf.angkaTugas} nilai={ringkas.jumlahTugas} />
              <Angka
                label={k.rpkps.draf.angkaButirUjian}
                nilai={ringkas.jumlahButirUjian}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <Bagian judul={k.rpkps.draf.bagianDeskripsi}>{draf.deskripsi}</Bagian>
              <Bagian judul={k.rpkps.draf.bagianPembuka}>{draf.kalimatPembukaCpmk}</Bagian>
              <Bagian
                judul={isi(k.rpkps.draf.bagianKomponen, {
                  jumlah: ringkas.jumlahKomponen,
                })}
              >
                <span className="flex flex-wrap gap-1.5">
                  {draf.komponenNilai.map((n) => (
                    <Badge key={n.nama} variant="outline" className="text-[10px]">
                      {n.nama} {n.bobot}%
                    </Badge>
                  ))}
                </span>
              </Bagian>
            </div>

            {draf.pustakaBaru.length > 0 ? (
              <div className="rounded-lg border border-warning/25 bg-warning/10 p-3">
                <div className="mb-2 flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                  <p className="text-sm">
                    <strong>
                      {isi(k.rpkps.draf.pustakaTebal, {
                        jumlah: draf.pustakaBaru.length,
                      })}
                    </strong>{" "}
                    {k.rpkps.draf.pustakaIsi}
                  </p>
                </div>
                <ol className="space-y-1 text-sm">
                  {draf.pustakaBaru.map((b) => (
                    <li key={`${b.jenis}-${b.nomor}`} className="flex gap-2">
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {b.jenis}-{b.nomor}
                      </span>
                      <span className="min-w-0 flex-1">{b.teks}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-lg border p-3">
              {draf.pertemuan.map((p) => (
                <div key={p.minggu} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {isi(k.rpkps.draf.minggu, { nomor: p.minggu })}
                    </Badge>
                    <span className="text-sm font-medium">{p.topik}</span>
                    {p.bobot > 0 ? (
                      <Badge variant="outline" className="text-[10px]">
                        {p.bobot}%
                        {p.komponenNilai ? ` · ${p.komponenNilai}` : ""}
                      </Badge>
                    ) : null}
                  </div>
                  {p.subtopik.length > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.subtopik.join(" · ")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm">{p.metodeNarasi}</p>
                  {p.indikator.length > 0 ? (
                    <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                      {p.indikator.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}

              {draf.ujian
                .filter((u) => u.bobot > 0)
                .map((u) => (
                  <div key={u.minggu} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {isi(k.rpkps.draf.minggu, { nomor: u.minggu })}
                      </Badge>
                      <span className="text-sm font-medium">
                        {isi(k.rpkps.draf.ujian, { jenis: u.jenis })}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {u.bobot}%
                        {u.komponenNilai ? ` · ${u.komponenNilai}` : ""}
                      </Badge>
                    </div>
                  </div>
                ))}

              {draf.tugas.map((t) => (
                <div key={t.nomor} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-[10px]">
                      {isi(k.rpkps.draf.tugasKe, { nomor: t.nomor })}
                    </Badge>
                    <span className="text-sm font-medium">{t.nama}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {isi(k.rpkps.draf.rentangTugas, {
                        mulai: t.mingguMulai,
                        selesai: t.mingguSelesai,
                        bobot: t.bobot,
                      })}
                      {t.komponenNilai ? ` · ${t.komponenNilai}` : ""}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">{t.deskripsi}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.kriteria.map((kr) => `${kr.indikator} (${kr.bobot}%)`).join(" · ")}
                  </p>
                </div>
              ))}

              {draf.kisiKisi.map((kk) => (
                <div key={kk.jenis} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-[10px]">
                      {isi(k.rpkps.draf.kisiKisiKe, { jenis: kk.jenis })}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {isi(k.rpkps.draf.jumlahBaris, { jumlah: kk.butir.length })}
                      {kk.durasiMenit
                        ? isi(k.rpkps.draf.durasiUjian, { menit: kk.durasiMenit })
                        : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {kk.butir
                      .map((b) => `${b.subCpmkKode} ${b.levelBloom} (${b.skor})`)
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button
                disabled={!bolehSetuju}
                onClick={() =>
                  mulaiTerap(async () => {
                    const hasil = await terapkanDrafRpkps(rpkpsId, draf);
                    if (hasil.ok) {
                      toast.success(hasil.pesan);
                      setDraf(null);
                      setTemuan([]);
                      router.refresh();
                    } else {
                      toast.error(hasil.pesan);
                    }
                  })
                }
              >
                {menerapkan ? k.rpkps.draf.menerapkan : k.rpkps.draf.setujui}
              </Button>
              <Button variant="ghost" onClick={() => setDraf(null)} disabled={menerapkan}>
                {k.rpkps.draf.buang}
              </Button>
              <p className="text-xs text-muted-foreground">
                {k.rpkps.draf.peringatanTimpa}
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="border-b pb-3 last:border-0 last:pb-0">
      <p className="text-xs font-medium text-muted-foreground">{judul}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function Angka({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div className="panel rounded-lg border p-3">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p className="mt-1.5 font-mono text-xl leading-none font-semibold tabular-nums">
        {nilai}
      </p>
    </div>
  );
}
