import { GraduationCap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Bagian, Panel } from "./bagian";
import { kamus } from "@/lib/bahasa/server";
import { isi } from "@/lib/bahasa/teks";
import type { DataMahasiswa } from "@/lib/dasbor/muat";

/**
 * Panel mahasiswa — doc 07 §3.7.
 *
 * Sengaja tipis. Aplikasi ini tidak menyimpan tautan antara akun mahasiswa
 * dan baris `Mahasiswa` pada kelas, sehingga tidak ada capaian perorangan
 * yang jujur dapat ditampilkan di sini. Menampilkan angka yang seolah-olah
 * miliknya akan lebih buruk daripada tidak menampilkan apa pun.
 */
export async function PanelMahasiswa({ data }: { data: DataMahasiswa }) {
  const k = await kamus();

  return (
    <Bagian
      judul={k.dasbor.mahasiswa.judul}
      keterangan={k.dasbor.mahasiswa.keterangan}
      ikon={<GraduationCap className="size-4" />}
    >
      <Panel
        judul={
          data.prodi
            ? isi(k.dasbor.mahasiswa.katalogProdi, { nama: data.prodi.nama })
            : k.dasbor.mahasiswa.katalogUmum
        }
        keterangan={
          data.prodi
            ? isi(k.dasbor.mahasiswa.terbit, { jumlah: data.terbit })
            : k.dasbor.mahasiswa.tanpaProdi
        }
      >
        {data.prodi ? (
          <ButtonLink variant="outline" href={`/katalog/${data.prodi.kode.toLowerCase()}`}>
            {isi(k.dasbor.mahasiswa.buka, { kode: data.prodi.kode })}
          </ButtonLink>
        ) : (
          <p className="text-xs text-muted-foreground">
            {k.dasbor.mahasiswa.hubungiAdmin}
          </p>
        )}
      </Panel>
    </Bagian>
  );
}
