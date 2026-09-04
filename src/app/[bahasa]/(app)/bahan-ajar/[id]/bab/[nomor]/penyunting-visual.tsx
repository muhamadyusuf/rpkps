"use client";

/*
 * `<img>` biasa DISENGAJA di sini — lihat catatan panjang di `panel-gambar.tsx`.
 * Gambar yang disunting berasal dari model maupun unggahan, dan `<img>` adalah
 * wadah yang membuatnya aman.
 */
/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import { Redo2, Trash2, Undo2 } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PALET } from "@/domain/bahan-ajar/gaya-svg";
import {
  dapatDisunting,
  geserSimpul,
  hapusSimpul,
  kotakSimpul,
  simpulPada,
  ubahAtributSimpul,
  ubahTeksSimpul,
  ubahUkuranSimpul,
  uraiSvg,
  viewBoxDari,
  type SimpulSvg,
} from "@/domain/bahan-ajar/svg-model";
import { svgKeDataUri } from "@/lib/bahan-ajar/rasterkan";

/**
 * Penyunting diagram visual — docs/18.
 *
 * # Bentuknya ditentukan dua aturan yang tidak boleh dilonggarkan
 *
 * docs/17 **I1**: diagram adalah KODE. Maka tidak satu pun gerakan di sini
 * menyunting piksel — semuanya menulis ulang SVG-nya, dan `svg` adalah
 * satu-satunya keadaan yang disimpan.
 *
 * docs/17 **I2**: SVG hanya dirender di dalam `<img>`. Maka kita TIDAK dapat
 * memasang penangan klik pada elemen di dalamnya; bagi DOM, `<img>` buram.
 * Karena itu lapisan pegangan di bawah ini adalah `<div>` biasa milik kita
 * sendiri, diposisikan dari geometri yang diurai `svg-model.ts`, dan
 * pencocokan kliknya kita hitung sendiri.
 *
 * Riwayat batal/ulang menyimpan STRING SVG, bukan daftar gerakan. Satu
 * tumpukan, dan setiap keadaan di dalamnya adalah berkas yang sah — jauh lebih
 * mudah dibuktikan benar daripada membalik gerakan satu per satu.
 */

/** Warna yang boleh dipilih; palet buku, tanpa jalan keluar (docs/17 §4.3). */
const WARNA = [...PALET].filter((w) => w.startsWith("#"));

type Seret =
  | { jenis: "geser"; indeks: number; xAwal: number; yAwal: number }
  | { jenis: "ukur"; indeks: number; xAwal: number; yAwal: number; lebar: number; tinggi: number };

