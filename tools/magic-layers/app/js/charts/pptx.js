// Chart Builder — PowerPoint export. Each chart becomes a slide with a native, editable PowerPoint chart (its data
// sits in the embedded workbook: right-click, Edit Data), the action title, the unit line and the source line.
// Two things the library cannot express are patched into the chart XML afterwards: the invisible base of a bridge
// chart and per-series label formats.
import { colours, bridge, growthNote, autoDecimals, lineScale, PALETTE } from "./render.js";

const hexc = (c) => c.replace("#", "").toUpperCase();
export function formatCode(f = {}, opts = {}) { const d = f.decimals ?? 0, num = `#,##0${d ? `.${"0".repeat(d)}` : ""}`, q = (s) => (s ? `"${s.replace(/"/g, "")}"` : ""), body = `${q(f.prefix)}${num}${q(f.suffix)}`; return opts.hideZero ? `${opts.plus ? '"+"' : ""}${body};"−"${body};;` : `${body};"−"${body}`; }

export async function exportCharts(charts, { fonts = { heading: "Fraunces", body: "Inter" }, paper = true, name = "Charts" } = {}) {
  const PptxGenJS = globalThis.PptxGenJS; if (!PptxGenJS) throw new Error("The PowerPoint library did not load.");
  const pptx = new PptxGenJS(); pptx.layout = "LAYOUT_WIDE"; pptx.title = name; const patches = [];
  for (const spec of charts) {
    const d = spec.data; if (!d.categories.length || !d.series.length) continue;
    const slide = pptx.addSlide(); slide.background = { color: paper ? "FAF8F4" : "FFFFFF" };
    const f = { decimals: autoDecimals(d), ...spec.format }, col = colours(spec), note = growthNote(spec), pie = spec.type === "pie", legend = d.series.length > 1 && !pie && spec.type !== "waterfall";
    if (spec.title) slide.addText(spec.title, { x: 0.6, y: 0.4, w: 12.1, h: 1.15, fontFace: fonts.heading, fontSize: 26, bold: true, color: "111111", valign: "bottom", margin: 0, fit: "shrink" });
    if (spec.subtitle) slide.addText(spec.subtitle, { x: 0.6, y: 1.65, w: note ? 8.4 : 12.1, h: 0.36, fontFace: fonts.body, fontSize: 14, color: "44423E", margin: 0 });
    if (note) slide.addText(note, { x: 9.2, y: 1.62, w: 3.5, h: 0.4, shape: pptx.ShapeType.roundRect, rectRadius: 0.2, fill: { color: "FBF3DA" }, line: { color: "C09200", width: 0.75 }, fontFace: fonts.body, fontSize: 12, bold: true, color: "7A5B00", align: "center", valign: "middle", margin: 0 });
    if (spec.source) slide.addText(spec.source, { x: 0.6, y: 6.85, w: 12.1, h: 0.3, fontFace: fonts.body, fontSize: 10, color: "6B6862", margin: 0 });
    const box = { x: pie ? 0.6 : 0.5, y: 2.15, w: pie ? 9 : 12.3, h: 4.55 }, labels = d.categories;
    const common = { ...box, showTitle: false, showLegend: legend, legendPos: "t", legendFontFace: fonts.body, legendFontSize: 12, legendColor: "44423E",
      showValue: spec.labels !== false, dataLabelFontFace: fonts.body, dataLabelFontSize: 13, dataLabelFontBold: true, dataLabelColor: "111111", dataLabelFormatCode: formatCode(f),
      catAxisLabelFontFace: fonts.body, catAxisLabelFontSize: 12, catAxisLabelColor: "6B6862", catAxisLineShow: true, catGridLine: { style: "none" }, valGridLine: { style: "none" }, valAxisHidden: true, valAxisLineShow: false, valAxisMinVal: 0 };
    if (d.series.some((s) => s.values.some((v) => v < 0))) delete common.valAxisMinVal;
    const data = d.series.map((s) => ({ name: s.name, labels, values: s.values.map((v) => v ?? 0) }));
    if (spec.type === "waterfall") {
      const wf = bridge(spec), lab = wf.steps.map((s) => s.label), lo = (s) => Math.min(s.from, s.to);
      const ser = [{ name: "(base)", labels: lab, values: wf.steps.map((s) => (s.kind === "total" ? 0 : lo(s))) }, { name: "Total", labels: lab, values: wf.steps.map((s) => (s.kind === "total" ? s.value : 0)) }, { name: "Increase", labels: lab, values: wf.steps.map((s) => (s.kind === "up" ? s.value : 0)) }, { name: "Decrease", labels: lab, values: wf.steps.map((s) => (s.kind === "down" ? -s.value : 0)) }];
      slide.addChart(pptx.ChartType.bar, ser, { ...common, barDir: "col", barGrouping: "stacked", barGapWidthPct: 55, chartColors: ["FFFFFF", hexc(PALETTE.ink), hexc(PALETTE.goldDark), hexc(PALETTE.down)], showLegend: false, dataLabelPosition: "inEnd", dataLabelColor: "FFFFFF", dataLabelFormatCode: formatCode(f, { hideZero: true }), valAxisMaxVal: Math.max(...wf.steps.map((s) => Math.max(s.from, s.to))) * 1.15 });
      patches.push({ kind: "waterfall", up: formatCode(f, { hideZero: true, plus: true }), down: `"−"${formatCode(f).split(";")[0]};;;` });
    } else if (pie) {
      slide.addChart(spec.doughnut ? pptx.ChartType.doughnut : pptx.ChartType.pie, [data[0]], { ...common, chartColors: col.points.map(hexc), showLegend: true, legendPos: "r", legendFontSize: 13, showPercent: false, showValue: spec.labels !== false, dataLabelColor: "FFFFFF", dataLabelPosition: "ctr", holeSize: 56, dataBorder: { pt: 1.5, color: "FFFFFF" } });
    } else if (spec.type === "line") {
      const sc = lineScale(d);
      slide.addChart(pptx.ChartType.line, data, { ...common, chartColors: col.series.map(hexc), lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7, dataLabelPosition: "t", valAxisMinVal: sc.min, valAxisMaxVal: sc.max });
      if (d.series.length > 1 && spec.labels !== false) patches.push({ kind: "line", points: labels.length });       // several lines: label the last point of each only
    } else if (spec.type === "stacked" || spec.type === "stacked100") {
      // 100% charts carry the shares themselves, so the labels can read "42%"; stacked charts get an invisible series
      // on top whose label, set at its base, is the total of the stack (the axis is capped so it does not stretch the chart)
      const pc = spec.type === "stacked100", tot = labels.map((_, i) => d.series.reduce((a, s) => a + Math.abs(s.values[i] ?? 0), 0) || 1), positive = d.series.every((s) => s.values.every((v) => (v ?? 0) >= 0));
      const ser = pc ? d.series.map((s) => ({ name: s.name, labels, values: s.values.map((v, i) => Math.round(((v ?? 0) / tot[i]) * 1000) / 10) })) : data.slice();
      const totals = !pc && positive && d.series.length > 1 && spec.totals !== false && spec.labels !== false; if (totals) ser.push({ name: "Total", labels, values: tot });
      slide.addChart(pptx.ChartType.bar, ser, { ...common, barDir: "col", barGrouping: "stacked", barGapWidthPct: 55, chartColors: col.series.map(hexc).concat(totals ? ["FFFFFF"] : []), dataLabelPosition: "ctr", dataLabelColor: "FFFFFF",
        dataLabelFormatCode: pc ? '0"%"' : formatCode(f, { hideZero: true }), ...(pc ? { valAxisMaxVal: 100 } : totals ? { valAxisMaxVal: Math.max(...tot) * 1.12 } : {}) });
      patches.push({ kind: "stack", colors: col.series, totals: totals ? d.series.length : -1 });
    } else {
      const single = d.series.length === 1 && col.points;
      slide.addChart(pptx.ChartType.bar, data, { ...common, barDir: spec.type === "bar" ? "bar" : "col", barGrouping: "clustered", barGapWidthPct: single ? 55 : 70, chartColors: (single ? col.points : col.series).map(hexc), dataLabelPosition: "outEnd", catAxisOrientation: spec.type === "bar" ? "maxMin" : "minMax" });
    }
  }
  let blob = await pptx.write({ outputType: "blob" });
  if (patches.length && globalThis.JSZip) blob = await patch(blob, patches);
  return blob;
}

