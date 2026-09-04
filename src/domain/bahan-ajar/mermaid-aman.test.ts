import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pesanTemuanId } from "@/lib/bahasa/temuan";
import { periksaMermaid } from "./mermaid-aman";

const SAH = `flowchart TD
  A[Mulai] --> B{Kasus dasar?}
  B -- ya --> C[Kembalikan nilai]
  B -- tidak --> D[Panggil diri sendiri]
  D --> B`;

function kode(mmd: string): string[] {
  return periksaMermaid(mmd).temuan.map((t) => t.kode);
}

describe("pemeriksaan Mermaid", () => {
  it("diagram alur biasa lolos", () => {
    assert.deepEqual(periksaMermaid(SAH).temuan, []);
    assert.equal(periksaMermaid(SAH).ok, true);
  });

  it("komentar biasa tidak mengganggu pengenalan jenis", () => {
    assert.deepEqual(kode(`%% catatan penyusun\n${SAH}`), []);
  });

  it("seluruh jenis yang diizinkan dikenali", () => {
    for (const jenis of [
      "flowchart TD",
      "graph LR",
      "sequenceDiagram",
      "stateDiagram-v2",
      "erDiagram",
      "classDiagram",
      "timeline",
      "gantt",
    ]) {
      assert.ok(
        !kode(`${jenis}\n  A --> B`).includes("IL-MMD-JENIS-ASING"),
        jenis,
      );
    }
  });

  it("jenis di luar daftar ditolak", () => {
    assert.ok(kode("pie title Bagian\n  a : 10").includes("IL-MMD-JENIS-ASING"));
    assert.ok(kode("mindmap\n  akar").includes("IL-MMD-JENIS-ASING"));
  });

  it("arahan init ditolak — diagram tidak boleh mematikan penjaganya sendiri", () => {
    // `%%{init}%%` dapat menyetel securityLevel dan htmlLabels, dua setelan
    // yang justru menjadi penjaga kita.
    assert.ok(
      kode(`%%{init: {"securityLevel":"loose"}}%%\n${SAH}`).includes("IL-MMD-ARAHAN"),
    );
  });

  it("click dan tautan ditolak", () => {
    assert.ok(kode(`${SAH}\n  click A "https://jahat.example"`).includes("IL-MMD-TAUTAN"));
    assert.ok(kode(`${SAH}\n  A --> E[https://jahat.example]`).includes("IL-MMD-TAUTAN"));
    assert.ok(kode(`${SAH}\n  click B call fungsiku()`).includes("IL-MMD-TAUTAN"));
  });

  it("markah HTML dalam label ditolak", () => {
    // Selain jalur masuk markah, label HTML tidak dirender di dalam <img>:
    // diagramnya akan tercetak dengan kotak kosong.
    assert.ok(kode(`flowchart TD\n  A["<b>tebal</b>"] --> B`).includes("IL-MMD-HTML"));
    assert.ok(kode(`flowchart TD\n  A["<img src=x onerror=alert(1)>"]`).includes("IL-MMD-HTML"));
  });

  it("panah dan pembanding tidak disalahartikan sebagai HTML", () => {
    // `-->`, `<--`, dan `a < b` bukan tag; menolaknya akan mematikan Mermaid.
    assert.deepEqual(kode("flowchart LR\n  A --> B\n  B <-- C\n  D[n < 10] --> E"), []);
  });

  it("style, classDef, dan linkStyle ditolak", () => {
    // Bukan lubang keamanan — pelanggaran cetakan gaya. Tema milik buku.
    for (const baris of [
      "style A fill:#f9f",
      "classDef merah fill:#f00",
      "linkStyle 0 stroke:#0f0",
    ]) {
      const hasil = periksaMermaid(`${SAH}\n  ${baris}`);
      assert.ok(
        hasil.temuan.some((t) => t.kode === "IL-MMD-GAYA-SENDIRI"),
        baris,
      );
    }
  });

  it("kode kosong dan kode raksasa ditolak", () => {
    assert.deepEqual(kode("   \n  \n"), ["IL-MMD-KOSONG"]);
    assert.deepEqual(kode("flowchart TD\n".padEnd(200_001, "x")), ["IL-MMD-TERLALU-BESAR"]);
  });

  it("setiap penolakan punya kalimatnya, dengan penanda terisi", () => {
    const semua = [
      "pie title x",
      `%%{init: {}}%%\n${SAH}`,
      `${SAH}\n  click A "https://x"`,
      `flowchart TD\n  A["<b>x</b>"]`,
      `${SAH}\n  style A fill:#f00`,
      "  ",
      "flowchart TD\n".padEnd(200_001, "x"),
    ];
    for (const mmd of semua) {
      for (const t of periksaMermaid(mmd).temuan) {
        const pesan = pesanTemuanId(t);
        // Yang dicari adalah penanda yang belum terisi (`{daftar}`), bukan
        // setiap kurung kurawal: kalimatnya mengutip kode yang ditolak, dan
        // kode itu sendiri boleh memuat kurawal.
        assert.doesNotMatch(pesan, /\{[a-zA-Z]+\}/, `${t.kode}: ${pesan}`);
        assert.notEqual(pesan, t.kode, `${t.kode} belum punya kalimat`);
      }
    }
  });
});
