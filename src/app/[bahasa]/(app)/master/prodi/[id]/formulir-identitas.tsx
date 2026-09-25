"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BATAS_LOGO } from "@/domain/kurikulum/identitas-prodi";
import type { HasilAksi } from "../../aksi";
import {
  hapusLogoInstitusi,
  hapusLogoProdi,
  simpanIdentitasProdi,
  simpanPemetaanUnit,
  unggahLogoInstitusi,
  unggahLogoProdi,
} from "../../aksi-identitas";

/**
 * Formulir identitas program studi (docs/21 §3.1).
 *
 * Satu borang, empat kartu, satu tombol simpan untuk teksnya. Lambang berdiri
 * sendiri: ia unggahan berkas, dan menggabungkannya ke borang teks berarti
 * setiap perbaikan satu huruf pada visi ikut mengirim ulang setengah megabita.
 */

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<HasilAksi>) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });
  return { menunggu, jalankan };
}

export interface IdentitasAwal {
  id: string;
  nama: string;
  visi: string | null;
  visiEn: string | null;
  misi: string[];
  misiEn: string[];
  alamat: string | null;
  telepon: string | null;
  surel: string | null;
  situs: string | null;
}

export function FormulirIdentitas({ awal }: { awal: IdentitasAwal }) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();
  const t = k.master.identitas;

  /*
   * Butir misi dipegang sebagai keadaan supaya barisnya dapat ditambah dan
   * dihapus. Panjang kedua larik disamakan: butir Inggris yang belum ada
   * tampil sebagai kotak kosong berdampingan, bukan memaksa dosen
   * menerjemahkan seluruhnya sekaligus.
   */
  const panjangAwal = Math.max(awal.misi.length, awal.misiEn.length, 1);
  const [misi, setMisi] = useState(() =>
    Array.from({ length: panjangAwal }, (_, i) => ({
      id: awal.misi[i] ?? awal.misiEn[i] ?? "",
      en: awal.misiEn[i] ?? "",
    })),
  );

  const ubahButir = (i: number, bahasa: "id" | "en", nilai: string) =>
    setMisi((b) => b.map((x, j) => (j === i ? { ...x, [bahasa]: nilai } : x)));

  return (
    <form
      action={(fd) => jalankan(() => simpanIdentitasProdi(awal.id, fd))}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.visiJudul}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.visiKeterangan}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="visi">{t.labelVisi}</Label>
              <textarea
                id="visi"
                name="visi"
                rows={4}
                defaultValue={awal.visi ?? ""}
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="visiEn">
                {isi(k.dwibahasa.labelEn, { label: t.labelVisi })}
              </Label>
              <textarea
                id="visiEn"
                name="visiEn"
                rows={4}
                defaultValue={awal.visiEn ?? ""}
                placeholder={k.dwibahasa.belumDiterjemahkan}
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.labelMisi}</Label>
            {misi.map((butir, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="label-teknis mt-2.5 w-5 shrink-0 text-right text-muted-foreground/70">
                  {i + 1}
                </span>
                <div className="grid grow gap-2 sm:grid-cols-2">
                  <Input
                    name="misi"
                    value={butir.id}
                    aria-label={isi(t.butirMisi, { nomor: i + 1 })}
                    onChange={(e) => ubahButir(i, "id", e.target.value)}
                  />
                  <Input
                    name="misiEn"
                    value={butir.en}
                    placeholder={k.dwibahasa.belumDiterjemahkan}
                    aria-label={isi(k.dwibahasa.labelEn, {
                      label: isi(t.butirMisi, { nomor: i + 1 }),
                    })}
                    onChange={(e) => ubahButir(i, "en", e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t.hapusButir}
                  onClick={() => setMisi((b) => b.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMisi((b) => [...b, { id: "", en: "" }])}
            >
              <Plus aria-hidden className="mr-1.5 size-4" />
              {t.tambahButir}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.kontakJudul}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.kontakKeterangan}</p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="alamat">{t.labelAlamat}</Label>
            <textarea
              id="alamat"
              name="alamat"
              rows={2}
              defaultValue={awal.alamat ?? ""}
              placeholder={t.contohAlamat}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telepon">{t.labelTelepon}</Label>
            <Input
              id="telepon"
              name="telepon"
              defaultValue={awal.telepon ?? ""}
              placeholder={t.contohTelepon}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="surel">{t.labelSurel}</Label>
            <Input
              id="surel"
              name="surel"
              type="email"
              defaultValue={awal.surel ?? ""}
              placeholder={t.contohSurel}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="situs">{t.labelSitus}</Label>
            <Input
              id="situs"
              name="situs"
              defaultValue={awal.situs ?? ""}
              placeholder={t.contohSitus}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">{t.catatanKop}</p>
        <Button type="submit" disabled={menunggu}>
          {menunggu ? t.menyimpan : t.simpan}
        </Button>
      </div>
    </form>
  );
}

/**
 * Kartu lambang. Dipakai dua kali dengan aksi yang berbeda — prodi dan
 * institusi — karena bentuk dan aturannya identik; yang berbeda hanya siapa
 * pemiliknya dan siapa yang boleh menggantinya.
 */
export function KartuLogo({
  judul,
  keterangan,
  nama,
  urlLogo,
  milik,
}: {
  judul: string;
  keterangan?: string;
  nama: string;
  /** null berarti belum ada lambang. Sudah membawa penanda versi. */
  urlLogo: string | null;
  milik: { jenis: "prodi"; id: string } | { jenis: "institusi" };
}) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();
  const t = k.master.identitas;
  const berkas = useRef<HTMLInputElement>(null);
  const [terpilih, setTerpilih] = useState<string | null>(null);

  const unggah = (fd: FormData) =>
    jalankan(() =>
      milik.jenis === "prodi" ? unggahLogoProdi(milik.id, fd) : unggahLogoInstitusi(fd),
    );
  const hapus = () =>
    jalankan(() =>
      milik.jenis === "prodi" ? hapusLogoProdi(milik.id) : hapusLogoInstitusi(),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{judul}</CardTitle>
        {keterangan ? (
          <p className="text-sm text-muted-foreground">{keterangan}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form action={unggah} className="flex flex-wrap items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-md border bg-background">
            {urlLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- bita dilayani rute sendiri, bukan berkas statis yang dapat dioptimasi
              <img
                src={urlLogo}
                alt={isi(t.logoAlt, { nama })}
                className="max-h-16 max-w-16 object-contain"
              />
            ) : (
              <span className="px-2 text-center text-[10px] leading-tight text-muted-foreground">
                {t.logoBelumAda}
              </span>
            )}
          </div>

          <div className="grow space-y-2">
            <p className="text-xs text-muted-foreground">
              {isi(t.logoKeterangan, {
                maks: Math.round(BATAS_LOGO.bita / 1024),
                min: BATAS_LOGO.pxMinimal,
                maksPx: BATAS_LOGO.pxMaksimal,
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={berkas}
                type="file"
                name="logo"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => setTerpilih(e.target.files?.[0]?.name ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => berkas.current?.click()}
              >
                {t.logoPilih}
              </Button>
              {terpilih ? (
                <span className="max-w-48 truncate text-xs text-muted-foreground">
                  {terpilih}
                </span>
              ) : null}
              <Button type="submit" size="sm" disabled={menunggu || !terpilih}>
                <Upload aria-hidden className="mr-1.5 size-4" />
                {t.logoUnggah}
              </Button>
              {urlLogo ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={menunggu}
                  onClick={hapus}
                >
                  {t.logoHapus}
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Pemetaan prodi ↔ unit identitas-itts. Hanya Admin yang melihatnya (halaman menyaring; aksinya
 * menimbang lagi): pemetaan ini menentukan prodi tempat peran Kaprodi dan Dosen diberikan.
 */
export function KartuPemetaanUnit({ prodiId, unitId }: { prodiId: string; unitId: string | null }) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();
  const t = k.master.identitas;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.pemetaanJudul}</CardTitle>
        <p className="text-sm text-muted-foreground">{t.pemetaanKeterangan}</p>
      </CardHeader>
      <CardContent>
        <form
          key={unitId ?? ""}
          action={(fd) => jalankan(() => simpanPemetaanUnit(prodiId, fd))}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="unitId">{t.pemetaanLabel}</Label>
            <Input
              id="unitId"
              name="unitId"
              defaultValue={unitId ?? ""}
              placeholder={t.pemetaanContoh}
              maxLength={64}
              className="font-mono"
            />
          </div>
          <Button type="submit" variant="outline" disabled={menunggu}>
            {t.pemetaanSimpan}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
