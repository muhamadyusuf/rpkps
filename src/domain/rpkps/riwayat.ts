/**
 * Peristiwa pada riwayat sebuah RPKPS.
 *
 * `rpkps_riwayat.deskripsi` dibaca ulang berbulan-bulan setelah ditulis —
 * di halaman ikhtisar, di ekspor DOCX, dan di katalog publik, oleh orang yang
 * belum tentu penulisnya. Merangkai kalimatnya saat menulis akan membekukan
 * bahasa PENULIS ke dalam riwayat dokumen: satu RPKPS berakhir dengan riwayat
 * separuh Indonesia separuh Inggris, bergantung siapa yang kebetulan menekan
 * tombolnya (docs/11 §4.2c).
 *
 * Murni: yang disusun di sini kunci dan parameter, tidak pernah kalimat.
 */

export type KunciRiwayat =
  | "DIBUAT_KOSONG"
  | "DIBUAT_KERANGKA"
  | "DRAF_AI_DITERAPKAN"
  | "DIPARAF_KOORDINATOR"
  | "DISETUJUI_KAPRODI"
  | "DISAHKAN_MUTU"
  | "DIKEMBALIKAN_REVISI"
  | "DIARSIPKAN"
  | "DARI_ARSIP_TERBIT"
  | "DARI_ARSIP_DRAF"
  | "KOORDINASI_DISERAHKAN"
  | "KOORDINASI_DIALIHKAN"
  | "KOORDINASI_DISERAHKAN_PENUGASAN"
  | "KOORDINASI_DIALIHKAN_PENUGASAN"
  | "DISALIN"
  | "DISALIN_LINTAS_MK";

export interface DataRiwayat {
  kunci: KunciRiwayat;
  params: Record<string, string | number>;
}

export function riwayat(
  kunci: KunciRiwayat,
  params: Record<string, string | number> = {},
): DataRiwayat {
  return { kunci, params };
}
