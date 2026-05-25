#!/usr/bin/env node
/**
 * Universal HTML → PDF exporter.
 *
 * Detects the page type automatically:
 *   - Reveal.js presentation → screenshot each slide, assemble via pdf-lib
 *   - Scrollable page        → Puppeteer page.pdf() with printBackground
 *
 * Usage:
 *   node html-to-pdf.js <input> <output.pdf> [--width=1200]
 *
 *   <input>  URL (http://...) or local file path
 *   --width  Viewport width (default: 1280 for presentations, 1200 for pages)
 *
 * Prerequisites (install once):
 *   cd /tmp && npm install puppeteer pdf-lib
 */

const path = require("path");
const fs = require("fs");
const http = require("http");

// Resolve deps from /tmp/node_modules if not found locally
const MODULE_DIRS = [
  path.join(__dirname, "node_modules"),
  "/tmp/node_modules",
  ...require("module").globalPaths,
];
function resolveModule(name) {
  for (const dir of MODULE_DIRS) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return require(p);
  }
  return require(name);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? "true"];
    }),
);

if (args.length < 2) {
  console.error("Usage: node html-to-pdf.js <input> <output.pdf> [--width=N]");
  process.exit(1);
}

const [input, output] = args;
const widthOverride = flags.width ? parseInt(flags.width) : null;

// ---------------------------------------------------------------------------
// Asset-path extraction & serve-root computation.
//
// Scans an HTML file (and any locally-linked CSS) for every relative path
// reference — src, href, srcset, poster, url(), inline style backgrounds —
// then determines the minimum ancestor directory needed to cover them all.
// ---------------------------------------------------------------------------

function extractRelativePaths(content) {
  const refs = [];
  const skip = (r) =>
    !r ||
    r.startsWith("http") ||
    r.startsWith("//") ||
    r.startsWith("data:") ||
    r.startsWith("#") ||
    r.startsWith("javascript:");
  const patterns = [
    /(?:src|href|poster)=["']([^"']+)["']/gi,
    /srcset=["']([^"']+)["']/gi,
    /url\(["']?([^"')]+)["']?\)/gi,
  ];
  for (const re of patterns) {
    for (let m; (m = re.exec(content)); ) {
      const entries =
        re === patterns[1]
          ? m[1].split(",").map((s) => s.trim().split(/\s+/)[0])
          : [m[1]];
      for (const e of entries) if (!skip(e)) refs.push(e);
    }
  }
  return refs;
}

function computeServeRoot(htmlPath) {
  const htmlDir = path.dirname(path.resolve(htmlPath));
  const html = fs.readFileSync(htmlPath, "utf8");
  const allPaths = extractRelativePaths(html);

  const cssLinks = [...html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi)];
  for (const m of cssLinks) {
    if (m[1].startsWith("http") || m[1].startsWith("//")) continue;
    const cssFile = path.resolve(htmlDir, m[1]);
    if (!fs.existsSync(cssFile)) continue;
    const cssDir = path.dirname(cssFile);
    for (const ref of extractRelativePaths(fs.readFileSync(cssFile, "utf8"))) {
      allPaths.push(path.relative(htmlDir, path.resolve(cssDir, ref)));
    }
  }

  let maxDepth = 0;
  for (const p of allPaths) {
    let depth = 0;
    for (const seg of path.normalize(p).split(path.sep)) {
      if (seg === "..") depth++;
      else break;
    }
    if (depth > maxDepth) maxDepth = depth;
  }

  let root = htmlDir;
  for (let i = 0; i < maxDepth; i++) root = path.dirname(root);
  return { root, depth: maxDepth, assetCount: allPaths.length };
}

// ---------------------------------------------------------------------------
// Local file server (only when input is a file path)
// ---------------------------------------------------------------------------

