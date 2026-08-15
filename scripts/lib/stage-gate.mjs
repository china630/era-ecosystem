#!/usr/bin/env node
/**
 * Shared stage-gate runner for ERA acceptance products.
 * Usage: node scripts/run-<product>-stage-gate.mjs [--wave W0] [--signoff]
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {{ product: string, title: string, checks: Array<{ name: string, run?: () => number, note?: string }> }} opts
 */
export function runStageGate(opts) {
  const args = process.argv.slice(2);
  const waveIdx = args.indexOf("--wave");
  const wave = waveIdx >= 0 && args[waveIdx + 1] ? args[waveIdx + 1] : "W0";
  const writeSignoff = args.includes("--signoff");

  console.log(`=== ${opts.title} stage-gate (${wave}) ===`);

  let failed = 0;
  const lines = [
    `# ${opts.title} stage-gate signoff`,
    "",
    `- Product: ${opts.product}`,
    `- Wave: ${wave}`,
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Result: scaffold-gate-pass (pending checks below)`,
    "",
    "## Checks",
    "",
  ];

  for (const c of opts.checks) {
    process.stdout.write(`- ${c.name} ... `);
    let code = 0;
    if (c.run) {
      code = c.run();
    } else if (c.note) {
      console.log(`SKIP (${c.note})`);
      lines.push(`- [~] ${c.name} — ${c.note}`);
      continue;
    }
    if (code === 0) {
      console.log("PASS");
      lines.push(`- [x] ${c.name}`);
    } else {
      console.log("FAIL");
      lines.push(`- [ ] ${c.name} — exit ${code}`);
      failed += 1;
    }
  }

  // Always run acceptance consistency for this product
  process.stdout.write("- acceptance consistency ... ");
  const acc = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, "scripts", "check-acceptance-consistency.mjs"),
      "--product",
      opts.product,
    ],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (acc.status === 0) {
    console.log("PASS");
    lines.push("- [x] acceptance consistency");
  } else {
    console.log("FAIL");
    if (acc.stdout) process.stdout.write(acc.stdout);
    if (acc.stderr) process.stderr.write(acc.stderr);
    lines.push("- [ ] acceptance consistency");
    failed += 1;
  }

  const status = failed === 0 ? "scaffold-gate-pass" : "scaffold-gate-fail";
  lines[5] = `- Result: ${status}`;
  lines.push("", `## Honesty`, "", "This signoff is **scaffold-gate** only — not Pilot-ready / not edition ga.", "");

  const reportsDir = path.join(repoRoot, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const signoffPath = path.join(reportsDir, `${opts.product}-stage-${wave}-signoff.md`);

  if (writeSignoff || failed === 0) {
    fs.writeFileSync(signoffPath, lines.join("\n"), "utf8");
    console.log(`Wrote ${path.relative(repoRoot, signoffPath)}`);
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nPASS — scaffold-gate");
  process.exit(0);
}

export function runNpm(script) {
  const r = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", script],
    { cwd: repoRoot, encoding: "utf8", shell: true }
  );
  return r.status ?? 1;
}

export function runNode(relScript, scriptArgs = []) {
  const r = spawnSync(process.execPath, [path.join(repoRoot, relScript), ...scriptArgs], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return r.status ?? 1;
}
