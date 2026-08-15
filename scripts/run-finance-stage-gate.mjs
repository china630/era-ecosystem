#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "finance",
  title: "Finance",
  checks: [
    {
      name: "UAT / payroll depth notes",
      note: "Manual: finance UAT + COVERAGE FIN-* API honesty",
    },
  ],
});
