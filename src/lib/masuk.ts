import "server-only";
import type { NextResponse } from "next/server";
import { adminAuth, buatCookieSesi, UMUR_SESI_MS } from "@/lib/firebase/admin";
import { siapkanPengguna, NAMA_COOKIE_SESI } from "@/lib/sesi";
import { NAMA_COOKIE_BAHASA, type Bahasa } from "@/kamus";
import { prisma } from "@/lib/prisma";
import { periksaStatusKepegawaian, type FaktaLogin } from "@/lib/identitas/status";
import { sinkronkanSaatMasuk } from "@/lib/identitas/sinkron";
import { bolehLewatGerbangLokal } from "@/domain/identitas/peran";
import { env } from "@/lib/env";
import type { StatusPengguna } from "@/generated/prisma";

/**
 * Pengguna LOKAL yang sah melewati gerbang kepegawaian (docs/26 §3). Hanya
 * dikonsultasikan bila integrasi identitas-itts aktif — bila tidak, gerbang
 * memang dilewati untuk semua orang. Aturannya murni di `bolehLewatGerbangLokal`.
 */
async function penggunaLokalSah(email: string): Promise<boolean> {
  if (!env.identitasItts) return false;
  const p = await prisma.pengguna.findUnique({
    where: { email: email.toLowerCase() },
    select: { identitasAkunId: true, status: true, penugasan: { select: { peran: true } } },
  });
  return !!p && bolehLewatGerbangLokal({ identitasAkunId: p.identitasAkunId, status: p.status, peran: p.penugasan.map((x) => x.peran) });
}

/**
 * SATU-SATUNYA pintu yang mengubah "Firebase ID token yang sah" menjadi sesi
 * RPKPS. Dipakai `POST /api/sesi` (masuk dengan Google) dan
 * `GET /api/identitas/callback` (masuk lewat identitas-itts, docs/25).
 *
 * Dipisah dari rute supaya kedua jalan masuk tidak dapat menyimpang: gerbang
 * kepegawaian, pengecualian admin bootstrap, penyiapan pengguna, dan catatan
 * audit ditulis SEKALI. Jalan masuk baru yang menulis ulang urutan ini
 * berarti gerbang yang bisa terlewat tanpa ada yang menyadari.
 */

export type KodeGagalMasuk =
  | "email-kosong"
  | "belum-terdaftar"
  | "akun-nonaktif"
  | "layanan"
  | "tidak-sah"
  | "gagal";

export type HasilMasuk =
  | { ok: true; cookie: string; status: StatusPengguna; baru: boolean; bahasa: Bahasa }
  | { ok: false; kode: KodeGagalMasuk; pesan: string; status: number };

export interface OpsiMasuk {
  /** Hasil `ambilIpKlien` — bukan `x-forwarded-for` mentah. */
  ip: string;
  lewat: "google" | "identitas-itts";
  /** Dipakai bila token tidak membawa nama (token dari penukaran token kustom tidak selalu membawanya). */
  namaCadangan?: string | null;
}

export async function selesaikanMasuk(idToken: string, opsi: OpsiMasuk): Promise<HasilMasuk> {
  try {
    // checkRevoked = true: akun yang baru dinonaktifkan langsung ditolak.
    const token = await adminAuth().verifyIdToken(idToken, true);

    if (!token.email) {
      return {
        ok: false,
        kode: "email-kosong",
        pesan: "Akun Google tidak memiliki alamat email.",
        status: 400,
      };
    }

    // Gerbang kepegawaian identitas-itts — SEBELUM login berhasil, bukan
    // sesudahnya (permintaan eksplisit, bukan pemeriksaan tambahan yang bisa
    // ditunda). Dua pengecualian, keduanya bukan pegawai yang lolos diam-diam:
    //  - email bootstrap admin: akun "pecah kaca" aplikasi ini, tidak boleh
    //    terkunci oleh layanan eksternal yang padam;
    //  - pengguna LOKAL (docs/26 §3): asesor/mahasiswa yang dibuat admin dan
    //    tak pernah bertaut ke identitas-itts. Lihat `bolehLewatGerbangLokal`.
    let fakta: FaktaLogin | null = null;
    if (!env.adminBootstrapEmails.includes(token.email.toLowerCase()) && !(await penggunaLokalSah(token.email))) {
      const status = await periksaStatusKepegawaian(token.email);
      if (status.diperiksa && (!status.terdaftar || !status.aktif)) {
        return {
          ok: false,
          kode: !status.terdaftar ? "belum-terdaftar" : "akun-nonaktif",
          pesan: !status.terdaftar
            ? "Anda belum terdaftar sebagai pegawai. Hubungi admin untuk didaftarkan terlebih dahulu."
            : "Akun kepegawaian Anda tidak aktif. Hubungi admin.",
          status: 403,
        };
      }
      if (status.diperiksa) fakta = status.fakta;
    }

    const pengguna = await siapkanPengguna({
      firebaseUid: token.uid,
      email: token.email,
      nama: (token.name as string | undefined) ?? opsi.namaCadangan ?? null,
      identitasAkunId: fakta?.akunId ?? null,
    });

    // Peran diturunkan dari jabatan SEBELUM halaman pertama, dengan fakta yang sudah
    // dipegang gerbang. Tak pernah menggagalkan login: gagal = peran yang ada dipertahankan.
    const sinkron = fakta ? await sinkronkanSaatMasuk(pengguna.id, fakta) : null;
    const statusAkhir = sinkron?.statusBaru ?? pengguna.status;

    const cookie = await buatCookieSesi(idToken);

    const lewat = opsi.lewat === "identitas-itts" ? " lewat identitas-itts" : "";
    await prisma.logAudit.create({
      data: {
        penggunaId: pengguna.id,
        aksi: pengguna.baru ? "PENGGUNA_DIBUAT" : "MASUK",
        entitas: "pengguna",
        entitasId: pengguna.id,
        ringkasan: pengguna.baru
          ? `Pengguna baru ${token.email} masuk pertama kali${lewat}`
          : `${token.email} masuk${lewat}`,
        // Bukan `x-forwarded-for` mentah: kolom ini jejak audit, dan nilai
        // kiriman klien di dalamnya dapat memalsukan asal login.
        ip: opsi.ip === "tidak-diketahui" ? undefined : opsi.ip,
      },
    });

    return {
      ok: true,
      cookie,
      status: statusAkhir,
      baru: pengguna.baru,
      bahasa: pengguna.bahasa,
    };
  } catch (galat) {
    console.error("[sesi] gagal membuat sesi:", galat);
    const { pesan, status } = jelaskanKegagalanSesi(galat);
    return {
      ok: false,
      kode: status === 503 ? "layanan" : status === 401 ? "tidak-sah" : "gagal",
      pesan,
      status,
    };
  }
}

