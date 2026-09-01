"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useBahasa } from "@/components/penyedia-bahasa";
import { Button } from "@/components/ui/button";
import { keluar } from "@/lib/firebase/client";

export function TombolKeluar({
  variant = "ghost",
  tampilkanLabel = true,
  className,
}: {
  variant?: "ghost" | "outline" | "secondary";
  tampilkanLabel?: boolean;
  className?: string;
}) {
  const [memuat, setMemuat] = useState(false);
  const router = useRouter();
  const { jalur, k } = useBahasa();

  return (
    <Button
      variant={variant}
      size={tampilkanLabel ? "default" : "icon"}
      className={className}
      disabled={memuat}
      onClick={async () => {
        setMemuat(true);
        try {
          await keluar();
        } finally {
          router.replace(jalur("/masuk"));
          router.refresh();
        }
      }}
    >
      <LogOut />
      {tampilkanLabel
        ? memuat
          ? k.komponen.keluar.sedang
          : k.komponen.keluar.label
        : null}
      {tampilkanLabel ? null : (
        <span className="sr-only">{k.komponen.keluar.label}</span>
      )}
    </Button>
  );
}
