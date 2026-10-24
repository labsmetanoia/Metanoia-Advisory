import { readJsonDir, publishable } from "../../lib/content.js";
const items = readJsonDir("content/services");
export default publishable(items, "services",
  ["key", "practice", "slug", "title", "promise", "who", "get", "duration", "next", "metaDescription"],
  { promise: 180, metaDescription: 155 }).sort((a, b) => a.order - b.order);
