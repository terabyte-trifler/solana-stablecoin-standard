#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DOC_FILES = [
  path.join(REPO_ROOT, "README.md"),
  ...fs
    .readdirSync(path.join(REPO_ROOT, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(REPO_ROOT, "docs", f)),
];

const LINK_RE = /!?\[[^\]]*]\(([^)]+)\)/g;

function stripCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function loadMarkdownAnchors(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  const anchors = new Set();

  for (const line of lines) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (!m) continue;
    anchors.add(slugify(m[1]));
  }

  return anchors;
}

function isExternal(link) {
  return (
    link.startsWith("http://") ||
    link.startsWith("https://") ||
    link.startsWith("mailto:")
  );
}

function splitHash(link) {
  const idx = link.indexOf("#");
  if (idx === -1) return { filePart: link, anchor: "" };
  return { filePart: link.slice(0, idx), anchor: link.slice(idx + 1) };
}

function checkLinks(filePath, errors) {
  const raw = fs.readFileSync(filePath, "utf8");
  const text = stripCodeBlocks(raw);

  let m;
  while ((m = LINK_RE.exec(text)) !== null) {
    const link = m[1].trim();
    if (!link || isExternal(link)) continue;

    // local in-page anchor only
    if (link.startsWith("#")) {
      const anchor = link.slice(1);
      const anchors = loadMarkdownAnchors(filePath);
      if (!anchors.has(anchor)) {
        errors.push(`${path.relative(REPO_ROOT, filePath)}: missing anchor #${anchor}`);
      }
      continue;
    }

    const { filePart, anchor } = splitHash(link);
    const resolved = path.resolve(path.dirname(filePath), filePart);
    if (!fs.existsSync(resolved)) {
      errors.push(
        `${path.relative(REPO_ROOT, filePath)}: missing file target ${filePart}`
      );
      continue;
    }

    if (anchor && resolved.endsWith(".md")) {
      const anchors = loadMarkdownAnchors(resolved);
      if (!anchors.has(anchor)) {
        errors.push(
          `${path.relative(REPO_ROOT, filePath)}: missing anchor #${anchor} in ${filePart}`
        );
      }
    }
  }
}

function checkPlaceholders(filePath, errors) {
  const text = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(REPO_ROOT, filePath);

  const checks = [
    { re: /\bTBD\b/g, label: "TBD placeholder" },
    { re: /<your[^>]*>/gi, label: "template placeholder" },
  ];

  for (const c of checks) {
    if (c.re.test(text)) {
      errors.push(`${rel}: found ${c.label}`);
    }
  }
}

function main() {
  const errors = [];

  for (const filePath of DOC_FILES) {
    checkLinks(filePath, errors);
    checkPlaceholders(filePath, errors);
  }

  if (errors.length > 0) {
    console.error("Docs sanity check failed:");
    for (const e of errors) console.error(`- ${e}`);
    process.exit(1);
  }

  console.log(`Docs sanity check passed (${DOC_FILES.length} files).`);
}

main();