function serveDirectory(dir) {
  return new Promise((resolve) => {
    const handler = (req, res) => {
      const filePath = path.resolve(dir, decodeURIComponent(req.url).slice(1));
      if (!filePath.startsWith(dir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime =
          {
            ".html": "text/html",
            ".css": "text/css",
            ".js": "application/javascript",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".woff2": "font/woff2",
            ".woff": "font/woff",
            ".ttf": "font/ttf",
            ".mp4": "video/mp4",
          }[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": mime });
        res.end(data);
      });
    };
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const puppeteer = resolveModule("puppeteer");

  let url = input;
  let localServer = null;

  // If input is a file path, spin up a local server rooted high enough
  // to cover any ../ asset references in the HTML.
  if (!input.startsWith("http://") && !input.startsWith("https://")) {
    const absPath = path.resolve(input);
    if (!fs.existsSync(absPath)) {
      console.error(`File not found: ${absPath}`);
      process.exit(1);
    }
    const { root: serveRoot, depth, assetCount } = computeServeRoot(absPath);
    const relHtmlPath = path.relative(serveRoot, absPath);
    localServer = await serveDirectory(serveRoot);
    url = `http://127.0.0.1:${localServer.port}/${relHtmlPath}`;
    console.log(`Serving ${serveRoot} on port ${localServer.port} (${assetCount} refs, ../ depth: ${depth})`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Initial load to detect page type
    const defaultW = widthOverride || 1280;
    await page.setViewport({
      width: defaultW,
      height: 720,
      deviceScaleFactor: 2,
    });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    // Detect Reveal.js
    const isReveal = await page.evaluate(
      () => typeof window.Reveal !== "undefined",
    );

    if (isReveal) {
      await exportPresentation(page, defaultW);
    } else {
      await exportScrollablePage(page, defaultW);
    }

    console.log(`Done → ${output}`);
  } finally {
    await browser.close();
    if (localServer) localServer.server.close();
  }

  // -------------------------------------------------------------------------
  // Presentation export (screenshot per slide → pdf-lib)
  // -------------------------------------------------------------------------
  async function exportPresentation(page, viewportW) {
    const { PDFDocument } = resolveModule("pdf-lib");

    await page.waitForFunction(() => window.Reveal.isReady(), {
      timeout: 15000,
    });

    const { width: slideW, height: slideH } = await page.evaluate(() => {
      const config = window.Reveal.getConfig();
      return { width: config.width || 960, height: config.height || 700 };
    });

    await page.setViewport({
      width: slideW,
      height: slideH,
      deviceScaleFactor: 2,
    });
    await page.evaluate(() => window.Reveal.layout());
    await page.evaluate(() => {
      window.Reveal.configure({ controls: false, progress: false });
    });
    await page.addStyleTag({
      content: `
        .reveal .controls, .reveal .progress, .reveal .slide-number { display: none !important; }
        .reveal .slides section { overflow: hidden !important; }
      `,
    });

    await new Promise((r) => setTimeout(r, 2500));

    const total = await page.evaluate(() => window.Reveal.getTotalSlides());
    console.log(`Presentation: ${total} slides @ ${slideW}x${slideH}`);

    const pngPaths = [];
    for (let i = 0; i < total; i++) {
      await page.evaluate((idx) => window.Reveal.slide(idx), i);
      await new Promise((r) => setTimeout(r, 400));
      const p = path.join("/tmp", `_slide_${String(i).padStart(3, "0")}.png`);
      await page.screenshot({ path: p, type: "png" });
      pngPaths.push(p);
      process.stdout.write(`  Slide ${i + 1}/${total}\r`);
    }
    console.log();

    const pdfDoc = await PDFDocument.create();
    for (const pngPath of pngPaths) {
      const img = await pdfDoc.embedPng(fs.readFileSync(pngPath));
      const pg = pdfDoc.addPage([slideW, slideH]);
      pg.drawImage(img, { x: 0, y: 0, width: slideW, height: slideH });
    }
    fs.writeFileSync(output, await pdfDoc.save());
    pngPaths.forEach((p) => fs.unlinkSync(p));

    const mb = (fs.statSync(output).size / (1024 * 1024)).toFixed(1);
    console.log(`  ${total} pages, ${mb} MB`);
  }

  // -------------------------------------------------------------------------
  // Scrollable page export (Puppeteer page.pdf)
  // -------------------------------------------------------------------------
  async function exportScrollablePage(page, viewportW) {
    const w = widthOverride || 1200;
    await page.setViewport({ width: w, height: 800, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));

    // Page width matches viewport so content renders at exactly 1:1 scale.
    // Height uses A4 aspect ratio (297/210) relative to the width.
    const pageH = Math.round(w * (297 / 210));
    console.log(`  Viewport: ${w}px, page: ${w}×${pageH}px`);

    await page.pdf({
      path: output,
      printBackground: true,
      preferCSSPageSize: false,
      width: `${w}px`,
      height: `${pageH}px`,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const mb = (fs.statSync(output).size / (1024 * 1024)).toFixed(1);
    const pages =
      fs
        .readFileSync(output)
        .toString("latin1")
        .match(/\/Type\s+\/Page[^s]/g)?.length || "?";
    console.log(`  ${pages} pages, ${mb} MB`);
  }
})();
