import assert from "node:assert/strict";
import { test } from "node:test";
import { buatCache } from "./cache";
import {
  uraiBarisDirektori,
  uraiBatchPegawai,
  uraiHalamanDirektori,
  uraiHasilCari,
  uraiPeranAplikasi,
  uraiProfil,
  uraiStatusDasar,
  uraiStatusPegawai,
} from "./kontrak";
import {
  bolehLewatGerbangLokal,
  pagarPenghapusan,
  peranLokalBoleh,
  rekonsiliasi,
  statusSetelahSinkron,
  turunkanPeran,
  type PenugasanAda,
  type PetaProdi,
} from "./peran";
import { dataPengguna, gabungNama, susunTampilan, tampilanDariProfil, tampilanLokal, tampilanTakDiketahui } from "./tampilan";

const PETA: PetaProdi = new Map([
  ["unit-if", "prodi-if"],
  ["unit-si", "prodi-si"],
]);
const kaprodi = (unitId: string, jenis = "PRODI") => ({ namaPeran: "rpkps:kaprodi", jabatan: { unit: { id: unitId, jenis } } });
const dosen = (over: Partial<Parameters<typeof turunkanPeran>[0]> = {}) => ({
  aktif: true,
  jenisPegawai: "DOSEN",
  homebaseUnitId: "unit-if",
  peran: [] as never[],
  ...over,
});

// ═══ turunkanPeran ═════════════════════════════════════════════════════════

test("dosen aktif dengan homebase terpetakan → DOSEN di prodi itu", () => {
  assert.deepEqual(turunkanPeran(dosen(), PETA).penugasan, [{ peran: "DOSEN", prodiId: "prodi-if" }]);
});

test("KAPRODI mengikuti UNIT jabatannya, bukan homebase dosennya", () => {
  const t = turunkanPeran(dosen({ homebaseUnitId: "unit-if", peran: [kaprodi("unit-si")] }), PETA);
  assert.deepEqual(t.penugasan, [
    { peran: "DOSEN", prodiId: "prodi-if" },
    { peran: "KAPRODI", prodiId: "prodi-si" },
  ]);
});

test("ADMIN dan GPM bercakupan institusi; nama peran tak peka huruf besar/kecil dan spasi", () => {
  const t = turunkanPeran(
    { aktif: true, jenisPegawai: "TENDIK", homebaseUnitId: null, peran: [{ namaPeran: " RPKPS:Admin ", jabatan: null }, { namaPeran: "rpkps:gpm", jabatan: null }] },
    PETA,
  );
  assert.deepEqual(t.penugasan, [
    { peran: "ADMIN", prodiId: null },
    { peran: "GPM", prodiId: null },
  ]);
});

test("GAGAL-TERTUTUP: prodi tak dapat dipastikan → TIDAK diberi peran, dan tidak pernah ber-prodiId null", () => {
  // Kaprodi pada unit yang belum dipetakan.
  const a = turunkanPeran(dosen({ jenisPegawai: "TENDIK", peran: [kaprodi("unit-baru")] }), PETA);
  assert.deepEqual(a.penugasan, []);
  assert.deepEqual(a.diabaikan, [{ sumber: "rpkps:kaprodi", alasan: "prodi-belum-dipetakan", unitId: "unit-baru" }]);

  // Kaprodi tanpa jabatan (peran melekat ke orang) → tak ada prodi.
  const b = turunkanPeran(dosen({ jenisPegawai: "TENDIK", peran: [{ namaPeran: "rpkps:kaprodi", jabatan: null }] }), PETA);
  assert.deepEqual(b.penugasan, []);
  assert.equal(b.diabaikan[0].alasan, "jabatan-tak-ada");

  // Jabatan Kaprodi di unit yang bukan PRODI (mis. fakultas): bukan cakupan prodi.
  const c = turunkanPeran(dosen({ jenisPegawai: "TENDIK", peran: [kaprodi("unit-if", "FAKULTAS")] }), PETA);
  assert.deepEqual(c.penugasan, []);
  assert.equal(c.diabaikan[0].alasan, "unit-bukan-prodi");

  // Dosen tanpa homebase / homebase tak terpetakan: tak ada DOSEN (DOSEN ber-null = DOSEN di SEMUA prodi).
  const d = turunkanPeran(dosen({ homebaseUnitId: null }), PETA);
  assert.deepEqual(d.penugasan, []);
  assert.equal(d.diabaikan[0].alasan, "homebase-kosong");
  const e = turunkanPeran(dosen({ homebaseUnitId: "unit-tak-dikenal" }), PETA);
  assert.deepEqual(e.penugasan, []);
  assert.equal(e.diabaikan[0].alasan, "homebase-belum-dipetakan");
  assert.equal(e.diabaikan[0].unitId, "unit-tak-dikenal", "laporan menyebut UNIT mana yang perlu dipetakan");

  for (const t of [a, b, c, d, e]) {
    assert.equal(t.penugasan.some((p) => (p.peran === "DOSEN" || p.peran === "KAPRODI") && p.prodiId === null), false);
  }
});

