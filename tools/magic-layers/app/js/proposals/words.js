// Proposal kit — amounts in figures and in words. Indonesian agreements state the fee in words as well
// ("terbilang"), and an English one reads better with it too.

const ID_ONES = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function idBelow1000(n) {
  if (n < 12) return ID_ONES[n];
  if (n < 20) return `${ID_ONES[n - 10]} belas`;
  if (n < 100) return `${ID_ONES[Math.floor(n / 10)]} puluh${n % 10 ? ` ${ID_ONES[n % 10]}` : ""}`;
  const h = Math.floor(n / 100), r = n % 100;
  return `${h === 1 ? "seratus" : `${ID_ONES[h]} ratus`}${r ? ` ${idBelow1000(r)}` : ""}`;
}
// 1 → satu, 1.000 → seribu, 2.500.000.000 → dua miliar lima ratus juta
export function terbilang(value) {
  let n = Math.floor(Math.abs(Number(value) || 0)); if (!n) return "nol";
  const scales = [[1e12, "triliun"], [1e9, "miliar"], [1e6, "juta"], [1e3, "ribu"]], out = [];
  for (const [size, word] of scales) { const k = Math.floor(n / size); if (k) { out.push(size === 1e3 && k === 1 ? "seribu" : `${idBelow1000(k)} ${word}`); n %= size; } }
  if (n) out.push(idBelow1000(n));
  return out.join(" ");
}

const EN_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function enBelow1000(n, joinAnd) {
  const h = Math.floor(n / 100), r = n % 100, parts = [];
  if (h) parts.push(`${EN_ONES[h]} hundred`);
  if (r) { const t = r < 20 ? EN_ONES[r] : `${EN_TENS[Math.floor(r / 10)]}${r % 10 ? `-${EN_ONES[r % 10]}` : ""}`; parts.push(h || joinAnd ? `and ${t}` : t); }
  return parts.join(" ");
}
// British usage: 15,250,000 → fifteen million, two hundred and fifty thousand
export function inWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0)); if (!n) return "zero";
  const scales = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]], out = [];
  for (const [size, word] of scales) { const k = Math.floor(n / size); if (k) { out.push(`${enBelow1000(k, false)} ${word}`); n %= size; } }
  if (n) out.push(enBelow1000(n, out.length > 0));
  return out.join(" ");
}

export const CURRENCIES = {
  IDR: { symbol: "Rp", decimals: 0, en: "rupiah", id: "rupiah" },
  USD: { symbol: "US$", decimals: 0, en: "US dollars", id: "dolar Amerika Serikat" },
};

// Rp 15,000,000 (English) · Rp 15.000.000 (Indonesian)
export function money(value, currency = "IDR", lang = "en") {
  const c = CURRENCIES[currency] || CURRENCIES.IDR, n = Math.round(Number(value) || 0);
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === "id" ? "." : ",");
  return `${n < 0 ? "-" : ""}${c.symbol} ${digits}`;
}
export function moneyWords(value, currency = "IDR", lang = "en") {
  const c = CURRENCIES[currency] || CURRENCIES.IDR;
  return lang === "id" ? `${terbilang(value)} ${c.id}` : `${inWords(value)} ${c.en}`;
}
// "15.000.000", "15,000,000", "Rp 15 000 000" → 15000000. Decimals are not used for fees.
export function parseAmount(text) { const d = String(text ?? "").replace(/[^\d]/g, ""); return d ? Number(d) : 0; }
