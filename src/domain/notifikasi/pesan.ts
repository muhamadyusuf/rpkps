/**
 * Peristiwa sebuah notifikasi, disusun menjadi kunci kalimat dan parameternya.
 *
 * Murni dan terpisah dari pengiriman karena inilah bagian yang paling sering
 * salah dan paling mahal salahnya: notifikasi dibaca sekilas di sela pekerjaan
 * lain, jadi judul yang kabur ("RPKPS diperbarui") membuat orang membuka
 * halaman untuk mencari tahu apa yang sebenarnya terjadi — persis kerja yang
 * hendak dihemat. Karena itu setiap kalimat menyebut TIGA hal: apa yang
 * terjadi, pada dokumen mana, dan oleh siapa.
 *
 * Sejak L3 (docs/11 §4.2) yang dihasilkan berkas ini bukan lagi kalimat,
 * melainkan `kunci` dan `params`. Sebuah notifikasi ditulis sekali dan dibaca
 * berbulan-bulan kemudian, kadang oleh orang lain: merangkai kalimatnya saat
 * menulis membekukan bahasa PENULIS ke dalam kotak masuk PEMBACA.
 */

export type JenisNotifikasi =
  | "RPKPS_MINTA_PARAF"
  | "RPKPS_DIAJUKAN"
  | "RPKPS_DISETUJUI"
  | "RPKPS_MENUNGGU_PENGESAHAN"
  | "RPKPS_DISAHKAN"
  | "RPKPS_DIREVISI"
  | "RPKPS_PENGAMPU"
  | "KOORDINATOR_MK_DITETAPKAN"
  | "USULAN_DIAJUKAN"
  | "USULAN_DIPUTUSKAN";

export type Peristiwa =
  /**
   * Diminta, bukan terjadi. Koordinator menekan "Minta paraf" ketika tim belum
   * lengkap memaraf — dan tanpa itu satu-satunya cara mereka tahu adalah
   * membuka dasbor sendiri.
   */
  | { jenis: "RPKPS_MINTA_PARAF"; rpkpsId: string; mk: string; ta: string; oleh: string }
  | { jenis: "RPKPS_DIAJUKAN"; rpkpsId: string; mk: string; ta: string; oleh: string }
  | { jenis: "RPKPS_DISETUJUI"; rpkpsId: string; mk: string; ta: string; oleh: string }
  | {
      jenis: "RPKPS_MENUNGGU_PENGESAHAN";
      rpkpsId: string;
      mk: string;
      ta: string;
      oleh: string;
      prodi: string;
    }
  | { jenis: "RPKPS_DISAHKAN"; rpkpsId: string; mk: string; ta: string; oleh: string }
  | {
      jenis: "RPKPS_DIREVISI";
      rpkpsId: string;
      mk: string;
      ta: string;
      oleh: string;
      catatan: string;
    }
  | {
      jenis: "RPKPS_PENGAMPU";
      rpkpsId: string;
      mk: string;
      ta: string;
      oleh: string;
      peran: "KOORDINATOR" | "ANGGOTA";
    }
  | {
      jenis: "KOORDINATOR_MK_DITETAPKAN";
      /** Alamatnya RPKPS bila sudah ada — di situlah pekerjaannya. */
      rpkpsId: string | null;
      kurikulumId: string;
      mataKuliahId: string;
      mk: string;
      ta: string;
      oleh: string;
    }
  | { jenis: "USULAN_DIAJUKAN"; usulanId: string; judul: string; oleh: string }
  | {
      jenis: "USULAN_DIPUTUSKAN";
      usulanId: string;
      judul: string;
      oleh: string;
      keputusan: "DISAHKAN" | "DIREVISI" | "DITOLAK";
      catatan: string | null;
    };

/**
 * Kunci kalimat notifikasi.
 *
 * Sengaja BUKAN `JenisNotifikasi`: satu jenis dapat berbunyi dua cara — seorang
 * pengampu diberi tahu berbeda ketika ia koordinator, dan penugasan koordinator
 * berbunyi lain ketika RPKPS-nya belum ada. Jenis adalah enum basis data yang
 * menandai peristiwanya; kunci menandai kalimatnya.
 */
export type KunciNotifikasi =
  | "RPKPS_MINTA_PARAF"
  | "RPKPS_DIAJUKAN"
  | "RPKPS_DISETUJUI"
  | "RPKPS_MENUNGGU_PENGESAHAN"
  | "RPKPS_DISAHKAN"
  | "RPKPS_DIREVISI"
  | "RPKPS_PENGAMPU_KOORDINATOR"
  | "RPKPS_PENGAMPU_ANGGOTA"
  | "KOORDINATOR_MK_TANPA_RPKPS"
  | "KOORDINATOR_MK_DENGAN_RPKPS"
  | "USULAN_DIAJUKAN"
  | "USULAN_DIPUTUSKAN"
  | "USULAN_DIPUTUSKAN_TANPA_CATATAN";

