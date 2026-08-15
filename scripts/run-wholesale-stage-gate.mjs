#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "wholesale",
  title: "Wholesale",
  checks: [
    {
      name: "UAT / evidence path documented",
      note: "Manual: era-wholesale/doc/UAT-SMOKE.md",
    },
  ],
});
