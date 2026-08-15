#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "data-hub",
  title: "Data Hub",
  checks: [
    {
      name: "UAT / evidence path documented",
      note: "Manual: era-data-hub/doc/UAT-SMOKE.md — API/HEADLESS evidence",
    },
  ],
});
