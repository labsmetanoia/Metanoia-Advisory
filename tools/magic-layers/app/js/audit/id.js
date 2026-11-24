// Deck Auditor — Bahasa Indonesia for the client report. The audit itself produces its findings in English; this
// module restates each finding from its code, its slide list and the figures quoted in the English text. A finding
// whose wording is not recognised is returned as it is (ok: false), so the report is never left with a hole.

export const PILLAR_ID = { structure: "Struktur konsultansi", design: "Desain kelas eksekutif", numbers: "Angka yang cocok" };
export const SEV_ID = { high: "Perbaiki", medium: "Periksa", low: "Rapikan" };
export const KIND_ID = { action: "Judul aksi", label: "Label", topic: "Topik", missing: "Tanpa judul", exempt: "Halaman standar", cover: "Sampul atau pembatas" };
export const STATUS_ID = { differs: "Berbeda", missing: "Tidak ditemukan", found: "Nilainya ditemukan", derived: "Diturunkan", confirmed: "Sesuai" };

export const ACTIONS_ID = {
  mismatch: "Tentukan angka mana yang benar, perbaiki yang lain, dan nyatakan periode serta dasarnya dengan cara yang sama di setiap tempat.",
  precision: "Pilih satu tingkat pembulatan untuk setiap angka dan gunakan di semua halaman.",
  growth: "Hitung ulang persentasenya dari dua angka di sampingnya, atau perbaiki angka yang keliru. Pembaca akan menghitungnya sendiri.",
  "total-row": "Periksa kembali baris dan totalnya terhadap sumber; jika ada baris yang belum masuk tabel, tambahkan atau ubah label totalnya.",
  "total-col": "Periksa kembali sel dan totalnya terhadap sumber.",
  "chart-total": "Buka data grafiknya dan periksa kembali batang total terhadap bagian-bagiannya.",
  shares: "Hitung ulang porsinya dari sumber. Jika selisihnya karena pembulatan, nyatakan dalam catatan di bawah peraga.",
  headline: "Samakan judul dengan peraganya: ubah angka di judul, atau tampilkan angka yang dikutip judul di grafik atau tabel.",
  "no-source": "Tambahkan baris sumber di bawah setiap peraga: dari mana angkanya dan per tanggal berapa.",
  restated: "Pastikan angka mana yang benar. Jika angka triwulan lalu disajikan kembali, nyatakan di halaman tersebut, misalnya dalam catatan di bawah peraga, agar pembaca yang membandingkan kedua dek tidak menemukannya lebih dulu.",
  "source-differs": "Cocokkan angka dengan sumbernya dan perbaiki yang keliru. Jika dek yang benar, sumbernya perlu diperbarui sebelum rapat.",
  "source-missing": "Untuk setiap angka, catat dari mana asalnya. Angka yang tidak dapat ditelusuri siapa pun sebaiknya tidak sampai ke dewan.",
  "label-titles": "Tulis ulang setiap judul sebagai kalimat utuh yang menyatakan apa yang dibuktikan halaman itu, agar dek dapat diikuti dari judulnya saja.",
  "no-title": "Beri setiap halaman judul yang menyatakan poinnya.",
  "long-title": "Pangkas judul menjadi satu gagasan, paling banyak dua baris; pindahkan keterangannya ke isi halaman.",
  "duplicate-title": "Beri setiap halaman kesimpulannya sendiri, atau gabungkan halaman yang menyampaikan poin yang sama.",
  "no-summary": "Tambahkan halaman ringkasan di bagian depan yang memuat jawaban dan permintaannya, agar pembaca dapat berhenti di sana.",
  "no-ask": "Nyatakan keputusan atau langkah selanjutnya di halaman tersendiri.",
  dense: "Pecah halamannya, atau pindahkan rincian ke lampiran. Sisakan apa yang diperlukan pembaca untuk memutuskan.",
  language: "Terjemahkan halamannya, atau hapus jika tertinggal dari versi bahasa lainnya.",
  "draft-marks": "Ganti atau hapus setiap penanda draf sebelum dek dikirim keluar.",
  "empty-placeholder": "Hapus placeholder yang kosong.",
  fonts: "Gunakan jenis huruf dek itu sendiri untuk semua teks.",
  stretched: "Kembalikan proporsi setiap gambar dan potong (crop) agar pas, jangan menarik sisinya.",
  "low-res": "Ganti setiap gambar dengan aslinya yang beresolusi lebih tinggi, atau tampilkan lebih kecil.",
  "page-number": "Beri nomor pada setiap halaman; dewan merujuk halaman dengan nomornya.",
  "title-size": "Gunakan ukuran yang sama untuk semua judul. Jika judul diperkecil agar muat, lebih baik dipersingkat.",
  "title-position": "Letakkan setiap judul di tempat yang sama, agar dek tidak melompat saat halaman dibalik.",
  "small-type": "Perbesar teks isi hingga terbaca di layar bersama, dengan memangkas kata untuk memberi ruang.",
  "off-slide": "Kembalikan konten ke dalam halaman; apa pun yang melewati tepi akan terpotong saat dicetak dan di PDF.",
  margin: "Ratakan teks dengan margin kiri dek.",
};

