import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { HasilValidasiKurikulum } from "@/domain/kurikulum/validator";
import type { TemuanKurikulum } from "@/domain/kurikulum/tipe";
import { teksTemuan } from "@/lib/bahasa/temuan";
import type { Kamus } from "@/kamus";

/**
 * Hasil `validasiKurikulum` pada kurikulum yang sedang disusun. Acuan: docs/15 §2.6.
 *
 * Pemeriksaan yang PERSIS sama dengan yang menjaga jalur impor Excel — bukan
 * versi ringannya. Tanpa panel ini, kurikulum yang ditulis tangan lolos dari
 * mutu yang ditegakkan pada berkas unggahan, dan dua jalur masuk yang sama
 * berujung pada dua ambang yang berbeda.
 *
 * Komponen server: temuannya dihitung ulang tiap render dan tidak menyimpan
 * state apa pun. Kalimat temuan datang dari domain dalam bahasa Indonesia
 * (sama seperti alasan `periksaKelayakanHapus`); yang diterjemahkan adalah
 * bingkainya.
 */
export async function PanelValidator({ hasil }: { hasil: HasilValidasiKurikulum }) {
  const k = await kamus();

  if (hasil.temuan.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{k.kurikulum.sunting.validatorJudul}</CardTitle>
              <CardDescription className="mt-1">
                {k.kurikulum.sunting.validatorBersih}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const adaPemblokir = hasil.pemblokir.length > 0;

  return (
    <Card className={adaPemblokir ? "border-destructive/40 bg-destructive/5" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{k.kurikulum.sunting.validatorJudul}</CardTitle>
            <CardDescription className="mt-1">
              {k.kurikulum.sunting.validatorKeterangan}
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            {adaPemblokir ? (
              <Badge variant="destructive">
                {isi(k.kurikulum.sunting.validatorPemblokir, {
                  jumlah: hasil.pemblokir.length,
                })}
              </Badge>
            ) : null}
            {hasil.peringatan.length > 0 ? (
              <Badge variant="secondary">
                {isi(k.kurikulum.sunting.validatorPeringatan, {
                  jumlah: hasil.peringatan.length,
                })}
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2.5">
        {/* Pemblokir lebih dulu: ia yang menahan tombol "Berlakukan". */}
        {[...hasil.pemblokir, ...hasil.peringatan].map((t, i) => (
          <Temuan key={`${t.kode}-${i}`} temuan={t}  k={k}/>
        ))}
      </CardContent>
    </Card>
  );
}

function Temuan({ temuan, k }: { temuan: TemuanKurikulum; k: Kamus }) {
  const pemblokir = temuan.tingkat === "PEMBLOKIR";
  const Ikon = pemblokir ? CircleAlert : TriangleAlert;

  // Lokasi ditulis sebagai jejak "TI214 · CPMK081", bukan JSON: yang membaca
  // temuan perlu tahu barisnya, bukan bentuk datanya.
  const lokasi = temuan.lokasi ? Object.values(temuan.lokasi).join(" · ") : null;

  return (
    <div className="flex gap-2.5 border-b pb-2.5 text-sm last:border-0 last:pb-0">
      <Ikon
        className={
          pemblokir
            ? "mt-0.5 size-4 shrink-0 text-destructive"
            : "mt-0.5 size-4 shrink-0 text-muted-foreground"
        }
      />
      <div className="min-w-0 flex-1">
        <p>
          {lokasi ? <span className="font-mono text-xs text-muted-foreground">{lokasi} — </span> : null}
          {teksTemuan(temuan, k).pesan}
        </p>
        {teksTemuan(temuan, k).saran ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{teksTemuan(temuan, k).saran}</p>
        ) : null}
      </div>
      <span className="label-teknis shrink-0 text-muted-foreground/70">{temuan.kode}</span>
    </div>
  );
}
