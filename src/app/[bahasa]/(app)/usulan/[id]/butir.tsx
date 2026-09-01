"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEVEL_BLOOM } from "@/domain/kurikulum/bloom";
import type { JenisButir } from "@/domain/kurikulum/usulan";
import { AreaTeks, Pilihan } from "@/components/ui/pilihan";
import { JENIS_BERSASARAN_SUB, JENIS_BERUMUSAN } from "../label";
import { hapusButir, tambahButir, type Hasil } from "../aksi";

function useAksi() {
  const [menunggu, mulai] = useTransition();
  const router = useRouter();
  const jalankan = (fn: () => Promise<Hasil>, sesudah?: () => void) =>
    mulai(async () => {
      const hasil = await fn();
      if (hasil.ok) {
        toast.success(hasil.pesan);
        sesudah?.();
        router.refresh();
      } else {
        toast.error(hasil.pesan);
      }
    });
  return { menunggu, jalankan };
}

export function TombolHapusButir({ butirId }: { butirId: string }) {
  const { menunggu, jalankan } = useAksi();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="ml-auto text-muted-foreground"
      disabled={menunggu}
      onClick={() => jalankan(() => hapusButir(butirId))}
    >
      <Trash2 />
      Hapus
    </Button>
  );
}

const URUTAN_JENIS: JenisButir[] = [
  "SUB_RUMUSAN",
  "SUB_BARU",
  "SUB_MINGGU",
  "SUB_PENSIUN",
  "CPMK_RUMUSAN",
  "CPMK_BARU",
  "CPMK_PETA_CPL",
  "CPMK_PENSIUN",
  "CATATAN_CPL",
];

/**
 * Formulir satu butir.
 *
 * Isian ditampilkan menurut jenis butir supaya dosen tidak diminta mengisi
 * kolom yang tidak berarti bagi jenis yang dipilihnya. Validasi sebenarnya
 * tetap di server — yang di sini hanya soal tidak membingungkan.
 */
