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
import { useBahasa } from "@/components/penyedia-bahasa";
import { namaMk } from "@/lib/bahasa/teks";
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
import { MIN_ALASAN_HAPUS_PAKSA } from "@/domain/rpkps/daur-hidup";
import { MIN_CATATAN_REVISI } from "@/domain/rpkps/tipe";
import { cn } from "@/lib/utils";
import {
  arsipkanRpkps,
  hapusPaksaRpkps,
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
  const { jalur } = useBahasa();

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
        if (ke) router.push(jalur(ke));
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
  const { k, isi } = useBahasa();
  const { menunggu, jalankan } = useAksiKelola();
  const [pilihan, setPilihan] = useState<string>("");

  const sudah = new Set(pengampu.map((p) => p.penggunaId));
  const tersedia = calon.filter((c) => !sudah.has(c.id));
  const anggota = pengampu.filter((p) => !p.koordinator);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.rpkps.kelola.timJudul}</CardTitle>
        <CardDescription>{k.rpkps.kelola.timKeterangan}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          {pengampu.map((p) => (
            <li key={p.penggunaId} className="flex flex-wrap items-center gap-2">
              <span>{p.nama}</span>
              {p.nidn ? (
                <span className="text-xs text-muted-foreground">
                  {isi(k.rpkps.kelola.nidn, { nomor: p.nidn })}
                </span>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  {k.rpkps.kelola.nidnKosong}
                </Badge>
              )}
              {p.koordinator ? (
                <Badge variant="secondary" className="text-[10px]">
                  {k.rpkps.kelola.koordinator}
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
                    title={k.rpkps.kelola.serahkanPetunjuk}
                  >
                    <Crown />
                    {k.rpkps.kelola.jadikanKoordinator}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={menunggu}
                    onClick={() => jalankan(() => lepasPengampu(rpkpsId, p.penggunaId))}
                    title={k.rpkps.kelola.lepasPetunjuk}
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
                <Label htmlFor="calon-pengampu">{k.rpkps.kelola.tambahkanDosen}</Label>
                <Select value={pilihan} onValueChange={(v) => setPilihan(v ?? "")}>
                  <SelectTrigger id="calon-pengampu">
                    <SelectValue placeholder={k.rpkps.kelola.pilihDosen} />
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
                {k.rpkps.kelola.tambahkan}
              </Button>
            </div>
            {anggota.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {k.rpkps.kelola.tanpaAnggota}
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
  const { k } = useBahasa();
  const [tersalin, setTersalin] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(teks);
          setTersalin(true);
          toast.success(k.rpkps.kelola.tautanDisalin);
          setTimeout(() => setTersalin(false), 2000);
        } catch {
          // Peramban lama dan konteks non-HTTPS menolak Clipboard API. Alamatnya
          // tetap terlihat penuh di sebelah tombol, jadi masih dapat disalin
          // manual — pesan ini yang memberi tahu bahwa itu yang harus dilakukan.
          toast.error(k.rpkps.kelola.salinGagal);
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
  const { k } = useBahasa();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.rpkps.kelola.bagikanJudul}</CardTitle>
        <CardDescription>
          {urlPublik
            ? k.rpkps.kelola.bagikanPublik
            : `Alamat publik baru terbit setelah Kaprodi mengesahkan dokumen. Status sekarang: ${statusLabel}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {urlPublik ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={urlPublik} className="w-full font-mono text-xs sm:w-auto sm:flex-1" />
            <TombolSalinTeks teks={urlPublik} label={k.rpkps.kelola.salinTautan} />
            <ButtonLink variant="ghost" size="sm" href={urlPublik} target="_blank">
              <Link2 />
              {k.rpkps.kelola.buka}
            </ButtonLink>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {k.rpkps.kelola.bagikanBelumTerbit}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <ButtonLink variant="outline" size="sm" href={`/api/rpkps/${rpkpsId}/docx`}>
            <Download />
            {k.rpkps.kelola.unduhDocx}
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
  namaEn: string | null;
  semester: number;
  /** Tahun akademik yang sudah punya RPKPS untuk MK ini. */
  taTerpakai: string[];
};

export function ZonaKelola({
  rpkpsId,
  status,
  kodeMk,
  alasanTakDapatDihapus,
  akibatHapusPaksa,
  bolehHapusPaksa,
  sasaran,
  tahun,
}: {
  rpkpsId: string;
  status: string;
  kodeMk: string;
  /** Kosong berarti RPKPS ini memenuhi syarat penghapusan. */
  alasanTakDapatDihapus: string[];
  /** Apa yang lenyap bila penghapusan tetap dipaksakan (docs/06 §2.6). */
  akibatHapusPaksa: string[];
  /** ADMIN. Selain itu jalur paksa tidak dirender sama sekali. */
  bolehHapusPaksa: boolean;
  sasaran: SasaranSalin[];
  tahun: { id: string; kode: string }[];
}) {
  const { k } = useBahasa();
  const diarsipkan = status === "ARSIP";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.rpkps.kelola.dokumenJudul}</CardTitle>
        <CardDescription>{k.rpkps.kelola.dokumenKeterangan}</CardDescription>
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
          akibatPaksa={akibatHapusPaksa}
          bolehPaksa={bolehHapusPaksa}
        />
      </CardContent>
    </Card>
  );
}

function TombolPulihkan({ rpkpsId }: { rpkpsId: string }) {
  const { k } = useBahasa();
  const { menunggu, jalankan } = useAksiKelola();
  return (
    <Button
      variant="outline"
      disabled={menunggu}
      onClick={() => jalankan(() => pulihkanRpkps(rpkpsId))}
    >
      <ArchiveRestore />
      {menunggu ? k.rpkps.kelola.mengembalikan : k.rpkps.kelola.kembalikanArsip}
    </Button>
  );
}

function DialogArsip({ rpkpsId, kodeMk }: { rpkpsId: string; kodeMk: string }) {
  const { k, isi } = useBahasa();
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
          <DialogTitle>{isi(k.rpkps.kelola.arsipJudul, { kode: kodeMk })}</DialogTitle>
          <DialogDescription>{k.rpkps.kelola.arsipKeterangan}</DialogDescription>
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
            <Label htmlFor="alasan-arsip">{k.rpkps.kelola.alasanArsip}</Label>
            <textarea
              id="alasan-arsip"
              rows={4}
              autoFocus
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder={k.rpkps.kelola.contohAlasanArsip}
              className="w-full resize-y rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {k.rpkps.kelola.tercatatHistori}
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
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {k.rpkps.kelola.batal}
            </DialogClose>
            <Button type="submit" disabled={menunggu || !cukup}>
              {menunggu ? k.rpkps.kelola.mengarsipkan : k.rpkps.kelola.arsipkan}
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
  akibatPaksa,
  bolehPaksa,
}: {
  rpkpsId: string;
  kodeMk: string;
  alasan: string[];
  akibatPaksa: string[];
  bolehPaksa: boolean;
}) {
  const { k, isi } = useBahasa();
  const { menunggu, jalankan } = useAksiKelola();
  const [buka, setBuka] = useState(false);
  const [ketikan, setKetikan] = useState("");
  const [alasanPaksa, setAlasanPaksa] = useState("");

  const terhalang = alasan.length > 0;
  const cocok = ketikan.trim().toUpperCase() === kodeMk.toUpperCase();

  return (
    <Dialog
      open={buka}
      onOpenChange={(t) => {
        setBuka(t);
        if (!t) {
          setKetikan("");
          setAlasanPaksa("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" className="text-destructive" />}>
        <Trash2 />
        Hapus
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isi(k.rpkps.kelola.hapusJudul, { kode: kodeMk })}</DialogTitle>
          <DialogDescription>
            {terhalang
              ? k.rpkps.kelola.hapusTerhalang
              : k.rpkps.kelola.hapusKeterangan}
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
              {k.rpkps.kelola.gunakanArsipAwal}{" "}
              <strong>{k.rpkps.kelola.gunakanArsipTebal}</strong>{" "}
              {k.rpkps.kelola.gunakanArsipAkhir}
            </p>

            {/*
              Jalur paksa hanya dirender untuk ADMIN, dan hanya DI DALAM dialog
              penolakan — supaya urutan yang dibaca tetap: inilah yang
              menghalangi, inilah cara benar menariknya, baru pintu darurat.
              Penjaganya tetap di server (`hapusPaksaRpkps`); yang di sini
              hanya menahan gerakan refleks.
            */}
            {bolehPaksa ? (
              <BagianHapusPaksa
                rpkpsId={rpkpsId}
                kodeMk={kodeMk}
                akibat={akibatPaksa}
                alasanPaksa={alasanPaksa}
                setAlasanPaksa={setAlasanPaksa}
                ketikan={ketikan}
                setKetikan={setKetikan}
                cocok={cocok}
                menunggu={menunggu}
                jalankan={jalankan}
                tutup={() => setBuka(false)}
              />
            ) : null}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>
                {k.rpkps.kelola.tutup}
              </DialogClose>
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
                {k.rpkps.kelola.ketikUntukMenegaskanAwal}{" "}
                <span className="font-mono">{kodeMk}</span>{" "}
                {k.rpkps.kelola.ketikUntukMenegaskanAkhir}
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
              <DialogClose render={<Button type="button" variant="ghost" />}>
                {k.rpkps.kelola.batal}
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={menunggu || !cocok}>
                {menunggu ? k.rpkps.kelola.menghapus : k.rpkps.kelola.hapusPermanen}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pintu darurat administrator: menghapus RPKPS yang sudah disahkan (docs/06
 * §2.4).
 *
 * Tiga hal sengaja ditampilkan berurutan sebelum tombolnya dapat ditekan —
 * apa yang akan lenyap (dihitung server dari basis data, bukan kalimat umum
 * "tindakan ini permanen"), alasan tertulis, lalu kode mata kuliah yang harus
 * diketik ulang. Yang menegakkan semuanya tetap `hapusPaksaRpkps` di server;
 * yang di sini hanya memperlambat.
 */
function BagianHapusPaksa({
  rpkpsId,
  kodeMk,
  akibat,
  alasanPaksa,
  setAlasanPaksa,
  ketikan,
  setKetikan,
  cocok,
  menunggu,
  jalankan,
  tutup,
}: {
  rpkpsId: string;
  kodeMk: string;
  akibat: string[];
  alasanPaksa: string;
  setAlasanPaksa: (nilai: string) => void;
  ketikan: string;
  setKetikan: (nilai: string) => void;
  cocok: boolean;
  menunggu: boolean;
  jalankan: ReturnType<typeof useAksiKelola>["jalankan"];
  tutup: () => void;
}) {
  const { k, isi } = useBahasa();

  const panjang = alasanPaksa.trim().length;
  const cukup = panjang >= MIN_ALASAN_HAPUS_PAKSA;

  return (
    <form
      className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!cukup || !cocok) return;
        jalankan(() => hapusPaksaRpkps(rpkpsId, alasanPaksa.trim()), {
          sesudah: tutup,
          tujuan: () => "/rpkps",
        });
      }}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">{k.rpkps.kelola.paksaJudul}</p>
        <p className="text-xs text-muted-foreground">{k.rpkps.kelola.paksaKeterangan}</p>
      </div>

      {akibat.length > 0 ? (
        <ul className="list-disc space-y-1 ps-5 text-xs text-muted-foreground">
          {akibat.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="alasan-hapus-paksa">{k.rpkps.kelola.paksaAlasan}</Label>
        <textarea
          id="alasan-hapus-paksa"
          rows={3}
          value={alasanPaksa}
          onChange={(e) => setAlasanPaksa(e.target.value)}
          placeholder={k.rpkps.kelola.paksaContohAlasan}
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{k.rpkps.kelola.paksaTercatat}</p>
          <span
            className={cn(
              "label-teknis shrink-0 tabular-nums",
              cukup ? "text-muted-foreground/70" : "text-warning",
            )}
          >
            {panjang}/{MIN_ALASAN_HAPUS_PAKSA}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="konfirmasi-hapus-paksa">
          {k.rpkps.kelola.ketikUntukMenegaskanAwal}{" "}
          <span className="font-mono">{kodeMk}</span>{" "}
          {k.rpkps.kelola.ketikUntukMenegaskanAkhir}
        </Label>
        <Input
          id="konfirmasi-hapus-paksa"
          autoComplete="off"
          value={ketikan}
          onChange={(e) => setKetikan(e.target.value)}
          placeholder={kodeMk}
        />
      </div>

      <Button type="submit" variant="destructive" disabled={menunggu || !cukup || !cocok}>
        <Trash2 />
        {menunggu
          ? k.rpkps.kelola.paksaMenghapus
          : isi(k.rpkps.kelola.paksaTombol, { kode: kodeMk })}
      </Button>
    </form>
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
  const { k, isi, bahasa } = useBahasa();
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
          <DialogTitle>{k.rpkps.kelola.salinJudul}</DialogTitle>
          <DialogDescription>{k.rpkps.kelola.salinKeterangan}</DialogDescription>
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
            <Label htmlFor="salin-mk">{k.rpkps.kelola.mkTujuan}</Label>
            <Select value={mkId} onValueChange={(v) => setMkId(v ?? "")}>
              <SelectTrigger id="salin-mk">
                <SelectValue placeholder={k.rpkps.kelola.pilihMk} />
              </SelectTrigger>
              <SelectContent>
                {sasaran.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.kode} — {namaMk(s, bahasa)} (smt {s.semester})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="salin-ta">{k.rpkps.kelola.taTujuan}</Label>
            <Select value={taId} onValueChange={(v) => setTaId(v ?? "")}>
              <SelectTrigger id="salin-ta">
                <SelectValue placeholder={k.rpkps.kelola.pilihTa} />
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
              {isi(k.rpkps.kelola.bentrok, { kode: mk?.kode ?? "" })}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {k.rpkps.kelola.salinCatatan}
          </p>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              {k.rpkps.kelola.batal}
            </DialogClose>
            <Button type="submit" disabled={menunggu || !siap}>
              {menunggu ? k.rpkps.kelola.menyalin : k.rpkps.kelola.salin}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
