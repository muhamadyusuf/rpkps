import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bekukanMermaid } from "./bekukan-mermaid";
import { periksaGayaSvg } from "./gaya-svg";
import { periksaSvgAman } from "./svg-aman";
import { uraiSvg } from "./svg-model";

/** Bentuk keluaran Mermaid: ada <style>, ada class, ada width/height. */
const KELUARAN_MERMAID = `<svg id="mmd-1" width="800" height="320" viewBox="0 0 800 320" xmlns="http://www.w3.org/2000/svg">
  <style>#mmd-1 .node rect{fill:#F3F4F6;stroke:#111827}#mmd-1 .edgePath path{stroke:#6B7280}</style>
  <g class="root">
    <g class="node" transform="translate(120,60)">
      <rect class="basic label-container" x="-60" y="-20" width="120" height="40"></rect>
      <text class="nodeLabel" x="0" y="5" style="font-size:16px">Mulai</text>
    </g>
    <path class="edgePath" d="M120 100 L300 160" style="fill:none"></path>
  </g>
</svg>`;

describe("membekukan Mermaid", () => {
  it("hasilnya lolos sanitasi DAN cetakan gaya", () => {
    // Keluaran Mermaid apa adanya tidak dapat disimpan: `<style>` ditolak.
    assert.equal(periksaSvgAman(KELUARAN_MERMAID).ok, false);

    const beku = bekukanMermaid(KELUARAN_MERMAID);
    assert.equal(beku.ok, true, JSON.stringify(beku.temuan));
    assert.equal(periksaSvgAman(beku.svg!).ok, true);
    assert.equal(periksaGayaSvg(beku.svg!).ok, true);
  });

  it("blok style dibuang beserta isinya", () => {
    const svg = bekukanMermaid(KELUARAN_MERMAID).svg!;
    assert.ok(!svg.includes("<style"));
    assert.ok(!svg.includes("edgePath path{"));
  });

  it("atribut style pada elemen ikut dibuang", () => {
    const svg = bekukanMermaid(KELUARAN_MERMAID).svg!;
    assert.ok(!/\sstyle\s*=/.test(svg));
  });

  it("ukuran tetap pada tag akar dibuang, viewBox dipertahankan", () => {
    const svg = bekukanMermaid(KELUARAN_MERMAID).svg!;
    const akar = svg.slice(0, svg.indexOf(">") + 1);
    assert.ok(!/\swidth=/.test(akar), "width akar masih ada");
    assert.ok(!/\sheight=/.test(akar), "height akar masih ada");
    assert.match(svg, /viewBox="0 0 800 320"/);
  });

  it("rupa dipasang eksplisit menurut jenis elemennya", () => {
    /*
     * Sesudah `<style>` hilang, elemen tanpa atribut rupa dirender dengan
     * bawaan SVG — isian hitam pekat. Aturan tetap ini yang menggantikannya.
     */
    const svg = bekukanMermaid(KELUARAN_MERMAID).svg!;
    const simpul = uraiSvg(svg);

    const rect = simpul.find((s) => s.tag === "rect")!;
    assert.equal(rect.atribut.get("fill")?.nilai, "#F3F4F6");
    assert.equal(rect.atribut.get("stroke")?.nilai, "#111827");

    const path = simpul.find((s) => s.tag === "path")!;
    assert.equal(path.atribut.get("fill")?.nilai, "none");
    assert.equal(path.atribut.get("stroke")?.nilai, "#6B7280");

    const text = simpul.find((s) => s.tag === "text")!;
    assert.equal(text.atribut.get("fill")?.nilai, "#111827");
    assert.match(text.atribut.get("font-family")?.nilai ?? "", /serif$/);
  });

  it("tidak ada atribut rupa yang muncul dua kali", () => {
    /*
     * Atribut ganda bukan galat XML — yang PERTAMA yang berlaku di sebagian
     * besar pengurai. Menambahkan `fill` baru tanpa membuang yang lama akan
     * diam-diam tidak berpengaruh apa-apa.
     */
    const svg = bekukanMermaid(KELUARAN_MERMAID).svg!;
    for (const tag of svg.match(/<(rect|path|text)\b[^>]*>/g) ?? []) {
      assert.equal((tag.match(/\sfill=/g) ?? []).length, 1, tag);
    }
  });

  it("geometri dan transform dipertahankan", () => {
    // Yang dibekukan adalah rupanya, bukan tata letaknya.
    const svg = bekukanMermaid(KELUARAN_MERMAID).svg!;
    assert.match(svg, /transform="translate\(120,60\)"/);
    assert.match(svg, /x="-60" y="-20" width="120" height="40"/);
    assert.match(svg, /d="M120 100 L300 160"/);
  });

  it("hasilnya benar-benar dapat disunting", () => {
    const svg = bekukanMermaid(KELUARAN_MERMAID).svg!;
    const simpul = uraiSvg(svg);
    assert.ok(simpul.some((s) => s.tag === "rect"));
    assert.ok(simpul.find((s) => s.tag === "text")?.teks?.nilai.includes("Mulai"));
  });

  it("keluaran yang tetap tidak sah ditolak, bukan disimpan separuh", () => {
    const jahat = `<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>`;
    const beku = bekukanMermaid(jahat);
    assert.equal(beku.ok, false);
    assert.equal(beku.svg, null);
    assert.ok(beku.temuan.length > 0);
  });
});
