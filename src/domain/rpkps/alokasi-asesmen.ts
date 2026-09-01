import { bagiProporsional, normalisasiKe100 } from "./normalisasi";

/**
 * Penutupan peta asesmen untuk draf yang disusun AI — docs/12 §3.3.
 *
 * # Masalah yang diselesaikan
 *
 * Draf AI dahulu menetapkan bobot tanpa pernah menetapkan KE MANA bobot itu
 * masuk. Akibatnya setiap baris mingguan keluar sebagai "belum ditentukan",
 * dan karena `susunPetaAsesmen` memutuskan "komponen ini dirinci mingguan atau
 * dirinci tugas" dari tautan komponen itu, seluruh lembar tugas terbaca sebagai
 * bobot TAMBAHAN. Mingguan 100% + tugas 100% = 200%, dengan lima belas temuan
 * yang semuanya berpangkal pada satu kelalaian yang sama.
 *
 * Modul ini menutupnya secara deterministik, di server, sesudah ketiga tahap
 * penyusunan selesai — di sanalah baris mingguan, lembar tugas, dan kisi-kisi
 * pertama kali terlihat bersamaan.
 *
 * # Dua aturan yang mengikat
 *
 *  1. **Komponen nilai tetap buku besarnya.** Bobot komponen yang dirancang
 *     model dipertahankan; bobot tiap baris mingguan diturunkan DARI komponen
 *     yang menaunginya, bukan sebaliknya. Itu sebabnya angka di dokumen tetap
 *     bulat: komponen berbaris tunggal — UTS, UAS — menerima bobot utuh.
 *  2. **Dalam draf AI, setiap bobot hidup di baris mingguan.** Lembar tugas
 *     adalah rencana baris itu, bukan tempat bobot kedua. Bobot tugas karena
 *     itu diselaraskan agar berjumlah sama dengan komponennya — bukan
 *     ditambahkan di atasnya.
 *
 * Setiap angka yang diubah di sini menghasilkan satu baris `catatan`. Dosen
 * menyetujui seluruh dokumen dengan satu tombol; ia berhak tahu angka mana
 * yang bukan lagi angka model. Pola yang sama sudah berlaku untuk aritmetika
 * di `normalisasi.ts`.
 */

export type JenisBaris = "EFEKTIF" | "UTS" | "UAS";

export interface KomponenBobot {
  nama: string;
  bobot: number;
}

/** Satu baris tabel mingguan, seperlunya untuk membagi bobot. */
export interface BarisBobot {
  minggu: number;
  jenis: JenisBaris;
  bobot: number;
  /** Nama komponen yang disebut draf; null bila belum ditunjuk. */
  komponen: string | null;
}

export interface TugasBobot {
  nomor: number;
  mingguMulai: number;
  mingguSelesai: number;
  bobot: number;
  komponen: string | null;
}

export interface MasukanAlokasi {
  komponen: readonly KomponenBobot[];
  /** SELURUH baris tabel mingguan, termasuk minggu ujian. */
  baris: readonly BarisBobot[];
  tugas: readonly TugasBobot[];
  /** Jenis ujian yang kisi-kisinya benar-benar berisi butir. */
  kisiKisiBerisi: readonly ("UTS" | "UAS")[];
  /** Minggu yang menjadwalkan setidaknya satu Sub-CPMK. */
  mingguBerSubCpmk: readonly number[];
}

export interface HasilAlokasi {
  komponen: KomponenBobot[];
  baris: BarisBobot[];
  tugas: TugasBobot[];
  catatan: string[];
}

