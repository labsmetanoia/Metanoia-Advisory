/* Metanoia Advisory — site script. No dependencies. Budget: < 15 KB.
   Responsibilities: menu, compact header, fade-up, language preference, consent gating,
   GA4/LinkedIn loading after consent, event tracking, forms (HubSpot v3), before/after slider, Work filters. */
(function () {
  "use strict";
  var cfg = window.__SITE__ || {};
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
    w.matchMedia("(min-width: 1200px)").addEventListener("change", function (e) { if (e.matches) setMenu(false); });
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

  /* ---- Event tracking ---- */
  function track(name, params) { if (w.gtag && consent && consent.analytics) w.gtag("event", name, params || {}); }
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

  /* ---- Forms → HubSpot Forms API v3 ---- */
  qsa("form[data-hubspot]").forEach(function (form) {
    var portal = cfg.hubspotPortalId, guid = form.getAttribute("data-hubspot");
    var status = qs(".form__status", form), success = qs("[data-success]", form.parentNode) || null;
    var btn = qs("button[type=submit]", form);
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
      return ok;
    }
    qsa("[required]", form).forEach(function (inp) { inp.addEventListener("input", function () { fieldError(inp, false); }); inp.addEventListener("change", function () { fieldError(inp, false); }); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (qs(".hp input", form) && qs(".hp input", form).value) return; // honeypot
      if (!validate()) return;
      var last = Number(store("lastSubmit") || 0); if (Date.now() - last < 15000) return; // client-side rate limit
      var fields = [];
      qsa("input, select, textarea", form).forEach(function (inp) {
        if (!inp.name || inp.closest(".hp") || inp.type === "checkbox") return;
        fields.push({ name: inp.name, value: inp.value });
      });
      Object.keys(utm).forEach(function (k) { fields.push({ name: k, value: utm[k] }); });
      fields.push({ name: "site_language", value: lang });
      var consentBox = qs("input[type=checkbox][name=consent]", form);
      var body = { fields: fields, context: { pageUri: location.href, pageName: d.title },
        legalConsentOptions: consentBox ? { consent: { consentToProcess: true, text: qs("label[for=" + consentBox.id + "]") ? qs("label[for=" + consentBox.id + "]").textContent.trim() : "", communications: [] } } : undefined };
      btn.disabled = true; btn.textContent = btn.getAttribute("data-submitting");
      fetch("https://api.hsforms.com/submissions/v3/integration/submit/" + encodeURIComponent(portal) + "/" + encodeURIComponent(guid), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); store("lastSubmit", String(Date.now()));
        track(form.getAttribute("data-event-name") || "form_submit", { type: form.getAttribute("data-form-type") || "contact" });
        form.hidden = true; if (success) { success.hidden = false; success.focus && success.setAttribute("tabindex", "-1"); success.focus(); } })
      .catch(function () { status.textContent = status.getAttribute("data-generic"); btn.disabled = false; btn.textContent = btn.getAttribute("data-label"); });
    });
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
    setTimeout(function () {
      apply(); fan.classList.add("is-cycling");
      setInterval(function () { order.unshift(order.pop()); apply(); }, 4200);
    }, 2200);
  }
})();
