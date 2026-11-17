// Deck Auditor — reads a PowerPoint file into a plain deck model (slides → shapes → paragraphs → runs),
// resolving what the checks need: placeholder roles, positions, typefaces, sizes, colours, tables, charts, pictures.
// Units are points (1 pt = 12,700 EMU). Everything happens in the browser; the file is not uploaded.
const EMU = 12700;
const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
const kids = (el, name) => (el ? [...el.children].filter((c) => c.localName === name) : []);
const kid = (el, name) => (el ? [...el.children].find((c) => c.localName === name) || null : null);
const dig = (el, ...names) => names.reduce((e, n) => e && kid(e, n), el);
const all = (el, name) => (el ? [...el.getElementsByTagName("*")].filter((c) => c.localName === name) : []);
const num = (el, a) => (el && el.hasAttribute(a) ? Number(el.getAttribute(a)) : null);
const dirOf = (p) => p.slice(0, p.lastIndexOf("/") + 1);
function resolvePath(base, target) { if (target.startsWith("/")) return target.slice(1); const parts = (dirOf(base) + target).split("/"), out = []; for (const p of parts) { if (p === "..") out.pop(); else if (p !== ".") out.push(p); } return out.join("/"); }

export async function readPptx(file, onProgress = () => {}) {
  let zip; try { zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer()); } catch (e) { throw new Error("This file could not be read as a PowerPoint (.pptx). If it is password-protected, remove the password and try again."); }
  const text = async (p) => { const f = zip.file(p); return f ? f.async("string") : null; };
  const doc = async (p) => { const s = await text(p); return s ? xml(s) : null; };
  const rels = async (p) => { const d = await doc(`${dirOf(p)}_rels/${p.slice(p.lastIndexOf("/") + 1)}.rels`), m = new Map(); if (d) for (const r of all(d, "Relationship")) m.set(r.getAttribute("Id"), { type: (r.getAttribute("Type") || "").split("/").pop(), target: r.getAttribute("TargetMode") === "External" ? r.getAttribute("Target") : resolvePath(p, r.getAttribute("Target")) }); return m; };
  const pres = await doc("ppt/presentation.xml"); if (!pres) throw new Error("This file is not a PowerPoint presentation.");
  const presRels = await rels("ppt/presentation.xml");
  const sz = all(pres, "sldSz")[0], W = (num(sz, "cx") || 12192000) / EMU, H = (num(sz, "cy") || 6858000) / EMU;
  const defaultText = all(pres, "defaultTextStyle")[0] || null;

  /* theme */
  const themePath = [...presRels.values()].find((r) => r.type === "theme"); const themeDoc = await doc(themePath ? themePath.target : "ppt/theme/theme1.xml");
  const theme = { major: "Calibri Light", minor: "Calibri", colors: {} };
  if (themeDoc) {
    const mj = all(themeDoc, "majorFont")[0], mn = all(themeDoc, "minorFont")[0];
    if (mj && kid(mj, "latin")) theme.major = kid(mj, "latin").getAttribute("typeface") || theme.major; if (mn && kid(mn, "latin")) theme.minor = kid(mn, "latin").getAttribute("typeface") || theme.minor;
    const cs = all(themeDoc, "clrScheme")[0]; if (cs) for (const c of cs.children) { const v = kid(c, "srgbClr") ? kid(c, "srgbClr").getAttribute("val") : kid(c, "sysClr") ? kid(c, "sysClr").getAttribute("lastClr") : null; if (v) theme.colors[c.localName] = `#${v.toUpperCase()}`; }
    Object.assign(theme.colors, { tx1: theme.colors.dk1, bg1: theme.colors.lt1, tx2: theme.colors.dk2, bg2: theme.colors.lt2 });
  }
  const colourOf = (fillParent) => { const f = kid(fillParent, "solidFill"); if (!f) return null; const s = kid(f, "srgbClr"); if (s) return `#${s.getAttribute("val").toUpperCase()}`; const sc = kid(f, "schemeClr"); if (sc) return theme.colors[sc.getAttribute("val")] || null; const sys = kid(f, "sysClr"); return sys ? `#${(sys.getAttribute("lastClr") || "000000").toUpperCase()}` : null; };
  const fontName = (tf, title) => (!tf ? null : tf.startsWith("+mj") ? theme.major : tf.startsWith("+mn") ? theme.minor : tf);

  /* layouts and masters (cached) */
  const cache = new Map();
  const part = async (p) => { if (!cache.has(p)) { const d = await doc(p), r = await rels(p); cache.set(p, { doc: d, rels: r, parent: [...r.values()].find((x) => x.type === "slideMaster" || x.type === "slideLayout") || null }); } return cache.get(p); };
  const placeholders = (d) => all(dig(d.documentElement, "cSld", "spTree"), "sp").map((sp) => ({ sp, ph: all(kid(sp, "nvSpPr"), "ph")[0] })).filter((x) => x.ph);
  const phKey = (ph) => { const t = ph.getAttribute("type") || "body"; return t === "ctrTitle" ? "title" : t === "subTitle" ? "body" : t; };
  const findPh = (d, ph) => { if (!d || !ph) return null; const list = placeholders(d), idx = ph.getAttribute("idx"), type = phKey(ph); return (idx && list.find((x) => x.ph.getAttribute("idx") === idx)) || list.find((x) => phKey(x.ph) === type) || null; };
  const bgOf = (d) => { const bg = dig(d.documentElement, "cSld", "bg"); return bg ? colourOf(kid(bg, "bgPr")) || (all(bg, "schemeClr")[0] ? theme.colors[all(bg, "schemeClr")[0].getAttribute("val")] : null) : null; };

  /* media sizes */
  const dims = new Map();
  const imageInfo = async (p) => { if (dims.has(p)) return dims.get(p); let info = null; const f = zip.file(p);
    if (f && /\.(png|jpe?g|gif|webp|bmp)$/i.test(p)) { try { const blob = await f.async("blob"), url = URL.createObjectURL(new Blob([blob], { type: `image/${/\.jpe?g$/i.test(p) ? "jpeg" : p.split(".").pop().toLowerCase()}` })); info = await new Promise((res) => { const im = new Image(); im.onload = () => res({ url, pxW: im.naturalWidth, pxH: im.naturalHeight, bytes: blob.size }); im.onerror = () => res(null); im.src = url; }); } catch (e) { info = null; } }
    dims.set(p, info); return info; };

  /* charts */
  const readChart = async (p) => { const d = await doc(p); if (!d) return null; const plot = all(d, "plotArea")[0]; const typeEl = plot ? [...plot.children].find((c) => /Chart$/.test(c.localName)) : null;
    const pts = (el) => (el ? all(el, "pt").map((pt) => ({ i: Number(pt.getAttribute("idx")), v: kid(pt, "v") ? kid(pt, "v").textContent : "" })).sort((a, b) => a.i - b.i) : []);
    const pctHint = all(d, "numFmt").some((f) => /%/.test(f.getAttribute("formatCode") || ""));   // data labels or axis formatted as percent
    const series = all(d, "ser").map((s) => { const cats = pts(kid(s, "cat")), vals = pts(kid(s, "val") || kid(s, "yVal")); const fmt = all(kid(s, "val") || s, "formatCode")[0]; const name = all(kid(s, "tx"), "v").map((v) => v.textContent).join(" "); return { name, categories: cats.map((c) => c.v), values: vals.map((v) => Number(v.v)), raw: vals.map((v) => v.v), percent: Boolean(fmt && /%/.test(fmt.textContent)) || pctHint || /%|\b(margin|share|rate|growth|marjin|pangsa|porsi|pertumbuhan)\b/i.test(name) }; });
    return { type: typeEl ? typeEl.localName.replace(/Chart$/, "") : "chart", title: all(kid(all(d, "chart")[0], "title"), "t").map((t) => t.textContent).join(""), series }; };

  /* text */
  const lvlProps = (el, lvl) => (el ? kid(el, `lvl${lvl + 1}pPr`) : null);
  function readParas(txBody, chain, isTitle) {
    const out = [];
    for (const p of kids(txBody, "p")) {
      const pPr = kid(p, "pPr"), lvl = num(pPr, "lvl") || 0;
      const defs = chain.map((c) => { const l = lvlProps(c, lvl); return l ? kid(l, "defRPr") : null; }).filter(Boolean);
      const inherit = (get) => { for (const d of defs) { const v = get(d); if (v != null) return v; } return null; };
      const runs = [];
      for (const r of p.children) {
        if (r.localName === "br") { runs.push({ text: "\n" }); continue; }
        if (r.localName !== "r" && r.localName !== "fld") continue;
        const rPr = kid(r, "rPr"), t = kid(r, "t"); if (!t) continue;
        const pick = (get) => { const own = rPr ? get(rPr) : null; return own != null ? own : inherit(get); };
        const size = pick((e) => num(e, "sz")), tf = pick((e) => (kid(e, "latin") ? kid(e, "latin").getAttribute("typeface") : null));
        runs.push({ text: t.textContent, field: r.localName === "fld" ? r.getAttribute("type") : null, size: size ? size / 100 : null, font: fontName(tf) || (isTitle ? theme.major : theme.minor), bold: pick((e) => (e.hasAttribute("b") ? e.getAttribute("b") === "1" : null)) || false, italic: pick((e) => (e.hasAttribute("i") ? e.getAttribute("i") === "1" : null)) || false, color: pick((e) => colourOf(e)) });
      }
      const textOf = runs.map((r) => r.text).join("");
      out.push({ text: textOf, runs: runs.filter((r) => r.text !== "\n"), level: lvl, bullet: Boolean(pPr && (kid(pPr, "buChar") || kid(pPr, "buAutoNum"))), align: pPr ? pPr.getAttribute("algn") : null });
    }
    return out;
  }

  /* slides */
  const order = kids(all(pres, "sldIdLst")[0], "sldId").map((s) => presRels.get(s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || s.getAttribute("r:id"))).filter(Boolean);
  const slides = [];
  for (let n = 0; n < order.length; n++) {
    onProgress(`Reading slide ${n + 1} of ${order.length}`, (n + 1) / order.length);
    const sp = await part(order[n].target), layout = sp.parent ? await part(sp.parent.target) : null, master = layout && layout.parent ? await part(layout.parent.target) : null;
    const root = sp.doc.documentElement, shapes = []; let seq = 0;
    const txStyles = master ? all(master.doc, "txStyles")[0] : null;
    const xfrmOf = (pr) => { const x = pr ? kid(pr, "xfrm") : null; if (!x || !kid(x, "off") || !kid(x, "ext")) return null; return { x: num(kid(x, "off"), "x"), y: num(kid(x, "off"), "y"), w: num(kid(x, "ext"), "cx"), h: num(kid(x, "ext"), "cy"), node: x }; };
    const walk = async (tree, tf) => {
      for (const el of tree.children) {
        const name = el.localName;
        if (name === "AlternateContent") { const pick = kid(el, "Choice") || kid(el, "Fallback"); if (pick) await walk(pick, tf); continue; }   // newer shape types are wrapped with a fallback
        if (!["sp", "pic", "graphicFrame", "grpSp", "cxnSp"].includes(name)) continue;
        if (name === "grpSp") { const g = xfrmOf(kid(el, "grpSpPr")); let t2 = tf; if (g) { const ch = { x: num(kid(g.node, "chOff"), "x") ?? g.x, y: num(kid(g.node, "chOff"), "y") ?? g.y, w: num(kid(g.node, "chExt"), "cx") || g.w, h: num(kid(g.node, "chExt"), "cy") || g.h }; const sx = g.w / (ch.w || 1), sy = g.h / (ch.h || 1); t2 = (b) => tf({ x: g.x + (b.x - ch.x) * sx, y: g.y + (b.y - ch.y) * sy, w: b.w * sx, h: b.h * sy }); } await walk(el, t2); continue; }
        const nv = kid(el, name === "pic" ? "nvPicPr" : name === "graphicFrame" ? "nvGraphicFramePr" : name === "cxnSp" ? "nvCxnSpPr" : "nvSpPr"), cNv = kid(nv, "cNvPr"), ph = all(nv, "ph")[0] || null;
        const lph = ph && layout ? findPh(layout.doc, ph) : null, mph = ph && master ? findPh(master.doc, ph) : null;
        let box = xfrmOf(name === "graphicFrame" ? el : kid(el, "spPr")) || (lph && xfrmOf(kid(lph.sp, "spPr"))) || (mph && xfrmOf(kid(mph.sp, "spPr")));
        box = box ? tf(box) : null;
        const type = ph ? ph.getAttribute("type") || "body" : null;
        const role = !ph ? "other" : /title/i.test(type) && type !== "subTitle" ? "title" : type === "subTitle" ? "subtitle" : type === "ftr" ? "footer" : type === "sldNum" ? "slidenum" : type === "dt" ? "date" : "body";
        const s = { id: `s${n + 1}-${++seq}`, name: cNv ? cNv.getAttribute("name") || "" : "", alt: cNv ? cNv.getAttribute("descr") || "" : "", hidden: Boolean(cNv && cNv.getAttribute("hidden") === "1"), kind: "shape", role, placeholder: Boolean(ph), x: box ? box.x / EMU : 0, y: box ? box.y / EMU : 0, w: box ? box.w / EMU : 0, h: box ? box.h / EMU : 0, hasBox: Boolean(box), paras: [] };
        if (name === "sp") {
          const spPr = kid(el, "spPr"), geom = spPr ? kid(spPr, "prstGeom") : null; s.geom = geom ? geom.getAttribute("prst") : null; s.fill = spPr && !kid(spPr, "noFill") ? colourOf(spPr) : null;
          const tx = kid(el, "txBody");
          if (tx) { const styleKey = role === "title" ? "titleStyle" : role === "other" ? "otherStyle" : "bodyStyle";
            const chain = [kid(tx, "lstStyle"), lph && dig(lph.sp, "txBody", "lstStyle"), mph && dig(mph.sp, "txBody", "lstStyle"), txStyles && kid(txStyles, styleKey), defaultText].filter(Boolean);
            s.paras = readParas(tx, chain, role === "title"); if (s.paras.some((p) => p.text.trim())) s.kind = "text";
            // "shrink text on overflow": PowerPoint records the scale it applied, which gives the size the reader actually sees
            const fit = dig(tx, "bodyPr", "normAutofit"), scale = fit && fit.hasAttribute("fontScale") ? Number(fit.getAttribute("fontScale")) / 100000 : 1;
            if (scale < 0.995) { s.shrunk = Math.round(scale * 100); for (const p of s.paras) for (const r of p.runs) if (r.size) r.size = Math.round(r.size * scale * 10) / 10; }
            const anchor = (dig(tx, "bodyPr") && dig(tx, "bodyPr").getAttribute("anchor")) || (lph && dig(lph.sp, "txBody", "bodyPr") && dig(lph.sp, "txBody", "bodyPr").getAttribute("anchor")) || (mph && dig(mph.sp, "txBody", "bodyPr") && dig(mph.sp, "txBody", "bodyPr").getAttribute("anchor")); s.anchor = anchor || "t"; }
          if (ph && s.kind !== "text") s.emptyPlaceholder = true;
        } else if (name === "pic") {
          s.kind = "picture"; const blip = all(el, "blip")[0], rid = blip ? blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") : null, rel = rid ? sp.rels.get(rid) : null, src = all(el, "srcRect")[0];
          s.media = rel ? rel.target : null; s.crop = src ? { l: (num(src, "l") || 0) / 1e5, t: (num(src, "t") || 0) / 1e5, r: (num(src, "r") || 0) / 1e5, b: (num(src, "b") || 0) / 1e5 } : { l: 0, t: 0, r: 0, b: 0 };
          s.image = s.media ? await imageInfo(s.media) : null;
        } else if (name === "graphicFrame") {
          const tbl = all(el, "tbl")[0], chartEl = all(el, "chart")[0];
          if (tbl) { s.kind = "table"; s.table = kids(tbl, "tr").map((tr) => kids(tr, "tc").map((tc) => readParas(kid(tc, "txBody"), [defaultText].filter(Boolean), false))); s.rows = s.table.map((r) => r.map((c) => c.map((p) => p.text).join(" ").trim())); s.paras = s.table.flat(2); }
          else if (chartEl) { const rid = chartEl.getAttribute("r:id") || chartEl.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"), rel = rid ? sp.rels.get(rid) : null; s.kind = "chart"; s.chart = rel ? await readChart(rel.target) : null; }
          else s.kind = "object";
        } else s.kind = "line";
        if (!s.hidden) shapes.push(s);
      }
    };
    await walk(dig(root, "cSld", "spTree"), (b) => b);
    slides.push({ index: n + 1, part: order[n].target, hidden: root.getAttribute("show") === "0", background: bgOf(sp.doc) || (layout && bgOf(layout.doc)) || (master && bgOf(master.doc)) || "#FFFFFF", layoutName: layout ? (dig(layout.doc.documentElement, "cSld") || { getAttribute: () => "" }).getAttribute("name") || "" : "", shapes });
  }
  return finishDeck({ name: file.name, kind: "pptx", width: W, height: H, theme, slides });
}

