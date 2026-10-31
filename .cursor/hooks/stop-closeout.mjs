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
import { existsSync, readFileSync, statSync, writeFileSync, writeSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/** PowerShell on Windows drops a buffered console write; Cursor then logs `{}`. */
function emit(obj) {
  const line = `${JSON.stringify(obj)}\n`;
  try {
    writeSync(1, line);
  } catch {
    process.stdout.write(line);
  }
}

function repoCwd(input) {
  const root = Array.isArray(input.workspace_roots) ? input.workspace_roots[0] : "";
  if (typeof root === "string" && root.trim()) {
    const normalized = root.replace(/^\/([A-Za-z]:)/, "$1");
    if (existsSync(join(normalized, ".git")) || existsSync(join(normalized, "era-data-hub"))) {
      return normalized;
    }
  }
  return process.cwd();
}

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

let gitCwd = process.cwd();

function gitCapture(args) {
  try {
    return execFileSync("git", args, {
      cwd: gitCwd,
      encoding: "utf8",
      timeout: 20000,
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
    const abs = join(gitCwd, relPath);
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
  const gitDir = join(gitCwd, ".git");
  if (existsSync(gitDir)) return join(gitDir, name);
  return join(gitCwd, name);
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

/** generation_id is one user message; conversation_id is the chat. beforeSubmitPrompt may omit one of them. */
function stampKeys(input) {
  const keys = [];
  for (const value of [input.generation_id, input.conversation_id, input.conversationId]) {
    const key = typeof value === "string" ? value.trim() : "";
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (keys.length === 0) keys.push("default");
  return keys;
}

/** Per-chat stamps. One shared hash let a question in another window consume this turn's delta. */
function readBaselineMap() {
  try {
    const raw = readFileSync(baselinePath(), "utf8").trim();
    if (!raw) return {};
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    }
    return { default: raw };
  } catch {
    return {};
  }
}

function writeBaselineMap(map) {
  try {
    writeFileSync(baselinePath(), JSON.stringify(map), "utf8");
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
gitCwd = repoCwd(input);
clearLegacyDirtyFlag();

const keys = stampKeys(input);

if (mode === "baseline") {
  const stamp = workspaceStamp();
  if (stamp) {
    const map = readBaselineMap();
    for (const key of keys) map[key] = stamp;
    writeBaselineMap(map);
  }
  emit({});
  process.exit(0);
}

// --- stop ---
const loopCount = Number(input.loop_count || input.followup_count || 0);
const current = workspaceStamp();

if (!current) {
  emit({});
  process.exit(0);
}

const map = readBaselineMap();

function remember() {
  for (const key of keys) map[key] = current;
  writeBaselineMap(map);
}

if (loopCount > 0) {
  // Closeout / follow-up turn: do not nudge again; lock this chat's baseline.
  remember();
  emit({});
  process.exit(0);
}

const baseline = keys.map((key) => map[key]).find((value) => typeof value === "string" && value.length > 0);
if (!baseline || baseline === current) {
  // No baseline (hook skipped) or no relevant change since this chat's prompt → quiet.
  remember();
  emit({});
  process.exit(0);
}

remember();
emit({ followup_message: FOLLOWUP });
process.exit(0);
