import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HasilValidasiRpkps } from "@/domain/rpkps/validator";

export function PanelValidasi({ hasil }: { hasil: HasilValidasiRpkps }) {
  const { pemblokir, peringatan, ringkasan } = hasil;

  return (
    <Card
      className={
        hasil.lolos
          ? "border-l-2 border-l-success bg-success/8"
          : "border-l-2 border-l-destructive bg-destructive/8"
      }
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          {hasil.lolos ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" />
          ) : (
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">
              {hasil.lolos
                ? "Siap diajukan"
                : `${pemblokir.length} temuan harus diperbaiki`}
            </CardTitle>
            <CardDescription className="mt-1">
              Bobot mingguan {ringkasan.totalBobotMingguan}% · komponen nilai{" "}
              {ringkasan.totalBobotKomponen}% · {ringkasan.subCpmkTerpakai} dari{" "}
              {ringkasan.subCpmkTersedia} Sub-CPMK terjadwal
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {pemblokir.length > 0 || peringatan.length > 0 ? (
        <CardContent className="space-y-4">
          {pemblokir.length > 0 ? (
            <Daftar judul="Pemblokir" temuan={pemblokir} nada="buruk" />
          ) : null}
          {peringatan.length > 0 ? (
            <Daftar judul="Peringatan" temuan={peringatan} nada="hati-hati" />
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

function Daftar({
  judul,
  temuan,
  nada,
}: {
  judul: string;
  temuan: { kode: string; pesan: string; minggu?: number; saran?: string }[];
  nada: "buruk" | "hati-hati";
}) {
  const Ikon = nada === "buruk" ? CircleAlert : TriangleAlert;
  const warna = nada === "buruk" ? "text-destructive" : "text-warning-foreground";

  // Peringatan yang berulang tiap minggu diringkas agar panel tetap terbaca.
  const kelompok = new Map<string, typeof temuan>();
  for (const t of temuan) {
    const daftar = kelompok.get(t.kode) ?? [];
    daftar.push(t);
    kelompok.set(t.kode, daftar);
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {judul} ({temuan.length})
      </p>
      <ul className="space-y-2">
        {[...kelompok.entries()].map(([kode, daftar]) => {
          const utama = daftar[0];
          const minggu = daftar.map((d) => d.minggu).filter((m): m is number => m !== undefined);
          return (
            <li key={kode} className="flex items-start gap-2.5 text-sm">
              <Ikon className={`mt-0.5 size-4 shrink-0 ${warna}`} />
              <div className="min-w-0">
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{kode}</span>
                  {minggu.length > 1 ? (
                    <Badge variant="outline" className="text-[10px]">
                      minggu {minggu.join(", ")}
                    </Badge>
                  ) : null}
                </div>
                <p>{daftar.length > 1 ? ringkas(utama.pesan) : utama.pesan}</p>
                {utama.saran ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">↳ {utama.saran}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Membuang awalan "Minggu N: " agar ringkasan lintas minggu tidak menyesatkan. */
function ringkas(pesan: string): string {
  return pesan.replace(/^Minggu \d+[:\s]*/i, "");
}
