---
name: html-to-pdf
description: Convert HTML pages to pixel-perfect PDF files. Use when the user asks to export HTML to PDF, convert a presentation to PDF, generate a PDF from a webpage, or needs a faithful PDF reproduction of any HTML content.
---

# HTML to PDF — Pixel-Perfect Export

## Quick Start

The universal script handles both presentations (Reveal.js) and scrollable pages automatically.

### Prerequisites (one-time)

```bash
cd /tmp && npm install puppeteer pdf-lib
```

### Run

```bash
node .agents/skills/productivity/html-to-pdf/html-to-pdf.js <input> <output.pdf> [--width=N]
```

- `<input>` — URL (`http://...`) or local file path. Local files get an auto-started server.
- `--width` — viewport width override (defaults: 1200 for pages, auto-detected for Reveal.js)

### Pre-flight asset check (recommended)

Before exporting, verify all referenced assets are resolvable:

```bash
node .agents/skills/productivity/html-to-pdf/check-assets.js <file.html>
```

Reports every `src`, `href`, `srcset`, `poster`, CSS `url()`, and inline-style reference. Exits 0 if all local assets found, 1 if any are missing. Also prints the computed server root so you can confirm the export will serve from the right directory.

### Examples

```bash
# Check assets first
node .agents/skills/productivity/html-to-pdf/check-assets.js slides.html

# Scrollable report page
node .agents/skills/productivity/html-to-pdf/html-to-pdf.js report.html report.pdf

# Reveal.js presentation
node .agents/skills/productivity/html-to-pdf/html-to-pdf.js slides.html slides.pdf

# Custom width
node .agents/skills/productivity/html-to-pdf/html-to-pdf.js dashboard.html dash.pdf --width=1400
```

## How It Works

The script auto-detects the page type by checking for `window.Reveal`:

| Type                | Detection                | Method                                                                             |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------- |
| **Reveal.js**       | `window.Reveal` exists   | Screenshot each slide at native resolution (2x retina) → assemble PNGs via pdf-lib |
| **Scrollable page** | No JS framework detected | Puppeteer `page.pdf()` with `printBackground: true`, page width = viewport (1:1)   |

### Why two strategies?

- **Presentations**: `page.pdf()` and `?print-pdf` both mangle Reveal.js layouts. Screenshots are the only way to get 1:1 output.
- **Scrollable pages**: `page.pdf()` preserves selectable text, respects `@media print` CSS, and handles page breaks naturally. Screenshots would lose text selectability and produce worse page breaks.

## Troubleshooting

| Problem                          | Fix                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Fonts render as fallback         | The script already waits for `networkidle0` + 2.5s settle. If still wrong, the font CDN may be blocked — check network. |
| Reveal.js controls visible       | The script hides them automatically. If custom controls exist, add CSS selectors to the `addStyleTag` call.             |
| Content clipped in presentation  | Check if the presentation has custom viewport dimensions that differ from Reveal.js config `width`/`height`.            |
| Content too big / clipped        | Never use A4 format for wide HTML — the script matches PDF page width to viewport width to avoid scaling artifacts.     |
| Colors missing in scrollable PDF | Verify the HTML has `print-color-adjust: exact` in its CSS. The script sets `printBackground: true`.                    |
| Local images not loading         | Run `check-assets.js` to diagnose. The exporter auto-detects `../` depth in src, href, url(), srcset, poster, and linked CSS, then serves from a high-enough ancestor directory. |

## Customization

For edge cases the universal script doesn't cover, read the script source at `.agents/skills/productivity/html-to-pdf/html-to-pdf.js` and adapt. Common modifications:

- **Multi-URL sites**: Replace the single `page.goto` with a URL array loop
- **Custom frameworks** (Marp, Slidev, etc.): Add detection + navigation logic following the Reveal.js pattern
- **Screenshot-based scrollable export**: Replace `exportScrollablePage` with viewport-chunked screenshots if `page.pdf()` doesn't match the visual output