test("pegawai nonaktif tidak membawa peran apa pun, walau dipetakan", () => {
  const t = turunkanPeran(dosen({ aktif: false, peran: [kaprodi("unit-if"), { namaPeran: "rpkps:admin", jabatan: null }] }), PETA);
  assert.deepEqual(t, { penugasan: [], diabaikan: [] });
});

test("peran yang tak dikenal RPKPS diabaikan dan dilaporkan; tendik tanpa peran → kosong", () => {
  const t = turunkanPeran({ aktif: true, jenisPegawai: "TENDIK", homebaseUnitId: null, peran: [{ namaPeran: "persuratan:operator", jabatan: null }] }, PETA);
  assert.deepEqual(t.penugasan, []);
  assert.deepEqual(t.diabaikan, [{ sumber: "persuratan:operator", alasan: "peran-tak-dikenal" }]);
});

test("tanpa duplikat dan urutannya stabil", () => {
  const t = turunkanPeran(dosen({ peran: [kaprodi("unit-if"), kaprodi("unit-if"), { namaPeran: "rpkps:admin", jabatan: null }] }), PETA);
  assert.deepEqual(t.penugasan.map((p) => `${p.peran}|${p.prodiId}`), ["ADMIN|null", "DOSEN|prodi-if", "KAPRODI|prodi-if"]);
});

// ═══ rekonsiliasi ══════════════════════════════════════════════════════════

const ada = (id: string, peran: PenugasanAda["peran"], prodiId: string | null, sumber: PenugasanAda["sumber"]): PenugasanAda => ({ id, peran, prodiId, sumber });

test("rekonsiliasi: tambah yang kurang, hapus turunan yang tak lagi berlaku, biarkan yang sama", () => {
  const r = rekonsiliasi(
    [{ peran: "DOSEN", prodiId: "prodi-if" }, { peran: "KAPRODI", prodiId: "prodi-if" }],
    [ada("a", "DOSEN", "prodi-if", "IDENTITAS"), ada("b", "KAPRODI", "prodi-si", "IDENTITAS")],
    { hapusLokal: false },
  );
  assert.deepEqual(r.tambah, [{ peran: "KAPRODI", prodiId: "prodi-if" }]);
  assert.deepEqual(r.hapus, ["b"]);
  assert.deepEqual(r.promosi, []);
});

test("rekonsiliasi: peran LOKAL yang identik dipromosikan (bukan digandakan — akan melanggar unik)", () => {
  const r = rekonsiliasi([{ peran: "KAPRODI", prodiId: "prodi-if" }], [ada("x", "KAPRODI", "prodi-if", "LOKAL")], { hapusLokal: false });
  assert.deepEqual(r.tambah, []);
  assert.deepEqual(r.promosi, ["x"]);
  assert.deepEqual(r.hapus, []);
});

