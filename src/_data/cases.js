import { readJsonDir, publishable } from "../../lib/content.js";
const items = readJsonDir("content/cases");
const out = publishable(items, "cases",
  ["key", "slug", "title", "sector", "situation", "practices", "year", "situationText", "decision", "built", "outcomeLine", "outcome", "artefacts", "relatedServices", "metaDescription"],
  { title: 90, metaDescription: 155 });
// Every outcome figure needs a source note before publishing.
for (const c of out) {
  if (!c.draft && c.outcome && (!c.outcome.source || !c.outcome.source.en || !c.outcome.source.id)) {
    throw new Error(`cases/${c._file}: outcome figure has no source note`);
  }
}
export default out.sort((a, b) => (b.year - a.year) || a.key.localeCompare(b.key));
