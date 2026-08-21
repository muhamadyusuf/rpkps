import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { BENTUK_SOAL, JENIS_PUSTAKA, JENIS_TUGAS } from "@/domain/rpkps/draf";

const LEVEL = z.enum(["C1","C2","C3","C4","C5","C6","A1","A2","A3","A4","A5","P1","P2","P3","P4","P5"]);
const S = z.object({
  deskripsi: z.string(),
  kalimat_pembuka_cpmk: z.string(),
  komponen_nilai: z.array(z.object({ nama: z.string(), bobot: z.number() })),
  pustaka_baru: z.array(z.object({
    jenis: z.enum(JENIS_PUSTAKA), nomor: z.number().int(), teks: z.string(), url: z.string().nullable(),
  })),
  pertemuan: z.array(z.object({
    minggu: z.number().int(), topik: z.string(), subtopik: z.array(z.string()),
    metode_narasi: z.string(), aktivitas_dosen: z.string(), aktivitas_mahasiswa: z.string(),
    tugas_terstruktur: z.string().nullable(), penilaian_jenis: z.string().nullable(),
    penilaian_sistem: z.string().nullable(), bobot: z.number(),
    indikator: z.array(z.string()), pustaka_ref: z.array(z.string()),
  })),
  tugas: z.array(z.object({
    nomor: z.number().int(), nama: z.string(), jenis: z.enum(JENIS_TUGAS),
    minggu_mulai: z.number().int(), minggu_selesai: z.number().int(), bobot: z.number(),
    komponen_nilai: z.string().nullable(), deskripsi: z.string(),
    uraian_tugas: z.string().nullable(), format_luaran: z.string().nullable(),
    sub_cpmk_kode: z.array(z.string()),
    kriteria: z.array(z.object({ nomor: z.number().int(), indikator: z.string(), rincian: z.array(z.string()), bobot: z.number() })),
  })),
  kisi_kisi: z.array(z.object({
    jenis: z.enum(["UTS","UAS"]), durasi_menit: z.number().int().nullable(),
    butir: z.array(z.object({
      nomor: z.number().int(), sub_cpmk_kode: z.string(), level_bloom: LEVEL,
      bentuk: z.enum(BENTUK_SOAL), jumlah_butir: z.number().int(), skor: z.number(),
      indikator: z.string().nullable(),
    })),
  })),
});

const f = zodOutputFormat(S) as unknown as Record<string, unknown>;
const teks = JSON.stringify(f);
console.log("ukuran skema:", teks.length, "karakter");
for (const kunci of ["$ref", "$defs", "definitions", "exclusiveMinimum", "minimum", "format", "minLength", "anyOf", "$schema"]) {
  const n = teks.split(`"${kunci}"`).length - 1;
  if (n) console.log(`  memuat "${kunci}" x${n}`);
}
console.log("\nkunci teratas:", Object.keys(f));
const skema = (f as { schema?: Record<string, unknown> }).schema;
if (skema) console.log("kunci schema:", Object.keys(skema));
