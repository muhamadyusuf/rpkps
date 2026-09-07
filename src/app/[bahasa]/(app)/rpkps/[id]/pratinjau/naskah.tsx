import { formatMenit } from "@/domain/beban-belajar/kalkulator";
import { keSumberPeta } from "@/domain/evaluasi/pemetaan";
import { petaKomponenSubCpmk, susunPetaAsesmen } from "@/domain/evaluasi/peta-asesmen";
import { namaLengkapPengampu } from "@/domain/rpkps/pemetaan";
import { rantaiPengesahan, type PeranPengesah } from "@/domain/rpkps/paraf";
import {
  jumlahPertemuanEfektif,
  minimalKehadiran,
  skalaNilai,
} from "@/domain/rpkps/cetak";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { tanggal as tanggalTeks } from "@/lib/bahasa/format";
import { isi as sisip } from "@/lib/bahasa/teks";
import type { CapTandaTangan } from "@/lib/dokumen/rpkps-docx";
import type { LabelDokumen } from "@/lib/dokumen/label";
import type { RpkpsLengkap } from "@/lib/rpkps/muat";
import { LOCALE, type Bahasa } from "@/kamus";

/**
 * Naskah RPKPS sebagaimana ia TERCETAK — lembar demi lembar, di layar.
 *
 * Ini bukan halaman web tentang sebuah RPKPS; itu sudah ada di katalog publik,
 * dengan tata letak yang sengaja dibuat enak dibaca di layar. Yang ini
 * sebaliknya: kertas A4, Arial 9pt, margin 1,5 cm, tabel bergaris — supaya
 * pertanyaan "nanti hasil unduhannya seperti apa" terjawab tanpa mengunduh,
 * membuka Word, lalu mengulanginya tiap kali satu baris disunting.
 *
 * Susunannya MENGIKUTI `rpkps-docx.ts` bagian per bagian, termasuk pemisahan
 * lembarnya: satu lembar per `section` DOCX, ditambah satu pemisah halaman
 * antara Halaman Pengesahan dan bagian A. Tabel mingguan mendatar, karena di
 * berkasnya pun begitu.
 *
 * Yang tidak ditiru hanyalah PENJILIDANNYA: peramban tidak dapat memberi tahu
 * di baris mana Word akan memotong halaman, jadi lembar di sini tumbuh ke bawah
 * sejauh isinya. Saat dicetak (dan itulah cara membuat PDF-nya), aturan
 * `@media print` melepas bayangan dan jarak antarlembar, dan pemotongan halaman
 * diserahkan kepada peramban.
 *
 * Angka yang dihitung — skala nilai, ambang kehadiran, centang distribusi
 * penilaian — datang dari fungsi yang SAMA dengan yang dipakai pencetak
 * (`@/domain/rpkps/cetak`, `susunPetaAsesmen`). Menghitungnya ulang di sini
 * berarti pratinjau yang perlahan menyimpang dari berkasnya, tanpa gejala.
 */

/* ── Ukuran kertas, disalin dari `buatDokumenRpkps` ───────────────────── */

const POTRET = { lebar: "21cm", tinggi: "29.7cm", margin: "1.5cm" };
const MENDATAR = { lebar: "29.7cm", tinggi: "21cm", margin: "1.23cm" };

const GARIS = "#9CA3AF";
const ABU = "#F3F4F6";
const REDUP = "#6B7280";

export function NaskahRpkps({
  r,
  L,
  ttd,
  riwayat,
  sidik,
  bahasa,
}: {
  r: RpkpsLengkap;
  L: LabelDokumen;
  ttd: readonly CapTandaTangan[];
  riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
  /** Sidik salinan beku; null berarti yang dipratinjau draf. */
  sidik: string | null;
  bahasa: Bahasa;
}) {
  return (
    <div className="naskah space-y-6">
      <Lembar r={r} L={L}>
        <HalamanPengesahan r={r} L={L} ttd={ttd} sidik={sidik} bahasa={bahasa} />
      </Lembar>

      <Lembar r={r} L={L}>
        <BagianAwal r={r} L={L} />
        <BagianEvaluasi r={r} L={L} />
        <BagianReferensi r={r} L={L} />
      </Lembar>

      <Lembar r={r} L={L} mendatar>
        <TabelMingguan r={r} L={L} />
      </Lembar>

      {r.tugas.length > 0 || r.kisiKisi.length > 0 || riwayat.length > 0 ? (
        <Lembar r={r} L={L}>
          <BagianTugas r={r} L={L} />
          <LampiranKisiKisi r={r} L={L} />
          <BagianRiwayat r={r} L={L} riwayat={riwayat} bahasa={bahasa} />
        </Lembar>
      ) : null}
    </div>
  );
}

/* ── Kerangka lembar ──────────────────────────────────────────────────── */

/**
 * Satu lembar kertas, lengkap dengan kepala dan kaki halamannya.
 *
 * Lebarnya tetap dalam SENTIMETER, bukan persen: yang sedang ditiru adalah
 * kertas, dan lembar yang ikut melebar mengikuti jendela berhenti menjawab
 * pertanyaan "muat berapa kolom". Layar yang lebih sempit menggulung
 * mendatar — itu pun sama seperti membuka berkasnya.
 */
