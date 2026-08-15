#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "auto",
  title: "Auto Service",
  checks: [
    {
      name: "UAT / evidence path documented",
      note: "Manual: era-auto-service/doc/UAT-SMOKE.md",
    },
  ],
});
