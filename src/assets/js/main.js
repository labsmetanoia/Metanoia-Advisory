/* Metanoia Advisory — site script. No dependencies. Budget: < 15 KB.
   Responsibilities: menu, compact header, fade-up, language preference, consent gating,
   GA4/LinkedIn loading after consent, event tracking, forms (HubSpot v3), before/after slider, Work filters. */
(function () {
  "use strict";
  var cfg = {}; try { cfg = JSON.parse(document.body.getAttribute("data-site") || "{}"); } catch (e) {}
  var d = document, w = window;
  var reduced = w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;
  d.documentElement.classList.remove("no-js");

  function qs(s, r) { return (r || d).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---- Header: compact on scroll ---- */
  var header = qs(".header");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-compact", w.scrollY > 24); };
    w.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }

  /* ---- Mobile menu with focus trap ---- */
  var menuBtn = qs(".menu-btn"), nav = qs(".nav");
  if (menuBtn && nav) {
    var lastFocus;
    function setMenu(open) {
      nav.classList.toggle("is-open", open);
      d.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.textContent = open ? menuBtn.getAttribute("data-close") : menuBtn.getAttribute("data-open");
      if (open) { lastFocus = d.activeElement; var f = qs("a, button", nav); f && f.focus(); }
      else if (lastFocus) lastFocus.focus();
    }
    menuBtn.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
    d.addEventListener("keydown", function (e) {
      if (!nav.classList.contains("is-open")) return;
      if (e.key === "Escape") { setMenu(false); return; }
      if (e.key === "Tab") {
        var items = qsa("a, button, input, select", nav).filter(function (el) { return el.offsetParent !== null; });
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    w.matchMedia("(min-width: 1280px)").addEventListener("change", function (e) { if (e.matches) setMenu(false); });
  }

  /* ---- Fade-up (once, 200 ms, 8 px) ---- */
  if (!reduced && "IntersectionObserver" in w) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    qsa(".fade-up, .stagger").forEach(function (el) { io.observe(el); });
  } else { qsa(".fade-up, .stagger").forEach(function (el) { el.classList.add("is-visible"); }); }

  /* ---- Language preference (strictly necessary; consent-exempt) ---- */
  var lang = d.documentElement.lang === "id" ? "id" : "en";
  store("lang", lang);
  qsa("[data-lang-switch]").forEach(function (a) {
    a.addEventListener("click", function () { store("lang", a.getAttribute("data-lang-switch")); track("language_switch", { to: a.getAttribute("data-lang-switch") }); });
  });

  /* ---- Consent and tag loading ---- */
  var consentKey = "consent-v1";
  var consent = (function () { try { return JSON.parse(store(consentKey) || "null"); } catch (e) { return null; } })();
  var banner = qs(".consent");
  var tagsLoaded = { analytics: false, marketing: false };
  function loadTags() {
    if (consent && consent.analytics && cfg.ga4 && !tagsLoaded.analytics) {
      tagsLoaded.analytics = true;
      w.dataLayer = w.dataLayer || [];
      w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };
      w.gtag("js", new Date());
      w.gtag("config", cfg.ga4, { anonymize_ip: true, language: lang });
      var s = d.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(cfg.ga4); d.head.appendChild(s);
    }
    if (consent && consent.marketing && cfg.linkedin && !tagsLoaded.marketing) {
      tagsLoaded.marketing = true;
      w._linkedin_partner_id = cfg.linkedin; w._linkedin_data_partner_ids = w._linkedin_data_partner_ids || []; w._linkedin_data_partner_ids.push(cfg.linkedin);
      var l = d.createElement("script"); l.async = true; l.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js"; d.head.appendChild(l);
    }
  }
  function saveConsent(c) { consent = c; store(consentKey, JSON.stringify(c)); banner && banner.classList.remove("is-open", "show-options"); loadTags(); }
  if (banner) {
    if (!consent && (cfg.ga4 || cfg.linkedin)) banner.classList.add("is-open");
    qs("[data-consent='accept']", banner).addEventListener("click", function () { saveConsent({ analytics: true, marketing: true, ts: Date.now() }); });
    qs("[data-consent='decline']", banner).addEventListener("click", function () { saveConsent({ analytics: false, marketing: false, ts: Date.now() }); });
    qs("[data-consent='settings']", banner).addEventListener("click", function () { banner.classList.toggle("show-options"); });
    qs("[data-consent='save']", banner).addEventListener("click", function () {
      saveConsent({ analytics: qs("#consent-analytics", banner).checked, marketing: qs("#consent-marketing", banner).checked, ts: Date.now() });
    });
    qsa("[data-consent-open]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); banner.classList.add("is-open", "show-options"); }); });
  }
  loadTags();

  /* ---- Cookieless analytics (Plausible): loads without consent because it stores nothing on the device ---- */
  if (cfg.plausible) { var ps = d.createElement("script"); ps.defer = true; ps.setAttribute("data-domain", cfg.plausible); ps.src = "https://plausible.io/js/script.outbound-links.tagged-events.js"; d.head.appendChild(ps); w.plausible = w.plausible || function () { (w.plausible.q = w.plausible.q || []).push(arguments); }; }

  /* ---- Event tracking: GA4 after consent, Plausible always when configured ---- */
  function track(name, params) {
    if (w.gtag && consent && consent.analytics) w.gtag("event", name, params || {});
    if (cfg.plausible && w.plausible) w.plausible(name, { props: params || {} });
  }
  d.addEventListener("click", function (e) {
    var el = e.target.closest("[data-event]"); if (!el) return;
    var p = {}; var loc = el.getAttribute("data-location"); if (loc) p.location = loc;
    var asset = el.getAttribute("data-asset"); if (asset) p.asset = asset;
    track(el.getAttribute("data-event"), p);
  });
  if (d.body.getAttribute("data-case")) track("case_view", { slug: d.body.getAttribute("data-case") });

  /* ---- UTM capture into forms ---- */
  var utm = {};
  try {
    var sp = new URLSearchParams(location.search), found = false;
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) { if (sp.get(k)) { utm[k] = sp.get(k); found = true; } });
    if (found) sessionStorage.setItem("utm", JSON.stringify(utm)); else utm = JSON.parse(sessionStorage.getItem("utm") || "{}");
  } catch (e) {}

  /* ---- Forms: Netlify Forms, Web3Forms, Formspree or HubSpot, chosen in site.config.json ---- */
  var topicParam = (function () { try { return new URLSearchParams(location.search).get("topic") || ""; } catch (e) { return ""; } })();
  qsa("form[data-provider]").forEach(function (form) {
    var provider = form.getAttribute("data-provider"); if (provider === "none") return;
    var status = qs(".form__status", form), success = qs("[data-success]", form.parentNode) || null;
    var btn = qs("button[type=submit]", form);
    /* Context fields: page, referrer, campaign, topic (from ?topic= on the service pages) */
    var setHidden = function (name, value) { var i = qs("input[type=hidden][name=" + name + "]", form); if (i && value) i.value = value; };
    setHidden("page", location.href); setHidden("referrer", d.referrer); setHidden("topic", topicParam);
    var auditType = qs("select[name=audit_type]", form); if (auditType && topicParam === "deck-audit-quarterly") auditType.value = "quarterly";
    Object.keys(utm).forEach(function (k) { setHidden(k, utm[k]); });
    var situation = qs("select[name=situation]", form);
    if (situation && topicParam && !situation.value) { var map = { pres: "reporting", me: "entering", adv: "raising" }; var key = map[topicParam.split("-")[0]]; if (key && qs("option[value=" + key + "]", situation)) situation.value = key; }
    function fieldError(input, show) {
      var field = input.closest(".field"); if (!field) return;
      field.classList.toggle("has-error", show);
      input.setAttribute("aria-invalid", show ? "true" : "false");
    }
    function validate() {
      var ok = true;
      qsa("[required]", form).forEach(function (inp) {
        var bad = inp.type === "checkbox" ? !inp.checked : inp.type === "email" ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value) : !inp.value.trim();
        fieldError(inp, bad); if (bad && ok) { inp.focus(); ok = false; }
      });
      var file = qs("input[type=file]", form);
      if (file && file.files && file.files[0] && file.files[0].size > 10 * 1024 * 1024) { fieldError(file, true); status.textContent = status.getAttribute("data-generic"); ok = false; }
      return ok;
    }
    qsa("[required]", form).forEach(function (inp) { inp.addEventListener("input", function () { fieldError(inp, false); }); inp.addEventListener("change", function () { fieldError(inp, false); }); });
    function done() {
      store("lastSubmit", String(Date.now()));
      track(form.getAttribute("data-event-name") || "form_submit", { type: form.getAttribute("data-form-type") || "contact" });
      form.hidden = true; if (success) { success.hidden = false; success.setAttribute("tabindex", "-1"); success.focus(); }
    }
    function fail() { status.textContent = status.getAttribute("data-generic"); btn.disabled = false; btn.textContent = btn.getAttribute("data-label"); }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (qs(".hp input", form) && qs(".hp input", form).value) return; // honeypot
      if (!validate()) return;
      var last = Number(store("lastSubmit") || 0); if (Date.now() - last < 15000) return; // client-side rate limit
      status.textContent = ""; btn.disabled = true; btn.textContent = btn.getAttribute("data-submitting");
      // an attached deck goes up first; the form then carries its reference
      var upField = qs("[data-upload-field]", form), upInput = upField && qs("input[data-upload]", upField), upFile = upInput && upInput.files && upInput.files[0];
      if (upFile) {
        var upErr = qs(".field__error", upField), errs = {}; try { errs = JSON.parse(upField.getAttribute("data-errors") || "{}"); } catch (x) {}
        var upFail = function (code) { upErr.textContent = errs[code] || errs.failed || ""; upField.classList.add("has-error"); btn.disabled = false; btn.textContent = btn.getAttribute("data-label"); };
        if (upFile.size > Number(upField.getAttribute("data-max-mb")) * 1048576) return upFail("too_large");
        if (!/\.(pptx|pdf)$/i.test(upFile.name)) return upFail("type");
        upField.classList.remove("has-error"); btn.textContent = upField.getAttribute("data-uploading");
        var tok = qs("input[name='cf-turnstile-response']", form);
        fetch("/api/upload", { method: "POST", body: upFile, headers: { "X-File-Name": encodeURIComponent(upFile.name), "X-Form": upInput.getAttribute("data-form") || "", "X-Turnstile-Token": tok ? tok.value : "", "Content-Type": "application/octet-stream" } })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || "failed"); return j; }); })
          .then(function (j) { setHidden("deck_upload", j.ref + " (" + j.name + ", " + (Math.round(j.size / 104857.6) / 10) + " MB)"); btn.textContent = btn.getAttribute("data-submitting"); send(); })
          .catch(function (e) { upFail(String(e.message)); });
        return;
      }
      send();
    });
    function send() {
      var req;
      if (provider === "netlify") {
        var fd = new FormData(form); fd.delete("website");
        var hasFile = qs("input[type=file]", form) && qs("input[type=file]", form).files.length > 0;
        req = fetch(form.getAttribute("action") || location.pathname, { method: "POST", body: hasFile ? fd : new URLSearchParams(fd) });
      } else if (provider === "web3forms") {
        var w3 = {}; new FormData(form).forEach(function (v, k) { if (k !== "website" && k !== "botcheck" && k !== "cf-turnstile-response" && typeof v === "string") w3[k] = v; });
        req = fetch(form.getAttribute("action"), { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(w3) })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j && j.success === true }; }); });
      } else if (provider === "formspree") {
        var payload = {}; new FormData(form).forEach(function (v, k) { if (k !== "website" && k !== "cf-turnstile-response" && typeof v === "string") payload[k] = v; });
        payload._language = lang;
        req = fetch(form.getAttribute("action"), { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      } else { /* hubspot */
        var portal = cfg.hubspotPortalId, guid = form.getAttribute("data-hubspot"), fields = [];
        qsa("input, select, textarea", form).forEach(function (inp) { if (!inp.name || inp.closest(".hp") || inp.type === "checkbox" || inp.type === "file" || inp.name === "form-name") return; fields.push({ name: inp.name === "name" ? "firstname" : inp.name, value: inp.value }); });
        var consentBox = qs("input[type=checkbox][name=consent]", form);
        var body = { fields: fields, context: { pageUri: location.href, pageName: d.title },
          legalConsentOptions: consentBox ? { consent: { consentToProcess: true, text: qs("label[for=" + consentBox.id + "]") ? qs("label[for=" + consentBox.id + "]").textContent.trim() : "", communications: [] } } : undefined };
        req = fetch("https://api.hsforms.com/submissions/v3/integration/submit/" + encodeURIComponent(portal) + "/" + encodeURIComponent(guid), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      req.then(function (r) { if (!r.ok) throw new Error(r.status); done(); }).catch(fail);
    }
  });

  /* ---- Before / after slider (range input = keyboard + touch) ---- */
  qsa(".ba").forEach(function (ba) {
    var r = qs(".ba__range", ba);
    function set() { ba.style.setProperty("--ba", r.value + "%"); }
    r.addEventListener("input", set); set();
  });

  /* ---- Work filters (client-side, URL-reflected) ---- */
  var grid = qs("[data-filter-grid]");
  if (grid) {
    var state = {}, params = new URLSearchParams(location.search);
    ["practice", "situation", "sector"].forEach(function (k) { if (params.get(k)) state[k] = params.get(k); });
    var cards = qsa("[data-practices]", grid), empty = qs("[data-filter-empty]"), count = qs("[data-filter-count]");
    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = true;
        if (state.practice && c.getAttribute("data-practices").split(" ").indexOf(state.practice) < 0) ok = false;
        if (state.situation && c.getAttribute("data-situation") !== state.situation) ok = false;
        if (state.sector && c.getAttribute("data-sector") !== state.sector) ok = false;
        c.hidden = !ok; if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0 || cards.length === 0;
      if (count) count.textContent = shown;
      qsa(".chip[data-filter]").forEach(function (ch) {
        var k = ch.getAttribute("data-filter"), v = ch.getAttribute("data-value");
        ch.setAttribute("aria-pressed", String((state[k] || "") === v));
      });
      var sp = new URLSearchParams(); Object.keys(state).forEach(function (k) { sp.set(k, state[k]); });
      history.replaceState(null, "", location.pathname + (sp.toString() ? "?" + sp : ""));
    }
    qsa(".chip[data-filter]").forEach(function (ch) {
      ch.addEventListener("click", function () {
        var k = ch.getAttribute("data-filter"), v = ch.getAttribute("data-value");
        if (!v || state[k] === v) delete state[k]; else state[k] = v; apply();
      });
    });
    qsa("[data-filter-clear]").forEach(function (b) { b.addEventListener("click", function () { state = {}; apply(); }); });
    apply();
  }

  /* ---- Copy link ---- */
  qsa("[data-copy-link]").forEach(function (b) {
    b.addEventListener("click", function () {
      navigator.clipboard && navigator.clipboard.writeText(location.href).then(function () { var t = b.textContent; b.textContent = b.getAttribute("data-copied"); setTimeout(function () { b.textContent = t; }, 2000); });
    });
  });

  /* ---- Dev-only creative route toggle ---- */
  var rt = qs(".route-toggle");
  if (rt) {
    var saved = store("route"); if (saved) d.documentElement.setAttribute("data-route", saved);
    rt.addEventListener("click", function () {
      var cur = d.documentElement.getAttribute("data-route") === "boardroom" ? "journal" : "boardroom";
      d.documentElement.setAttribute("data-route", cur); store("route", cur);
    });
  }
})();

