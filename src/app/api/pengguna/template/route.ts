import { NextResponse } from "next/server";
import { buatTemplatePengguna } from "@/lib/pengguna/excel";
import { sesiSaatIni } from "@/lib/sesi";
import { punyaPeran } from "@/lib/otorisasi";
import { bahasaBerkas } from "@/lib/dokumen/bahasa-berkas";

export const runtime = "nodejs";

export async function GET(permintaan: Request) {
  const sesi = await sesiSaatIni();
  if (!punyaPeran(sesi, "ADMIN")) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });
  }

  const buffer = await buatTemplatePengguna(bahasaBerkas(permintaan));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="template-impor-pengguna.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
