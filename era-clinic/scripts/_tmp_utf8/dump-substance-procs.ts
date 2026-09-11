import fs from "fs";
import { inferPhysioTypeGate } from "../../src/domain/physio/physio-type-gate";

const procs = JSON.parse(
  fs.readFileSync("prisma/seed-data/nafta/procedure-types.json", "utf8"),
) as Array<{ code: string; name: string }>;
const list = JSON.parse(
  fs.readFileSync("prisma/seed-data/base/physio-list-items.json", "utf8"),
).items.filter((i: { listKind: string }) => i.listKind === "SUBSTANCE") as Array<{
  code: string;
  titleRu: string;
  titleAz: string;
}>;

console.log("SUBSTANCES");
for (const s of list) console.log(`${s.code}\t${s.titleRu}`);
console.log("PROCS");
for (const p of procs) {
  const g = inferPhysioTypeGate(p.code, p.name);
  if (g.fields.includes("SUBSTANCE_OR_ADDITIVE")) {
    console.log(`${p.code}\t${p.name}`);
  }
}
