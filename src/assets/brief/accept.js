// The acceptance form: fills the proposal reference from the link in the proposal (?ref=…) and puts it in the email
// subject, so each acceptance arrives under its own reference.
const form = document.getElementById("accept-form");
if (form) {
  const ref = form.elements.reference, subject = form.elements.subject, base = subject ? subject.value : "";
  try { const r = new URLSearchParams(location.search).get("ref"); if (r && /^[\w/.-]{3,40}$/.test(r)) ref.value = r; } catch (e) { /* no query */ }
  const sync = () => { if (subject) subject.value = ref.value.trim() ? `${base}: ${ref.value.trim()}` : base; };
  ref.addEventListener("input", sync); sync();
  document.documentElement.dataset.accept = "ready";
}
