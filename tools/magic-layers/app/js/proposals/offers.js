// Proposal kit — the offers a proposal can start from. Scope wording follows the service pages on the website, so a
// proposal never promises more than the site does. Every field is in English and Indonesian. Everything here is a
// starting point: the form lets you edit the deliverables, steps, inputs, assumptions and payment schedule per proposal.
// planFee is the working price from the business plan, shown only as a hint in the fee field; it is never filled in.

const B = (en, id) => ({ en, id });

export const OFFERS = [
  {
    key: "deckAudit", basis: "fixed", planFee: 15000000,
    name: B("Deck Audit", "Audit Dek"),
    subjectHint: B("the FY25 board update deck", "dek pembaruan dewan FY25"),
    objective: B("An independent review of {subject} before it goes out: every figure checked against every other mention of it and against the source you supply, the storyline read title by title, and anything that still looks like a draft marked, with a written report on what to fix.",
      "Tinjauan independen atas {subject} sebelum dikirim: setiap angka dicocokkan dengan setiap penyebutannya dan dengan sumber yang Anda berikan, alur cerita dibaca judul demi judul, dan apa pun yang masih tampak seperti draf ditandai, disertai laporan tertulis tentang apa yang harus diperbaiki."),
    deliverables: [
      B("A written report (PDF): our view, what to fix before the deck goes out, the page to rebuild first, and every finding with what to do about it", "Laporan tertulis (PDF): pandangan kami, apa yang harus diperbaiki sebelum dek dikirim, halaman yang dibangun ulang lebih dulu, dan setiap temuan beserta tindak lanjutnya"),
      B("Figures traced to your model or source document, where you supply one", "Penelusuran angka ke model atau dokumen sumber Anda, jika Anda memberikannya"),
      B("A 45-minute readout with the people who will make the changes", "Sesi pembahasan 45 menit bersama orang yang akan mengerjakan perbaikannya"),
    ],
    steps: [
      { title: B("Send the deck", "Pengiriman dek"), text: B("You send the deck as PowerPoint or PDF, with the model or source document if you want figures traced to it.", "Anda mengirim dek dalam bentuk PowerPoint atau PDF, beserta model atau dokumen sumber jika Anda ingin angkanya ditelusuri."), when: B("Day 0", "Hari ke-0") },
      { title: B("Review", "Tinjauan"), text: B("Software reads every figure, title and page; a senior reviewer goes through each finding, sets aside what is not an issue and adds a view.", "Perangkat lunak membaca setiap angka, judul dan halaman; peninjau senior menelaah setiap temuan, menyisihkan yang bukan masalah, dan menambahkan pandangan."), when: B("Within three working days", "Dalam tiga hari kerja") },
      { title: B("Report and readout", "Laporan dan pembahasan"), text: B("We send the written report and walk through it with your team.", "Kami mengirim laporan tertulis dan membahasnya bersama tim Anda."), when: B("At a time agreed with you", "Pada waktu yang disepakati dengan Anda") },
    ],
    inputs: [
      B("The final or near-final deck, as PowerPoint (preferred) or PDF", "Dek final atau hampir final, dalam bentuk PowerPoint (lebih disukai) atau PDF"),
      B("The model or source document the figures come from, if you want them traced", "Model atau dokumen sumber angka-angkanya, jika Anda ingin angka ditelusuri"),
      B("One contact for questions during the review", "Satu narahubung untuk pertanyaan selama tinjauan"),
    ],
    assumptions: [
      B("One deck, in Indonesian or English.", "Satu dek, berbahasa Indonesia atau Inggris."),
      B("The report is written in the language you choose; the readout is in Indonesian or English.", "Laporan ditulis dalam bahasa yang Anda pilih; sesi pembahasan dalam bahasa Indonesia atau Inggris."),
    ],
    exclusions: [
      B("Rewriting or rebuilding the deck. If you want us to make the changes, we quote that separately.", "Penulisan ulang atau pembangunan ulang dek. Jika Anda ingin kami yang mengerjakan perbaikannya, kami memberikan penawaran terpisah."),
      B("Verifying the accounts or the model behind the deck. We report where the deck disagrees with itself or with the source you send; we do not confirm that the underlying figures are correct.", "Verifikasi pembukuan atau model di balik dek. Kami melaporkan di mana dek tidak konsisten dengan dirinya sendiri atau dengan sumber yang Anda kirim; kami tidak memastikan bahwa angka dasarnya benar."),
      B("Figures inside charts pasted as pictures, which can be checked by eye only.", "Angka di dalam grafik yang ditempel sebagai gambar, yang hanya dapat diperiksa secara visual."),
    ],
    schedule: [{ label: B("On acceptance of this proposal", "Pada saat proposal ini diterima"), pct: 100 }],
  },
  {
    key: "deckAuditQuarterly", basis: "fixed", planFee: null,
    name: B("Deck Audit every results season", "Audit Dek setiap musim rilis kinerja"),
    subjectHint: B("the four quarterly results decks for FY2026", "empat dek hasil triwulanan FY2026"),
    objective: B("To audit {subject} before each one goes out, so every figure agrees with the rest of the deck, with the source you supply and with what you reported last quarter.",
      "Mengaudit {subject} sebelum masing-masing dirilis, agar setiap angka selaras dengan bagian lain dek, dengan sumber yang Anda berikan, dan dengan apa yang Anda laporkan pada triwulan lalu."),
    deliverables: [
      B("An audit of each quarter's results deck before release: every figure checked against every other mention of it and against your source, the storyline read title by title, and anything that still looks like a draft marked", "Audit atas dek hasil setiap triwulan sebelum dirilis: setiap angka dicocokkan dengan setiap penyebutannya dan dengan sumber Anda, alur cerita dibaca judul demi judul, dan apa pun yang masih tampak seperti draf ditandai"),
      B("A comparison with last quarter's deck: figures for earlier periods that changed without a note, and what changed in the storyline", "Perbandingan dengan dek triwulan lalu: angka periode sebelumnya yang berubah tanpa catatan, dan perubahan pada alur cerita"),
      B("A written report each quarter (PDF), with the findings set against last quarter's", "Laporan tertulis setiap triwulan (PDF), dengan temuan yang dibandingkan dengan triwulan lalu"),
      B("A readout each quarter with the people who will make the changes", "Sesi pembahasan setiap triwulan bersama orang yang akan mengerjakan perbaikannya"),
    ],
    steps: [
      { title: B("Results calendar", "Kalender rilis"), text: B("We agree the year's results dates and reserve a review slot before each release.", "Kami menyepakati tanggal rilis hasil sepanjang tahun dan menyiapkan jadwal tinjauan sebelum setiap rilis."), when: B("At the start", "Di awal") },
      { title: B("Each quarter", "Setiap triwulan"), text: B("You send the deck, with the source document if you want figures traced; we compare it with last quarter's deck and send the report.", "Anda mengirim dek, beserta dokumen sumber jika Anda ingin angkanya ditelusuri; kami membandingkannya dengan dek triwulan lalu dan mengirim laporannya."), when: B("On the agreed dates", "Pada tanggal yang disepakati") },
      { title: B("Readout", "Pembahasan"), text: B("We walk your team through the findings before the deck is released.", "Kami membahas temuan bersama tim Anda sebelum dek dirilis."), when: B("Before each release", "Sebelum setiap rilis") },
    ],
    inputs: [
      B("The results calendar for the year", "Kalender rilis hasil untuk tahun tersebut"),
      B("Each quarter's deck as PowerPoint (preferred) or PDF on the agreed date, with the source document if you want figures traced", "Dek setiap triwulan dalam bentuk PowerPoint (lebih disukai) atau PDF pada tanggal yang disepakati, beserta dokumen sumber jika Anda ingin angkanya ditelusuri"),
      B("Last quarter's deck as released, for the first review", "Dek triwulan lalu sebagaimana dirilis, untuk tinjauan pertama"),
      B("One contact for questions during each review", "Satu narahubung untuk pertanyaan selama setiap tinjauan"),
    ],
    assumptions: [
      B("Four results decks in twelve months, in Indonesian or English.", "Empat dek hasil dalam dua belas bulan, berbahasa Indonesia atau Inggris."),
      B("The turnaround for each review is agreed with the results calendar at the start.", "Waktu penyelesaian setiap tinjauan disepakati bersama kalender rilis di awal."),
    ],
    exclusions: [
      B("Rewriting or rebuilding the decks. If you want us to make the changes, we quote that separately.", "Penulisan ulang atau pembangunan ulang dek. Jika Anda ingin kami yang mengerjakan perbaikannya, kami memberikan penawaran terpisah."),
      B("Verifying the accounts or the model behind the decks. We report where a deck disagrees with itself, with your source or with last quarter's deck; we do not confirm that the underlying figures are correct.", "Verifikasi pembukuan atau model di balik dek. Kami melaporkan di mana dek tidak konsisten dengan dirinya sendiri, dengan sumber Anda, atau dengan dek triwulan lalu; kami tidak memastikan bahwa angka dasarnya benar."),
      B("Figures inside charts pasted as pictures, which can be checked by eye only.", "Angka di dalam grafik yang ditempel sebagai gambar, yang hanya dapat diperiksa secara visual."),
    ],
    schedule: [
      { label: B("Before the first results season (on acceptance)", "Sebelum musim rilis pertama (pada saat proposal diterima)"), pct: 25 },
      { label: B("Before the second results season", "Sebelum musim rilis kedua"), pct: 25 },
      { label: B("Before the third results season", "Sebelum musim rilis ketiga"), pct: 25 },
      { label: B("Before the fourth results season", "Sebelum musim rilis keempat"), pct: 25 },
    ],
  },
  {
    key: "deckProject", basis: "fixed", planFee: 85000000,
    name: B("Board and executive deck", "Dek dewan dan eksekutif"),
    subjectHint: B("the 2027 strategy deck for the board", "dek strategi 2027 untuk dewan"),
    objective: B("To build {subject} from one investment thesis, so the board, the executive team and the market hear the same story, with every figure reconciled to your model.",
      "Membangun {subject} dari satu tesis investasi, agar dewan, tim eksekutif dan pasar mendengar cerita yang sama, dengan setiap angka direkonsiliasi ke model Anda."),
    deliverables: [
      B("Investment-thesis workshop with management", "Lokakarya tesis investasi bersama manajemen"),
      B("The deck, with an action title on every page and a one-page decision memo", "Dek dengan judul aksi di setiap halaman dan memo keputusan satu halaman"),
      B("Reconciliation log tying every figure to your model", "Log rekonsiliasi yang mengaitkan setiap angka dengan model Anda"),
      B("Rehearsal with the presenters", "Gladi bersih bersama para penyaji"),
    ],
    steps: [
      { title: B("Brief", "Brief"), text: B("A one-page brief: audience, decision, sources and deadline.", "Brief satu halaman: audiens, keputusan, sumber dan tenggat."), when: null },
      { title: B("Storyline", "Alur cerita"), text: B("Thesis workshop and storyboard; the storyboard is signed off before layout starts.", "Lokakarya tesis dan storyboard; storyboard disetujui sebelum tata letak dimulai."), when: null },
      { title: B("Build", "Penyusunan"), text: B("Pages built and figures reconciled to your model; a four-eyes check before anything reaches the board.", "Halaman disusun dan angka direkonsiliasi ke model Anda; pemeriksaan empat mata sebelum apa pun sampai ke dewan."), when: null },
      { title: B("Rehearsal and final", "Gladi dan final"), text: B("Rehearsal with the presenters and the final files.", "Gladi bersama para penyaji dan berkas final."), when: null },
    ],
    inputs: [
      B("Access to management for the thesis workshop", "Akses ke manajemen untuk lokakarya tesis"),
      B("The model and the figures the deck must use, and the person who owns them", "Model dan angka yang harus digunakan dek, serta pemiliknya"),
      B("Your brand guidelines and template, if you have them", "Pedoman merek dan templat Anda, jika ada"),
      B("Sign-off on the storyboard and on the final deck by a named person", "Persetujuan atas storyboard dan dek final oleh orang yang ditunjuk"),
    ],
    assumptions: [
      B("One deck in one language; a version in the second language is quoted separately unless listed above.", "Satu dek dalam satu bahasa; versi dalam bahasa kedua ditawarkan terpisah kecuali tercantum di atas."),
      B("The timeline assumes feedback within two working days at each sign-off.", "Jadwal mengasumsikan masukan dalam dua hari kerja pada setiap tahap persetujuan."),
    ],
    exclusions: [
      B("Building or auditing the financial model.", "Penyusunan atau audit model keuangan."),
      B("Legal, tax or regulatory advice on the content.", "Nasihat hukum, pajak atau regulasi atas isinya."),
      B("Printing and venue production.", "Pencetakan dan produksi acara."),
    ],
    schedule: [{ label: B("On acceptance of this proposal", "Pada saat proposal ini diterima"), pct: 50 }, { label: B("On delivery of the final deck", "Pada saat dek final diserahkan"), pct: 50 }],
  },
  {
    key: "retainer", basis: "monthly", planFee: 35000000, months: 12,
    name: B("Earnings-call retainer", "Retainer paparan kinerja"),
    subjectHint: B("the quarterly results and investor communications", "presentasi hasil triwulanan dan komunikasi investor"),
    objective: B("To produce {subject} for twelve months from a team that knows your numbers, so every results deck is reconciled, on time and in one standard.",
      "Menyiapkan {subject} selama dua belas bulan oleh tim yang memahami angka Anda, agar setiap dek hasil kinerja terekonsiliasi, tepat waktu dan dalam satu standar."),
    deliverables: [
      B("Four quarterly results decks with action titles and reconciled figures", "Empat dek hasil triwulanan dengan judul aksi dan angka terekonsiliasi"),
      B("The annual public-expose deck", "Dek public expose tahunan"),
      B("Investor updates and two ad-hoc decks a year", "Pembaruan investor dan dua dek ad-hoc per tahun"),
      B("A template and chart system your team can use between cycles", "Sistem templat dan grafik yang dapat digunakan tim Anda di antara siklus"),
      B("48-hour turnaround at results, and a disclosure checklist on every release", "Penyelesaian 48 jam saat rilis hasil, dan daftar periksa keterbukaan informasi pada setiap rilis"),
    ],
    steps: [
      { title: B("Set-up", "Persiapan"), text: B("Template and chart system, and the reconciliation routine with your finance team.", "Sistem templat dan grafik, serta rutinitas rekonsiliasi bersama tim keuangan Anda."), when: B("First month", "Bulan pertama") },
      { title: B("Each results cycle", "Setiap siklus hasil"), text: B("Storyboard sign-off before layout, then the deck within 48 hours of final figures.", "Persetujuan storyboard sebelum tata letak, lalu dek dalam 48 jam setelah angka final."), when: B("Each quarter", "Setiap triwulan") },
      { title: B("Review", "Evaluasi"), text: B("A review of the year before renewal.", "Evaluasi tahunan sebelum perpanjangan."), when: B("Month 11", "Bulan ke-11") },
    ],
    inputs: [
      B("The results calendar and final figures on the agreed dates", "Kalender rilis hasil dan angka final pada tanggal yang disepakati"),
      B("One owner in finance or investor relations for each cycle", "Satu penanggung jawab di bagian keuangan atau hubungan investor untuk setiap siklus"),
      B("Sign-off by your corporate secretary or an authorised officer before any release", "Persetujuan sekretaris perusahaan atau pejabat berwenang sebelum setiap rilis"),
    ],
    assumptions: [
      B("Twelve months from the start date, renewed annually.", "Dua belas bulan sejak tanggal mulai, diperpanjang setiap tahun."),
      B("No per-slide pricing. Work beyond the list above is agreed in writing before it starts.", "Tanpa harga per slide. Pekerjaan di luar daftar di atas disepakati secara tertulis sebelum dimulai."),
    ],
    exclusions: [
      B("The annual report, which is a separate engagement.", "Laporan tahunan, yang merupakan penugasan terpisah."),
      B("Legal review of disclosures, which stays with your counsel and corporate secretary.", "Tinjauan hukum atas keterbukaan informasi, yang tetap menjadi tanggung jawab penasihat hukum dan sekretaris perusahaan Anda."),
    ],
    payment: B("Invoiced monthly in advance, on the first working day of each month.", "Ditagihkan bulanan di muka, pada hari kerja pertama setiap bulan."),
  },
  {
    key: "templateSystem", basis: "fixed", planFee: 120000000,
    name: B("Corporate template system", "Sistem templat korporat"),
    subjectHint: B("a PowerPoint template system for the group", "sistem templat PowerPoint untuk grup"),
    objective: B("To build {subject}, with layouts, a chart library and a guide, so every deck in the company looks like it came from the same hand.",
      "Membangun {subject}, dengan tata letak, pustaka grafik dan panduan, agar setiap dek di perusahaan tampak berasal dari tangan yang sama."),
    deliverables: [
      B("Master template with layouts for the deck types you actually produce", "Templat induk dengan tata letak untuk jenis dek yang benar-benar Anda buat"),
      B("Chart library in the firm's standard, linked to Excel where needed", "Pustaka grafik sesuai standar perusahaan, terhubung ke Excel bila diperlukan"),
      B("Icon set, image rules and a short usage guide", "Set ikon, aturan gambar dan panduan penggunaan singkat"),
      B("A 90-minute training for the teams that use it", "Pelatihan 90 menit untuk tim yang menggunakannya"),
    ],
    steps: [
      { title: B("Inventory", "Inventarisasi"), text: B("We collect the decks you produce today and agree the layouts the system must cover.", "Kami mengumpulkan dek yang Anda buat saat ini dan menyepakati tata letak yang harus dicakup sistem."), when: null },
      { title: B("Design", "Desain"), text: B("Master layouts and chart styles, signed off by a named person.", "Tata letak induk dan gaya grafik, disetujui oleh orang yang ditunjuk."), when: null },
      { title: B("Build and test", "Penyusunan dan uji"), text: B("The template, chart library and guide, tested by your team on a live deck.", "Templat, pustaka grafik dan panduan, diuji oleh tim Anda pada dek yang sedang dikerjakan."), when: null },
      { title: B("Training and handover", "Pelatihan dan serah terima"), text: B("The training session and the final files.", "Sesi pelatihan dan berkas final."), when: null },
    ],
    inputs: [
      B("Your brand guidelines, logo files and font licences", "Pedoman merek, berkas logo dan lisensi huruf Anda"),
      B("A representative set of recent decks", "Sekumpulan dek terbaru yang representatif"),
      B("A named person to sign off the design", "Orang yang ditunjuk untuk menyetujui desain"),
    ],
    assumptions: [
      B("PowerPoint unless Google Slides is agreed instead.", "PowerPoint kecuali disepakati Google Slides."),
      B("Fonts and stock images are licensed by you under their own terms.", "Huruf dan gambar stok dilisensikan oleh Anda sesuai ketentuannya masing-masing."),
    ],
    exclusions: [
      B("Converting existing decks into the new template, which can be quoted separately.", "Konversi dek yang sudah ada ke templat baru, yang dapat ditawarkan terpisah."),
      B("A new brand identity.", "Identitas merek baru."),
    ],
    schedule: [{ label: B("On acceptance of this proposal", "Pada saat proposal ini diterima"), pct: 50 }, { label: B("On handover of the final files", "Pada saat serah terima berkas final"), pct: 50 }],
  },
  {
    key: "report", basis: "fixed", planFee: 300000000,
    name: B("Annual and sustainability report", "Laporan tahunan dan keberlanjutan"),
    subjectHint: B("the FY2026 integrated annual and sustainability report", "laporan tahunan dan keberlanjutan terintegrasi FY2026"),
    objective: B("To produce {subject} as one narrative in one voice, with the disclosure checklist applied and filing-ready files.",
      "Menyusun {subject} sebagai satu narasi dengan satu suara, dengan daftar periksa keterbukaan informasi diterapkan dan berkas siap diajukan."),
    deliverables: [
      B("Narrative built from the strategy and the year's results, in one voice", "Narasi yang disusun dari strategi dan hasil tahun berjalan, dengan satu suara"),
      B("Disclosure checklist applied: SEOJK 16/2021, POJK 51/2017, IDX rules, PSPK 1/2", "Daftar periksa keterbukaan informasi diterapkan: SEOJK 16/2021, POJK 51/2017, peraturan BEI, PSPK 1/2"),
      B("Design, data visualisation and bilingual production, filing-ready", "Desain, visualisasi data dan produksi dwibahasa, siap diajukan"),
      B("ARA readiness review against the assessment criteria", "Tinjauan kesiapan ARA terhadap kriteria penilaian"),
      B("Print and web versions through a production partner under our management", "Versi cetak dan web melalui mitra produksi di bawah pengelolaan kami"),
    ],
    steps: [
      { title: B("Kick-off", "Kick-off"), text: B("Storyline, contents and disclosure map agreed before the financial year closes.", "Alur cerita, daftar isi dan peta keterbukaan informasi disepakati sebelum tahun buku ditutup."), when: B("November", "November") },
      { title: B("Drafting", "Penyusunan naskah"), text: B("Narrative and data from your teams; drafts reviewed by section owners.", "Narasi dan data dari tim Anda; draf ditinjau oleh pemilik setiap bagian."), when: B("December to February", "Desember hingga Februari") },
      { title: B("Design and audited figures", "Desain dan angka teraudit"), text: B("Layout, charts and the audited figures once signed.", "Tata letak, grafik dan angka teraudit setelah ditandatangani."), when: B("February to March", "Februari hingga Maret") },
      { title: B("Filing-ready", "Siap diajukan"), text: B("Final checks, sign-off by your corporate secretary, print and web files.", "Pemeriksaan akhir, persetujuan sekretaris perusahaan, berkas cetak dan web."), when: B("April", "April") },
    ],
    inputs: [
      B("A named owner for each section, and the data on the agreed dates", "Penanggung jawab untuk setiap bagian, serta data pada tanggal yang disepakati"),
      B("The audited financial statements once signed", "Laporan keuangan teraudit setelah ditandatangani"),
      B("Sign-off by your corporate secretary or an authorised officer before filing", "Persetujuan sekretaris perusahaan atau pejabat berwenang sebelum pengajuan"),
    ],
    assumptions: [
      B("Fixed fee, billed by milestone.", "Biaya tetap, ditagihkan per tahapan."),
      B("Printing costs are passed through at cost only if agreed in writing.", "Biaya cetak diteruskan sesuai biaya aktual hanya jika disepakati secara tertulis."),
    ],
    exclusions: [
      B("The audit of the financial statements and the assurance of sustainability data.", "Audit laporan keuangan dan asurans data keberlanjutan."),
      B("Legal advice on disclosure obligations.", "Nasihat hukum atas kewajiban keterbukaan informasi."),
    ],
    schedule: [{ label: B("On acceptance of this proposal", "Pada saat proposal ini diterima"), pct: 30 }, { label: B("On sign-off of the design", "Pada saat desain disetujui"), pct: 40 }, { label: B("On delivery of the filing-ready files", "Pada saat berkas siap diajukan diserahkan"), pct: 30 }],
  },
  {
    key: "custom", basis: "fixed", planFee: null,
    name: B("Custom engagement", "Penugasan khusus"),
    subjectHint: B("what the engagement covers", "cakupan penugasan"),
    objective: B("To deliver {subject}.", "Menyelesaikan {subject}."),
    deliverables: [], steps: [], inputs: [], assumptions: [], exclusions: [],
    schedule: [{ label: B("On acceptance of this proposal", "Pada saat proposal ini diterima"), pct: 50 }, { label: B("On delivery", "Pada saat penyerahan"), pct: 50 }],
  },
];

export const offerByKey = (k) => OFFERS.find((o) => o.key === k) || OFFERS[0];
