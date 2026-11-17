# Builds the two sample decks for the Deck Auditor (current and previous version), with known flaws planted in them.
# Needs python-pptx and Pillow; run from the tool folder:  python3 test/make-audit-samples.py
# The company and all figures are invented for the purpose.
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE
from PIL import Image
import io

def picture():
    im = Image.open("app/sample/sample-slide.png").convert("RGB").crop((760, 120, 1160, 520)).resize((220, 220))
    b = io.BytesIO(); im.save(b, "PNG"); b.seek(0); return b

def bullets(slide, items, size=None, font=None, box=None):
    body = slide.placeholders[1] if box is None else box
    tf = body.text_frame; tf.clear()
    for i, t in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph(); r = p.add_run(); r.text = t
        if size: r.font.size = Pt(size)
        if font: r.font.name = font
    return body

def source(slide, text):
    tb = slide.shapes.add_textbox(Inches(0.6), Inches(6.9), Inches(9), Inches(0.35)); r = tb.text_frame.paragraphs[0].add_run(); r.text = text; r.font.size = Pt(10)

def build(path, previous=False):
    prs = Presentation(); prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)
    title_only, title_body, cover = prs.slide_layouts[5], prs.slide_layouts[1], prs.slide_layouts[0]
    def fit(s):
        for ph in s.placeholders:   # the stock template is 4:3: widen each placeholder to the 16:9 page
            l, t, w, h = ph.left, ph.top, ph.width, ph.height
            ph.left, ph.top, ph.width, ph.height = int(l * 13.333 / 10), t, int(w * 13.333 / 10), h
        return s
    s = fit(prs.slides.add_slide(cover)); s.shapes.title.text = "FY25 Board Update"; s.placeholders[1].text = "Nusantara Logistics (invented company) · November 2025 · Illustrative sample"

    s = fit(prs.slides.add_slide(title_body)); s.shapes.title.text = "Executive summary"
    bullets(s, ["EBITDA margin recovered to 14% in Q3 25 as logistics costs normalised",
                "Revenue grew 16% from Rp 50 tn to Rp 56 tn in FY25" if not previous else "Revenue grew 12% from Rp 50 tn to Rp 56 tn in FY25",
                "Net debt to EBITDA fell to 2.1x, inside the covenant of 3.0x",
                "TBC: capex guidance for FY26" if not previous else "Capex guidance for FY26 follows in December"], size=22)

    s = fit(prs.slides.add_slide(title_only)); s.shapes.title.text = ("EBITDA margin recovered to 15% in Q3 25 as logistics costs normalised" if not previous else "EBITDA margin recovered to 13% in Q3 25 as logistics costs normalised")
    cd = CategoryChartData(); cd.categories = ["Q2 24", "Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25"]; cd.add_series("EBITDA margin", (11, 12, 9, 10, 13, 14 if not previous else 13))
    ch = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.8), Inches(1.9), Inches(8.5), Inches(4.6), cd).chart
    ch.plots[0].has_data_labels = True; ch.plots[0].data_labels.number_format = '0"%"'; ch.plots[0].data_labels.number_format_is_linked = False; ch.has_legend = False
    source(s, "Source: company management accounts (illustrative figures). As of Q3 2025.")

    s = fit(prs.slides.add_slide(title_only)); s.shapes.title.text = "Revenue by segment"
    t0 = s.shapes.title; t0.left, t0.top, t0.width = t0.left + Inches(0.6), t0.top + Inches(0.3), t0.width - Inches(0.6)   # the title sits off its usual place on purpose
    rows = [("Segment, Rp tn", "FY24", "FY25"), ("Consumer", "21", "24"), ("Industrial", "19", "22"), ("Other", "10", "12"), ("Total", "50", "56" if not previous else "58")]
    t = s.shapes.add_table(len(rows), 3, Inches(0.8), Inches(2.0), Inches(7.5), Inches(3.2)).table
    for r, row in enumerate(rows):
        for c, v in enumerate(row): t.cell(r, c).text = v

    s = fit(prs.slides.add_slide(title_body)); s.shapes.title.text = "Consumer now supplies two-fifths of revenue"   # the body placeholder is left empty on purpose
    cd = CategoryChartData(); cd.categories = ["Consumer", "Industrial", "Other"]; cd.add_series("Share of FY25 revenue", (41, 36, 20))
    s.shapes.add_chart(XL_CHART_TYPE.PIE, Inches(0.8), Inches(1.9), Inches(6), Inches(4.6), cd)
    tb = s.shapes.add_textbox(Inches(7.4), Inches(2.4), Inches(5), Inches(1.6)); tb.text_frame.word_wrap = True
    r = tb.text_frame.paragraphs[0].add_run(); r.text = "Consumer overtook Industrial in FY25 after two years of double-digit volume growth."; r.font.size = Pt(18); r.font.name = "Times New Roman"
    source(s, "Source: company management accounts (illustrative figures).")

    s = fit(prs.slides.add_slide(title_only)); s.shapes.title.text = "Market overview"; s.shapes.title.text_frame.paragraphs[0].runs[0].font.size = Pt(26)
    s.shapes.add_picture(picture(), Inches(0.8), Inches(1.9), Inches(7.2), Inches(4.2))
    tb = s.shapes.add_textbox(Inches(8.4), Inches(2.0), Inches(4.3), Inches(3)); tb.text_frame.word_wrap = True
    r = tb.text_frame.paragraphs[0].add_run(); r.text = "Lorem ipsum dolor sit amet, port throughput commentary to be written." if not previous else "Port throughput rose for the third year as two new terminals opened."; r.font.size = Pt(18)

    if not previous:
        s = fit(prs.slides.add_slide(title_body)); s.shapes.title.text = "Pendapatan naik karena volume logistik yang lebih tinggi"
        bullets(s, ["Volume pengiriman tumbuh pada semua segmen dan wilayah", "Biaya logistik turun dengan kontrak baru untuk armada", "Kami akan menambah kapasitas gudang di Jawa Timur pada tahun depan"], size=22)
    else:
        s = fit(prs.slides.add_slide(title_body)); s.shapes.title.text = "Appendix: assumptions behind the FY26 plan"
        bullets(s, ["Volume growth of 6% across the network", "Fuel at the FY25 average price", "No change in the tariff schedule"], size=22)

    s = fit(prs.slides.add_slide(title_body)); s.shapes.title.text = "Next steps"
    bullets(s, ["Approve the FY26 budget at the December meeting", "Confirm the warehouse programme in East Java", "Review covenant headroom with the lenders in Q1 26"] + ([] if previous else ["Publish the investor update after the board meeting"]), size=22)
    prs.save(path)

