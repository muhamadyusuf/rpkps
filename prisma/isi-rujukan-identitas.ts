/**
 * Pengisian rujukan ke identitas-itts (docs/26 §6) — DIJALANKAN PENGGUNA, satu kali
 * setelah migrasi `20260925000000_rujukan_identitas` diterapkan dan SEBELUM kode baru
 * di-deploy.
 *
 * Yang dikerjakan:
 *   1. PENGGUNA — mencocokkan `pengguna.email` dengan pegawai di identitas-itts dan
 *      mengisi `identitas_akun_id`. Yang tak cocok = pengguna LOKAL (asesor,
 *      mahasiswa, admin bootstrap) atau pegawai yang surelnya berbeda; DILAPORKAN, tidak ditebak.
 *   2. SELISIH DATA — untuk pengampu dokumen yang sudah DIAJUKAN/DISETUJUI/TERBIT: membandingkan
 *      nama dan NIDN yang tersimpan di RPKPS dengan yang dimiliki identitas-itts. Nama dan NIDN
 *      pengampu ikut dalam sidik SHA-256 dokumen; setelah deploy, nilainya dibaca dari
 *      identitas-itts, sehingga SELISIH di sini = dokumen terbit yang akan tampak "bergeser"
 *      (docs/26 §8). Hanya dilaporkan — koreksi di identitas-itts atau terima pergeserannya.
 *   3. PRODI — mengusulkan pemetaan `prodi.identitas_unit_id` dari homebase dosen
 *      (kode prodi = singkatan unit, atau nama sama). Hanya yang TAK ADA KERAGUAN yang
 *      diterapkan; sisanya dilaporkan untuk dipetakan tangan di /master/prodi/[id].
 *
 * DRY-RUN BAWAAN: tanpa `--terapkan` skrip hanya membaca dan melapor. Tidak pernah
 * menghapus atau menimpa apa pun — hanya mengisi kolom yang masih kosong.
 *
 *   npx tsx prisma/isi-rujukan-identitas.ts               # laporan
 *   npx tsx prisma/isi-rujukan-identitas.ts --terapkan    # tulis
 *
 * Memakai DATABASE_URL dan IDENTITAS_ITTS_* dari .env. **DATABASE_URL di .env RPKPS
 * menunjuk Neon (produksi)**: jalankan laporan dulu, baca, baru `--terapkan`. Klien
 * `rpkps` di identitas-itts harus sudah punya cakupan `kepegawaian.read`.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const terapkan = process.argv.includes("--terapkan");

const url = process.env.IDENTITAS_ITTS_URL?.replace(/\/+$/, "");
const klienId = process.env.IDENTITAS_ITTS_CLIENT_ID;
const rahasia = process.env.IDENTITAS_ITTS_CLIENT_SECRET;
if (!url || !klienId || !rahasia) {
  console.error("IDENTITAS_ITTS_URL / _CLIENT_ID / _CLIENT_SECRET belum diisi di .env.");
  process.exit(1);
}
const basic = `Basic ${Buffer.from(`${klienId}:${rahasia}`).toString("base64")}`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL, max: 2 }),
});

type Profil = {
  akunId: string;
  email: string;
  namaLengkap: string;
  nidn: string | null;
  jenisPegawai: string;
  aktif: boolean;
  homebase: { unitId: string; nama: string; singkatan: string | null } | null;
};

async function ambil(jalur: string, params: URLSearchParams): Promise<unknown> {
  const r = await fetch(`${url}${jalur}?${params}`, { headers: { Authorization: basic }, signal: AbortSignal.timeout(15_000) });
  if (r.status === 403) throw new Error(`403: klien "${klienId}" belum punya cakupan "kepegawaian.read" di /klien.`);
  if (!r.ok) throw new Error(`identitas-itts menjawab ${r.status} pada ${jalur}`);
  return r.json();
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function main() {
  console.log(terapkan ? "MODE: TERAPKAN (menulis)\n" : "MODE: LAPORAN (tidak menulis apa pun)\n");

  // ── 1 · Pengguna ───────────────────────────────────────────────────────
  const pengguna = await prisma.pengguna.findMany({
    select: { id: true, email: true, identitasAkunId: true, status: true, penugasan: { select: { peran: true } } },
    orderBy: { email: "asc" },
  });
  const belum = pengguna.filter((p) => p.identitasAkunId === null);
  console.log(`Pengguna: ${pengguna.length} (sudah bertaut ${pengguna.length - belum.length}, belum ${belum.length})`);

  const profilPerSurel = new Map<string, Profil>();
  for (let i = 0; i < belum.length; i += 100) {
    const bagian = belum.slice(i, i + 100);
    const p = new URLSearchParams();
    for (const b of bagian) p.append("email", b.email.toLowerCase());
    const isi = (await ambil("/api/v1/pegawai", p)) as { pegawai: Profil[] };
    for (const x of isi.pegawai) profilPerSurel.set(x.email.toLowerCase(), x);
  }

  let ditautkan = 0;
  const tanpaPasangan: typeof belum = [];
  for (const b of belum) {
    const profil = profilPerSurel.get(b.email.toLowerCase());
    if (!profil) {
      tanpaPasangan.push(b);
      continue;
    }
    const dipakai = await prisma.pengguna.findUnique({ where: { identitasAkunId: profil.akunId }, select: { email: true } });
    if (dipakai) {
      console.log(`  ! ${b.email}: akun identitas-itts sudah dipakai baris lain (${dipakai.email}) — dilewati`);
      continue;
    }
    if (terapkan) await prisma.pengguna.update({ where: { id: b.id }, data: { identitasAkunId: profil.akunId } });
    ditautkan++;
  }
  console.log(`  ${terapkan ? "ditautkan" : "akan ditautkan"}: ${ditautkan}`);
  console.log(`  TANPA PASANGAN di identitas-itts: ${tanpaPasangan.length}`);
  for (const t of tanpaPasangan) {
    const peran = [...new Set(t.penugasan.map((x) => x.peran))].join(",") || "(tanpa peran)";
    console.log(`    - ${t.email}  [${t.status}]  ${peran}`);
  }
  if (tanpaPasangan.length > 0) {
    console.log(
      "  → Yang berperan hanya ASESOR/MAHASISWA memang pengguna lokal (sah). Yang berperan DOSEN/KAPRODI/GPM/ADMIN\n" +
        "    dan tak berpasangan: daftarkan sebagai pegawai di identitas-itts (atau perbaiki surelnya) SEBELUM deploy —\n" +
        "    kalau tidak, gerbang kepegawaian akan menolak masuknya.",
    );
  }

  // ── 2 · Selisih nama/NIDN pada dokumen yang sudah berjalan ──────────────
  // SQL mentah, BUKAN klien bertipe: kolom lama itu akan dibuang (docs/26 §7) dan skrip ini
  // satu-satunya tempat yang boleh membacanya. Jangan disalin ke kode aplikasi.
  console.log("\nSelisih data pengampu (dokumen DIAJUKAN/DISETUJUI/TERBIT atau sudah bertanda tangan):");
  const terdampak = await prisma.$queryRaw<
    { id: string; email: string; nama: string; nidn: string | null; akun: string | null; terbit: number; berjalan: number }[]
  >`
    SELECT p.id, p.email, p.nama, p.nidn, p.identitas_akun_id AS akun,
           COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'TERBIT')::int AS terbit,
           COUNT(DISTINCT r.id) FILTER (WHERE r.status IN ('DIAJUKAN', 'DISETUJUI'))::int AS berjalan
    FROM pengguna p
    JOIN rpkps_pengampu rp ON rp.pengguna_id = p.id
    JOIN rpkps r ON r.id = rp.rpkps_id
    WHERE r.status IN ('DIAJUKAN', 'DISETUJUI', 'TERBIT')
       OR EXISTS (SELECT 1 FROM tanda_tangan_rpkps t WHERE t.rpkps_id = r.id)
    GROUP BY p.id, p.email, p.nama, p.nidn, p.identitas_akun_id
    ORDER BY p.email`;

  // Yang baru akan ditautkan (dry-run) dicocokkan lewat surel; yang sudah bertaut lewat akunId.
  const perAkun = new Map<string, Profil>();
  const akunIds = terdampak.flatMap((t) => (t.akun ? [t.akun] : []));
  for (let i = 0; i < akunIds.length; i += 100) {
    const p = new URLSearchParams();
    for (const id of akunIds.slice(i, i + 100)) p.append("akunId", id);
    const isi = (await ambil("/api/v1/pegawai", p)) as { pegawai: Profil[] };
    for (const x of isi.pegawai) perAkun.set(x.akunId, x);
  }

  let selisih = 0;
  let takTerbaca = 0;
  for (const t of terdampak) {
    const profil = t.akun ? perAkun.get(t.akun) : profilPerSurel.get(t.email.toLowerCase());
    if (!profil) {
      takTerbaca++;
      console.log(`  ? ${t.email}: tak ada di identitas-itts — namanya akan tampil dari surel (terbit ${t.terbit}, berjalan ${t.berjalan})`);
      continue;
    }
    const bedaNama = t.nama.trim() !== profil.namaLengkap.trim();
    const bedaNidn = (t.nidn ?? null) !== (profil.nidn ?? null);
    if (!bedaNama && !bedaNidn) continue;
    selisih++;
    console.log(`  ≠ ${t.email}  (terbit ${t.terbit}, berjalan ${t.berjalan})`);
    if (bedaNama) console.log(`      nama : RPKPS "${t.nama}"  ↔  identitas-itts "${profil.namaLengkap}"`);
    if (bedaNidn) console.log(`      NIDN : RPKPS ${t.nidn ?? "—"}  ↔  identitas-itts ${profil.nidn ?? "—"}`);
  }
  console.log(`  ${terdampak.length} pengampu diperiksa: ${selisih} berselisih, ${takTerbaca} tak terbaca.`);
  if (selisih > 0) {
    console.log(
      "  → Dokumen TERBIT milik yang berselisih akan menampilkan \"dokumen bergeser\" setelah deploy (sidik memuat nama dan NIDN).\n" +
        "    Samakan dulu di identitas-itts bila yang benar adalah data RPKPS; bila yang benar data identitas-itts, pergeseran itu sah.",
    );
  }

  // ── 3 · Prodi ──────────────────────────────────────────────────────────
  console.log("\nProdi:");
  const prodi = await prisma.prodi.findMany({ select: { id: true, kode: true, nama: true, identitasUnitId: true }, orderBy: { kode: "asc" } });
  const unitDitemukan = new Map<string, { nama: string; singkatan: string | null }>();
  for (const p of profilPerSurel.values()) if (p.homebase) unitDitemukan.set(p.homebase.unitId, p.homebase);
  // Dosen yang sudah bertaut sebelumnya juga menyumbang homebase.
  const sudah = pengguna.filter((p) => p.identitasAkunId !== null).map((p) => p.identitasAkunId as string);
  for (let i = 0; i < sudah.length; i += 100) {
    const p = new URLSearchParams();
    for (const id of sudah.slice(i, i + 100)) p.append("akunId", id);
    const isi = (await ambil("/api/v1/pegawai", p)) as { pegawai: Profil[] };
    for (const x of isi.pegawai) if (x.homebase) unitDitemukan.set(x.homebase.unitId, x.homebase);
  }

  const dipakaiUnit = new Set(prodi.flatMap((p) => (p.identitasUnitId ? [p.identitasUnitId] : [])));
  for (const p of prodi) {
    if (p.identitasUnitId) {
      console.log(`  ${p.kode.padEnd(8)} sudah dipetakan → ${p.identitasUnitId}`);
      continue;
    }
    const cocok = [...unitDitemukan.entries()].filter(
      ([id, u]) => !dipakaiUnit.has(id) && ((u.singkatan && norm(u.singkatan) === norm(p.kode)) || norm(u.nama) === norm(p.nama)),
    );
    if (cocok.length === 1) {
      const [unitId, u] = cocok[0];
      console.log(`  ${p.kode.padEnd(8)} ${terapkan ? "dipetakan" : "akan dipetakan"} → ${unitId}  ("${u.nama}")`);
      if (terapkan) await prisma.prodi.update({ where: { id: p.id }, data: { identitasUnitId: unitId } });
      dipakaiUnit.add(unitId);
    } else {
      console.log(
        `  ${p.kode.padEnd(8)} TAK DAPAT DIPASTIKAN (${cocok.length === 0 ? "tak ada unit yang cocok" : `${cocok.length} calon`}) — petakan tangan di /master/prodi`,
      );
    }
  }
  const takBerpasangan = [...unitDitemukan.entries()].filter(([id]) => !dipakaiUnit.has(id));
  if (takBerpasangan.length > 0) {
    console.log("\n  Unit homebase di identitas-itts yang belum berpasangan dengan prodi mana pun:");
    for (const [id, u] of takBerpasangan) console.log(`    - ${id}  "${u.nama}" (${u.singkatan ?? "—"})`);
  }

  console.log(terapkan ? "\nSelesai." : "\nLAPORAN saja. Ulangi dengan --terapkan untuk menulis.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