/* ---------- shared: derive titles, sizes and plain text once a deck model is built ---------- */
export function finishDeck(deck) {
  for (const s of deck.slides) {
    for (const sh of s.shapes) {
      sh.text = sh.paras.map((p) => p.text).join("\n").trim();
      const sizes = new Map(), fonts = new Map(); let chars = 0;
      for (const p of sh.paras) for (const r of p.runs) { const n = r.text.trim().length; if (!n) continue; chars += n; if (r.size) sizes.set(r.size, (sizes.get(r.size) || 0) + n); if (r.font) fonts.set(r.font, (fonts.get(r.font) || 0) + n); }
      const top = (m) => (m.size ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null);
      sh.size = top(sizes); sh.font = top(fonts); sh.chars = chars;
    }
    const texts = s.shapes.filter((x) => x.kind === "text" && x.text);
    let title = texts.find((x) => x.role === "title") || null, inferred = false;
    if (!title) { // decks built without placeholders: the largest type in the upper third is the title
      const cands = texts.filter((x) => x.hasBox && x.y < deck.height * 0.36 && x.text.length >= 3 && x.role === "other" && (x.size || 0) >= 14);
      if (cands.length) { const big = Math.max(...cands.map((c) => c.size || 0)); title = cands.filter((c) => (c.size || 0) >= big * 0.92).sort((a, b) => b.text.length - a.text.length)[0]; inferred = true; }
    }
    if (!title && s.index === 1) { const any = texts.filter((x) => x.text.length >= 3 && x.size); if (any.length) { title = any.sort((a, b) => b.size - a.size)[0]; inferred = true; } }   // a cover carries its title anywhere on the page
    if (title) title.isTitle = true;
    s.title = title ? { text: title.text.replace(/\s*\n\s*/g, " ").trim(), shapeId: title.id, inferred } : null;
    s.text = s.shapes.map((x) => x.text).filter(Boolean).join("\n");
    s.words = (s.text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;
  }
  return deck;
}
