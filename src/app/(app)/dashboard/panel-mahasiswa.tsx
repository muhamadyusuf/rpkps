import { GraduationCap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Bagian, Panel } from "./bagian";
import type { DataMahasiswa } from "@/lib/dasbor/muat";

/**
 * Panel mahasiswa — doc 07 §3.7.
 *
 * Sengaja tipis. Aplikasi ini tidak menyimpan tautan antara akun mahasiswa
 * dan baris `Mahasiswa` pada kelas, sehingga tidak ada capaian perorangan
 * yang jujur dapat ditampilkan di sini. Menampilkan angka yang seolah-olah
 * miliknya akan lebih buruk daripada tidak menampilkan apa pun.
 */
export function PanelMahasiswa({ data }: { data: DataMahasiswa }) {
  return (
    <Bagian
      judul="Untuk Mahasiswa"
      keterangan="Rencana pembelajaran yang sudah disahkan program studi."
      ikon={<GraduationCap className="size-4" />}
    >
      <Panel
        judul={data.prodi ? `Katalog ${data.prodi.nama}` : "Katalog RPKPS"}
        keterangan={
          data.prodi
            ? `${data.terbit} RPKPS terbit dan dapat dibaca umum.`
            : "Peran mahasiswa Anda belum ditautkan ke program studi mana pun."
        }
      >
        {data.prodi ? (
          <ButtonLink variant="outline" href={`/katalog/${data.prodi.kode.toLowerCase()}`}>
            Buka katalog {data.prodi.kode}
          </ButtonLink>
        ) : (
          <p className="text-xs text-muted-foreground">
            Hubungi administrator untuk melengkapi penugasan prodi pada akun Anda.
          </p>
        )}
      </Panel>
    </Bagian>
  );
}
