import { NextResponse } from "next/server";
import { buatTemplateKurikulum } from "@/lib/kurikulum/excel";
import { sesiSaatIni } from "@/lib/sesi";
import { punyaPeran } from "@/lib/otorisasi";
import { bahasaBerkas } from "@/lib/dokumen/bahasa-berkas";

export const runtime = "nodejs";

export async function GET(permintaan: Request) {
  const sesi = await sesiSaatIni();
  if (!punyaPeran(sesi, "ADMIN", "KAPRODI", "GPM")) {
    return NextResponse.json({ pesan: "Tidak berwenang." }, { status: 403 });
  }

  const buffer = await buatTemplateKurikulum(bahasaBerkas(permintaan));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="template-impor-kurikulum.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
