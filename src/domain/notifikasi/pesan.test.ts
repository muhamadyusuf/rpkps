import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ringkasCatatan, susunNotifikasi } from "./pesan";
import { teksNotifikasi } from "@/lib/bahasa/notifikasi";
import { id } from "@/kamus/id";

/**
 * Kalimat Indonesia sebuah notifikasi. Uji ini menguji susunan katanya, dan
 * dengan begitu sekaligus membuktikan bahwa `params` sebuah peristiwa benar-
 * benar mengisi penanda pada kamusnya — penanda yang salah nama lolos `tsc`
 * tetapi tertinggal utuh sebagai "{mk}" di hasil render.
 */
const teks = (n: ReturnType<typeof susunNotifikasi>) =>
  teksNotifikasi({ kunci: n.kunci, params: n.params }, { judul: "", ringkasan: "" }, id);

describe("kalimat notifikasi", () => {
  it("pengajuan RPKPS menyebut mata kuliah, tahun akademik, dan pengaju", () => {
    const n = susunNotifikasi({
      jenis: "RPKPS_DIAJUKAN",
      rpkpsId: "r1",
      mk: "TI214 Basis Data",
      ta: "2025/2026 GENAP",
      oleh: "Dr. Sari",
    });
    assert.match(teks(n).judul, /TI214 Basis Data/);
    assert.match(teks(n).ringkasan, /Dr\. Sari/);
    assert.match(teks(n).ringkasan, /2025\/2026 GENAP/);
    assert.equal(n.tautan, "/rpkps/r1");
    assert.equal(n.entitasId, "r1");
  });

  it("pengembalian untuk revisi membawa catatannya, karena itu isi keputusannya", () => {
    const n = susunNotifikasi({
      jenis: "RPKPS_DIREVISI",
      rpkpsId: "r1",
      mk: "TI214",
      ta: "2025/2026 GENAP",
      oleh: "Kaprodi",
      catatan: "Bobot UAS belum cocok dengan tabel mingguan.",
    });
    assert.match(teks(n).ringkasan, /Bobot UAS belum cocok/);
  });

  it("penunjukan koordinator berbunyi berbeda dari penambahan pengampu biasa", () => {
    const k = susunNotifikasi({
      jenis: "RPKPS_PENGAMPU",
      rpkpsId: "r1",
      mk: "TI214",
      ta: "2025/2026 GENAP",
      oleh: "Kaprodi",
      peran: "KOORDINATOR",
    });
    const a = susunNotifikasi({
      jenis: "RPKPS_PENGAMPU",
      rpkpsId: "r1",
      mk: "TI214",
      ta: "2025/2026 GENAP",
      oleh: "Kaprodi",
      peran: "ANGGOTA",
    });
    assert.match(teks(k).judul, /koordinator/i);
    assert.notEqual(teks(k).ringkasan, teks(a).ringkasan);
  });

  it("penugasan koordinator MK menunjuk RPKPS bila sudah ada, mata kuliah bila belum", () => {
    const dasar = {
      jenis: "KOORDINATOR_MK_DITETAPKAN" as const,
      kurikulumId: "k1",
      mataKuliahId: "m1",
      mk: "TI214 Basis Data",
      ta: "2025/2026 GENAP",
      oleh: "Kaprodi",
    };

    const belum = susunNotifikasi({ ...dasar, rpkpsId: null });
    assert.equal(belum.tautan, "/kurikulum/k1/mk/m1");
    assert.equal(belum.entitas, "mata_kuliah");
    assert.match(teks(belum).ringkasan, /belum dibuat/);

    const sudah = susunNotifikasi({ ...dasar, rpkpsId: "r1" });
    assert.equal(sudah.tautan, "/rpkps/r1");
    assert.equal(sudah.entitas, "rpkps");
    assert.match(teks(sudah).ringkasan, /ikut diserahkan/);
  });

  it("keputusan usulan tanpa catatan tetap menghasilkan kalimat utuh", () => {
    const n = susunNotifikasi({
      jenis: "USULAN_DIPUTUSKAN",
      usulanId: "u1",
      judul: "Penajaman Sub-CPMK TI214",
      oleh: "Kaprodi",
      keputusan: "DISAHKAN",
      catatan: null,
    });
    assert.match(teks(n).judul, /disahkan/);
    assert.match(teks(n).ringkasan, /Kaprodi/);
    assert.equal(n.tautan, "/usulan/u1");
  });

  it("catatan kosong tidak menghasilkan ringkasan berakhir titik dua", () => {
    const n = susunNotifikasi({
      jenis: "USULAN_DIPUTUSKAN",
      usulanId: "u1",
      judul: "X",
      oleh: "Kaprodi",
      keputusan: "DITOLAK",
      catatan: "   ",
    });
    assert.doesNotMatch(teks(n).ringkasan, /:\s*$/);
  });
});

describe("ringkasan catatan", () => {
  it("catatan pendek dibiarkan utuh", () => {
    assert.equal(ringkasCatatan("Perbaiki bobot."), "Perbaiki bobot.");
  });

  it("spasi berlebih dan baris baru dirapatkan", () => {
    assert.equal(ringkasCatatan("Perbaiki\n\n  bobot."), "Perbaiki bobot.");
  });

  it("catatan panjang dipotong dengan elipsis, tidak dibuang", () => {
    const panjang = "a".repeat(200);
    const hasil = ringkasCatatan(panjang);
    assert.equal(hasil.length, 160);
    assert.ok(hasil.endsWith("…"));
  });
});
