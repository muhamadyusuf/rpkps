"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  CopyPlus,
  Crown,
  Download,
  Link2,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MIN_CATATAN_REVISI } from "@/domain/rpkps/tipe";
import { cn } from "@/lib/utils";
import {
  arsipkanRpkps,
  hapusRpkps,
  lepasPengampu,
  pulihkanRpkps,
  salinRpkps,
  serahTerimaKoordinator,
  tambahPengampu,
  type Hasil,
} from "./aksi-kelola";

function useAksiKelola() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();

  const jalankan = (
    fn: () => Promise<Hasil>,
    opsi?: { tujuan?: (h: Hasil) => string | null; sesudah?: () => void },
  ) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        opsi?.sesudah?.();
        const ke = opsi?.tujuan?.(hasil);
        if (ke) router.push(ke);
        router.refresh();
      } else {
        // Penolakan hapus membawa DAFTAR alasan; menampilkan yang pertama saja
        // membuat dosen memperbaiki satu penghalang lalu tertahan penghalang
        // berikutnya.
        toast.error(hasil.pesan, {
          description: hasil.alasan?.length ? hasil.alasan.join(" ") : undefined,
        });
      }
    });

  return { menunggu, jalankan };
}

// ─────────────────────────────────────────────────────────────
// TIM PENGAMPU
// ─────────────────────────────────────────────────────────────

export type BarisPengampu = {
  penggunaId: string;
  nama: string;
  nidn: string | null;
  koordinator: boolean;
};

