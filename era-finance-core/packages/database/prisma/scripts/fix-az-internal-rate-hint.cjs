const fs = require("fs");
const f = "era-finance-core/packages/i18n/src/resources.ts";
let s = fs.readFileSync(f, "utf8");
const bad =
  'internalRateHint: "Yalniz idareetme ucotu (MGMT); resmi emek haqqi muqavile okladindan hesablanir.",';
const good =
  'internalRateHint: "Yalnız idarəetmə uçotu (MGMT); rəsmi əmək haqqı müqavilə okladından hesablanır.",';
if (s.includes(bad)) {
  s = s.replace(bad, good);
  fs.writeFileSync(f, s, "utf8");
  console.log("az hint fixed");
} else {
  console.log("az hint already ok or different");
}
