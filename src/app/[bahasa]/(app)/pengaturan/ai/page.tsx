import { KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { wajibAktif } from "@/lib/otorisasi";
import { DAFTAR_PENYEDIA, modelBawaan } from "@/lib/ai/klien";
import { kamus } from "@/lib/bahasa/server";
import { daftarKredensial, kunciMasterTerpasang } from "@/lib/ai/kredensial";
import { DaftarKunci, FormulirKunci } from "./pengelola";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return { title: (await kamus()).kunciAi.metaJudul };
}

/**
 * Pengaturan kunci AI milik dosen sendiri — BYOK Mode A, docs/08.
 *
 * Halaman ini selalu tentang PENGGUNA YANG SEDANG MASUK. Tidak ada parameter
 * id, dan tidak ada jalur bagi admin untuk membuka kunci orang lain: kunci
 * pribadi bukan data kepegawaian yang dikelola admin seperti NIDN atau peran.
 */
export default async function HalamanKunciAi() {
  const sesi = await wajibAktif();
  const [kunci, masterSiap, k] = await Promise.all([
    daftarKredensial(sesi.id),
    Promise.resolve(kunciMasterTerpasang()),
    kamus(),
  ]);

  const penyedia = DAFTAR_PENYEDIA.map((kode) => ({
    kode,
    label: k.enum.penyediaAi[kode],
    asal: k.enum.asalKunci[kode],
    modelBawaan: modelBawaan(kode),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">
          {k.kunciAi.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{k.kunciAi.judul}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{k.kunciAi.keterangan}</p>
      </header>

      {!masterSiap ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <CardTitle className="text-base">{k.kunciAi.masterJudul}</CardTitle>
                <CardDescription className="mt-1">
                  {k.kunciAi.masterIsiAwal}{" "}
                  <code className="font-mono">AI_KUNCI_MASTER</code>{" "}
                  {k.kunciAi.masterIsiAkhir}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <DaftarKunci kunci={kunci} labelPenyedia={k.enum.penyediaAi} />

      {masterSiap ? <FormulirKunci penyedia={penyedia} /> : null}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{k.kunciAi.jaminanJudul}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted-foreground">
            <li>{k.kunciAi.jaminan1}</li>
            <li>{k.kunciAi.jaminan2}</li>
            <li>{k.kunciAi.jaminan3}</li>
            <li>{k.kunciAi.jaminan4}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