test("rekonsiliasi: LOKAL turunan yang tak didukung identitas-itts DILAPORKAN, tidak dihapus — kecuali diminta", () => {
  const lokal = ada("l", "KAPRODI", "prodi-si", "LOKAL");
  const aman = rekonsiliasi([], [lokal], { hapusLokal: false });
  assert.deepEqual(aman.hapus, []);
  assert.deepEqual(aman.lokalTakDidukung, [lokal]);

  const ketat = rekonsiliasi([], [lokal], { hapusLokal: true });
  assert.deepEqual(ketat.hapus, ["l"]);
  assert.deepEqual(ketat.lokalTakDidukung, [lokal]);
});

test("rekonsiliasi: admin bootstrap dilindungi walau mode ketat", () => {
  const boot = ada("boot", "ADMIN", null, "LOKAL");
  const r = rekonsiliasi([], [boot], { hapusLokal: true, lindungi: (p) => p.peran === "ADMIN" });
  assert.deepEqual(r.hapus, []);
  assert.deepEqual(r.lokalTakDidukung, [boot]);
});

test("rekonsiliasi: peran di luar PERAN_TURUNAN (koordinator, asesor, mahasiswa) TIDAK PERNAH disentuh", () => {
  const lain = [ada("k", "KOORDINATOR_MK", "prodi-if", "LOKAL"), ada("s", "ASESOR", null, "LOKAL"), ada("m", "MAHASISWA", null, "LOKAL")];
  const r = rekonsiliasi([], lain, { hapusLokal: true });
  assert.deepEqual(r, { tambah: [], promosi: [], hapus: [], lokalTakDidukung: [] });
});

test("pagarPenghapusan: lantai 5, lalu 25% — pencabutan serentak dari identitas yang keliru ditolak", () => {
  assert.deepEqual(pagarPenghapusan(10, 5), { ok: true, batas: 5 });
  assert.deepEqual(pagarPenghapusan(10, 6), { ok: false, batas: 5 });
  assert.deepEqual(pagarPenghapusan(400, 100), { ok: true, batas: 100 });
  assert.deepEqual(pagarPenghapusan(400, 101), { ok: false, batas: 100 });
  assert.equal(pagarPenghapusan(0, 0).ok, true);
});

// ═══ kontrak (data tak tepercaya) ══════════════════════════════════════════

const PROFIL = {
  akunId: "a1",
  pegawaiId: "p1",
  email: "Siti@ITTS.ac.id",
  namaLengkap: "Siti Aminah",
  gelarDepan: "Dr.",
  gelarBelakang: "M.Kom.",
  nidn: "0411",
  nip: null,
  jenisPegawai: "DOSEN",
  statusPegawai: "TETAP",
  statusAkun: "AKTIF",
  aktif: true,
  homebase: { unitId: "unit-if", nama: "Informatika", singkatan: "IF" },
};

test("uraiProfil: bentuk sah → surel dinormalkan, homebase menjadi unitId", () => {
  assert.deepEqual(uraiProfil(PROFIL), {
    akunId: "a1",
    email: "siti@itts.ac.id",
    namaLengkap: "Siti Aminah",
    gelarDepan: "Dr.",
    gelarBelakang: "M.Kom.",
    nidn: "0411",
    nip: null,
    jenisPegawai: "DOSEN",
    aktif: true,
    homebaseUnitId: "unit-if",
  });
  assert.equal(uraiProfil({ ...PROFIL, homebase: null })!.homebaseUnitId, null);
});

test("uraiProfil: apa pun yang cacat → null, tanpa melempar", () => {
  for (const cacat of [
    null,
    "teks",
    [],
    {},
    { ...PROFIL, akunId: 5 },
    { ...PROFIL, email: "" },
    { ...PROFIL, namaLengkap: undefined },
    { ...PROFIL, aktif: "ya" },
    { ...PROFIL, nidn: 411 },
    { ...PROFIL, gelarDepan: undefined },
    { ...PROFIL, homebase: "IF" },
    { ...PROFIL, homebase: { nama: "tanpa unitId" } },
    { ...PROFIL, namaLengkap: "x".repeat(501) },
  ]) {
    assert.equal(uraiProfil(cacat), null, JSON.stringify(cacat)?.slice(0, 60));
  }
});

