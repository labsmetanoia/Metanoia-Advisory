import { readJsonDir, publishable } from "../../lib/content.js";
const items = readJsonDir("content/insights");
export default publishable(items, "insights",
  ["key", "slug", "type", "title", "date", "authors", "readingTime", "summary", "body", "metaDescription"],
  { summary: 400, metaDescription: 155 }).sort((a, b) => new Date(b.date) - new Date(a.date));