const dan = (s) => String(s).replace(/ and (\d+) more\b/g, " dan $1 lainnya").replace(/ and /g, " dan ");
const slideList = (f, max = 12) => { const u = [...new Set(f.slides || [])].sort((a, b) => a - b); return u.length > max ? `${u.slice(0, max).join(", ")} dan ${u.length - max} lainnya` : u.join(", "); };
const lead = (t) => { const m = /^(\d+)\b/.exec(t); return m ? m[1] : null; };
const tail = (t) => { const m = /\bon (\d+) slides?$/.exec(t); return m ? m[1] : null; };
const lines = (d, map) => d.split("\n").map(map).join("\n");

// code → (finding) → { title, detail } in Indonesian, or null when the English wording is not the one expected
const RULES = {
  "label-titles": (f) => { const n = lead(f.title), m = /instead: ([\s\S]*)$/.exec(f.detail); return n && m && { title: `${n} slide berjudul label, bukan kesimpulan`, detail: `Judul aksi adalah kalimat utuh yang menyatakan apa yang dibuktikan halaman itu. Judul-judul ini hanya menyebut topik: ${m[1]}` }; },
  "no-title": (f) => { const n = lead(f.title); return n && { title: `${n} slide tidak berjudul`, detail: `Pembaca yang menelusuri dek lewat judulnya kehilangan alur di slide ${slideList(f)}.` }; },
  "long-title": (f) => { const n = lead(f.title); return n && { title: `${n} judul melebihi dua baris`, detail: `Judul di atas sekitar 24 kata tidak lagi terbaca sebagai satu gagasan: slide ${slideList(f)}.` }; },
  "duplicate-title": (f) => { const n = /on (\d+) slides$/.exec(f.title), m = /^"([\s\S]*?)" appears on slides /.exec(f.detail); return n && m && { title: `Judul yang sama dipakai di ${n[1]} slide`, detail: `"${m[1]}" muncul di slide ${slideList(f)}. Setiap halaman sebaiknya menyampaikan poinnya sendiri; jika satu argumen dibagi ke beberapa halaman, sebutkan apa yang ditambahkan tiap halaman.` }; },
  "no-summary": () => ({ title: "Tidak ada ringkasan eksekutif di halaman-halaman awal", detail: "Pembaca senior seharusnya dapat berhenti setelah halaman dua atau tiga dan sudah mendapat jawabannya. Tidak ada halaman di bagian depan yang berjudul ringkasan atau pesan utama." }),
  "no-ask": () => ({ title: "Tidak ada halaman yang menyatakan keputusan atau langkah selanjutnya", detail: "Tidak ada judul yang menyebut rekomendasi, keputusan atau langkah selanjutnya. Jika dek ini meminta sesuatu, beri permintaan itu halaman tersendiri." }),
  dense: (f) => { const n = lead(f.title), m = /^Slides? ([\s\S]*?)\. Past that/.exec(f.detail); return n && m && { title: `${n} slide memuat lebih dari 150 kata`, detail: `Slide ${m[1].replace(/\((\d+)\)/g, "($1 kata)")}. Lebih dari itu, halaman dibaca sebagai dokumen, bukan dipresentasikan. Pecah halamannya atau pindahkan rincian ke lampiran.` }; },
  language: (f) => { const n = lead(f.title), m = / in (Indonesian|English) in an /.exec(f.title); return n && m && { title: m[1] === "Indonesian" ? `${n} slide berbahasa Indonesia di dalam dek berbahasa Inggris` : `${n} slide berbahasa Inggris di dalam dek berbahasa Indonesia`, detail: `Slide ${slideList(f)}. Pastikan ini disengaja dan bukan halaman yang tertinggal dari versi bahasa lainnya.` }; },
  mismatch: (f) => { const m = /^("[\s\S]*"(?: \([^)]*\))?) is shown as ([\s\S]*)$/.exec(f.title); return m && { title: `${m[1]} ditampilkan sebagai ${dan(m[2])}`, detail: f.detail }; },
  precision: (f) => { const n = lead(f.title); return n && { title: `${n} angka ditampilkan dengan pembulatan berbeda di tempat berbeda`, detail: f.detail }; },
  "no-source": (f) => { const n = lead(f.title); return n && { title: `${n} slide data tidak memiliki baris sumber`, detail: `Slide ${slideList(f)} menampilkan grafik, tabel atau beberapa angka tanpa baris "Sumber:" atau "Catatan:". Angka tanpa sumber adalah hal pertama yang dipertanyakan anggota dewan.` }; },
  "draft-marks": (f) => { const n = lead(f.title); return n && { title: `${n} penanda draf masih ada di dalam dek`, detail: f.detail }; },
  "empty-placeholder": (f) => { const n = lead(f.title); return n && { title: `${n} placeholder kosong tertinggal di slide`, detail: `Slide ${slideList(f)}. Placeholder ini tidak tercetak, tetapi menampilkan "Click to add text" kepada siapa pun yang membuka berkasnya untuk disunting. Hapus saja.` }; },
  fonts: (f) => { const m = /^(\d+) stray typefaces? beside ([\s\S]*)$/.exec(f.title); if (!m) return null; let ok = true;
    const detail = lines(f.detail, (l) => { const x = /^([\s\S]*): (under 1|[\d.]+)% of the text, on slides? ([\s\S]*)$/.exec(l); if (!x) { ok = false; return l; } return `${x[1]}: ${x[2] === "under 1" ? "di bawah 1" : x[2]}% teks, di slide ${dan(x[3])}`; });
    return ok && { title: `${m[1]} jenis huruf asing di samping ${m[2] === "the house fonts" ? "huruf standar" : dan(m[2])}`, detail }; },
  stretched: (f) => { const n = lead(f.title); return n && { title: `${n} gambar tertarik hingga tidak proporsional`, detail: lines(f.detail, (l) => (/^Reset the picture/.test(l) ? "Kembalikan ukuran gambar, lalu potong (crop), jangan menarik sisinya." : l.replace(/: distorted by (\d+)%$/, ": terdistorsi $1%"))) }; },
  "low-res": (f) => { const n = lead(f.title); return n && { title: `${n} gambar terlalu kasar untuk ukuran tampilnya`, detail: lines(f.detail, (l) => (/^Below about 96/.test(l) ? "Di bawah sekitar 96, gambar tampak buram di layar; cetak memerlukan 150 atau lebih." : l.replace(/ pixels per inch$/, " piksel per inci"))) }; },
  "page-number": (f) => { const n = lead(f.title); return n && { title: `${n} slide tidak bernomor halaman`, detail: `Sebagian besar slide bernomor; slide ${slideList(f)} tidak.` }; },
  "title-size": (f) => { const n = tail(f.title), m = /^Most titles are ([\d.]+) pt\. ([\s\S]*?)\.( Usually[\s\S]*)?$/.exec(f.detail); return n && m && { title: `Ukuran judul berubah di ${n} slide`, detail: `Sebagian besar judul berukuran ${m[1]} pt. ${m[2]}.${m[3] ? " Biasanya teks diperkecil agar muat: lebih baik judulnya dipersingkat." : ""}` }; },
  "title-position": (f) => { const n = tail(f.title); return n && { title: `Posisi judul bergeser di ${n} slide`, detail: `Di sebagian besar slide, judul dimulai di titik yang sama. Di slide ${slideList(f)} judul berada di tempat lain, sehingga tampak melompat saat halaman dibalik.` }; },
  "small-type": (f) => { const n = tail(f.title), m = /^Body text below (a readable size|9 pt) on /.exec(f.title); return n && m && { title: `Teks isi di bawah ${m[1] === "9 pt" ? "9 pt" : "ukuran terbaca"} di ${n} slide`, detail: `Slide ${slideList(f)}. Teks sekecil itu tidak terbaca di ruang rapat atau di layar bersama.` }; },
  "off-slide": (f) => { const n = tail(f.title); return n && { title: `Konten melewati tepi slide di ${n} slide`, detail: `Slide ${slideList(f)}: kotak teks, tabel atau grafik melampaui halaman dan akan terpotong saat dicetak dan di PDF.` }; },
  margin: (f) => { const n = tail(f.title), m = /^Most text starts (\d+) pt/.exec(f.detail); return n && m && { title: `Teks keluar dari margin kiri di ${n} slide`, detail: `Sebagian besar teks dimulai ${m[1]} pt dari tepi kiri. Di slide ${slideList(f)} ada kotak teks yang dimulai lebih ke luar.` }; },
  "total-row": (f) => { const t = /^"([\s\S]*)" does not equal the sum of its rows$/.exec(f.title), d = /^Column "([\s\S]*)": rows add up to ([\s\S]*), the table shows ([\s\S]*)\.$/.exec(f.detail); return t && d && { title: `"${t[1]}" tidak sama dengan jumlah baris-barisnya`, detail: `Kolom "${d[1]}": baris-barisnya berjumlah ${d[2]}, tabel menampilkan ${d[3]}.` }; },
  "total-col": (f) => { const t = /^Row "([\s\S]*)" does not add up to its total$/.exec(f.title), d = /^Cells add up to ([\s\S]*), the total column shows ([\s\S]*)\.$/.exec(f.detail); return t && d && { title: `Baris "${t[1]}" tidak sama dengan totalnya`, detail: `Sel-selnya berjumlah ${d[1]}, kolom total menampilkan ${d[2]}.` }; },
  "chart-total": (f) => { const d = /^Series "([\s\S]*)": bars add up to ([\s\S]*), the total bar is ([\s\S]*)\.$/.exec(f.detail); return d && { title: "\"Total\" pada grafik tidak sama dengan jumlah batangnya", detail: `Seri "${d[1] === "values" ? "nilai" : d[1]}": batang-batangnya berjumlah ${d[2]}, batang total ${d[3]}.` }; },
  shares: (f) => { const pie = /^Pie chart shares add up to ([\d.,-]+)%$/.exec(f.title), pd = /^The slices are ([\s\S]*)\. Readers will add them up\.$/.exec(f.detail); if (pie && pd) return { title: `Porsi pada diagram lingkaran berjumlah ${pie[1]}%`, detail: `Irisannya ${pd[1]}. Pembaca akan menjumlahkannya.` };
    const t = /^Shares add up to ([\d.,-]+)%, not 100%$/.exec(f.title), d = /^The percentages in ([\s\S]*?) are ([\s\S]*)\. If this is rounding/.exec(f.detail); if (!t || !d) return null; const where = d[1] === "this list" ? "daftar ini" : d[1].replace(/^column /, "kolom ");
    return { title: `Porsi berjumlah ${t[1]}%, bukan 100%`, detail: `Persentase pada ${where} adalah ${d[2]}. Jika ini karena pembulatan, nyatakan dalam catatan; jika tidak, ada satu angka yang keliru.` }; },
  growth: (f) => { const t = /^The stated ([\s\S]*) does not follow from the figures next to it$/.exec(f.title), d = /^From ([\s\S]*?) to ([\s\S]*?) is a change of ([-\d.,]+)%\. Text: ([\s\S]*)$/.exec(f.detail); return t && d && { title: `Angka ${t[1]} yang dinyatakan tidak sesuai dengan angka di sampingnya`, detail: `Dari ${d[1]} ke ${d[2]} adalah perubahan ${d[3]}%. Teks: ${d[4]}` }; },
  headline: (f) => { const t = /^The title says ([\s\S]*), but that figure is not on the slide$/.exec(f.title), d = /^The closest figure in the exhibit is ([\s\S]*?) \(([\s\S]*)\)\. A reader checks/.exec(f.detail); return t && d && { title: `Judul menyebut ${t[1]}, tetapi angka itu tidak ada di slide`, detail: `Angka terdekat pada peraga adalah ${d[1]} (${d[2]}). Pembaca akan mencocokkan angka di judul dengan grafiknya lebih dulu.` }; },
  restated: (f) => { const t = /^("[\s\S]*"(?: \([^)]*\))?) was ([\s\S]*) last quarter and is ([\s\S]*) now$/.exec(f.title); return t && { title: `${t[1]} tercatat ${dan(t[2])} pada triwulan lalu dan ${dan(t[3])} sekarang`, detail: lines(f.detail, (l) => l.replace(/^Last quarter, slide /, "Triwulan lalu, slide ").replace(/^This deck, slide /, "Dek ini, slide ")) }; },
  "source-differs": (f) => { const t = /^Slide (\d+) says ([\s\S]*?) for ([\s\S]*); the source says ([\s\S]*)$/.exec(f.title); return t && { title: `Slide ${t[1]} menyebut ${t[2]} untuk ${t[3] === "a figure" ? "sebuah angka" : t[3]}; sumber menyebut ${t[4]}`, detail: lines(f.detail, (l) => l.replace(/^Deck: /, "Dek: ").replace(/^Source: /, "Sumber: ")) }; },
  "source-missing": (f) => { const n = lead(f.title); return n && { title: `${n} angka tidak dapat ditelusuri ke sumber`, detail: lines(f.detail, (l) => (/^They may be calculated/.test(l) ? "Angka-angka ini mungkin hasil perhitungan, berasal dari sumber lain, atau ditulis dengan kata berbeda di sana. Semuanya sebaiknya dapat ditelusuri sebelum dek dikirim." : l.replace(/^… and (\d+) more, listed under Sources\.$/, "… dan $1 lainnya."))) }; },
};

export function idFinding(f) {
  let r = null; try { r = RULES[f.code] ? RULES[f.code](f) : null; } catch (e) { r = null; }
  return r ? { title: r.title, detail: r.detail.replace(/(^|— |\()Chart · /gm, "$1Grafik · "), ok: true } : { title: f.title, detail: f.detail, ok: false };
}
