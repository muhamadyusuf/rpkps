import { ImageResponse } from "next/og";
import { labelTahunAkademik, ringkasSks } from "@/domain/rpkps/publik";
import { muatInstitusi, muatRpkpsPublik } from "@/lib/publik/muat";

export const alt = "Kartu pratinjau RPKPS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Kartu pratinjau tautan — yang muncul saat alamat RPKPS ditempel di WhatsApp,
 * LinkedIn, atau situs program studi.
 *
 * Digambar ulang di sini, bukan memotret halaman: ImageResponse berjalan tanpa
 * Tailwind maupun variabel CSS tema, jadi warnanya ditulis tetap sebagai versi
 * gelap "Kisi & Cahaya". Isinya sengaja sedikit — kode mata kuliah, nama,
 * prodi, tahun akademik — karena pada ukuran pratinjau hanya itu yang terbaca.
 */
export default async function KartuPratinjau({
  params,
}: {
  params: Promise<{ prodi: string; kode: string }>;
}) {
  const { prodi, kode } = await params;
  const [rpkps, institusi] = await Promise.all([
    muatRpkpsPublik(prodi, kode),
    muatInstitusi(),
  ]);

  const mk = rpkps?.dokumen.mataKuliah;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#101319",
          backgroundImage:
            "radial-gradient(1100px 460px at 50% -12%, rgba(34,211,238,0.16), transparent 70%)",
          color: "#f2f4f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "2px solid rgba(34,211,238,0.55)",
              color: "#22d3ee",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 600 }}>
              RPKPS {institusi.namaSingkat || institusi.nama}
            </span>
            <span
              style={{
                fontSize: 15,
                letterSpacing: 3,
                color: "rgba(242,244,248,0.5)",
              }}
            >
              OUTCOME BASED EDUCATION
            </span>
          </div>
        </div>

        {mk && rpkps ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <span style={{ fontSize: 34, color: "#22d3ee", letterSpacing: 2 }}>
              {mk.kode}
            </span>
            <span style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
              {mk.nama.length > 58 ? `${mk.nama.slice(0, 57)}…` : mk.nama}
            </span>
            <span style={{ fontSize: 26, color: "rgba(242,244,248,0.66)" }}>
              {rpkps.prodi.nama} · Semester {mk.semester} · {ringkasSks(mk)} ·{" "}
              {labelTahunAkademik(rpkps.tahunAkademik)}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 58, fontWeight: 700 }}>
            Katalog rencana pembelajaran
          </span>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 20,
            color: "rgba(242,244,248,0.5)",
          }}
        >
          <span
            style={{
              width: 44,
              height: 2,
              background: "rgba(34,211,238,0.7)",
            }}
          />
          <span>
            Dokumen resmi{rpkps ? ` — disahkan, versi ${rpkps.versi}` : ""}
          </span>
        </div>
      </div>
    ),
    size,
  );
}
