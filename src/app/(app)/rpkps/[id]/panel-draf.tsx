"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, KeyRound, Loader2, Scale, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
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

const URUT_TAHAP: { kunci: Tahap; label: string }[] = [
  { kunci: "kesiapan", label: "Memeriksa kesiapan RPKPS" },
  { kunci: "susun", label: "Model menyusun draf" },
  { kunci: "periksa", label: "Memeriksa draf terhadap aturan dokumen" },
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
                {t.label}
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
          {ringkas.mingguEfektif} pertemuan efektif · {ringkas.subCpmk} Sub-CPMK ·{" "}
          {ringkas.pustaka} pustaka · {ringkas.komponenNilai} komponen nilai.
          Penyusunan berjalan tiga tahap berurutan — kerangka, isi pertemuan,
          lalu tugas dan kisi-kisi — dan biasanya memakan dua sampai lima menit.
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

const NAMA_PENYEDIA: Record<KunciPilihan["penyedia"], string> = {
  ANTHROPIC: "Anthropic",
  MISTRAL: "Mistral",
  GEMINI: "Gemini",
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
          Susun isi dengan AI
          {asal ? (
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {asal}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          AI menyusun topik, metode, indikator, lembar tugas, dan kisi-kisi untuk
          seluruh pertemuan efektif. Struktur minggu, alokasi menit, dan Sub-CPMK
          tidak diubah. Tidak ada yang tertulis sampai Anda menyetujuinya.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {aktif.length === 0 ? (
          <div className="rounded-lg border border-warning/25 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <div className="min-w-0 space-y-2">
                <p className="text-sm">
                  <strong>Anda belum mendaftarkan kunci AI.</strong> Penyusunan
                  draf memakai kunci API milik Anda sendiri dan menagih ke akun
                  Anda — aplikasi ini tidak menyediakan kunci bersama.
                </p>
                <ButtonLink size="sm" variant="outline" href="/pengaturan/ai">
                  <KeyRound />
                  Daftarkan kunci AI
                </ButtonLink>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-72 space-y-1.5">
              <label htmlFor="kunci-ai" className="label-teknis text-muted-foreground/80">
                Kunci yang dipakai
              </label>
              <Select value={kunciId} onValueChange={(v) => setKunciId(v ?? "")}>
                <SelectTrigger id="kunci-ai" disabled={sedangSusun}>
                  <SelectValue placeholder="Pilih kunci…" />
                </SelectTrigger>
                <SelectContent>
                  {aktif.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {NAMA_PENYEDIA[k.penyedia]} · {k.label} · …{k.ekor}
                      {k.bawaan ? " (bawaan)" : ""}
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
              toast.error(siap.pesan ?? "RPKPS belum siap disusun.");
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
            if (!hasil.draf) toast.error(hasil.pesan ?? "Gagal menyusun draf.");
            else if (hasil.temuan?.length) toast.error("Draf melanggar aturan dokumen.");
            else toast.success("Draf siap ditinjau.");
          }}
        >
          <Sparkles />
          {sedangSusun
            ? berjalan === "kesiapan"
              ? "Memeriksa kesiapan…"
              : "Menyusun draf…"
            : draf
              ? "Susun ulang"
              : "Susun draf"}
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
                {temuan.length} aturan dilanggar — draf tidak dapat diterapkan
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
                <li className="text-muted-foreground">…dan {temuan.length - 10} lainnya</li>
              ) : null}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Tekan “Susun ulang” untuk mencoba lagi.
            </p>
          </div>
        ) : null}

        {catatan.length > 0 ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Scale className="size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium">
                {catatan.length} angka dirapikan sistem
              </p>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {catatan.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Bobot wajib berjumlah tepat 100%. Yang meleset diskalakan ulang
              dengan perbandingan antar angka dipertahankan — periksa angkanya
              di bawah sebelum menyetujui.
            </p>
          </div>
        ) : null}

        {draf && ringkas ? (
          <>
            {msModel !== null ? (
              <p className="text-xs text-muted-foreground">
                Disusun dalam {formatDetik(Math.round(msModel / 1000))}.
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Angka label="Pertemuan" nilai={ringkas.jumlahPertemuan} />
              <Angka label="Indikator" nilai={ringkas.jumlahIndikator} />
              <Angka label="Tugas" nilai={ringkas.jumlahTugas} />
              <Angka label="Butir ujian" nilai={ringkas.jumlahButirUjian} />
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <Bagian judul="Deskripsi mata kuliah">{draf.deskripsi}</Bagian>
              <Bagian judul="Kalimat pembuka CPMK">{draf.kalimatPembukaCpmk}</Bagian>
              <Bagian judul={`Komponen nilai (${ringkas.jumlahKomponen})`}>
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
                    <strong>{draf.pustakaBaru.length} pustaka diusulkan AI — verifikasi
                    sebelum menyetujui.</strong>{" "}
                    Judul, penulis, dan tahun bisa saja tidak ada. Pustaka yang sudah
                    Anda masukkan sendiri tidak diubah.
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
                      Minggu {p.minggu}
                    </Badge>
                    <span className="text-sm font-medium">{p.topik}</span>
                    {p.bobot > 0 ? (
                      <Badge variant="outline" className="text-[10px]">
                        {p.bobot}%
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

              {draf.tugas.map((t) => (
                <div key={t.nomor} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-[10px]">Tugas {t.nomor}</Badge>
                    <span className="text-sm font-medium">{t.nama}</span>
                    <Badge variant="outline" className="text-[10px]">
                      minggu {t.mingguMulai}–{t.mingguSelesai} · {t.bobot}%
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm">{t.deskripsi}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.kriteria.map((k) => `${k.indikator} (${k.bobot}%)`).join(" · ")}
                  </p>
                </div>
              ))}

              {draf.kisiKisi.map((k) => (
                <div key={k.jenis} className="border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="text-[10px]">Kisi-kisi {k.jenis}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {k.butir.length} baris
                      {k.durasiMenit ? ` · ${k.durasiMenit} menit` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {k.butir
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
                {menerapkan ? "Menerapkan…" : "Setujui dan tulis ke dokumen"}
              </Button>
              <Button variant="ghost" onClick={() => setDraf(null)} disabled={menerapkan}>
                Buang draf
              </Button>
              <p className="text-xs text-muted-foreground">
                Menimpa deskripsi, pembuka CPMK, komponen nilai, isi pertemuan,
                seluruh tugas, dan kisi-kisi. Pustaka yang sudah ada dipertahankan.
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