test("uraiBatchPegawai: baris cacat dibuang, yang sah tetap; bentuk luar cacat → null", () => {
  const r = uraiBatchPegawai({ pegawai: [PROFIL, { akunId: 1 }], tidakDitemukan: ["z", 7] });
  assert.equal(r!.pegawai.length, 1);
  assert.deepEqual(r!.tidakDitemukan, ["z"]);
  assert.equal(uraiBatchPegawai({ pegawai: "x", tidakDitemukan: [] }), null);
  assert.equal(uraiBatchPegawai(null), null);
});

test("uraiStatusPegawai: bukan pegawai, nonaktif, aktif lengkap, dan cacat", () => {
  assert.deepEqual(uraiStatusPegawai({ terdaftar: false, aktif: false, nama: null }), { terdaftar: false });
  assert.deepEqual(uraiStatusPegawai({ terdaftar: true, aktif: false, nama: "Siti", peran: [] }), { terdaftar: true, aktif: false, nama: "Siti" });

  const aktif = uraiStatusPegawai({
    terdaftar: true, aktif: true, nama: "Siti", akunId: "a1", jenisPegawai: "DOSEN", homebaseUnitId: "unit-if",
    peran: [{ namaPeran: "rpkps:kaprodi", deskripsi: null, jabatan: { id: "j1", nama: "Kaprodi", unit: { id: "unit-if", jenis: "PRODI", nama: "IF", singkatan: "IF" } } }],
  });
  assert.deepEqual(aktif, {
    terdaftar: true, aktif: true, nama: "Siti", akunId: "a1", jenisPegawai: "DOSEN", homebaseUnitId: "unit-if",
    peran: [{ namaPeran: "rpkps:kaprodi", jabatan: { unit: { id: "unit-if", jenis: "PRODI" } } }],
  });

  // Penyedia LAMA (sebelum perluasan) tak menjawab akunId/peran: harus terbaca sebagai cacat untuk pegawai aktif,
  // bukan diam-diam dianggap "tanpa peran".
  assert.equal(uraiStatusPegawai({ terdaftar: true, aktif: true, nama: "Siti" }), null);
  assert.equal(uraiStatusPegawai({ terdaftar: true, aktif: true, nama: "S", akunId: "a", jenisPegawai: "DOSEN", peran: [{ namaPeran: 5 }] }), null);
  assert.equal(uraiStatusPegawai({ terdaftar: "ya" }), null);
  assert.equal(uraiStatusPegawai(undefined), null);
});

test("uraiHalamanDirektori: kursor, baris cacat dihitung, bentuk cacat → null", () => {
  const baris = { akunId: "a1", email: "A@B.C", jenisPegawai: "DOSEN", aktif: true, homebaseUnitId: null };
  assert.deepEqual(uraiHalamanDirektori({ pegawai: [baris, { akunId: 1 }], berikutnya: "kur" }), {
    pegawai: [{ ...baris, email: "a@b.c" }],
    berikutnya: "kur",
    cacat: 1,
  });
  assert.equal(uraiHalamanDirektori({ pegawai: [], berikutnya: null })!.berikutnya, null);
  assert.equal(uraiHalamanDirektori({ pegawai: [] }), null, "tanpa `berikutnya` = jawaban tak dapat dipercaya");
  assert.equal(uraiHalamanDirektori({ pegawai: "x", berikutnya: null }), null);
  assert.equal(uraiBarisDirektori({ ...baris, aktif: "ya" }), null);
});

test("uraiPeranAplikasi: pemegang membawa akunId/aktif; satu pemegang cacat menggagalkan seluruh jawaban", () => {
  const sah = { peran: [{ namaPeran: "rpkps:gpm", jabatan: null, pemegang: [{ akunId: "a1", email: "A@B.C", aktif: true }] }] };
  assert.deepEqual(uraiPeranAplikasi(sah), [{ namaPeran: "rpkps:gpm", jabatan: null, pemegang: [{ akunId: "a1", email: "a@b.c", aktif: true }] }]);
  // Sengaja ketat: jawaban setengah rusak yang diterima sebagian = pencabutan peran diam-diam.
  assert.equal(uraiPeranAplikasi({ peran: [{ namaPeran: "x", jabatan: null, pemegang: [{ akunId: "a1" }] }] }), null);
  assert.equal(uraiPeranAplikasi({ peran: "x" }), null);
  assert.deepEqual(uraiPeranAplikasi({ peran: [] }), []);
});

