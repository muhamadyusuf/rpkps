/** Membuat cookie sesi lokal untuk pengambilan screenshot. Dijalankan sekali,
 *  hasilnya hanya dipakai peramban headless di mesin ini. */
import { readFileSync } from "node:fs";
const isi = readFileSync(".env", "utf8");
for (const baris of isi.split("\n")) {
  const m = baris.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}
const admin = await import("firebase-admin/app");
const auth = await import("firebase-admin/auth");
const app = admin.initializeApp({
  credential: admin.cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  }),
});
const a = auth.getAuth(app);
const surel = process.argv[2] ?? "yusuf@itts.ac.id";
const pengguna = await a.getUserByEmail(surel);
const custom = await a.createCustomToken(pengguna.uid);
const r = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
);
const j: any = await r.json();
if (!j.idToken) { console.error("gagal:", JSON.stringify(j)); process.exit(1); }
const s = await fetch("http://localhost:3000/api/sesi", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: j.idToken }),
});
const set = s.headers.get("set-cookie") ?? "";
const ck = set.match(/sesi=([^;]+)/)?.[1];
if (!ck) { console.error("tak ada cookie:", s.status, await s.text()); process.exit(1); }
console.log(ck);
