#!/usr/bin/env node
/**
 * Cursor stop hook — nudge acceptance closeout once when product files change.
 *
 * Cursor sends status "completed" on every stop, including plain questions.
 * Follow-up fires only when the *relevant* workspace digest differs from the
 * last stop. Questions with no product-file edits stay quiet.
 *
 * Stamp lives under .git/ (local, not committed) so temp clears do not reset
 * baseline and re-fire on the next question.
 *
 * loop_count > 0 refreshes the stamp and stays quiet (closeout edits).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Paths that can affect acceptance / product closeout. */
function isRelevantPath(rel) {
  const p = rel.replace(/\\/g, "/");
  if (p.startsWith("era-")) return true;
  if (p.startsWith("packages/")) return true;
  if (p.startsWith("docs/acceptance/")) return true;
  if (p.startsWith("docs/adr/")) return true;
  if (p.startsWith("docs/editions/")) return true;
  if (p === "docs/COVERAGE_MATRIX.md") return true;
  if (p.startsWith("docs/COVERAGE_MATRIX")) return true;
  if (p === "docs/READINESS_MATRIX.md") return true;
  if (p.startsWith(".cursor/hooks/")) return false;
  return false;
}

function readInput() {
  try {
    const raw = readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function gitCapture(args) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 8000,
      windowsHide: true,
    });
  } catch {
    return "";
  }
}

function unquoteGitPath(path) {
  if (!(path.startsWith('"') && path.endsWith('"'))) return path;
  try {
    return JSON.parse(path);
  } catch {
    return path.slice(1, -1);
  }
}

function fileDigest(relPath) {
  try {
    const abs = join(process.cwd(), relPath);
    if (!statSync(abs).isFile()) return "not-a-file";
    return createHash("sha256").update(readFileSync(abs)).digest("hex");
  } catch {
    return "missing";
  }
}

/**
 * HEAD + porcelain + contents of relevant dirty paths only.
 * Empty string if git cannot be read.
 */
function workspaceStamp() {
  const head = gitCapture(["rev-parse", "HEAD"]).replace(/\r\n/g, "\n").trim();
  if (!head) return "";
  const porcelain = gitCapture(["status", "--porcelain", "--untracked-files=all"])
    .replace(/\r\n/g, "\n")
    .trim();
  const paths = [];
  for (const line of porcelain.split("\n")) {
    if (line.length < 4) continue;
    const pathPart = line.slice(3);
    const arrow = pathPart.lastIndexOf(" -> ");
    const rel = unquoteGitPath(arrow === -1 ? pathPart : pathPart.slice(arrow + 4));
    if (isRelevantPath(rel)) paths.push(rel);
  }
  paths.sort();
  const hash = createHash("sha256");
  hash.update(head);
  hash.update("\0");
  hash.update(paths.join("\n"));
  for (const rel of paths) {
    hash.update("\0");
    hash.update(rel);
    hash.update("\0");
    hash.update(fileDigest(rel));
  }
  return hash.digest("hex");
}

function stampPath() {
  const gitDir = join(process.cwd(), ".git");
  if (existsSync(gitDir)) {
    return join(gitDir, "era-stop-closeout.stamp");
  }
  return join(process.cwd(), ".era-stop-closeout.stamp");
}

function readStamp(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

function writeStamp(path, value) {
  try {
    const dir = join(path, "..");
    if (!existsSync(dir) && path.includes(".git")) {
      // .git always exists when stampPath chose it
    }
    writeFileSync(path, value, "utf8");
  } catch {
    // Missing stamp must not loop.
  }
}

const input = readInput();
const loopCount = Number(input.loop_count || input.followup_count || 0);
const path = stampPath();
const current = workspaceStamp();
const previous = readStamp(path);

if (loopCount > 0) {
  writeStamp(path, current);
  process.stdout.write("{}");
  process.exit(0);
}

// No git / empty stamp → baseline only.
if (!current) {
  process.stdout.write("{}");
  process.exit(0);
}

// First stop, or tree unchanged (questions, Ask-mode, no product edits) → quiet.
if (previous === null || previous === current) {
  writeStamp(path, current);
  process.stdout.write("{}");
  process.exit(0);
}

writeStamp(path, current);

const followup = [
  "Closeout checklist (ERA Acceptance Standard):",
  "1) Update docs/COVERAGE_MATRIX.md actor rows for touched capabilities",
  "2) Implementation-Matrix: Scaffold ✅ only with PRD wording + negative path; else 🟡",
  "3) Product-Readiness-Matrix: update BE/UI/Demo/Pilot; rollup = worst layers",
  "4) Sync Sprint-Index / docs/editions/*.yaml if gate or sell claim changed",
  "5) Run: npm run check:acceptance (strict before PR: npm run check:acceptance:strict)",
  "6) Engineering API/% only → skill era-readiness-matrix (not Product-Readiness)",
].join("\n");

process.stdout.write(
  JSON.stringify({
    followup_message: followup,
  }),
);
process.exit(0);
