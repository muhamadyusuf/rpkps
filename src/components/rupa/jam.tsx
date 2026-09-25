"use client";

import { useSyncExternalStore } from "react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { waktuStatus } from "@/lib/bahasa/format";
import { cn } from "@/lib/utils";

/**
 * Hari, tanggal, dan jam di sebelah avatar (docs/28 §4.2) — "Jum, 25 Sep 11:19".
 *
 * Dirender HANYA di peramban: server berjalan di UTC sedangkan penggunanya di
 * WIB/WITA/WIT, dan waktu yang dirender server akan salah jam sekaligus memicu
 * galat hidrasi. Snapshot server `null` → tempatnya dipesan lebih dulu,
 * jadi tidak ada lompatan tata letak saat jam muncul.
 *
 * Snapshot-nya bilangan MENIT, bukan milidetik: stabil di antara pemanggilan
 * `getSnapshot`, dan komponen hanya dirender ulang sekali semenit meski
 * pemeriksanya berdetak tiap detik (supaya pergantian menit tidak telat).
 */
function langganan(beri: () => void) {
  const id = window.setInterval(beri, 1000);
  return () => window.clearInterval(id);
}
const menitSekarang = () => Math.floor(Date.now() / 60_000);
const menitServer = () => null;

export function JamStatus({ className }: { className?: string }) {
  const { bahasa } = useBahasa();
  const menit = useSyncExternalStore(langganan, menitSekarang, menitServer);
  const kini = menit === null ? null : new Date(menit * 60_000);

  return (
    <time
      dateTime={kini?.toISOString()}
      className={cn(
        "inline-block min-w-[9.5rem] text-right text-[13px] font-medium text-muted-foreground tabular-nums",
        className,
      )}
    >
      {kini ? waktuStatus(kini, bahasa) : " "}
    </time>
  );
}
