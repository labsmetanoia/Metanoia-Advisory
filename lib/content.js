import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { langs } from "./routes.js";

export const PREVIEW = process.env.SITE_PREVIEW === "1";

// A content folder may be empty (git does not store empty folders), so a missing folder means "no items".
export function readJsonDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ _file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));
}

// "An item publishes only when all required fields are complete in both languages."
// Required fields are listed per collection; a bilingual field must have non-empty id and en.
export function validate(items, collection, required, limits = {}) {
  const errors = [];
  for (const it of items) {
    for (const field of required) {
      const v = it[field];
      if (v === undefined || v === null || v === "") errors.push(`${collection}/${it._file}: missing "${field}"`);
      else if (typeof v === "object" && !Array.isArray(v) && ("en" in v || "id" in v)) {
        for (const l of langs) if (!v[l] || (typeof v[l] === "string" && !v[l].trim())) errors.push(`${collection}/${it._file}: "${field}" missing in ${l}`);
      }
    }
    for (const [field, max] of Object.entries(limits)) {
      const v = it[field];
      if (!v) continue;
      for (const l of langs) {
        const s = typeof v === "object" ? v[l] : v;
        if (typeof s === "string" && s.length > max) errors.push(`${collection}/${it._file}: "${field}" (${l}) is ${s.length} chars; limit ${max}`);
      }
    }
  }
  return errors;
}

export function publishable(items, collection, required, limits) {
  const errors = validate(items.filter((i) => !i.draft), collection, required, limits);
  if (errors.length) throw new Error(`Content validation failed:\n  ${errors.join("\n  ")}`);
  const draftErrors = validate(items.filter((i) => i.draft), collection, required, limits);
  if (PREVIEW && draftErrors.length) console.warn(`[preview] draft content has gaps (allowed in preview):\n  ${draftErrors.join("\n  ")}`);
  return items.filter((i) => PREVIEW || !i.draft);
}
