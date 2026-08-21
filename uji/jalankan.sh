#!/usr/bin/env bash
# Menyalakan Postgres tertanam, menyiapkan skema, menjalankan uji, lalu bersih-bersih.
set -euo pipefail
cd "$(dirname "$0")/.."

bersihkan() {
  if [[ -n "${PID_DB:-}" ]]; then kill "$PID_DB" 2>/dev/null || true; fi
  rm -f uji/skema.sql
}
trap bersihkan EXIT

echo "▸ menyalakan Postgres tertanam…"
npx tsx uji/server-db.mts > /tmp/obe-pglite.log 2>&1 &
PID_DB=$!

for _ in $(seq 1 30); do
  if grep -q "PGlite siap" /tmp/obe-pglite.log 2>/dev/null; then break; fi
  sleep 1
done
grep -q "PGlite siap" /tmp/obe-pglite.log || { echo "gagal menyalakan database"; cat /tmp/obe-pglite.log; exit 1; }

echo "▸ menghasilkan skema dari prisma/schema.prisma…"
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > uji/skema.sql

echo "▸ menerapkan skema…"
npx tsx uji/siapkan.mts

echo "▸ menjalankan pemeriksaan…"
npx tsx --tsconfig tsconfig.json uji/integrasi.ts
