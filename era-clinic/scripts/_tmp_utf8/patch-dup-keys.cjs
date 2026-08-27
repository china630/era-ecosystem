"use strict";
const fs = require("fs");
const path = require("path");

const adapters = path.join(__dirname, "../../src/lib/import/adapters/index.ts");
let a = fs.readFileSync(adapters, "utf8");
a = a.replace(
  /headerAliases: \{[\s\S]*?rowSchema: z\.object\(\{\s*patientRef: z\.string\(\)\.min\(1\),\s*procedureCode: z\.string\(\)\.min\(1\),\s*quotaTotal/,
  `headerAliases: {
    patientRef: "patientRef",
    procedureCode: "procedureCode",
    quotaLeft: "quotaLeft",
    quotaTotal: "quotaTotal",
    quotaUsed: "quotaUsed",
  },
  rowSchema: z.object({
    patientRef: z.string().min(1),
    procedureCode: z.string().min(1),
    quotaTotal`,
);
a = a.replace(
  /return JSON.stringify\(\{[\s\S]*?fileName: copied\.fileName,[\s\S]*?\}\);/,
  "return JSON.stringify({ ...payload, storedPath: copied.storedPath, fileName: copied.fileName });",
);
fs.writeFileSync(adapters, a);

const route = path.join(__dirname, "../../app/api/lab-orders/[id]/file/route.ts");
let r = fs.readFileSync(route, "utf8");
r = r.replace(
  /const parsed = JSON\.parse\(raw\) as \{[^}]+\};\s*return parsed\.[^;]+;/,
  "const parsed = JSON.parse(raw) as { storedPath?: string };\n    return parsed.storedPath || null;",
);
fs.writeFileSync(route, r);
console.log("done");
