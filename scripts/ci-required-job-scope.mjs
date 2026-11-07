/**
 * Which CI jobs must run for real vs exit 0 immediately.
 * Orchestrator is always real. A stub still has to be success, not a skipped job.
 *
 *   node scripts/ci-required-job-scope.mjs --query era-clinic
 *   # prints run=true or run=false for $GITHUB_OUTPUT
 *
 * CI_FULL=true (PR label ci-full) disables stubs, except CI_CD_PAUSED_DIRS.
 * Those jobs always stub, including on an empty diff. Empty diff or unknown
 * push base otherwise runs everything.
 */
import { spawnSync } from "node:child_process";
import { isCiCdPausedJob } from "./ci-cd-pause.mjs";

export const JOB_PREFIXES = {
  finance: ["era-finance-core/"],
  "data-hub": ["era-data-hub/"],
  "bank-core": ["era-bank-core/"],
  "era-hotel-pms": ["era-hotel-pms/"],
  "era-fnb-pos": ["era-fnb-pos/"],
  "era-clinic": ["era-clinic/"],
  "era-retail-pos": ["era-retail-pos/"],
  "era-logistics": ["era-logistics/"],
  "era-construction": ["era-construction/"],
  "era-crm": ["era-crm/"],
  "era-auto-service": ["era-auto-service/"],
  "era-wholesale": ["era-wholesale/"],
  "era-bank": ["era-bank/"],
  "era-bank-dbo": ["era-bank-dbo/"],
};

export function forcesFullCi(file) {
  const n = String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!n) return false;
  if (n.startsWith("packages/")) return true;
  if (n.startsWith(".github/workflows/")) return true;
  if (n.startsWith("docker/")) return true;
  if (n === "package-lock.json" || n === "package.json") return true;
  if (n.endsWith("/package-lock.json")) return true;
  return false;
}

export function jobShouldRun(jobKey, files, { full = false } = {}) {
  if (isCiCdPausedJob(jobKey)) return false;
  if (jobKey === "orchestrator") return true;
  if (full) return true;
  const list = (files || []).map((f) => String(f).replace(/\\/g, "/"));
  if (list.length === 0) return true;
  if (list.some(forcesFullCi)) return true;
  const prefixes = JOB_PREFIXES[jobKey];
  if (!prefixes) return true;
  return list.some((f) => prefixes.some((p) => f.startsWith(p)));
}

function isDirectRun() {
  const argv1 = process.argv[1] || "";
  return argv1.endsWith("ci-required-job-scope.mjs");
}

function changedFilesFromGit() {
  if (process.env.CI_CHANGED_FILES) {
    return process.env.CI_CHANGED_FILES.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  const event = process.env.GITHUB_EVENT_NAME || "";
  let range = "";
  if (event === "pull_request" && process.env.PR_BASE && process.env.PR_HEAD) {
    range = `${process.env.PR_BASE}...${process.env.PR_HEAD}`;
  } else if (event === "push" && process.env.PUSH_BEFORE && !/^0+$/.test(process.env.PUSH_BEFORE)) {
    range = `${process.env.PUSH_BEFORE}...HEAD`;
  } else if (!event) {
    return [];
  } else {
    return [];
  }
  const diff = spawnSync("git", ["diff", "--name-only", range], { encoding: "utf8" });
  if (diff.status !== 0) return [];
  return (diff.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

if (isDirectRun()) {
  const qIdx = process.argv.indexOf("--query");
  const jobKey = qIdx >= 0 ? process.argv[qIdx + 1] : "";
  if (!jobKey) {
    console.error("--query <job> is required");
    process.exit(1);
  }
  if (isCiCdPausedJob(jobKey)) {
    console.log("run=false");
    process.exit(0);
  }
  const full = process.env.CI_FULL === "true" || process.env.CI_FULL === "1";
  const files = changedFilesFromGit();
  if (files.length === 0 && !process.env.CI_CHANGED_FILES && process.env.GITHUB_EVENT_NAME) {
    console.log("run=true");
    process.exit(0);
  }
  const run = jobShouldRun(jobKey, files, { full });
  console.log(`run=${run ? "true" : "false"}`);
}
