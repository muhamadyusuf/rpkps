import { Activity, Settings, Users } from "lucide-react";
import { BaganBatang, BaganTumpuk, Denyut } from "@/components/bagan";
import { Bagian, KartuAngka, Kosong, Panel } from "./bagian";
import type { DataAdmin } from "@/lib/dasbor/muat";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { Peran } from "@/generated/prisma";

/**
 * Panel administrator — doc 07 §3.5.
 *
 * Isinya kesehatan master data, bukan capaian akademik. Satu hal yang
 * sengaja ditonjolkan: prodi aktif yang belum punya Kaprodi. Selama kursi itu
 * kosong, usulan revisi di prodi tersebut tidak akan pernah diputuskan, dan
 * tidak ada tempat lain di aplikasi ini yang memberi tahu.
 */
export async function PanelAdmin({ data }: { data: DataAdmin }) {
  const k = await kamus();
  const puncak = Math.max(1, ...data.sebaranPeran.map((p) => p.jumlah));

  return (
    <Bagian
      judul={k.dasbor.admin.judul}
      keterangan={k.dasbor.admin.keterangan}
      ikon={<Settings className="size-4" />}
      aksi={{ href: "/pengguna", label: k.dasbor.admin.aksi }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka
          judul={k.dasbor.admin.prodi}
          angka={data.jumlahProdi}
          keterangan={k.dasbor.admin.prodiKeterangan}
          href="/master/prodi"
        />
        <KartuAngka
          judul={k.dasbor.admin.tahun}
          angka={data.jumlahTahun}
          keterangan={k.dasbor.admin.tahunKeterangan}
          href="/master/tahun-akademik"
        />
        <KartuAngka
          judul={k.dasbor.admin.pengguna}
          angka={data.jumlahPengguna}
          keterangan={
            data.menungguVerifikasi > 0
              ? isi(k.dasbor.admin.menungguVerifikasi, {
                  jumlah: data.menungguVerifikasi,
                })
              : k.dasbor.admin.semuaTerverifikasi
          }
          sorot={data.menungguVerifikasi > 0}
          ikon={<Users className="size-3.5" />}
          href="/pengguna"
        />
        <KartuAngka
          judul={k.dasbor.admin.tanpaKaprodi}
          angka={data.prodiTanpaKaprodi.length}
          keterangan={
            data.prodiTanpaKaprodi.length > 0
              ? data.prodiTanpaKaprodi.join(", ")
              : k.dasbor.admin.adaPemutus
          }
          sorot={data.prodiTanpaKaprodi.length > 0}
          href="/pengguna"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          judul={k.dasbor.admin.sebaranPeran.judul}
          keterangan={k.dasbor.admin.sebaranPeran.keterangan}
        >
          {data.sebaranPeran.length === 0 ? (
            <Kosong pesan={k.dasbor.admin.sebaranPeran.kosong} />
          ) : (
            <BaganBatang
              satuan=""
              maks={puncak}
              data={data.sebaranPeran.map((p) => ({
                label: k.enum.peran[p.peran as Peran] ?? p.peran,
                nilai: p.jumlah,
                nada: "cahaya",
              }))}
            />
          )}
        </Panel>

        <Panel
          judul={k.dasbor.admin.statusKurikulum.judul}
          keterangan={k.dasbor.admin.statusKurikulum.keterangan}
        >
          <BaganTumpuk segmen={data.statusKurikulum} />
        </Panel>

        <Panel
          judul={k.dasbor.admin.denyut.judul}
          keterangan={k.dasbor.admin.denyut.keterangan}
        >
          <div className="flex items-center gap-2">
            <Activity className="size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <Denyut deret={data.denyut} />
            </div>
          </div>
        </Panel>
      </div>
    </Bagian>
  );
}
