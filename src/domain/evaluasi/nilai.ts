import { bulatkan } from "@/domain/beban-belajar/kalkulator";
import type { TemuanRpkps } from "@/domain/rpkps/tipe";
import type { Asesmen } from "./peta-asesmen";

/**
 * Pembacaan dan pemeriksaan skor mentah — tahap E2 pada
 * docs/05-evaluasi-ketercapaian-mk.md.
 *
 * Nilai masuk lewat berkas XLSX per kelas (doc 05 §5.1). Templatnya diturunkan
 * dari peta asesmen, jadi judul kolomnya selalu cocok dengan rencana yang
 * disahkan — bukan daftar yang harus dijaga selaras dengan tangan.
 *
 * Modul ini murni: ia menerima baris teks apa adanya dari berkas dan
 * mengembalikan skor bertipe beserta temuan. Yang membaca berkasnya sendiri
 * ada di `src/lib/evaluasi/excel-nilai.ts`.
 */

export const SKOR_MIN = 0;
export const SKOR_MAKS = 100;

/** Satu baris berkas, masih apa adanya. Kunci `skor` adalah kode asesmen. */
export interface BarisMentah {
  /** Nomor baris pada berkas, untuk menunjuk letak galat. */
  nomor: number;
  nim: string;
  nama: string;
  /** Kolom opsional; banyak berkas nilai hanya memuat NIM dan nama. */
  angkatan?: string;
  skor: Record<string, string>;
}

export interface BarisNilai {
  nim: string;
  nama: string;
  angkatan: number | null;
  /** null = belum dinilai. Dibedakan dari 0, yang berarti dinilai nol. */
  skor: Record<string, number | null>;
}

export interface HasilBacaNilai {
  baris: BarisNilai[];
  temuan: TemuanRpkps[];
  pemblokir: TemuanRpkps[];
  peringatan: TemuanRpkps[];
  /** true bila berkas dapat disimpan. Kelengkapan tidak menghalangi simpan. */
  lolos: boolean;
  ringkasan: {
    jumlahBaris: number;
    selTerisi: number;
    selSeluruh: number;
    persenLengkap: number;
    kolomDikenal: string[];
    kolomAsing: string[];
    kolomHilang: string[];
  };
}

export function bacaNilai(
  mentah: readonly BarisMentah[],
  asesmen: readonly Pick<Asesmen, "kode">[],
): HasilBacaNilai {
  const temuan: TemuanRpkps[] = [];
  const kodeSah = asesmen.map((a) => a.kode);
  const setSah = new Set(kodeSah);

  // ── Kolom ───────────────────────────────────────────────────────────
  const kolomBerkas = new Set<string>();
  for (const b of mentah) for (const k of Object.keys(b.skor)) kolomBerkas.add(k);

  const kolomAsing = [...kolomBerkas].filter((k) => !setSah.has(k));
  const kolomHilang = kodeSah.filter((k) => !kolomBerkas.has(k));

  if (kolomAsing.length > 0) {
    temuan.push({
      kode: "NL-KOLOM-ASING",
      tingkat: "PERINGATAN",
      pesan: `Kolom ${kolomAsing.join(", ")} tidak dikenali sebagai asesmen dan diabaikan.`,
      saran: "Biasanya berkas berasal dari RPKPS lain, atau rencana sudah berubah sejak templat diunduh.",
    });
  }
  if (kolomHilang.length > 0) {
    temuan.push({
      kode: "NL-KOLOM-HILANG",
      tingkat: "PERINGATAN",
      pesan: `Asesmen ${kolomHilang.join(", ")} tidak ada kolomnya pada berkas.`,
      saran: "Capaian yang bergantung pada asesmen itu tidak akan lengkap.",
    });
  }

  // ── Baris ───────────────────────────────────────────────────────────
  const baris: BarisNilai[] = [];
  const nimTerlihat = new Map<string, number>();
  let selTerisi = 0;

  for (const b of mentah) {
    const nim = b.nim.trim();
    if (nim === "") {
      // Baris kosong di ujung berkas itu lumrah; yang bermasalah adalah baris
      // yang berisi nilai tetapi tanpa pemilik.
      const adaIsi = Object.values(b.skor).some((v) => v.trim() !== "");
      if (adaIsi || b.nama.trim() !== "") {
        temuan.push({
          kode: "NL-NIM-KOSONG",
          tingkat: "PEMBLOKIR",
          pesan: `Baris ${b.nomor} berisi nilai tetapi tidak punya NIM.`,
        });
      }
      continue;
    }

    const sebelumnya = nimTerlihat.get(nim);
    if (sebelumnya !== undefined) {
      temuan.push({
        kode: "NL-NIM-GANDA",
        tingkat: "PEMBLOKIR",
        pesan: `NIM ${nim} muncul dua kali, pada baris ${sebelumnya} dan ${b.nomor}.`,
      });
      continue;
    }
    nimTerlihat.set(nim, b.nomor);

    if (b.nama.trim() === "") {
      temuan.push({
        kode: "NL-NAMA-KOSONG",
        tingkat: "PERINGATAN",
        pesan: `Baris ${b.nomor} (NIM ${nim}) tidak punya nama.`,
      });
    }

    const skor: Record<string, number | null> = {};
    for (const kode of kodeSah) {
      const isi = (b.skor[kode] ?? "").trim();
      if (isi === "") {
        skor[kode] = null;
        continue;
      }

      const angka = keAngka(isi);
      if (angka === null) {
        temuan.push({
          kode: "NL-SKOR-BUKAN-ANGKA",
          tingkat: "PEMBLOKIR",
          pesan: `Baris ${b.nomor} kolom ${kode} berisi "${isi}", yang bukan angka.`,
        });
        skor[kode] = null;
        continue;
      }
      if (angka < SKOR_MIN || angka > SKOR_MAKS) {
        temuan.push({
          kode: "NL-SKOR-DILUAR-RENTANG",
          tingkat: "PEMBLOKIR",
          pesan: `Baris ${b.nomor} kolom ${kode} berisi ${angka}, di luar rentang ${SKOR_MIN}–${SKOR_MAKS}.`,
        });
        skor[kode] = null;
        continue;
      }

      skor[kode] = bulatkan(angka, 2);
      selTerisi += 1;
    }

    baris.push({ nim, nama: b.nama.trim(), angkatan: keTahun(b.angkatan), skor });
  }

  const selSeluruh = baris.length * kodeSah.length;
  if (selSeluruh > 0 && selTerisi < selSeluruh) {
    temuan.push({
      kode: "NL-BELUM-LENGKAP",
      tingkat: "PERINGATAN",
      pesan: `${selSeluruh - selTerisi} dari ${selSeluruh} sel nilai masih kosong.`,
      saran: "Boleh disimpan sebagian; capaian baru dapat ditutup setelah seluruhnya terisi.",
    });
  }

  const pemblokir = temuan.filter((t) => t.tingkat === "PEMBLOKIR");
  return {
    baris,
    temuan,
    pemblokir,
    peringatan: temuan.filter((t) => t.tingkat === "PERINGATAN"),
    lolos: pemblokir.length === 0,
    ringkasan: {
      jumlahBaris: baris.length,
      selTerisi,
      selSeluruh,
      persenLengkap: selSeluruh === 0 ? 0 : bulatkan((selTerisi / selSeluruh) * 100, 1),
      kolomDikenal: kodeSah.filter((k) => kolomBerkas.has(k)),
      kolomAsing,
      kolomHilang,
    },
  };
}

