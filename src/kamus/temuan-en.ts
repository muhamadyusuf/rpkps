/**
 * Validator findings — English.
 *
 * Typed `KamusTemuan`, so a code added to the Indonesian file fails
 * compilation until it is translated here. Placeholder names must match
 * exactly; `temuan.test.ts` checks that too.
 */

import type { KamusTemuan } from "./temuan-id";

const SARAN_RALAT =
  "Drop the erratum flag; this proposal takes effect from the next academic year.";

export const temuanEn: KamusTemuan = {
  "AG-CAKUPAN-RENDAH": {
    pesan: "Only {dievaluasi} of {total} courses ({persen}%) have a closed evaluation.",
    saran: "Quality-assurance guidance normally expects coverage of at least {minimal}%.",
  },
  "AG-CPL-BELUM-TERCAPAI": {
    pesan: "CPL {daftar} sits below the {ambang}% threshold.",
    saran: "Material for the next curriculum review, not for one course to solve.",
  },
  "AG-CPL-TANPA-DATA": {
    pesan: "{jumlah} CPLs have never been measured by any evaluation: {daftar}.",
    saran:
      "While these stay empty the programme cannot state what its graduates achieve — only guess.",
  },
  "AG-SEBARAN-KELAS": {
    pesan:
      "{jumlah} courses show a between-class attainment gap above {ambang} points: {daftar}.",
    saran:
      "The same plan with very different results points at delivery, not at the design.",
  },
  "B-DESKRIPSI": { pesan: "The course description is empty." },
  "B-PARAF-BELUM-LENGKAP": {
    pesan: "{jumlah} teaching staff have not initialled the approval page: {daftar}.",
    saran:
      'The coordinator signs on behalf of the writing team, so the team\'s initials must be complete first. Send a reminder with the "Request initials" button.',
  },
  "B-TANPA-CPL": {
    pesan: "The curriculum assigns no CPL to this course.",
  },
  "B-TANPA-PENGAMPU": { pesan: "No teaching staff yet." },
  "B-TANPA-PUSTAKA": { pesan: "No primary reading yet." },
  "B1-BOBOT-MINGGUAN": {
    pesan: "The weekly table totals {total}%, and should total 100%.",
    saran: "The gap is {selisih}% — adjust the weight of one of the meetings.",
  },
  "B2-BOBOT-KOMPONEN": {
    pesan: "Assessment components total {total}%, and should total 100%.",
  },
  "B2-KOMPONEN-KOSONG": {
    pesan: "No assessment components yet (midterm, final, assignments, and so on).",
  },
  "B2-TIDAK-REKONSILIASI": {
    pesan:
      "Weekly weights total {mingguan}% while assessment components total {komponen}%. The two must agree.",
  },
  "B3-SUB-CPMK-ASING": {
    pesan: "A meeting refers to {kode}, which does not belong to this course.",
  },
  "B3-SUB-CPMK-TIDAK-DIJADWALKAN": {
    pesan: "{jumlah} Sub-CPMKs are not scheduled in any meeting: {daftar}.",
    saran: "A Sub-CPMK that is never taught will never be achieved.",
  },
  "B4-NARASI-BEDA": {
    pesan:
      "Week {minggu}: the method narrative says {narasi} in total, while the activities add up to {aktivitas}.",
    saran: "Make the narrative figure match the activity breakdown.",
  },
  "B5-SEMESTER-KURANG": {
    pesan:
      "Semester load totals {jam} hours/credit, below the target of {target} hours/credit. Gap {selisih}.",
  },
  "B5-SEMESTER-LEBIH": {
    pesan:
      "Semester load totals {jam} hours/credit, above the target of {target} hours/credit. Gap {selisih}.",
  },
  "B5-UJIAN-TANPA-ALOKASI": {
    pesan:
      "Week {minggu} (an exam) has no time allocation. Its budget is {pagu} — preparing for an exam is real study load.",
  },
  "B6-MINGGU-GANDA": { pesan: "Week {daftar} appears more than once." },
  "B6-MINGGU-HILANG": {
    pesan: "Week {daftar} is missing from the weekly table.",
    saran: "Exam weeks must still appear as numbered rows.",
  },
  "BA-BAB-BERGESER": {
    pesan: "Chapters {daftar} were written from a weekly plan that has changed since.",
    saran:
      "Compare them with the current weekly rows; a chapter is never rewritten automatically.",
  },
  "BA-BAB-KOSONG": {
    pesan: "{jumlah} chapters have no body text yet: {daftar}.",
    saran: "A chapter without body text still appears in the table of contents as a blank page.",
  },
  "BA-BLOOM-ASING": {
    pesan: "Bloom level {daftar} is not recognised and was left empty.",
  },
  "BA-GLOSARIUM-GANDA": {
    pesan: "{jumlah} repeated glossary entries were merged.",
  },
  "BA-ISBN-TIDAK-SAH": {
    pesan: "The ISBN \u201c{isbn}\u201d fails its check-digit test.",
    saran:
      "Check the typing. A wrong number is printed on the copyright page and travels with every copy.",
  },
  "BA-LATIHAN-KOSONG-DIBUANG": {
    pesan: "{jumlah} exercises without a question were dropped.",
  },
  "BA-LATIHAN-TANPA-KUNCI": {
    pesan: "Chapters {daftar} contain exercises without an answer key.",
    saran:
      "Keys are stored separately from the questions, so filling them in does not leak them into the student copy.",
  },
  "BA-MINGGU-HILANG": {
    pesan: "Chapters {daftar} no longer point at any weekly row.",
    saran: "Their source row was deleted; the chapter text itself is intact.",
  },
  "BA-PUSTAKA-ASING": {
    pesan: "{jumlah} citations point at references absent from the RPKPS: {daftar}.",
    saran:
      "The book bibliography is assembled from the RPKPS references, so these citations would dangle.",
  },
  "BA-SELURUHNYA-AI": {
    pesan: "Not a single chapter has been edited by a human yet.",
    saran:
      "Your name goes on the cover. Read and revise the text before taking this book to a publisher.",
  },
  "BA-SITIRAN-DIBUANG": {
    pesan: "{jumlah} citations pointed outside the RPKPS references and were dropped: {daftar}.",
    saran: "Add the reference to the RPKPS first if this book should really cite it.",
  },
  "BA-SLIDE-KOSONG-DIBUANG": {
    pesan: "{jumlah} slides with neither a title nor bullets were dropped.",
  },
  "BA-TANPA-BAB": {
    pesan: "This book has no chapters yet.",
  },
  "BA-TANPA-PENERBIT": {
    pesan: "The publisher is empty.",
    saran: "Required on the copyright page when applying for an ISBN.",
  },
  "BA-TANPA-PENULIS": {
    pesan: "The author is empty.",
  },
  "BA-TANPA-PRAKATA": {
    pesan: "The preface has not been written.",
  },
  "BA-TANPA-TAHUN": {
    pesan: "The year of publication is empty.",
  },
  "BA-TANPA-TUJUAN": {
    pesan: "Chapters {daftar} have no learning objectives yet.",
    saran: "Chapter objectives come from the indicators or Sub-CPMK of their source week.",
  },
  "BS-BUTIR-SUKAR": {
    pesan: "Item {daftar} counts as difficult (P < 0.3).",
    saran: "Check whether the material was actually taught in adequate depth.",
  },
  "BS-DAYA-BEDA-NEGATIF": {
    pesan:
      "Item {daftar} on {label} has negative discrimination — top-ranked students get it wrong more often.",
    saran:
      "Almost always a wrong answer key or an ambiguous question. Its scores contaminate every Sub-CPMK that depends on it.",
  },
  "BS-DAYA-BEDA-RENDAH": {
    pesan: "Item {daftar} barely distinguishes levels of mastery.",
  },
  "BS-PESERTA-SEDIKIT": {
    pesan: "Only {jumlah} students have complete scores on {label}.",
    saran:
      "Below {minimal} students, discrimination and reliability are not worth trusting.",
  },
  "BS-RELIABILITAS-RENDAH": {
    pesan: "Reliability of {label} (Cronbach α) is {nilai}, below {minimal}.",
    saran: "Its items are not measuring the same thing consistently.",
  },
  "BS-SELURUHNYA-MUDAH": {
    pesan:
      "Every item on {label} counts as easy — this exam does not measure the upper bound of mastery.",
  },
  "BS-SKOR-TIDAK-LENGKAP": {
    pesan: "{jumlah} students have incomplete scores and were excluded from the analysis.",
  },
  "BS-TANPA-DATA": {
    pesan: "No per-item scores for {label} yet.",
    saran: "Item analysis is optional; attainment is still computed without it.",
  },
  "BT-NIM-ASING": {
    pesan:
      "{jumlah} student numbers on the {jenis} item sheet are not enrolled in this class and were skipped.",
  },
  "BT-BUKAN-ANGKA": {
    pesan: 'Row {baris}, item {nomor} on {label} contains "{isi}", which is not a number.',
  },
  "BT-DILUAR-RENTANG": {
    pesan: "Row {baris}, item {nomor} on {label} contains {angka}, outside 0–{batas}.",
  },
  "EV-BELUM-LENGKAP": {
    pesan: "{terisi} of {total} score cells are still empty ({persen}% complete).",
    saran:
      "Attainment is still computed from what is there, but an evaluation must not be closed on partial data.",
  },
  "EV-CPMK-BELUM-TERCAPAI": {
    pesan: "{jumlah} CPMKs were not achieved: {daftar}.",
    saran:
      "The threshold is {ambang}% of students passing. Each of these CPMKs needs a follow-up before the evaluation can be closed.",
  },
  "EV-TANPA-PESERTA": {
    pesan: "This class has no students yet, so there is nothing to compute.",
  },
  "I-BOBOT-KRITERIA": {
    pesan: "The indicators for {label} total {total}%, and should total 100%.",
  },
  "I-DESKRIPSI-PENDEK": {
    pesan: "The description of {label} is too brief for a student to act on.",
  },
  "I-MINGGU-DILUAR": {
    pesan:
      "{label} is scheduled for weeks {mulai}–{selesai}, outside the range 1–{terakhir}.",
    saran: "An assignment can only be scheduled in a week that exists in the weekly table.",
  },
  "I-MINGGU-TERBALIK": {
    pesan: "{label}: the start week ({mulai}) is later than the end week ({selesai}).",
  },
  "I-SUB-CPMK-ASING": {
    pesan: "{label} refers to {kode}, which does not belong to this course.",
  },
  "I-TANPA-KRITERIA": {
    pesan: "{label} ({nama}) has no assessment indicators yet.",
    saran: "Without weighted indicators an assignment cannot be marked consistently.",
  },
  "I-TANPA-LINIMASA": { pesan: "{label} has no stage timeline yet." },
  "I-TANPA-SUB-CPMK": { pesan: "{label} is not linked to any Sub-CPMK yet." },
  "K-CPL-KODE-GANDA": { pesan: "Duplicate CPL codes: {daftar}." },
  "K-CPL-PL-TIDAK-ADA": {
    pesan: "{kode} refers to {profil}, which is not in the graduate profile list.",
  },
  "K-CPL-TANPA-MK": {
    pesan: "{kode} is not assigned to any course.",
    saran: "Assign it to at least one course, or remove it from the curriculum.",
  },
  "K-CPL-TANPA-PL": {
    pesan: "{kode} does not support any graduate profile.",
    saran:
      "Map it to at least one profile so this outcome has a traceable reason to exist.",
  },
  "K-CPMK-CPL-DILUAR-MK": {
    pesan:
      "{kode} elaborates {cpl}, but {cpl} is not assigned to {mk} in the CPL × course matrix.",
    saran: "Add {kode} to the matrix, or detach it from {cpl}.",
  },
  "K-CPMK-CPL-TIDAK-ADA": {
    pesan: "{kode} refers to {cpl}, which is not in the curriculum's CPL list.",
  },
  "K-CPMK-KODE-GANDA": { pesan: "Duplicate CPMK codes on {kode}: {daftar}." },
  "K-CPMK-TANPA-CPL": {
    pesan: "{kode} is not mapped to any CPL.",
    saran: "Every CPMK must elaborate at least one programme CPL.",
  },
  "K-CPMK-TANPA-SUB": {
    pesan: "{kode} has no Sub-CPMKs yet.",
    saran:
      "Sub-CPMKs are the weekly learning stages; without them an RPKPS cannot be drawn up.",
  },
  "K-MK-CPL-TIDAK-DIJABARKAN": {
    pesan:
      "{kode} is assigned to {mk}, but no CPMK elaborates it — this CPL will never be assessed.",
    saran: "Add a CPMK that elaborates {kode}, or detach {kode} from the matrix.",
  },
  "K-MK-KODE-GANDA": { pesan: "Duplicate course codes: {daftar}." },
  "K-MK-SEMESTER": { pesan: "Semester {semester} on {kode} is out of range." },
  "K-MK-SKS-NOL": { pesan: "{kode} has no credits." },
  "K-MK-TANPA-CPL": { pesan: "{kode} carries no CPL." },
  "K-MK-TANPA-CPMK": { pesan: "{kode} has no CPMKs yet." },
  "K-PL-BELUM-DIISI": {
    pesan: "The curriculum lists no graduate profiles.",
    saran:
      "Fill in the Graduate Profile sheet in the import file, or add them from the curriculum page. Without them, CPLs cannot be traced back to what the programme promises its graduates.",
  },
  "K-PL-DESKRIPSI-PENDEK": {
    pesan: "The statement for {kode} is too short to describe a profile.",
    saran:
      'Name the role together with its field of work, e.g. "Software developer for health information systems".',
  },
  "K-PL-KODE-GANDA": { pesan: "Duplicate graduate profile codes: {daftar}." },
  "K-PL-TANPA-CPL": {
    pesan: "{kode} is not supported by any CPL.",
    saran: "Map at least one CPL to {kode}, or remove that profile from the curriculum.",
  },
  "K-SUB-KKO-GANDA": {
    pesan: "{kode} contains {jumlah} operational verbs ({daftar}).",
    saran: "Split it into several Sub-CPMKs so the assessment is unambiguous.",
  },
  "K-SUB-KODE-GANDA": { pesan: "Duplicate Sub-CPMK codes on {kode}: {daftar}." },
  "K-SUB-LEVEL-LEBIH-TINGGI": {
    pesan:
      "{kode} sits at level {level} ({nama}), above {kodeInduk} at level {levelInduk} ({namaInduk}).",
    saran: "Lower the Sub-CPMK level, or raise the level of its parent CPMK.",
  },
  "K-SUB-PENDEK": { pesan: "The statement for {kode} is too short to be assessed." },
  "K-SUB-TANPA-KKO": {
    pesan: "No recognised operational verb was found in {kode}.",
  },
  "K-SUB-TIDAK-TERUKUR": {
    pesan: '{kode} uses the word "{kata}", which cannot be observed.',
    saran:
      'Replace it with an operational verb that produces measurable evidence, e.g. "explain" (C2) or "apply" (C3).',
  },
  "KK-BLOOM-TIMPANG": {
    pesan: "{persen}% of the score on {label} sits at levels C1–C2.",
    saran:
      "An exam that is almost entirely recall and comprehension does not measure application.",
  },
  "KK-JUMLAH-BUTIR": {
    pesan: "Row {nomor} on {label} has fewer than one item.",
  },
  "KK-KOSONG": { pesan: "The {label} blueprint has no items yet." },
  "KK-LEVEL-MELAMPAUI": {
    pesan:
      "Item {nomor} tests {kode} at level {level} ({nama}), higher than its Sub-CPMK level {levelKurikulum}.",
    saran: "Testing above the level taught makes the result hard to defend.",
  },
  "KK-PROPORSI": {
    pesan:
      "{kode} gets {persenAjar}% of teaching time but {persenUji}% of the score on {label}.",
  },
  "KK-SKOR-NOL": {
    pesan: "Row {nomor} on {label} scores zero — an item worth nothing measures nothing.",
  },
  "KK-SUB-CPMK-ASING": {
    pesan: "{label} tests {kode}, which is not scheduled in this course.",
  },
  "KK-SUB-CPMK-BELUM-DIAJARKAN": {
    pesan: "{label} tests {kode}, which is scheduled {sebelum} this exam.",
  },
  "KK-SUB-CPMK-TIDAK-DIUJI": {
    pesan: "{jumlah} Sub-CPMKs are taught before {label} but not tested: {daftar}.",
    saran: "Add items for those Sub-CPMKs, or move them to another exam.",
  },
  "KK-TOTAL-SKOR": {
    pesan: "Item scores on {label} total {total}, and should total {seharusnya}.",
  },
  "L1-KELEBIHAN": {
    pesan: "The load exceeds the budget by {persen}% ({terpakai} against a budget of {pagu}).",
  },
  "L1-KEKURANGAN": {
    pesan: "The load falls short of the budget by {persen}% ({terpakai} against a budget of {pagu}).",
  },
  "L2-KELEBIHAN": {
    pesan:
      "Semester load totals {jamPerSks} hours/credit, above the target of {target} hours/credit (tolerance {toleransi}%). Gap {selisih}.",
  },
  "L2-KEKURANGAN": {
    pesan:
      "Semester load totals {jamPerSks} hours/credit, below the target of {target} hours/credit (tolerance {toleransi}%). Gap {selisih}.",
  },
  "L1-TANPA-PAGU": {
    pesan: "There is {total} of activity in a week with no time budget.",
  },
  "L1-TM-LEBIH": {
    pesan:
      "Contact time {terpakai} exceeds the contact-time budget {pagu} — an extra timetable slot is needed.",
  },
  "L2-UJIAN-TANPA-BEBAN": {
    pesan:
      "{jumlah} exam weeks are not counted as study load. Yet a student preparing for an exam is studying — without that, the 45 hours/credit invariant can never be met.",
  },
  "L3-NARASI-BEDA": {
    pesan:
      "The method narrative says {narasi} while the time-allocation column says {kolom}. The two must agree.",
  },
  "L4-SLOT-KURANG": {
    pesan: "Week {minggu} needs {butuh} of scheduled slots; {tersedia} is available.",
  },
  "NL-BELUM-LENGKAP": {
    pesan: "{kosong} of {total} score cells are still empty.",
    saran:
      "A partial save is fine; attainment can only be closed once every cell is filled.",
  },
  "NL-KOLOM-ASING": {
    pesan: "Column {daftar} was not recognised as an assessment and was ignored.",
    saran:
      "Usually the file came from a different RPKPS, or the plan changed after the template was downloaded.",
  },
  "NL-KOLOM-HILANG": {
    pesan: "Assessment {daftar} has no column in the file.",
    saran: "Any attainment that depends on it will be incomplete.",
  },
  "NL-NAMA-KOSONG": { pesan: "Row {baris} (student no. {nim}) has no name." },
  "NL-NIM-GANDA": {
    pesan: "Student no. {nim} appears twice, on rows {sebelumnya} and {baris}.",
  },
  "NL-NIM-KOSONG": {
    pesan: "Row {baris} has scores but no student number.",
  },
  "NL-SKOR-BUKAN-ANGKA": {
    pesan: 'Row {baris}, column {kode} contains "{isi}", which is not a number.',
  },
  "NL-SKOR-DILUAR-RENTANG": {
    pesan: "Row {baris}, column {kode} contains {angka}, outside the range {min}–{maks}.",
  },
  "PA-ASESMEN-TANPA-SUB-CPMK": {
    pesan: "{kode} ({nama}) carries {bobot}% but claims no Sub-CPMK.",
    saran:
      "Its weight flows to no outcome at all — the mark becomes nothing but a final number.",
  },
  "PA-CPL-TANPA-BOBOT": {
    pesan: "CPL {daftar} is assigned to this course but never assessed.",
    saran:
      "A CPL carried without assessment is finding B3 in docs/02 §2.1 — a curriculum promise that cannot be evidenced.",
  },
  "PA-KISI-TANPA-UJIAN": {
    pesan:
      "The {jenis} blueprint has {jumlah} items, but no weighted {jenis} row exists in the weekly table.",
    saran:
      "Mark one row as {jenis} and give it a weight, or delete the blueprint — while it dangles, its items contribute to no Sub-CPMK at all.",
  },
  "PA-KOMPONEN-TANPA-ASESMEN": {
    pesan:
      'Component "{nama}" carries {bobot}% but is detailed by neither weekly rows nor an assignment sheet.',
    saran: "A component without assessment means marks that can never be collected.",
  },
  "PA-KOMPONEN-TIDAK-COCOK": {
    pesan:
      'Assessments on component "{nama}" total {dirinci}%, while the component itself is {bobot}%.',
  },
  "PA-KOSONG": { pesan: "This course has no weighted assessment at all." },
  "PA-SUB-CPMK-ASING": {
    pesan: "An assessment claims {kode}, which does not belong to this course.",
  },
  "PA-SUB-CPMK-TANPA-BOBOT": {
    pesan: "{jumlah} Sub-CPMKs carry no assessment weight: {daftar}.",
    saran:
      "Their attainment can never be measured, which leaves the CPLs above them dangling too.",
  },
  "PA-TANPA-KOMPONEN": {
    pesan: "{kode} ({nama}) carries {bobot}% but belongs to no assessment component.",
    saran:
      "Without a component its weight cannot be reconciled and its marks cannot be collected.",
  },
  "PA-TOTAL": { pesan: "All assessments total {total}%, and should total 100%." },
  "PA-TUGAS-BEDA-BOBOT": {
    pesan:
      'The assignment sheet on component "{nama}" states {bobotTugas}%, while the weekly rows for that component total {bobotMingguan}%.',
    saran:
      "The weight is taken from the weekly rows. Make the figures agree so the assignment sheet does not mislead.",
  },
  "PA-UJIAN-TANPA-KISI-KISI": {
    pesan:
      "The weight of {kode} is split evenly across {jumlah} Sub-CPMKs because its blueprint is empty.",
    saran:
      "A blueprint makes each Sub-CPMK's share follow the item scores rather than an even guess.",
  },
  "TL-AKAR-PENDEK": {
    pesan: "The root cause for {kode} is too short (at least {minimal} characters).",
    saran:
      '"Students did not study enough" is not a root cause — name what in the design or the delivery made it so.',
  },
  "TL-CPL-BELUM-TERCAPAI": {
    pesan: "CPL {daftar} was not achieved in this course.",
    saran:
      "Take it to the programme-level curriculum review; one course does not carry a CPL alone.",
  },
  "TL-TANPA-REFLEKSI": {
    pesan: "The teaching-process notes are empty (at least {minimal} characters).",
    saran: "What went to plan, what did not, and why.",
  },
  "TL-TANPA-RTL": {
    pesan: "{jumlah} CPMKs were not achieved and have no follow-up yet: {daftar}.",
    saran:
      "This is what separates an evaluation from a mark sheet. A failed CPMK without follow-up means the PPEPP cycle stops at E.",
  },
  "TL-TANPA-TA-SASARAN": {
    pesan: "The action for {kode} names no academic year to take effect in.",
    saran:
      "Without a target year a follow-up never falls due and can never be verified.",
  },
  "TL-TINDAKAN-PENDEK": {
    pesan: "The action for {kode} is too short (at least {minimal} characters).",
    saran: "An action must be checkable next semester: what changed, and by whom.",
  },
  "U-ALASAN-PENDEK": {
    pesan: "Item {kode} carries no reason that can be judged.",
    saran:
      "Say what is wrong with the current statement, not merely that it needs replacing.",
  },
  "U-CPL-DILUAR-MK": {
    pesan: "CPL {kode} is not assigned to {mk}.",
    saran:
      "Assigning a new CPL to a course is a CPL × course matrix decision — outside what this proposal can do.",
  },
  "U-CPL-TIDAK-ADA": { pesan: "CPL {kode} does not exist in this curriculum." },
  "U-CPMK-BARU-TANPA-CPL": {
    pesan: "{kode} is not mapped to any CPL yet.",
    saran: "A CPMK that elaborates no CPL breaks the OBE traceability chain.",
  },
  "U-CPMK-BARU-TANPA-SUB": {
    pesan: "{kode} has not been broken down into Sub-CPMKs.",
    saran: "Add at least one SUB_BARU item to the same proposal.",
  },
  "U-CPMK-TIDAK-ADA": { pesan: "CPMK {kode} does not exist on {mk}." },
  "U-DASAR-TANPA-RUJUKAN": {
    pesan: "The {jenis} basis on item {kode} names no traceable source.",
    saran: "Only CATATAN_DOSEN may go without a reference.",
  },
  "U-KODE-DIPAKAI-CPMK": {
    pesan: "Code {kode} already belongs to another CPMK on {mk}.",
    saran:
      "Codes must not be recycled — a CPMK number in an old document has to keep meaning one thing.",
  },
  "U-KODE-DIPAKAI-SUB": {
    pesan: "Code {kode} already belongs to another Sub-CPMK on {mk}.",
  },
  "U-RUMUSAN-KOSONG": { pesan: "The {jenis} item on {kode} has no statement yet." },
  "U-SUB-KODE-KOSONG": { pesan: "The new Sub-CPMK on {kode} has no code yet." },
  "U-SUB-SASARAN-KOSONG": { pesan: "A {jenis} item must name a target Sub-CPMK." },
  "U-SUB-TIDAK-ADA": { pesan: "Sub-CPMK {kode} does not exist on {mk}." },
  "U-TANPA-DASAR": {
    pesan: "Item {kode} carries no basis at all.",
    saran:
      "Attach a validator finding, an industry signal, employer input, a tracer study, or a written argument.",
  },
  "U-INDUK-DITOLAK": {
    pesan: "{kode} was accepted, but its parent CPMK ({induk}) was rejected.",
    saran: "Reject this Sub-CPMK too, or accept its parent CPMK.",
  },
  "U-MK-TIDAK-ADA": { pesan: "Course {kode} does not exist in this curriculum." },
  "U-RALAT-GESER-BLOOM": {
    pesan: "The correction to {kode} shifts the Bloom level of the statement.",
    saran: SARAN_RALAT,
  },
  "U-RALAT-JENIS-SALAH": {
    pesan: "A {jenis} item cannot go through the erratum route.",
    saran: SARAN_RALAT,
  },
  "U-RALAT-TERLALU-JAUH": {
    pesan:
      "The correction to {kode} changes {jarak} characters, beyond the erratum threshold ({ambang}).",
    saran: SARAN_RALAT,
  },
  "U-RALAT-UBAH-KKO": {
    pesan: "The correction to {kode} changes its operational verb.",
    saran: SARAN_RALAT,
  },
  "U-TANPA-BUTIR": { pesan: "The proposal contains no items yet." },
  "U-TANPA-BUTIR-DITERIMA": {
    pesan: "No item was accepted, so there is nothing to apply.",
    saran: "Reject this proposal, or return it for revision.",
  },
  "W8-TERJEMAHAN-PARSIAL": {
    pesan:
      "The English translation is only partial; the document will read half in each language.",
    saran:
      "Finish the translation, or clear it entirely. Translation never blocks submission.",
  },
  "W-MINGGU-BERLEBIH": {
    pesan:
      "Week {daftar} falls outside the {minggu} semester weeks set by the study-load policy.",
    saran:
      "Such a row has no time budget, so its allocation cannot be checked per meeting.",
  },
  "W-TANPA-BENTUK-NILAI": {
    pesan: "Week {minggu} carries weight but its assessment form is not written.",
  },
  "W-TANPA-INDIKATOR": {
    pesan: "Week {minggu} carries {bobot}% but has no assessment indicators yet.",
  },
  "W-TANPA-REFERENSI": { pesan: "Week {minggu} refers to no reading yet." },
  "W-TANPA-SUB-CPMK": { pesan: "Week {minggu} is not linked to any Sub-CPMK yet." },
  "W-TANPA-TOPIK": { pesan: "Week {minggu} has no topic yet." },
  "W-UJIAN-DI-LUAR-POSISI": {
    pesan: "{daftar} — the policy places exams in week {posisi}.",
    saran:
      "Check that this really follows the programme's academic calendar and is not an accidental shift.",
  },
};
