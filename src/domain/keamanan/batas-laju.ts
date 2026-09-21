/**
 * Pembatas laju jendela-tetap, murni dan tanpa I/O.
 *
 * Disimpan di memori proses, dan itu keterbatasan yang disengaja: pada
 * penyebaran serverless setiap instans punya hitungannya sendiri, jadi
 * angkanya adalah LANGIT-LANGIT PER INSTANS, bukan kuota global. Itu cukup
 * untuk yang dijaganya — percobaan masuk beruntun dan pengunduhan dokumen yang
 * mahal — dan tidak menambah satu pun perjalanan ke basis data yang jauh
 * (~25 ms per kueri, lihat AGENTS.md). Penahan tingkat platform (WAF/Firewall)
 * tetap tempat yang benar untuk serangan volumetrik.
 *
 * Peta kuncinya DIJEPIT: kunci berasal dari alamat IP, artinya dari siapa
 * saja, dan peta tanpa batas adalah cara mudah menghabiskan memori proses.
 */

export type KeputusanLaju = {
  boleh: boolean;
  /** Sisa jatah pada jendela ini, tidak pernah negatif. */
  sisa: number;
  /** Berapa lama lagi sampai jendela bergulir; 0 bila diizinkan. */
  ulangDalamMs: number;
};

export type PembatasLaju = {
  coba(kunci: string, sekarang?: number): KeputusanLaju;
  /** Hanya untuk pengujian. */
  ukuran(): number;
};

export function buatPembatasLaju(opsi: {
  maks: number;
  jendelaMs: number;
  maksKunci?: number;
}): PembatasLaju {
  const { maks, jendelaMs } = opsi;
  const maksKunci = opsi.maksKunci ?? 10_000;
  const peta = new Map<string, { mulai: number; hitung: number }>();

  function bersihkan(sekarang: number) {
    for (const [kunci, v] of peta) {
      if (sekarang - v.mulai >= jendelaMs) peta.delete(kunci);
    }
    // Masih penuh setelah yang basi dibuang: yang tertua yang mengalah. Urutan
    // penyisipan Map adalah urutan umur kunci.
    while (peta.size >= maksKunci) {
      const tertua = peta.keys().next().value;
      if (tertua === undefined) break;
      peta.delete(tertua);
    }
  }

  return {
    coba(kunci, sekarang = Date.now()) {
      const ada = peta.get(kunci);

      if (!ada || sekarang - ada.mulai >= jendelaMs) {
        if (!ada && peta.size >= maksKunci) bersihkan(sekarang);
        peta.delete(kunci);
        peta.set(kunci, { mulai: sekarang, hitung: 1 });
        return { boleh: true, sisa: maks - 1, ulangDalamMs: 0 };
      }

      if (ada.hitung >= maks) {
        return { boleh: false, sisa: 0, ulangDalamMs: ada.mulai + jendelaMs - sekarang };
      }

      ada.hitung += 1;
      return { boleh: true, sisa: maks - ada.hitung, ulangDalamMs: 0 };
    },
    ukuran: () => peta.size,
  };
}
