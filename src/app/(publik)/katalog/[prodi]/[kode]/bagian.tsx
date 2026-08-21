import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMenit } from "@/domain/beban-belajar/kalkulator";
import { petaSubCpmk, pustakaPerJenis, type DokumenPublik } from "@/domain/rpkps/publik";
import { cn } from "@/lib/utils";

/**
 * Bagian-bagian dokumen publik, mengikuti urutan baca — bukan urutan cetak.
 *
 * Template ITTS menaruh tabel mingguan paling belakang karena format kertas
 * menuntutnya (halaman mendatar tersendiri). Di layar, itu justru yang paling
 * dicari, jadi urutannya dinaikkan. Isinya sama persis dengan DOCX.
 */

const LABEL_JENIS_PUSTAKA: Record<string, string> = {
  UTAMA: "Pustaka utama",
  PENDUKUNG: "Pustaka pendukung",
  DARING: "Sumber daring",
  TOOLS: "Perkakas",
};

const LABEL_KATEGORI: Record<string, string> = {
  TM: "Tatap muka",
  PT: "Tugas terstruktur",
  BM: "Belajar mandiri",
};

const LABEL_JENIS_PERTEMUAN: Record<string, string> = {
  EFEKTIF: "Pertemuan efektif",
  UTS: "Ujian Tengah Semester",
  UAS: "Ujian Akhir Semester",
};