function Lembar({
  r,
  L,
  mendatar = false,
  children,
}: {
  r: RpkpsLengkap;
  L: LabelDokumen;
  mendatar?: boolean;
  children: React.ReactNode;
}) {
  const k = mendatar ? MENDATAR : POTRET;
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <div
        data-lembar={mendatar ? "mendatar" : "potret"}
        className="lembar mx-auto flex flex-col bg-white text-black shadow-angkat-lg print:shadow-none"
        style={{
          width: k.lebar,
          minHeight: k.tinggi,
          padding: k.margin,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "9pt",
          lineHeight: 1.35,
        }}
      >
        <header
          className="mb-3 shrink-0"
          style={{ fontSize: "7pt", color: REDUP, lineHeight: 1.3 }}
        >
          <p>{L.kodeDokumenFormRpkps}</p>
          <p>
            {L.kepalaRencanaPembelajaran}
            {r.mataKuliah.nama}
          </p>
        </header>

        <div className="grow">{children}</div>

        <footer
          className="mt-4 shrink-0 text-center"
          style={{ fontSize: "7pt", color: REDUP }}
        >
          {kakiHalaman(r, L)}
        </footer>
      </div>
    </div>
  );
}

function kakiHalaman(r: RpkpsLengkap, L: LabelDokumen): string {
  const [tahun, semester] = r.tahunAkademik.kode.split("-");
  const namaSemester =
    semester === "GANJIL"
      ? L.excel.semesterGanjil
      : semester === "GENAP"
        ? L.excel.semesterGenap
        : L.excel.semesterAntara;
  return sisip(L.excel.kakiHalaman, {
    prodi: r.mataKuliah.kurikulum.prodi.nama,
    semester: namaSemester,
    tahun: tahun ?? "",
  });
}

/* ── Potongan tipografi ───────────────────────────────────────────────── */

/**
 * Paragraf berlabel: label tebal lalu isinya, persis seperti `paragraf([teks(L.x,
 * {tebal}), teks(nilai)])` di DOCX. `pre-wrap` dipertahankan karena beberapa
 * label memuat tabulasi yang membentuk kolomnya (`"KODE MK / SKS\t: "`).
 */
function PLabel({ label, nilai }: { label: string; nilai: string }) {
  return (
    <p style={{ whiteSpace: "pre-wrap" }}>
      <b>{label}</b>
      {nilai}
    </p>
  );
}

function JudulBagian({ nomor, judul }: { nomor: string; judul: string }) {
  return (
    <p className="mt-4 mb-1.5 font-bold" style={{ fontSize: "11pt" }}>
      {nomor}. {judul}
    </p>
  );
}

/** Padanan `baris()`: satu paragraf per baris, rata kiri-kanan, kosong dibuang. */
function Baris({ teks, rata = true }: { teks: string | null; rata?: boolean }) {
  if (!teks?.trim()) return null;
  return (
    <>
      {teks
        .split(/\r?\n/)
        .filter((b) => b.trim() !== "")
        .map((b, i) => (
          <p key={i} className={rata ? "text-justify" : undefined}>
            {b.trim()}
          </p>
        ))}
    </>
  );
}

function DaftarBernomor({ butir, rata = true }: { butir: string[]; rata?: boolean }) {
  return (
    <>
      {butir.map((t, i) => (
        <p key={i} className={rata ? "text-justify" : undefined} style={{ paddingLeft: "0.2cm" }}>
          {i + 1}. {t}
        </p>
      ))}
    </>
  );
}

function Miring({ children }: { children: React.ReactNode }) {
  return <p className="italic">{children}</p>;
}

function Tabel({ children }: { children: React.ReactNode }) {
  return (
    <table
      className="mt-1 w-full table-fixed border-collapse"
      style={{ border: `1px solid ${GARIS}` }}
    >
      {children}
    </table>
  );
}

function Sel({
  kepala = false,
  lebar,
  tengah = false,
  kanan = false,
  tebal = false,
  span,
  rowSpan,
  children,
}: {
  kepala?: boolean;
  lebar?: number;
  tengah?: boolean;
  kanan?: boolean;
  tebal?: boolean;
  span?: number;
  rowSpan?: number;
  children?: React.ReactNode;
}) {
  const Tag = kepala ? "th" : "td";
  return (
    <Tag
      colSpan={span}
      rowSpan={rowSpan}
      scope={kepala ? "col" : undefined}
      style={{
        border: `1px solid ${GARIS}`,
        background: kepala || tebal ? ABU : undefined,
        width: lebar ? `${lebar}%` : undefined,
        padding: "2pt 4pt",
        textAlign: tengah ? "center" : kanan ? "right" : "left",
        fontWeight: kepala || tebal ? 700 : 400,
        verticalAlign: "top",
      }}
    >
      {children}
    </Tag>
  );
}