export function TimPengampu({
  rpkpsId,
  pengampu,
  calon,
  bolehKelola,
}: {
  rpkpsId: string;
  pengampu: BarisPengampu[];
  calon: { id: string; nama: string; prodi: string | null }[];
  bolehKelola: boolean;
}) {
  const { menunggu, jalankan } = useAksiKelola();
  const [pilihan, setPilihan] = useState<string>("");

  const sudah = new Set(pengampu.map((p) => p.penggunaId));
  const tersedia = calon.filter((c) => !sudah.has(c.id));
  const anggota = pengampu.filter((p) => !p.koordinator);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tim pengampu</CardTitle>
        <CardDescription>
          Ditunjuk sebagai pengampu berarti boleh menyunting RPKPS ini — dan
          hanya RPKPS ini, termasuk bila dosennya berasal dari program studi
          lain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          {pengampu.map((p) => (
            <li key={p.penggunaId} className="flex flex-wrap items-center gap-2">
              <span>{p.nama}</span>
              {p.nidn ? (
                <span className="text-xs text-muted-foreground">NIDN {p.nidn}</span>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  NIDN belum diisi
                </Badge>
              )}
              {p.koordinator ? (
                <Badge variant="secondary" className="text-[10px]">
                  Koordinator
                </Badge>
              ) : null}

              {bolehKelola && !p.koordinator ? (
                <span className="ms-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={menunggu}
                    onClick={() =>
                      jalankan(() => serahTerimaKoordinator(rpkpsId, p.penggunaId))
                    }
                    title="Serahkan koordinasi kepada dosen ini"
                  >
                    <Crown />
                    Jadikan koordinator
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={menunggu}
                    onClick={() => jalankan(() => lepasPengampu(rpkpsId, p.penggunaId))}
                    title="Lepas dari tim pengampu"
                  >
                    <UserMinus />
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {bolehKelola ? (
          <div className="space-y-2 border-t pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-64 space-y-1.5">
                <Label htmlFor="calon-pengampu">Tambahkan dosen</Label>
                <Select value={pilihan} onValueChange={(v) => setPilihan(v ?? "")}>
                  <SelectTrigger id="calon-pengampu">
                    <SelectValue placeholder="Pilih dosen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {tersedia.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nama}
                        {c.prodi ? ` · ${c.prodi}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={menunggu || pilihan === ""}
                onClick={() =>
                  jalankan(() => tambahPengampu(rpkpsId, pilihan), {
                    sesudah: () => setPilihan(""),
                  })
                }
              >
                <UserPlus />
                Tambahkan
              </Button>
            </div>
            {anggota.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada anggota selain koordinator. Menambahkan dosen di sini
                adalah cara mengirim RPKPS ini kepadanya — ia langsung melihatnya
                di daftar RPKPS miliknya.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// BAGIKAN
// ─────────────────────────────────────────────────────────────

function TombolSalinTeks({ teks, label }: { teks: string; label: string }) {
  const [tersalin, setTersalin] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
          setTersalin(true);
          toast.success("Tautan disalin.");
          setTimeout(() => setTersalin(false), 2000);
        } catch {
          // Peramban lama dan konteks non-HTTPS menolak Clipboard API. Alamatnya
          // tetap terlihat penuh di sebelah tombol, jadi masih dapat disalin
          // manual — pesan ini yang memberi tahu bahwa itu yang harus dilakukan.
          toast.error("Peramban menolak menyalin otomatis. Salin manual dari kolom di samping.");
        }
      }}
    >
      {tersalin ? <Check /> : <Copy />}
      {label}
    </Button>
  );
}

export function PanelBagikan({
  rpkpsId,
  urlPublik,
  statusLabel,
}: {
  rpkpsId: string;
  /** null bila RPKPS belum terbit — belum ada alamat publik yang sah. */
  urlPublik: string | null;
  statusLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bagikan</CardTitle>
        <CardDescription>
          {urlPublik
            ? "Alamat publik ini menampilkan salinan beku yang disahkan, lengkap dengan sidiknya. Dapat dibuka tanpa akun."
            : `Alamat publik baru terbit setelah Kaprodi mengesahkan dokumen. Status sekarang: ${statusLabel}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {urlPublik ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={urlPublik} className="w-full font-mono text-xs sm:w-auto sm:flex-1" />
            <TombolSalinTeks teks={urlPublik} label="Salin tautan" />
            <ButtonLink variant="ghost" size="sm" href={urlPublik} target="_blank">
              <Link2 />
              Buka
            </ButtonLink>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Untuk sementara, bagikan berkas DOCX di bawah — atau tambahkan
            rekan Anda ke tim pengampu supaya ia dapat membukanya langsung di
            aplikasi.
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <ButtonLink variant="outline" size="sm" href={`/api/rpkps/${rpkpsId}/docx`}>
            <Download />
            Unduh DOCX
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// PENGELOLAAN DOKUMEN — salin, arsip, hapus
// ─────────────────────────────────────────────────────────────

export type SasaranSalin = {
  id: string;
  kode: string;
  nama: string;
  semester: number;
  /** Tahun akademik yang sudah punya RPKPS untuk MK ini. */
  taTerpakai: string[];
};

export function ZonaKelola({
  rpkpsId,
  status,
  kodeMk,
  alasanTakDapatDihapus,
  sasaran,
  tahun,
}: {
  rpkpsId: string;
  status: string;
  kodeMk: string;
  /** Kosong berarti RPKPS ini memenuhi syarat penghapusan. */
  alasanTakDapatDihapus: string[];
  sasaran: SasaranSalin[];
  tahun: { id: string; kode: string }[];
}) {
  const diarsipkan = status === "ARSIP";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pengelolaan dokumen</CardTitle>
        <CardDescription>
          Menyalin isinya ke mata kuliah atau tahun akademik lain, menarik
          dokumen dari peredaran, atau membuang draf yang salah dibuat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <DialogSalin rpkpsId={rpkpsId} sasaran={sasaran} tahun={tahun} />
        {diarsipkan ? (
          <TombolPulihkan rpkpsId={rpkpsId} />
        ) : (
          <DialogArsip rpkpsId={rpkpsId} kodeMk={kodeMk} />
        )}
        <DialogHapus
          rpkpsId={rpkpsId}
          kodeMk={kodeMk}
          alasan={alasanTakDapatDihapus}
        />
      </CardContent>
    </Card>
  );
}

function TombolPulihkan({ rpkpsId }: { rpkpsId: string }) {
  const { menunggu, jalankan } = useAksiKelola();
  return (
    <Button
      variant="outline"
      disabled={menunggu}
      onClick={() => jalankan(() => pulihkanRpkps(rpkpsId))}
    >
      <ArchiveRestore />
      {menunggu ? "Mengembalikan…" : "Kembalikan dari arsip"}
    </Button>
  );
}

function DialogArsip({ rpkpsId, kodeMk }: { rpkpsId: string; kodeMk: string }) {
  const { menunggu, jalankan } = useAksiKelola();
  const [buka, setBuka] = useState(false);
  const [alasan, setAlasan] = useState("");

  const panjang = alasan.trim().length;
  const cukup = panjang >= MIN_CATATAN_REVISI;

  return (
    <Dialog
      open={buka}
      onOpenChange={(t) => {
        setBuka(t);
        if (!t) setAlasan("");
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Archive />
        Arsipkan
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Arsipkan {kodeMk}</DialogTitle>
          <DialogDescription>
            Tidak ada yang dihapus: seluruh pertemuan, tugas, nilai, dan salinan
            beku tetap utuh dan dapat dikembalikan. Bila RPKPS ini sudah terbit,
            halaman katalog publiknya ikut ditarik.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!cukup) return;
            jalankan(() => arsipkanRpkps(rpkpsId, alasan.trim()), {
              sesudah: () => setBuka(false),
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="alasan-arsip">Alasan pengarsipan</Label>
            <textarea
              id="alasan-arsip"
              rows={4}
              autoFocus
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: Mata kuliah tidak dibuka pada semester ini karena peminat kurang dari 5 mahasiswa."
              className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Tercatat permanen di histori dokumen.
            </p>
            <span
              className={cn(
                "label-teknis shrink-0 tabular-nums",
                cukup ? "text-muted-foreground/70" : "text-warning",
              )}
            >
              {panjang}/{MIN_CATATAN_REVISI}
            </span>
          </div>

          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="ghost" />}>Batal</DialogClose>
            <Button type="submit" disabled={menunggu || !cukup}>
              {menunggu ? "Mengarsipkan…" : "Arsipkan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Penghapusan diminta mengetik kode mata kuliah.
 *
 * Bukan pengaman utama — pengamannya `periksaKelayakanHapus` di server, yang
 * menghitung ulang sensus saat tombol ditekan. Ini semata memperlambat
 * gerakan refleks pada tindakan yang tidak punya tombol urung.
 */
function DialogHapus({
  rpkpsId,
  kodeMk,
  alasan,
}: {
  rpkpsId: string;
  kodeMk: string;
  alasan: string[];
}) {
  const { menunggu, jalankan } = useAksiKelola();
  const [buka, setBuka] = useState(false);
  const [ketikan, setKetikan] = useState("");

  const terhalang = alasan.length > 0;
  const cocok = ketikan.trim().toUpperCase() === kodeMk.toUpperCase();

  return (
    <Dialog
      open={buka}
      onOpenChange={(t) => {
        setBuka(t);
        if (!t) setKetikan("");
      }}
    >
      <DialogTrigger render={<Button variant="ghost" className="text-destructive" />}>
        <Trash2 />
        Hapus
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hapus RPKPS {kodeMk}</DialogTitle>
          <DialogDescription>
            {terhalang
              ? "RPKPS ini tidak memenuhi syarat penghapusan."
              : "Seluruh pertemuan, tugas, kisi-kisi, dan pustaka ikut terhapus permanen. Tidak ada tombol urung."}
          </DialogDescription>
        </DialogHeader>

        {terhalang ? (
          <div className="space-y-3">
            <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted-foreground">
              {alasan.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="text-sm">
              Gunakan <strong>Arsipkan</strong> untuk menariknya dari peredaran
              tanpa melenyapkan apa pun.
            </p>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>Tutup</DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!cocok) return;
              jalankan(() => hapusRpkps(rpkpsId), {
                sesudah: () => setBuka(false),
                tujuan: () => "/rpkps",
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="konfirmasi-hapus">
                Ketik <span className="font-mono">{kodeMk}</span> untuk menegaskan
              </Label>
              <Input
                id="konfirmasi-hapus"
                autoFocus
                autoComplete="off"
                value={ketikan}
                onChange={(e) => setKetikan(e.target.value)}
                placeholder={kodeMk}
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>Batal</DialogClose>
              <Button type="submit" variant="destructive" disabled={menunggu || !cocok}>
                {menunggu ? "Menghapus…" : "Hapus permanen"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogSalin({
  rpkpsId,
  sasaran,
  tahun,
}: {
  rpkpsId: string;
  sasaran: SasaranSalin[];
  tahun: { id: string; kode: string }[];
}) {
  const { menunggu, jalankan } = useAksiKelola();
  const [buka, setBuka] = useState(false);
  const [mkId, setMkId] = useState("");
  const [taId, setTaId] = useState("");

  const mk = sasaran.find((s) => s.id === mkId);
  const bentrok = mk !== undefined && taId !== "" && mk.taTerpakai.includes(taId);
  const siap = mkId !== "" && taId !== "" && !bentrok;

  return (
    <Dialog
      open={buka}
      onOpenChange={(t) => {
        setBuka(t);
        if (!t) {
          setMkId("");
          setTaId("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <CopyPlus />
        Salin
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Salin RPKPS ini</DialogTitle>
          <DialogDescription>
            Salinan lahir sebagai draf baru dengan Anda sebagai koordinator.
            Nilai, kelas, evaluasi, dan salinan beku tidak pernah ikut.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!siap) return;
            jalankan(
              () => salinRpkps(rpkpsId, { mataKuliahId: mkId, tahunAkademikId: taId }),
              {
                sesudah: () => setBuka(false),
                tujuan: (h) => (h.id ? `/rpkps/${h.id}` : null),
              },
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="salin-mk">Mata kuliah tujuan</Label>
            <Select value={mkId} onValueChange={(v) => setMkId(v ?? "")}>
              <SelectTrigger id="salin-mk">
                <SelectValue placeholder="Pilih mata kuliah…" />
              </SelectTrigger>
              <SelectContent>
                {sasaran.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.kode} — {s.nama} (smt {s.semester})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salin-ta">Tahun akademik tujuan</Label>
            <Select value={taId} onValueChange={(v) => setTaId(v ?? "")}>
              <SelectTrigger id="salin-ta">
                <SelectValue placeholder="Pilih tahun akademik…" />
              </SelectTrigger>
              <SelectContent>
                {tahun.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.kode.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bentrok ? (
            <p className="text-sm text-destructive">
              {mk?.kode} sudah punya RPKPS untuk tahun akademik itu. Satu mata
              kuliah hanya boleh punya satu RPKPS per tahun akademik.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Bila mata kuliah tujuan berbeda dari asalnya, pemetaan Sub-CPMK dan
            kisi-kisi ujian tidak ikut disalin — capaian milik mata kuliah lain
            tidak sah di sana, dan harus dipetakan ulang.
          </p>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Batal</DialogClose>
            <Button type="submit" disabled={menunggu || !siap}>
              {menunggu ? "Menyalin…" : "Salin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
