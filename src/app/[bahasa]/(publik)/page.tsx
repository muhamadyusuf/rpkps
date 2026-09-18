import type { Metadata } from "next";
import Image from "next/image";
import type { Bahasa, Kamus } from "@/kamus";
import { Tautan } from "@/components/tautan";
import { ArrowRight, ArrowUpRight, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sidikRingkas } from "@/domain/rpkps/sidik";
import { labelTahunAkademik } from "@/domain/rpkps/publik";
import {
  angkaKatalog,
  daftarProdiPublik,
  muatInstitusi,
  terakhirDisahkan,
} from "@/lib/publik/muat";
import { jalurRpkpsPublik, situsProdi, urlSitus } from "@/lib/publik/tautan";
import { KartuAngka } from "./komponen";
import { bahasaAktif, kamus } from "@/lib/bahasa/server";
import { jalur } from "@/lib/bahasa/jalur";
import { tanggal } from "@/lib/bahasa/format";
import { isi, namaMk } from "@/lib/bahasa/teks";
import gaya from "./beranda.module.css";

// Database hanya dibaca saat permintaan; deduplikasi tetap di pemuat publik.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [institusi, k] = await Promise.all([muatInstitusi(), kamus()]);
  return {
    title: isi(k.publikHalaman.meta.judul, {
      institusi: institusi.namaSingkat || institusi.nama,
    }),
    description: isi(k.publikHalaman.meta.deskripsi, { institusi: institusi.nama }),
    alternates: { canonical: urlSitus() },
  };
}

