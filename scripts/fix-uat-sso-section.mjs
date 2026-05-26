import fs from "fs";
import path from "path";

const sso = `
## SSO paths (platform entry - SP9/P2)

### Owner path (Orchestrator)
1. Login at Orchestrator web: \`http://localhost:3100\` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite \`/sso/callback\` session.
3. Smoke: \`node scripts/sso-launch-smoke.mjs\` (\`ERA_SSO_SHARED_SECRET\` aligned).

### Ops path (local)
1. Use this app's \`/login\` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite \`/register\`).

`;

const dirs = [
  "era-hotel-pms",
  "era-fb-pos",
  "era-retail-pos",
  "era-logistics",
  "era-construction",
  "era-crm-field",
  "era-auto-sto",
  "era-clinic",
  "era-wholesale",
];

for (const d of dirs) {
  const f = path.join(d, "doc/UAT-SMOKE.md");
  let c = fs.readFileSync(f, "utf8");
  c = c.replace(/## SSO paths[\s\S]*?(?=\n## |\nRun after|\n- \[|\n\| User)/, `${sso}\n`);
  if (d === "era-hotel-pms") {
    c = c.replace(/^# UAT smoke[^\n]+\n+/, "# UAT smoke test — ERA Hotel PMS (Phase 1)\n\n");
    if (!c.includes("Run after")) {
      c = c.replace(
        /(# UAT smoke[^\n]+\n)\n/,
        "$1\n\nRun after `docker compose up -d`, `npx prisma migrate deploy`, `npm run db:seed`, `npm run dev`.\n\n",
      );
    }
    c = c.replace(
      /^1\. `\/bookings\/new`.*$/m,
      "1. `/bookings/new` — create guest via **+ New guest**; optional **FIN (MDM lookup)** → `globalPersonId` on guest.",
    );
  }
  fs.writeFileSync(f, c, "utf8");
  console.log("fixed", f);
}
