import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk, pilihTeks } from "@/lib/bahasa/teks";
import { ButtonLink } from "@/components/ui/button";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { PratinjauSamping } from "../../pratinjau/samping";
import { muatKebijakan, muatRpkps } from "@/lib/rpkps/muat";
import { EditorTugas } from "./editor";

export const dynamic = "force-dynamic";

export default async function HalamanEditorTugas({
  params,
}: {
  params: Promise<{ id: string; tugasId: string }>;
}) {
  const sesi = await wajibAktif();
  const { id, tugasId } = await params;

  const rpkps = await muatRpkps(id);
  if (!rpkps) notFound();

  const wenang = wenangAtasRpkps(sesi, rpkps);
  if (!wenang.bolehLihat) notFound();

  const tugas = rpkps.tugas.find((t) => t.id === tugasId);
  if (!tugas) notFound();

  const { kebijakan } = await muatKebijakan();
  const bisaSunting = rpkps.status === "DRAF" || rpkps.status === "DIREVISI";

  // Sama seperti validator: tugas boleh dijadwalkan pada minggu mana pun yang
  // ADA di tabel, termasuk yang di luar 16 minggu kebijakan (docs/09 §K6).
  const mingguTerakhir = Math.max(
    kebijakan.mingguPerSemester,
    ...rpkps.pertemuan.map((p) => p.minggu),
  );

  const b = await bahasaAktif();
  const subCpmkTersedia = rpkps.mataKuliah.cpmk.flatMap((c) =>
    // Rumusan dipilih di sini, bukan di penyunting: yang menyeberang ke klien
    // cukup teks yang akan tampil (docs/11 §5.4).
    c.subCpmk.map((s) => ({
      id: s.id,
      kode: s.kode,
      rumusan: pilihTeks(s.rumusan, s.rumusanEn, b).teks,
    })),
  );

  const k = await kamus();

  return (
    <PratinjauSamping rpkps={rpkps} jangkar={`naskah-tugas-${tugas.nomor}`}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}/tugas`}>
            <ArrowLeft />
            {k.rpkps.tugasDetail.kembali}
          </ButtonLink>
        </div>

        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {isi(k.rpkps.tugas.nomor, { nomor: tugas.nomor })}
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">{tugas.nama}</h1>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {rpkps.mataKuliah.kode} — {namaMk(rpkps.mataKuliah, b)}
          </p>
        </header>

        {bisaSunting ? (
          <EditorTugas
            tugasId={tugas.id}
            capVersi={tugas.diubahPada.toISOString()}
            mingguMaks={mingguTerakhir}
            subCpmkTersedia={subCpmkTersedia}
            komponenTersedia={rpkps.komponenNilai.map((k) => ({
              id: k.id,
              nama: k.nama,
              bobot: Number(k.bobot),
            }))}
            awal={{
              nama: tugas.nama,
              namaEn: tugas.namaEn,
              jenis: tugas.jenis,
              mingguMulai: tugas.mingguMulai,
              mingguSelesai: tugas.mingguSelesai,
              bobot: Number(tugas.bobot),
              komponenNilaiId: tugas.komponenNilaiId,
              deskripsi: tugas.deskripsi,
              deskripsiEn: tugas.deskripsiEn,
              uraianTugas: tugas.uraianTugas,
              uraianTugasEn: tugas.uraianTugasEn,
              formatLuaran: tugas.formatLuaran,
              formatLuaranEn: tugas.formatLuaranEn,
              ketentuanLain: tugas.ketentuanLain,
              ketentuanLainEn: tugas.ketentuanLainEn,
              subCpmkId: tugas.subCpmk.map((s) => s.subCpmkId),
              kriteria: tugas.kriteria.map((k) => ({
                indikator: k.indikator,
                indikatorEn: k.indikatorEn,
                rincian: k.rincian,
                rincianEn: k.rincianEn,
                bobot: Number(k.bobot),
              })),
              linimasa: tugas.linimasa.map((l) => ({
                minggu: l.minggu,
                tahapan: l.tahapan,
                tahapanEn: l.tahapanEn,
                aktivitas: l.aktivitas,
                aktivitasEn: l.aktivitasEn,
              })),
            }}
          />
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              {k.rpkps.terkunciSunting}
            </p>
          </div>
        )}
      </div>
    </PratinjauSamping>
  );
}