/* ---- Hero: video background (desktop, not reduced motion) and live slide fan ---- */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hv = document.querySelector(".hero-video");
  if (hv && !reduced) {
    var video = hv.querySelector("video");
    var wide = window.matchMedia("(min-width: 768px)").matches;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (video && !saveData) {
      var src = document.createElement("source");
      src.src = hv.getAttribute(wide ? "data-video-mp4" : "data-video-mp4-small"); src.type = "video/mp4";
      video.appendChild(src); video.load();
      var p = video.play(); if (p && p.then) p.then(function () { hv.classList.add("is-playing"); }).catch(function () {});
      video.addEventListener("playing", function () { hv.classList.add("is-playing"); });
      document.addEventListener("visibilitychange", function () { document.hidden ? video.pause() : video.play().catch(function () {}); });
    }
  }
  var fan = document.querySelector(".fan--live");
  if (fan && !reduced) {
    var cards = Array.prototype.slice.call(fan.querySelectorAll(".fan__card"));
    var order = cards.map(function (_, i) { return i; }); // order[pos] = card index
    function apply() { order.forEach(function (ci, pos) { cards[ci].className = "fan__card pos-" + (pos + 1); }); }
    var phoneFan = window.matchMedia && window.matchMedia("(max-width: 767.98px)").matches;
    setTimeout(function () {
      apply(); fan.classList.add("is-cycling");
      if (!phoneFan) setInterval(function () { order.unshift(order.pop()); apply(); }, 4200); /* phones keep a fixed composition that breathes */
    }, 2200);
  }
})();

