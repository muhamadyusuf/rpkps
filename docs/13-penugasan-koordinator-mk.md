# Penugasan Dosen Koordinator Mata Kuliah

> Status: **K1–K4 TERPASANG (30 Agustus 2026).**
> Menjawab satu kalimat Kaprodi: *"buat agar bisa di-setting siapa dosen
> koordinatornya"* — penugasan yang selama ini hidup di grup WhatsApp dan
> notulen rapat, lalu baru muncul di aplikasi sebagai efek samping siapa yang
> kebetulan menekan tombol "Buat RPKPS" lebih dulu.

## BAGIAN 1 — Masalahnya: koordinator lahir dari kebetulan

Sebelum dokumen ini, satu-satunya "koordinator" yang dikenal aplikasi adalah
`rpkps_pengampu.peran = KOORDINATOR`, dan pemegangnya ditetapkan oleh satu baris
di `buatRpkps`:

```ts
pengampu: { create: { penggunaId: sesi.id, peran: "KOORDINATOR", urutan: 0 } }
```

Artinya **koordinator = siapa pun yang membuat RPKPS-nya**. Tiga akibat yang
semuanya nyata di lapangan:

1. **Penugasan tidak dapat dinyatakan sebelum ada dokumen.** Kaprodi membagi MK
   di rapat awal semester, tetapi aplikasi baru tahu setelah dosen membuat
   RPKPS. Di antara keduanya tidak ada satu pun daftar yang bisa dibuka untuk
   menjawab "MK mana yang belum ada pemegangnya?".
2. **Admin yang membantu membuatkan dokumen menjadi koordinatornya.** Praktik
   yang lumrah — staf prodi menyiapkan kerangka untuk sepuluh MK — melahirkan
   sepuluh RPKPS yang penanggung jawabnya staf itu, lalu harus diserahterimakan
   satu per satu.
3. **Riwayat pemegang MK tidak ada.** Pertanyaan asesor "siapa yang memegang
   TI214 tiga tahun terakhir?" hanya bisa dijawab dengan membuka tiga RPKPS.

Serah terima per RPKPS (docs/06 §3.3) tetap dibutuhkan dan tidak diganti. Yang
kurang adalah lapisan di atasnya: **penugasan pada MATA KULIAH**, tempat asal
semua RPKPS-nya.

## BAGIAN 2 — Keputusan bentuk

### 2.1 K1 — penugasan terikat tahun akademik, bukan kolom pada mata kuliah

Bentuk yang paling ringkas adalah `mata_kuliah.koordinator_id`. Bentuk itu
ditolak: pemegang MK berganti tiap semester, dan satu kolom berarti pergantian
**menimpa** pemegang sebelumnya. Setahun kemudian tidak ada cara menjawab siapa
yang memegang MK itu di semester ganjil.

Karena itu penugasan adalah barisnya sendiri:

```
koordinator_mk (mata_kuliah_id, tahun_akademik_id, pengguna_id)
    @@unique([mata_kuliah_id, tahun_akademik_id])
```

Satu MK punya satu koordinator per tahun akademik — tidak lebih, dan tidak
kurang bila memang belum ditetapkan. Tahun akademik berikutnya adalah baris
baru; yang lama tidak disentuh. Itulah riwayatnya.

Yang **tidak** dicatat baris ini: pergantian di TENGAH satu tahun akademik.
Menetapkan ulang pemegang TI214 2025/2026-GENAP menimpa baris yang sama. Jejak
pergantian itu ada di `log_audit` (`KOORDINATOR_MK_DITETAPKAN`, memuat nama
lama dan nama baru) dan — bila RPKPS-nya sudah ada — di `rpkps_riwayat`. Ini
pertukaran yang disengaja: `@@unique` yang menjamin "satu MK satu pemegang"
jauh lebih berharga daripada riwayat intra-semester yang jarang ditanya.

### 2.2 K2 — yang menetapkan adalah Kaprodi dan Admin, bukan dosen

Penugasan adalah **keputusan jabatan**, bukan kesepakatan antar dosen. Karena
itu syaratnya lebih ketat daripada serah terima per RPKPS, yang boleh dilakukan
koordinator dokumen itu sendiri:

| Tindakan | Siapa |
|---|---|
| Menetapkan / mengganti koordinator MK | ADMIN, atau KAPRODI yang cakupan prodinya memuat kurikulum MK itu |
| Melepas penugasan | sama |
| Serah terima koordinator satu RPKPS (docs/06 §3.3) | koordinator RPKPS itu, ADMIN, KAPRODI |

