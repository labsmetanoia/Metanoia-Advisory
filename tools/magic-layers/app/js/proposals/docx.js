// Proposal kit — the same document as a Word file, for counsel and for clients who mark up in Word.
// Written directly as Office Open XML with JSZip: headings, paragraphs, lists, tables, a footer with page numbers,
// and for a bilingual letter a two-column table with Indonesian on the left and English on the right.
import { buildBlocks, langsOf, LABELS } from "./doc.js";

const X = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PAGE_W = 11906, PAGE_H = 16838, MARGIN_X = 907, MARGIN_TOP = 1020, MARGIN_BOTTOM = 1134, BODY_W = PAGE_W - 2 * MARGIN_X, GAP = 360;
const GOLD = "C09200", GOLD_TEXT = "7A5B00", GREY = "6B6862", LINE = "E3DED3", RED = "B3402F";

function run(text, o = {}) {
  const pr = [o.font ? `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>` : "", o.b ? "<w:b/>" : "", o.i ? "<w:i/>" : "", o.caps ? "<w:caps/>" : "", o.color ? `<w:color w:val="${o.color}"/>` : "", o.spacing ? `<w:spacing w:val="${o.spacing}"/>` : "", o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""].join("");
  return String(text).split("\n").map((t, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ""}<w:t xml:space="preserve">${X(t)}</w:t></w:r>`).join("");
}
function para(runs, o = {}) {
  const pr = [o.style ? `<w:pStyle w:val="${o.style}"/>` : "", o.keep ? "<w:keepNext/>" : "", o.keepLines ? "<w:keepLines/>" : "",
    o.border ? `<w:pBdr>${o.border}</w:pBdr>` : "", o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : "",
    o.spacing ? `<w:spacing ${o.spacing}/>` : "", o.ind ? `<w:ind ${o.ind}/>` : "", o.align ? `<w:jc w:val="${o.align}"/>` : ""].join("");
  return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ""}${runs}</w:p>`;
}
const cellXml = (content, w, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${Math.round(w)}" w:type="dxa"/>${o.borders ? `<w:tcBorders>${o.borders}</w:tcBorders>` : ""}${o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade}"/>` : ""}<w:tcMar><w:top w:w="${o.padY ?? 60}" w:type="dxa"/><w:bottom w:w="${o.padY ?? 60}" w:type="dxa"/><w:left w:w="${o.padX ?? 80}" w:type="dxa"/><w:right w:w="${o.padX ?? 80}" w:type="dxa"/></w:tcMar></w:tcPr>${content || "<w:p/>"}</w:tc>`;
function table(rows, widths, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${Math.round(total)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${Math.round(w)}"/>`).join("")}</w:tblGrid>`
    + rows.map((r) => `<w:tr>${o.header && r === rows[0] ? "<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>" : "<w:trPr><w:cantSplit/></w:trPr>"}${r.map((c, i) => cellXml(c.xml, widths[i], c)).join("")}</w:tr>`).join("") + "</w:tbl>";
}
const bottom = (color = LINE, sz = 4) => `<w:bottom w:val="single" w:sz="${sz}" w:space="0" w:color="${color}"/>`;
const top = (color = "111111", sz = 8) => `<w:top w:val="single" w:sz="${sz}" w:space="0" w:color="${color}"/>`;

// one block, laid out for a column `width` twips wide
function blockXml(b, width) {
  switch (b.t) {
    case "h": return para(run(b.text), { style: "Heading1", keep: true });
    case "sub": return para(run(b.text), { style: "Heading3", keep: true });
    case "p": return para(run(b.text, b.em ? { i: true, color: "44423E" } : {}));
    case "list": return b.items.map((t) => para(run(`•\t${t}`), { style: "ListPara" })).join("");
    case "clause": return para(run(`${b.n} ${b.title}. `, { b: true }) + run(b.text), { keepLines: true });
    case "table": {
      const widths = b.widths.map((w) => (w / 100) * width), al = (i) => ({ right: "right" }[(b.align || [])[i]] || "left"), rows = [];
      if (b.head) rows.push(b.head.map((h, i) => ({ xml: para(run(h, { b: true, caps: true, sz: 15, color: GREY, spacing: 6 }), { align: al(i), spacing: 'w:before="0" w:after="0"' }), borders: bottom("CFC7B8", 8) })));
      // the fee table stays on one page: every row but the last keeps with the next
      b.rows.forEach((r, ri) => { const tot = b.total && ri === b.rows.length - 1, keep = Boolean(b.total) && ri < b.rows.length - 1; rows.push(r.map((c, i) => ({ xml: para(run(c, tot ? { b: true } : {}), { align: al(i), keep, spacing: 'w:before="0" w:after="0"' }), borders: tot ? top() : bottom() }))); });
      return table(rows, widths, { header: Boolean(b.head) }) + para("", { spacing: 'w:before="0" w:after="60"' });
    }
    default: return "";
  }
}
function coverXml(c, c2) {
  const meta = c2 ? c.meta.map((m, i) => [`${m[0]} / ${c2.meta[i] ? c2.meta[i][0] : ""}`, m[1] === (c2.meta[i] || [])[1] ? m[1] : `${m[1]} / ${(c2.meta[i] || [])[1] || ""}`]) : c.meta;
  let x = para(run("Metanoia", { font: "Georgia", b: true, sz: 34 }) + run("  |  ", { color: GOLD, sz: 28 }) + run("Advisory", { caps: true, sz: 14, spacing: 60, b: true }), { spacing: 'w:after="360"' });
  x += para(run(c2 ? `${c.kicker} · ${c2.kicker}` : c.kicker, { caps: true, b: true, sz: 16, color: GOLD_TEXT, spacing: 24 }), { spacing: 'w:after="80"' });
  x += para(run(c.title), { style: "Title" });
  if (c2) x += para(run(c2.title, { font: "Georgia", sz: 28, color: "55524C" }), { spacing: 'w:after="160"' });
  x += table(meta.map((m) => [{ xml: para(run(m[0], { caps: true, b: true, sz: 15, color: GREY, spacing: 6 }), { spacing: 'w:before="0" w:after="0"' }), padY: 30 }, { xml: para(run(m[1]), { spacing: 'w:before="0" w:after="0"' }), padY: 30 }]), [BODY_W * 0.36, BODY_W * 0.64]);
  if (c.draft) x += para(run(c2 ? `${c.draft}\n${c2.draft}` : c.draft, { sz: 17, color: "5C1F15" }), { shade: "FBEDE9", border: `<w:left w:val="single" w:sz="18" w:space="6" w:color="${RED}"/>`, spacing: 'w:before="200" w:after="0"' });
  x += para("", { border: bottom(GOLD, 12), spacing: 'w:before="120" w:after="240"' });
  return x;
}
function signXml(g, g2) {
  const lab = (k) => (g2 ? `${g.L[k]} / ${g2.L[k]}` : g.L[k]), half = (BODY_W - GAP) / 2;
  const cell = (x, i) => {
    let c = para(run(x.label, { b: true }) + (g2 ? run(`\n${g2.parties[i].label}`, { color: "55524C" }) : ""), { keep: true });
    if (g.meterai || (g2 && g2.meterai)) c += table([[{ xml: para(run(lab("meterai"), { sz: 14, color: GREY }), { align: "center", spacing: 'w:before="200" w:after="200"' }), borders: ["top", "left", "bottom", "right"].map((s) => `<w:${s} w:val="dashed" w:sz="4" w:space="0" w:color="9A948A"/>`).join("") }]], [1700]);
    else c += para("", { spacing: 'w:before="600"' });
    c += para(run(lab("sign"), { sz: 15, color: GREY }), { border: top("111111", 6), spacing: 'w:before="240" w:after="120"' });
    for (const [k, v] of [["name", x.name], ["title", x.title], ["date", ""]]) c += para(run(`${lab(k)}: `, { sz: 15, color: GREY }) + run(v || ""), { border: bottom("B9B4A8", 4), spacing: 'w:before="80" w:after="40"' });
    return c;
  };
  return table([g.parties.map((x, i) => ({ xml: cell(x, i), padX: 0 })).flatMap((c, i) => (i ? [{ xml: "<w:p/>" }, c] : [c]))], [half, GAP, half]);
}

export function documentXml(p, s) {
  const langs = langsOf(p.mode), models = langs.map((l) => buildBlocks(p, s, l)), a = models[0], b = models[1] || null, half = (BODY_W - GAP) / 2;
  let body = "", pairs = [];
  const flush = () => { if (pairs.length) { body += table(pairs.map(([x, y]) => [{ xml: blockXml(x, half - 80), padX: 0 }, { xml: "<w:p/>" }, { xml: blockXml(y, half - 80), padX: 0 }]), [half, GAP, half]); pairs = []; } };
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b ? b[i] : null;
    if (x.t === "cover") { flush(); body += coverXml(x, y); }
    else if (x.t === "sign") { flush(); body += signXml(x, y); }
    else if (!y) body += blockXml(x, BODY_W);
    else pairs.push([x, y]);
  }
  flush();
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${MARGIN_TOP}" w:right="${MARGIN_X}" w:bottom="${MARGIN_BOTTOM}" w:left="${MARGIN_X}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function footerXml(p, s) {
  const langs = langsOf(p.mode), L = LABELS[langs[0]], L2 = langs[1] ? LABELS[langs[1]] : null, firm = s.legalName || s.tradingName;
  const text = `${firm} · ${p.ref} · ${L.footer}${L2 ? ` / ${L2.footer}` : ""}${s.reviewed ? "" : ` · ${L2 ? "DRAF / DRAFT" : p.mode === "id" ? "DRAF" : "DRAFT"}`} · ${L.page}${L2 ? ` / ${L2.page}` : ""} `;
  const o = { sz: 15, color: GREY };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${para(run(text, o) + `<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:sz w:val="15"/><w:color w:val="${GREY}"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>`, { border: `<w:top w:val="single" w:sz="4" w:space="6" w:color="${LINE}"/>` })}</w:ftr>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="en-GB" w:eastAsia="en-GB" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="100" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="3" w:color="${LINE}"/></w:pBdr><w:spacing w:before="320" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListPara"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="left" w:pos="300"/></w:tabs><w:spacing w:after="40"/><w:ind w:left="300" w:hanging="300"/></w:pPr></w:style>
</w:styles>`;

// JSZip: the constructor (window.JSZip in the browser, require("jszip") in Node)
export function proposalDocx(p, s, JSZip) {
  const z = new JSZip(), title = buildBlocks(p, s, langsOf(p.mode)[0])[0].title, now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
  z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  z.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  z.file("word/document.xml", documentXml(p, s));
  z.file("word/styles.xml", STYLES);
  z.file("word/settings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
  z.file("word/footer1.xml", footerXml(p, s));
  z.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title)}</dc:title><dc:creator>${X(s.legalName || s.tradingName)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  z.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Metanoia Proposal Kit</Application></Properties>`);
  return z;
}
