const fs = require("fs");
const s = fs.readFileSync("era-finance-core/packages/i18n/src/resources.ts", "utf8");
const lines = s.split("\n").filter((l) => l.includes("internalRate"));
for (const l of lines) console.log(l.trim());
