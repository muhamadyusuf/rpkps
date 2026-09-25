/**
 * Uji integrasi sinkron peran dari identitas-itts (docs/26 §5) terhadap
 * Postgres sungguhan (PGlite) — termasuk indeks unik parsial untuk peran
 * bercakupan institusi, yang tak terlihat pada uji domain murni.
 *
 * Tanpa jaringan: yang diuji adalah `sinkron-inti.ts` dengan masukan yang sudah
 * berbentuk kontrak. Dijalankan `uji/jalankan.sh` setelah `integrasi.ts`.
 */
import { prisma } from "./prisma";
import type { BarisDirektori, PeranAplikasi } from "@/domain/identitas/kontrak";
import { sinkronkanFakta, sinkronkanSemuaInti, type OpsiSinkron } from "@/lib/identitas/sinkron-inti";

function cek(nama: string, syarat: boolean, detail?: string) {
  console.log(`${syarat ? "  OK  " : " GAGAL"} ${nama}${detail ? ` — ${detail}` : ""}`);
  if (!syarat) process.exitCode = 1;
}

const OPSI: OpsiSinkron = { hapusLokal: false, emailBootstrap: ["boot@itts.ac.id"] };

async function peranDari(email: string) {
  const p = await prisma.pengguna.findUnique({
    where: { email },
    select: { status: true, identitasAkunId: true, penugasan: { select: { peran: true, prodiId: true, sumber: true }, orderBy: [{ peran: "asc" }, { prodiId: "asc" }] } },
  });
  return p;
}
// Diurutkan di sini, bukan di kueri: `orderBy` pada enum mengikuti urutan DEKLARASI enum (KAPRODI < DOSEN), bukan alfabet.
const ringkas = (p: Awaited<ReturnType<typeof peranDari>>) =>
  (p?.penugasan ?? [])
    .map((x) => `${x.peran}|${x.prodiId ?? "-"}|${x.sumber}`)
    .sort()
    .join(", ");

