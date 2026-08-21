import JSZip from "jszip";
import { readFileSync } from "node:fs";

const zip = await JSZip.loadAsync(readFileSync("uji/keluaran-rpkps.docx"));
const xml = await zip.file("word/document.xml").async("string");
// tarik teks per paragraf
const teks = xml
  .split(/<w:p[ >]/)
  .map((p) => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, ""))
    .join(""))
  .filter((t) => t.trim() !== "");
console.log("jumlah paragraf berisi:", teks.length);
console.log("─".repeat(60));
console.log(teks.slice(0, 40).join("\n"));
console.log("─".repeat(60));
const i = teks.findIndex((t) => t.includes("RENCANA PEMBELAJARAN MINGGUAN"));
console.log(teks.slice(i, i + 26).join("\n"));