export function PenyuntingVisual({
  svg,
  onUbah,
}: {
  svg: string;
  onUbah: (svgBaru: string) => void;
}) {
  const { k } = useBahasa();

  const [riwayat, setRiwayat] = useState<string[]>([]);
  const [maju, setMaju] = useState<string[]>([]);
  const [terpilih, setTerpilih] = useState<number | null>(null);
  const seret = useRef<Seret | null>(null);
  const wadah = useRef<HTMLDivElement>(null);

  const simpul = useMemo(() => uraiSvg(svg), [svg]);
  const viewBox = useMemo(() => viewBoxDari(svg), [svg]);
  const aktif = simpul.find((s) => s.indeks === terpilih) ?? null;
  const kotak = aktif ? kotakSimpul(aktif) : null;

  function terapkan(svgBaru: string) {
    if (svgBaru === svg) return;
    setRiwayat((r) => [...r.slice(-49), svg]);
    setMaju([]);
    onUbah(svgBaru);
  }

  /** Koordinat tetikus dalam satuan viewBox. */
  function keViewBox(e: { clientX: number; clientY: number }) {
    const kotakWadah = wadah.current?.getBoundingClientRect();
    if (!kotakWadah || !viewBox) return null;
    return {
      x: viewBox.x + ((e.clientX - kotakWadah.left) / kotakWadah.width) * viewBox.lebar,
      y: viewBox.y + ((e.clientY - kotakWadah.top) / kotakWadah.height) * viewBox.tinggi,
    };
  }

  function mulaiSeret(e: React.PointerEvent, jenis: Seret["jenis"]) {
    const titik = keViewBox(e);
    if (!titik) return;

    if (jenis === "geser") {
      // Klik memilih; seret memindahkan. Keduanya gerakan yang sama, dan
      // dibedakan hanya oleh jarak yang ditempuh sebelum dilepas.
      const s = simpulPada(simpul, titik.x, titik.y);
      setTerpilih(s?.indeks ?? null);
      if (!s) return;
      seret.current = { jenis, indeks: s.indeks, xAwal: titik.x, yAwal: titik.y };
    } else {
      if (!aktif || !kotak) return;
      seret.current = {
        jenis,
        indeks: aktif.indeks,
        xAwal: titik.x,
        yAwal: titik.y,
        lebar: kotak.lebar,
        tinggi: kotak.tinggi,
      };
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function selesaiSeret(e: React.PointerEvent) {
    const s = seret.current;
    seret.current = null;
    if (!s) return;

    const titik = keViewBox(e);
    if (!titik) return;
    const dx = titik.x - s.xAwal;
    const dy = titik.y - s.yAwal;

    // Gerakan di bawah satu satuan adalah klik, bukan seret.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const target = simpul.find((x) => x.indeks === s.indeks);
    if (!target) return;

    terapkan(
      s.jenis === "geser"
        ? geserSimpul(svg, target, dx, dy)
        : ubahUkuranSimpul(svg, target, s.lebar + dx, s.tinggi + dy),
    );
  }

  function batal() {
    const sebelum = riwayat.at(-1);
    if (sebelum === undefined) return;
    setRiwayat((r) => r.slice(0, -1));
    setMaju((m) => [...m, svg]);
    onUbah(sebelum);
  }

  function ulang() {
    const sesudah = maju.at(-1);
    if (sesudah === undefined) return;
    setMaju((m) => m.slice(0, -1));
    setRiwayat((r) => [...r, svg]);
    onUbah(sesudah);
  }

  if (!viewBox) {
    return <p className="text-sm text-destructive">{k.bahanAjar.tanpaViewBox}</p>;
  }

  const persen = (nilai: number, dari: number, panjang: number) =>
    `${((nilai - dari) / panjang) * 100}%`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={riwayat.length === 0} onClick={batal}>
          <Undo2 className="size-4" />
          {k.bahanAjar.batal}
        </Button>
        <Button size="sm" variant="outline" disabled={maju.length === 0} onClick={ulang}>
          <Redo2 className="size-4" />
          {k.bahanAjar.ulang}
        </Button>
        <p className="text-xs text-muted-foreground">{k.bahanAjar.petunjukSeret}</p>
      </div>

      <div
        ref={wadah}
        className="relative w-full touch-none overflow-hidden rounded border bg-white select-none"
        style={{ aspectRatio: `${viewBox.lebar} / ${viewBox.tinggi}` }}
        onPointerDown={(e) => mulaiSeret(e, "geser")}
        onPointerUp={selesaiSeret}
      >
        {/* Latar: gambar apa adanya, di dalam <img>. */}
        <img
          src={svgKeDataUri(svg)}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 size-full object-contain"
        />

        {/* Lapisan pegangan: milik kita sendiri, dari geometri yang diurai. */}
        {kotak ? (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-primary"
            style={{
              left: persen(kotak.x, viewBox.x, viewBox.lebar),
              top: persen(kotak.y, viewBox.y, viewBox.tinggi),
              width: `${(kotak.lebar / viewBox.lebar) * 100}%`,
              height: `${(kotak.tinggi / viewBox.tinggi) * 100}%`,
            }}
          >
            <span
              className="pointer-events-auto absolute -right-1.5 -bottom-1.5 size-3 cursor-se-resize rounded-sm bg-primary"
              onPointerDown={(e) => {
                e.stopPropagation();
                mulaiSeret(e, "ukur");
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                selesaiSeret(e);
              }}
            />
          </div>
        ) : null}
      </div>

      {aktif ? (
        <PanelSifat
          svg={svg}
          simpul={aktif}
          onUbah={terapkan}
          onHapus={() => {
            terapkan(hapusSimpul(svg, aktif));
            setTerpilih(null);
          }}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{k.bahanAjar.pilihElemen}</p>
      )}
    </div>
  );
}

/** Sifat elemen terpilih: teks, warna, dan penghapusan. */
function PanelSifat({
  svg,
  simpul,
  onUbah,
  onHapus,
}: {
  svg: string;
  simpul: SimpulSvg;
  onUbah: (svgBaru: string) => void;
  onHapus: () => void;
}) {
  const { k, isi } = useBahasa();
  const [teks, setTeks] = useState(simpul.teks?.nilai ?? "");

  const bisaTeks = simpul.teks !== null;
  const warnaSekarang = (nama: string) => simpul.atribut.get(nama)?.nilai ?? "";

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium">
        {isi(k.bahanAjar.elemenTerpilih, { tag: simpul.tag })}
        {!dapatDisunting(simpul.tag) ? ` — ${k.bahanAjar.elemenTakDisunting}` : ""}
      </p>

      {bisaTeks ? (
        <div>
          <Label>{k.bahanAjar.isiTeks}</Label>
          <div className="flex gap-2">
            <Input value={teks} onChange={(e) => setTeks(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUbah(ubahTeksSimpul(svg, simpul, teks))}
            >
              {k.bahanAjar.terapkan}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Hanya palet buku. Penyunting visual tidak boleh menjadi pintu
          belakang yang melewati cetakan gaya (docs/17 §4.3). */}
      {(["fill", "stroke"] as const).map((nama) => (
        <div key={nama}>
          <Label className="text-xs">
            {nama === "fill" ? k.bahanAjar.warnaIsian : k.bahanAjar.warnaGaris}
          </Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {[...WARNA, "none"].map((w) => (
              <button
                key={w}
                type="button"
                title={w}
                aria-label={w}
                onClick={() => onUbah(ubahAtributSimpul(svg, simpul, nama, w))}
                className={`size-6 rounded border ${
                  warnaSekarang(nama).toLowerCase() === w ? "ring-2 ring-primary" : ""
                }`}
                style={{
                  background:
                    w === "none"
                      ? "repeating-linear-gradient(45deg,#fff,#fff 3px,#e5e7eb 3px,#e5e7eb 6px)"
                      : w,
                }}
              />
            ))}
          </div>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={onHapus}>
        <Trash2 className="size-4" />
        {k.bahanAjar.hapusElemen}
      </Button>
    </div>
  );
}