async function main() {
  const institusi = await prisma.institusi.create({ data: { id: "itts-s", nama: "Institut Uji", namaSingkat: "IU" } });
  const fak = await prisma.fakultas.create({ data: { kode: "FS", nama: "Fakultas Uji", institusiId: institusi.id } });
  const pIf = await prisma.prodi.create({ data: { kode: "IF", nama: "Informatika", fakultasId: fak.id, identitasUnitId: "unit-if" } });
  const pSi = await prisma.prodi.create({ data: { kode: "SI", nama: "Sistem Informasi", fakultasId: fak.id, identitasUnitId: "unit-si" } });
  await prisma.prodi.create({ data: { kode: "TK", nama: "Teknik Komputer", fakultasId: fak.id } }); // belum dipetakan

  const buatPengguna = (email: string, status: "AKTIF" | "MENUNGGU_VERIFIKASI" | "NONAKTIF", extra: object = {}) =>
    prisma.pengguna.create({ data: { firebaseUid: `fb-${email}`, email, nama: email.split("@")[0], status, ...extra } });

  console.log("── 1 · sinkron satu orang");
  const siti = await buatPengguna("siti@itts.ac.id", "MENUNGGU_VERIFIKASI");
  const h1 = await sinkronkanFakta(
    prisma,
    siti.id,
    { akunId: "akun-siti", aktif: true, jenisPegawai: "DOSEN", homebaseUnitId: "unit-if", peran: [{ namaPeran: "rpkps:kaprodi", jabatan: { unit: { id: "unit-if", jenis: "PRODI" } } }] },
    OPSI,
  );
  let p = await peranDari("siti@itts.ac.id");
  cek("dosen + Kaprodi: dua peran bersumber IDENTITAS pada prodi yang benar", ringkas(p) === `DOSEN|${pIf.id}|IDENTITAS, KAPRODI|${pIf.id}|IDENTITAS`, ringkas(p));
  cek("tertaut ke akun identitas-itts", p?.identitasAkunId === "akun-siti");
  cek("MENUNGGU_VERIFIKASI → AKTIF karena kini punya peran", p?.status === "AKTIF" && h1?.statusBaru === "AKTIF");

  const ulang = await sinkronkanFakta(prisma, siti.id, { akunId: "akun-siti", aktif: true, jenisPegawai: "DOSEN", homebaseUnitId: "unit-if", peran: [{ namaPeran: "rpkps:kaprodi", jabatan: { unit: { id: "unit-if", jenis: "PRODI" } } }] }, OPSI);
  cek("sinkron ulang idempoten: tak ada yang berubah", ulang?.ditambah === 0 && ulang?.dihapus === 0 && ulang?.dipromosi === 0);

  await sinkronkanFakta(prisma, siti.id, { akunId: "akun-siti", aktif: true, jenisPegawai: "DOSEN", homebaseUnitId: "unit-if", peran: [] }, OPSI);
  p = await peranDari("siti@itts.ac.id");
  cek("jabatan Kaprodi berakhir → KAPRODI dicabut, DOSEN tetap", ringkas(p) === `DOSEN|${pIf.id}|IDENTITAS`, ringkas(p));

  console.log("── 2 · gagal-tertutup: prodi tak dapat dipastikan");
  const budi = await buatPengguna("budi@itts.ac.id", "MENUNGGU_VERIFIKASI");
  await sinkronkanFakta(prisma, budi.id, { akunId: "akun-budi", aktif: true, jenisPegawai: "DOSEN", homebaseUnitId: "unit-tak-dikenal", peran: [] }, OPSI);
  p = await peranDari("budi@itts.ac.id");
  cek("homebase belum dipetakan → TIDAK ada peran DOSEN (bukan DOSEN bercakupan institusi)", (p?.penugasan.length ?? 1) === 0 && p?.status === "MENUNGGU_VERIFIKASI", ringkas(p));

  console.log("── 3 · peran LOKAL: promosi, tidak digandakan, tidak dihapus");
  const dewi = await buatPengguna("dewi@itts.ac.id", "AKTIF");
  await prisma.penugasanPeran.createMany({
    data: [
      { penggunaId: dewi.id, peran: "KAPRODI", prodiId: pSi.id }, // identitas juga menghendaki → promosi
      { penggunaId: dewi.id, peran: "GPM", prodiId: null }, // identitas tak mendukung → tetap (laporan)
      { penggunaId: dewi.id, peran: "KOORDINATOR_MK", prodiId: pSi.id }, // bukan peran turunan → tak disentuh
      { penggunaId: dewi.id, peran: "ASESOR", prodiId: null }, // tak disentuh
    ],
  });
  const hd = await sinkronkanFakta(prisma, dewi.id, { akunId: "akun-dewi", aktif: true, jenisPegawai: "TENDIK", homebaseUnitId: null, peran: [{ namaPeran: "rpkps:kaprodi", jabatan: { unit: { id: "unit-si", jenis: "PRODI" } } }] }, OPSI);
  p = await peranDari("dewi@itts.ac.id");
  cek("KAPRODI LOKAL identik dipromosikan menjadi IDENTITAS (tanpa baris ganda)", ringkas(p).includes(`KAPRODI|${pSi.id}|IDENTITAS`) && (p?.penugasan.filter((x) => x.peran === "KAPRODI").length === 1), ringkas(p));
  cek("GPM LOKAL yang tak didukung identitas-itts TIDAK dihapus, hanya dilaporkan", ringkas(p).includes("GPM|-|LOKAL") && hd?.lokalTakDidukung.length === 1);
  cek("KOORDINATOR_MK dan ASESOR tak tersentuh", ringkas(p).includes(`KOORDINATOR_MK|${pSi.id}|LOKAL`) && ringkas(p).includes("ASESOR|-|LOKAL"));

  const ketat = await sinkronkanFakta(prisma, dewi.id, { akunId: "akun-dewi", aktif: true, jenisPegawai: "TENDIK", homebaseUnitId: null, peran: [{ namaPeran: "rpkps:kaprodi", jabatan: { unit: { id: "unit-si", jenis: "PRODI" } } }] }, { ...OPSI, hapusLokal: true });
  p = await peranDari("dewi@itts.ac.id");
  cek("mode ketat: GPM LOKAL dihapus; koordinator dan asesor tetap", !ringkas(p).includes("GPM") && ringkas(p).includes("KOORDINATOR_MK") && ringkas(p).includes("ASESOR") && ketat?.dihapus === 1, ringkas(p));

  console.log("── 4 · admin bootstrap dilindungi; nonaktif di identitas → NONAKTIF");
  const boot = await buatPengguna("boot@itts.ac.id", "AKTIF");
  await prisma.penugasanPeran.create({ data: { penggunaId: boot.id, peran: "ADMIN", prodiId: null } });
  await sinkronkanFakta(prisma, boot.id, { akunId: "akun-boot", aktif: true, jenisPegawai: "TENDIK", homebaseUnitId: null, peran: [] }, { ...OPSI, hapusLokal: true });
  p = await peranDari("boot@itts.ac.id");
  cek("ADMIN bootstrap tetap ada walau mode ketat dan identitas-itts tak memetakannya", ringkas(p) === "ADMIN|-|LOKAL", ringkas(p));

  const eko = await buatPengguna("eko@itts.ac.id", "AKTIF");
  await sinkronkanFakta(prisma, eko.id, { akunId: "akun-eko", aktif: true, jenisPegawai: "DOSEN", homebaseUnitId: "unit-if", peran: [] }, OPSI);
  const hEko = await sinkronkanFakta(prisma, eko.id, { akunId: "akun-eko", aktif: false, jenisPegawai: "DOSEN", homebaseUnitId: "unit-if", peran: [] }, OPSI);
  p = await peranDari("eko@itts.ac.id");
  cek("pegawai nonaktif: peran turunan dicabut dan status NONAKTIF", (p?.penugasan.length ?? 1) === 0 && p?.status === "NONAKTIF" && hEko?.statusBaru === "NONAKTIF", ringkas(p));
  await sinkronkanFakta(prisma, eko.id, { akunId: "akun-eko", aktif: true, jenisPegawai: "DOSEN", homebaseUnitId: "unit-if", peran: [] }, OPSI);
  p = await peranDari("eko@itts.ac.id");
  cek("aktif kembali di identitas-itts: sinkron TIDAK menghidupkan NONAKTIF (keputusan admin)", p?.status === "NONAKTIF", p?.status);

  console.log("── 5 · surel yang sama, orang berbeda: tak diselaraskan");
  const fina = await buatPengguna("fina@itts.ac.id", "AKTIF", { identitasAkunId: "akun-fina-asli" });
  const salah = await sinkronkanFakta(prisma, fina.id, { akunId: "akun-orang-lain", aktif: true, jenisPegawai: "DOSEN", homebaseUnitId: "unit-if", peran: [] }, OPSI);
  p = await peranDari("fina@itts.ac.id");
  cek("baris bertaut ke akun lain tidak disentuh", salah === null && (p?.penugasan.length ?? 1) === 0 && p?.identitasAkunId === "akun-fina-asli");

  console.log("── 6 · sinkron menyeluruh");
  const direktori: BarisDirektori[] = [
    { akunId: "akun-siti", email: "siti@itts.ac.id", jenisPegawai: "DOSEN", aktif: true, homebaseUnitId: "unit-if" },
    { akunId: "akun-gita", email: "gita@itts.ac.id", jenisPegawai: "DOSEN", aktif: true, homebaseUnitId: "unit-si" }, // belum punya baris → cangkang
    { akunId: "akun-hadi", email: "hadi@itts.ac.id", jenisPegawai: "TENDIK", aktif: true, homebaseUnitId: null }, // tanpa peran → tak dibuat
    { akunId: "akun-ida", email: "ida@itts.ac.id", jenisPegawai: "DOSEN", aktif: true, homebaseUnitId: "unit-tk-baru" }, // homebase tak terpetakan
    { akunId: "akun-boot", email: "boot@itts.ac.id", jenisPegawai: "TENDIK", aktif: true, homebaseUnitId: null },
  ];
  const peranAplikasi: PeranAplikasi[] = [
    { namaPeran: "rpkps:gpm", jabatan: null, pemegang: [{ akunId: "akun-gita", email: "gita@itts.ac.id", aktif: true }] },
  ];
  const lap = await sinkronkanSemuaInti(prisma, { peranAplikasi, direktori }, OPSI);
  const gita = await peranDari("gita@itts.ac.id");
  cek("pegawai yang belum pernah membuka RPKPS dibuatkan cangkang berstatus AKTIF", gita?.status === "AKTIF" && gita?.identitasAkunId === "akun-gita", ringkas(gita));
  cek("cangkang memegang GPM (institusi) dan DOSEN (prodi SI), sumber IDENTITAS", ringkas(gita) === `DOSEN|${pSi.id}|IDENTITAS, GPM|-|IDENTITAS`, ringkas(gita));
  cek("tendik tanpa peran TIDAK dibuatkan baris", (await peranDari("hadi@itts.ac.id")) === null);
  cek("dosen dengan homebase tak terpetakan TIDAK dibuatkan baris, dan unitnya dilaporkan", (await peranDari("ida@itts.ac.id")) === null && lap.unitTakTerpetakan.includes("unit-tk-baru"), JSON.stringify(lap.unitTakTerpetakan));
  cek("eko (bertaut, tak ada di direktori aktif) → tetap NONAKTIF; fina (akun berbeda) tak disentuh", (await peranDari("eko@itts.ac.id"))?.status === "NONAKTIF");
  cek("laporan menghitung cangkang baru", lap.penggunaBaru === 1 && lap.ditolak === null, JSON.stringify({ baru: lap.penggunaBaru, tolak: lap.ditolak }));
  const boot2 = await peranDari("boot@itts.ac.id");
  cek("ADMIN bootstrap selamat dari sinkron menyeluruh", ringkas(boot2) === "ADMIN|-|LOKAL", ringkas(boot2));

  console.log("── 7 · pagar: identitas-itts yang keliru tidak boleh mencabut peran serentak");
  // 12 pegawai bertaut, masing-masing DOSEN IDENTITAS. Direktori "aktif" hanya memuat 1 → 11 pencabutan > batas 5.
  const anggota = Array.from({ length: 12 }, (_, i) => `massal${i}@itts.ac.id`);
  for (const [i, email] of anggota.entries()) {
    const m = await buatPengguna(email, "AKTIF", { identitasAkunId: `akun-massal${i}` });
    await prisma.penugasanPeran.create({ data: { penggunaId: m.id, peran: "DOSEN", prodiId: pIf.id, sumber: "IDENTITAS" } });
  }
  const sebelum = await prisma.penugasanPeran.count();
  const keliru = await sinkronkanSemuaInti(prisma, { peranAplikasi: [], direktori: [{ akunId: "akun-massal0", email: anggota[0], jenisPegawai: "DOSEN", aktif: true, homebaseUnitId: "unit-if" }] }, OPSI);
  cek("pencabutan massal ditolak oleh pagar", keliru.ditolak?.alasan === "pagar-penghapusan" && keliru.ditolak.akanHapus > keliru.ditolak.batas, JSON.stringify(keliru.ditolak));
  cek("dan TIDAK ADA satu baris pun yang berubah", (await prisma.penugasanPeran.count()) === sebelum);

  const kosong = await sinkronkanSemuaInti(prisma, { peranAplikasi: [], direktori: [] }, OPSI);
  cek("direktori kosong padahal ada yang bertaut → ditolak (bukan mencabut semua orang)", kosong.ditolak?.alasan === "direktori-kosong" && (await prisma.penugasanPeran.count()) === sebelum);

  console.log("── 8 · peta prodi dan constraint");
  const tak = await prisma.prodi.findFirstOrThrow({ where: { kode: "TK" } });
  cek("prodi.identitas_unit_id null diizinkan berulang (belum dipetakan)", tak.identitasUnitId === null);
  let unikDitolak = false;
  try {
    await prisma.prodi.create({ data: { kode: "XX", nama: "Duplikat unit", fakultasId: fak.id, identitasUnitId: "unit-if" } });
  } catch {
    unikDitolak = true;
  }
  cek("satu unit identitas-itts tak dapat dipetakan ke dua prodi (unik)", unikDitolak);
  let akunGanda = false;
  try {
    await buatPengguna("ganda@itts.ac.id", "AKTIF", { identitasAkunId: "akun-siti" });
  } catch {
    akunGanda = true;
  }
  cek("satu akun identitas-itts tak dapat bertaut ke dua baris pengguna (unik)", akunGanda);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (process.exitCode) console.error("\nUji sinkron peran GAGAL.");
    else console.log("\nUji sinkron peran selesai.");
  });
