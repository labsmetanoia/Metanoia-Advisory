# Magic Layers, Deck Auditor and Chart Builder

Three desktop tools for Metanoia Advisory's Strategic Storytelling & Corporate Communications work, in one app that runs on your computer. Files are not uploaded anywhere.

- **Magic Layers** takes a flattened slide (a screenshot, an exported image, a PDF page, a PowerPoint made of pictures) and separates it into editable layers: live text boxes, shapes, lines and pictures on a repaired background. The result is edited in the app or exported as a normal, editable PowerPoint.
- **Deck Auditor** reads a finished PowerPoint or PDF and checks it against the firm's three promises before it goes out: consulting structure, executive-grade design, numbers that match. It also compares two versions of a deck and writes the change log.
- **Chart Builder** turns a range pasted from Excel, a workbook or a CSV file into native, editable PowerPoint charts in the house style, with the action title, unit line and source line in place.

Switch between them with the tabs at the top left.

![A flat slide separated into text, shapes and pictures](docs/editing-text.jpg)

## Start it

You need Node.js (free, any version from 18 up). If it is not installed, get the LTS version from https://nodejs.org.

| Computer | How to start |
| --- | --- |
| Windows | Double-click `start.bat` |
| macOS | Double-click `start.command` (the first time: right-click, Open, to get past Gatekeeper) |
| Linux | Run `./start.sh` |

The app opens in your browser at http://localhost:4517. Keep the small terminal window open while you work; close it to stop the app. Use a current Chrome or Edge (Firefox should work too).

If you received the app as a zip file, everything it needs is inside and it works offline from the first start. If you took it from the repository instead, the first start downloads its libraries once (about a minute); after that it works offline.

## Use it

1. **Open** a file: drag it onto the window, press Open, or paste an image from the clipboard. "Try the sample slide" shows the idea in ten seconds.
2. **Layers are created** automatically for the first page (5 to 10 seconds for a slide). For a deck, press "Analyse all" above the page list, or do pages one at a time.
3. **Edit**: click to select, drag to move, drag a handle to resize, double-click text to rewrite it. The panel on the right changes font, size, weight, colour, alignment, spacing, corner radius and order. The list on the left hides, locks, renames and reorders layers.
4. **Export** (top right): PowerPoint with live text boxes, native shapes and pictures; a layered Photoshop file; SVG; PNG; or a project file (`.mlayers`) to continue later.

### What it reads

| Input | What happens |
| --- | --- |
| PNG, JPG, WebP, GIF, BMP | Text is read by OCR (English, Indonesian, or both) and rebuilt in the closest typeface on your computer |
| PDF, any number of pages | The PDF's own text is used, so wording and sizes are exact; only the typeface is matched |
| PPTX whose slides are pictures | Each picture slide becomes a page; export returns an editable deck |
| `.mlayers` | A saved Magic Layers project |

### Tools

