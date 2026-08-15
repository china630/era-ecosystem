#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "bank",
  title: "Bank",
  checks: [
    {
      name: "UAT-SMOKE documented",
      note: "Manual: era-bank/doc/UAT-SMOKE.md + CERTIFICATION-TRACK (not edition ga)",
    },
  ],
});
