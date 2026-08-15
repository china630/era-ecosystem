#!/usr/bin/env node
import { runStageGate } from "./lib/stage-gate.mjs";

runStageGate({
  product: "bank-dbo",
  title: "Bank DBO",
  checks: [
    {
      name: "UAT / evidence path documented",
      note: "Manual: era-bank-dbo/doc/UAT-SMOKE.md — certification track open",
    },
  ],
});