// ═══ cache ═════════════════════════════════════════════════════════════════

test("cache: segar → basi → mati menurut umur, dan basi tetap terbaca", () => {
  let t = 0;
  const c = buatCache<string>({ ttlMs: 100, basiMs: 1000, maks: 10, sekarang: () => t });
  c.simpan("k", "v");
  assert.deepEqual(c.ambil("k"), { nilai: "v", segar: true });
  t = 100;
  assert.deepEqual(c.ambil("k"), { nilai: "v", segar: true }, "tepat di batas masih segar");
  t = 101;
  assert.deepEqual(c.ambil("k"), { nilai: "v", segar: false });
  t = 1100;
  assert.deepEqual(c.ambil("k"), { nilai: "v", segar: false });
  t = 1101;
  assert.equal(c.ambil("k"), null, "lebih tua dari ttl+basi dibuang");
  assert.equal(c.ukuran(), 0);
  assert.equal(c.ambil("tak-ada"), null);
});

test("cache: berbatas — yang paling lama tak dipakai dibuang; memakai entri menyelamatkannya", () => {
  const c = buatCache<number>({ ttlMs: 1000, basiMs: 1000, maks: 2, sekarang: () => 0 });
  c.simpan("a", 1);
  c.simpan("b", 2);
  c.ambil("a"); // a jadi terbaru dipakai
  c.simpan("c", 3); // b terbuang
  assert.equal(c.ambil("b"), null);
  assert.equal(c.ambil("a")!.nilai, 1);
  assert.equal(c.ambil("c")!.nilai, 3);
  assert.equal(c.ukuran(), 2);
});

test("cache: simpan ulang menyegarkan umur; hapus dan kosongkan", () => {
  let t = 0;
  const c = buatCache<string>({ ttlMs: 100, basiMs: 100, maks: 5, sekarang: () => t });
  c.simpan("k", "lama");
  t = 150;
  assert.equal(c.ambil("k")!.segar, false);
  c.simpan("k", "baru");
  assert.deepEqual(c.ambil("k"), { nilai: "baru", segar: true });
  c.hapus("k");
  assert.equal(c.ambil("k"), null);
  c.simpan("x", "1");
  c.kosongkan();
  assert.equal(c.ukuran(), 0);
});

// ═══ tampilan ══════════════════════════════════════════════════════════════

test("tampilan: pegawai bergelar; lokal hanya nama; tak diketahui bernama darurat dan ditandai", () => {
  const p = uraiProfil(PROFIL)!;
  assert.deepEqual(tampilanDariProfil(p), { nama: "Siti Aminah", gelarDepan: "Dr.", gelarBelakang: "M.Kom.", namaLengkap: "Dr. Siti Aminah, M.Kom.", nidn: "0411", nip: null, sumber: "IDENTITAS" });
  assert.deepEqual(tampilanLokal("Asesor Luar"), { nama: "Asesor Luar", gelarDepan: null, gelarBelakang: null, namaLengkap: "Asesor Luar", nidn: null, nip: null, sumber: "LOKAL" });
  assert.deepEqual(tampilanTakDiketahui("budi.santoso@itts.ac.id"), { nama: "budi.santoso", gelarDepan: null, gelarBelakang: null, namaLengkap: "budi.santoso", nidn: null, nip: null, sumber: "TAK_DIKETAHUI" });
  assert.equal(tampilanDariProfil({ ...p, gelarDepan: null, gelarBelakang: null }).namaLengkap, "Siti Aminah");
});

// ═══ status setelah sinkron & gerbang lokal ════════════════════════════════

