import fs from "fs";
import { inferPhysioTypeGate } from "../../src/domain/physio/physio-type-gate";

const procs = JSON.parse(
  fs.readFileSync("prisma/seed-data/nafta/procedure-types.json", "utf8"),
) as Array<{ code: string; name: string }>;

const out = procs.map((p) => {
  const g = inferPhysioTypeGate(p.code, p.name);
  return {
    code: p.code,
    name: p.name,
    needsSite: g.needsSite,
    n: g.allowedSiteCodes.length,
    sites: g.allowedSiteCodes,
  };
});
fs.writeFileSync("scripts/_tmp_utf8/current-gates.json", JSON.stringify(out, null, 2), "utf8");
console.log("wrote", out.length, "gates");
for (const r of out) {
  console.log(`${r.code}\t${r.needsSite}\t${r.n}\t${r.sites.join(",")}`);
}