/* ---- Flag language selector ---- */
(function () {
  var sels = Array.prototype.slice.call(document.querySelectorAll("[data-langsel]"));
  if (!sels.length) return;
  function close(sel) { var b = sel.querySelector(".langsel__btn"), m = sel.querySelector(".langsel__menu"); b.setAttribute("aria-expanded", "false"); m.hidden = true; }
  sels.forEach(function (sel) {
    var btn = sel.querySelector(".langsel__btn"), menu = sel.querySelector(".langsel__menu");
    btn.addEventListener("click", function (e) {
      e.stopPropagation(); var open = btn.getAttribute("aria-expanded") === "true";
      sels.forEach(close); if (!open) { btn.setAttribute("aria-expanded", "true"); menu.hidden = false; var first = menu.querySelector("a:not(.is-current)"); first && first.focus(); }
    });
    sel.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(sel); btn.focus(); } });
  });
  document.addEventListener("click", function (e) { if (!e.target.closest("[data-langsel]")) sels.forEach(close); });
})();

// Dropdown navigation: hover/focus reveals the practice panel (CSS); hovering a service swaps the description; phones use an accordion.
(function () {
  var d = document;
  d.querySelectorAll("[data-mm]").forEach(function (panel) {
    var items = panel.querySelectorAll("[data-mm-item]"), descs = panel.querySelectorAll("[data-mm-desc]");
    function activate(key) {
      items.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("data-mm-item") === key); });
      descs.forEach(function (el) { el.classList.toggle("is-active", el.getAttribute("data-mm-desc") === key); });
    }
    items.forEach(function (a) {
      ["mouseenter", "focus"].forEach(function (ev) { a.addEventListener(ev, function () { activate(a.getAttribute("data-mm-item")); }); });
    });
  });
  d.querySelectorAll(".nav__sub-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      btn.closest(".practice-menu").classList.toggle("is-open", !open);
    });
  });
  d.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { var a = d.activeElement; if (a && a.closest(".practice-menu")) { a.closest(".practice-menu").querySelector(".nav__link").focus(); } }
  });
})();

