import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Penjaga dua keputusan wewenang buku ajar — docs/16 P2 dan P3.
 *
 * Dikerjakan dengan MEMBACA SUMBER, bukan dengan memanggil fungsinya: modul
 * itu `server-only` dan menarik klien Prisma pada tingkat modul, sehingga
 * memanggilnya di sini berarti menuntut basis data untuk menguji sebuah
 * keputusan yang sepenuhnya soal bentuk kode. Pola yang sama sudah dipakai
 * `terjemahan.test.ts`, yang membaca `schema.prisma`.
 *
 * Kedua keputusan ini terlihat seperti kekeliruan bagi orang yang belum
 * membaca docs/16, dan keduanya "mudah diperbaiki" menjadi salah.
 */

const SUMBER = readFileSync("src/lib/bahan-ajar/wenang.ts", "utf8");
const AKSI = readFileSync("src/app/[bahasa]/(app)/bahan-ajar/[id]/aksi.ts", "utf8");
const AKSI_BUAT = readFileSync("src/app/[bahasa]/(app)/bahan-ajar/aksi.ts", "utf8");

describe("wewenang buku ajar", () => {
  it("hak tulis diturunkan dari KEPENGAMPUAN, bukan dari wenang.boleh", () => {
    /*
     * `wenangAtasRpkps(...).boleh` bernilai `pengampu || pengelola`, dan
     * memakainya di sini akan memberi ADMIN/KAPRODI/GPM hak menulis buku atas
     * nama orang lain — sementara nama yang tercetak di halaman hak cipta dan
     * didaftarkan ke Perpusnas tetap nama dosen pengampu.
     */
    assert.match(SUMBER, /bolehTulis:\s*w\.pengampu/);
    assert.ok(
      !/bolehTulis:\s*w\.boleh\b/.test(SUMBER),
      "hak tulis buku ajar tidak boleh memakai wenang.boleh",
    );
  });

  it("membaca tetap selonggar membaca RPKPS", () => {
    assert.match(SUMBER, /bolehLihat:\s*w\.bolehLihat/);
  });

  it("status RPKPS tidak mengunci buku ajar", () => {
    /*
     * `bolehSuntingIsi` mengunci isi RPKPS begitu diajukan, karena Kaprodi dan
     * Penjaminan Mutu menandatangani isi tertentu. Buku ajar tidak
     * ditandatangani siapa pun dan justru paling banyak dikerjakan SESUDAH
     * RPKPS terbit; memasang kunci itu di sini akan mematikan fitur ini di
     * sepanjang semester yang menjadi masa pakainya.
     */
    for (const [nama, berkas] of [
      ["wenang.ts", SUMBER],
      ["aksi buku", AKSI],
      ["aksi buat", AKSI_BUAT],
    ] as const) {
      // Dicari bentuk PEMANGGILANNYA, bukan sekadar namanya: berkas wenang
      // menyebut `bolehSuntingIsi` di dalam komentar justru untuk menjelaskan
      // mengapa ia tidak dipakai, dan komentar itu harus boleh tetap ada.
      assert.ok(
        !/bolehSuntingIsi\s*\(/.test(berkas) && !/import[^;]*bolehSuntingIsi/.test(berkas),
        `${nama} tidak boleh mengunci buku ajar dengan status RPKPS`,
      );
    }
  });

  it("setiap aksi tulis melewati satu penjaga yang sama", () => {
    // Aturan wewenang yang disalin ke tiap berkas aksi adalah persis kesalahan
    // yang pernah terjadi di `rpkps/aksi.ts` — dan yang tidak perlu diulang.
    const aksiTulis = AKSI.match(/export async function (\w+)/g) ?? [];
    assert.ok(aksiTulis.length >= 6, `hanya ${aksiTulis.length} aksi terbaca`);
    const penjaga = (AKSI.match(/bukuUntukTulis\(/g) ?? []).length;
    // Satu definisi + satu pemanggilan di tiap aksi tulis.
    assert.ok(penjaga >= aksiTulis.length, `penjaga ${penjaga} < aksi ${aksiTulis.length}`);
  });

  it("tidak ada aksi yang menyusun seluruh bab dalam satu permintaan", () => {
    // docs/16 §3.2 — perulangannya milik antarmuka; satu Server Action yang
    // menunggu empat belas panggilan model menabrak batas waktu dan
    // menghanguskan bab yang sudah berhasil bersamanya.
    assert.ok(!/export async function susunSemua/.test(AKSI));
  });
});
