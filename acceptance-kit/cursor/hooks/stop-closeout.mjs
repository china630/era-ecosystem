#!/usr/bin/env node
/**
 * Cursor stop hook — nudge acceptance / quality closeout once per agent turn.
 * Portable acceptance-kit.
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
  /matrix|scaffold|pilot-ready|implementation-matrix|product-readiness|acceptance|gate\[x\]|editions-/i.test(
    summary
  ) ||
  status === "completed" ||
  status === "success";

if (!looksProductive) {
  process.stdout.write("{}");
  process.exit(0);
}

const followup = [
  "Closeout checklist (Product Acceptance Standard):",
  "1) Run: pwsh -File scripts/check-acceptance-consistency.ps1",
  "2) Implementation-Matrix: Scaffold ✅ only with PRD wording + negative path; else 🟡",
  "3) Product-Readiness-Matrix: update BE/UI/Demo/Pilot; rollup = worst layers (not BE alone)",
  "4) Sync Index / Gap / MVP header to Readiness (no false all-✅ prose)",
  "5) Do not mark Pilot-ready / editions ga without field proof",
].join("\n");

process.stdout.write(
  JSON.stringify({
    followup_message: followup,
  })
);
process.exit(0);
