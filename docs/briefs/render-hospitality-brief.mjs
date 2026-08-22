#!/usr/bin/env node
/**
 * Render ERA-Hospitality-Capability-Brief.md → HTML → PDF (Chrome headless).
 * UTF-8 only. Run from repo root: node docs/briefs/render-hospitality-brief.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mdPath = path.join(here, "ERA-Hospitality-Capability-Brief.md");
const htmlPath = path.join(here, "ERA-Hospitality-Capability-Brief.html");
const pdfPath = path.join(here, "ERA-Hospitality-Capability-Brief.pdf");

function assertUtf8(file) {
  const buf = fs.readFileSync(file);
  if (buf.length >= 2 && buf[1] === 0) {
    throw new Error(`${file} looks like UTF-16LE — convert before render`);
  }
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(file, buf.subarray(3));
    console.log("stripped BOM", file);
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let inUl = false;
  let inOl = false;
  let tableRows = [];

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const flushTable = () => {
    if (!tableRows.length) return;
    const rows = tableRows.filter((r) => !/^\s*\|?\s*:?-/.test(r));
    out.push('<table>');
    rows.forEach((row, idx) => {
      const cells = row
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      const tag = idx === 0 ? "th" : "td";
      out.push(
        `<tr>${cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("")}</tr>`,
      );
    });
    out.push("</table>");
    tableRows = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("|")) {
      closeLists();
      tableRows.push(line);
      i += 1;
      continue;
    }
    if (tableRows.length) flushTable();

    if (line.trim() === "") {
      closeLists();
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      closeLists();
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(escapeHtml(lines[i]));
        i += 1;
      }
      out.push(`<pre><code>${buf.join("\n")}</code></pre>`);
      i += 1;
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      const level = h[1].length;
      const id = h[2]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      out.push(`<h${level} id="${id}">${inline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      closeLists();
      const quote = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quote.push(inline(lines[i].slice(2)));
        i += 1;
      }
      out.push(`<blockquote>${quote.join("<br/>")}</blockquote>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeLists();
      out.push("<hr/>");
      i += 1;
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      i += 1;
      continue;
    }

    const ol = /^(\d+)\.\s+(.*)$/.exec(line);
    if (ol) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${inline(ol[2])}</li>`);
      i += 1;
      continue;
    }

    closeLists();
    out.push(`<p>${inline(line)}</p>`);
    i += 1;
  }
  flushTable();
  closeLists();
  return out.join("\n");
}

const css = `
@page { size: A4; margin: 16mm 14mm 18mm 14mm; }
:root { color-scheme: light; }
html, body { background: #fff; }
body {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.45;
  color: #1a1a1a;
  max-width: 190mm;
  margin: 0 auto;
}
h1 { font-size: 20pt; margin: 0 0 10pt; line-height: 1.2; }
h2 { font-size: 14pt; margin: 22pt 0 8pt; page-break-after: avoid; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
h3 { font-size: 12pt; margin: 16pt 0 6pt; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
blockquote {
  margin: 10pt 0;
  padding: 8pt 12pt;
  background: #f4f6f8;
  border-left: 4px solid #1f4e79;
}
table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #c5c5c5; padding: 4pt 6pt; vertical-align: top; text-align: left; }
th { background: #1f4e79; color: #fff; font-weight: 600; }
tr:nth-child(even) td { background: #f7f9fb; }
code { font-family: Consolas, "Courier New", monospace; font-size: 8.5pt; background: #eef1f4; padding: 0 3pt; }
pre { background: #eef1f4; padding: 8pt; overflow: hidden; font-size: 8.5pt; }
hr { border: 0; border-top: 1px solid #ddd; margin: 16pt 0; }
a { color: #1f4e79; text-decoration: none; }
.cover-meta { color: #444; font-size: 9.5pt; margin-bottom: 14pt; }
`;

assertUtf8(mdPath);
const md = fs.readFileSync(mdPath, "utf8");
const body = mdToHtml(md);
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>ERA Hospitality Stack — Capability Brief</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.writeFileSync(htmlPath, html, "utf8");
console.log("wrote", htmlPath);

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);

const chrome = chromeCandidates.find((p) => fs.existsSync(p));
if (!chrome) {
  throw new Error("Chrome/Edge not found — set CHROME_PATH");
}

const fileUrl = pathToFileURL(htmlPath).href;
const args = [
  "--headless=new",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${pdfPath}`,
  fileUrl,
];
const result = spawnSync(chrome, args, { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const pdf = fs.readFileSync(pdfPath);
if (pdf.subarray(0, 4).toString() !== "%PDF") {
  throw new Error("output is not a PDF");
}
console.log("wrote", pdfPath, `(${pdf.length} bytes)`);
