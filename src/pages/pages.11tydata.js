import { pageUrl, itemUrl, serviceUrl, legalUrl, langs } from "../../lib/routes.js";

// Central routing + SEO computation for every paginated template.
// Each template paginates over an array of objects with a `lang` property, aliased as `p`.
function urlFor(data, lang) {
  const p = data.p;
  switch (data.pageKey) {
    case "hub": return pageUrl(p.practice.key, lang);
    case "service": return serviceUrl(p.service, lang);
    case "person": return itemUrl("people", p.person, lang);
    case "article": return itemUrl("insights", p.item, lang);
    case "legal": return legalUrl(p.key, lang);
    case "notfound": return `/${lang}/404.html`;
    default: return pageUrl(data.pageKey, lang);
  }
}
const L = (v, lang) => (v && typeof v === "object" && lang in v ? v[lang] : v);

// Templates without pagination (root chooser, root 404, sitemap) set their own permalink/layout and skip this.
const guard = (fn) => (data) => (data.p ? fn(data) : undefined);

export default {
  eleventyComputed: {
    layout: (data) => (data.p ? "layouts/base.njk" : data.layout),
    lang: (data) => data.p?.lang,
    permalink: (data) => (data.p ? urlFor(data, data.p.lang) : data.permalink),
    alternates: guard((data) => Object.fromEntries(langs.map((l) => [l, urlFor(data, l)]))),
    activeNav: guard((data) => {
      const p = data.p;
      if (data.pageKey === "hub") return p.practice.key;
      if (data.pageKey === "service") return p.service.practice;
      if (data.pageKey === "person") return "about";
      if (data.pageKey === "article") return "insights";
      return data.pageKey;
    }),
    pageTitle: guard((data) => {
      const { p, pages, site, ui } = data; const lang = p.lang; const name = site.name;
      switch (data.pageKey) {
        case "home": return `${name} — ${L(pages.home.seoTitle, lang)}`;
        case "hub": return `${L(site.practiceNames[p.practice.key], lang)} — ${name}`;
        case "service": return `${L(p.service.title, lang)} — ${L(site.practiceNames[p.service.practice], lang)} — ${name}`;
        case "person": return `${p.person.name} — ${L(p.person.role, lang)} — ${name}`;
        case "article": return `${L(p.item.title, lang)} — ${name}`;
        case "legal": return `${L(pages.legal[p.key].title, lang)} — ${name}`;
        case "notfound": return `404 — ${name}`;
        default: return `${L(pages[data.pageKey].seoTitle, lang)} — ${name}`;
      }
    }),
    pageDescription: guard((data) => {
      const { p, pages } = data; const lang = p.lang;
      switch (data.pageKey) {
        case "hub": return L(pages.hubs[p.practice.key].metaDescription, lang);
        case "service": return L(p.service.metaDescription, lang);
        case "person": return L(p.person.summary, lang);
        case "article": return L(p.item.metaDescription, lang);
        case "legal": return L(pages.legal[p.key].metaDescription, lang);
        case "notfound": return "";
        default: return L(pages[data.pageKey].metaDescription, lang);
      }
    }),
    noindex: guard((data) => data.pageKey === "notfound" || Boolean(data.p?.item?.draft || data.p?.person?.draft)),
    ogType: guard((data) => (["article"].includes(data.pageKey) ? "article" : "website")),
    ogImage: guard((data) => {
      const map = { home: "home", hub: "hub", service: "service", article: "insight", person: "person" };
      return `/assets/img/og/og-${map[data.pageKey] || "default"}.png`;
    }),
  },
};