def model(path):
    # The "source of truth" for Source Check: amounts in Rp million, margins as percentages.
    import openpyxl
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Summary"
    ws.append(["Nusantara Logistics (invented company): management accounts, Rp million"]); ws.append([])
    ws.append(["Revenue by segment", "FY24", "FY25"])
    for name, a, b in [("Consumer", 21000000, 24000000), ("Industrial", 19000000, 22000000), ("Other", 10000000, 12000000), ("Total revenue", 50000000, 58000000)]: ws.append([name, a, b])
    ws.append([]); ws.append(["Leverage", "FY24", "FY25"]); ws.append(["Net debt to EBITDA (x)", 2.6, 2.3]); ws.append(["Covenant (x)", 3.0, 3.0])
    for row in ws.iter_rows(min_row=4, max_row=7, min_col=2, max_col=3):
        for c in row: c.number_format = "#,##0"
    m = wb.create_sheet("Margins"); m.append(["", "Q2 24", "Q3 24", "Q4 24", "Q1 25", "Q2 25", "Q3 25"]); m.append(["EBITDA margin", 0.11, 0.12, 0.09, 0.10, 0.13, 0.14])
    for c in m[2][1:]: c.number_format = "0.0%"
    wb.save(path)

build("app/sample/audit-sample.pptx"); build("app/sample/audit-sample-previous.pptx", previous=True); model("app/sample/audit-sample-model.xlsx")
print("ok")