// Post-processing of chart XML, in the order the charts were added.
async function patch(blob, patches) {
  const zip = await globalThis.JSZip.loadAsync(blob), files = Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const dark = (c) => { const h = c.replace("#", ""); return 0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16) < 140; };
  const labelColour = (ser, hex) => ser.replace(/(<c:dLbls>[\s\S]*?<a:solidFill><a:srgbClr val=")[0-9A-Fa-f]{6}(")/, `$1${hex}$2`);
  const labelFormat = (ser, code) => ser.replace(/(<c:dLbls>[\s\S]*?formatCode=")[^"]*"/, (m, a) => `${a}${code.replace(/"/g, "&quot;")}"`);
  const invisible = (ser) => ser.replace(/<c:spPr>[\s\S]*?<\/c:spPr>/, "<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>");
  for (const name of files) {
    let xml = await zip.file(name).async("string"); const kind = xml.includes("<c:v>(base)</c:v>") ? "waterfall" : xml.includes("<c:lineChart>") ? "line" : /<c:grouping val="stacked"/.test(xml) ? "stack" : null; if (!kind) continue;
    const p = patches.find((x) => x.kind === kind && !x.used); if (!p) continue; p.used = true; let i = -1;
    xml = xml.replace(/<c:ser>[\s\S]*?<\/c:ser>/g, (ser) => { i++;
      if (kind === "waterfall") { const nm = (/<c:tx>[\s\S]*?<c:v>([^<]*)<\/c:v>/.exec(ser) || [])[1];
        if (nm === "(base)") return invisible(ser).replace(/<c:dLbls>[\s\S]*?<\/c:dLbls>/, '<c:dLbls><c:delete val="1"/></c:dLbls>');
        if (nm === "Increase") return labelColour(labelFormat(ser, p.up), "111111"); if (nm === "Decrease") return labelColour(labelFormat(ser, p.down), "111111"); return ser; }
      if (kind === "line") { const del = Array.from({ length: Math.max(0, p.points - 1) }, (_, k) => `<c:dLbl><c:idx val="${k}"/><c:delete val="1"/></c:dLbl>`).join(""); return ser.replace("<c:dLbls>", `<c:dLbls>${del}`); }
      if (i === p.totals) return labelColour(invisible(ser), "111111").replace(/<c:dLblPos val="[a-zA-Z]+"\/>/, '<c:dLblPos val="inBase"/>');
      const c = p.colors[i]; return !c || dark(c) ? ser : labelColour(ser, "111111"); });   // light segments carry dark labels
    if (kind === "stack" && p.totals >= 0) xml = xml.replace(/(<c:legend>\s*<c:legendPos val="[a-z]+"\/>)/, `$1<c:legendEntry><c:idx val="${p.totals}"/><c:delete val="1"/></c:legendEntry>`);
    zip.file(name, xml);
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
}
