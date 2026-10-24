import { langs } from "../../lib/routes.js";
import cases from "./cases.js";
export default langs.flatMap((lang) => cases.map((c, i) => ({ lang, item: c, next: cases[(i + 1) % cases.length] })));
