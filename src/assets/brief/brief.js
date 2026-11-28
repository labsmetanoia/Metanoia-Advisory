// The brief form: keeps a brief code (see brief-code.js, shared with the Proposals tool) in a hidden field that the
// site's form script sends with the rest of the answers, and shows the confidentiality note when it applies.
import { encodeBrief } from "./brief-code.js";

const form = document.getElementById("brief-form");
if (form) {
  const v = (n) => { const el = form.elements[n]; return el ? (el.type === "checkbox" ? el.checked : el.value) : ""; };
  const update = () => {
    document.getElementById("b-code").value = encodeBrief({ lang: form.dataset.lang, offer: v("need"), company: v("company"), name: v("name"), role: v("role"), email: v("email"), subject: v("deck"), audience: v("audience"), decision: v("decision"), message: v("key_message"), sources: v("sources"), deadline: v("deadline"), languages: v("languages"), indonesian: v("registered_in_indonesia"), mnpi: v("not_yet_public"), notes: v("notes") });
    document.getElementById("b-mnpi-note").hidden = !v("not_yet_public");
  };
  form.addEventListener("input", update); form.addEventListener("change", update); update();
  document.documentElement.dataset.brief = "ready";
}
