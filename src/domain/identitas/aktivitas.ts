/**
 * Menerjemahkan jejak rantai pengesahan menjadi AKTIVITAS PEGAWAI untuk
 * identitas-itts — bahan penilaian kinerja perilaku (identitas-itts
 * docs/04 §5, docs/24 di sini).
 *
 * Yang dilaporkan hanya fakta: siapa berbuat apa, kapan, kapan perkaranya
 * sampai di mejanya, dan batas yang berlaku baginya. Menilai adalah urusan
 * identitas-itts. Karena itu tidak ada angka "terlambat N hari" di sini —
 * cukup `tenggat` dan `terjadiPada`, dan pembandingnya satu tempat di sana.
 *
 * Murni: tidak mengenal Prisma maupun HTTP.
 */
import { batasTahap, type TahapTenggat, type TenggatSemester } from "@/domain/rpkps/tenggat";

/**
 * Peristiwa `rpkps_riwayat` yang merupakan PERBUATAN pada rantai pengesahan
 * (docs/14 §2). Sengaja dibaca dari `data.kunci`, bukan dari kolom `status`:
 * `DARI_ARSIP_TERBIT` juga berstatus TERBIT tetapi bukan pengesahan, dan
 * baris sebelum docs/14 — ketika Kaprodi menerbitkan langsung — tidak punya
 * kunci rantai sama sekali, jadi tidak ikut terlapor sebagai sesuatu yang
 * bukan dirinya.
 */
export const KUNCI_RANTAI = ["DIPARAF_KOORDINATOR", "DISETUJUI_KAPRODI", "DISAHKAN_MUTU", "DIKEMBALIKAN_REVISI"] as const;
export type KunciRantai = (typeof KUNCI_RANTAI)[number];

export function kunciRantai(data: unknown): KunciRantai | null {
  if (typeof data !== "object" || data === null || !("kunci" in data)) return null;
  const k = (data as { kunci: unknown }).kunci;
  return (KUNCI_RANTAI as readonly unknown[]).includes(k) ? (k as KunciRantai) : null;
}

export type BarisRantai = {
  id: string;
  rpkpsId: string;
  /** Ronde persetujuan. Pengembalian ditulis dengan versi ronde yang dikembalikan. */
  versi: number;
  kunci: KunciRantai;
  olehId: string | null;
  pada: Date;
};

export type KonteksRpkps = {
  /** Dibaca pegawai di rincian kinerjanya, mis. "RPKPS TI214 Basis Data 2026/2027-GANJIL". */
  judul: string;
  tenggat: TenggatSemester;
  jaminanHari: number;
  atribut: Record<string, string | number>;
};

/** Satu butir kiriman `POST /api/v1/aktivitas` identitas-itts. */
export type AktivitasKeluar = {
  id: string;
  jenis: string;
  pelaku: { email: string };
  terjadiPada: string;
  diterimaPada: string | null;
  tenggat: string | null;
  objek: { tipe: "rpkps"; id: string; judul: string };
  nilai: number | null;
  atribut: Record<string, string | number>;
};

