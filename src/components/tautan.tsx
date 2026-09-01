"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { jalur } from "@/lib/bahasa/jalur";

/**
 * Pengganti `next/link` untuk alamat internal.
 *
 * Seluruh kode menulis `href` TANPA bahasa — `/rpkps/abc` — dan komponen
 * inilah satu-satunya tempat awalan `/id` atau `/en` dipasang. Ada ±100
 * `href` internal di aplikasi ini; menuliskan awalannya satu per satu adalah
 * undangan untuk lupa, dan lupanya baru ketahuan saat seseorang berbahasa
 * Inggris menekan tautan dan terlempar kembali ke bahasa Indonesia.
 *
 * Alamat luar (`https://`, `mailto:`, `#jangkar`) dan alamat tanpa awalan
 * (`/api/…`) dilewatkan apa adanya oleh `jalur()`.
 */
export function Tautan({ href, ...sisa }: ComponentProps<typeof Link>) {
  const { bahasa } = useBahasa();
  return <Link href={typeof href === "string" ? jalur(href, bahasa) : href} {...sisa} />;
}
