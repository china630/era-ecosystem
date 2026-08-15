#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "clinic",
  title: "Clinic",
  checks: [
    {
      name: "UAT-SMOKE path documented",
      note: "Manual: era-clinic/doc/UAT-SMOKE.md — mark lab when signed",
    },
  ],
});