type Bersama = {
  konteks: KonteksRpkps;
  /** Surel pengguna RPKPS — pelaku dicocokkan identitas-itts lewat surel sampai RPKPS menjadi klien OIDC. */
  email: (penggunaId: string) => string | undefined;
  /** client_id RPKPS di identitas-itts; setiap jenis wajib berawalan `<awalan>.`. */
  awalan: string;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function susun(
  arg: Bersama & {
    id: string;
    jenis: string;
    olehId: string | null;
    rpkpsId: string;
    pada: Date;
    diterimaPada?: Date | null;
    tenggat?: Date | null;
    nilai?: number | null;
    versi: number;
  },
): AktivitasKeluar[] {
  const email = arg.olehId ? arg.email(arg.olehId) : undefined;
  // Pengguna yang sudah tidak ada tidak dapat dicocokkan ke pegawai mana pun.
  if (!email) return [];
  return [
    {
      id: arg.id,
      jenis: `${arg.awalan}.${arg.jenis}`,
      pelaku: { email },
      terjadiPada: arg.pada.toISOString(),
      diterimaPada: iso(arg.diterimaPada ?? null),
      tenggat: iso(arg.tenggat ?? null),
      objek: { tipe: "rpkps", id: arg.rpkpsId, judul: arg.konteks.judul },
      nilai: arg.nilai ?? null,
      atribut: { ...arg.konteks.atribut, versi: arg.versi },
    },
  ];
}

/**
 * Cap terakhir berkunci tertentu pada ronde yang sama, sebelum `baris`. Itulah
 * saat perkara sampai di meja pelaku `baris`: dokumen sampai ke Kaprodi saat
 * koordinator mengajukan, ke Penjaminan Mutu saat Kaprodi menyetujui.
 */
function capSebelum(baris: BarisRantai, rantai: readonly BarisRantai[], kunci: readonly KunciRantai[]): BarisRantai | null {
  let hasil: BarisRantai | null = null;
  for (const r of rantai) {
    if (r.id === baris.id || r.rpkpsId !== baris.rpkpsId || r.versi !== baris.versi || !kunci.includes(r.kunci)) continue;
    if (r.pada > baris.pada) continue;
    if (!hasil || r.pada >= hasil.pada) hasil = r;
  }
  return hasil;
}

/**
 * Satu baris riwayat → nol, satu, atau dua aktivitas.
 *
 *   DIPARAF_KOORDINATOR  → `diajukan`             koordinator, tenggat penyusunan
 *   DISETUJUI_KAPRODI    → `disetujui`            Kaprodi, tenggat review (+ jaminan N hari)
 *   DIKEMBALIKAN_REVISI  → `dikembalikan_kaprodi` atau `dikembalikan_pmi`, menurut cap sebelumnya
 *   DISAHKAN_MUTU        → `disahkan` (Penjaminan Mutu) DAN `terbit` (koordinator, nilai = putaran revisi)
 *
 * Tenggat pemutus memakai `batasTahap` yang sama dengan antrian kerja
 * (docs/14 §3.2), jadi yang dilaporkan persis batas yang dilihat orangnya di
 * layar — bukan tafsiran kedua.
 */
export function aktivitasRiwayat(arg: Bersama & { baris: BarisRantai; rantai: readonly BarisRantai[] }): AktivitasKeluar[] {
  const { baris, rantai, konteks } = arg;
  const dasar = { ...arg, rpkpsId: baris.rpkpsId, versi: baris.versi, pada: baris.pada, olehId: baris.olehId };
  const batas = (tahap: TahapTenggat, sejak: Date | null) =>
    batasTahap({ tahap, tenggat: konteks.tenggat, sejak, jaminanHari: konteks.jaminanHari });

  switch (baris.kunci) {
    case "DIPARAF_KOORDINATOR":
      return susun({ ...dasar, id: `riwayat:${baris.id}`, jenis: "diajukan", tenggat: batas("PENYUSUNAN", null) });

    case "DISETUJUI_KAPRODI": {
      const sampai = capSebelum(baris, rantai, ["DIPARAF_KOORDINATOR"])?.pada ?? null;
      return susun({ ...dasar, id: `riwayat:${baris.id}`, jenis: "disetujui", diterimaPada: sampai, tenggat: batas("REVIEW", sampai) });
    }

    case "DIKEMBALIKAN_REVISI": {
      // Kaprodi mengembalikan dokumen yang diajukan; Penjaminan Mutu yang disetujui.
      const cap = capSebelum(baris, rantai, ["DIPARAF_KOORDINATOR", "DISETUJUI_KAPRODI"]);
      if (!cap) return [];
      const olehKaprodi = cap.kunci === "DIPARAF_KOORDINATOR";
      return susun({
        ...dasar,
        id: `riwayat:${baris.id}`,
        jenis: olehKaprodi ? "dikembalikan_kaprodi" : "dikembalikan_pmi",
        diterimaPada: cap.pada,
        tenggat: batas(olehKaprodi ? "REVIEW" : "PENGESAHAN", cap.pada),
      });
    }

    case "DISAHKAN_MUTU": {
      const sampai = capSebelum(baris, rantai, ["DISETUJUI_KAPRODI"])?.pada ?? null;
      const koordinator = capSebelum(baris, rantai, ["DIPARAF_KOORDINATOR"]);
      const putaranRevisi = rantai.filter(
        (r) => r.rpkpsId === baris.rpkpsId && r.kunci === "DIKEMBALIKAN_REVISI" && r.pada <= baris.pada,
      ).length;
      return [
        ...susun({ ...dasar, id: `riwayat:${baris.id}`, jenis: "disahkan", diterimaPada: sampai, tenggat: batas("PENGESAHAN", sampai) }),
        // Terbitnya dokumen bukan perbuatan koordinator, tetapi hasil kerjanya:
        // bahan dimensi ketelitian (berapa kali dikembalikan sebelum lolos).
        ...susun({
          ...dasar,
          id: `riwayat:${baris.id}:terbit`,
          jenis: "terbit",
          olehId: koordinator?.olehId ?? null,
          nilai: putaranRevisi,
        }),
      ];
    }
  }
}

/**
 * Paraf seorang pengampu → `paraf_diberikan`.
 *
 * `diterimaPada` = permintaan paraf terakhir (notifikasi RPKPS_MINTA_PARAF)
 * pada ronde yang sama. Permintaan dari ronde sebelum dokumen dikembalikan
 * tidak dihitung: yang diminta saat itu adalah isi yang sudah tidak ada.
 *
 * Tidak ada tenggat: pengampu hanya dapat memaraf setelah koordinator siap
 * dan meminta, jadi mengukurnya terhadap tenggat penyusunan berarti
 * menghukumnya atas keterlambatan orang lain (identitas-itts docs/04 §2 no. 4).
 * Yang diukur adalah waktu tanggapnya sejak diminta.
 */
export function aktivitasParaf(
  arg: Bersama & {
    paraf: { id: string; rpkpsId: string; versi: number; penggunaId: string; pada: Date };
    diminta: readonly Date[];
    dikembalikan: readonly Date[];
  },
): AktivitasKeluar[] {
  const { paraf } = arg;
  const awalRonde = arg.dikembalikan.filter((d) => d <= paraf.pada).reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);
  const diminta = arg.diminta
    .filter((d) => d <= paraf.pada && (!awalRonde || d > awalRonde))
    .reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);

  return susun({
    ...arg,
    id: `paraf:${paraf.id}`,
    jenis: "paraf_diberikan",
    olehId: paraf.penggunaId,
    rpkpsId: paraf.rpkpsId,
    versi: paraf.versi,
    pada: paraf.pada,
    diterimaPada: diminta,
  });
}
