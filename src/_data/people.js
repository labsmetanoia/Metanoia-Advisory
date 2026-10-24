import { readJsonDir, publishable } from "../../lib/content.js";
const items = readJsonDir("content/people");
export default publishable(items, "people",
  ["key", "slug", "name", "role", "practices", "seniority", "summary", "trackRecord", "engagements", "languages", "email"],
  { summary: 120 }).sort((a, b) => a.order - b.order);