test("statusSetelahSinkron: nonaktif di identitas → NONAKTIF; menunggu + punya peran → AKTIF; NONAKTIF tak pernah dihidupkan sinkron", () => {
  assert.equal(statusSetelahSinkron("AKTIF", false, 3), "NONAKTIF");
  assert.equal(statusSetelahSinkron("MENUNGGU_VERIFIKASI", false, 0), "NONAKTIF");
  assert.equal(statusSetelahSinkron("NONAKTIF", false, 0), null, "sudah nonaktif: tak ada yang berubah");

  assert.equal(statusSetelahSinkron("MENUNGGU_VERIFIKASI", true, 1), "AKTIF");
  assert.equal(statusSetelahSinkron("MENUNGGU_VERIFIKASI", true, 0), null, "tendik tanpa peran tetap tertahan");

  assert.equal(statusSetelahSinkron("NONAKTIF", true, 5), null, "admin yang menonaktifkan; sinkron tak boleh membukanya lagi");
  assert.equal(statusSetelahSinkron("AKTIF", true, 0), null, "aktif yang kehilangan semua peran tetap aktif (tak dikunci diam-diam)");
});

test("bolehLewatGerbangLokal: hanya asesor/mahasiswa yang tak bertaut ke identitas dan AKTIF", () => {
  const dasar = { identitasAkunId: null, status: "AKTIF" as const, peran: ["ASESOR" as const] };
  assert.equal(bolehLewatGerbangLokal(dasar), true);
  assert.equal(bolehLewatGerbangLokal({ ...dasar, peran: ["ASESOR", "MAHASISWA"] }), true);

  assert.equal(bolehLewatGerbangLokal({ ...dasar, identitasAkunId: "a1" }), false, "pegawai wajib lolos gerbang");
  assert.equal(bolehLewatGerbangLokal({ ...dasar, status: "MENUNGGU_VERIFIKASI" }), false);
  assert.equal(bolehLewatGerbangLokal({ ...dasar, status: "NONAKTIF" }), false);
  assert.equal(bolehLewatGerbangLokal({ ...dasar, peran: [] }), false, "tanpa peran tak ada dasar pengecualian");
  // Pegawai lama yang barisnya belum ditautkan tetap wajib lolos gerbang.
  for (const p of ["DOSEN", "KAPRODI", "GPM", "ADMIN", "KOORDINATOR_MK"] as const) {
    assert.equal(bolehLewatGerbangLokal({ ...dasar, peran: ["ASESOR", p] }), false, p);
  }
});

test("uraiStatusDasar: bagian lama untuk gerbang — terbaca walau perluasan (akunId/peran) belum ada", () => {
  // Identitas-itts versi lama: hanya tiga medan.
  assert.deepEqual(uraiStatusDasar({ terdaftar: true, aktif: true, nama: "Siti" }), { terdaftar: true, aktif: true, nama: "Siti" });
  assert.deepEqual(uraiStatusDasar({ terdaftar: false, aktif: false, nama: null }), { terdaftar: false, aktif: false, nama: null });
  // Versi baru: medan tambahan diabaikan di sini.
  assert.deepEqual(uraiStatusDasar({ terdaftar: true, aktif: true, nama: "S", akunId: "a", peran: [] }), { terdaftar: true, aktif: true, nama: "S" });
  // Cacat → null (gerbang gagal-tertutup), bukan dianggap "tidak terdaftar".
  for (const cacat of [null, {}, { terdaftar: "ya", aktif: true }, { terdaftar: true }, { terdaftar: true, aktif: true, nama: 5 }]) {
    assert.equal(uraiStatusDasar(cacat), null, JSON.stringify(cacat));
  }
});

test("susunTampilan: lokal, identitas, dan takdiketahui — nama lokal TIDAK menjadi cadangan bagi pegawai", () => {
  const siti = uraiProfil(PROFIL)!;
  const daftar = [
    { id: "u1", email: "asesor@luar.id", nama: "Asesor Luar", identitasAkunId: null },
    { id: "u2", email: "siti@itts.ac.id", nama: "nama lama yang usang", identitasAkunId: "a1" },
    { id: "u3", email: "budi.santoso@itts.ac.id", nama: "Budi Lama", identitasAkunId: "a-tak-terbaca" },
  ];
  const t = susunTampilan(daftar, new Map([["a1", siti]]));
  assert.deepEqual(t.get("u1"), tampilanLokal("Asesor Luar"));
  assert.equal(t.get("u2")!.namaLengkap, "Dr. Siti Aminah, M.Kom.", "pegawai: dari identitas-itts, bukan kolom lama");
  assert.equal(t.get("u2")!.sumber, "IDENTITAS");
  // Identitas-itts padam / bukan pegawai lagi: nama darurat dari surel, BUKAN "Budi Lama".
  assert.deepEqual(t.get("u3"), tampilanTakDiketahui("budi.santoso@itts.ac.id"));
  assert.equal(t.get("u3")!.sumber, "TAK_DIKETAHUI");
  assert.equal(susunTampilan([], new Map()).size, 0);
});

