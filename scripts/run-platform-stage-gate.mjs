#!/usr/bin/env node
import { runStageGate, runNpm } from "./lib/stage-gate.mjs";

runStageGate({
  product: "platform",
  title: "Platform",
  checks: [
    {
      name: "integration audit strict",
      run: () => runNpm("audit:integration:strict"),
    },
    {
      name: "UAT-SMOKE-PLATFORM documented",
      note: "Manual: era-orchestrator/doc/UAT-SMOKE-PLATFORM.md",
    },
  ],
});
