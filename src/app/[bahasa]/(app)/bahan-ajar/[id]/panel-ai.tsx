"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, KeyRound, Loader2, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TemuanBahanAjar } from "@/domain/bahan-ajar/tipe";
import { teksTemuan } from "@/lib/bahasa/temuan";
import { susunBabAi, susunKelengkapanAi, susunKerangkaAi } from "./aksi";

/**
 * Bentuk kunci AI ditulis ulang di sini, bukan diimpor dari
 * `@/lib/ai/kredensial`, supaya komponen klien tidak pernah menarik modul
 * `server-only`.
 */
export type KunciPilihan = {
  id: string;
  penyedia: "ANTHROPIC" | "MISTRAL" | "GEMINI";
  label: string;
  ekor: string;
  modelEfektif: string;
  bawaan: boolean;
};

type Sedang = { tahap: "kerangka" | "kelengkapan" } | { tahap: "bab"; nomor: number } | null;

/**
 * Panel penyusunan AI — docs/16 §3.2.
 *
 * # Mengapa perulangan bab ada DI SINI, bukan di server
 *
 * "Susun semua bab" adalah empat belas panggilan model berurutan, beberapa
 * menit lamanya. Satu Server Action yang menunggu semuanya akan menabrak batas
 * waktu, dan dosen kehilangan seluruh pekerjaan tanpa tahu sampai bab mana ia
 * berhasil. Yang berjalan di sini adalah perulangan yang memanggil
 * `susunBabAi` SATU bab pada satu waktu; tiap bab tersimpan begitu selesai,
 * kemajuannya terlihat, dan berhenti — karena gagal maupun karena dihentikan
 * dosen — meninggalkan bab-bab sebelumnya utuh.
 *
 * Berurutan, bukan paralel: alasannya sama dengan gelombang terjemahan —
 * batas permintaan-per-menit menempel pada kunci milik dosen.
 */
export function PanelAi({
  bukuId,
  bab,
  kredensial,
}: {
  bukuId: string;
  bab: { nomor: number; berisi: boolean }[];
  kredensial: KunciPilihan[];
}) {
  const { k, isi } = useBahasa();
  const router = useRouter();

  const [sedang, setSedang] = useState<Sedang>(null);
  const [catatan, setCatatan] = useState<TemuanBahanAjar[]>([]);
  const [kunci, setKunci] = useState<string>(
    () => kredensial.find((x) => x.bawaan)?.id ?? kredensial[0]?.id ?? "",
  );
  // Ref, bukan state: perulangan di bawah membacanya di antara dua await, dan
  // nilai state akan tetap seperti saat render yang memulainya.
  const berhenti = useRef(false);

  if (kredensial.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{k.bahanAjar.panelJudul}</CardTitle>
          <CardDescription>{k.bahanAjar.tanpaKunci}</CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink href="/pengaturan/ai" size="sm" variant="outline">
            <KeyRound className="size-4" />
            {k.bahanAjar.aturKunci}
          </ButtonLink>
        </CardContent>
      </Card>
    );
  }

  const berjalan = sedang !== null;

  async function jalankanSatu(
    tugas: () => Promise<{ ok: boolean; pesan: string; catatan?: TemuanBahanAjar[] }>,
  ) {
    const hasil = await tugas();
    if (hasil.catatan?.length) setCatatan((lama) => [...lama, ...hasil.catatan!]);
    if (!hasil.ok) toast.error(hasil.pesan);
    return hasil;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{k.bahanAjar.panelJudul}</CardTitle>
        <CardDescription>{k.bahanAjar.panelKeterangan}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {kredensial.length > 1 ? (
          <div className="max-w-xs">
            <Select
              value={kunci}
              onValueChange={(nilai) => setKunci(nilai ?? "")}
              disabled={berjalan}
            >
              <SelectTrigger className="w-full" aria-label={k.bahanAjar.pilihKunci}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kredensial.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.label} · {x.penyedia} · …{x.ekor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={berjalan}
            onClick={async () => {
              setSedang({ tahap: "kerangka" });
              const hasil = await jalankanSatu(() => susunKerangkaAi(bukuId, kunci));
              setSedang(null);
              if (hasil.ok) {
                toast.success(hasil.pesan);
                router.refresh();
              }
            }}
          >
            {sedang?.tahap === "kerangka" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {k.bahanAjar.tombolKerangka}
          </Button>

          <Button
            size="sm"
            disabled={berjalan || bab.length === 0}
            onClick={async () => {
              berhenti.current = false;
              setCatatan([]);
              for (const b of bab) {
                if (berhenti.current) break;
                setSedang({ tahap: "bab", nomor: b.nomor });
                const hasil = await jalankanSatu(() => susunBabAi(bukuId, b.nomor, kunci));
                // Berhenti pada kegagalan pertama: bab berikutnya hampir pasti
                // gagal karena sebab yang sama — kuota habis, kunci ditolak —
                // dan meneruskannya hanya membakar sisanya.
                if (!hasil.ok) break;
                router.refresh();
              }
              setSedang(null);
            }}
          >
            {sedang?.tahap === "bab" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {sedang?.tahap === "bab"
              ? isi(k.bahanAjar.kemajuanBab, {
                  sekarang: sedang.nomor,
                  total: bab.length,
                })
              : k.bahanAjar.tombolSemuaBab}
          </Button>

          {sedang?.tahap === "bab" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                berhenti.current = true;
              }}
            >
              <Square className="size-4" />
              {k.bahanAjar.berhenti}
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            disabled={berjalan || !bab.some((b) => b.berisi)}
            onClick={async () => {
              setSedang({ tahap: "kelengkapan" });
              const hasil = await jalankanSatu(() => susunKelengkapanAi(bukuId, kunci));
              setSedang(null);
              if (hasil.ok) {
                toast.success(hasil.pesan);
                router.refresh();
              }
            }}
          >
            {sedang?.tahap === "kelengkapan" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {k.bahanAjar.tombolKelengkapan}
          </Button>
        </div>

        {catatan.length > 0 ? <DaftarCatatan catatan={catatan} /> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Perbaikan yang dilakukan server atas keluaran model. Ditampilkan apa adanya:
 * yang menandatangani buku ini adalah dosen, dan ia berhak tahu bagian mana
 * yang bukan lagi tulisan model.
 */
function DaftarCatatan({ catatan }: { catatan: TemuanBahanAjar[] }) {
  const { k } = useBahasa();
  return (
    <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
      {catatan.map((c, i) => (
        <li key={`${c.kode}-${i}`} className="flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>{teksTemuan(c, k).pesan}</span>
        </li>
      ))}
    </ul>
  );
}