test("dataPengguna: bentuk LAMA domain RPKPS ({nama, gelarDepan, gelarBelakang, nidn, nip}) — nama tanpa gelar, seperti kolom `nama` dulu", () => {
  const d = dataPengguna(tampilanDariProfil(uraiProfil(PROFIL)!));
  assert.deepEqual(d, { nama: "Siti Aminah", gelarDepan: "Dr.", gelarBelakang: "M.Kom.", nidn: "0411", nip: null });
  // `proyeksiIsi` mengambil `nama` dan `nidn`: nama TANPA gelar, sama dengan yang dulu tersimpan di `pengguna.nama`.
  assert.equal(d.nama.includes("Dr."), false);
  assert.deepEqual(dataPengguna(tampilanLokal("A")), { nama: "A", gelarDepan: null, gelarBelakang: null, nidn: null, nip: null });
});

test("gabungNama: penulisan identitas-itts; gelar belakang berkoma lama tak digandakan komanya", () => {
  assert.equal(gabungNama({ nama: "Siti Aminah", gelarDepan: "Dr.", gelarBelakang: "M.Kom." }), "Dr. Siti Aminah, M.Kom.");
  assert.equal(gabungNama({ nama: "Siti Aminah", gelarDepan: "Dr.", gelarBelakang: ", M.Kom." }), "Dr. Siti Aminah, M.Kom.", "bentuk lama berkoma");
  assert.equal(gabungNama({ nama: "Budi", gelarDepan: null, gelarBelakang: "S.T." }), "Budi, S.T.");
  assert.equal(gabungNama({ nama: "Budi", gelarDepan: "Ir.", gelarBelakang: null }), "Ir. Budi");
  assert.equal(gabungNama({ nama: "Budi", gelarDepan: null, gelarBelakang: null }), "Budi");
  assert.equal(gabungNama({ nama: "Budi", gelarDepan: "  ", gelarBelakang: "  " }), "Budi", "gelar kosong spasi diabaikan");
});

test("uraiHasilCari: profil sah dikembalikan, baris cacat dibuang, bentuk asing = null", () => {
  const sah = uraiProfil(PROFIL)!;
  assert.deepEqual(uraiHasilCari({ pegawai: [PROFIL, { akunId: 5 }, "x"], batas: 20 }), [sah]);
  assert.deepEqual(uraiHasilCari({ pegawai: [] }), []);
  assert.equal(uraiHasilCari({ hasil: [] }), null);
  assert.equal(uraiHasilCari(null), null);
  assert.equal(uraiHasilCari([PROFIL]), null);
});

test("peranLokalBoleh: pegawai (bertaut) boleh peran lokal apa pun; pengguna LOKAL hanya ASESOR/MAHASISWA", () => {
  for (const p of ["ADMIN", "KAPRODI", "GPM", "KOORDINATOR_MK", "DOSEN", "ASESOR", "MAHASISWA"] as const) {
    assert.equal(peranLokalBoleh(true, p), true, `bertaut ${p}`);
  }
  assert.equal(peranLokalBoleh(false, "ASESOR"), true);
  assert.equal(peranLokalBoleh(false, "MAHASISWA"), true);
  for (const p of ["ADMIN", "KAPRODI", "GPM", "KOORDINATOR_MK", "DOSEN"] as const) {
    assert.equal(peranLokalBoleh(false, p), false, `lokal ${p} membuatnya tak bisa masuk`);
  }
});
