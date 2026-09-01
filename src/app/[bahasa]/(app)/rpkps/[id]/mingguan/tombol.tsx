"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Plus,
  RotateCcw,
  ScanSearch,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { TautanIkon, TombolIkon } from "@/components/tombol-ikon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DampakStruktur } from "@/domain/rpkps/rencana-mingguan";
import {
  dampakOperasi,
  dampakSusunUlang,
  geserPertemuan,
  hapusPertemuan,
  sisipPertemuan,
  tambahPertemuan,
  susunUlangKerangka,
  ubahJenisPertemuan,
  type Hasil,
} from "./aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<Hasil>, sesudah?: () => void) =>
    mulai(async () => {
      const h = await fn();
      if (h.ok) {
        toast.success(h.pesan);
        sesudah?.();
        router.refresh();
      } else toast.error(h.pesan);
    });
  return { menunggu, jalankan };
}

export function TombolTambahPertemuan({ rpkpsId }: { rpkpsId: string }) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={menunggu}
      onClick={() => jalankan(() => tambahPertemuan(rpkpsId))}
    >
      <Plus />
      {menunggu ? k.rpkps.aksiMinggu.menambah : k.rpkps.aksiMinggu.tambahPertemuan}
    </Button>
  );
}

/**
 * Aksi satu baris: buka rincian, lalu — bila dokumen masih dapat disunting —
 * sisip di bawahnya, geser, dan hapus.
 *
 * Membuka rincian SELALU tersedia, juga bagi pembaca yang tidak berwenang
 * menyunting. Sebelumnya satu-satunya jalan ke sana adalah nomor minggu yang
 * berupa tautan, dan tautan di dalam sel tabel tidak terbaca sebagai aksi:
 * yang mencari "lihat detail" mencarinya di kolom aksi.
 *
 * `bisaNaik`/`bisaTurun` datang dari server supaya tombol di ujung tabel mati
 * sejak awal, bukan baru menolak setelah ditekan — dan penjelas tombol mati
 * menyebutkan sebabnya.
 */
export function AksiBaris({
  rpkpsId,
  minggu,
  bisaSunting,
  bisaNaik,
  bisaTurun,
  bisaHapus,
  rincian,
}: {
  rpkpsId: string;
  minggu: number;
  bisaSunting: boolean;
  bisaNaik: boolean;
  bisaTurun: boolean;
  bisaHapus: boolean;
  rincian: string;
}) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();

  return (
    <div className="flex justify-end gap-0.5">
      <TautanIkon
        href={`/rpkps/${rpkpsId}/mingguan/${minggu}`}
        petunjuk={
          bisaSunting
            ? isi(k.rpkps.aksiMinggu.bukaRincian, { minggu })
            : isi(k.rpkps.aksiMinggu.lihatRincian, { minggu })
        }
      >
        <ScanSearch />
      </TautanIkon>

      {bisaSunting ? (
        <>
          <TombolIkon
            petunjuk={isi(k.rpkps.aksiMinggu.geserNaik, { minggu })}
            petunjukMati={k.rpkps.aksiMinggu.sudahTeratas}
            disabled={menunggu || !bisaNaik}
            onClick={() => jalankan(() => geserPertemuan(rpkpsId, minggu, "NAIK"))}
          >
            <ChevronUp />
          </TombolIkon>
          <TombolIkon
            petunjuk={isi(k.rpkps.aksiMinggu.geserTurun, { minggu })}
            petunjukMati={k.rpkps.aksiMinggu.sudahTerbawah}
            disabled={menunggu || !bisaTurun}
            onClick={() => jalankan(() => geserPertemuan(rpkpsId, minggu, "TURUN"))}
          >
            <ChevronDown />
          </TombolIkon>
          <DialogStruktur
            rpkpsId={rpkpsId}
            minggu={minggu}
            op={{ jenis: "SISIP", setelah: minggu }}
            pemicu={
              <TombolIkon
                petunjuk={isi(k.rpkps.aksiMinggu.sisipPetunjuk, { minggu })}
                disabled={menunggu}
              >
                <CornerDownRight />
              </TombolIkon>
            }
            judul={isi(k.rpkps.aksiMinggu.sisipJudul, { minggu })}
            keterangan={isi(k.rpkps.aksiMinggu.sisipKeterangan, {
              berikut: minggu + 1,
            })}
            labelJalan={k.rpkps.aksiMinggu.sisipJalan}
            jalankanAksi={() => sisipPertemuan(rpkpsId, minggu)}
          />
          <DialogStruktur
            rpkpsId={rpkpsId}
            minggu={minggu}
            op={{ jenis: "HAPUS", minggu }}
            merusak
            pemicu={
              <TombolIkon
                petunjuk={isi(k.rpkps.aksiMinggu.hapusPetunjuk, { minggu })}
                petunjukMati={k.rpkps.aksiMinggu.hapusMati}
                disabled={menunggu || !bisaHapus}
              >
                <Trash2 />
              </TombolIkon>
            }
            judul={isi(k.rpkps.aksiMinggu.hapusJudul, { minggu })}
            keterangan={isi(k.rpkps.aksiMinggu.hapusKeterangan, { rincian })}
            labelJalan={k.rpkps.aksiMinggu.hapusJalan}
            jalankanAksi={() => hapusPertemuan(rpkpsId, minggu)}
          />
        </>
      ) : null}
    </div>
  );
}

