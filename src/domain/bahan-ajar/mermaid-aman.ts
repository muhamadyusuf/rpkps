import { daftarRingkas } from "@/domain/temuan";
import type { TemuanBahanAjar } from "./tipe";

/**
 * Pemeriksaan kode Mermaid — pelengkap `svg-aman.ts`.
 *
 * Modul ini TIDAK ada di rancangan awal docs/17, dan ketiadaannya adalah
 * kelalaian: Mermaid bukan sekadar notasi gambar. Ia punya arahan yang
 * mengubah perilaku perendernya, dan seluruhnya berjalan di peramban dosen —
 * tempat SVG hasil rendernya justru TIDAK melewati `svg-aman.ts`, karena yang
 * kita simpan adalah kodenya, bukan hasilnya.
 *
 * Tiga hal yang ditolak, dan ketiganya punya alasan berbeda:
 *
 * 1. **`click`** menautkan simpul ke alamat atau ke fungsi. Diagram di buku
 *    ajar tidak diklik siapa pun; yang tersisa hanyalah kemampuannya membuka
 *    alamat yang tidak pernah diperiksa.
 * 2. **`%%{init: …}%%`** menyetel ulang konfigurasi Mermaid dari dalam
 *    diagram — termasuk `securityLevel` dan `htmlLabels`, dua setelan yang
 *    justru menjadi penjaga kita (docs/17 §4.3). Diagram tidak boleh
 *    mematikan penjaganya sendiri.
 * 3. **`style` / `classDef` / `linkStyle`** memberi diagram warnanya sendiri.
 *    Itu bukan lubang keamanan, melainkan pelanggaran cetakan gaya: temanya
 *    milik buku, bukan milik model (I7).
 *
 * Murni: tanpa Mermaid, tanpa DOM. Yang diperiksa adalah TEKS kodenya.
 */

/**
 * Jenis diagram yang boleh dipakai — yang tata letaknya dihitung mesin.
 *
 * Bukan seluruh katalog Mermaid: `pie`, `mindmap`, dan kerabatnya menghasilkan
 * rupa yang tidak sejalan dengan diagram teknis buku ajar, dan `gantt` maupun
 * `timeline` sudah cukup untuk urusan waktu.
 */
export const JENIS_MERMAID: readonly string[] = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "stateDiagram-v2",
  "stateDiagram",
  "erDiagram",
  "classDiagram",
  "timeline",
  "gantt",
];

const BATAS_AKSARA = 200_000;

export interface HasilMermaid {
  ok: boolean;
  temuan: TemuanBahanAjar[];
}

export function periksaMermaid(sumber: string): HasilMermaid {
  const temuan: TemuanBahanAjar[] = [];
  const tolak = (kode: string, params?: TemuanBahanAjar["params"]) => {
    temuan.push({ kode, tingkat: "PEMBLOKIR", ...(params ? { params } : {}) });
  };

  if (sumber.length > BATAS_AKSARA) {
    tolak("IL-MMD-TERLALU-BESAR", { n: BATAS_AKSARA });
    return { ok: false, temuan };
  }

  const baris = sumber
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b !== "");

  if (baris.length === 0) {
    tolak("IL-MMD-KOSONG");
    return { ok: false, temuan };
  }

  // Baris pertama yang bukan komentar menyatakan jenis diagramnya.
  const pertama = baris.find((b) => !b.startsWith("%%")) ?? "";
  const jenis = pertama.split(/[\s:]/)[0];
  if (!JENIS_MERMAID.includes(jenis)) {
    tolak("IL-MMD-JENIS-ASING", { daftar: daftarRingkas([jenis || "?"]) });
  }

  const arahan: string[] = [];
  const tautan: string[] = [];
  const gayaSendiri: string[] = [];
  let adaHtml = false;

  for (const b of baris) {
    // `%%{init: {...}}%%` — arahan konfigurasi. Komentar biasa (`%% …`) tetap
    // boleh: ia tidak mengubah apa pun.
    if (/^%%\{/.test(b)) arahan.push(b.slice(0, 40));

    if (/^click\b/i.test(b)) tautan.push(b.slice(0, 40));
    if (/\bhref\b/i.test(b) || /https?:\/\//i.test(b)) tautan.push(b.slice(0, 40));

    if (/^(style|classDef|linkStyle)\b/i.test(b)) gayaSendiri.push(b.split(/\s/)[0]);

    // Label ber-HTML. Selain jalur masuk markah, ia juga tidak akan tampil:
    // label `foreignObject` tidak dirender di dalam `<img>` (docs/17 §5.2),
    // sehingga diagramnya tercetak dengan kotak kosong.
    if (/<\s*[a-z][a-z0-9]*(\s|\/?>)/i.test(b)) adaHtml = true;
  }

  if (arahan.length > 0) tolak("IL-MMD-ARAHAN", { daftar: daftarRingkas(arahan) });
  if (tautan.length > 0) tolak("IL-MMD-TAUTAN", { jumlah: tautan.length });
  if (adaHtml) tolak("IL-MMD-HTML");
  if (gayaSendiri.length > 0) {
    tolak("IL-MMD-GAYA-SENDIRI", {
      daftar: daftarRingkas([...new Set(gayaSendiri)].sort()),
    });
  }

  return { ok: temuan.length === 0, temuan };
}
