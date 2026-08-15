#!/usr/bin/env node
/**
 * Cursor stop hook — nudge acceptance / quality closeout once per agent turn.
 * ERA Ecosystem.
 */
import { readFileSync } from "node:fs";

function readInput() {
  try {
    const raw = readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const input = readInput();
const status = String(input.status || input.completion_status || "").toLowerCase();
const summary = String(input.summary || input.last_assistant_message || input.message || "");
const loopCount = Number(input.loop_count || input.followup_count || 0);

if (loopCount > 0) {
  process.stdout.write("{}");
  process.exit(0);
}

const looksProductive =
  /matrix|scaffold|pilot-ready|implementation-matrix|product-readiness|acceptance|coverage_matrix|gate\[x\]|editions-|SHIPPED/i.test(
    summary
  ) ||
  status === "completed" ||
  status === "success";

if (!looksProductive) {
  process.stdout.write("{}");
  process.exit(0);
}

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
