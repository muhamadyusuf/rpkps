"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEVEL_BLOOM } from "@/domain/kurikulum/bloom";
import type { JenisButir } from "@/domain/kurikulum/usulan";
import { AreaTeks, Pilihan } from "../pilihan";
import { JENIS_BERSASARAN_SUB, JENIS_BERUMUSAN, LABEL_DASAR, LABEL_JENIS } from "../label";
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
        <CardTitle className="text-base">Tambah butir</CardTitle>
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
              <Label htmlFor="jenis">Jenis perubahan</Label>
              <Pilihan
                id="jenis"
                nama="jenis"
                nilai={jenis}
                onChange={(n) => setJenis(n as JenisButir)}
              >
                {URUTAN_JENIS.map((j) => (
                  <option key={j} value={j}>
                    {LABEL_JENIS[j]}
                  </option>
                ))}
              </Pilihan>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cpmkKode">
                Kode CPMK {jenis === "CPMK_BARU" ? "(baru)" : "sasaran"}
              </Label>
              <Input id="cpmkKode" name="cpmkKode" placeholder="CPMK081" />
            </div>
          </div>

          {perluSub ? (
            <div className="space-y-1.5">
              <Label htmlFor="subCpmkKode">
                Kode Sub-CPMK {jenis === "SUB_BARU" ? "(baru)" : "sasaran"}
              </Label>
              <Input id="subCpmkKode" name="subCpmkKode" placeholder="CPMK081-3" />
            </div>
          ) : null}

          {perluRumusan ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="rumusan">Rumusan yang diusulkan</Label>
                <AreaTeks
                  id="rumusan"
                  nama="rumusan"
                  placeholder="Mahasiswa mampu menerapkan indeks dan rencana eksekusi untuk memperbaiki kinerja kueri."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="levelBloom">Level Bloom</Label>
                <Pilihan id="levelBloom" nama="levelBloom" className="sm:w-44">
                  <option value="">Deteksi dari rumusan</option>
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
              <Label htmlFor="cplKode">CPL yang dijabarkan</Label>
              <Input id="cplKode" name="cplKode" placeholder="CPL06, CPL08" />
              <p className="text-xs text-muted-foreground">
                Hanya CPL yang sudah dibebankan pada {mkKode}. Membebankan CPL baru
                adalah keputusan matriks CPL×MK, di luar kewenangan usulan ini.
              </p>
            </div>
          ) : null}

          {perluMinggu ? (
            <div className="space-y-1.5">
              <Label htmlFor="mingguDisarankan">Minggu disarankan</Label>
              <Input id="mingguDisarankan" name="mingguDisarankan" placeholder="9, 10" />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="alasan">Alasan</Label>
            <AreaTeks
              id="alasan"
              nama="alasan"
              placeholder="Apa yang salah pada rumusan sekarang — bukan sekadar bahwa ia perlu diganti."
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium">Dasar</p>
              <p className="text-xs text-muted-foreground">
                Butir tanpa dasar ditolak sistem sebelum sampai ke Ketua Program
                Studi. Ini yang membedakan revisi berbasis bukti dari karangan.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dasarJenis">Jenis dasar</Label>
                <Pilihan
                  id="dasarJenis"
                  nama="dasarJenis"
                  nilai={dasarJenis}
                  onChange={setDasarJenis}
                >
                  {Object.entries(LABEL_DASAR).map(([nilai, label]) => (
                    <option key={nilai} value={nilai}>
                      {label}
                    </option>
                  ))}
                </Pilihan>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dasarRef">
                  Rujukan {dasarJenis === "CATATAN_DOSEN" ? "(opsional)" : "(wajib)"}
                </Label>
                <Input
                  id="dasarRef"
                  name="dasarRef"
                  placeholder={
                    dasarJenis === "TEMUAN_VALIDATOR" ? "K-SUB-TIDAK-TERUKUR" : "id sumber"
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dasarKutipan">Kutipan / uraian dasar</Label>
              <AreaTeks
                id="dasarKutipan"
                nama="dasarKutipan"
                baris={2}
                placeholder="Kalimat yang dapat diperiksa Kaprodi: angka, sumber, atau argumen."
              />
            </div>
          </div>

          {adalahCatatan ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              Butir ini <strong>tidak akan diterapkan otomatis</strong>. Ia hanya
              tercatat sebagai bahan evaluasi kurikulum berikutnya — perubahan CPL
              dan profil lulusan berada di luar kewenangan usulan tingkat mata kuliah.
            </p>
          ) : null}

          <Button type="submit" disabled={menunggu}>
            <Plus />
            Tambah butir
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
