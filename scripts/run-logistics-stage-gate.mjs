#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "logistics",
  title: "Logistics",
  checks: [
    {
      name: "UAT / evidence path documented",
      note: "Manual: era-logistics/doc/UAT-SMOKE.md",
    },
  ],
});
