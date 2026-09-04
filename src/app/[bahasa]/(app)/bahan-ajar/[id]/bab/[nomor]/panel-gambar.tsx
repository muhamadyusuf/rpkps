"use client";

/*
 * `<img>` biasa di berkas ini DISENGAJA, dan bukan kelalaian yang menunggu
 * diganti `next/image`:
 *
 * - Pratinjau diagram memakai `data:image/svg+xml` — SVG dari model maupun
 *   unggahan. `<img>` adalah wadah yang membuatnya aman: skrip tidak
 *   dieksekusi dan rujukan luar tidak diambil (docs/17 §5.2). Pengoptimal
 *   gambar tidak melayani `data:` URI, dan menggantinya berarti kembali ke
 *   penyisipan ke DOM — persis yang dilarang.
 * - Gambar tersimpan disajikan dari rute bergerbang sesi. Melewatkannya ke
 *   pengoptimal berarti menaruh salinannya di cache yang tidak mengenal
 *   wewenang siapa pun.
 */
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Loader2,
  Pencil,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teksTemuan } from "@/lib/bahasa/temuan";
import { bekukanMermaid } from "@/domain/bahan-ajar/bekukan-mermaid";
import { PenyuntingVisual } from "./penyunting-visual";
import { PenyuntingRaster } from "./penyunting-raster";
import {
  rasterkanBerkas,
  rasterkanSvg,
  renderMermaid,
  svgKeDataUri,
} from "@/lib/bahan-ajar/rasterkan";
import type { TemuanBahanAjar } from "@/domain/bahan-ajar/tipe";
import {
  geserGambar,
  hapusGambar,
  simpanGambar,
  tambahGambar,
  usulkanDiagram,
  usulkanIlustrasi,
  type IsiGambar,
} from "../../aksi-gambar";

/**
 * Panel gambar sebuah bab — docs/17 §8.
 *
 * # Alur yang menentukan seluruh bentuk komponen ini
 *
 * AI mengusulkan → dosen MELIHAT → peramban merasterkan → baru disimpan.
 * Server sengaja tidak menyimpan usulan (lihat `usulkanDiagram`): menyimpan
 * lebih dulu berarti menyimpan gambar yang belum dilihat siapa pun, tanpa PNG
 * yang justru wajib untuk mencetaknya.
 *
 * # Satu aturan yang tidak boleh dilanggar di berkas ini
 *
 * SVG diagram TIDAK PERNAH disisipkan ke DOM. Ia selalu dipasang sebagai
 * `<img src="data:image/svg+xml;base64,…">`, tempat skrip tidak dieksekusi dan
 * rujukan luar tidak diambil — apa pun yang lolos dari sanitasi server
 * (docs/17 I2). Karena itu tidak ada `innerHTML` maupun
 * `dangerouslySetInnerHTML` di sini, dan uji pemindai sumber menjaganya.
 */

export type GambarTersimpan = {
  id: string;
  nomor: number;
  judul: string;
  altTeks: string | null;
  letak: string | null;
  sumber: "DIAGRAM_AI" | "UNGGAHAN" | "AI_RASTER";
  bentuk: "MERMAID" | "SVG" | "RASTER";
  kode: string | null;
};

/** Usulan yang belum tersimpan; belum punya id maupun PNG. */
type Usul = {
  judul: string;
  altTeks: string | null;
  letak: string | null;
  bentuk: "MERMAID" | "SVG";
  kode: string;
  /** SVG hasil render, siap dipasang pada `<img>`. Null selama masih dirender. */
  svg: string | null;
  galat: string | null;
};