type OperasiRingkas =
  | { jenis: "SISIP"; setelah: number }
  | { jenis: "HAPUS"; minggu: number };

/**
 * Dialog untuk operasi yang menggeser nomor minggu.
 *
 * Dampaknya terhadap nilai mahasiswa DIAMBIL SAAT DIALOG DIBUKA, bukan
 * ditebak di klien: penomoran ulang memindahkan `nilai_asesmen.asesmen_kode`
 * (M5 → M6), dan angka itu hanya server yang tahu. Struktur tetap boleh
 * diubah walau nilai sudah masuk — yang tidak boleh adalah mengubahnya tanpa
 * dosen melihat angkanya lebih dulu (docs/09 §K4).
 */
function DialogStruktur({
  rpkpsId,
  op,
  pemicu,
  judul,
  keterangan,
  labelJalan,
  jalankanAksi,
  merusak = false,
}: {
  rpkpsId: string;
  minggu: number;
  op: OperasiRingkas;
  pemicu: React.ReactElement;
  judul: string;
  keterangan: string;
  labelJalan: string;
  jalankanAksi: () => Promise<Hasil>;
  merusak?: boolean;
}) {
  const { k, isi } = useBahasa();
  const [buka, setBuka] = useState(false);
  const [dampak, setDampak] = useState<DampakStruktur | null>(null);
  const [memuat, setMemuat] = useState(false);
  const { menunggu, jalankan } = useAksi();

  // Diambil saat dialog DIBUKA, bukan lewat efek: tidak ada langganan yang
  // perlu disinkronkan, hanya satu permintaan sekali jalan.
  function bukaDialog() {
    setBuka(true);
    setMemuat(true);
    dampakOperasi(rpkpsId, op)
      .then(setDampak)
      .finally(() => setMemuat(false));
  }

  function tutupDialog(terbuka: boolean) {
    setBuka(terbuka);
    if (!terbuka) setDampak(null);
  }

  const adaDampak =
    dampak !== null && (dampak.totalBerpindah > 0 || dampak.totalMenganggur > 0);

  return (
    <>
      <span onClick={bukaDialog}>{pemicu}</span>

      <Dialog open={buka} onOpenChange={tutupDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            <DialogDescription>{keterangan}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {memuat ? (
              <p className="text-muted-foreground">
                {k.rpkps.aksiMinggu.menghitungDampak}
              </p>
            ) : null}

            {adaDampak ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-l-2 border-l-warning bg-card p-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="space-y-1.5">
                  <p className="font-medium">{k.rpkps.aksiMinggu.adaNilai}</p>
                  {dampak!.totalBerpindah > 0 ? (
                    <p className="text-muted-foreground">
                      {isi(k.rpkps.aksiMinggu.berpindahAwal, {
                        jumlah: dampak!.totalBerpindah,
                      })}{" "}
                      <span className="font-mono text-xs">
                        {dampak!.berpindah
                          .map((b) => `${b.dari}→${b.ke} (${b.jumlah})`)
                          .join(", ")}
                      </span>
                      {k.rpkps.aksiMinggu.berpindahAkhir}
                    </p>
                  ) : null}
                  {dampak!.totalMenganggur > 0 ? (
                    <p className="text-muted-foreground">
                      {isi(k.rpkps.aksiMinggu.menganggurAwal, {
                        jumlah: dampak!.totalMenganggur,
                      })}{" "}
                      <span className="font-mono text-xs">
                        {dampak!.menganggur.map((m) => m.kode).join(", ")}
                      </span>{" "}
                      {k.rpkps.aksiMinggu.menganggurAkhir}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!memuat && dampak !== null && !adaDampak ? (
              <p className="text-muted-foreground">
                {k.rpkps.aksiMinggu.tanpaDampak}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {k.rpkps.aksiMinggu.batal}
            </DialogClose>
            <Button
              variant={merusak ? "destructive" : "default"}
              disabled={menunggu || memuat}
              onClick={() => jalankan(jalankanAksi, () => setBuka(false))}
            >
              {menunggu ? k.rpkps.aksiMinggu.menjalankan : labelJalan}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Jenis satu baris: pertemuan efektif, UTS, atau UAS.
 *
 * Tersimpan seketika, tidak menunggu tombol Simpan penyunting — mengubah jenis
 * juga mengubah kode asesmen baris ini (`M9` menjadi `UTS`), dan pemindahan
 * nilainya berjalan di aksi yang sama dengan penomoran ulang. Menyelipkannya
 * ke `simpanPertemuan` berarti aturan yang sama ditulis di dua tempat.
 */
export function PilihJenisPertemuan({
  rpkpsId,
  minggu,
  jenis,
}: {
  rpkpsId: string;
  minggu: number;
  jenis: "EFEKTIF" | "UTS" | "UAS";
}) {
  const { menunggu, jalankan } = useAksi();
  const { k } = useBahasa();

  return (
    <Select
      value={jenis}
      disabled={menunggu}
      onValueChange={(v) => {
        const ke = (v ?? "EFEKTIF") as "EFEKTIF" | "UTS" | "UAS";
        if (ke === jenis) return;
        jalankan(() => ubahJenisPertemuan(rpkpsId, minggu, ke));
      }}
    >
      <SelectTrigger className="h-8 w-40 text-xs" aria-label={k.rpkps.aksiMinggu.ariaJenis}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="EFEKTIF">{k.enum.jenisPertemuan.EFEKTIF}</SelectItem>
        <SelectItem value="UTS">{k.enum.jenisPertemuan.UTS}</SelectItem>
        <SelectItem value="UAS">{k.enum.jenisPertemuan.UAS}</SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * Menyusun ulang kerangka: membuang seluruh tabel dan membangunnya kembali
 * dari kebijakan beban belajar.
 *
 * Operasi paling merusak di halaman ini — yang lenyap bukan hanya nomor,
 * melainkan seluruh isi baris. Angkanya diambil dari server saat dialog
 * dibuka, bukan ditulis sebagai kalimat umum.
 */
export function TombolSusunUlang({ rpkpsId }: { rpkpsId: string }) {
  const { k, isi } = useBahasa();
  const [buka, setBuka] = useState(false);
  const [dampak, setDampak] = useState<Awaited<
    ReturnType<typeof dampakSusunUlang>
  > | null>(null);
  const { menunggu, jalankan } = useAksi();

  function bukaDialog() {
    setBuka(true);
    dampakSusunUlang(rpkpsId).then(setDampak);
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={bukaDialog}>
        <RotateCcw />
        Susun ulang kerangka
      </Button>

      <Dialog
        open={buka}
        onOpenChange={(terbuka) => {
          setBuka(terbuka);
          if (!terbuka) setDampak(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{k.rpkps.aksiMinggu.susunUlangJudul}</DialogTitle>
            <DialogDescription>
              {k.rpkps.aksiMinggu.susunUlangKeterangan}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2.5 rounded-lg border border-l-2 border-l-destructive bg-card p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="space-y-1.5 text-muted-foreground">
                <p className="font-medium text-foreground">
                  {k.rpkps.aksiMinggu.susunUlangPeringatan}
                </p>
                <p>
                  {dampak === null
                    ? k.rpkps.aksiMinggu.menghitung
                    : isi(k.rpkps.aksiMinggu.susunUlangDampak, {
                        jumlah: dampak.jumlahPertemuan,
                      })}
                </p>
                {dampak !== null && dampak.totalMenganggur > 0 ? (
                  <p>
                    {isi(k.rpkps.aksiMinggu.susunUlangMenganggurAwal, {
                      jumlah: dampak.totalMenganggur,
                    })}{" "}
                    <span className="font-mono text-xs">
                      {dampak.menganggur.map((m) => m.kode).join(", ")}
                    </span>{" "}
                    {k.rpkps.aksiMinggu.susunUlangMenganggurAkhir}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {k.rpkps.aksiMinggu.batal}
            </DialogClose>
            <Button
              variant="destructive"
              disabled={menunggu || dampak === null}
              onClick={() =>
                jalankan(() => susunUlangKerangka(rpkpsId), () => setBuka(false))
              }
            >
              {menunggu ? k.rpkps.aksiMinggu.menyusun : k.rpkps.aksiMinggu.susunUlang}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
