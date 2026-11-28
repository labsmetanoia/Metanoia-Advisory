// The free headline checker. The titles a visitor pastes are read in the browser by the Deck Auditor's own title rule;
// nothing is sent anywhere.
import { reviewTitles } from "../deck-check/audit/titles.js";

const $ = (id) => document.getElementById(id), el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const T = JSON.parse($("hc-strings").textContent), fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (k in v ? v[k] : ""));
const text = $("hc-text"), result = $("hc-result"), status = $("hc-status");

function show(r) {
  $("hc-headline").textContent = !r.actions ? fill(T.headNone, { n: r.judged }) : r.actions === r.judged ? fill(T.headAll, { n: r.judged }) : fill(T.head, { a: r.actions, n: r.judged });
  $("hc-meter").style.width = `${r.share}%`;
  const list = $("hc-list"); list.textContent = "";
  for (const x of r.items) { const li = el("li", `hc-item hc-item--${x.kind === "action" ? "action" : x.kind === "exempt" || x.kind === "cover" ? "exempt" : "topic"}`); li.value = x.n;
    const tag = el("span", "hc-tag", T.kinds[x.kind] || T.kinds.label); li.appendChild(tag); li.appendChild(el("span", "hc-text", x.text));
    const flags = []; if (x.long) flags.push(T.long); if (x.repeatOf) flags.push(fill(T.repeat, { n: x.repeatOf })); if (flags.length) li.appendChild(el("span", "hc-flag", flags.join(" · ")));
    list.appendChild(li); }
  const story = $("hc-story"); story.textContent = "";
  if (r.storyline.length) { const ol = el("ol"); for (const s of r.storyline) ol.appendChild(el("li", "", s)); story.appendChild(ol); } else story.appendChild(el("p", "hc-story__none", T.storyNone));
  const st = $("hc-structure"); st.textContent = "";
  if (r.summary === null) st.appendChild(el("dd", "hc-structure__short", T.short));
  else for (const [k, v] of [["summary", r.summary], ["ask", r.ask]]) { st.appendChild(el("dt", "", T[k])); st.appendChild(el("dd", v ? "is-yes" : "is-no", v ? T.yes : T.no)); }
  result.hidden = false; $("hc-headline").focus({ preventScroll: true });
  result.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}
function run() {
  const r = reviewTitles(text.value);
  if (r.items.length < 2) { result.hidden = true; status.textContent = T.empty; status.classList.add("dc-drop__status--error"); text.focus(); return; }
  status.textContent = ""; status.classList.remove("dc-drop__status--error"); show(r);
}
$("hc-form").addEventListener("submit", (e) => { e.preventDefault(); run(); });
$("hc-example").addEventListener("click", (e) => { text.value = e.currentTarget.dataset.example; run(); });
$("hc-clear").addEventListener("click", () => { text.value = ""; result.hidden = true; status.textContent = ""; text.focus(); });
document.documentElement.dataset.headlineCheck = "ready";
