import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bacaBerkasNilai, buatTemplatNilai } from "./excel-nilai";
import { bacaNilai } from "@/domain/evaluasi/nilai";
import type { Asesmen } from "@/domain/evaluasi/peta-asesmen";

const ASESMEN: Asesmen[] = [
  {
    kode: "M2",
    nama: "Kuis 1",
    asal: "MINGGUAN",
    komponen: "Tugas",
    bobot: 10,
    minggu: [2],
    subCpmk: [{ kode: "S1", bobot: 10 }],
    pembagian: "RATA",
  },
  {
    kode: "UTS",
    nama: "Ujian tengah semester",
    asal: "UJIAN",
    komponen: "UTS",
    bobot: 30,
    minggu: [8],
    subCpmk: [{ kode: "S1", bobot: 15 }, { kode: "S2", bobot: 15 }],
    pembagian: "KISI_KISI",
  },
];

async function bolakBalik(peserta: { nim: string; nama: string; angkatan: number | null; skor: Record<string, number> }[]) {
  const buffer = await buatTemplatNilai({
    mk: { kode: "TI214", nama: "Basis Data" },
    tahunAkademik: "2025/2026-GENAP",
    kelas: "A",
    asesmen: ASESMEN,
    peserta,
  });
  const salinan = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(salinan).set(buffer);
  return bacaBerkasNilai(salinan);
}

describe("templat nilai bolak-balik", () => {
  it("mengembalikan skor yang sudah tersimpan apa adanya", async () => {
    const mentah = await bolakBalik([
      { nim: "1101", nama: "Ali", angkatan: 2023, skor: { M2: 80, UTS: 68.5 } },
      { nim: "1102", nama: "Budi", angkatan: 2023, skor: { M2: 60 } },
    ]);

    assert.equal(mentah.length, 2);
    assert.equal(mentah[0].nim, "1101");
    assert.equal(mentah[0].angkatan, "2023");

    const h = bacaNilai(mentah, ASESMEN);
    assert.equal(h.lolos, true);
    assert.deepEqual(h.baris[0].skor, { M2: 80, UTS: 68.5 });
    assert.equal(h.baris[0].angkatan, 2023);
    // Budi belum punya nilai UTS — sel kosong, bukan nol.
    assert.equal(h.baris[1].skor.UTS, null);
    assert.equal(h.ringkasan.selTerisi, 3);
  });

  it("menghasilkan kolom sesuai kode asesmen, bukan nama bebas", async () => {
    const mentah = await bolakBalik([{ nim: "1101", nama: "Ali", angkatan: null, skor: {} }]);
    assert.deepEqual(Object.keys(mentah[0].skor).sort(), ["M2", "UTS"]);
    const h = bacaNilai(mentah, ASESMEN);
    assert.deepEqual(h.ringkasan.kolomAsing, []);
    assert.deepEqual(h.ringkasan.kolomHilang, []);
  });
});