/* ── Halaman pengesahan ───────────────────────────────────────────────── */

function HalamanPengesahan({
  r,
  L,
  ttd,
  sidik,
  bahasa,
}: {
  r: RpkpsLengkap;
  L: LabelDokumen;
  ttd: readonly CapTandaTangan[];
  sidik: string | null;
  bahasa: Bahasa;
}) {
  const koordinator = r.pengampu.find((p) => p.peran === "KOORDINATOR") ?? r.pengampu[0];
  const hari = (d: Date) => tanggalTeks(d, bahasa, "panjang");

  /*
   * Urutan ketiga blok datang dari `rantaiPengesahan`, bukan dari urutan
   * penulisan di sini — alasan yang sama dengan di pencetak: urutan itulah
   * yang membuat halaman terbaca sebagai rantai.
   */
  const slot = new Map(
    rantaiPengesahan(
      ttd.map((t) => ({ ...t, versi: r.versi })),
      r.versi,
    ).map((x) => [x.peran, x.cap]),
  );

  const blok = (peran: PeranPengesah, jabatan: string) => {
    const t = slot.get(peran) ?? null;
    return { cap: t, jabatan, tanggal: t ? `${L.tanggal} ${hari(t.ditandatanganiPada)}` : L.tanggal };
  };
  const tiga = [
    blok("KOORDINATOR", L.koordinatorMataKuliah),
    blok("KAPRODI", L.ketuaProgramStudi),
    blok("PENJAMINAN_MUTU", L.kepalaPenjaminanMutuInternal),
  ];

  // Template ITTS menyediakan lima baris tim dosen; yang kosong tetap tercetak.
  const barisTim = [
    ...r.pengampu.map((p) => ({
      nama: namaLengkapPengampu(p.pengguna),
      identitas: p.pengguna.nidn ?? p.pengguna.nip ?? "",
      paraf: ttd.find((t) => t.peran === "PENGAMPU" && t.penggunaId === p.penggunaId),
    })),
    ...Array.from({ length: Math.max(0, 5 - r.pengampu.length) }, () => null),
  ];

  return (
    <>
      <p className="text-center font-bold" style={{ fontSize: "12pt" }}>
        {L.rencanaProgramDanKegiatanPembelaja}
      </p>
      <p className="mb-6 text-center font-bold" style={{ fontSize: "12pt" }}>
        {L.institutTeknologiTangerangSelatan}
      </p>
      <p className="mb-5 text-center font-bold" style={{ fontSize: "11pt" }}>
        {L.halamanPengesahan}
      </p>

      <PLabel label={L.namaMataKuliah2} nilai={r.mataKuliah.nama} />
      <PLabel label={L.kodeMataKuliah} nilai={r.mataKuliah.kode} />
      <PLabel
        label={L.koordinatorMataKuliah2}
        nilai={koordinator ? namaLengkapPengampu(koordinator.pengguna) : "-"}
      />
      <p className="mt-2 mb-1" style={{ whiteSpace: "pre-wrap" }}>
        <b>{L.timDosenPengampu}</b>
      </p>

      <Tabel>
        <thead>
          <tr>
            <Sel kepala lebar={8} tengah>
              {L.no}
            </Sel>
            <Sel kepala lebar={47}>
              {L.namaDosen}
            </Sel>
            <Sel kepala lebar={25}>
              {L.nidnNipNik}
            </Sel>
            <Sel kepala lebar={20}>
              {L.tandaTangan}
            </Sel>
          </tr>
        </thead>
        <tbody>
          {barisTim.map((b, i) => (
            <tr key={i}>
              <Sel tengah>{i + 1}</Sel>
              <Sel>{b?.nama ?? " "}</Sel>
              <Sel>{b?.identitas ?? ""}</Sel>
              <Sel tengah>{b?.paraf ? hari(b.paraf.ditandatanganiPada) : ""}</Sel>
            </tr>
          ))}
        </tbody>
      </Tabel>

      <div style={{ height: "1.2cm" }} />

      <Tabel>
        <tbody>
          <tr>
            <Sel lebar={33} tebal>
              {L.aNTimPenyusunRpkps}
            </Sel>
            <Sel lebar={33} tebal>
              {L.disetujuiOleh}
            </Sel>
            <Sel lebar={34} tebal>
              {L.telahDiperiksaDanDinyatakanSesuaiD}
            </Sel>
          </tr>
          <tr>
            {tiga.map((b) => (
              <Sel key={b.jabatan}>{b.tanggal}</Sel>
            ))}
          </tr>
          {/*
            Tiga baris kosong: ruang tanda tangan pada template. Dipertahankan
            walau capnya elektronik — halaman ini masih dicetak dan diarsipkan.
          */}
          <tr>
            {tiga.map((b) => (
              <Sel key={b.jabatan}>
                <div style={{ height: "1.4cm" }} />
              </Sel>
            ))}
          </tr>
          <tr>
            {tiga.map((b) => (
              <Sel key={b.jabatan}>
                <p className="font-bold">{b.cap?.nama ?? " "}</p>
                <p>{b.jabatan}</p>
                {b.cap ? (
                  <p style={{ fontSize: "6.5pt", color: REDUP }}>
                    {L.ditandatanganiElektronik} · {sidikRingkas(b.cap.sidik)}
                  </p>
                ) : null}
              </Sel>
            ))}
          </tr>
        </tbody>
      </Tabel>

      {sidik ? (
        <p className="mt-4 text-center" style={{ fontSize: "7pt", color: REDUP }}>
          {L.dokumenIniDicetakDariSalinanResmi}
          <b>{r.versi}</b>
          {sisip(L.sidikDokumen, { sidik: sidikRingkas(sidik) })}
        </p>
      ) : null}

      {L.naskahSahIndonesia ? (
        <p className="mt-3 text-center" style={{ fontSize: "7pt", color: REDUP }}>
          {L.naskahSahIndonesia}
        </p>
      ) : null}
    </>
  );
}

