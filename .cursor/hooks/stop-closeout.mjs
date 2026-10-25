#!/usr/bin/env node
/**
 * Cursor stop hook — nudge acceptance closeout once per agent turn.
 * ERA Ecosystem.
 *
 * Cursor sends status "completed" on every stop, including plain questions.
 * A question does not change the tree, so the follow-up is sent only when
 * the workspace stamp differs from the previous stop. The stamp is HEAD,
 * the porcelain path list, and a content hash of each dirty path — a further
 * edit to a file that is already modified still changes the stamp.
 * The first stop only records a baseline (the repo may already be dirty).
 * loop_count > 0 refreshes the baseline and stays quiet, so closeout edits
 * do not schedule another checklist.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

/** Porcelain quotes paths that contain spaces or special characters. */
function unquoteGitPath(path) {
  if (!(path.startsWith('"') && path.endsWith('"'))) return path;
  try {
    return JSON.parse(path);
  } catch {
    return path.slice(1, -1);
  }
}

/** Working-tree digest. Missing and non-files stay stable tokens. */
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
 * HEAD, porcelain, and the contents of every dirty path.
 * Empty string if git cannot be read. A second edit to an already dirty
 * file changes this stamp even though the path list does not.
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
    const rel = arrow === -1 ? pathPart : pathPart.slice(arrow + 4);
    paths.push(unquoteGitPath(rel));
  }
  paths.sort();
  const hash = createHash("sha256");
  hash.update(head);
  hash.update("\0");
  hash.update(porcelain);
  for (const rel of paths) {
    hash.update("\0");
    hash.update(rel);
    hash.update("\0");
    hash.update(fileDigest(rel));
  }
  return hash.digest("hex");
}

function stampPath() {
  const id = createHash("sha256").update(process.cwd()).digest("hex").slice(0, 16);
  return join(tmpdir(), `era-stop-closeout-${id}.txt`);
}

function readStamp(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function writeStamp(path, value) {
  try {
    writeFileSync(path, value, "utf8");
  } catch {
    // A missing stamp must not turn into a follow-up loop.
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
  })
);
process.exit(0);
