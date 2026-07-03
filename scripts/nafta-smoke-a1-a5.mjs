#!/usr/bin/env node
/**
 * Nafta UAT smoke — A1 (SSO) + A5 (settlement hub pending → Front Cash pay).
 * Usage:
 *   node scripts/nafta-smoke-a1-a5.mjs
 */
import { createHmac, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(root, envFile);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const secret =
  process.env.ERA_SSO_SHARED_SECRET ??
  "change-me-sso-hmac-secret_!@19372846";
const bridgeSecret = process.env.POS_BRIDGE_SECRET ?? "dev-pos-bridge-secret";
const orgId =
  process.env.SSO_ORG_ID ??
  process.env.ERA_HOTEL_ORGANIZATION_ID ??
  "c23c8036-0c54-456f-b3bb-e3a29187b24c";
const email = process.env.SSO_EMAIL ?? "nafta-uat-232528484@test.local";

const PMS = (process.env.PMS_URL ?? "http://127.0.0.1:3201").replace(/\/$/, "");
const FB = (process.env.FB_URL ?? "http://127.0.0.1:3202").replace(/\/$/, "");
const CLINIC = (process.env.CLINIC_URL ?? "http://127.0.0.1:3203").replace(/\/$/, "");

let failed = 0;

function ok(label) {
  console.log(`OK  ${label}`);
}

function fail(label, detail = "") {
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  failed++;
}

function signSso(email, organizationId, expiresAt) {
  const payload = `${email}|${organizationId}|${expiresAt}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function pickCookie(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const lines = raw.length ? raw : [res.headers.get("set-cookie")].filter(Boolean);
  return lines
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function ssoExchange(base, name) {
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  const res = await fetch(`${base}/api/auth/sso/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      fullName: "Nafta UAT Owner",
      organizationId: orgId,
      expiresAt,
      signature: signSso(email, orgId, expiresAt),
      financeRole: "OWNER",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    fail(`A1 SSO ${name}`, `${res.status} ${txt.slice(0, 180)}`);
    return null;
  }
  ok(`A1 SSO ${name} (${res.status})`);
  return pickCookie(res);
}

async function loginLocal(base, login, password, label) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    fail(label, `${res.status}`);
    return null;
  }
  ok(label);
  return pickCookie(res);
}

async function runA1() {
  console.log("\n=== A1 — SSO exchange ===");
  console.log(`org=${orgId} email=${email}`);
  await ssoExchange(PMS, "hotel-pms");
  await ssoExchange(FB, "fnb-pos");
  await ssoExchange(CLINIC, "clinic");
}

