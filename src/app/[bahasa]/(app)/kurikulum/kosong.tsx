"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, X } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pilihan } from "@/components/ui/pilihan";
import { useAksiKurikulum } from "./aksi-klien";
import { buatKurikulumKosong } from "./aksi";

/**
 * Jalur masuk kedua ke lapisan kurikulum: membuat draf kosong tanpa Excel.
 * Acuan: docs/15 §2.5.
 *
 * Sesudah tersimpan, pengguna dilempar ke halaman kurikulum barunya — di
 * situlah CPL dan mata kuliahnya diisi. Membiarkannya di daftar berarti ia
 * harus mencari sendiri baris yang baru saja dibuatnya.
 */
export function TombolKurikulumKosong({
  prodi,
}: {
  prodi: { id: string; nama: string; kode: string }[];
}) {
  const { menunggu, jalankan } = useAksiKurikulum();
  const { k } = useBahasa();
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);

  if (prodi.length === 0) return null;

  if (!terbuka) {
    return (
      <Button variant="outline" onClick={() => setTerbuka(true)}>
        <FilePlus2 />
        {k.kurikulum.sunting.kosongTombol}
      </Button>
    );
  }

  return (
    <form
      className="w-full rounded-lg border border-cahaya/40 p-4"
      action={(fd) => {
        const prodiId = String(fd.get("prodiId") ?? "");
        const nama = String(fd.get("nama") ?? "");
        const tahun = Number(fd.get("tahun") ?? 0);
        jalankan(async () => {
          const hasil = await buatKurikulumKosong(prodiId, nama, tahun);
          // Perpindahan halaman dilakukan DI SINI, bukan lewat redirect() di
          // server: aksi ini juga mengembalikan pesan galat yang perlu tampil
          // di tempat, dan redirect() melempar sebelum pesan itu sampai.
          if (hasil.ok && hasil.kurikulumId) {
            router.push(`/kurikulum/${hasil.kurikulumId}`);
          }
          return hasil;
        });
      }}
    >
      <p className="font-medium">{k.kurikulum.sunting.kosongJudul}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {k.kurikulum.sunting.kosongKeterangan}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1 space-y-1.5">
          <Label htmlFor="kosong-prodi">{k.kurikulum.sunting.prodi}</Label>
          <Pilihan id="kosong-prodi" nama="prodiId">
            {prodi.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} ({p.kode})
              </option>
            ))}
          </Pilihan>
        </div>

        <div className="min-w-52 flex-1 space-y-1.5">
          <Label htmlFor="kosong-nama">{k.kurikulum.sunting.nama}</Label>
          <Input id="kosong-nama" name="nama" placeholder="Kurikulum 2026" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kosong-tahun">{k.kurikulum.sunting.tahun}</Label>
          <Input
            id="kosong-tahun"
            name="tahun"
            type="number"
            min={2000}
            max={2100}
            defaultValue={new Date().getFullYear()}
            className="w-24 tabular-nums"
            required
          />
        </div>

        <Button type="submit" disabled={menunggu}>
          <FilePlus2 />
          {k.kurikulum.sunting.kosongTombol}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={menunggu}
          onClick={() => setTerbuka(false)}
        >
          <X />
          {k.umum.batal}
        </Button>
      </div>
    </form>
  );
}
