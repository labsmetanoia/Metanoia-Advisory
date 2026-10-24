import { langs } from "../../lib/routes.js";
import services from "./services.js";
export default langs.flatMap((lang) => services.map((s) => ({ lang, service: s })));