// Phone folder view of the services: tabs, prev/next, swipe
(function () {
  document.querySelectorAll("[data-folder]").forEach(function (root) {
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]')), panels = [].slice.call(root.querySelectorAll('[role="tabpanel"]'));
    var cur = root.querySelector("[data-folder-current]"), i = 0;
    function show(n, focus) {
      i = (n + tabs.length) % tabs.length;
      tabs.forEach(function (t, k) { var on = k === i; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; });
      panels.forEach(function (p, k) { var on = k === i; p.classList.toggle("is-active", on); p.hidden = !on; });
      if (cur) cur.textContent = String(i + 1).padStart(2, "0");
      tabs[i].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, k) {
      t.addEventListener("click", function () { show(k); });
      t.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1, true); } if (e.key === "ArrowLeft") { e.preventDefault(); show(i - 1, true); } });
    });
    var prev = root.querySelector("[data-folder-prev]"), next = root.querySelector("[data-folder-next]");
    if (prev) prev.addEventListener("click", function () { show(i - 1); });
    if (next) next.addEventListener("click", function () { show(i + 1); });
    var sheet = root.querySelector(".svc-folder__sheet"), x0 = null;
    if (sheet) {
      sheet.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      sheet.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 48) show(dx < 0 ? i + 1 : i - 1); }, { passive: true });
    }
  });
})();