export type IsiNotifikasi = {
  jenis: JenisNotifikasi;
  kunci: KunciNotifikasi;
  /** Isian penanda kalimat. Kalimatnya sendiri dirakit saat dibaca. */
  params: Record<string, string>;
  tautan: string;
  entitas: "rpkps" | "usulan" | "mata_kuliah";
  entitasId: string;
};

/** Batas panjang catatan yang ikut terbawa; selebihnya dibaca di halamannya. */
const BATAS_CATATAN = 160;

export function ringkasCatatan(catatan: string, batas = BATAS_CATATAN): string {
  const bersih = catatan.trim().replace(/\s+/g, " ");
  if (bersih.length <= batas) return bersih;
  return `${bersih.slice(0, batas - 1).trimEnd()}…`;
}

export function susunNotifikasi(p: Peristiwa): IsiNotifikasi {
  switch (p.jenis) {
    case "RPKPS_MINTA_PARAF":
    case "RPKPS_DIAJUKAN":
    case "RPKPS_DISETUJUI":
    case "RPKPS_DISAHKAN":
      return {
        jenis: p.jenis,
        kunci: p.jenis,
        params: { mk: p.mk, ta: p.ta, oleh: p.oleh },
        tautan: `/rpkps/${p.rpkpsId}`,
        entitas: "rpkps",
        entitasId: p.rpkpsId,
      };

    case "RPKPS_MENUNGGU_PENGESAHAN":
      return {
        jenis: p.jenis,
        kunci: p.jenis,
        params: { mk: p.mk, ta: p.ta, oleh: p.oleh, prodi: p.prodi },
        tautan: `/rpkps/${p.rpkpsId}`,
        entitas: "rpkps",
        entitasId: p.rpkpsId,
      };

    case "RPKPS_DIREVISI":
      return {
        jenis: p.jenis,
        kunci: p.jenis,
        params: { mk: p.mk, ta: p.ta, oleh: p.oleh, catatan: ringkasCatatan(p.catatan) },
        tautan: `/rpkps/${p.rpkpsId}`,
        entitas: "rpkps",
        entitasId: p.rpkpsId,
      };

    case "RPKPS_PENGAMPU":
      return {
        jenis: p.jenis,
        kunci:
          p.peran === "KOORDINATOR"
            ? "RPKPS_PENGAMPU_KOORDINATOR"
            : "RPKPS_PENGAMPU_ANGGOTA",
        params: { mk: p.mk, ta: p.ta, oleh: p.oleh },
        tautan: `/rpkps/${p.rpkpsId}`,
        entitas: "rpkps",
        entitasId: p.rpkpsId,
      };

    case "KOORDINATOR_MK_DITETAPKAN":
      /**
       * Dua alamat, dipilih di sini dan bukan di pemanggil: selama RPKPS-nya
       * belum ada, mengarahkan ke `/rpkps/null` adalah cara tercepat membuat
       * notifikasi berhenti diklik. Halaman mata kuliah memuat tombol
       * pembuatannya, jadi tujuannya tetap satu langkah dari pekerjaan.
       */
      return {
        jenis: p.jenis,
        kunci:
          p.rpkpsId === null
            ? "KOORDINATOR_MK_TANPA_RPKPS"
            : "KOORDINATOR_MK_DENGAN_RPKPS",
        params: { mk: p.mk, ta: p.ta, oleh: p.oleh },
        tautan:
          p.rpkpsId === null
            ? `/kurikulum/${p.kurikulumId}/mk/${p.mataKuliahId}`
            : `/rpkps/${p.rpkpsId}`,
        entitas: p.rpkpsId === null ? "mata_kuliah" : "rpkps",
        entitasId: p.rpkpsId ?? p.mataKuliahId,
      };

    case "USULAN_DIAJUKAN":
      return {
        jenis: p.jenis,
        kunci: p.jenis,
        params: { judul: p.judul, oleh: p.oleh },
        tautan: `/usulan/${p.usulanId}`,
        entitas: "usulan",
        entitasId: p.usulanId,
      };

    case "USULAN_DIPUTUSKAN": {
      const berkatatan = Boolean(p.catatan && p.catatan.trim().length > 0);
      return {
        jenis: p.jenis,
        kunci: berkatatan ? "USULAN_DIPUTUSKAN" : "USULAN_DIPUTUSKAN_TANPA_CATATAN",
        params: {
          judul: p.judul,
          oleh: p.oleh,
          // Kata keputusannya tidak ikut: ia enum, dan kamus punya labelnya.
          keputusan: p.keputusan,
          ...(berkatatan ? { catatan: ringkasCatatan(p.catatan ?? "") } : {}),
        },
        tautan: `/usulan/${p.usulanId}`,
        entitas: "usulan",
        entitasId: p.usulanId,
      };
    }
  }
}