export default async function BerandaPublik() {
  const [angka, prodi, terbaru, institusi, k, b] = await Promise.all([
    angkaKatalog(), daftarProdiPublik(), terakhirDisahkan(6),
    muatInstitusi(), kamus(), bahasaAktif(),
  ]);

  return (
    <div className={gaya.beranda}>
      <Hero jumlahDokumen={angka.dokumen} institusi={institusi.nama} k={k} bahasa={b} />

      <section className={gaya.angka} aria-label={k.publikHalaman.hero.label}>
        <KartuAngka label={k.publikHalaman.angka.dokumen} nilai={angka.dokumen} keterangan={k.publikHalaman.angka.dokumenKeterangan} />
        <KartuAngka label={k.publikHalaman.angka.mataKuliah} nilai={angka.mataKuliah} keterangan={k.publikHalaman.angka.mataKuliahKeterangan} />
        <KartuAngka label={k.publikHalaman.angka.prodi} nilai={angka.prodi} keterangan={k.publikHalaman.angka.prodiKeterangan} />
        <KartuAngka label={k.publikHalaman.angka.tahunAkademik} nilai={angka.tahunAkademik} keterangan={k.publikHalaman.angka.tahunAkademikKeterangan} />
      </section>

      <section className={gaya.bagian}>
        <KepalaBagian nomor="01" judul={k.publikHalaman.prodi.judul} keterangan={k.publikHalaman.prodi.keterangan} />
        <div className={gaya.daftarProdi}>
          {prodi.map((p, i) => {
            const situs = situsProdi(p.kode);
            return (
              <div key={p.kode} className={gaya.prodi}>
                <span className={gaya.nomorProdi} aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <div className={gaya.namaProdi}>
                  <p className={gaya.label}>{p.kode} / {p.jenjang}</p>
                  <h3><Tautan href={`/katalog/${p.kode.toLowerCase()}`}>{p.nama}</Tautan></h3>
                </div>
                <p className={gaya.jumlahProdi}><strong>{p.jumlah}</strong><span>{k.publikHalaman.prodi.jumlahMk}</span></p>
                <div className={gaya.aksiProdi}>
                  <Tautan href={`/katalog/${p.kode.toLowerCase()}`} className={gaya.tautanUtama}>
                    {k.publikHalaman.prodi.lihat}<ArrowUpRight className="size-4" aria-hidden />
                  </Tautan>
                  {situs ? <a href={situs} className={gaya.tautanKecil}>{k.publikHalaman.prodi.situs}<ArrowUpRight className="size-3" aria-hidden /></a> : null}
                </div>
              </div>
            );
          })}
          {prodi.length === 0 ? <p className="py-8 text-sm text-muted-foreground">{k.publikHalaman.prodi.kosong}</p> : null}
        </div>
      </section>

      {terbaru.length > 0 ? (
        <section className={gaya.bagian}>
          <KepalaBagian nomor="02" judul={k.publikHalaman.terbaru.judul} keterangan={k.publikHalaman.terbaru.keterangan} />
          <ul className={gaya.terbaru}>
            {terbaru.map((t) => (
              <li key={`${t.prodiKode}-${t.kode}-${t.tahunAkademik}`}>
                <Tautan href={jalurRpkpsPublik(t.prodiKode, t.kode)} className={gaya.dokumen}>
                  <span className={gaya.kodeDokumen}>{t.kode}</span>
                  <div className={gaya.namaDokumen}>
                    <h3>{namaMk(t, b)}</h3>
                    <p>v{t.versi}<span aria-hidden> / </span>{labelTahunAkademik(t.tahunAkademik)}</p>
                  </div>
                  <div className={gaya.sidikDokumen}>
                    <span>{tanggal(t.disahkanPada, b, "panjang")}</span>
                    <code>{sidikRingkas(t.sidik)}</code>
                  </div>
                  <ArrowUpRight className={gaya.panahDokumen} aria-hidden />
                </Tautan>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={gaya.panduan}>
        <KepalaBagian nomor={terbaru.length > 0 ? "03" : "02"} judul={k.publikHalaman.caraBaca.judul} keterangan={k.publikHalaman.caraBaca.keterangan} />
        <div className={gaya.penjelasGrid}>
          <Penjelas tanda="CPL → CPMK" judul={k.publikHalaman.caraBaca.capaianJudul} isi={k.publikHalaman.caraBaca.capaianIsi} />
          <Penjelas tanda="45 h / SKS" judul={k.publikHalaman.caraBaca.bebanJudul} isi={k.publikHalaman.caraBaca.bebanIsi} />
          <Penjelas tanda="SHA–256" judul={k.publikHalaman.caraBaca.kunciJudul} isi={k.publikHalaman.caraBaca.kunciIsi} />
        </div>
      </section>
    </div>
  );
}

function Hero({ jumlahDokumen, institusi, k, bahasa }: {
  jumlahDokumen: number; institusi: string; k: Kamus; bahasa: Bahasa;
}) {
  const h = k.publikHalaman.hero;
  return (
    <section className={gaya.hero}>
      <div className={gaya.heroIsi}>
        <p className={gaya.eyebrow}><span aria-hidden />{h.label}</p>
        <h1>{h.judul}<span>{h.judulAksen}</span></h1>
        <p className={gaya.deskripsi}>{isi(h.isi, { dokumen: jumlahDokumen > 0 ? `${jumlahDokumen} ` : "" })}</p>
        <form action={jalur("/katalog", bahasa)} method="get" role="search" className={gaya.pencarian}>
          <div className={gaya.inputCari}>
            <Search className="size-4" aria-hidden />
            <Input type="search" name="cari" placeholder={h.cariPlaceholder} aria-label={h.cariAria} />
          </div>
          <Button type="submit" size="lg">{h.cari}<ArrowRight className="size-4" aria-hidden /></Button>
        </form>
        <div className={gaya.heroTautan}>
          <Tautan href="/katalog">{h.jelajahi}<ArrowUpRight className="size-4" aria-hidden /></Tautan>
          <span><ShieldCheck className="size-3.5" aria-hidden />{h.catatan}</span>
        </div>
      </div>
      <div className={gaya.arsitektur}>
        <div className={gaya.arsitekturAtas}><span>OBE / RPKPS</span><span aria-hidden>↗</span></div>
        <Image src="/arsitektur-pembelajaran.svg" alt="" width={520} height={430} loading="eager" className={gaya.ilustrasi} />
        <div className={gaya.arsitekturBawah}>
          <p className={gaya.label}>CPL<span aria-hidden> / </span>CPMK<span aria-hidden> / </span>SUB-CPMK</p>
          <h2>{h.peta}</h2>
          <p>{h.petaIsi}</p>
        </div>
        <p className={gaya.institusi}>{institusi}</p>
      </div>
    </section>
  );
}

function KepalaBagian({ nomor, judul, keterangan }: { nomor: string; judul: string; keterangan: string }) {
  return (
    <div className={gaya.kepalaBagian}>
      <div><span className={gaya.indeksBagian} aria-hidden>{nomor} /</span><h2>{judul}</h2></div>
      <p>{keterangan}</p>
    </div>
  );
}

function Penjelas({ tanda, judul, isi }: { tanda: string; judul: string; isi: string }) {
  return <div className={gaya.penjelas}><p className={gaya.tanda}>{tanda}</p><h3>{judul}</h3><p>{isi}</p></div>;
}
