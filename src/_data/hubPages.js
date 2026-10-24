import { langs } from "../../lib/routes.js";
import practices from "./practices.js";
export default langs.flatMap((lang) => practices.map((p) => ({ lang, practice: p })));