async function runA5() {
  console.log("\n=== A5 — Settlement hub (walk-in → Front Cash) ===");

  const billingRes = await fetch(`${FB}/api/billing/context`, {
    signal: AbortSignal.timeout(10000),
  });
  const billing = await billingRes.json().catch(() => ({}));
  console.log(
    `FB billing.context: deferWalkInToHub=${billing.deferWalkInToHub} settlementHub=${billing.settlementHub ?? "n/a"}`,
  );

  const fbCookie = await loginLocal(FB, "waiter", "waiter", "A5 FB waiter login");
  let pendingId = null;
  let ticketId = null;

  if (fbCookie) {
    const createRes = await fetch(`${FB}/api/tickets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: fbCookie,
      },
      body: JSON.stringify({
        outletCode: "RESTAURANT",
        serviceChannel: "WALK_IN",
        walkInLabel: "Smoke walk-in",
        lines: [{ description: "Smoke item", qty: 1, unitPriceAzn: 5.5 }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      fail("A5 create walk-in ticket", `${createRes.status} ${JSON.stringify(created).slice(0, 120)}`);
    } else {
      ticketId = created.id;
      ok(`A5 walk-in ticket ${ticketId}`);
    }
  }

  if (fbCookie && billing.deferWalkInToHub && ticketId) {
    const deferRes = await fetch(`${FB}/api/tickets/${ticketId}/defer-to-hub`, {
      method: "POST",
      headers: { Cookie: fbCookie },
      signal: AbortSignal.timeout(15000),
    });
    const deferBody = await deferRes.json().catch(() => ({}));
    if (!deferRes.ok) {
      fail("A5 defer-to-hub", `${deferRes.status} ${JSON.stringify(deferBody).slice(0, 120)}`);
    } else {
      pendingId = deferBody.pendingId;
      ok(`A5 defer-to-hub pendingId=${pendingId}`);
    }
  } else if (fbCookie && ticketId) {
    console.log("SKIP fb defer-to-hub (deferWalkInToHub=false) — using bridge POST");
  }

  if (!pendingId && ticketId) {
    const idemKey = `smoke-${randomUUID()}`;
    const bridgeRes = await fetch(`${PMS}/api/settlement/pending`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pos-Bridge-Secret": bridgeSecret,
        "Idempotency-Key": idemKey,
      },
      body: JSON.stringify({
        sourceSystem: "FNB_POS",
        sourceOrgId: orgId,
        sourceRef: ticketId,
        amount: 5.5,
        description: "A5 smoke — FB walk-in",
        payerLabel: "Smoke walk-in",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const bridgeBody = await bridgeRes.json().catch(() => ({}));
    const bridgeRow = bridgeBody.data ?? bridgeBody;
    if (!bridgeRes.ok || !bridgeRow?.id) {
      fail("A5 bridge create pending", `${bridgeRes.status} ${JSON.stringify(bridgeBody).slice(0, 160)}`);
    } else {
      pendingId = bridgeRow.id;
      ok(`A5 hotel pending created id=${bridgeRow.id}`);
    }
  }

  const listRes = await fetch(`${PMS}/api/settlement/pending?status=PENDING`, {
    headers: { "X-Pos-Bridge-Secret": bridgeSecret },
    signal: AbortSignal.timeout(10000),
  });
  const listBody = await listRes.json().catch(() => ({}));
  const rows = listBody.data ?? listBody;
  if (!listRes.ok || !Array.isArray(rows)) {
    fail("A5 list pending", `${listRes.status}`);
  } else {
    const found = rows.some((r) => r.id === pendingId);
    if (found) ok(`A5 pending visible in queue (${rows.length} row(s))`);
    else fail("A5 pending visible in queue", `id ${pendingId} not in list`);
  }

  const hotelCookie = await loginLocal(
    PMS,
    "reception",
    "reception123",
    "A5 hotel reception login",
  );
  if (!hotelCookie || !pendingId) return;

  const shiftRes = await fetch(`${PMS}/api/cash/shifts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: hotelCookie,
    },
    body: JSON.stringify({
      cashier: "reception",
      registerId: "FRONT-1",
      isPrimary: true,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (shiftRes.ok) {
    ok("A5 open primary cash shift");
  } else {
    const shiftTxt = await shiftRes.text().catch(() => "");
    if (
      (shiftRes.status === 400 || shiftRes.status === 500) &&
      shiftTxt.toLowerCase().includes("already open")
    ) {
      ok("A5 cash shift already open");
    } else {
      fail("A5 open cash shift", `${shiftRes.status} ${shiftTxt.slice(0, 100)}`);
    }
  }

  const payRes = await fetch(`${PMS}/api/settlement/pending/${pendingId}/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: hotelCookie,
    },
    body: JSON.stringify({ paymentMethod: "CASH" }),
    signal: AbortSignal.timeout(15000),
  });
  const payBody = await payRes.json().catch(() => ({}));
  if (!payRes.ok) {
    fail("A5 pay pending at Front Cash", `${payRes.status} ${JSON.stringify(payBody).slice(0, 160)}`);
  } else {
    ok("A5 pay pending at Front Cash");
  }

  if (ticketId && fbCookie) {
    const ticketsRes = await fetch(`${FB}/api/tickets`, {
      headers: { Cookie: fbCookie },
      signal: AbortSignal.timeout(10000),
    });
    const tickets = await ticketsRes.json().catch(() => []);
    const ticket = Array.isArray(tickets)
      ? tickets.find((t) => t.id === ticketId)
      : null;
    if (ticket?.status === "CLOSED") {
      ok(`A5 FB ticket status after pay: CLOSED`);
    } else if (!ticket) {
      ok("A5 FB ticket closed after callback (not in open list)");
    } else {
      fail("A5 FB ticket closed after callback", `status=${ticket.status}`);
    }
  }
}

console.log("Nafta smoke A1/A5");
await runA1();
await runA5();
console.log(`\nDone — ${failed} failure(s)`);
process.exit(failed > 0 ? 1 : 0);
