#!/usr/bin/env node
/**
 * Cursor stop hook — acceptance closeout nudge (turn-scoped).
 *
 * SoR: compare relevant-product digest at stop vs baseline captured at
 * beforeSubmitPrompt. A question with an already-dirty tree stays quiet
 * (baseline == end). Edits in this turn change the digest → follow-up once.
 *
 * loop_count > 0: quiet (follow-up / closeout loop); refresh baseline so the
 * next user prompt does not see leftover drift as a new change.
 *
 * Usage:
 *   node stop-closeout.mjs --baseline   # beforeSubmitPrompt
 *   node stop-closeout.mjs              # stop
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/** Paths that can affect acceptance / product closeout. */
function isRelevantPath(rel) {
  const p = String(rel || "").replace(/\\/g, "/");
  if (!p || p.startsWith(".cursor/")) return false;
  if (p.startsWith("era-")) return true;
  if (p.startsWith("packages/")) return true;
  if (p.startsWith("docs/acceptance/")) return true;
  if (p.startsWith("docs/adr/")) return true;
  if (p.startsWith("docs/editions/")) return true;
  if (p === "docs/COVERAGE_MATRIX.md" || p.startsWith("docs/COVERAGE_MATRIX")) {
    return true;
  }
  if (p === "docs/READINESS_MATRIX.md") return true;
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
 * HEAD + porcelain paths that are relevant + content hashes of those paths.
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
    if (isRelevantPath(rel)) paths.push(rel.replace(/\\/g, "/"));
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

function stateDirFile(name) {
  const gitDir = join(process.cwd(), ".git");
  if (existsSync(gitDir)) return join(gitDir, name);
  return join(process.cwd(), name);
}

function baselinePath() {
  return stateDirFile("era-stop-closeout.baseline");
}

/** Legacy mark flag from the broken rewrite — remove if present. */
function clearLegacyDirtyFlag() {
  try {
    unlinkSync(stateDirFile("era-stop-closeout.dirty"));
  } catch {
    // absent
  }
}

function readBaseline() {
  try {
    return readFileSync(baselinePath(), "utf8").trim();
  } catch {
    return null;
  }
}

function writeBaseline(value) {
  try {
    writeFileSync(baselinePath(), value, "utf8");
  } catch {
    // Missing baseline must not loop forever — stay quiet next time.
  }
}

const FOLLOWUP = [
  "Closeout checklist (ERA Acceptance Standard):",
  "1) Update docs/COVERAGE_MATRIX.md actor rows for touched capabilities",
  "2) Implementation-Matrix: Scaffold ✅ only with PRD wording + negative path; else 🟡",
  "3) Product-Readiness-Matrix: update BE/UI/Demo/Pilot; rollup = worst layers",
  "4) Sync Sprint-Index / docs/editions/*.yaml if gate or sell claim changed",
  "5) Run: npm run check:acceptance (strict before PR: npm run check:acceptance:strict)",
  "6) Engineering API/% only → skill era-readiness-matrix (not Product-Readiness)",
].join("\n");

const mode = process.argv.includes("--baseline")
  ? "baseline"
  : process.argv.includes("--clear")
    ? "baseline" // alias: old hooks.json used --clear; treat as capture baseline
    : "stop";

const input = readInput();
clearLegacyDirtyFlag();

if (mode === "baseline") {
  const stamp = workspaceStamp();
  if (stamp) writeBaseline(stamp);
  process.stdout.write("{}");
  process.exit(0);
}

// --- stop ---
const loopCount = Number(input.loop_count || input.followup_count || 0);
const current = workspaceStamp();

if (!current) {
  process.stdout.write("{}");
  process.exit(0);
}

if (loopCount > 0) {
  // Closeout / follow-up turn: do not nudge again; lock baseline to end state.
  writeBaseline(current);
  process.stdout.write("{}");
  process.exit(0);
}

const baseline = readBaseline();
if (!baseline || baseline === current) {
  // No baseline (hook skipped) or no relevant change this turn → quiet.
  // Refresh baseline so a later question with the same tree stays quiet.
  writeBaseline(current);
  process.stdout.write("{}");
  process.exit(0);
}

writeBaseline(current);
process.stdout.write(JSON.stringify({ followup_message: FOLLOWUP }));
process.exit(0);
