// Disclosure calendar — the rules and the date arithmetic, with no page code, so the tests can run it in Node.
// Each rule cites its source and carries a status: "checked" once its wording has been read in the regulation text,
// "to-check" until then. The page shows the status, and the site keeps the calendar in preview while any rule is
// "to-check". Working days skip Saturdays and Sundays only: public holidays and cuti bersama are not known here.

const B = (en, id) => ({ en, id });

// kind: "afterYearEnd" (months after the financial year end, to the end of that month);
//       "afterPeriodEnd" (months after a period end: half-year or quarter, to the end of that month);
//       "beforeMeeting" / "beforeStep" / "afterMeeting" (the GMS notice chain, from the planned meeting date)
export const RULES = [
  { id: "annual-fs", group: "reports", kind: "afterYearEnd", months: 3, status: "to-check",
    title: B("Audited annual financial statements: submitted to OJK and announced", "Laporan keuangan tahunan teraudit: disampaikan ke OJK dan diumumkan"),
    basis: B("POJK 14/POJK.04/2022, Article 4", "POJK 14/POJK.04/2022, Pasal 4"),
    rule: B("By the end of the third month after the financial year ends.", "Paling lambat akhir bulan ketiga setelah tahun buku berakhir.") },
  { id: "annual-report", group: "reports", kind: "afterYearEnd", months: 4, status: "to-check",
    title: B("Annual report submitted to OJK", "Laporan tahunan disampaikan ke OJK"),
    basis: B("POJK 29/POJK.04/2016, Article 7", "POJK 29/POJK.04/2016, Pasal 7"),
    rule: B("By the end of the fourth month after the financial year ends.", "Paling lambat akhir bulan keempat setelah tahun buku berakhir.") },
  { id: "sustainability", group: "reports", kind: "afterYearEnd", months: 4, status: "to-check",
    title: B("Sustainability report submitted to OJK", "Laporan keberlanjutan disampaikan ke OJK"),
    basis: B("POJK 51/POJK.03/2017", "POJK 51/POJK.03/2017"),
    rule: B("With the annual report, as part of it or separately.", "Bersama laporan tahunan, sebagai bagian darinya atau terpisah.") },
  { id: "half-year-fs", group: "reports", kind: "afterPeriodEnd", period: "H1", byReview: { none: 1, limited: 2, audited: 3 }, status: "to-check",
    title: B("Mid-year financial statements submitted to OJK and announced", "Laporan keuangan tengah tahunan disampaikan ke OJK dan diumumkan"),
    basis: B("POJK 14/POJK.04/2022, Article 6", "POJK 14/POJK.04/2022, Pasal 6"),
    rule: B("By the end of the first month after the half-year if not reviewed, the second if reviewed (limited review), the third if audited.", "Paling lambat akhir bulan pertama setelah tengah tahun jika tidak ditelaah, bulan kedua jika ditelaah secara terbatas, bulan ketiga jika diaudit.") },
  { id: "q1-fs", group: "reports", kind: "afterPeriodEnd", period: "Q1", byReview: { none: 1, limited: 2, audited: 3 }, status: "to-check",
    title: B("First-quarter interim financial statements submitted to the Exchange", "Laporan keuangan interim triwulan pertama disampaikan ke Bursa"),
    basis: B("IDX Rule I-E", "Peraturan Bursa I-E"),
    rule: B("By the end of the first month after the quarter if not reviewed, the second if reviewed, the third if audited.", "Paling lambat akhir bulan pertama setelah triwulan jika tidak ditelaah, bulan kedua jika ditelaah, bulan ketiga jika diaudit.") },
  { id: "q3-fs", group: "reports", kind: "afterPeriodEnd", period: "Q3", byReview: { none: 1, limited: 2, audited: 3 }, status: "to-check",
    title: B("Third-quarter interim financial statements submitted to the Exchange", "Laporan keuangan interim triwulan ketiga disampaikan ke Bursa"),
    basis: B("IDX Rule I-E", "Peraturan Bursa I-E"),
    rule: B("By the end of the first month after the quarter if not reviewed, the second if reviewed, the third if audited.", "Paling lambat akhir bulan pertama setelah triwulan jika tidak ditelaah, bulan kedua jika ditelaah, bulan ketiga jika diaudit.") },
  { id: "agm-latest", group: "meeting", kind: "afterYearEnd", months: 6, status: "to-check",
    title: B("Latest date for the annual GMS", "Batas akhir RUPS tahunan"),
    basis: B("Law 40/2007 on Limited Liability Companies, Article 78(2); POJK 15/POJK.04/2020", "UU 40/2007 tentang Perseroan Terbatas, Pasal 78 ayat (2); POJK 15/POJK.04/2020"),
    rule: B("Within six months after the financial year ends.", "Paling lambat enam bulan setelah tahun buku berakhir.") },
  { id: "agm-summons", group: "meeting", kind: "beforeMeeting", days: 21, unit: "calendar", exclusive: true, status: "to-check",
    title: B("GMS summons (invitation) published", "Pemanggilan RUPS diumumkan"),
    basis: B("POJK 15/POJK.04/2020", "POJK 15/POJK.04/2020"),
    rule: B("At least 21 days before the meeting, not counting the summons date and the meeting date.", "Paling lambat 21 hari sebelum RUPS, tidak termasuk tanggal pemanggilan dan tanggal RUPS.") },
  { id: "agm-announcement", group: "meeting", kind: "beforeStep", step: "agm-summons", days: 14, unit: "calendar", exclusive: true, status: "to-check",
    title: B("GMS announcement to shareholders", "Pengumuman RUPS kepada pemegang saham"),
    basis: B("POJK 15/POJK.04/2020, Article 14(1)", "POJK 15/POJK.04/2020, Pasal 14 ayat (1)"),
    rule: B("At least 14 days before the summons, not counting the announcement date and the summons date.", "Paling lambat 14 hari sebelum pemanggilan RUPS, tidak termasuk tanggal pengumuman dan tanggal pemanggilan.") },
  { id: "agm-agenda", group: "meeting", kind: "beforeStep", step: "agm-announcement", days: 5, unit: "working", exclusive: true, status: "to-check",
    title: B("GMS agenda notified to OJK", "Mata acara RUPS diberitahukan ke OJK"),
    basis: B("POJK 15/POJK.04/2020", "POJK 15/POJK.04/2020"),
    rule: B("At least 5 working days before the announcement, not counting the announcement date.", "Paling lambat 5 hari kerja sebelum pengumuman RUPS, tidak termasuk tanggal pengumuman.") },
  { id: "agm-minutes", group: "meeting", kind: "afterMeeting", days: 2, unit: "working", status: "to-check",
    title: B("Summary of GMS minutes announced", "Ringkasan risalah RUPS diumumkan"),
    basis: B("POJK 15/POJK.04/2020", "POJK 15/POJK.04/2020"),
    rule: B("Within 2 working days after the meeting.", "Paling lambat 2 hari kerja setelah RUPS.") },
  { id: "public-expose", group: "meeting", kind: "note", status: "to-check",
    title: B("Annual public expose", "Paparan publik tahunan"),
    basis: B("IDX Rule I-E", "Peraturan Bursa I-E"),
    rule: B("At least once a year; it may be held on the day of the annual GMS. Check the rule for when the plan and the presentation must reach the Exchange.", "Paling sedikit satu kali dalam setahun; dapat diselenggarakan pada hari yang sama dengan RUPS tahunan. Periksa peraturannya untuk batas penyampaian rencana dan materi ke Bursa.") },
];