GPM sengaja **tidak** ikut. Cakupannya institusi dan perannya mengawasi mutu,
bukan membagi beban mengajar — memberinya wewenang ini membuat setiap prodi
dapat dibongkar penugasannya dari luar.

Calon koordinator: pengguna berstatus `AKTIF` yang memegang salah satu peran
`DOSEN`, `KOORDINATOR_MK`, atau `KAPRODI` — sama persis dengan calon pengampu
di docs/06 §3.2, dan **tidak disaring per prodi** dengan alasan yang sama: MK
wajib umum, MK layanan, dan dosen tamu dari prodi tetangga itu nyata.

### 2.3 K3 — penugasan MENGALIR ke RPKPS, dua arah waktu

Penugasan yang tidak berakibat apa-apa pada dokumen hanyalah daftar kedua yang
harus dijaga tetap sinkron dengan tangan. Karena itu satu penugasan mengurus
kedua arah waktu sekaligus:

**Ke depan — RPKPS yang belum ada.** `buatRpkps` tidak lagi menjadikan
pembuatnya koordinator secara membuta. Bila (MK, TA) itu punya penugasan,
pemegang penugasan itulah yang menjadi `KOORDINATOR`, dan pembuatnya menjadi
`ANGGOTA` bila ia orang lain. Staf prodi boleh menyiapkan sepuluh dokumen tanpa
satu pun berakhir atas namanya.

**Ke belakang — RPKPS yang sudah ada.** Bila (MK, TA) itu sudah punya RPKPS,
penetapan koordinator MK **sekaligus melakukan serah terima** pada dokumen itu:
pemegang baru ditambahkan sebagai pengampu bila belum, dinaikkan menjadi
`KOORDINATOR`, dan yang lama turun menjadi `ANGGOTA` — tidak dilepas, karena ia
tetap bagian tim pengampu sampai ada yang melepasnya. Tercatat di
`rpkps_riwayat` seperti serah terima biasa.

Aturan docs/06 §3.3 tetap berlaku penuh di sini: **salinan beku tidak ikut
berpindah.** Nama pengampu di `rpkps_snapshot` adalah nama saat pengesahan;
memperbaruinya akan menggeser sidik SHA-256 seluruh dokumen terbit. Penugasan
mengganti siapa yang menyunting revisi BERIKUTNYA, bukan siapa yang
menandatangani yang sudah sah.

Melepas penugasan MK **tidak** menurunkan koordinator RPKPS yang sudah berjalan.
Alasannya asimetris dengan sengaja: menetapkan adalah pernyataan tentang siapa
yang bertanggung jawab, sedangkan melepas hanya menyatakan penugasan itu tidak
lagi tercatat — dan RPKPS tanpa koordinator adalah keadaan yang docs/06 §3.2
justru berusaha cegah.

### 2.4 K4 — satu halaman kerja, bukan satu tombol per mata kuliah

Kaprodi membagi MK **sekaligus**, satu kali di awal semester, sambil menatap
daftar lengkap. Karena itu antarmukanya adalah satu halaman
`/kurikulum/[id]/koordinator`: seluruh MK kurikulum itu dalam satu tabel,
dikelompokkan per semester, dengan pemilih dosen di tiap baris dan tahun
akademik dipilih di kepala halaman.

Ringkasan di kepala menyebut **angkanya** — "8 dari 42 mata kuliah sudah
ditetapkan" — karena yang dicari Kaprodi di halaman ini justru yang belum.

Halaman detail mata kuliah menampilkan pemegangnya sebagai kartu baca-saja
dengan tautan ke halaman penugasan; ia tempat orang bertanya "siapa yang
pegang ini?", bukan tempat membaginya.

## BAGIAN 3 — Yang tidak dikerjakan

- **Beban mengajar tidak dihitung.** Halaman ini tidak tahu berapa sks yang
  sudah ditumpuk pada satu dosen. Menghitungnya menuntut aturan beban kerja
  dosen (BKD) yang belum ada di aplikasi ini; menebaknya lebih buruk daripada
  tidak menampilkan apa pun.
- **Tim pengampu tidak ditetapkan dari sini.** Yang ditetapkan hanya
  penanggung jawabnya. Anggota tim tetap ditambahkan koordinator di halaman
  RPKPS (docs/06 §3.2) — merekalah yang tahu siapa yang benar-benar ikut
  mengajar.
- **Tidak ada penyalinan penugasan antar tahun akademik.** "Samakan dengan
  semester lalu" terdengar hemat, tetapi penugasan yang tersalin diam-diam
  adalah penugasan yang tidak pernah dibaca siapa pun.
