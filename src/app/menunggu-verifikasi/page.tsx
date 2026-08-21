import { Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { sesiSaatIni } from "@/lib/sesi";
import { TombolKeluar } from "@/components/tombol-keluar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menunggu verifikasi" };

export default async function HalamanMenungguVerifikasi() {
  const sesi = await sesiSaatIni();
  if (!sesi) redirect("/masuk");
  if (sesi.status === "AKTIF") redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-xl border border-warning/35 bg-warning/10 text-warning">
          <Clock className="size-6" />
        </div>
        <p className="label-teknis mb-2 text-muted-foreground/70">Akses tertahan</p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Akun menunggu verifikasi
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Anda masuk sebagai{" "}
          <span className="font-mono text-foreground">{sesi.email}</span>.
          Administrator perlu menetapkan NIDN/NIP, peran, dan program studi Anda
          sebelum akses dibuka.
        </p>
        <div className="mt-6">
          <TombolKeluar variant="outline" />
        </div>
      </div>
    </main>
  );
}
