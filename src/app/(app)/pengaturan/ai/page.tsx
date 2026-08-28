import { KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { wajibAktif } from "@/lib/otorisasi";
import {
  ASAL_KUNCI,
  DAFTAR_PENYEDIA,
  LABEL_PENYEDIA,
  modelBawaan,
} from "@/lib/ai/klien";
import { daftarKredensial, kunciMasterTerpasang } from "@/lib/ai/kredensial";
import { DaftarKunci, FormulirKunci } from "./pengelola";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kunci AI" };

/**
 * Pengaturan kunci AI milik dosen sendiri — BYOK Mode A, docs/08.
 *
 * Halaman ini selalu tentang PENGGUNA YANG SEDANG MASUK. Tidak ada parameter
 * id, dan tidak ada jalur bagi admin untuk membuka kunci orang lain: kunci
 * pribadi bukan data kepegawaian yang dikelola admin seperti NIDN atau peran.
 */
export default async function HalamanKunciAi() {
  const sesi = await wajibAktif();
  const [kunci, masterSiap] = await Promise.all([
    daftarKredensial(sesi.id),
    Promise.resolve(kunciMasterTerpasang()),
  ]);

  const penyedia = DAFTAR_PENYEDIA.map((kode) => ({
    kode,
    label: LABEL_PENYEDIA[kode],
    asal: ASAL_KUNCI[kode],
    modelBawaan: modelBawaan(kode),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="label-teknis mb-2 text-muted-foreground/70">Pengaturan</p>
        <h1 className="text-2xl font-semibold tracking-tight">Kunci AI</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Fitur AI di aplikasi ini berjalan dengan kunci API milik Anda sendiri,
          dan pemakaiannya ditagih ke akun Anda pada penyedia yang bersangkutan.
          Kunci hanya dipakai atas perintah Anda — tidak ada tugas latar yang
          memanggilnya.
        </p>
      </header>

      {!masterSiap ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <CardTitle className="text-base">
                  Server belum siap menyimpan kunci
                </CardTitle>
                <CardDescription className="mt-1">
                  Variabel <code className="font-mono">AI_KUNCI_MASTER</code> belum
                  dipasang, sehingga kunci tidak dapat dienkripsi. Kunci baru
                  sengaja ditolak daripada tersimpan tanpa perlindungan. Hubungi
                  admin untuk memasangnya.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <DaftarKunci kunci={kunci} labelPenyedia={LABEL_PENYEDIA} />

      {masterSiap ? <FormulirKunci penyedia={penyedia} /> : null}

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Bagaimana kunci Anda dijaga</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted-foreground">
            <li>
              Disimpan dengan enkripsi amplop AES-256-GCM: tiap kunci punya kunci
              enkripsinya sendiri, yang dibungkus lagi oleh kunci master server.
            </li>
            <li>
              Tidak dapat dibaca kembali oleh siapa pun lewat aplikasi ini —
              termasuk oleh admin. Yang tersimpan sebagai teks biasa hanya empat
              karakter terakhirnya.
            </li>
            <li>
              Tidak pernah masuk log, pesan galat, atau berkas yang dapat diunduh.
              Yang tercatat di log audit adalah penyedia, model, dan jumlah token.
            </li>
            <li>
              Menghapus kunci di sini tidak mencabutnya di sisi penyedia. Bila
              Anda menduga kunci bocor, cabut juga di konsol penyedianya.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
