#!/usr/bin/env node
/**
 * Pre-flight diagnostic: scans an HTML file for every asset reference,
 * resolves each path against the filesystem, and reports what's missing.
 *
 * Also reports the required serve-root directory (the same computation
 * html-to-pdf.js uses internally), so you can verify it before exporting.
 *
 * Usage:  node check-assets.js <file.html>
 * Exit:   0 if all local assets found, 1 if any are missing.
 */

const path = require("path");
const fs = require("fs");

const input = process.argv[2];
if (!input) {
  console.error("Usage: node check-assets.js <file.html>");
  process.exit(1);
}

const htmlPath = path.resolve(input);
if (!fs.existsSync(htmlPath)) {
  console.error(`File not found: ${htmlPath}`);
  process.exit(1);
}

const htmlDir = path.dirname(htmlPath);

// ---------------------------------------------------------------------------

function isExternal(ref) {
  return (
    !ref ||
    ref.startsWith("http") ||
    ref.startsWith("//") ||
    ref.startsWith("data:") ||
    ref.startsWith("#") ||
    ref.startsWith("javascript:")
  );
}

function extractRefs(content) {
  const out = [];
  const patterns = [
    { re: /(?:src|href|poster)=["']([^"']+)["']/gi, multi: false },
    { re: /srcset=["']([^"']+)["']/gi, multi: true },
    { re: /url\(["']?([^"')]+)["']?\)/gi, multi: false },
  ];
  for (const { re, multi } of patterns) {
    for (let m; (m = re.exec(content)); ) {
      const entries = multi
        ? m[1].split(",").map((s) => s.trim().split(/\s+/)[0])
        : [m[1]];
      for (const e of entries) out.push(e);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

const htmlContent = fs.readFileSync(htmlPath, "utf8");
const htmlRefs = extractRefs(htmlContent);

const cssRefs = [];
const cssLinks = [
  ...htmlContent.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/gi),
];
for (const m of cssLinks) {
  if (isExternal(m[1])) continue;
  const cssFile = path.resolve(htmlDir, m[1]);
  if (!fs.existsSync(cssFile)) continue;
  const cssDir = path.dirname(cssFile);
  const cssLabel = path.relative(htmlDir, cssFile);
  for (const ref of extractRefs(fs.readFileSync(cssFile, "utf8"))) {
    const absResolved = path.resolve(cssDir, ref);
    cssRefs.push({ ref, resolved: absResolved, source: cssLabel });
  }
}

// ---------------------------------------------------------------------------

console.log(`\nScanning: ${htmlPath}\n`);

let found = 0;
let missing = 0;
let external = 0;
let maxDepth = 0;

function trackDepth(relativeRef) {
  let d = 0;
  for (const seg of path.normalize(relativeRef).split(path.sep)) {
    if (seg === "..") d++;
    else break;
  }
  if (d > maxDepth) maxDepth = d;
}

for (const ref of htmlRefs) {
  if (isExternal(ref)) {
    console.log(`  \u2298  ${ref.length > 80 ? ref.slice(0, 77) + "\u2026" : ref}  (external)`);
    external++;
    continue;
  }
  const resolved = path.resolve(htmlDir, ref);
  trackDepth(ref);
  if (fs.existsSync(resolved)) {
    console.log(`  \u2713  ${ref}`);
    found++;
  } else {
    console.log(`  \u2717  ${ref}  \u2192  ${resolved}  (NOT FOUND)`);
    missing++;
  }
}

for (const { ref, resolved, source } of cssRefs) {
  if (isExternal(ref)) {
    external++;
    continue;
  }
  trackDepth(path.relative(htmlDir, resolved));
  if (fs.existsSync(resolved)) {
    console.log(`  \u2713  ${ref}  (via ${source})`);
    found++;
  } else {
    console.log(`  \u2717  ${ref}  \u2192  ${resolved}  (NOT FOUND, via ${source})`);
    missing++;
  }
}

let serveRoot = htmlDir;
for (let i = 0; i < maxDepth; i++) serveRoot = path.dirname(serveRoot);

console.log(
  `\n  Found: ${found}  Missing: ${missing}  External: ${external}`,
);
console.log(
  `  Server root: ${serveRoot} (${maxDepth} level${maxDepth !== 1 ? "s" : ""} above HTML)\n`,
);

process.exit(missing > 0 ? 1 : 0);
