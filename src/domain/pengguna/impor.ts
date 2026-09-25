import type { Peran } from "@/generated/prisma";
import { PERAN_INSTITUSI } from "./peran";
import { PERAN_NON_PEGAWAI } from "@/domain/identitas/peran";

/** Satu baris mentah dari lembar Excel, apa adanya sebelum divalidasi. */
export interface BarisPenggunaMentah {
  baris: number;
  email: string;
  nama: string;
  peran: string;
  prodiKode: string;
}

/** Baris yang lolos pemeriksaan format, siap dipetakan ke `prisma.pengguna.create`. */
export interface BarisPenggunaSiap {
  baris: number;
  email: string;
  nama: string;
  peran: Peran | null;
  prodiId: string | null;
  /** Ditampilkan di pratinjau; tidak dipakai server saat menyimpan. */
  prodiKode: string | null;
}

export interface GalatBarisPengguna {
  baris: number;
  pesan: string;
}

const PERAN_VALID = new Set<Peran>([
  "ADMIN",
  "KAPRODI",
  "GPM",
  "KOORDINATOR_MK",
  "DOSEN",
  "MAHASISWA",
  "ASESOR",
]);

/**
 * Impor ini hanya untuk orang DI LUAR identitas-itts (docs/26 §3). Pegawai tidak dibuat di sini:
 * mereka datang dari identitas-itts, dan perannya dari jabatan. Peran wajib, sebab pengguna lokal
 * tanpa peran tak lolos gerbang masuk.
 */

function baca(nilai: string): string | null {
  const v = nilai.trim();
  return v === "" ? null : v;
}

/**
 * Merakit dan memvalidasi baris mentah dari berkas impor pengguna. Murni —
 * tidak menyentuh basis data, sehingga tanggung jawabnya hanya format baris
 * dan konsistensi di dalam berkas itu sendiri (email berulang, kode prodi
 * yang tidak dikenal). Kecocokan email dengan akun yang sudah ada diperiksa
 * pemanggil (server action) karena itu memerlukan basis data.
 */
export function rakitPenggunaImpor(
  daftar: BarisPenggunaMentah[],
  prodiTersedia: { id: string; kode: string }[],
): { siap: BarisPenggunaSiap[]; galat: GalatBarisPengguna[] } {
  const siap: BarisPenggunaSiap[] = [];
  const galat: GalatBarisPengguna[] = [];
  const emailDalamBerkas = new Set<string>();
  const prodiByKode = new Map(prodiTersedia.map((p) => [p.kode.toUpperCase(), p.id]));

  for (const baris of daftar) {
    const email = baca(baris.email)?.toLowerCase() ?? null;
    const nama = baca(baris.nama);
    const peranMentah = baca(baris.peran)?.toUpperCase() ?? null;
    const prodiKode = baca(baris.prodiKode)?.toUpperCase() ?? null;

    if (!email) {
      galat.push({ baris: baris.baris, pesan: "Email kosong." });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      galat.push({ baris: baris.baris, pesan: `Email "${email}" tidak valid.` });
      continue;
    }
    if (emailDalamBerkas.has(email)) {
      galat.push({ baris: baris.baris, pesan: `Email "${email}" berulang di berkas ini.` });
      continue;
    }
    if (!nama) {
      galat.push({ baris: baris.baris, pesan: "Nama kosong." });
      continue;
    }

    let peran: Peran | null = null;
    if (peranMentah) {
      if (!PERAN_VALID.has(peranMentah as Peran)) {
        galat.push({ baris: baris.baris, pesan: `Peran "${peranMentah}" tidak dikenal.` });
        continue;
      }
      peran = peranMentah as Peran;
    }
    if (!peran || !PERAN_NON_PEGAWAI.includes(peran)) {
      galat.push({
        baris: baris.baris,
        pesan: "Impor hanya untuk Asesor dan Mahasiswa. Pegawai diambil dari identitas-itts — tambahkan lewat kotak pencarian pegawai.",
      });
      continue;
    }

    let prodiId: string | null = null;
    if (peran && !PERAN_INSTITUSI.includes(peran)) {
      if (!prodiKode) {
        galat.push({
          baris: baris.baris,
          pesan: `Peran ${peran} wajib disertai Kode Prodi.`,
        });
        continue;
      }
      const id = prodiByKode.get(prodiKode);
      if (!id) {
        galat.push({ baris: baris.baris, pesan: `Kode Prodi "${prodiKode}" tidak dikenal.` });
        continue;
      }
      prodiId = id;
    }

    emailDalamBerkas.add(email);
    siap.push({ baris: baris.baris, email, nama, peran, prodiId, prodiKode });
  }

  return { siap, galat };
}
