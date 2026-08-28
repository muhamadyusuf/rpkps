import { Activity, Settings, Users } from "lucide-react";
import { BaganBatang, BaganTumpuk, Denyut } from "@/components/bagan";
import { LABEL_PERAN } from "@/lib/otorisasi";
import { Bagian, KartuAngka, Kosong, Panel } from "./bagian";
import type { DataAdmin } from "@/lib/dasbor/muat";
import type { Peran } from "@/generated/prisma";

/**
 * Panel administrator — doc 07 §3.5.
 *
 * Isinya kesehatan master data, bukan capaian akademik. Satu hal yang
 * sengaja ditonjolkan: prodi aktif yang belum punya Kaprodi. Selama kursi itu
 * kosong, usulan revisi di prodi tersebut tidak akan pernah diputuskan, dan
 * tidak ada tempat lain di aplikasi ini yang memberi tahu.
 */
export function PanelAdmin({ data }: { data: DataAdmin }) {
  const puncak = Math.max(1, ...data.sebaranPeran.map((p) => p.jumlah));

  return (
    <Bagian
      judul="Administrasi Sistem"
      keterangan="Master data dan kesehatan pemakaian."
      ikon={<Settings className="size-4" />}
      aksi={{ href: "/pengguna", label: "Kelola pengguna" }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KartuAngka
          judul="Program studi"
          angka={data.jumlahProdi}
          keterangan="prodi aktif"
          href="/master/prodi"
        />
        <KartuAngka
          judul="Tahun akademik"
          angka={data.jumlahTahun}
          keterangan="periode terdaftar"
          href="/master/tahun-akademik"
        />
        <KartuAngka
          judul="Pengguna"
          angka={data.jumlahPengguna}
          keterangan={
            data.menungguVerifikasi > 0
              ? `${data.menungguVerifikasi} menunggu verifikasi`
              : "semua terverifikasi"
          }
          sorot={data.menungguVerifikasi > 0}
          ikon={<Users className="size-3.5" />}
          href="/pengguna"
        />
        <KartuAngka
          judul="Prodi tanpa Kaprodi"
          angka={data.prodiTanpaKaprodi.length}
          keterangan={
            data.prodiTanpaKaprodi.length > 0
              ? data.prodiTanpaKaprodi.join(", ")
              : "setiap prodi punya pemutus"
          }
          sorot={data.prodiTanpaKaprodi.length > 0}
          href="/pengguna"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          judul="Sebaran peran"
          keterangan="Jumlah penugasan, bukan jumlah orang: satu pengguna dapat memegang beberapa peran."
        >
          {data.sebaranPeran.length === 0 ? (
            <Kosong pesan="Belum ada penugasan peran." />
          ) : (
            <BaganBatang
              satuan=""
              maks={puncak}
              data={data.sebaranPeran.map((p) => ({
                label: LABEL_PERAN[p.peran as Peran] ?? p.peran,
                nilai: p.jumlah,
                nada: "cahaya",
              }))}
            />
          )}
        </Panel>

        <Panel
          judul="Status kurikulum"
          keterangan="RPKPS hanya dapat disusun di atas kurikulum berstatus berlaku."
        >
          <BaganTumpuk segmen={data.statusKurikulum} />
        </Panel>

        <Panel
          judul="Denyut aktivitas"
          keterangan="Kejadian tercatat pada log audit, 14 hari terakhir."
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