// Phones: sticky "Talk to Our Team" bar after the hero, hidden near the closing band and footer and while the menu is open
(function () {
  var bar = document.querySelector("[data-sticky-cta]"); if (!bar) return;
  var mq = window.matchMedia("(max-width: 767.98px)"), nearEnd = false;
  var ends = document.querySelectorAll(".cta-band, .footer");
  if ("IntersectionObserver" in window) {
    var seen = new Set();
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? seen.add(e.target) : seen.delete(e.target); }); nearEnd = seen.size > 0; update(); }, { rootMargin: "0px 0px 120px 0px" });
    ends.forEach(function (el) { io.observe(el); });
  }
  function update() {
    var show = mq.matches && window.scrollY > 560 && !nearEnd && !document.body.classList.contains("menu-open");
    bar.hidden = !show; document.body.classList.toggle("has-sticky-cta", show);
  }
  window.addEventListener("scroll", update, { passive: true }); mq.addEventListener("change", update);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  update();
})();
// Phones: collapse long body copy behind "Read more"
(function () {
  var mq = window.matchMedia("(max-width: 767.98px)");
  document.querySelectorAll("[data-readmore]").forEach(function (box) {
    if (!mq.matches || box.scrollHeight < 560) return;
    box.classList.add("is-collapsed");
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "readmore"; btn.textContent = box.getAttribute("data-more"); btn.setAttribute("aria-expanded", "false");
    box.insertAdjacentElement("afterend", btn);
    btn.addEventListener("click", function () { var open = box.classList.toggle("is-collapsed") === false; btn.textContent = box.getAttribute(open ? "data-less" : "data-more"); btn.setAttribute("aria-expanded", open ? "true" : "false"); });
  });
})();

