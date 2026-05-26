#!/usr/bin/env node
/**
 * SSO launch smoke: sign payload and POST /api/auth/sso/exchange on satellites.
 * Requires ERA_SSO_SHARED_SECRET and running satellite + seed user email.
 *
 * Usage:
 *   ERA_SSO_SHARED_SECRET=dev-sso-shared-secret \
 *   SSO_EMAIL=owner@demo.local SSO_ORG_ID=<uuid> \
 *   node scripts/sso-launch-smoke.mjs
 */
import { createHmac } from "crypto";

const secret = process.env.ERA_SSO_SHARED_SECRET ?? "dev-sso-shared-secret";
const email = process.env.SSO_EMAIL ?? "owner@demo.local";
const organizationId =
  process.env.SSO_ORG_ID ?? process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "";
const fullName = process.env.SSO_FULL_NAME ?? "Demo Owner";

const targets = [
  { name: "hotel-pms", url: process.env.PMS_URL ?? "http://127.0.0.1:3000" },
  { name: "fb-pos", url: process.env.FB_URL ?? "http://127.0.0.1:3200" },
  { name: "retail-pos", url: process.env.RETAIL_URL ?? "http://127.0.0.1:3012" },
];

if (!organizationId) {
  console.error("Set SSO_ORG_ID or ERA_SATELLITE_ORGANIZATION_ID");
  process.exit(1);
}

function sign(email, organizationId, expiresAt) {
  const payload = `${email}|${organizationId}|${expiresAt}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

let failed = 0;
for (const t of targets) {
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  const signature = sign(email, organizationId, expiresAt);
  const url = `${t.url.replace(/\/$/, "")}/api/auth/sso/exchange`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        fullName,
        organizationId,
        expiresAt,
        signature,
        financeRole: "OWNER",
      }),
      signal: AbortSignal.timeout(10000),
    });
    const ok = res.ok;
    console.log(`${ok ? "OK" : "FAIL"} ${t.name} ${res.status} ${url}`);
    if (!ok) {
      const txt = await res.text().catch(() => "");
      if (txt) console.log(`  ${txt.slice(0, 200)}`);
      failed++;
    }
  } catch (err) {
    console.log(`SKIP ${t.name} ${url} — ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

process.exit(failed > 0 ? 1 : 0);