/**
 * Memasang kedua cookie hasil masuk pada sebuah respons.
 *
 * Preferensi bahasa: satu-satunya tempat preferensi yang tersimpan dapat
 * mengambil alih. Proxy tidak boleh menyentuh basis data (runtime Edge) dan
 * Server Component tidak dapat memasang cookie — tinggal Route Handler, yang
 * memang dilewati tepat sekali pada saat masuk. Sejak titik itu, dosen yang
 * memakai komputer lab langsung mendapat bahasanya sendiri.
 */
export function pasangCookieMasuk(
  respons: NextResponse,
  hasil: Extract<HasilMasuk, { ok: true }>,
): void {
  respons.cookies.set({
    name: NAMA_COOKIE_BAHASA,
    value: hasil.bahasa,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  respons.cookies.set({
    name: NAMA_COOKIE_SESI,
    value: hasil.cookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UMUR_SESI_MS / 1000,
  });
}

/**
 * Menerjemahkan kegagalan pembuatan sesi menjadi sebab yang dapat
 * ditindaklanjuti. Sebelumnya seluruh kegagalan — kredensial Firebase salah,
 * database tak terjangkau, tabel belum dibuat — berakhir sebagai satu pesan
 * "Verifikasi login gagal", yang tidak memberi petunjuk apa pun.
 *
 * Rincian teknis hanya disertakan di mode pengembangan; di produksi cukup
 * kategorinya, sedangkan jejak lengkapnya ada di log server.
 */
function jelaskanKegagalanSesi(galat: unknown): { pesan: string; status: number } {
  const pesanAsli = galat instanceof Error ? galat.message : String(galat);
  const kode =
    typeof galat === "object" && galat !== null && "code" in galat
      ? String((galat as { code: unknown }).code)
      : "";
  const dev = process.env.NODE_ENV === "development";
  const rinci = (dasar: string) => (dev ? `${dasar} (${pesanAsli.slice(0, 200)})` : dasar);

  if (pesanAsli.includes("Variabel lingkungan")) {
    return { pesan: pesanAsli, status: 500 };
  }

  // Database: belum terjangkau, atau skemanya belum dibuat.
  if (
    kode === "ECONNREFUSED" || kode === "ENOTFOUND" || kode === "ETIMEDOUT" ||
    kode.startsWith("P1") || pesanAsli.includes("Can\'t reach database")
  ) {
    return {
      pesan: rinci("Database tidak dapat dihubungi. Periksa DATABASE_URL."),
      status: 500,
    };
  }
  if (
    kode === "42P01" || kode.startsWith("P2021") ||
    pesanAsli.includes("does not exist") || pesanAsli.includes("tidak ditemukan di database")
  ) {
    return {
      pesan: rinci("Tabel database belum dibuat. Jalankan: npm run db:migrate:pg"),
      status: 500,
    };
  }

  // Kredensial Firebase Admin (service account) bermasalah.
  if (
    kode.startsWith("app/") ||
    pesanAsli.includes("Failed to parse private key") ||
    pesanAsli.includes("Credential implementation") ||
    pesanAsli.includes("invalid_grant")
  ) {
    return {
      pesan: rinci(
        "Kredensial Firebase Admin ditolak. Periksa FIREBASE_PRIVATE_KEY dan FIREBASE_CLIENT_EMAIL.",
      ),
      status: 500,
    };
  }

  // Token dari browser memang tidak sah — ini satu-satunya kegagalan
  // yang benar-benar milik pengguna, bukan konfigurasi.
  if (kode.startsWith("auth/")) {
    return { pesan: "Sesi login tidak sah. Coba masuk kembali.", status: 401 };
  }

  // Gerbang kepegawaian gagal terhubung — gagal-tertutup (lib/identitas/status.ts),
  // jadi ini kegagalan yang diharapkan saat identitas-itts padam, bukan galat acak.
  if (kode === "ABORT_ERR" || pesanAsli.includes("identitas-itts")) {
    return {
      pesan: rinci("Tidak dapat memeriksa status kepegawaian. Coba lagi sebentar lagi."),
      status: 503,
    };
  }

  return { pesan: rinci("Gagal membuat sesi."), status: 500 };
}