export function PanelGambar({
  bukuId,
  nomorBab,
  gambar,
  bolehTulis,
  adaUraian,
  adaKunciAi,
}: {
  bukuId: string;
  nomorBab: number;
  gambar: GambarTersimpan[];
  bolehTulis: boolean;
  adaUraian: boolean;
  adaKunciAi: boolean;
}) {
  const { k, isi } = useBahasa();
  const router = useRouter();
  const idPanel = useId();

  const [usul, setUsul] = useState<Usul[]>([]);
  const [catatan, setCatatan] = useState<TemuanBahanAjar[]>([]);
  const [sedang, setSedang] = useState<"ai" | "unggah" | "simpan" | "ilustrasi" | null>(
    null,
  );
  const [perintah, setPerintah] = useState("");
  const [ilustrasi, setIlustrasi] = useState<string | null>(null);
  const [sunting, setSunting] = useState<string | null>(null);
  const berkasRef = useRef<HTMLInputElement>(null);

  /** Merender kode sebuah usulan menjadi SVG untuk dipratinjau. */
  async function siapkanUsul(mentah: Omit<Usul, "svg" | "galat">, i: number): Promise<Usul> {
    try {
      const svg =
        mentah.bentuk === "MERMAID"
          ? await renderMermaid(mentah.kode, `${idPanel}-${i}`)
          : mentah.kode;
      return { ...mentah, svg, galat: null };
    } catch (galat) {
      // Diagram yang gagal dirender tetap ditampilkan sebagai baris bergalat,
      // bukan dihilangkan: dosen berhak tahu bahwa model menghasilkan sesuatu
      // yang tidak dapat digambar, dan kuotanya sudah terpakai untuk itu.
      return {
        ...mentah,
        svg: null,
        galat: galat instanceof Error ? galat.message : String(galat),
      };
    }
  }

  async function mintaDiagram() {
    setSedang("ai");
    setCatatan([]);
    const hasil = await usulkanDiagram(bukuId, nomorBab);
    if (!hasil.ok) {
      setSedang(null);
      toast.error(hasil.pesan);
      return;
    }
    setCatatan(hasil.catatan ?? []);
    const siap = await Promise.all(
      (hasil.usul ?? []).map((u, i) =>
        siapkanUsul(
          {
            judul: u.judul,
            altTeks: u.altTeks,
            letak: u.letak,
            bentuk: u.bentuk,
            kode: u.kode,
          },
          i,
        ),
      ),
    );
    setUsul(siap);
    setSedang(null);
    toast.success(hasil.pesan);
  }

  /** Menyetujui satu usulan: rasterkan di sini, lalu simpan. */
  async function setujui(u: Usul, indeks: number) {
    if (!u.svg) return;
    setSedang("simpan");
    try {
      const raster = await rasterkanSvg(u.svg);
      const muatan: IsiGambar = {
        judul: u.judul,
        altTeks: u.altTeks,
        letak: u.letak,
        bentuk: u.bentuk,
        sumber: "DIAGRAM_AI",
        kode: u.kode,
        png: raster.dataUri,
      };
      const hasil = await tambahGambar(bukuId, nomorBab, muatan);
      if (!hasil.ok) {
        toast.error(hasil.pesan);
        if (hasil.temuan?.length) setCatatan(hasil.temuan);
        return;
      }
      setUsul((lama) => lama.filter((_, i) => i !== indeks));
      toast.success(hasil.pesan);
      router.refresh();
    } catch (galat) {
      toast.error(galat instanceof Error ? galat.message : String(galat));
    } finally {
      setSedang(null);
    }
  }

  async function unggah(berkas: File) {
    setSedang("unggah");
    try {
      const svg = berkas.type === "image/svg+xml" ? await berkas.text() : null;
      const raster = svg ? await rasterkanSvg(svg) : await rasterkanBerkas(berkas);

      const hasil = await tambahGambar(bukuId, nomorBab, {
        judul: berkas.name.replace(/\.[^.]+$/, "").slice(0, 200) || "Gambar",
        altTeks: null,
        letak: null,
        // SVG unggahan tetap disimpan sebagai kode, sehingga masih dapat
        // disunting; berkas raster tidak punya kode sama sekali.
        bentuk: svg ? "SVG" : "RASTER",
        sumber: "UNGGAHAN",
        kode: svg,
        png: raster.dataUri,
      });

      if (!hasil.ok) {
        toast.error(hasil.pesan);
        if (hasil.temuan?.length) setCatatan(hasil.temuan);
        return;
      }
      toast.success(hasil.pesan);
      router.refresh();
    } catch (galat) {
      toast.error(galat instanceof Error ? galat.message : String(galat));
    } finally {
      setSedang(null);
      if (berkasRef.current) berkasRef.current.value = "";
    }
  }

  const berjalan = sedang !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isi(k.bahanAjar.gambarJudul, { jumlah: gambar.length })}
        </CardTitle>
        <CardDescription>{k.bahanAjar.gambarKeterangan}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {bolehTulis ? (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={berjalan || !adaUraian || !adaKunciAi}
              onClick={mintaDiagram}
            >
              {sedang === "ai" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {k.bahanAjar.susunDiagram}
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={berjalan}
              onClick={() => berkasRef.current?.click()}
            >
              {sedang === "unggah" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {k.bahanAjar.unggahGambar}
            </Button>
            <input
              ref={berkasRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const berkas = e.target.files?.[0];
                if (berkas) void unggah(berkas);
              }}
            />
          </div>
        ) : null}

        {bolehTulis ? (
          <div className="space-y-2 rounded-lg border border-dashed p-3">
            <p className="text-xs text-muted-foreground">{k.bahanAjar.ilustrasiKeterangan}</p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={perintah}
                placeholder={k.bahanAjar.ilustrasiPlaceholder}
                disabled={berjalan || !adaKunciAi}
                onChange={(e) => setPerintah(e.target.value)}
                className="min-w-60 flex-1"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={berjalan || !adaKunciAi || perintah.trim().length < 10}
                onClick={async () => {
                  setSedang("ilustrasi");
                  const hasil = await usulkanIlustrasi(bukuId, nomorBab, perintah);
                  setSedang(null);
                  if (!hasil.ok) {
                    toast.error(hasil.pesan);
                    return;
                  }
                  setIlustrasi(hasil.png ?? null);
                }}
              >
                {sedang === "ilustrasi" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {k.bahanAjar.susunIlustrasi}
              </Button>
            </div>

            {ilustrasi ? (
              <div className="space-y-2">
                <img
                  src={ilustrasi}
                  alt={perintah}
                  className="max-h-80 w-full rounded border bg-white object-contain p-2"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={berjalan}
                    onClick={async () => {
                      setSedang("simpan");
                      const hasil = await tambahGambar(bukuId, nomorBab, {
                        judul: perintah.slice(0, 200),
                        altTeks: perintah,
                        letak: null,
                        bentuk: "RASTER",
                        // Penanda inilah yang membuat keterangan asal
                        // tercetak di bawah gambarnya (docs/17 I5).
                        sumber: "AI_RASTER",
                        kode: null,
                        png: ilustrasi,
                      });
                      setSedang(null);
                      if (!hasil.ok) {
                        toast.error(hasil.pesan);
                        return;
                      }
                      setIlustrasi(null);
                      setPerintah("");
                      toast.success(hasil.pesan);
                      router.refresh();
                    }}
                  >
                    {k.bahanAjar.setujuiGambar}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={berjalan}
                    onClick={() => setIlustrasi(null)}
                  >
                    {k.bahanAjar.tolakGambar}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {k.bahanAjar.ilustrasiPeringatan}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {!adaKunciAi && bolehTulis ? (
          <p className="text-xs text-muted-foreground">{k.bahanAjar.tanpaKunci}</p>
        ) : null}

        {catatan.length > 0 ? (
          <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
            {catatan.map((c, i) => (
              <li key={`${c.kode}-${i}`} className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>{teksTemuan(c, k).pesan}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {usul.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {isi(k.bahanAjar.usulJudul, { jumlah: usul.length })}
            </p>
            {usul.map((u, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{u.judul}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.bentuk} {u.letak ? `· ${u.letak}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={berjalan || !u.svg}
                      onClick={() => void setujui(u, i)}
                    >
                      {k.bahanAjar.setujuiGambar}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={berjalan}
                      onClick={() => setUsul((lama) => lama.filter((_, j) => j !== i))}
                    >
                      {k.bahanAjar.tolakGambar}
                    </Button>
                  </div>
                </div>

                {u.svg ? (
                  // Selalu <img>, tidak pernah disisipkan ke DOM.
                  <img
                    src={svgKeDataUri(u.svg)}
                    alt={u.altTeks ?? u.judul}
                    className="max-h-80 w-full rounded border bg-white object-contain p-2"
                  />
                ) : (
                  <p className="text-xs text-destructive">
                    {u.galat ?? k.bahanAjar.gambarGagalRender}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {gambar.length === 0 ? (
          <p className="text-sm text-muted-foreground">{k.bahanAjar.gambarKosong}</p>
        ) : (
          <ul className="space-y-3">
            {gambar.map((g, i) => (
              <li key={g.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {nomorBab}.{i + 1} {g.judul}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {k.bahanAjar.sumberGambar[g.sumber]}
                      </Badge>
                      {g.letak ? <span>{g.letak}</span> : null}
                    </p>
                  </div>

                  {bolehTulis ? (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={berjalan || i === 0}
                        onClick={async () => {
                          const h = await geserGambar(bukuId, g.id, "naik");
                          if (!h.ok) toast.error(h.pesan);
                          else router.refresh();
                        }}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={berjalan || i === gambar.length - 1}
                        onClick={async () => {
                          const h = await geserGambar(bukuId, g.id, "turun");
                          if (!h.ok) toast.error(h.pesan);
                          else router.refresh();
                        }}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={berjalan}
                        onClick={() => setSunting(sunting === g.id ? null : g.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={berjalan}
                        onClick={async () => {
                          if (!confirm(k.bahanAjar.hapusGambarKonfirmasi)) return;
                          const h = await hapusGambar(bukuId, g.id);
                          if (!h.ok) toast.error(h.pesan);
                          else {
                            toast.success(h.pesan);
                            router.refresh();
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* PNG-nya diambil terpisah; bitanya tidak pernah ikut ke
                    muatan render halaman. */}
                <img
                  src={`/api/bahan-ajar/${bukuId}/gambar/${g.id}`}
                  alt={g.altTeks ?? g.judul}
                  className="max-h-80 w-full rounded border bg-white object-contain p-2"
                />

                {sunting === g.id ? (
                  <PenyuntingGambar
                    bukuId={bukuId}
                    gambar={g}
                    onSelesai={() => {
                      setSunting(null);
                      router.refresh();
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Penyunting sebuah gambar — docs/18 §5.
 *
 * Tiga tab yang menyunting benda yang SAMA:
 *
 * - **Visual** untuk diagram SVG: seret, ubah ukuran, sunting teks dan warna.
 * - **Kode** untuk SVG maupun Mermaid — bahasa yang memang dirancang untuk itu.
 * - **Raster** untuk foto dan ilustrasi: potong dan putar.
 *
 * Diagram Mermaid tidak punya koordinat yang dapat diseret, jadi tab visualnya
 * digantikan tawaran MEMBEKUKAN ke SVG — dengan peringatan yang tidak
 * diperhalus, karena pembekuan membuang tata letak otomatisnya untuk selamanya.
 */
function PenyuntingGambar({
  bukuId,
  gambar,
  onSelesai,
}: {
  bukuId: string;
  gambar: GambarTersimpan;
  onSelesai: () => void;
}) {
  const { k } = useBahasa();
  const idPanel = useId();

  const [tab, setTab] = useState<"visual" | "kode" | "raster">(
    gambar.bentuk === "SVG" ? "visual" : gambar.bentuk === "RASTER" ? "raster" : "kode",
  );
  const [kode, setKode] = useState(gambar.kode ?? "");
  const [bentuk, setBentuk] = useState(gambar.bentuk);
  const [judul, setJudul] = useState(gambar.judul);
  const [letak, setLetak] = useState(gambar.letak ?? "");
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  async function render(): Promise<string | null> {
    try {
      const svg = bentuk === "MERMAID" ? await renderMermaid(kode, `sunting-${idPanel}`) : kode;
      setPratinjau(svg);
      setGalat(null);
      return svg;
    } catch (e) {
      setPratinjau(null);
      setGalat(e instanceof Error ? e.message : String(e));
      return null;
    }
  }

  /** Menyimpan kode beserta PNG-nya yang dirasterkan ulang. */
  async function simpan(svgSiap?: string) {
    setSibuk(true);
    try {
      // Dirender ulang sebelum disimpan, bukan memakai pratinjau terakhir:
      // kode dapat berubah sesudah pratinjau ditekan, dan PNG yang tidak
      // sesuai kodenya adalah kebohongan yang tercetak.
      const svg = svgSiap ?? (await render());
      if (!svg) return;
      const raster = await rasterkanSvg(svg);
      const hasil = await simpanGambar(bukuId, gambar.id, {
        judul,
        altTeks: gambar.altTeks,
        letak: letak.trim() || null,
        bentuk,
        sumber: gambar.sumber,
        kode,
        png: raster.dataUri,
      });
      if (!hasil.ok) {
        toast.error(hasil.pesan);
        return;
      }
      toast.success(hasil.pesan);
      onSelesai();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  }

  /** Membekukan Mermaid menjadi SVG agar dapat disunting visual. */
  async function bekukan() {
    if (!confirm(k.bahanAjar.bekukanKonfirmasi)) return;
    setSibuk(true);
    try {
      const svgMermaid = await renderMermaid(kode, `beku-${idPanel}`);
      const beku = bekukanMermaid(svgMermaid);
      if (!beku.ok || !beku.svg) {
        toast.error(
          beku.temuan.map((t) => teksTemuan(t, k).pesan).join(" ") ||
            k.bahanAjar.gambarGagalRender,
        );
        return;
      }
      // Sejak titik ini ia SVG, dan kode Mermaid-nya tidak lagi menjadi
      // sumber kebenaran apa pun.
      setKode(beku.svg);
      setBentuk("SVG");
      setPratinjau(beku.svg);
      setTab("visual");
      toast.success(k.bahanAjar.bekukanBerhasil);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  }

  const tabTersedia: ("visual" | "kode" | "raster")[] =
    gambar.bentuk === "RASTER" ? ["raster"] : bentuk === "SVG" ? ["visual", "kode"] : ["kode"];

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap gap-1.5">
        {tabTersedia.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {k.bahanAjar.tab[t]}
          </Button>
        ))}
        {bentuk === "MERMAID" ? (
          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void bekukan()}>
            {k.bahanAjar.bekukan}
          </Button>
        ) : null}
      </div>

      {gambar.bentuk !== "RASTER" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>{k.bahanAjar.labelKeteranganGambar}</Label>
            <Input value={judul} onChange={(e) => setJudul(e.target.value)} />
          </div>
          <div>
            <Label>{k.bahanAjar.labelLetak}</Label>
            <Input value={letak} onChange={(e) => setLetak(e.target.value)} />
          </div>
        </div>
      ) : null}

      {tab === "visual" && bentuk === "SVG" ? (
        <>
          <PenyuntingVisual svg={kode} onUbah={setKode} />
          <Button size="sm" disabled={sibuk} onClick={() => void simpan(kode)}>
            {sibuk ? <Loader2 className="size-4 animate-spin" /> : null}
            {k.bahanAjar.simpan}
          </Button>
        </>
      ) : null}

      {tab === "kode" ? (
        <>
          <textarea
            rows={12}
            className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
          />
          {galat ? <p className="text-xs text-destructive">{galat}</p> : null}
          {pratinjau ? (
            <img
              src={svgKeDataUri(pratinjau)}
              alt={judul}
              className="max-h-80 w-full rounded border bg-white object-contain p-2"
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void render()}>
              {k.bahanAjar.pratinjau}
            </Button>
            <Button size="sm" disabled={sibuk} onClick={() => void simpan()}>
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : null}
              {k.bahanAjar.simpan}
            </Button>
          </div>
        </>
      ) : null}

      {tab === "raster" ? (
        <PenyuntingRaster
          sumberGambar={`/api/bahan-ajar/${bukuId}/gambar/${gambar.id}`}
          sedangSimpan={sibuk}
          onSimpan={async (dataUri) => {
            setSibuk(true);
            try {
              const hasil = await simpanGambar(bukuId, gambar.id, {
                judul,
                altTeks: gambar.altTeks,
                letak: letak.trim() || null,
                bentuk: "RASTER",
                sumber: gambar.sumber,
                kode: null,
                png: dataUri,
              });
              if (!hasil.ok) {
                toast.error(hasil.pesan);
                return;
              }
              toast.success(hasil.pesan);
              onSelesai();
            } finally {
              setSibuk(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