/* ── Bagian A–D ───────────────────────────────────────────────────────── */

function BagianAwal({ r, L }: { r: RpkpsLengkap; L: LabelDokumen }) {
  const sks = r.mataKuliah.sksTeori + r.mataKuliah.sksPraktik;
  const topik = r.pertemuan
    .filter((p) => p.jenis === "EFEKTIF" && p.topik?.trim())
    .map((p) => p.topik!.trim());

  return (
    <>
      <p className="text-center font-bold" style={{ fontSize: "12pt" }}>
        {L.rencanaProgramDanKegiatanPembelaja}
      </p>
      <p className="mb-5 text-center font-bold" style={{ fontSize: "12pt" }}>
        {L.institutTeknologiTangerangSelatan}
      </p>

      <PLabel label={L.namaMataKuliah} nilai={r.mataKuliah.nama} />
      <PLabel
        label={L.kodeMkSks}
        nilai={`${r.mataKuliah.kode} / ${sks} (${r.mataKuliah.sksTeori}T + ${r.mataKuliah.sksPraktik}P)`}
      />
      <PLabel label={L.semester} nilai={String(r.mataKuliah.semester)} />
      <PLabel label={L.mkPrasyarat} nilai="-" />
      <PLabel
        label={L.statusMatakuliah}
        /*
          Template ITTS hanya mengenal dua nilai pada baris ini, jadi
          `WAJIB_UMUM` ikut tercetak sebagai Wajib — sama seperti di DOCX.
        */
        nilai={r.mataKuliah.status === "PILIHAN" ? L.statusMkPilihan : L.statusMkWajib}
      />

      <JudulBagian nomor="A" judul={L.deskripsiMataKuliah} />
      {r.deskripsi ? <Baris teks={r.deskripsi} /> : <Miring>{L.belumDiisi}</Miring>}

      <JudulBagian nomor="B" judul={L.capaianPembelajaran} />
      <p className="mb-1 font-bold">{L.b1CapaianPembelajaranLulusanCpl}</p>
      {r.mataKuliah.cpl.length > 0 ? <p className="mb-1">{L.tingkatKkni6}</p> : null}
      {r.mataKuliah.cpl.map((m) => (
        <p key={m.cpl.kode} className="mb-1 text-justify">
          <b>{m.cpl.kode}&nbsp;&nbsp;</b>
          {m.cpl.deskripsi}
        </p>
      ))}

      <p className="mt-3 mb-1 font-bold">{L.b2CapaianPembelajaranMataKuliah}</p>
      {r.kalimatPembukaCpmk ? <p className="text-justify">{r.kalimatPembukaCpmk}</p> : null}
      {r.mataKuliah.cpmk.map((c) => (
        <p key={c.kode} className="mb-1 text-justify">
          <b>{c.kode}&nbsp;&nbsp;</b>
          {c.rumusan}
        </p>
      ))}

      <p className="mt-3 mb-1 font-bold">{L.b3SubCapaianPembelajaranMata}</p>
      {r.mataKuliah.cpmk.map((c) => (
        <div key={c.kode} className="mb-1">
          <p className="font-bold">{c.kode}</p>
          {c.subCpmk.map((s) => (
            <p key={s.kode} className="text-justify" style={{ paddingLeft: "0.42cm" }}>
              <b>{s.kode}&nbsp;&nbsp;</b>
              {s.rumusan}
            </p>
          ))}
        </div>
      ))}

      <JudulBagian nomor="C" judul={L.analisisPembelajaran} />
      <Miring>{L.gambarTerlampir}</Miring>

      <JudulBagian nomor="D" judul={L.topikPembelajaran} />
      {topik.length > 0 ? (
        <DaftarBernomor butir={topik} />
      ) : (
        <Miring>{L.belumAdaTopik}</Miring>
      )}
    </>
  );
}

/* ── Bagian E–F ───────────────────────────────────────────────────────── */

