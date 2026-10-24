import { langs } from "../../lib/routes.js";
import insights from "./insights.js";
export default langs.flatMap((lang) => insights.map((a) => ({ lang, item: a })));
