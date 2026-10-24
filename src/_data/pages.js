import { readdirSync, readFileSync } from "node:fs";
const dir = "content/pages";
const out = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  out[f.replace(/\.json$/, "")] = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
}
export default out;