function angka(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function bulat2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Apakah sebuah nama komponen menunjuk ujian tertentu.
 *
 * Model menamainya bermacam-macam — "UTS", "Ujian Tengah Semester", "UTS
 * (tulis)". Ketiganya harus dikenali, karena baris ujian yang lupa menyebut
 * komponen ditambal dengan komponen inilah, dan menambalnya dengan komponen
 * baru bernama "UTS" di samping "Ujian Tengah Semester" yang sudah ada berarti
 * dua komponen untuk satu ujian.
 */
function serupaUjian(nama: string, jenis: "UTS" | "UAS"): boolean {
  const n = nama.trim().toLowerCase();
  const frasa = jenis === "UTS" ? "tengah semester" : "akhir semester";
  return n === jenis.toLowerCase() || n.includes(jenis.toLowerCase()) || n.includes(frasa);
}

export function alokasikanAsesmen(m: MasukanAlokasi): HasilAlokasi {
  const catatan: string[] = [];

  // ── 0 · Daftar komponen kanonik ─────────────────────────────────────
  // Nama berulang dibuang: `@@unique([rpkpsId, nama])` menolaknya juga, dan
  // peta asesmen merujuk komponen lewat namanya.
  const komponen: KomponenBobot[] = [];
  const dikenal = new Set<string>();
  for (const k of m.komponen) {
    const nama = k.nama.trim();
    if (nama.length === 0 || dikenal.has(nama.toLowerCase())) continue;
    dikenal.add(nama.toLowerCase());
    komponen.push({ nama, bobot: angka(k.bobot) });
  }

  /** Padanan nama tanpa peduli besar-kecil huruf; null bila tak dikenal. */
  const cari = (nama: string | null): string | null => {
    if (!nama) return null;
    const kunci = nama.trim().toLowerCase();
    return komponen.find((k) => k.nama.toLowerCase() === kunci)?.nama ?? null;
  };

  const baris: BarisBobot[] = m.baris.map((b) => ({
    ...b,
    bobot: angka(b.bobot),
    komponen: cari(b.komponen),
  }));
  const tugas: TugasBobot[] = m.tugas.map((t) => ({
    ...t,
    bobot: angka(t.bobot),
    komponen: cari(t.komponen),
  }));

  // ── 1 · Cabut bobot yang tidak dapat mengalir ke capaian ────────────
  const berSubCpmk = new Set(m.mingguBerSubCpmk);
  const berKisi = new Set(m.kisiKisiBerisi);

  for (const b of baris) {
    if (b.bobot <= 0) continue;
    if (b.jenis === "EFEKTIF" && !berSubCpmk.has(b.minggu)) {
      catatan.push(
        `Bobot ${bulat2(b.bobot)}% pada minggu ${b.minggu} dilepas: minggu itu tidak ` +
          "menjadwalkan Sub-CPMK, sehingga bobotnya tidak mengalir ke capaian mana pun.",
      );
      b.bobot = 0;
    } else if (b.jenis !== "EFEKTIF" && !berKisi.has(b.jenis)) {
      // Baris ujian tidak menempel Sub-CPMK — Sub-CPMK ujian hidup di
      // kisi-kisi. Bobot ujian tanpa kisi-kisi adalah bobot yang mengambang.
      catatan.push(
        `Bobot ${bulat2(b.bobot)}% pada baris ${b.jenis} dilepas: kisi-kisi ${b.jenis} ` +
          "tidak disusun, sehingga tidak ada Sub-CPMK yang diukurnya.",
      );
      b.bobot = 0;
    }
  }

  const berbobot = baris.filter((b) => b.bobot > 0);

  if (berbobot.length === 0) {
    // Tidak ada satu pun bobot yang sah. Draf seperti ini memang harus jatuh
    // ke periksaDraf(); yang penting ia jatuh dengan alasan yang terbaca.
    for (const t of tugas) t.bobot = 0;
    return { komponen: [], baris, tugas, catatan };
  }

  // ── 2 · Tambal baris berbobot yang belum menunjuk komponen ──────────
  const dibentuk = new Set<string>();
  const pastikan = (nama: string): string => {
    const ada = cari(nama);
    if (ada) return ada;
    komponen.push({ nama, bobot: 0 });
    dikenal.add(nama.toLowerCase());
    dibentuk.add(nama);
    return nama;
  };

  const tambalan: string[] = [];
  for (const b of berbobot) {
    if (b.komponen) continue;
    b.komponen =
      b.jenis === "EFEKTIF"
        ? (komponen
            .filter((k) => !serupaUjian(k.nama, "UTS") && !serupaUjian(k.nama, "UAS"))
            .sort((x, y) => y.bobot - x.bobot)[0]?.nama ?? pastikan("Penilaian Proses"))
        : (komponen.find((k) => serupaUjian(k.nama, b.jenis as "UTS" | "UAS"))?.nama ??
          pastikan(b.jenis));
    tambalan.push(`minggu ${b.minggu} → "${b.komponen}"`);
  }
  if (tambalan.length > 0) {
    catatan.push(
      `${tambalan.length} baris mingguan berbobot tidak menyebut komponen nilainya ` +
        `dan dipasangkan sendiri: ${tambalan.join(", ")}.`,
    );
  }

  // ── 3 · Buku besar: komponen yang benar-benar dirinci ───────────────
  const dipakai = new Set(berbobot.map((b) => b.komponen as string));
  const yatim = komponen.filter((k) => !dipakai.has(k.nama));
  if (yatim.length > 0) {
    catatan.push(
      `Komponen ${yatim.map((k) => `"${k.nama}"`).join(", ")} dibuang: tidak ada baris ` +
        "mingguan yang merincinya, sehingga bobotnya tidak akan pernah dapat dikumpulkan. " +
        "Bobotnya dibagikan ke komponen lain.",
    );
  }
  const terpakai = komponen.filter((k) => dipakai.has(k.nama));

  // Komponen bentukan langkah 2 belum punya bobot rancangan; ia mewarisi
  // bobot usulan baris-barisnya sebelum seluruh buku besar dinormalkan.
  const jumlahBaris = (nama: string) =>
    berbobot.filter((b) => b.komponen === nama).reduce((s, b) => s + b.bobot, 0);
  for (const k of terpakai) {
    if (dibentuk.has(k.nama)) k.bobot = jumlahBaris(k.nama);
  }

  const norm = normalisasiKe100(terpakai.map((k) => k.bobot));
  if (norm.diluarBatas) {
    // Angka komponen dari draf tidak dapat dipakai — total 12% atau 900%
    // bukan kesalahan pembulatan. Buku besarnya diturunkan dari baris.
    const nilai = bagiProporsional(100, terpakai.map((k) => jumlahBaris(k.nama)));
    terpakai.forEach((k, i) => (k.bobot = nilai[i]));
    catatan.push(
      "Bobot komponen nilai diturunkan dari jumlah baris mingguannya: angka komponen " +
        "pada draf terlalu jauh dari 100% untuk disebut kesalahan hitung.",
    );
  } else {
    if (norm.disesuaikan) {
      catatan.push(
        `Bobot komponen nilai disesuaikan dari ${norm.totalAsli}% menjadi 100%; ` +
          "perbandingan antar komponen dipertahankan.",
      );
    }
    terpakai.forEach((k, i) => (k.bobot = norm.nilai[i]));
  }

  // ── 4 · Bobot komponen dibagikan ke baris yang merincinya ───────────
  let barisBerubah = false;
  for (const k of terpakai) {
    const anggota = berbobot.filter((b) => b.komponen === k.nama);
    const nilai = bagiProporsional(k.bobot, anggota.map((a) => a.bobot));
    anggota.forEach((a, i) => {
      if (bulat2(a.bobot) !== nilai[i]) barisBerubah = true;
      a.bobot = nilai[i];
    });
  }
  if (barisBerubah) {
    catatan.push(
      "Bobot tiap baris mingguan disesuaikan agar jumlahnya persis mengisi komponen nilainya.",
    );
  }

  // ── 5 · Lembar tugas: rencana baris, bukan bobot kedua ──────────────
  for (const t of tugas) {
    if (t.komponen && !dipakai.has(t.komponen)) t.komponen = null;
    if (t.komponen) continue;

    // Tugas dikumpulkan pada suatu minggu; komponennya adalah komponen baris
    // berbobot pada minggu itu — minggu selesai lebih dulu, karena di sanalah
    // tagihannya jatuh.
    const kandidat =
      berbobot.find((b) => b.minggu === t.mingguSelesai) ??
      berbobot
        .filter((b) => b.minggu >= t.mingguMulai && b.minggu <= t.mingguSelesai)
        .at(-1);

    if (kandidat) {
      t.komponen = kandidat.komponen;
      catatan.push(
        `Tugas ${t.nomor} dimasukkan ke komponen "${t.komponen}", mengikuti baris ` +
          "mingguan berbobot pada rentang minggunya.",
      );
    } else if (t.bobot > 0) {
      t.bobot = 0;
      catatan.push(
        `Bobot Tugas ${t.nomor} dilepas: tidak ada baris mingguan berbobot pada rentang ` +
          "minggunya, dan bobot tanpa baris akan terhitung sebagai tagihan kedua.",
      );
    }
  }

  for (const k of terpakai) {
    const anggota = tugas.filter((t) => t.komponen === k.nama);
    if (anggota.length === 0) continue;
    const nilai = bagiProporsional(k.bobot, anggota.map((a) => a.bobot));
    anggota.forEach((a, i) => (a.bobot = nilai[i]));
  }

  return { komponen: terpakai, baris, tugas, catatan };
}
