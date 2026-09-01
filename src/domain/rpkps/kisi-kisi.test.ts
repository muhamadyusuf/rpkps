import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validasiKisiKisi, type KisiKisiInput, type KonteksKisiKisi } from "./kisi-kisi";
import { pesanTemuanId } from "@/lib/bahasa/temuan";

/** Konteks TI214: 7 Sub-CPMK sebelum UTS, 7 sesudahnya. */
function konteks(): KonteksKisiKisi {
  const sebelum = Array.from({ length: 7 }, (_, i) => `CPMK081-${i + 1}`);
  const sesudah = Array.from({ length: 7 }, (_, i) => `CPMK082-${i + 1}`);
  const level: Record<string, "C2" | "C3" | "C4" | "C6"> = {};
  const bobot: Record<string, number> = {};
  for (const k of [...sebelum, ...sesudah]) {
    level[k] = "C4";
    bobot[k] = 5;
  }
  return {
    subCpmkSebelumUts: sebelum,
    subCpmkSetelahUts: sesudah,
    levelSubCpmk: level,
    bobotSubCpmk: bobot,
  };
}

/** Kisi-kisi UTS sehat: tujuh Sub-CPMK, skor merata, total 100. */
function kisiKisiSehat(): KisiKisiInput {
  return {
    jenis: "UTS",
    totalSkor: 100,
    butir: Array.from({ length: 7 }, (_, i) => ({
      nomor: i + 1,
      subCpmkKode: `CPMK081-${i + 1}`,
      levelBloom: (i < 4 ? "C3" : "C4") as "C3" | "C4",
      jumlahButir: 2,
      skor: i === 6 ? 100 - 6 * 14 : 14,
    })),
  };
}

describe("kisi-kisi sehat", () => {
  it("lolos seluruh pemeriksaan", () => {
    const h = validasiKisiKisi(kisiKisiSehat(), konteks());
    assert.equal(
      h.lolos,
      true,
      `pemblokir: ${h.pemblokir.map((t) => `${t.kode}: ${pesanTemuanId(t)}`).join(" | ")}`,
    );
    assert.equal(h.ringkasan.totalSkor, 100);
    assert.equal(h.ringkasan.subCpmkTercakup, 7);
    assert.equal(h.ringkasan.jumlahButir, 14);
  });
});

describe("total skor", () => {
  it("skor yang tidak berjumlah 100 adalah pemblokir", () => {
    const k = kisiKisiSehat();
    k.butir[0].skor = 30;
    const h = validasiKisiKisi(k, konteks());
    const t = h.pemblokir.find((x) => x.kode === "KK-TOTAL-SKOR");
    assert.ok(t);
    assert.match(pesanTemuanId(t!), /116/);
  });

  it("kisi-kisi kosong adalah pemblokir", () => {
    const h = validasiKisiKisi({ jenis: "UTS", totalSkor: 100, butir: [] }, konteks());
    assert.ok(h.pemblokir.some((t) => t.kode === "KK-KOSONG"));
  });

  it("butir berskor nol ditandai", () => {
    const k = kisiKisiSehat();
    k.butir[0].skor = 0;
    k.butir[6].skor = 28;
    assert.ok(
      validasiKisiKisi(k, konteks()).pemblokir.some((t) => t.kode === "KK-SKOR-NOL"),
    );
  });
});

describe("cakupan Sub-CPMK", () => {
  it("Sub-CPMK yang diajarkan tapi tidak diuji adalah pemblokir", () => {
    const k = kisiKisiSehat();
    k.butir = k.butir.slice(0, 6);
    k.butir[5].skor = 100 - 5 * 14;
    const h = validasiKisiKisi(k, konteks());
    const t = h.pemblokir.find((x) => x.kode === "KK-SUB-CPMK-TIDAK-DIUJI");
    assert.ok(t);
    assert.match(pesanTemuanId(t!), /CPMK081-7/);
  });

  it("menguji Sub-CPMK milik mata kuliah lain adalah pemblokir", () => {
    const k = kisiKisiSehat();
    k.butir[0].subCpmkKode = "CPMK999-1";
    assert.ok(
      validasiKisiKisi(k, konteks()).pemblokir.some((t) => t.kode === "KK-SUB-CPMK-ASING"),
    );
  });

  it("UTS yang menguji materi setelah UTS hanya diperingatkan", () => {
    const k = kisiKisiSehat();
    k.butir.push({
      nomor: 8,
      subCpmkKode: "CPMK082-1",
      levelBloom: "C3",
      jumlahButir: 1,
      skor: 0.01,
    });
    k.butir[6].skor = 100 - 6 * 14 - 0.01;
    const h = validasiKisiKisi(k, konteks());
    assert.ok(h.peringatan.some((t) => t.kode === "KK-SUB-CPMK-BELUM-DIAJARKAN"));
  });
});

describe("level Bloom", () => {
  it("menguji di atas level Sub-CPMK diperingatkan", () => {
    const k = kisiKisiSehat();
    k.butir[0].levelBloom = "C6"; // Sub-CPMK ada di C4
    const h = validasiKisiKisi(k, konteks());
    const t = h.peringatan.find((x) => x.kode === "KK-LEVEL-MELAMPAUI");
    assert.ok(t);
    assert.match(pesanTemuanId(t!), /C6/);
  });

  it("ujian yang hampir seluruhnya C1–C2 diperingatkan", () => {
    const k = kisiKisiSehat();
    for (const b of k.butir) b.levelBloom = "C1";
    const h = validasiKisiKisi(k, konteks());
    const t = h.peringatan.find((x) => x.kode === "KK-BLOOM-TIMPANG");
    assert.ok(t);
    assert.match(pesanTemuanId(t!), /100%/);
  });

  it("sebaran level dilaporkan pada ringkasan", () => {
    const h = validasiKisiKisi(kisiKisiSehat(), konteks());
    assert.equal(Object.keys(h.ringkasan.sebaranBloom).sort().join(","), "C3,C4");
  });
});

describe("proporsi bobot ajar vs bobot uji", () => {
  it("Sub-CPMK yang porsi ujinya jauh melenceng diperingatkan", () => {
    const k = kisiKisiSehat();
    // Satu Sub-CPMK memborong hampir seluruh skor.
    k.butir[0].skor = 70;
    for (let i = 1; i < 7; i += 1) k.butir[i].skor = 5;
    const h = validasiKisiKisi(k, konteks());
    assert.ok(h.peringatan.some((t) => t.kode === "KK-PROPORSI"));
  });

  it("porsi seimbang tidak menghasilkan peringatan proporsi", () => {
    const h = validasiKisiKisi(kisiKisiSehat(), konteks());
    assert.equal(h.peringatan.filter((t) => t.kode === "KK-PROPORSI").length, 0);
  });
});

describe("UAS", () => {
  it("memeriksa Sub-CPMK setelah UTS, bukan sebelumnya", () => {
    const k: KisiKisiInput = {
      jenis: "UAS",
      totalSkor: 100,
      butir: Array.from({ length: 7 }, (_, i) => ({
        nomor: i + 1,
        subCpmkKode: `CPMK082-${i + 1}`,
        levelBloom: "C3" as const,
        jumlahButir: 1,
        skor: i === 6 ? 100 - 6 * 14 : 14,
      })),
    };
    assert.equal(validasiKisiKisi(k, konteks()).lolos, true);
  });
});
