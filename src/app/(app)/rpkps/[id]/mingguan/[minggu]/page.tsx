import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ListChecks, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { muatKebijakan, muatRpkps } from "@/lib/rpkps/muat";
import { susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { EditorPertemuan } from "./editor";

function Tautan({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="underline underline-offset-2 hover:text-foreground">
      {children}
    </Link>
  );
}

export const dynamic = "force-dynamic";

export default async function HalamanPertemuan({
  params,
}: {
  params: Promise<{ id: string; minggu: string }>;
}) {
  const sesi = await wajibAktif();
  const { id, minggu: mingguTeks } = await params;
  const minggu = Number(mingguTeks);
  if (!Number.isInteger(minggu)) notFound();

  const rpkps = await muatRpkps(id);
  if (!rpkps) notFound();

  const wenang = wenangAtasRpkps(sesi, rpkps);
  if (!wenang.bolehLihat) notFound();

  const pertemuan = rpkps.pertemuan.find((p) => p.minggu === minggu);
  if (!pertemuan) notFound();

  const { kebijakan } = await muatKebijakan();
  const rencana = susunRencanaSemester(kebijakan, {
    sksTeori: rpkps.mataKuliah.sksTeori,
    sksPraktik: rpkps.mataKuliah.sksPraktik,
    bentukTeori: rpkps.mataKuliah.bentukTeori,
    bentukPraktik: rpkps.mataKuliah.bentukPraktik,
  });
  const pagu =
    rencana.minggu.find((m) => m.minggu === minggu)?.pagu ?? {
      tm: 0, pt: 0, bm: 0, total: 0, terjadwal: 0, ruangKhusus: 0,
    };

  const bisaSunting = rpkps.status === "DRAF" || rpkps.status === "DIREVISI";
  const sebelum = rpkps.pertemuan.filter((p) => p.minggu < minggu).at(-1);
  const sesudah = rpkps.pertemuan.find((p) => p.minggu > minggu);

  const subCpmkTersedia = rpkps.mataKuliah.cpmk.flatMap((c) =>
    c.subCpmk.map((s) => ({ id: s.id, kode: s.kode, rumusan: s.rumusan })),
  );

  /**
   * Baris ujian hampir selalu punya komponen nilai bernama sama ("UTS", "UAS")
   * — dan hampir selalu lupa ditunjuk, karena penyusun mengira bobot ujian
   * sudah terwakili kisi-kisi. Akibatnya bobot ujian menggantung: tidak masuk
   * komponen mana pun, tidak muncul pada tabel distribusi, dan menjadi temuan
   * PA-TANPA-KOMPONEN pada peta asesmen.
   *
   * Usulan ini hanya nilai awal penyunting, bukan tulisan ke basis data —
   * penyusun tetap yang menyimpan, dan tetap bisa memilih yang lain.
   */
  const komponenUsulan =
    pertemuan.komponenNilaiId ??
    (pertemuan.jenis === "EFEKTIF"
      ? null
      : (rpkps.komponenNilai.find(
          (k) => k.nama.trim().toUpperCase() === pertemuan.jenis,
        )?.id ?? null));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}/mingguan`}>
          <ArrowLeft />
          Rencana mingguan
        </ButtonLink>
        <div className="flex gap-1">
          {sebelum ? (
            <ButtonLink variant="outline"
              size="sm" href={`/rpkps/${id}/mingguan/${sebelum.minggu}`}>
              <ArrowLeft />
              Minggu {sebelum.minggu}
            </ButtonLink>
          ) : null}
          {sesudah ? (
            <ButtonLink variant="outline"
              size="sm" href={`/rpkps/${id}/mingguan/${sesudah.minggu}`}>
              Minggu {sesudah.minggu}
              <ArrowRight />
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Minggu {minggu}</h1>
          {pertemuan.jenis !== "EFEKTIF" ? (
            <Badge variant="secondary">{pertemuan.jenis}</Badge>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {rpkps.mataKuliah.kode} — {rpkps.mataKuliah.nama}
        </p>
      </header>

      {pertemuan.jenis !== "EFEKTIF" ? (
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Sub-CPMK yang diuji {pertemuan.jenis} diambil dari{" "}
            <Tautan href={`/rpkps/${id}/kisi-kisi`}>kisi-kisi</Tautan>, bukan
            dari daftar di bawah — porsinya mengikuti skor butir. Yang penting
            diisi di halaman ini adalah bobot dan komponen nilainya, supaya
            bobot ujian tidak menggantung di luar komponen mana pun.
          </p>
        </div>
      ) : null}

      {bisaSunting ? (
        <EditorPertemuan
          pertemuanId={pertemuan.id}
          rpkpsId={id}
          minggu={minggu}
          pagu={pagu}
          toleransiPersen={kebijakan.toleransiPertemuanPersen}
          subCpmkTersedia={subCpmkTersedia}
          komponenTersedia={rpkps.komponenNilai.map((k) => ({
            id: k.id,
            nama: k.nama,
            bobot: Number(k.bobot),
          }))}
          pustakaTersedia={rpkps.pustaka.map((p) => ({
            id: p.id,
            nomor: p.nomor,
            jenis: p.jenis,
            teks: p.teks,
          }))}
          awal={{
            topik: pertemuan.topik,
            subtopik: pertemuan.subtopik,
            metodeNarasi: pertemuan.metodeNarasi,
            aktivitasDosen: pertemuan.aktivitasDosen,
            aktivitasMahasiswa: pertemuan.aktivitasMahasiswa,
            tugasTerstruktur: pertemuan.tugasTerstruktur,
            penilaianJenis: pertemuan.penilaianJenis,
            penilaianSistem: pertemuan.penilaianSistem,
            bobot: Number(pertemuan.bobot),
            komponenNilaiId: komponenUsulan,
            subCpmkId: pertemuan.subCpmk.map((s) => s.subCpmkId),
            indikator: pertemuan.indikator.map((i) => i.teks),
            aktivitas: pertemuan.aktivitas.map((a) => ({
              nama: a.nama,
              kategori: a.kategori,
              menit: a.menit,
            })),
            pustakaId: pertemuan.pustaka.map((p) => p.pustakaId),
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
