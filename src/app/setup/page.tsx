import { CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { databaseTerkonfigurasi, statusEnv } from "@/lib/env";
import { periksaFirebaseAuth } from "@/lib/firebase/periksa";

export const dynamic = "force-dynamic";

export const metadata = { title: "Konfigurasi awal" };

const PENJELASAN: Record<string, { judul: string; langkah: string[] }> = {
  database: {
    judul: "Database (Postgres)",
    langkah: [
      "Buat proyek gratis di neon.tech (atau supabase.com).",
      "Salin connection string — pilih yang pooled bila tersedia.",
      "Tempel ke DATABASE_URL di berkas .env.",
      "Jalankan: npm run db:push lalu npm run db:seed",
    ],
  },
  firebaseKlien: {
    judul: "Firebase Authentication — sisi browser",
    langkah: [
      'Firebase Console → buat proyek → menu Authentication → klik "Get started". Langkah ini sering terlewat, dan tanpanya login gagal dengan auth/configuration-not-found.',
      'Tab "Sign-in method" → pilih Google → aktifkan → Save.',
      "Project settings → General → Your apps → tambahkan Web app.",
      "Salin apiKey, authDomain, projectId, dan appId ke NEXT_PUBLIC_FIREBASE_*.",
      "Authentication → Settings → Authorized domains: pastikan localhost terdaftar.",
    ],
  },
  firebaseAdmin: {
    judul: "Firebase Admin — sisi server",
    langkah: [
      "Project settings → Service accounts → Generate new private key.",
      "Dari berkas JSON, ambil project_id, client_email, dan private_key.",
      "Tempel ke FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.",
      "Private key memuat baris baru: tulis satu baris dengan \\n literal di dalam tanda kutip ganda.",
    ],
  },
};

export default async function HalamanSetup() {
  const status = statusEnv();
  const auth = await periksaFirebaseAuth();
  const dbSiap = status.database.siap && databaseTerkonfigurasi();
  const authAktif = auth.status === "aktif";
  const semuaSiap =
    dbSiap && status.firebaseKlien.siap && status.firebaseAdmin.siap && authAktif;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8">
        <p className="label-teknis text-muted-foreground/70">RPKPS ITTS</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight">
          Konfigurasi awal
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aplikasi membutuhkan tiga hal sebelum dapat dijalankan. Halaman ini
          membaca berkas <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.85em]">.env</code>{" "}
          dan menunjukkan apa yang masih kurang.
        </p>
      </div>

      {semuaSiap ? (
        <Card className="mb-6 border-l-2 border-l-success bg-success/8">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <CheckCircle2 className="size-5 shrink-0 text-success-foreground" />
            <div>
              <CardTitle className="text-base">Konfigurasi lengkap</CardTitle>
              <CardDescription>
                Semua variabel lingkungan sudah terisi.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ButtonLink href="/masuk">
              Lanjut ke halaman masuk
            </ButtonLink>
          </CardContent>
        </Card>
      ) : null}

      {status.firebaseKlien.siap && !authAktif ? (
        <Card className="mb-6 border-l-2 border-l-warning bg-warning/8">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
            <div className="min-w-0">
              <CardTitle className="text-base">
                {auth.status === "belum-aktif"
                  ? "Authentication belum diaktifkan di Firebase"
                  : auth.status === "kunci-salah"
                    ? "API key Firebase tidak dikenali"
                    : "Firebase tidak dapat dihubungi"}
              </CardTitle>
              <CardDescription className="mt-1">
                {auth.status === "belum-aktif" ? (
                  <>
                    Variabel lingkungan sudah benar, tetapi proyek Firebase-nya
                    belum pernah mengaktifkan Authentication. Login akan gagal
                    dengan <code className="rounded border border-border bg-muted px-1 font-mono text-[0.85em]">auth/configuration-not-found</code>.
                  </>
                ) : auth.status === "kunci-salah" ? (
                  "Salin ulang konfigurasi Web app dari Firebase Console."
                ) : (
                  `Tidak dapat memeriksa status Authentication: ${
                    auth.status === "tak-terjangkau" ? auth.pesan : "—"
                  }`
                )}
              </CardDescription>
            </div>
          </CardHeader>
          {auth.status === "belum-aktif" ? (
            <CardContent>
              <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
                <li>Buka Firebase Console lalu pilih proyek Anda.</li>
                <li>
                  Menu <strong>Authentication</strong> → klik{" "}
                  <strong>Get started</strong>.
                </li>
                <li>
                  Tab <strong>Sign-in method</strong> → pilih{" "}
                  <strong>Google</strong> → aktifkan → Save.
                </li>
                <li>Muat ulang halaman ini.</li>
              </ol>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {authAktif && auth.domainDiizinkan.length > 0 ? (
        <p className="mb-6 text-xs text-muted-foreground">
          Authentication aktif. Domain yang diizinkan:{" "}
          {auth.domainDiizinkan.join(", ")}.
        </p>
      ) : null}

      <div className="space-y-4">
        {(Object.keys(PENJELASAN) as (keyof typeof PENJELASAN)[]).map((kunci) => {
          const bagian = status[kunci as keyof typeof status];
          const siap = kunci === "database" ? dbSiap : bagian.siap;
          const info = PENJELASAN[kunci];

          return (
            <Card key={kunci} className={siap ? "opacity-70" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {siap ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-foreground" />
                    ) : (
                      <CircleAlert className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
                    )}
                    <div>
                      <CardTitle className="text-base">{info.judul}</CardTitle>
                      {!siap && bagian.kurang.length > 0 ? (
                        <CardDescription className="mt-1">
                          Belum terisi: {bagian.kurang.join(", ")}
                        </CardDescription>
                      ) : null}
                      {!siap &&
                      kunci === "database" &&
                      bagian.kurang.length === 0 ? (
                        <CardDescription className="mt-1">
                          DATABASE_URL masih berisi nilai placeholder.
                        </CardDescription>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={siap ? "secondary" : "outline"}>
                    {siap ? "Siap" : "Belum"}
                  </Badge>
                </div>
              </CardHeader>
              {!siap ? (
                <CardContent>
                  <ol className="ml-4 list-decimal space-y-1.5 text-sm text-muted-foreground">
                    {info.langkah.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ol>
                </CardContent>
              ) : null}
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Setelah <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.85em]">.env</code> diubah,
        hentikan lalu jalankan ulang <code className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[0.85em]">npm run dev</code>.
      </p>
    </main>
  );
}