/* ---------- dates (all in UTC, as plain calendar days) ---------- */
const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
export const iso = (d) => d.toISOString().slice(0, 10);
export const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? D(+m[1], +m[2], +m[3]) : null; };
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const endOfMonthAfter = (d, months) => D(d.getUTCFullYear(), d.getUTCMonth() + 1 + months + 1, 0);   // last day of the month `months` after d's month
const weekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
// n working days before (negative n) or after a date, the date itself not counted
function workingDays(d, n) { let x = d, left = Math.abs(n); while (left) { x = addDays(x, Math.sign(n)); if (!weekend(x)) left--; } return x; }
// the latest date that leaves `days` clear days before `ref` (both ends excluded) or `days` days counting one end
const before = (ref, days, unit, exclusive) => (unit === "working" ? workingDays(ref, -days) : addDays(ref, -(days + (exclusive ? 1 : 0))));

// yearEnd: the last day of the financial year being reported (e.g. 2025-12-31). review: { H1, Q1, Q3 } → none | limited | audited.
export function deadlines({ yearEnd, agm = null, review = { H1: "limited", Q1: "none", Q3: "none" } }) {
  const fye = parse(yearEnd); if (!fye) return [];
  const out = [], next = D(fye.getUTCFullYear(), fye.getUTCMonth() + 2, 1);   // the first day of the following financial year
  const periodEnd = { Q1: endOfMonthAfter(next, 2), H1: endOfMonthAfter(next, 5), Q3: endOfMonthAfter(next, 8) };   // the quarters of the following financial year
  const meeting = parse(agm), done = {};
  for (const r of RULES) {
    let date = null, detail = null;
    if (r.kind === "afterYearEnd") date = endOfMonthAfter(fye, r.months);
    else if (r.kind === "afterPeriodEnd") { const lvl = review[r.period] || "none"; date = endOfMonthAfter(periodEnd[r.period], r.byReview[lvl]); detail = { period: r.period, periodEnd: iso(periodEnd[r.period]), review: lvl }; }
    else if (r.kind === "beforeMeeting" && meeting) date = before(meeting, r.days, r.unit, r.exclusive);
    else if (r.kind === "beforeStep" && meeting && done[r.step]) date = before(done[r.step], r.days, r.unit, r.exclusive);
    else if (r.kind === "afterMeeting" && meeting) date = r.unit === "working" ? workingDays(meeting, r.days) : addDays(meeting, r.days);
    if (date) done[r.id] = date;
    if (date || r.kind === "note") out.push({ id: r.id, rule: r, date: date ? iso(date) : null, weekend: date ? weekend(date) : false, detail });
  }
  if (meeting) out.push({ id: "agm", rule: null, date: iso(meeting), meeting: true, late: done["agm-latest"] ? meeting > done["agm-latest"] : false });
  return out.sort((a, b) => (a.date || "9999") < (b.date || "9999") ? -1 : (a.date || "9999") > (b.date || "9999") ? 1 : 0);
}

