import { cn } from "@/lib/utils";

/**
 * Lambang aplikasi: bujur sangkar dengan dua sudut terpangkas — bentuk yang
 * lazim pada pelat dan panel teknik — berisi monogram R. Digambar sebagai SVG
 * supaya tetap tajam di ukuran berapa pun dan ikut warna teks induknya.
 */
export function Lambang({
  className,
  berpendar = false,
}: {
  className?: string;
  berpendar?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {berpendar ? (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-lg bg-cahaya/25 blur-lg"
        />
      ) : null}
      <svg
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden
        className="size-full text-cahaya"
      >
        <path
          d="M1.5 1.5H19.5L26.5 8.5V26.5H8.5L1.5 19.5V1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="opacity-70"
        />
        <path
          d="M19.5 1.5V8.5H26.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="opacity-30"
        />
        <text
          x="14"
          y="19.5"
          textAnchor="middle"
          fill="currentColor"
          className="font-mono text-[11px] font-semibold"
        >
          R
        </text>
      </svg>
    </span>
  );
}

/** Lambang + nama aplikasi, dipakai di bilah samping dan kepala ponsel. */
export function TandaAplikasi({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Lambang className="size-7" />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-sm font-semibold tracking-tight">
          RPKPS ITTS
        </span>
        <span className="label-teknis mt-1 text-[9px] text-muted-foreground/70">
          OBE
        </span>
      </span>
    </span>
  );
}
