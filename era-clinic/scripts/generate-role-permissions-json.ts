import fs from "fs";
import {
  permissionsJsonForRole,
  CONFIGURABLE_CLINIC_ROLES,
} from "../src/lib/auth/clinic-permissions";

const out: Record<string, string[]> = {};
for (const code of CONFIGURABLE_CLINIC_ROLES) {
  out[code] = JSON.parse(permissionsJsonForRole(code)) as string[];
}
fs.writeFileSync(
  "prisma/clinic-role-permissions.defaults.json",
  JSON.stringify(out, null, 2),
  "utf8",
);
console.log("written", Object.keys(out).length, "roles");
