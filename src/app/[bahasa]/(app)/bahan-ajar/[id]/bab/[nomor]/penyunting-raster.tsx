"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { Crop, Loader2, RotateCw } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";

/**
 * Penyunting gambar raster — docs/18 §4.
 *
 * Untuk foto, tangkapan layar, dan ilustrasi AI tidak ada kode yang dapat
 * disunting; yang masuk akal hanyalah operasi pada pikselnya. Dua saja:
 * **potong** dan **putar 90°**.
 *
 * Batasnya jujur dan dinyatakan di layar: memotong membuang piksel, dan
 * setelah disimpan tidak dapat dibatalkan. Aslinya tidak ikut disimpan —
 * menyimpan dua salinan tiap gambar demi sebuah "batal" yang jarang dipakai
 * berarti melipatgandakan kolom `bytea` paling besar di basis data.
 */

export function PenyuntingRaster({
  sumberGambar,
  onSimpan,
  sedangSimpan,
}: {
  /** Alamat PNG yang sedang berlaku. */
  sumberGambar: string;
  onSimpan: (dataUri: string) => void;
  sedangSimpan: boolean;
}) {
  const { k } = useBahasa();
  const wadah = useRef<HTMLDivElement>(null);
  const gambarRef = useRef<HTMLImageElement>(null);

  /** Pilihan potong dalam pecahan 0..1 terhadap gambar; null = seluruhnya. */
  const [pilihan, setPilihan] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const mulai = useRef<{ x: number; y: number } | null>(null);
  const [sibuk, setSibuk] = useState(false);

  function pecahan(e: { clientX: number; clientY: number }) {
    const kotak = wadah.current?.getBoundingClientRect();
    if (!kotak) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - kotak.left) / kotak.width)),
      y: Math.min(1, Math.max(0, (e.clientY - kotak.top) / kotak.height)),
    };
  }

  /**
   * Menggambar ulang PNG lewat kanvas.
   *
   * Kanvas yang sama dengan rasterisasi diagram — dan karena gambarnya diambil
   * dari alamat kita sendiri, kanvasnya tidak ternoda dan `toDataURL` boleh
   * dipanggil.
   */
  async function olah(operasi: "potong" | "putar") {
    const gambar = gambarRef.current;
    if (!gambar) return;
    setSibuk(true);
    try {
      const lebarAsli = gambar.naturalWidth;
      const tinggiAsli = gambar.naturalHeight;

      const sumber =
        operasi === "potong" && pilihan
          ? {
              x: pilihan.x * lebarAsli,
              y: pilihan.y * tinggiAsli,
              w: pilihan.w * lebarAsli,
              h: pilihan.h * tinggiAsli,
            }
          : { x: 0, y: 0, w: lebarAsli, h: tinggiAsli };

      if (sumber.w < 8 || sumber.h < 8) return;

      const kanvas = document.createElement("canvas");
      const konteks = kanvas.getContext("2d");
      if (!konteks) return;

      if (operasi === "putar") {
        kanvas.width = sumber.h;
        kanvas.height = sumber.w;
        konteks.fillStyle = "#FFFFFF";
        konteks.fillRect(0, 0, kanvas.width, kanvas.height);
        konteks.translate(kanvas.width / 2, kanvas.height / 2);
        konteks.rotate(Math.PI / 2);
        konteks.drawImage(gambar, -sumber.w / 2, -sumber.h / 2, sumber.w, sumber.h);
      } else {
        kanvas.width = Math.round(sumber.w);
        kanvas.height = Math.round(sumber.h);
        konteks.fillStyle = "#FFFFFF";
        konteks.fillRect(0, 0, kanvas.width, kanvas.height);
        konteks.drawImage(
          gambar,
          sumber.x,
          sumber.y,
          sumber.w,
          sumber.h,
          0,
          0,
          kanvas.width,
          kanvas.height,
        );
      }

      onSimpan(kanvas.toDataURL("image/png"));
      setPilihan(null);
    } finally {
      setSibuk(false);
    }
  }

  const berjalan = sibuk || sedangSimpan;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{k.bahanAjar.petunjukPotong}</p>

      <div
        ref={wadah}
        className="relative w-full touch-none overflow-hidden rounded border bg-white select-none"
        onPointerDown={(e) => {
          const p = pecahan(e);
          if (!p) return;
          mulai.current = p;
          setPilihan({ x: p.x, y: p.y, w: 0, h: 0 });
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!mulai.current) return;
          const p = pecahan(e);
          if (!p) return;
          setPilihan({
            x: Math.min(mulai.current.x, p.x),
            y: Math.min(mulai.current.y, p.y),
            w: Math.abs(p.x - mulai.current.x),
            h: Math.abs(p.y - mulai.current.y),
          });
        }}
        onPointerUp={() => {
          mulai.current = null;
        }}
      >
        <img
          ref={gambarRef}
          src={sumberGambar}
          alt=""
          draggable={false}
          className="pointer-events-none w-full object-contain"
        />
        {pilihan && pilihan.w > 0.01 && pilihan.h > 0.01 ? (
          <div
            className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/10"
            style={{
              left: `${pilihan.x * 100}%`,
              top: `${pilihan.y * 100}%`,
              width: `${pilihan.w * 100}%`,
              height: `${pilihan.h * 100}%`,
            }}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={berjalan || !pilihan || pilihan.w < 0.02 || pilihan.h < 0.02}
          onClick={() => void olah("potong")}
        >
          {berjalan ? <Loader2 className="size-4 animate-spin" /> : <Crop className="size-4" />}
          {k.bahanAjar.potong}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={berjalan}
          onClick={() => void olah("putar")}
        >
          <RotateCw className="size-4" />
          {k.bahanAjar.putar}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{k.bahanAjar.peringatanPotong}</p>
    </div>
  );
}
