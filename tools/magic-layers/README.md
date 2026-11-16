# Magic Layers

A desktop tool for Metanoia Advisory's Strategic Storytelling & Corporate Communications work. It takes a flattened slide (a screenshot, an exported image, a PDF page, a PowerPoint made of pictures) and separates it into editable layers: live text boxes, shapes, lines and pictures on a repaired background. The result is edited in the app or exported as a normal, editable PowerPoint.

It runs on your computer. Files are not uploaded anywhere.

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

## Brand kit

`app/brand.json` holds the house typefaces and colour swatches shown in the editor. Edit it to add colours or to change the heading and body typefaces.

## AI assist (optional)

Everything above works offline with no account. If you add an Anthropic API key, an "AI assist" button appears: Claude looks at the slide, corrects misread words, recovers text the local pass missed and gives the layers meaningful names.

1. Run `npm install` once in this folder (if you have not already).
2. Copy `.env.example` to `.env` and paste the key after `ANTHROPIC_API_KEY=`.
3. Restart the app.

With AI assist, the image of the slide you run it on is sent to the Anthropic API. Nothing is sent when you do not use it. For confidential client material, leave it off.

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

`npm test` starts the app on a spare port and checks that it serves correctly. When Playwright is available it also drives the real app: it separates the sample slide, a picture deck and an eight-page PDF, edits, and verifies the exported PowerPoint, PSD, SVG, PNG and project files.

## Files

| Path | What it is |
| --- | --- |
| `start.bat`, `start.command`, `start.sh` | Launchers |
| `server.mjs` | Local server (answers only to this computer) |
| `ai-assist.mjs` | Optional AI assist endpoint |
| `app/` | The application: interface, analysis worker, importers, exporters |
| `app/vendor/` | Bundled libraries: Tesseract OCR with English and Indonesian data, pdf.js, PptxGenJS, JSZip, ag-psd |
| `app/brand.json` | House typefaces and colours |
| `test/` | Self-test and sample files |

Trouble starting: "Port 4517 is used by another program" means something else has the port; start with another one (`PORT=4600 node server.mjs`, on Windows `set PORT=4600 && node server.mjs`). If the browser shows a blank page, check the terminal window for a message and that the browser is up to date.
