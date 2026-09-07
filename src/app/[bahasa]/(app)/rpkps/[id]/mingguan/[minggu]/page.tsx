import { notFound } from "next/navigation";
import { Tautan } from "@/components/tautan";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { isi, namaMk, pilihTeks } from "@/lib/bahasa/teks";
import { ArrowLeft, ArrowRight, ListChecks, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { wajibAktif } from "@/lib/otorisasi";
import { wenangAtasRpkps } from "@/lib/rpkps/wenang";
import { PratinjauSamping } from "../../pratinjau/samping";
import { muatKebijakan, muatRpkps } from "@/lib/rpkps/muat";
import { susunRencanaSemester } from "@/domain/beban-belajar/kalkulator";
import { EditorPertemuan } from "./editor";
import { PilihJenisPertemuan } from "../tombol";

function TautanDalamKalimat({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Tautan href={href} className="underline underline-offset-2 hover:text-foreground">
      {children}
    </Tautan>
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

  const bisaSunting =
    wenang.boleh && (rpkps.status === "DRAF" || rpkps.status === "DIREVISI");
  const sebelum = rpkps.pertemuan.filter((p) => p.minggu < minggu).at(-1);
  const sesudah = rpkps.pertemuan.find((p) => p.minggu > minggu);

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

  const k = await kamus();

  return (
    <PratinjauSamping rpkps={rpkps} jangkar={`naskah-minggu-${minggu}`}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ButtonLink variant="ghost" size="sm" href={`/rpkps/${id}/mingguan`}>
            <ArrowLeft />
            {k.rpkps.mingguDetail.kembali}
          </ButtonLink>
          <div className="flex gap-1">
            {sebelum ? (
              <ButtonLink variant="outline"
                size="sm" href={`/rpkps/${id}/mingguan/${sebelum.minggu}`}>
                <ArrowLeft />
                {isi(k.rpkps.mingguDetail.minggu, { nomor: sebelum.minggu })}
              </ButtonLink>
            ) : null}
            {sesudah ? (
              <ButtonLink variant="outline"
                size="sm" href={`/rpkps/${id}/mingguan/${sesudah.minggu}`}>
                {isi(k.rpkps.mingguDetail.minggu, { nomor: sesudah.minggu })}
                <ArrowRight />
              </ButtonLink>
            ) : null}
          </div>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {isi(k.rpkps.mingguDetail.minggu, { nomor: minggu })}
              </h1>
              {pertemuan.jenis !== "EFEKTIF" ? (
                <Badge variant="secondary">{pertemuan.jenis}</Badge>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {rpkps.mataKuliah.kode} — {namaMk(rpkps.mataKuliah, b)}
            </p>
          </div>
          {bisaSunting ? (
            <PilihJenisPertemuan
              rpkpsId={id}
              minggu={minggu}
              jenis={pertemuan.jenis}
            />
          ) : null}
        </header>

        {pertemuan.jenis !== "EFEKTIF" ? (
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-4 text-sm">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              {isi(k.rpkps.mingguDetail.ujianAwal, { jenis: pertemuan.jenis })}{" "}
              <TautanDalamKalimat href={`/rpkps/${id}/kisi-kisi`}>
                {k.rpkps.mingguDetail.ujianTautan}
              </TautanDalamKalimat>
              {k.rpkps.mingguDetail.ujianAkhir}
            </p>
          </div>
        ) : null}

        {bisaSunting ? (
          <EditorPertemuan
            pertemuanId={pertemuan.id}
            capVersi={pertemuan.diubahPada.toISOString()}
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
              topikEn: pertemuan.topikEn,
              subtopik: pertemuan.subtopik,
              subtopikEn: pertemuan.subtopikEn,
              metodeNarasi: pertemuan.metodeNarasi,
              metodeNarasiEn: pertemuan.metodeNarasiEn,
              aktivitasDosen: pertemuan.aktivitasDosen,
              aktivitasDosenEn: pertemuan.aktivitasDosenEn,
              aktivitasMahasiswa: pertemuan.aktivitasMahasiswa,
              aktivitasMahasiswaEn: pertemuan.aktivitasMahasiswaEn,
              tugasTerstruktur: pertemuan.tugasTerstruktur,
              tugasTerstrukturEn: pertemuan.tugasTerstrukturEn,
              penilaianJenis: pertemuan.penilaianJenis,
              penilaianJenisEn: pertemuan.penilaianJenisEn,
              penilaianSistem: pertemuan.penilaianSistem,
              penilaianSistemEn: pertemuan.penilaianSistemEn,
              bobot: Number(pertemuan.bobot),
              komponenNilaiId: komponenUsulan,
              subCpmkId: pertemuan.subCpmk.map((s) => s.subCpmkId),
              indikator: pertemuan.indikator.map((i) => ({ teks: i.teks, teksEn: i.teksEn })),
              aktivitas: pertemuan.aktivitas.map((a) => ({
                nama: a.nama,
                namaEn: a.namaEn,
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
              {k.rpkps.terkunciSunting}
            </p>
          </div>
        )}
      </div>
    </PratinjauSamping>
  );
}