/* ---- Phones (≤767px): scroll reveal, hero parallax ---- */
(function () {
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phone = window.matchMedia && window.matchMedia("(max-width: 767.98px)");
  if (!phone || !phone.matches || reduced) return;
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* Reveal: elements outside the existing fade-up / stagger groups, staggered among siblings */
  var sel = ".svc-head > div, .svc-head .pillars, .arch__points li, .ai-steps li, .ai-band .guard, .section-head, .svc4-head, .id-band__copy > *, .adv-nav__tile, section[aria-labelledby='insight-title'] .col-6, .fact, .fact--stack > div, .svc-artefact__copy, .svc-rel__copy, .ccard, .icard, .deck-hero, .cta-band__text > *, .footer__brand, .about-story__body, .hub-hero > .wrap > *, .svc-hero__copy > *, .page-hero > .wrap > *";
  var targets = qsa(sel).filter(function (el) { return !el.closest(".stagger, .fade-up, .hero-stage"); });
  var groups = new Map();
  targets.forEach(function (el) { var k = el.parentNode; if (!groups.has(k)) groups.set(k, 0); el.style.setProperty("--i", groups.get(k)); groups.set(k, groups.get(k) + 1); el.classList.add("m-reveal"); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  } else targets.forEach(function (el) { el.classList.add("is-in"); });
  /* Hero parallax: background drifts slower than the page, text lifts and fades */
  var bg = document.querySelector(".hero-bg__img"), text = document.querySelector(".hero-stage__text"), hero = document.querySelector(".hero-stage");
  if (bg && hero) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var y = window.scrollY, h = hero.offsetHeight;
      if (y > h) return;
      bg.style.transform = "translate3d(0," + Math.round(y * 0.28) + "px,0)";
      if (text) { text.style.transform = "translate3d(0," + Math.round(y * 0.14) + "px,0)"; text.style.opacity = String(Math.max(0, 1 - y / 520)); }
    };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
})();