/* ---------- calendar file (iCalendar, all-day events) ---------- */
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// lines longer than 75 octets are folded (RFC 5545), counting UTF-8 bytes and never splitting a character
function fold(line) { const enc = new TextEncoder(), out = []; let cur = "", n = 0, limit = 75; for (const ch of line) { const b = enc.encode(ch).length; if (n + b > limit) { out.push(cur); cur = " "; n = 1; limit = 75; } cur += ch; n += b; } out.push(cur); return out.join("\r\n"); }
export function toIcs(items, lang, labels) {
  const L = lang === "id" ? "id" : "en", stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Metanoia Advisory//Disclosure calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const it of items) { if (!it.date) continue; const d = it.date.replace(/-/g, ""), end = iso(addDays(parse(it.date), 1)).replace(/-/g, "");
    const title = it.meeting ? labels.meeting : it.rule.title[L], desc = it.meeting ? labels.meetingNote : `${it.rule.rule[L]} ${it.rule.basis[L]}.${it.rule.status === "checked" ? "" : ` ${labels.toCheck}`} ${labels.disclaimer}`;
    lines.push("BEGIN:VEVENT", `UID:${it.id}-${d}@metanoiaadvisors.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, fold(`SUMMARY:${icsText(title)}`), fold(`DESCRIPTION:${icsText(desc)}`), "TRANSP:TRANSPARENT", "END:VEVENT"); }
  lines.push("END:VCALENDAR"); return lines.join("\r\n") + "\r\n";
}
