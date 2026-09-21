const fs = require("fs");
const f = "era-finance-core/packages/i18n/src/resources.ts";
let s = fs.readFileSync(f, "utf8");

const ruNeedle = '        salaryGross: "Оклад gross (AZN)",\n        save:';
const ruRepl =
  '        salaryGross: "Оклад gross (AZN)",\n' +
  '        internalRate: "Внутренняя ставка (AZN)",\n' +
  '        internalRateHint: "Только для упр. учёта (MGMT); госзарплата использует договорной оклад.",\n' +
  "        save:";

const azNeedle = '        salaryGross: "Əmək haqqı brüt (AZN)",\n        save:';
const azRepl =
  '        salaryGross: "Əmək haqqı brüt (AZN)",\n' +
  '        internalRate: "Daxili tarif (AZN)",\n' +
  '        internalRateHint: "Yalniz idareetme ucotu (MGMT); resmi emek haqqi muqavile okladindan hesablanir.",\n' +
  "        save:";

if (!s.includes("internalRate:")) {
  if (!s.includes(ruNeedle)) throw new Error("ru needle missing");
  if (!s.includes(azNeedle)) throw new Error("az needle missing");
  s = s.replace(ruNeedle, ruRepl).replace(azNeedle, azRepl);
  fs.writeFileSync(f, s, "utf8");
  console.log("i18n patched");
} else {
  console.log("already patched");
}