| Tool | Key | Use |
| --- | --- | --- |
| Select | V | Select, move, resize. Shift-click or drag a rectangle to select several. Alt while dragging switches snapping off |
| Text | T | Click to add a text box in the slide's own style |
| Lift | L | Drag a rectangle around anything still stuck in the background or in a picture; it becomes its own layer and the gap behind it is repaired |
| Hand | H or Space | Move around. Ctrl + wheel zooms |
| Original | hold `\` | Compare with the file as it came in |

Other shortcuts: arrows nudge (Shift: 10 px), Ctrl+Z / Ctrl+Y undo and redo, Ctrl+D duplicate, Delete removes, `[` and `]` change the order, Enter edits the selected text, Ctrl+S saves the project, Ctrl+E exports PowerPoint.

### Getting the best result

- **The Analyse menu** sets the text language, the level of detail (Simple gives fewer, larger layers; Detailed pulls out small elements) and a slower, more thorough text search for dense slides.
- **A logo or icon was turned into text?** Select it and choose "Convert back to picture".
- **Something was left in the background?** Use the Lift tool.
- **Typefaces.** Text is matched against the firm's fonts (Fraunces, Inter, Cormorant Garamond, Manrope are built in) and the fonts installed on your computer. "Apply brand fonts" in the right panel resets a whole page to the house typefaces in one click.
- **PowerPoint fonts.** PowerPoint uses the fonts installed on the computer that opens the file. Install Fraunces and Inter (free from Google Fonts) to see the deck as designed, or choose "PowerPoint with Office fonts" when the file goes to someone without them.
- **Higher resolution reads better.** A slide exported at 1920 px or wider gives cleaner text than a small screenshot.

## Deck Auditor

Open a `.pptx` (full audit) or a PDF (wording, figures and titles), or press "Try the sample deck" to see a deck with known flaws being caught. Nothing needs to be configured.

![The audit overview: findings by pillar](docs/auditor-overview.jpg)

| Pillar | What is checked |
| --- | --- |
| Numbers that match | The same metric and period shown with different values on different slides, in text, tables or chart data. Table totals and total columns that do not equal the sum of their parts. Shares and pie charts that do not make 100%. A growth rate that does not follow from the two figures next to it. A figure in a title that is not in the chart or table below it. Data slides without a source line. English and Indonesian number formats (1,250.5 and 1.250,5) are both understood |
| Consulting structure | Titles that name a topic instead of stating a conclusion; missing, duplicated and over-long titles; no executive summary near the front; no page that states the decision or next steps; slides with more than 150 words; a slide in the other language |
| Executive-grade design | Draft markers left in (TBC, Lorem ipsum, xx%, [brackets]); stray typefaces; title size and position that change from slide to slide; pictures stretched out of proportion or too coarse for their size; text below 9 pt; content past the slide edge; text breaking the left margin; empty placeholders; missing page numbers |

How to work with it:

- **Findings** are on the right, sorted Fix, Check, Polish. Click one for the detail and the slide numbers; click a slide number to see the slide with the area outlined. "Set aside" removes a finding you have judged not to be an issue; it leaves the report.
- **Storyline** lists every title in order with a verdict, which is the "read the titles alone" test. "Copy the titles" puts them on the clipboard.
- **Numbers** is a ledger of every figure that appears more than once, disagreements first, with a search box.
- **Sources** checks the deck against its source of truth: see "Source Check" below.
- **Compare** opens the previous version of the deck. Slides are paired even when pages were added, removed or moved; every change to wording and figures is shown, and "Copy the change log" gives a text version to send to the client.
- **Fix…** repairs the findings that have a mechanical remedy and saves a corrected copy: see "One-click fixes" below.
- **Report** saves the client report (see below), a working report for your own use, the findings as a spreadsheet, or the change log.
- Tick "This is a Metanoia deck" on the Overview to flag every typeface other than the house fonts.

### Client report

The findings list is a working tool. The client report is the document you hand over: the same findings, with your judgement around them.

1. Go through the findings. **Set aside** the ones that are not issues; they are left out of the report.
2. Open a finding and type in **Note for the client report** where you have something to add: which figure is the right one, a suggested title, what to ask the finance team.
3. **Report → Client report…** Choose the report language (English or Bahasa Indonesia), then fill in who it is for, your overall view, and the one page you would rebuild first and why. Leave "Our view" empty and the report states the counts instead.
4. **Save the client report.** It is a single HTML file; open it and print to PDF (A4).

![Client report details](docs/auditor-client-form.jpg)

The report has a cover, your view, the points to fix before the deck goes out, the page to rebuild first, every open finding by pillar with what to do about it and your note, the figure-by-figure reconciliation if you added a source, the storyline title by title, the changes since the previous version if you compared one, and a closing section on how the review was done and what it does not cover.

![Client report](docs/auditor-client-report.jpg)

In Bahasa Indonesia the headings, the findings and the "what to do" lines are all restated in Indonesian; text quoted from the deck stays as the deck has it, and your own notes are printed as you typed them, so write them in the report's language. The tool itself stays in English.

Notes and client details are kept in this browser per file name, so you can close the tool and continue later. They are not written into the deck. Finished examples in both languages, on an invented company, are on the website as `src/root/downloads/deck-audit-sample-en.pdf` and `deck-audit-sample-id.pdf`.

### One-click fixes

![Choosing what to repair](docs/auditor-fix.jpg)

Press **Fix…** (PowerPoint files only). The findings that can be repaired without a decision are listed with a tick box each; untick any you want to leave, then press "Save the corrected copy". A file named like the original with " - fixed" added is saved, and the app switches to that copy so you see what remains. The original file is never changed.

| Finding | What the fix does |
| --- | --- |
| Stray typefaces | Text in a stray typeface is set to the deck's own body typeface (titles to its title typeface); with "This is a Metanoia deck" ticked, to the house fonts |
| Title in another size | The title is set to the size the other titles use. A title PowerPoint has shrunk to fit is left alone: it needs shortening, not resizing |
| Title out of place | The title is moved to where the other titles start |
| Stretched pictures | The picture keeps its place and size and is trimmed to its frame instead of being squeezed, so a little of its edges is cropped |
| Empty placeholders | Deleted |

Everything else (wording, figures, sources, draft markers, low-resolution pictures) needs a decision and is left as a finding. The Compare tab shows the corrected copy against the original. Look through the corrected slides in PowerPoint before sending: a moved title can meet other content, and a trimmed picture can lose something at its edge.

### Source Check

Open the **Sources** tab and choose the file the figures came from: the client's Excel model (`.xlsx`) or a CSV export, or a second document that must say the same thing, such as the annual report or a press release (PDF, Word `.docx`, or another PowerPoint). Several sources can be open at once. With the sample deck, "Use the sample model" shows it working.

![Every figure in the deck looked up in the Excel model](docs/auditor-sources.jpg)

Every figure in the deck is looked up in the source and gets one status:

| Status | Meaning |
| --- | --- |
| Confirmed | The source holds the same value under labels that agree (the row and column heads in a workbook, the sentence or table in a document). Amounts are matched across scales, so a model in Rp million confirms a deck in Rp trillion, and rounded to the precision the deck shows |
| Differs | The source holds the same metric and period with another value. These become "Fix" findings, with the cell reference or page |
| Derived | A percentage that equals the growth between two values in a row of the model, or a row's share of the total |
| Value found | The number is in the source, but under labels that could not be matched. Look before relying on it |
| Not found | Nothing in the source corresponds. The figure may be calculated, come from elsewhere, or be worded differently there |

The results join the findings list and the audit report. Keep in mind: matching is by labels, so a model with terse or coded row names confirms less; a workbook's formula cells are read from their last saved result; and when the source is a document that covers only part of the deck, many "not found" figures are expected.

What to keep in mind:

- The checks find patterns, not meaning. Figures are matched by the words around them, so now and then two different metrics are paired, or the same metric worded differently on two slides is missed. A finding is a prompt to look; a clean report does not replace a read-through.
- A chart pasted as a picture has no data to read. Run such slides through Magic Layers first, or audit the source file.
- The slide preview is a layout sketch built from the file (text, tables, pictures, chart data). It is for locating a finding, not for judging the design. PDFs are shown exactly.
- A PDF has no placeholders, tables or chart data, so totals, chart figures and typefaces are checked only in the PowerPoint file. Portrait PDFs are read as reports and the slide rules for density and type size are skipped.
- Old `.ppt` files must be saved as `.pptx` first.

### The same rules on the website

The website's free deck check (`src/pages/deck-check.njk` in the repository) runs these same modules in the visitor's browser: `pptx.js`, `pdfdeck.js`, `numbers.js`, `checks.js`, `id.js` and the action lines from `report.js` are copied into the site at build time. A change to a rule here changes the website at its next deploy, so run `npm test` here and `npm run test:deck-check` in the repository root before pushing.

## Chart Builder

Open the Chart Builder tab. It starts with a sample chart; replace its data and wording, or press "+ New chart".

![A stacked chart with totals and a growth note](docs/charts-stacked.jpg)

1. **Data.** Copy a range in Excel, click the first cell of the grid and press Ctrl+V. Or press Open for an `.xlsx` workbook (pick the sheet under the grid) or a CSV file, or type into the grid. The first row holds the series names, the first column the categories; "Swap" turns the table round. Percentages, thousands separators, brackets for negatives and Indonesian number formats are understood.
2. **Chart type.** Columns, bars, stacked, 100% stacked, line, pie or doughnut, and bridge (waterfall).
3. **Wording.** Click the title, the unit line and the source line on the preview and type. The title should state the conclusion the chart proves.
4. **Options.** Highlight one bar or one series in gold and mute the rest; order bars by size; number format and unit; a growth note (change from first to last, or CAGR); values on or off.
5. **Export.** PowerPoint (this chart, or all charts as one deck), PNG or SVG. Save keeps the whole set as a file; the set is also kept in this browser between sessions.

In PowerPoint each chart is a normal chart: right-click it and choose Edit Data to change the numbers, and restyle it with PowerPoint's own tools. Colours, labels and totals follow the data.

Before a chart leaves, the builder checks it and shows a warning under the preview when a figure in the title is not in the data, when pie shares do not make 100%, when a bridge's steps do not add up to its closing total, or when the title or source line is missing. Charts made here carry their data, so the Deck Auditor can check them against the rest of the deck.

What to keep in mind:

- The data is embedded in the chart, not linked to the workbook. When the source changes, paste the new range and export again, or edit the data in PowerPoint.
- The preview is close to, not identical with, what PowerPoint draws: axis scaling and label placement are PowerPoint's own.
- A bridge is built as a stacked chart with an invisible base, the usual technique. Its labels sit inside the bars, and a bridge that passes below zero is not drawn correctly.
- In a stacked chart the totals above the bars come from a hidden "Total" series: if you edit the data in PowerPoint, update that column as well. A 100% chart stores the shares, not the amounts.
- A formula cell in a workbook is read from its last saved result. Old `.xls` files must be saved as `.xlsx` first.

## Brand kit

`app/brand.json` holds the house typefaces and colour swatches shown in the editor. Edit it to add colours or to change the heading and body typefaces.

## AI assist (optional)

Everything above works offline with no account. If you add an Anthropic API key, an "AI assist" button appears: Claude looks at the slide, corrects misread words, recovers text the local pass missed and gives the layers meaningful names.

1. Run `npm install` once in this folder (if you have not already).
2. Copy `.env.example` to `.env` and paste the key after `ANTHROPIC_API_KEY=`.
3. Restart the app.

With AI assist, the image of the slide you run it on is sent to the Anthropic API. The same key switches on "Review the storyline with AI" in the Deck Auditor, which sends the deck's titles and slide text (not pictures) for a partner-style comment on the argument. Nothing is sent when you do not use these buttons. For confidential client material, leave them alone.

## How it compares with Canva's Magic Layers

Canva announced Magic Layers in March 2026 as a cloud feature that turns a single flat PNG or JPG into an editable Canva design, with text restored as text boxes. This tool follows the same idea and goes further where the firm's work needs it:

| | Canva Magic Layers (as announced) | This tool |
| --- | --- | --- |
| Where files go | Uploaded to Canva | Stay on your computer |
| Input | One PNG or JPG | Images, multi-page PDF, picture-slide PowerPoint |
| Text from PDFs | n/a | Exact, from the file |
| Output | A Canva design | Editable PowerPoint, layered PSD, SVG, PNG, project file |
| Languages | Not stated | English and Indonesian OCR built in |
| Brand | Canva brand kit | One-click house typefaces, house colours |
| Cost | Canva plan and AI allowance | None (AI assist optional, pay per use) |

Where Canva is stronger: it uses large generative models, so it can rebuild complex artwork behind objects and separate overlapping photographic elements. This tool repairs backgrounds by filling from the surroundings, which is clean on flat, gradient and lightly textured backgrounds and visibly soft on busy photographs.

## Limits to know

- OCR is not perfect. Small or low-contrast text, text inside photographs, and unusual display faces can be misread; check wording before a deck goes out. PDFs do not have this problem.
- Typeface matching chooses among fonts on your computer. If the original face is not installed, the closest one is used and the text may be a little wider or narrower.
- Charts become shapes and text, not live PowerPoint charts.
- Rotated text and text along curves stay in the picture.
- Very large pages are worked on at 2,400 px on the long side.

## Checking that it works

`npm test` starts the app on a spare port, checks that it serves correctly and runs the Deck Auditor's number and title rules. When Playwright is available it also drives the real app: it separates the sample slide, a picture deck and an eight-page PDF, edits, and verifies every export; then it audits a sample deck with fifteen planted flaws, expects exactly those fifteen findings, compares it with its previous version, reconciles it against an Excel model and a Word document, and applies the one-click fixes, expecting the five mechanical findings to be gone from the corrected file and the other ten to remain. Last, it builds five charts, exports them to PowerPoint, inspects the chart parts and runs the result through the Deck Auditor.

## Files

| Path | What it is |
| --- | --- |
| `start.bat`, `start.command`, `start.sh` | Launchers |
| `server.mjs` | Local server (answers only to this computer) |
| `ai-assist.mjs`, `ai-storyline.mjs` | Optional AI endpoints (Magic Layers text check, Deck Auditor storyline review) |
| `app/auditor.html`, `app/js/audit/` | The Deck Auditor: PowerPoint and PDF readers, the checks, version compare, report |
| `app/charts.html`, `app/js/charts/` | The Chart Builder: data readers, preview, PowerPoint export |
| `app/` | The application: interface, analysis worker, importers, exporters |
| `app/vendor/` | Bundled libraries: Tesseract OCR with English and Indonesian data, pdf.js, PptxGenJS, JSZip, ag-psd |
| `app/brand.json` | House typefaces and colours |
| `test/` | Self-test and sample files |

Trouble starting: "Port 4517 is used by another program" means something else has the port; start with another one (`PORT=4600 node server.mjs`, on Windows `set PORT=4600 && node server.mjs`). If the browser shows a blank page, check the terminal window for a message and that the browser is up to date.
