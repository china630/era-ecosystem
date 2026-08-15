#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "construction",
  title: "Construction",
  checks: [
    {
      name: "UAT / evidence path documented",
      note: "Manual: era-construction/doc/UAT-SMOKE.md",
    },
  ],
});
