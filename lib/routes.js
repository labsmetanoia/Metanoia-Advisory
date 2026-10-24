// Single source of truth for URL structure: two parallel language trees with translated slugs.
export const langs = ["id", "en"];

export const routes = {
  home: { en: "", id: "" },
  about: { en: "about", id: "tentang" },
  people: { en: "people", id: "tim" },
  marketEntry: { en: "indonesia-market-entry", id: "masuk-pasar-indonesia" },
  advisory: { en: "advisory", id: "strategi-investasi" },
  presentation: { en: "strategic-storytelling", id: "storytelling-strategis" },
  insights: { en: "insights", id: "wawasan" },
  contact: { en: "contact", id: "kontak" },
  legal: { en: "legal", id: "legal" },
  privacy: { en: "privacy", id: "privasi" },
  terms: { en: "terms", id: "ketentuan" },
  conflicts: { en: "conflicts-and-confidentiality", id: "konflik-dan-kerahasiaan" },
};

const seg = (s) => (s ? `${s}/` : "");

export function pageUrl(key, lang) {
  if (!(key in routes)) throw new Error(`Unknown route key: ${key}`);
  return `/${lang}/${seg(routes[key][lang])}`;
}
export function itemUrl(type, item, lang) {
  return `/${lang}/${seg(routes[type][lang])}${seg(item.slug[lang])}`;
}
export function serviceUrl(service, lang) {
  return `/${lang}/${seg(routes[service.practice][lang])}${seg(service.slug[lang])}`;
}
export function legalUrl(key, lang) {
  return `/${lang}/${seg(routes.legal[lang])}${seg(routes[key][lang])}`;
}
export function altUrl(url, fromLang, toLang) {
  return url.replace(new RegExp(`^/${fromLang}/`), `/${toLang}/`);
}
