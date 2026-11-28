// The disclosure calendar's date arithmetic and calendar file (src/assets/disclosure-calendar/calendar.js), in Node.
const C = await import("../src/assets/disclosure-calendar/calendar.js");
let failed = 0; const check = (name, ok, detail = "") => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok || !detail ? "" : `  (${detail})`}`); if (!ok) failed++; };
const by = (items) => Object.fromEntries(items.map((i) => [i.id, i.date]));
console.log("Disclosure calendar");
const dec = by(C.deadlines({ yearEnd: "2025-12-31", agm: "2026-06-17", review: { H1: "limited", Q1: "none", Q3: "audited" } }));
check("December year-end: annual statements, annual and sustainability reports, latest GMS", dec["annual-fs"] === "2026-03-31" && dec["annual-report"] === "2026-04-30" && dec.sustainability === "2026-04-30" && dec["agm-latest"] === "2026-06-30", JSON.stringify(dec));
check("interim statements follow the review level chosen", dec["q1-fs"] === "2026-04-30" && dec["half-year-fs"] === "2026-08-31" && dec["q3-fs"] === "2026-12-31", JSON.stringify(dec));
check("GMS chain counts back from the meeting: summons, announcement, agenda to OJK (working days), minutes", dec["agm-summons"] === "2026-05-26" && dec["agm-announcement"] === "2026-05-11" && dec["agm-agenda"] === "2026-05-04" && dec["agm-minutes"] === "2026-06-19" && dec.agm === "2026-06-17", JSON.stringify(dec));
const mar = by(C.deadlines({ yearEnd: "2026-03-31" }));
check("March year-end: the year shifts, and without a meeting date there is no notice chain", mar["annual-fs"] === "2026-06-30" && mar["agm-latest"] === "2026-09-30" && mar["q1-fs"] === "2026-07-31" && !("agm-summons" in mar), JSON.stringify(mar));
const late = C.deadlines({ yearEnd: "2025-12-31", agm: "2026-07-15" }).find((i) => i.meeting), wk = C.deadlines({ yearEnd: "2025-12-31" }).find((i) => i.id === "q3-fs");
check("a meeting after the latest date and a deadline on a weekend are flagged", late.late === true && wk.date === "2026-10-31" && wk.weekend === true);
const ics = C.toIcs(C.deadlines({ yearEnd: "2025-12-31", agm: "2026-06-17" }), "id", { meeting: "RUPS tahunan", meetingNote: "x", toCheck: "Perlu dicocokkan — naskah", disclaimer: "Alat bantu perencanaan, bukan nasihat hukum; hari libur nasional dan cuti bersama tidak diperhitungkan." });
const lines = ics.split("\r\n"), long = lines.filter((l) => new TextEncoder().encode(l).length > 75);
check("calendar file: one event per dated deadline, CRLF lines folded within 75 bytes", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n") && (ics.match(/BEGIN:VEVENT/g) || []).length === 12 && long.length === 0 && /DTSTART;VALUE=DATE:20260331/.test(ics), `${long.length} long lines`);
console.log(failed ? `\nFAILED: ${failed}` : "\nCalendar OK."); process.exit(failed ? 1 : 0);