/** Kerangka satu bagian: judul berjangkar, garis pemisah, isi. */
export function Bagian({
  id,
  judul,
  keterangan,
  children,
}: {
  id: string;
  judul: string;
  keterangan?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
          {judul}
        </h2>
        {keterangan ? (
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {keterangan}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("panel rounded-xl border bg-card p-5", className)}>
      {children}
    </div>
  );
}

/* ── Deskripsi ────────────────────────────────────────────────────────── */

export function BagianDeskripsi({ dok }: { dok: DokumenPublik }) {
  return (
    <Panel>
      {dok.deskripsi ? (
        <div className="space-y-3 leading-relaxed text-pretty">
          {dok.deskripsi.split(/\n{2,}/).map((paragraf, i) => (
            <p key={i}>{paragraf}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Deskripsi mata kuliah belum diisi pada dokumen ini.
        </p>
      )}
    </Panel>
  );
}

/* ── Capaian pembelajaran ─────────────────────────────────────────────── */

export function BagianCapaian({ dok }: { dok: DokumenPublik }) {
  return (
    <div className="space-y-4">
      <Panel>
        <h3 className="label-teknis mb-3 text-muted-foreground/80">
          Capaian Pembelajaran Lulusan yang dibebankan
        </h3>
        <ul className="space-y-3">
          {dok.cpl.map((c) => (
            <li key={c.kode} className="flex gap-3">
              <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-[10px]">
                {c.kode}
              </Badge>
              <p className="text-sm leading-relaxed text-pretty">{c.deskripsi}</p>
            </li>
          ))}
          {dok.cpl.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Belum ada CPL yang dipetakan ke mata kuliah ini.
            </li>
          ) : null}
        </ul>
      </Panel>

      <Panel>
        <h3 className="label-teknis mb-1 text-muted-foreground/80">
          Capaian Pembelajaran Mata Kuliah
        </h3>
        {dok.kalimatPembukaCpmk ? (
          <p className="mb-4 text-sm text-muted-foreground">
            {dok.kalimatPembukaCpmk}
          </p>
        ) : null}

        <ol className="space-y-5">
          {dok.cpmk.map((c) => (
            <li key={c.kode}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-semibold text-cahaya">
                  {c.kode}
                </span>
                {c.levelBloom ? (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {c.levelBloom}
                  </Badge>
                ) : null}
                {c.cpl.map((kode) => (
                  <Badge key={kode} variant="ghost" className="font-mono text-[10px]">
                    {kode}
                  </Badge>
                ))}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-pretty">{c.rumusan}</p>

              {c.subCpmk.length > 0 ? (
                <ul className="mt-3 space-y-2 border-l border-border pl-4">
                  {c.subCpmk.map((s) => (
                    <li key={s.kode} className="text-sm">
                      <span className="font-mono text-xs font-medium text-muted-foreground">
                        {s.kode}
                      </span>
                      {s.levelBloom ? (
                        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/70">
                          {s.levelBloom}
                        </span>
                      ) : null}
                      <p className="mt-0.5 leading-relaxed text-pretty">{s.rumusan}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

/* ── Rencana mingguan ─────────────────────────────────────────────────── */

function totalMenit(p: DokumenPublik["pertemuan"][number]) {
  return p.aktivitas.reduce((s, a) => s + a.menit, 0);
}

function menitPerKategori(p: DokumenPublik["pertemuan"][number]) {
  const peta = new Map<string, number>();
  for (const a of p.aktivitas) {
    peta.set(a.kategori, (peta.get(a.kategori) ?? 0) + a.menit);
  }
  return [...peta.entries()];
}

export function BagianMingguan({ dok }: { dok: DokumenPublik }) {
  const peta = petaSubCpmk(dok);
  const totalBobot = dok.pertemuan.reduce((s, p) => s + p.bobot, 0);

  return (
    <div className="space-y-4">
      {/* Layar lebar: tabel tujuh kolom seperti template ITTS. */}
      <div className="panel hidden overflow-hidden rounded-xl border bg-card lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <caption className="sr-only">
              Rencana pembelajaran mingguan: Sub-CPMK, topik, metode, alokasi
              waktu, penilaian, dan referensi untuk tiap minggu.
            </caption>
            <thead>
              <tr className="border-b bg-muted/40">
                <Th className="w-12">Mg</Th>
                <Th className="min-w-36">Sub-CPMK</Th>
                <Th className="min-w-44">Topik & subtopik</Th>
                <Th className="min-w-48">Metode & aktivitas</Th>
                <Th className="min-w-32">Alokasi waktu</Th>
                <Th className="min-w-40">Penilaian</Th>
                <Th className="w-14 text-right">Bobot</Th>
                <Th className="w-16">Ref.</Th>
              </tr>
            </thead>
            <tbody>
              {dok.pertemuan.map((p) => {
                const ujian = p.jenis !== "EFEKTIF";
                return (
                  <tr
                    key={p.minggu}
                    className={cn(
                      "border-b align-top last:border-0",
                      ujian && "bg-cahaya/6",
                    )}
                  >
                    <Td className="font-mono font-semibold tabular-nums">
                      {p.minggu}
                      {ujian ? (
                        <span className="mt-1 block font-mono text-[10px] font-normal text-cahaya">
                          {p.jenis}
                        </span>
                      ) : null}
                    </Td>

                    <Td>
                      <ul className="space-y-1.5">
                        {p.subCpmk.map((kode) => (
                          <li key={kode}>
                            <span className="font-mono text-xs font-medium text-muted-foreground">
                              {kode}
                            </span>
                            {peta.get(kode) ? (
                              <p className="mt-0.5 text-[13px] leading-snug">
                                {peta.get(kode)!.rumusan}
                              </p>
                            ) : null}
                          </li>
                        ))}
                        {p.subCpmk.length === 0 ? <Kosong /> : null}
                      </ul>
                    </Td>

                    <Td>
                      {p.topik ? <p className="font-medium">{p.topik}</p> : <Kosong />}
                      {p.subtopik.length > 0 ? (
                        <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[13px] leading-snug text-muted-foreground">
                          {p.subtopik.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      ) : null}
                    </Td>

                    <Td className="text-[13px] leading-relaxed">
                      {p.metodeNarasi ? <p>{p.metodeNarasi}</p> : null}
                      {p.aktivitasDosen ? (
                        <p className="mt-1.5">
                          <span className="font-medium">Dosen: </span>
                          {p.aktivitasDosen}
                        </p>
                      ) : null}
                      {p.aktivitasMahasiswa ? (
                        <p className="mt-1">
                          <span className="font-medium">Mahasiswa: </span>
                          {p.aktivitasMahasiswa}
                        </p>
                      ) : null}
                      {p.tugasTerstruktur ? (
                        <p className="mt-1">
                          <span className="font-medium">Tugas: </span>
                          {p.tugasTerstruktur}
                        </p>
                      ) : null}
                      {!p.metodeNarasi && !p.aktivitasDosen && !p.aktivitasMahasiswa ? (
                        <Kosong />
                      ) : null}
                    </Td>

                    <Td>
                      <AlokasiWaktu pertemuan={p} />
                    </Td>

                    <Td className="text-[13px] leading-relaxed">
                      {p.penilaianJenis ? (
                        <p className="font-medium">{p.penilaianJenis}</p>
                      ) : null}
                      {p.penilaianSistem ? (
                        <p className="text-muted-foreground">{p.penilaianSistem}</p>
                      ) : null}
                      {p.indikator.length > 0 ? (
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
                          {p.indikator.map((i, n) => (
                            <li key={n}>{i}</li>
                          ))}
                        </ul>
                      ) : null}
                      {!p.penilaianJenis && !p.penilaianSistem && p.indikator.length === 0 ? (
                        <Kosong />
                      ) : null}
                    </Td>

                    <Td className="text-right font-mono tabular-nums">
                      {p.bobot > 0 ? `${p.bobot}%` : "—"}
                    </Td>

                    <Td className="font-mono text-xs tabular-nums text-muted-foreground">
                      {p.pustaka.length > 0 ? p.pustaka.join(", ") : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/40">
                <Td colSpan={6} className="text-right font-medium">
                  Total bobot penilaian mingguan
                </Td>
                <Td className="text-right font-mono font-semibold tabular-nums">
                  {Math.round(totalBobot * 100) / 100}%
                </Td>
                <Td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Ponsel dan tablet: satu kartu per minggu. Tabel delapan kolom tidak
          terbaca di bawah 1024px, dan menggulirnya mendatar membuat orang
          kehilangan konteks baris di tengah gulir. */}
      <div className="space-y-3 lg:hidden">
        {dok.pertemuan.map((p) => {
          const ujian = p.jenis !== "EFEKTIF";
          return (
            <div
              key={p.minggu}
              className={cn(
                "panel rounded-xl border bg-card p-4",
                ujian && "border-l-2 border-l-cahaya",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  Minggu {p.minggu}
                </Badge>
                {ujian ? (
                  <Badge variant="default" className="font-mono text-[10px]">
                    {LABEL_JENIS_PERTEMUAN[p.jenis] ?? p.jenis}
                  </Badge>
                ) : null}
                {p.bobot > 0 ? (
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                    bobot {p.bobot}%
                  </span>
                ) : null}
              </div>

              {p.topik ? (
                <h3 className="mt-2.5 font-heading text-base font-semibold text-balance">
                  {p.topik}
                </h3>
              ) : null}

              {p.subtopik.length > 0 ? (
                <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-sm text-muted-foreground">
                  {p.subtopik.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              ) : null}

              {p.subCpmk.length > 0 ? (
                <div className="mt-3">
                  <p className="label-teknis mb-1.5 text-muted-foreground/70">
                    Sub-CPMK
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    {p.subCpmk.map((kode) => (
                      <li key={kode}>
                        <span className="font-mono text-xs text-muted-foreground">
                          {kode}
                        </span>
                        {peta.get(kode) ? (
                          <p className="leading-snug">{peta.get(kode)!.rumusan}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {p.metodeNarasi ? (
                <div className="mt-3">
                  <p className="label-teknis mb-1 text-muted-foreground/70">Metode</p>
                  <p className="text-sm leading-relaxed">{p.metodeNarasi}</p>
                </div>
              ) : null}

              <div className="mt-3">
                <p className="label-teknis mb-1.5 text-muted-foreground/70">
                  Alokasi waktu
                </p>
                <AlokasiWaktu pertemuan={p} />
              </div>

              {p.penilaianJenis || p.indikator.length > 0 ? (
                <div className="mt-3">
                  <p className="label-teknis mb-1 text-muted-foreground/70">
                    Penilaian
                  </p>
                  {p.penilaianJenis ? (
                    <p className="text-sm font-medium">{p.penilaianJenis}</p>
                  ) : null}
                  {p.penilaianSistem ? (
                    <p className="text-sm text-muted-foreground">{p.penilaianSistem}</p>
                  ) : null}
                  {p.indikator.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                      {p.indikator.map((i, n) => (
                        <li key={n}>{i}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Rincian menit per kategori beban. Angkanya penting: inilah yang menjaga
 * invarian 45 jam per sks per semester, dan pembaca luar berhak memeriksanya.
 */
function AlokasiWaktu({
  pertemuan,
}: {
  pertemuan: DokumenPublik["pertemuan"][number];
}) {
  const total = totalMenit(pertemuan);
  if (total === 0) return <Kosong />;

  return (
    <div>
      <p className="font-mono text-sm font-medium tabular-nums">
        {formatMenit(total)}
      </p>
      <ul className="mt-1 space-y-0.5">
        {menitPerKategori(pertemuan).map(([kategori, menit]) => (
          <li
            key={kategori}
            className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
          >
            <span>{LABEL_KATEGORI[kategori] ?? kategori}</span>
            <span className="font-mono tabular-nums">{menit}′</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Rencana tugas ────────────────────────────────────────────────────── */

export function BagianTugas({ dok }: { dok: DokumenPublik }) {
  return (
    <div className="space-y-4">
      {dok.tugas.map((t) => (
        <Panel key={t.nomor}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              Tugas {t.nomor}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {t.jenis === "KELOMPOK" ? "Kelompok" : "Individu"}
            </Badge>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              Minggu {t.mingguMulai}
              {t.mingguSelesai !== t.mingguMulai ? `–${t.mingguSelesai}` : ""}
            </span>
            <span className="ml-auto font-mono text-sm font-semibold tabular-nums">
              {t.bobot}%
            </span>
          </div>

          <h3 className="mt-2.5 font-heading text-lg font-semibold text-balance">
            {t.nama}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-pretty">{t.deskripsi}</p>

          {t.subCpmk.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.subCpmk.map((kode) => (
                <Badge key={kode} variant="ghost" className="font-mono text-[10px]">
                  {kode}
                </Badge>
              ))}
            </div>
          ) : null}

          {t.uraianTugas ? (
            <Rincian judul="Uraian tugas" isi={t.uraianTugas} />
          ) : null}
          {t.formatLuaran ? (
            <Rincian judul="Format luaran" isi={t.formatLuaran} />
          ) : null}
          {t.ketentuanLain ? (
            <Rincian judul="Ketentuan lain" isi={t.ketentuanLain} />
          ) : null}

          {t.linimasa.length > 0 ? (
            <div className="mt-4">
              <p className="label-teknis mb-2 text-muted-foreground/70">Linimasa</p>
              <ol className="space-y-2 border-l border-border pl-4">
                {t.linimasa.map((l, i) => (
                  <li key={i} className="relative text-sm">
                    <span
                      aria-hidden
                      className="absolute -left-[1.3125rem] top-1.5 size-1.5 rounded-full bg-cahaya"
                    />
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      Minggu {l.minggu}
                    </span>
                    <p className="font-medium">{l.tahapan}</p>
                    <p className="text-muted-foreground text-pretty">{l.aktivitas}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {t.kriteria.length > 0 ? (
            <div className="mt-4">
              <p className="label-teknis mb-2 text-muted-foreground/70">
                Kriteria penilaian
              </p>
              <ul className="space-y-2.5">
                {t.kriteria.map((k) => (
                  <li key={k.nomor} className="border-b pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{k.indikator}</p>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {k.bobot}%
                      </span>
                    </div>
                    {k.rincian.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                        {k.rincian.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      ))}
    </div>
  );
}

function Rincian({ judul, isi }: { judul: string; isi: string }) {
  return (
    <div className="mt-3">
      <p className="label-teknis mb-1 text-muted-foreground/70">{judul}</p>
      <div className="space-y-1.5 text-sm leading-relaxed text-pretty">
        {isi.split(/\n+/).map((baris, i) => (
          <p key={i}>{baris}</p>
        ))}
      </div>
    </div>
  );
}

/* ── Penilaian ────────────────────────────────────────────────────────── */

export function BagianPenilaian({ dok }: { dok: DokumenPublik }) {
  const total = dok.komponenNilai.reduce((s, k) => s + k.bobot, 0);
  const terbesar = Math.max(1, ...dok.komponenNilai.map((k) => k.bobot));

  return (
    <div className="space-y-4">
      <Panel>
        <h3 className="label-teknis mb-4 text-muted-foreground/80">
          Komponen nilai
        </h3>
        <ul className="space-y-3">
          {dok.komponenNilai.map((k) => (
            <li key={k.nama}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{k.nama}</span>
                <span className="shrink-0 font-mono text-sm tabular-nums">
                  {k.bobot}%
                </span>
              </div>
              {/* Batang bobot: proporsional terhadap komponen TERBESAR, bukan
                  terhadap 100 — supaya perbedaan 10% dan 15% tetap terbaca. */}
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-cahaya"
                  style={{ width: `${(k.bobot / terbesar) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t pt-3">
          <span className="text-sm font-medium">Total</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {Math.round(total * 100) / 100}%
          </span>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Ambang
          label="Ambang kelulusan"
          nilai={`${dok.ambangKelulusanMhs}`}
          satuan="nilai akhir"
          keterangan="Nilai minimum agar mahasiswa dinyatakan lulus mata kuliah ini."
        />
        <Ambang
          label="Ketercapaian MK"
          nilai={`${dok.ambangKetercapaianMk}`}
          satuan="persen"
          keterangan="Ambang persentase mahasiswa yang mencapai CPMK agar mata kuliah dinilai berhasil."
        />
        <Ambang
          label="Kehadiran minimal"
          nilai={`${dok.minimalKehadiranPersen}`}
          satuan="persen"
          keterangan="Syarat kehadiran untuk dapat mengikuti penilaian akhir."
        />
      </div>
    </div>
  );
}

function Ambang({
  label,
  nilai,
  satuan,
  keterangan,
}: {
  label: string;
  nilai: string;
  satuan: string;
  keterangan: string;
}) {
  return (
    <div className="panel rounded-xl border bg-card p-4">
      <p className="label-teknis text-muted-foreground/80">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
        {nilai}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {satuan}
        </span>
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground text-pretty">
        {keterangan}
      </p>
    </div>
  );
}

/* ── Pustaka dan pengampu ─────────────────────────────────────────────── */

export function BagianPustaka({ dok }: { dok: DokumenPublik }) {
  const kelompok = pustakaPerJenis(dok);

  if (kelompok.length === 0) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground">
          Belum ada pustaka yang dicantumkan pada dokumen ini.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {kelompok.map(([jenis, daftar]) => (
        <Panel key={jenis}>
          <h3 className="label-teknis mb-3 text-muted-foreground/80">
            {LABEL_JENIS_PUSTAKA[jenis] ?? jenis}
          </h3>
          <ol className="space-y-2.5">
            {daftar.map((p) => (
              <li key={`${jenis}-${p.nomor}`} className="flex gap-2.5 text-sm">
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  [{p.nomor}]
                </span>
                <span className="min-w-0 leading-relaxed text-pretty">
                  {p.teks}
                  {p.url ? (
                    <a
                      href={p.url}
                      rel="nofollow noopener"
                      className="ml-1.5 inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      tautan
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      ))}
    </div>
  );
}

export function BagianPengampu({ dok }: { dok: DokumenPublik }) {
  return (
    <Panel>
      <ul className="space-y-3">
        {dok.pengampu.map((p, i) => (
          <li key={`${p.nama}-${i}`} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{p.nama}</span>
            {p.nidn ? (
              <span className="font-mono text-xs text-muted-foreground">
                NIDN {p.nidn}
              </span>
            ) : null}
            {p.peran === "KOORDINATOR" ? (
              <Badge variant="secondary" className="text-[10px]">
                Koordinator
              </Badge>
            ) : null}
          </li>
        ))}
        {dok.pengampu.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            Tim pengampu belum dicantumkan.
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}

/* ── Utilitas tabel ───────────────────────────────────────────────────── */

function Th({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "label-teknis px-3 py-2.5 text-left align-bottom text-muted-foreground/80",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  className,
  colSpan,
  children,
}: {
  className?: string;
  colSpan?: number;
  children?: React.ReactNode;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-3", className)}>
      {children}
    </td>
  );
}

function Kosong() {
  return <span className="text-muted-foreground/50">—</span>;
}
