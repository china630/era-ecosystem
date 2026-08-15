#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "crm",
  title: "CRM",
  checks: [
    { name: "UAT-SMOKE documented", note: "Manual: era-crm/doc/UAT-SMOKE.md" },
  ],
});
