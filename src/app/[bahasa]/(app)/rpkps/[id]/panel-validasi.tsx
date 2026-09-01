import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HasilValidasiRpkps } from "@/domain/rpkps/validator";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import type { Kamus } from "@/kamus";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import { teksTemuan } from "@/lib/bahasa/temuan";

export async function PanelValidasi({ hasil }: { hasil: HasilValidasiRpkps }) {
  const k = await kamus();
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
                ? k.validasi.siap
                : isi(k.validasi.perluDiperbaiki, { n: pemblokir.length })}
            </CardTitle>
            <CardDescription className="mt-1">
              {isi(k.validasi.ringkasan, {
                mingguan: ringkasan.totalBobotMingguan,
                komponen: ringkasan.totalBobotKomponen,
                terpakai: ringkasan.subCpmkTerpakai,
                tersedia: ringkasan.subCpmkTersedia,
              })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {pemblokir.length > 0 || peringatan.length > 0 ? (
        <CardContent className="space-y-4">
          {pemblokir.length > 0 ? (
            <Daftar judul={k.validasi.pemblokir} temuan={pemblokir} nada="buruk" kam={k} />
          ) : null}
          {peringatan.length > 0 ? (
            <Daftar judul={k.validasi.peringatan} temuan={peringatan} nada="hati-hati" kam={k} />
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
  kam,
}: {
  judul: string;
  temuan: TemuanRpkps[];
  nada: "buruk" | "hati-hati";
  kam: Kamus;
}) {
  const Ikon = nada === "buruk" ? CircleAlert : TriangleAlert;
  const warna = nada === "buruk" ? "text-destructive" : "text-warning-foreground";

  // Peringatan yang berulang tiap minggu diringkas agar panel tetap terbaca.
  const kelompok = new Map<string, TemuanRpkps[]>();
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
          const teks = teksTemuan(utama, kam);
          return (
            <li key={kode} className="flex items-start gap-2.5 text-sm">
              <Ikon className={`mt-0.5 size-4 shrink-0 ${warna}`} />
              <div className="min-w-0">
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{kode}</span>
                  {minggu.length > 1 ? (
                    <Badge variant="outline" className="text-[10px]">
                      {isi(kam.validasi.minggu, { daftar: minggu.join(", ") })}
                    </Badge>
                  ) : null}
                </div>
                {/*
                  Dulu ada `ringkas()` yang membuang awalan "Minggu N: " dengan
                  regex Indonesia sebelum menampilkan temuan berkelompok. Sejak
                  temuan berupa kode + params, regex itu tidak akan cocok pada
                  kalimat Inggris — dan tidak lagi diperlukan: nomor minggunya
                  sudah tampil sebagai lencana di atas.
                */}
                <p>{teks.pesan}</p>
                {teks.saran ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">↳ {teks.saran}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
