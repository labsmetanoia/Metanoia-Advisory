// The disclosure calendar page: reads the inputs, lists the deadlines from calendar.js, and offers an .ics file.
// Everything is worked out in the browser; nothing is sent.
import { deadlines, toIcs, RULES } from "./calendar.js";

const $ = (id) => document.getElementById(id), el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const lang = $("cal-script").dataset.lang === "id" ? "id" : "en", T = JSON.parse($("cal-strings").textContent);
const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === "id" ? "id-ID" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
let items = [];

// the year-end whose reporting is still ahead: the last one whose annual statements are not yet due, else the next
(function defaults() { const now = new Date(), y = now.getUTCFullYear(), last = new Date(Date.UTC(y - 1, 11, 31)), due = new Date(Date.UTC(y, 2, 31)); $("cal-fye").value = `${now <= due ? last.getUTCFullYear() : y}-12-31`; })();
const unchecked = RULES.filter((r) => r.status !== "checked").length;
if (unchecked) { const p = $("cal-pending"); p.textContent = T.pending.replace("{n}", unchecked).replace("{m}", RULES.length); p.hidden = false; }

function show() {
  items = deadlines({ yearEnd: $("cal-fye").value, agm: $("cal-agm").value || null, review: { Q1: $("cal-Q1").value, H1: $("cal-H1").value, Q3: $("cal-Q3").value } });
  const list = $("cal-list"); list.textContent = "";
  for (const it of items) {
    const li = el("li", `cal-item${it.meeting ? " cal-item--meeting" : ""}`), when = el("div", "cal-when", it.date ? fmt(it.date) : T.noDate); li.appendChild(when);
    const body = el("div", "cal-body"); body.appendChild(el("h3", "", it.meeting ? T.meeting : it.rule.title[lang]));
    if (it.rule) { body.appendChild(el("p", "cal-rule", it.rule.rule[lang])); if (it.detail) body.appendChild(el("p", "cal-meta", `${T.period}: ${fmt(it.detail.periodEnd)}`));
      const basis = el("p", "cal-basis"); basis.appendChild(el("span", "", it.rule.basis[lang])); basis.appendChild(el("span", `cal-status cal-status--${it.rule.status}`, it.rule.status === "checked" ? T.checked : T.toCheck)); body.appendChild(basis); }
    if (it.weekend) body.appendChild(el("p", "cal-flag", T.weekend)); if (it.late) body.appendChild(el("p", "cal-flag", T.late));
    li.appendChild(body); list.appendChild(li);
  }
  $("cal-need").textContent = T.needAgm; $("cal-need").hidden = Boolean($("cal-agm").value);
  $("cal-result").hidden = !items.length; $("cal-ics").disabled = !items.some((i) => i.date);
}
$("cal-form").addEventListener("submit", (e) => { e.preventDefault(); show(); });
for (const id of ["cal-fye", "cal-agm", "cal-Q1", "cal-H1", "cal-Q3"]) $(id).addEventListener("change", () => { if (!$("cal-result").hidden) show(); });
$("cal-ics").addEventListener("click", () => {
  const ics = toIcs(items, lang, { meeting: T.meetingTitle, meetingNote: T.meetingNote, toCheck: T.toCheck, disclaimer: T.disclaimer });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = `${T.file}-${$("cal-fye").value.slice(0, 4)}.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
show();
document.documentElement.dataset.calendar = "ready";
