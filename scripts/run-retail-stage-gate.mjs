#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "retail",
  title: "Retail",
  checks: [
    { name: "UAT-SMOKE documented", note: "Manual: era-retail-pos/doc/UAT-SMOKE.md" },
  ],
});
