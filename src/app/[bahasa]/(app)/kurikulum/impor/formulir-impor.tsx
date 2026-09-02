"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { praTinjauImpor, simpanImpor, type HasilPraTinjau } from "../aksi";
import { usulkanPerbaikanImpor } from "../aksi-ai";
import { validasiKurikulum, type HasilValidasiKurikulum } from "@/domain/kurikulum/validator";
import {
  dapatDiperbaikiAi,
  terapkanUsulan,
  type UsulanDitolak,
  type UsulanPerbaikan,
} from "@/domain/kurikulum/perbaikan";
import type { KurikulumInput } from "@/domain/kurikulum/tipe";
import { teksTemuan } from "@/lib/bahasa/temuan";
import type { Kamus } from "@/kamus";
import type { TemuanKurikulum } from "@/domain/kurikulum/tipe";

export function FormulirImpor({
  prodi,
  aiAktif,
}: {
  prodi: { id: string; nama: string; kode: string }[];
  aiAktif: boolean;
}) {
  const [pratinjau, setPratinjau] = useState<HasilPraTinjau | null>(null);
  const [meta, setMeta] = useState<{ nama: string; tahun: number } | null>(null);
  const [prodiId, setProdiId] = useState(prodi[0]?.id ?? "");
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const { jalur, k, isi } = useBahasa();

  // Kurikulum dan hasil validasinya jadi state tersendiri karena usulan AI
  // yang diterima menambalnya di sisi klien. Validator murni, jadi hasilnya
  // dapat dihitung ulang seketika tanpa bolak-balik ke server.
  const [kurikulum, setKurikulum] = useState<KurikulumInput | null>(null);
  const [validasi, setValidasi] = useState<HasilValidasiKurikulum | null>(null);
  const [usulan, setUsulan] = useState<UsulanPerbaikan[]>([]);
  const [ditolakAi, setDitolakAi] = useState<UsulanDitolak[]>([]);
  const [asalUsulan, setAsalUsulan] = useState<string | null>(null);
  const [mintaAi, mulaiAi] = useTransition();

  const galatBaris = pratinjau?.galat ?? [];
  const siapSimpan =
    pratinjau?.ok && validasi?.lolos && galatBaris.length === 0 && Boolean(prodiId);

  const temuanAi = validasi
    ? [...validasi.pemblokir, ...validasi.peringatan].filter(dapatDiperbaikiAi)
    : [];

  function terima(dipilih: UsulanPerbaikan[]) {
    if (!kurikulum || dipilih.length === 0) return;
    const baru = terapkanUsulan(kurikulum, dipilih);
    setKurikulum(baru);
    setValidasi(validasiKurikulum(baru));
    setUsulan((lama) => lama.filter((u) => !dipilih.some((d) => d.id === u.id)));
  }

  function tolak(u: UsulanPerbaikan) {
    setUsulan((lama) => lama.filter((x) => x.id !== u.id));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.kurikulum.imporForm.langkah1}</CardTitle>
          <CardDescription>{k.kurikulum.imporForm.langkah1Keterangan}</CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink variant="outline" href="/api/kurikulum/template" prefetch={false}>
            <Download />
            {k.kurikulum.imporForm.unduhTemplate}
          </ButtonLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.kurikulum.imporForm.langkah2}</CardTitle>
          <CardDescription>
            Berkas diperiksa lebih dulu. Tidak ada yang tersimpan sampai Anda
            menekan simpan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={(fd) =>
              mulai(async () => {
                const hasil = await praTinjauImpor(fd);
                setPratinjau(hasil);
                setKurikulum(hasil.kurikulum ?? null);
                setValidasi(hasil.validasi ?? null);
                setUsulan([]);
                setDitolakAi([]);
                setMeta({
                  nama: String(fd.get("nama") ?? ""),
                  tahun: Number(fd.get("tahun")),
                });
                if (!hasil.ok) toast.error(hasil.pesan ?? k.kurikulum.imporForm.gagalBaca);
              })
            }
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="prodiId">{k.kurikulum.imporForm.programStudi}</Label>
                <Select value={prodiId} onValueChange={(v) => setProdiId(v ?? "")}>
                  <SelectTrigger id="prodiId">
                    <SelectValue placeholder={k.kurikulum.imporForm.pilihProdi} />
                  </SelectTrigger>
                  <SelectContent>
                    {prodi.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nama} ({p.kode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nama">{k.kurikulum.imporForm.namaKurikulum}</Label>
                <Input
                  id="nama"
                  name="nama"
                  placeholder={k.kurikulum.imporForm.contohNama}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tahun">{k.kurikulum.imporForm.tahun}</Label>
                <Input
                  id="tahun"
                  name="tahun"
                  type="number"
                  defaultValue={new Date().getFullYear()}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="berkas">{k.kurikulum.imporForm.berkasXlsx}</Label>
              <Input id="berkas" name="berkas" type="file" accept=".xlsx" required />
            </div>

            <Button type="submit" disabled={menunggu}>
              <Upload />
              {menunggu
                ? k.kurikulum.imporForm.memeriksa
                : k.kurikulum.imporForm.periksaBerkas}
            </Button>
          </form>
        </CardContent>
      </Card>

      {pratinjau?.ok && validasi ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{k.kurikulum.imporForm.langkah3}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Angka
                label={k.kurikulum.imporForm.angkaProfil}
                nilai={validasi.ringkasan.jumlahProfilLulusan}
              />
              <Angka label="CPL" nilai={validasi.ringkasan.jumlahCpl} />
              <Angka
                label={k.kurikulum.imporForm.angkaMk}
                nilai={validasi.ringkasan.jumlahMk}
              />
              <Angka label="CPMK" nilai={validasi.ringkasan.jumlahCpmk} />
              <Angka label="Sub-CPMK" nilai={validasi.ringkasan.jumlahSubCpmk} />
            </div>

            {galatBaris.length > 0 ? (
              <Bagian
                judul={isi(k.kurikulum.imporForm.barisGagal, {
                  jumlah: galatBaris.length,
                })}
                nada="buruk"
              >
                <ul className="space-y-1 text-sm">
                  {galatBaris.slice(0, 12).map((g, i) => (
                    <li key={i}>
                      <span className="font-mono text-xs text-muted-foreground">
                        {isi(k.kurikulum.imporForm.barisLokasi, {
                          lembar: g.lembar,
                          baris: g.baris,
                        })}
                      </span>{" "}
                      — {g.pesan}
                    </li>
                  ))}
                  {galatBaris.length > 12 ? (
                    <li className="text-muted-foreground">
                      {isi(k.kurikulum.imporForm.lainnya, {
                        jumlah: galatBaris.length - 12,
                      })}
                    </li>
                  ) : null}
                </ul>
              </Bagian>
            ) : null}

            {validasi.pemblokir.length > 0 ? (
              <Bagian
                judul={isi(k.kurikulum.imporForm.pemblokir, {
                  jumlah: validasi.pemblokir.length,
                })}
                nada="buruk"
              >
                <DaftarTemuan temuan={validasi.pemblokir}  k={k}/>
              </Bagian>
            ) : null}

            {validasi.peringatan.length > 0 ? (
              <Bagian
                judul={isi(k.kurikulum.imporForm.peringatan, {
                  jumlah: validasi.peringatan.length,
                })}
                nada="hati-hati"
              >
                <DaftarTemuan temuan={validasi.peringatan}  k={k}/>
              </Bagian>
            ) : null}

            {aiAktif && temuanAi.length > 0 && usulan.length === 0 ? (
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-dashed p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{k.kurikulum.imporForm.aiJudul}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isi(k.kurikulum.imporForm.aiKeterangan, {
                      dapat: temuanAi.length,
                      total: validasi.pemblokir.length + validasi.peringatan.length,
                    })}
                    sampai Anda menerimanya satu per satu.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={mintaAi || !kurikulum}
                  onClick={() =>
                    mulaiAi(async () => {
                      if (!kurikulum) return;
                      const hasil = await usulkanPerbaikanImpor(kurikulum);
                      setDitolakAi(hasil.ditolak ?? []);
                      setAsalUsulan(
                        hasil.model ? `${hasil.penyedia} · ${hasil.model}` : null,
                      );
                      if (hasil.ok && hasil.usulan) {
                        setUsulan(hasil.usulan);
                        toast.success(
                          isi(k.kurikulum.imporForm.usulanSiap, {
                            jumlah: hasil.usulan.length,
                          }),
                        );
                      } else {
                        toast.error(hasil.pesan ?? k.kurikulum.imporForm.gagalUsulanAi);
                      }
                    })
                  }
                >
                  <Sparkles />
                  {mintaAi
                    ? k.kurikulum.imporForm.memintaUsulan
                    : k.kurikulum.imporForm.usulkanPerbaikan}
                </Button>
              </div>
            ) : null}

            {usulan.length > 0 ? (
              <PanelUsulan
                usulan={usulan}
                asal={asalUsulan}
                onTerima={terima}
                onTolak={tolak}
                onTutup={() => setUsulan([])}
              />
            ) : null}

            {ditolakAi.length > 0 ? (
              <Bagian
                judul={isi(k.kurikulum.imporForm.ditolakAi, {
                  jumlah: ditolakAi.length,
                })}
                nada="hati-hati"
              >
                <ul className="space-y-1 text-sm">
                  {ditolakAi.slice(0, 8).map((d, i) => (
                    <li key={i}>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {d.usulan.mkKode} · {d.usulan.cpmkKode}
                      </span>{" "}
                      — {d.alasan}
                    </li>
                  ))}
                </ul>
              </Bagian>
            ) : null}

            {validasi.lolos && galatBaris.length === 0 ? (
              <Bagian judul={k.kurikulum.imporForm.lolosJudul} nada="baik">
                <p className="text-sm">
                  {k.kurikulum.imporForm.rantaiUtuh}
                  {validasi.peringatan.length > 0
                    ? k.kurikulum.imporForm.adaPeringatan
                    : k.kurikulum.imporForm.titik}
                </p>
              </Bagian>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button
                disabled={!siapSimpan || menunggu}
                onClick={() =>
                  mulai(async () => {
                    if (!kurikulum || !meta) return;
                    const hasil = await simpanImpor(prodiId, meta, kurikulum);
                    if (hasil.ok) {
                      toast.success(hasil.pesan);
                      router.push(
                        jalur(
                          hasil.kurikulumId ? `/kurikulum/${hasil.kurikulumId}` : "/kurikulum",
                        ),
                      );
                      router.refresh();
                    } else {
                      toast.error(hasil.pesan);
                    }
                  })
                }
              >
                {menunggu
                  ? k.kurikulum.imporForm.menyimpan
                  : k.kurikulum.imporForm.simpanDraf}
              </Button>
              {!siapSimpan ? (
                <p className="text-sm text-muted-foreground">
                  Perbaiki temuan pemblokir di berkas, lalu unggah ulang.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}


/**
 * Panel usulan AI — docs/01 §4.5: setiap usulan diputuskan satu per satu,
 * lengkap dengan alasannya, dan tidak pernah menimpa isian secara diam-diam.
 */
function PanelUsulan({
  usulan,
  asal,
  onTerima,
  onTolak,
  onTutup,
}: {
  usulan: UsulanPerbaikan[];
  /** Penyedia dan model yang menghasilkannya, mis. "mistral · mistral-large-latest". */
  asal: string | null;
  onTerima: (u: UsulanPerbaikan[]) => void;
  onTolak: (u: UsulanPerbaikan) => void;
  onTutup: () => void;
}) {
  const { k } = useBahasa();
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="text-sm font-medium">{usulan.length} usulan dari AI</p>
        {asal ? (
          <span className="font-mono text-[10px] text-muted-foreground">{asal}</span>
        ) : null}
      </div>

      <ul className="space-y-3">
        {usulan.map((u) => (
          <li key={u.id} className="rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {u.mkKode}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {u.subCpmkKode ?? u.cpmkKode}
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                {u.kodeTemuan.join(" · ")}
              </span>
            </div>

            <IsiUsulan usulan={u} />

            <p className="mt-1.5 text-xs text-muted-foreground">↳ {u.alasan}</p>

            <div className="mt-2.5 flex gap-2">
              <Button size="sm" onClick={() => onTerima([u])}>
                Terima
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onTolak(u)}>
                Tolak
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        <Button size="sm" variant="outline" onClick={() => onTerima(usulan)}>
          {k.kurikulum.imporForm.terimaSemua}
        </Button>
        <Button size="sm" variant="ghost" onClick={onTutup}>
          {k.kurikulum.imporForm.tutup}
        </Button>
      </div>
    </div>
  );
}

function IsiUsulan({ usulan }: { usulan: UsulanPerbaikan }) {
  switch (usulan.jenis) {
    case "RUMUSAN_SUB":
    case "RUMUSAN_CPMK":
      return (
        <p className="mt-1.5 text-sm">
          {usulan.rumusan}
          {usulan.levelBloom ? (
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {usulan.levelBloom}
            </Badge>
          ) : null}
        </p>
      );

    case "SUB_BARU":
      return (
        <ol className="mt-1.5 space-y-1 text-sm">
          {(usulan.subCpmkBaru ?? []).map((s) => (
            <li key={s.kode} className="flex gap-2">
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {s.kode}
              </span>
              <span className="min-w-0 flex-1">
                {s.rumusan}
                {s.levelBloom ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px]">
                    {s.levelBloom}
                  </Badge>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      );

    case "PETA_CPL":
      return (
        <p className="mt-1.5 text-sm">
          Dipetakan ke{" "}
          {(usulan.cplKode ?? []).map((k) => (
            <Badge key={k} variant="secondary" className="mr-1 text-[10px]">
              {k}
            </Badge>
          ))}
        </p>
      );
  }
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

function Bagian({
  judul,
  nada,
  children,
}: {
  judul: string;
  nada: "baik" | "buruk" | "hati-hati";
  children: React.ReactNode;
}) {
  const gaya = {
    baik: "border-success/25 bg-success/10",
    buruk: "border-destructive/40 bg-destructive/5",
    "hati-hati": "border-warning/25 bg-warning/10",
  }[nada];
  const Ikon = { baik: CheckCircle2, buruk: CircleAlert, "hati-hati": TriangleAlert }[nada];
  const warna = {
    baik: "text-success-foreground",
    buruk: "text-destructive",
    "hati-hati": "text-warning-foreground",
  }[nada];

  return (
    <div className={`rounded-lg border p-3 ${gaya}`}>
      <div className="mb-2 flex items-center gap-2">
        <Ikon className={`size-4 shrink-0 ${warna}`} />
        <p className="text-sm font-medium">{judul}</p>
      </div>
      {children}
    </div>
  );
}

function DaftarTemuan({
  temuan,
  k,
}: {
  temuan: TemuanKurikulum[];
  k: Kamus;
}) {
  return (
    <ul className="space-y-2 text-sm">
      {temuan.slice(0, 15).map((t, i) => (
        <li key={i}>
          <div className="flex flex-wrap items-center gap-1.5">
            {t.lokasi
              ? Object.values(t.lokasi).map((v) => (
                  <Badge key={v} variant="outline" className="text-[10px]">
                    {v}
                  </Badge>
                ))
              : null}
            <span className="font-mono text-[10px] text-muted-foreground">{t.kode}</span>
          </div>
          <p className="mt-0.5">{teksTemuan(t, k).pesan}</p>
          {teksTemuan(t, k).saran ? (
            <p className="mt-0.5 text-xs text-muted-foreground">↳ {teksTemuan(t, k).saran}</p>
          ) : null}
        </li>
      ))}
      {temuan.length > 15 ? (
        <li className="text-muted-foreground">…dan {temuan.length - 15} lainnya</li>
      ) : null}
    </ul>
  );
}
