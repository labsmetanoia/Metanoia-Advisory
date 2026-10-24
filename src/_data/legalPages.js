import { langs } from "../../lib/routes.js";
export default langs.flatMap((lang) => ["privacy", "terms", "conflicts"].map((key) => ({ lang, key })));