/* ---- Phones (≤767px): practice tabs, approach tabs, principle highlight ---- */
(function () {
  var phone = window.matchMedia && window.matchMedia("(max-width: 767.98px)");
  if (!phone || !phone.matches) return;
  var qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* Advisory practice tabs */
  qsa("[data-advtabs]").forEach(function (root) {
    var tabs = qsa(".adv-tabs__tab", root), panels = qsa(".adv-tabs__panel", root);
    function select(i) {
      tabs.forEach(function (t, k) { t.classList.toggle("is-active", k === i); t.setAttribute("aria-selected", String(k === i)); });
      panels.forEach(function (p, k) { if (k === i) { p.hidden = false; p.classList.add("is-active"); p.classList.remove("is-entering"); void p.offsetWidth; p.classList.add("is-entering"); } else { p.hidden = true; p.classList.remove("is-active", "is-entering"); } });
    }
    tabs.forEach(function (t, i) { t.addEventListener("click", function () { select(i); }); t.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { var n = (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length; select(n); tabs[n].focus(); } }); });
  });
  /* How we work: two columns as tabs */
  qsa(".approach2").forEach(function (root) {
    var bar = root.previousElementSibling; if (!bar || !bar.classList.contains("approach2__tabs")) return;
    var tabs = qsa(".approach2__tab", bar), cols = qsa(".approach2__col", root);
    root.classList.add("has-tabs");
    function select(i) { tabs.forEach(function (t, k) { t.classList.toggle("is-active", k === i); t.setAttribute("aria-selected", String(k === i)); }); cols.forEach(function (c, k) { c.classList.toggle("is-active", k === i); c.classList.remove("is-entering"); if (k === i) { void c.offsetWidth; c.classList.add("is-entering"); } }); }
    select(0);
    tabs.forEach(function (t, i) { t.addEventListener("click", function () { select(i); }); });
  });
  /* Core-practice principles: one card lit at a time until the reader taps */
  var pts = qsa(".arch__points li");
  if (pts.length && !(window.matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    var cur = 0, timer = null, manual = false;
    function light(i) { pts.forEach(function (li, k) { li.classList.toggle("is-hot", k === i); }); }
    function start() { if (timer || manual) return; light(cur); timer = setInterval(function () { cur = (cur + 1) % pts.length; light(cur); }, 2800); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    pts.forEach(function (li, i) { li.addEventListener("click", function () { manual = true; stop(); cur = i; light(i); }); });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? start() : stop(); }); }, { threshold: 0.4 });
      io.observe(pts[0].parentNode);
    } else start();
  }
})();

/* ---- Service finder ---- */
(function () {
  var roots = Array.prototype.slice.call(document.querySelectorAll("[data-finder]"));
  roots.forEach(function (root) {
    var data; try { data = JSON.parse(root.getAttribute("data-finder")); } catch (e) { return; }
    var form = root.querySelector(".finder__form"), empty = root.querySelector(".finder__empty"), cards = root.querySelector(".finder__cards");
    var primary = root.querySelector("[data-primary]"), alt = root.querySelector("[data-alt]"), altLabel = root.querySelector("[data-alt-label]"), talk = root.querySelector("[data-talk]");
    var talkBase = talk.getAttribute("href");
    function answers() { var a = {}; ["audience", "output", "timing"].forEach(function (k) { var c = form.querySelector("input[name=" + k + "]:checked"); if (c) a[k] = c.value; }); return a; }
    function fill(card, s) { card.href = s.url; card.querySelector("strong").textContent = s.title; card.querySelector("span").textContent = s.line; }
    function update() {
      var a = answers(), n = Object.keys(a).length;
      if (n < 3) { cards.hidden = true; empty.hidden = false; return; }
      var scored = data.map(function (s) { var sc = 0; if (s.tags.output.indexOf(a.output) >= 0) sc += 3; if (s.tags.audience.indexOf(a.audience) >= 0) sc += 2; if (s.tags.timing.indexOf(a.timing) >= 0) sc += 1; return { s: s, sc: sc }; }).sort(function (x, y) { return y.sc - x.sc; });
      fill(primary, scored[0].s);
      if (scored[1] && scored[1].sc > 0) { fill(alt, scored[1].s); alt.hidden = false; altLabel.hidden = false; } else { alt.hidden = true; altLabel.hidden = true; }
      talk.href = talkBase.replace(/\?topic=[^#]*/, "").replace("#", "?topic=" + encodeURIComponent(scored[0].s.key) + "#");
      empty.hidden = true; cards.hidden = false; cards.classList.remove("is-in"); void cards.offsetWidth; cards.classList.add("is-in");
    }
    form.addEventListener("change", update);
    var reset = root.querySelector("[data-finder-reset]");
    if (reset) reset.addEventListener("click", function () { Array.prototype.forEach.call(form.querySelectorAll("input[type=radio]"), function (r) { r.checked = false; }); update(); });
  });
})();