function BagianEvaluasi({ r, L }: { r: RpkpsLengkap; L: LabelDokumen }) {
  const efektif = jumlahPertemuanEfektif(r.pertemuan);
  const minimal = minimalKehadiran(r.minimalKehadiranPersen, efektif);
  const komponen = r.komponenNilai;

  /*
   * Centang distribusi penilaian diturunkan dari PETA ASESMEN, bukan dari
   * kaitan pertemuan → komponen: Sub-CPMK yang diuji UTS/UAS tersimpan di
   * kisi-kisi, dan penurunan langsung membuat kolom ujian selalu kosong
   * (docs/02 §2.2 temuan W7).
   */
  const petaSub = petaKomponenSubCpmk(susunPetaAsesmen(keSumberPeta(r)));

  return (
    <>
      <JudulBagian nomor="E" judul={L.evaluasiPembelajaran} />
      <DaftarBernomor
        butir={[
          L.aturanKehadiran,
          sisip(L.aturanMinimalHadir, { pertemuan: efektif, minimal }),
          L.nilaiAkhirDitentukan,
        ]}
      />
      {komponen.map((k) => (
        <p key={k.id} style={{ paddingLeft: "0.85cm" }}>
          •&nbsp;&nbsp;{k.nama} : {Number(k.bobot)}%
        </p>
      ))}

      <p className="mt-3 mb-1 font-bold">{L.tabelDistribusiPenilaianCapaianPem}</p>
      <Tabel>
        <thead>
          <tr>
            <Sel kepala lebar={8} tengah>
              {L.cpl}
            </Sel>
            <Sel kepala lebar={10} tengah>
              {L.cpmk}
            </Sel>
            <Sel kepala lebar={36} tengah>
              {L.subCpmk}
            </Sel>
            {komponen.map((k) => (
              <Sel key={k.id} kepala tengah>
                {k.nama} ({Number(k.bobot)}%)
              </Sel>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.mataKuliah.cpmk.flatMap((c) => {
            const kodeCpl = c.cpl.map((x) => x.cpl.kode).join(", ");
            return c.subCpmk.map((s, i) => (
              // Kode Sub-CPMK unik per CPMK, bukan per mata kuliah — daftar
              // yang diratakan lintas CPMK harus membawa kode induknya.
              <tr key={`${c.kode}-${s.kode}`}>
                <Sel tengah>{i === 0 ? kodeCpl : ""}</Sel>
                <Sel tengah>{i === 0 ? c.kode : ""}</Sel>
                <Sel>
                  {s.kode}&nbsp;&nbsp;{s.rumusan}
                </Sel>
                {komponen.map((k) => (
                  <Sel key={k.id} tengah>
                    {petaSub.get(k.nama)?.has(s.kode) ? "√" : ""}
                  </Sel>
                ))}
              </tr>
            ));
          })}
        </tbody>
      </Tabel>

      <p className="mt-3 mb-1 font-bold">{L.penilaianAkhir}</p>
      <Tabel>
        <thead>
          <tr>
            <Sel kepala lebar={25} tengah>
              {L.rentangSkor}
            </Sel>
            <Sel kepala lebar={20} tengah>
              {L.nilaiHuruf}
            </Sel>
            <Sel kepala lebar={20} tengah>
              {L.nilaiAngka}
            </Sel>
            <Sel kepala lebar={35}>
              {L.keterangan}
            </Sel>
          </tr>
        </thead>
        <tbody>
          {skalaNilai(L.keteranganNilai).map((s) => (
            <tr key={s.huruf}>
              <Sel tengah>{s.rentang}</Sel>
              <Sel tengah>{s.huruf}</Sel>
              <Sel tengah>{s.angka}</Sel>
              <Sel>{s.keterangan}</Sel>
            </tr>
          ))}
        </tbody>
      </Tabel>

      <JudulBagian nomor="F" judul={L.ambangBatasKelulusan} />
      <PLabel
        label={L.ambangBatasKelulusanMahasiswa}
        nilai={String(Number(r.ambangKelulusanMhs))}
      />
      <PLabel
        label={L.ambangBatasKelulusanMk}
        nilai={`${Number(r.ambangKetercapaianMk).toFixed(2)}%`}
      />
    </>
  );
}

/* ── Bagian G ─────────────────────────────────────────────────────────── */

function BagianReferensi({ r, L }: { r: RpkpsLengkap; L: LabelDokumen }) {
  const jenisUrut = ["UTAMA", "PENDUKUNG", "DARING", "TOOLS"] as const;

  return (
    <>
      <JudulBagian nomor="G" judul={L.referensiDanSumberPembelajaran} />
      {r.pustaka.length === 0 ? <Miring>{L.belumAdaPustaka}</Miring> : null}
      {jenisUrut.map((jenis) => {
        const daftar = r.pustaka.filter((p) => p.jenis === jenis);
        if (daftar.length === 0) return null;
        return (
          <div key={jenis} className="mt-2">
            <p className="mb-1 font-bold">{L.jenisPustaka[jenis]} :</p>
            {daftar.map((p) => (
              <p key={p.id} className="text-justify" style={{ paddingLeft: "0.42cm" }}>
                {p.nomor}. {p.teks}
                {p.url ? ` — ${p.url}` : ""}
              </p>
            ))}
          </div>
        );
      })}
    </>
  );
}

/* ── Bagian H — tabel mingguan tujuh kolom ────────────────────────────── */

function TabelMingguan({ r, L }: { r: RpkpsLengkap; L: LabelDokumen }) {
  const menitPer = (
    p: RpkpsLengkap["pertemuan"][number],
    kategori: "TM" | "PT" | "BM",
  ) => p.aktivitas.filter((a) => a.kategori === kategori).reduce((s, a) => s + a.menit, 0);

  return (
    <>
      <JudulBagian nomor="H" judul={L.rencanaPembelajaranMingguan} />
      <Tabel>
        <thead>
          <tr>
            <Sel kepala lebar={5} tengah rowSpan={2}>
              {L.mingguKe}
            </Sel>
            <Sel kepala lebar={16} tengah rowSpan={2}>
              {L.subCapaianPembelajaranMataKuliahSu}
            </Sel>
            <Sel kepala lebar={16} tengah rowSpan={2}>
              {L.topikSubtopik}
            </Sel>
            <Sel kepala lebar={22} tengah rowSpan={2}>
              {L.metodeDanAktivitasPembelajaran}
            </Sel>
            <Sel kepala lebar={8} tengah rowSpan={2}>
              {L.alokasiWaktu}
            </Sel>
            <Sel kepala lebar={26} tengah span={3}>
              {L.penilaian}
            </Sel>
            <Sel kepala lebar={7} tengah rowSpan={2}>
              {L.referensi}
            </Sel>
          </tr>
          <tr>
            <Sel kepala lebar={12} tengah>
              {L.jenisPenilaianDanSistemPenilaian}
            </Sel>
            <Sel kepala lebar={10} tengah>
              {L.indikator}
            </Sel>
            <Sel kepala lebar={4} tengah>
              {L.bobot}
            </Sel>
          </tr>
        </thead>
        <tbody>
          {r.pertemuan.map((p) => (
            /*
              Jangkar per minggu. Panel samping melompat ke sini saat penyunting
              minggu dibuka — tanpa itu, pratinjau setebal empat lembar selalu
              terbuka di halaman pengesahan, dan baris yang sedang disunting
              justru yang paling jauh dari mata.
            */
            <tr key={p.id} id={`naskah-minggu-${p.minggu}`}>
              <Sel tengah tebal>
                {p.minggu}
              </Sel>

              <Sel>
                {p.subCpmk.map((s) => (
                  <p key={s.subCpmk.id}>
                    <b>{s.subCpmk.kode}&nbsp;&nbsp;</b>
                    {s.subCpmk.rumusan}
                  </p>
                ))}
              </Sel>

              <Sel>
                {p.topik ? (
                  <p>
                    <b>{L.topik}</b>
                    {p.topik}
                  </p>
                ) : null}
                {p.subtopik.length > 0 ? (
                  <>
                    <p className="font-bold">{L.subtopik}</p>
                    <DaftarBernomor butir={p.subtopik} rata={false} />
                  </>
                ) : null}
              </Sel>

              <Sel>
                {p.metodeNarasi ? (
                  <>
                    <p className="font-bold">{L.metodePembelajaran}</p>
                    <Baris teks={p.metodeNarasi} rata={false} />
                  </>
                ) : null}
                {p.aktivitasDosen || p.aktivitasMahasiswa ? (
                  <>
                    <p className="mt-1 font-bold">{L.aktivitas}</p>
                    {p.aktivitasDosen ? (
                      <p>
                        <b className="italic">{L.dosen}</b>
                        {p.aktivitasDosen}
                      </p>
                    ) : null}
                    {p.aktivitasMahasiswa ? (
                      <p>
                        <b className="italic">{L.mahasiswa}</b>
                        {p.aktivitasMahasiswa}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {p.tugasTerstruktur ? (
                  <>
                    <p className="mt-1 font-bold">{L.tugasPekerjaanTerstrukturPt}</p>
                    <Baris teks={p.tugasTerstruktur} rata={false} />
                  </>
                ) : null}
              </Sel>

              <Sel tengah>
                <p>TM: {menitPer(p, "TM")}′</p>
                <p>PT: {menitPer(p, "PT")}′</p>
                <p>BM: {menitPer(p, "BM")}′</p>
                <p className="mt-1 font-bold">
                  {formatMenit(menitPer(p, "TM") + menitPer(p, "PT") + menitPer(p, "BM"))}
                </p>
              </Sel>

              <Sel>
                {p.penilaianJenis ? (
                  <>
                    <p className="font-bold">{L.penilaian2}</p>
                    <p>{p.penilaianJenis}</p>
                  </>
                ) : null}
                {p.penilaianSistem ? (
                  <>
                    <p className="mt-1 font-bold">{L.sistemPenilaian}</p>
                    <p>{p.penilaianSistem}</p>
                  </>
                ) : null}
              </Sel>

              <Sel>
                {p.indikator.map((i) => (
                  <p key={i.id}>{i.teks}</p>
                ))}
              </Sel>

              <Sel tengah>{Number(p.bobot)}%</Sel>

              <Sel>
                {/*
                  Kunci menyertakan JENIS. `pustaka` unik pada
                  `(rpkpsId, jenis, nomor)`, jadi satu baris mingguan yang
                  merujuk Sumber Utama [1] sekaligus Sumber Daring [1] punya dua
                  anak bernomor sama — dan React memperingatkan kunci ganda.
                */}
                {p.pustaka.map((x) => (
                  <p key={`${x.pustaka.jenis}-${x.pustaka.nomor}`}>
                    • [{x.pustaka.nomor}]
                  </p>
                ))}
              </Sel>
            </tr>
          ))}
        </tbody>
      </Tabel>
    </>
  );
}

/* ── Bagian I — detail tugas ──────────────────────────────────────────── */

function BagianTugas({ r, L }: { r: RpkpsLengkap; L: LabelDokumen }) {
  if (r.tugas.length === 0) return null;

  return (
    <>
      <JudulBagian nomor="I" judul={L.detailTugasProyek} />
      {r.tugas.map((t) => (
        <div key={t.id} id={`naskah-tugas-${t.nomor}`} className="mt-3">
          <p className="mb-1 font-bold" style={{ fontSize: "11pt" }}>
            {t.nomor}. {t.nama}
          </p>
          <PLabel
            label={L.nomorTugasProyek}
            nilai={`${t.nomor},  Minggu : ${t.mingguMulai}-${t.mingguSelesai}`}
          />
          <PLabel label={L.namaMataKuliah2} nilai={r.mataKuliah.nama} />
          <PLabel label={L.kodeMataKuliah} nilai={r.mataKuliah.kode} />
          <PLabel
            label={L.jenisTugasProyek}
            nilai={t.jenis === "KELOMPOK" ? L.jenisTugasKelompok : L.jenisTugasIndividu}
          />
          <PLabel
            label={L.bobot3}
            nilai={`${Number(t.bobot)}%${t.komponenNilai ? ` (Komponen ${t.komponenNilai.nama})` : ""}`}
          />
          <PLabel
            label={L.subCpmkTerkait}
            nilai={t.subCpmk.map((x) => x.subCpmk.kode).join(", ") || "-"}
          />

          <p className="mt-2 mb-0.5 font-bold">{L.deskripsiTugas}</p>
          <Baris teks={t.deskripsi} />

          {t.uraianTugas ? (
            <>
              <p className="mt-2 mb-0.5 font-bold">{L.uraianTugas}</p>
              <Baris teks={t.uraianTugas} />
            </>
          ) : null}

          {t.formatLuaran ? (
            <>
              <p className="mt-2 mb-0.5 font-bold">{L.formatDanLuaran}</p>
              <Baris teks={t.formatLuaran} />
            </>
          ) : null}

          {t.kriteria.length > 0 ? (
            <>
              <p className="mt-3 mb-1 font-bold">{L.indikatorKriteriaDanBobotPenilaian}</p>
              <Tabel>
                <thead>
                  <tr>
                    <Sel kepala lebar={8} tengah>
                      {L.no}
                    </Sel>
                    <Sel kepala lebar={77}>
                      {L.indikator}
                    </Sel>
                    <Sel kepala lebar={15} tengah>
                      {L.bobot2}
                    </Sel>
                  </tr>
                </thead>
                <tbody>
                  {t.kriteria.map((k) => (
                    <tr key={k.id}>
                      <Sel tengah>{k.nomor}</Sel>
                      <Sel>
                        <p className="font-bold">{k.indikator}</p>
                        {k.rincian.map((d, i) => (
                          <p key={i} style={{ paddingLeft: "0.21cm" }}>
                            •&nbsp;&nbsp;{d}
                          </p>
                        ))}
                      </Sel>
                      <Sel tengah>{Number(k.bobot)}%</Sel>
                    </tr>
                  ))}
                  <tr>
                    <Sel tebal />
                    <Sel tebal kanan>
                      {L.total}
                    </Sel>
                    <Sel tebal tengah>
                      {t.kriteria.reduce((a, k) => a + Number(k.bobot), 0)}%
                    </Sel>
                  </tr>
                </tbody>
              </Tabel>
            </>
          ) : null}

          {t.linimasa.length > 0 ? (
            <>
              <p className="mt-3 mb-1 font-bold">{L.linimasaProyekTugas}</p>
              <Tabel>
                <thead>
                  <tr>
                    <Sel kepala lebar={12} tengah>
                      {L.mingguKe}
                    </Sel>
                    <Sel kepala lebar={28}>
                      {L.tahapan}
                    </Sel>
                    <Sel kepala lebar={60}>
                      {L.deskripsiAktivitas}
                    </Sel>
                  </tr>
                </thead>
                <tbody>
                  {t.linimasa.map((l) => (
                    <tr key={l.id}>
                      <Sel tengah>{l.minggu}</Sel>
                      <Sel>{l.tahapan}</Sel>
                      <Sel>{l.aktivitas}</Sel>
                    </tr>
                  ))}
                </tbody>
              </Tabel>
            </>
          ) : null}

          {t.ketentuanLain ? (
            <>
              <p className="mt-3 mb-0.5 font-bold">{L.ketentuanLainnya}</p>
              <Baris teks={t.ketentuanLain} />
            </>
          ) : null}
        </div>
      ))}
    </>
  );
}

/* ── Lampiran kisi-kisi ───────────────────────────────────────────────── */

function LampiranKisiKisi({ r, L }: { r: RpkpsLengkap; L: LabelDokumen }) {
  if (r.kisiKisi.length === 0) return null;

  return (
    <>
      <p id="naskah-lampiran" className="mt-5 mb-2 font-bold" style={{ fontSize: "11pt" }}>
        {L.lampiranKisiKisiUjian}
      </p>
      {r.kisiKisi.map((k) => (
        <div key={k.id} id={`naskah-kisi-${k.jenis}`} className="mt-3">
          <p className="font-bold">
            {k.jenis === "UTS" ? L.ujianTengahSemester : L.ujianAkhirSemester}
          </p>
          <p className="mb-1">
            {sisip(L.totalSkorKisi, { skor: Number(k.totalSkor) })}
            {k.durasiMenit ? sisip(L.durasiKisi, { menit: k.durasiMenit }) : ""}
            {k.catatan ? ` · ${k.catatan}` : ""}
          </p>

          {k.butir.length === 0 ? (
            <Miring>{L.belumAdaButir}</Miring>
          ) : (
            <Tabel>
              <thead>
                <tr>
                  <Sel kepala lebar={6} tengah>
                    {L.no}
                  </Sel>
                  <Sel kepala lebar={16}>
                    {L.subCpmk2}
                  </Sel>
                  <Sel kepala lebar={38}>
                    {L.indikatorSoal}
                  </Sel>
                  <Sel kepala lebar={10} tengah>
                    {L.level}
                  </Sel>
                  <Sel kepala lebar={16}>
                    {L.bentuk}
                  </Sel>
                  <Sel kepala lebar={7} tengah>
                    {L.butir}
                  </Sel>
                  <Sel kepala lebar={7} tengah>
                    {L.skor}
                  </Sel>
                </tr>
              </thead>
              <tbody>
                {k.butir.map((b) => (
                  <tr key={b.id}>
                    <Sel tengah>{b.nomor}</Sel>
                    <Sel>{b.subCpmk.kode}</Sel>
                    <Sel>{b.indikator ?? b.subCpmk.rumusan}</Sel>
                    <Sel tengah>{b.levelBloom}</Sel>
                    <Sel>{L.bentukSoal[b.bentuk] ?? b.bentuk}</Sel>
                    <Sel tengah>{b.jumlahButir}</Sel>
                    <Sel tengah>{Number(b.skor)}</Sel>
                  </tr>
                ))}
                <tr>
                  <Sel tebal />
                  <Sel tebal kanan span={4}>
                    {L.total}
                  </Sel>
                  <Sel tebal tengah>
                    {k.butir.reduce((s, b) => s + b.jumlahButir, 0)}
                  </Sel>
                  <Sel tebal tengah>
                    {k.butir.reduce((s, b) => s + Number(b.skor), 0)}
                  </Sel>
                </tr>
              </tbody>
            </Tabel>
          )}
        </div>
      ))}
    </>
  );
}

/* ── Bagian J — histori revisi ────────────────────────────────────────── */

function BagianRiwayat({
  r,
  L,
  riwayat,
  bahasa,
}: {
  r: RpkpsLengkap;
  L: LabelDokumen;
  riwayat: { versi: number; dibuatPada: Date; deskripsi: string }[];
  bahasa: Bahasa;
}) {
  return (
    <>
      <JudulBagian nomor="J" judul={L.historiRevisi} />
      <Tabel>
        <thead>
          <tr>
            <Sel kepala lebar={15} tengah>
              {L.kodeMk}
            </Sel>
            <Sel kepala lebar={12} tengah>
              {L.noRevisi}
            </Sel>
            <Sel kepala lebar={20} tengah>
              {L.tanggalBerlaku}
            </Sel>
            <Sel kepala lebar={53}>
              {L.deskripsiPerubahan}
            </Sel>
          </tr>
        </thead>
        <tbody>
          {riwayat.map((h, i) => (
            <tr key={i}>
              <Sel tengah>{r.mataKuliah.kode}</Sel>
              <Sel tengah>{h.versi}</Sel>
              <Sel tengah>
                {/*
                  Kolom angka, bukan kalimat — dan locale-nya mengikuti bahasa
                  naskah: "06/02/2025" dibaca 6 Februari oleh pembaca Indonesia
                  dan 2 Juni oleh pembaca Inggris.
                */}
                {h.dibuatPada.toLocaleDateString(LOCALE[bahasa], {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </Sel>
              <Sel>{h.deskripsi}</Sel>
            </tr>
          ))}
        </tbody>
      </Tabel>
    </>
  );
}
