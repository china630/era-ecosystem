#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "hotel",
  title: "Hotel",
  checks: [
    {
      name: "UAT-SMOKE path documented",
      note: "Manual: era-hotel-pms/doc/UAT-SMOKE.md — mark lab when signed",
    },
  ],
});