export function FormulirButir({ usulanId, mkKode }: { usulanId: string; mkKode: string }) {
  const { menunggu, jalankan } = useAksi();
  const { k, isi } = useBahasa();
  const [jenis, setJenis] = useState<JenisButir>("SUB_RUMUSAN");
  const [dasarJenis, setDasarJenis] = useState("CATATAN_DOSEN");
  const [kunciBentuk, setKunciBentuk] = useState(0);

  const perluRumusan = JENIS_BERUMUSAN.includes(jenis);
  const perluSub = JENIS_BERSASARAN_SUB.includes(jenis);
  const perluCpl = jenis === "CPMK_BARU" || jenis === "CPMK_PETA_CPL";
  const perluMinggu = jenis === "SUB_BARU" || jenis === "SUB_MINGGU";
  const adalahCatatan = jenis === "CATATAN_CPL";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.usulan.butir.judul}</CardTitle>
        <CardDescription>
          Satu butir = satu perubahan yang dapat diterima atau ditolak sendiri.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          key={kunciBentuk}
          action={(fd) =>
            jalankan(
              () => tambahButir(usulanId, fd),
              () => setKunciBentuk((n) => n + 1),
            )
          }
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jenis">{k.usulan.butir.jenisPerubahan}</Label>
              <Pilihan
                id="jenis"
                nama="jenis"
                nilai={jenis}
                onChange={(n) => setJenis(n as JenisButir)}
              >
                {URUTAN_JENIS.map((j) => (
                  <option key={j} value={j}>
                    {k.enum.jenisButir[j]}
                  </option>
                ))}
              </Pilihan>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cpmkKode">
                {isi(k.usulan.butir.kodeCpmk, {
                  sifat:
                    jenis === "CPMK_BARU"
                      ? k.usulan.butir.sifatBaru
                      : k.usulan.butir.sifatSasaran,
                })}
              </Label>
              <Input id="cpmkKode" name="cpmkKode" placeholder="CPMK081" />
            </div>
          </div>

          {perluSub ? (
            <div className="space-y-1.5">
              <Label htmlFor="subCpmkKode">
                {isi(k.usulan.butir.kodeSubCpmk, {
                  sifat:
                    jenis === "SUB_BARU"
                      ? k.usulan.butir.sifatBaru
                      : k.usulan.butir.sifatSasaran,
                })}
              </Label>
              <Input id="subCpmkKode" name="subCpmkKode" placeholder="CPMK081-3" />
            </div>
          ) : null}

          {perluRumusan ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="rumusan">{k.usulan.butir.rumusan}</Label>
                <AreaTeks
                  id="rumusan"
                  nama="rumusan"
                  placeholder={k.usulan.butir.contohRumusan}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="levelBloom">{k.usulan.butir.levelBloom}</Label>
                <Pilihan id="levelBloom" nama="levelBloom" className="sm:w-44">
                  <option value="">{k.usulan.butir.deteksiBloom}</option>
                  {LEVEL_BLOOM.map((l) => (
                    <option key={l.level} value={l.level}>
                      {l.level} · {l.nama}
                    </option>
                  ))}
                </Pilihan>
              </div>
            </div>
          ) : null}

          {perluCpl ? (
            <div className="space-y-1.5">
              <Label htmlFor="cplKode">{k.usulan.butir.cplDijabarkan}</Label>
              <Input id="cplKode" name="cplKode" placeholder={k.usulan.butir.contohCpl} />
              <p className="text-xs text-muted-foreground">
                {isi(k.usulan.butir.cplPetunjuk, { mk: mkKode })}
              </p>
            </div>
          ) : null}

          {perluMinggu ? (
            <div className="space-y-1.5">
              <Label htmlFor="mingguDisarankan">{k.usulan.butir.mingguDisarankan}</Label>
              <Input
                id="mingguDisarankan"
                name="mingguDisarankan"
                placeholder={k.usulan.butir.contohMinggu}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="alasan">{k.usulan.butir.alasan}</Label>
            <AreaTeks
              id="alasan"
              nama="alasan"
              placeholder={k.usulan.butir.contohAlasan}
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium">{k.usulan.butir.dasar}</p>
              <p className="text-xs text-muted-foreground">
                {k.usulan.butir.dasarPetunjuk}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dasarJenis">{k.usulan.butir.jenisDasar}</Label>
                <Pilihan
                  id="dasarJenis"
                  nama="dasarJenis"
                  nilai={dasarJenis}
                  onChange={setDasarJenis}
                >
                  {Object.entries(k.enum.jenisDasar).map(([nilai, label]) => (
                    <option key={nilai} value={nilai}>
                      {label}
                    </option>
                  ))}
                </Pilihan>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dasarRef">
                  {isi(k.usulan.butir.rujukan, {
                    sifat:
                      dasarJenis === "CATATAN_DOSEN"
                        ? k.usulan.butir.sifatOpsional
                        : k.usulan.butir.sifatWajib,
                  })}
                </Label>
                <Input
                  id="dasarRef"
                  name="dasarRef"
                  placeholder={
                    dasarJenis === "TEMUAN_VALIDATOR"
                      ? "K-SUB-TIDAK-TERUKUR"
                      : k.usulan.butir.contohRujukanUmum
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dasarKutipan">{k.usulan.butir.kutipan}</Label>
              <AreaTeks
                id="dasarKutipan"
                nama="dasarKutipan"
                baris={2}
                placeholder={k.usulan.butir.contohKutipan}
              />
            </div>
          </div>

          {adalahCatatan ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              {k.usulan.butir.catatanCplAwal}{" "}
              <strong>{k.usulan.butir.catatanCplTebal}</strong>
              {k.usulan.butir.catatanCplAkhir}
            </p>
          ) : null}

          <Button type="submit" disabled={menunggu}>
            <Plus />
            {k.usulan.butir.tambah}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
