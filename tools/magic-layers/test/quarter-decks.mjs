// Two quarters of a results deck, built in the Deck Auditor's own model: last quarter (Q2 25) and this quarter (Q3 25).
// This quarter repeats some of last quarter's figures as comparatives; one was changed silently, one was changed and
// marked as restated, one is unchanged, and the Q3 figures are new.
export function quarterDecks(finishDeck) {
  let n = 0; const W = 960, H = 540;
  const text = (t, o = {}) => ({ id: `s${++n}`, name: "", kind: "text", role: o.role || "other", placeholder: false, x: 60, y: o.y ?? 150, w: 800, h: 60, hasBox: true, paras: t.split("\n").map((p) => ({ text: p, level: 0, bullet: false, runs: [{ text: p, size: o.size ?? 16, font: "Calibri", bold: false, italic: false, color: null }] })) });
  const title = (t) => text(t, { role: "title", y: 30, size: 28 });
  const table = (rows) => ({ id: `s${++n}`, name: "", kind: "table", role: "other", placeholder: false, x: 60, y: 200, w: 800, h: 200, hasBox: true, rows, paras: rows.map((r) => ({ text: r.join("\t"), level: 0, bullet: false, runs: [{ text: r.join("\t"), size: 12, font: "Calibri" }] })) });
  const deck = (name, slides) => finishDeck({ name, kind: "pptx", width: W, height: H, theme: { major: null, minor: null, colors: {} }, slides: slides.map((shapes, i) => ({ index: i + 1, hidden: false, background: "#FFFFFF", layoutName: "", shapes })) });
  const q2 = deck("Q2 25 results.pptx", [
    [title("Q2 25 results")],
    [title("Revenue rose to Rp 14.2 tn in Q2 25 as volumes recovered"), text("Revenue reached Rp 14.2 tn in Q2 25. EBITDA margin was 12.8% in Q2 25 and net debt to EBITDA stood at 2.4x in Q2 25.")],
    [title("Opex held flat in Q2 25 while freight volumes grew"), text("Operating expenses were Rp 3.1 tn in Q2 25.")],
  ]);
  const q3 = deck("Q3 25 results.pptx", [
    [title("Q3 25 results")],
    [title("Revenue rose to Rp 15.0 tn in Q3 25, up from Rp 13.9 tn in Q2 25"), text("Revenue reached Rp 15.0 tn in Q3 25 against Rp 13.9 tn in Q2 25. EBITDA margin was 13.5% in Q3 25 after 12.8% in Q2 25.")],
    [title("Opex rose in Q3 25 with the new depots"), text("Operating expenses were Rp 3.4 tn in Q3 25 and Rp 3.0 tn in Q2 25 (restated for the reclassification of depot leases).")],
  ]);
  return { q2, q3 };
}
