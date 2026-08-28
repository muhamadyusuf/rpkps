import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
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

  const subCpmkTersedia = rpkps.mataKuliah.cpmk.flatMap((c) =>
    c.subCpmk.map((s) => ({ id: s.id, kode: s.kode, rumusan: s.rumusan })),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}/tugas`}>
          <ArrowLeft />
          Detail Tugas / Proyek
        </ButtonLink>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Tugas {tugas.nomor}</Badge>
          <h1 className="text-2xl font-semibold tracking-tight">{tugas.nama}</h1>
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </p>
      </header>

      {bisaSunting ? (
        <EditorTugas
          tugasId={tugas.id}
          mingguMaks={kebijakan.mingguPerSemester}
          subCpmkTersedia={subCpmkTersedia}
          komponenTersedia={rpkps.komponenNilai.map((k) => ({
            id: k.id,
            nama: k.nama,
            bobot: Number(k.bobot),
          }))}
          awal={{
            nama: tugas.nama,
            jenis: tugas.jenis,
            mingguMulai: tugas.mingguMulai,
            mingguSelesai: tugas.mingguSelesai,
            bobot: Number(tugas.bobot),
            komponenNilaiId: tugas.komponenNilaiId,
            deskripsi: tugas.deskripsi,
            uraianTugas: tugas.uraianTugas,
            formatLuaran: tugas.formatLuaran,
            ketentuanLain: tugas.ketentuanLain,
            subCpmkId: tugas.subCpmk.map((s) => s.subCpmkId),
            kriteria: tugas.kriteria.map((k) => ({
              indikator: k.indikator,
              rincian: k.rincian,
              bobot: Number(k.bobot),
            })),
            linimasa: tugas.linimasa.map((l) => ({
              minggu: l.minggu,
              tahapan: l.tahapan,
              aktivitas: l.aktivitas,
            })),
          }}
        />
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            RPKPS sudah diajukan atau terbit, sehingga tidak dapat disunting.
          </p>
        </div>
      )}
    </div>
  );
}
