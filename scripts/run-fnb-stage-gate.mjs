#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "fnb",
  title: "F&B",
  checks: [
    { name: "UAT-SMOKE documented", note: "Manual: era-fnb-pos/doc/UAT-SMOKE.md" },
  ],
});
