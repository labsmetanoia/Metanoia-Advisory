import { langs } from "../../lib/routes.js";
import people from "./people.js";
export default langs.flatMap((lang) => people.map((p, i) => ({ lang, person: p, prev: people[i - 1] || null, next: people[i + 1] || null })));
