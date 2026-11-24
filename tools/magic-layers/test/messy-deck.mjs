// A deliberately bad deck, built as the auditor's own deck model, that sets off the rules the sample deck does not.
export function messyDeck(finishDeck) {
  let n = 0; const W = 960, H = 540;
  const text = (t, o = {}) => ({ id: `s${++n}`, name: "", kind: "text", role: o.role || "other", placeholder: false, x: o.x ?? 60, y: o.y ?? 150, w: o.w ?? 800, h: o.h ?? 60, hasBox: true, paras: t.split("\n").map((p) => ({ text: p, level: 0, bullet: false, runs: [{ text: p, size: o.size ?? 14, font: o.font ?? "Calibri", bold: false, italic: false, color: null }] })) });
  const title = (t, o = {}) => text(t, { role: "title", y: 30, size: 28, ...o });
  const table = (rows) => ({ id: `s${++n}`, name: "", kind: "table", role: "other", placeholder: false, x: 60, y: 200, w: 800, h: 200, hasBox: true, rows, paras: rows.map((r) => ({ text: r.join("\t"), level: 0, bullet: false, runs: [{ text: r.join("\t"), size: 12, font: "Calibri", bold: false, italic: false, color: null }] })) });
  const chart = (type, series) => ({ id: `s${++n}`, name: "", kind: "chart", role: "other", placeholder: false, x: 60, y: 200, w: 800, h: 250, hasBox: true, paras: [], chart: { type, title: "", series: series.map((x) => ({ percent: false, raw: x.values.map(String), ...x })) } });
  const num = () => ({ id: `s${++n}`, name: "", kind: "text", role: "slidenum", placeholder: true, x: 880, y: 500, w: 60, h: 20, hasBox: true, paras: [{ text: "3", level: 0, bullet: false, runs: [{ text: "3", size: 10, font: "Calibri", field: "slidenum" }] }] });
  const long = "The regional distribution network was rebuilt during the year and now reaches every province through a combination of owned depots and contracted carriers while unit costs have continued to fall in each quarter";
  const filler = Array.from({ length: 170 }, (_, i) => `word${i}`).join(" ");
  const slides = [
    [title("Annual review"), text("Prepared for the board", { y: 300 })],
    [title("Revenue has grown in every region since the network was rebuilt"), text("Operating margin reached 12.4% in FY25 and the trend continues.", {}), text("Northern region grew strongly during the year under review.", { x: 20 }), num()],
    [title("Revenue has grown in every region since the network was rebuilt"), text("Operating margin of 12% in FY25 was ahead of plan.", {}), text("The share of sales by channel was 40%, 35% and 20% for the year.", { y: 260 }), num()],
    [title(long + " and this sentence carries on well beyond what a reader can hold"), text("Costs fell in each quarter as volumes recovered across the network.", {}), num()],
    [text(filler, { y: 200, size: 12 }), num()],
    [title("Costs fell across the network as volumes recovered in each quarter"), table([["Rp bn", "North", "South", "Total"], ["Freight", "10", "12", "25"], ["Storage", "5", "6", "11"], ["Total", "15", "18", "36"]]), text("Source: management accounts.", { y: 480, size: 10 }), num()],
    [title("Channel mix shifted towards direct sales during the year"), table([["Channel", "Share"], ["Direct", "50%"], ["Agents", "30%"], ["Online", "17%"]]), text("Source: management accounts.", { y: 480, size: 10 })],
    [title("Depot costs were lower in every region than a year earlier"), chart("barChart", [{ name: "Cost", categories: ["North", "South", "Total"], values: [10, 12, 25] }]), text("Source: management accounts.", { y: 480, size: 10 }), num()],
    [title("Carrier contracts were renewed on better terms in the second half"), text("The renewal covers all contracted carriers and runs for three years from the start of FY26 with an option to extend.", { size: 7, y: 200 }), text("Volumes are committed for the first two years of the contract.", { x: 900, w: 200, y: 300 }), num()],
    [title("Service levels held through the peak season in all provinces"), text("On-time delivery stayed above the target through the fourth quarter.", {}), num()],
  ].map((shapes, i) => ({ index: i + 1, hidden: false, background: "#FFFFFF", layoutName: "", shapes }));
  // enough consistent left edges for the margin rule to find its mode
  for (const s of slides.slice(5)) s.shapes.push(text("Notes for the reader are set at the deck's usual margin throughout.", { y: 440, size: 11 }));
  return finishDeck({ name: "messy.pptx", kind: "pptx", width: W, height: H, theme: { major: null, minor: null, colors: {} }, slides });
}