/**
 * Menerima "78", "78,5", dan "78.5" — koma desimal adalah kebiasaan Indonesia
 * dan Excel berbahasa Indonesia menuliskannya begitu.
 */
/** Angkatan ditulis sebagai tahun ("2023"); apa pun selain itu diabaikan. */
function keTahun(isi: string | undefined): number | null {
  const n = keAngka((isi ?? "").trim());
  if (n === null || !Number.isInteger(n) || n < 1900 || n > 2200) return null;
  return n;
}

function keAngka(isi: string): number | null {
  const bersih = isi.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(bersih)) return null;
  const n = Number(bersih);
  return Number.isFinite(n) ? n : null;
}

/**
 * Skor per butir ujian — masukan analisis butir (E6).
 *
 * Dipisah dari `bacaNilai` karena sifatnya berbeda: skor asesmen wajib ada
 * agar capaian dapat dihitung, sedangkan skor per butir OPSIONAL. Berkas yang
 * lembar butirnya kosong bukan berkas yang salah.
 */
export interface BarisButirMentah {
  nomor: number;
  nim: string;
  /** Kunci = nomor butir kisi-kisi. */
  skor: Record<number, string>;
}

export interface HasilBacaButir {
  peserta: { nim: string; skor: Record<number, number | null> }[];
  temuan: TemuanRpkps[];
  lolos: boolean;
  ringkasan: { jumlahBaris: number; selTerisi: number; selSeluruh: number };
}

export function bacaSkorButir(
  mentah: readonly BarisButirMentah[],
  butir: readonly { nomor: number; skorMaks: number }[],
  label = "ujian",
): HasilBacaButir {
  const temuan: TemuanRpkps[] = [];
  const peserta: HasilBacaButir["peserta"] = [];
  const maks = new Map(butir.map((b) => [b.nomor, b.skorMaks]));
  let selTerisi = 0;

  for (const b of mentah) {
    const nim = b.nim.trim();
    if (nim === "") continue;

    const skor: Record<number, number | null> = {};
    for (const { nomor } of butir) {
      const isi = (b.skor[nomor] ?? "").trim();
      if (isi === "") {
        skor[nomor] = null;
        continue;
      }

      const angka = keAngka(isi);
      const batas = maks.get(nomor) ?? 0;
      if (angka === null) {
        temuan.push({
          kode: "BT-BUKAN-ANGKA",
          tingkat: "PEMBLOKIR",
          pesan: `Baris ${b.nomor} butir ${nomor} pada ${label} berisi "${isi}", yang bukan angka.`,
        });
        skor[nomor] = null;
        continue;
      }
      if (angka < 0 || angka > batas) {
        temuan.push({
          kode: "BT-DILUAR-RENTANG",
          tingkat: "PEMBLOKIR",
          pesan: `Baris ${b.nomor} butir ${nomor} pada ${label} berisi ${angka}, di luar 0–${batas}.`,
        });
        skor[nomor] = null;
        continue;
      }

      skor[nomor] = bulatkan(angka, 2);
      selTerisi += 1;
    }

    peserta.push({ nim, skor });
  }

  return {
    peserta,
    temuan,
    lolos: !temuan.some((t) => t.tingkat === "PEMBLOKIR"),
    ringkasan: {
      jumlahBaris: peserta.length,
      selTerisi,
      selSeluruh: peserta.length * butir.length,
    },
  };
}
