#!/usr/bin/env node
/**
 * CP2 smoke: Orch login → access token → Finance /api/auth/me (or health with bearer).
 * HS256: ERA_JWT_SECRET on both sides.
 * RS256: ERA_JWT_SIGNING_MODE=rs256 on Orch + ERA_JWT_JWKS_URL on Finance.
 */
const ORCH = (process.env.ORCH_API_URL ?? "http://127.0.0.1:4100").replace(
  /\/$/,
  "",
);
const FIN = (process.env.FINANCE_API_URL ?? "http://127.0.0.1:3001").replace(
  /\/$/,
  "",
);
const EMAIL = process.env.ERA_SMOKE_EMAIL ?? "owner@demo.local";
const PASS = process.env.ERA_SMOKE_PASSWORD ?? "demo1234";

async function main() {
  const loginRes = await fetch(`${ORCH}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!loginRes.ok) {
    console.error("Orch login failed", loginRes.status, await loginRes.text());
    process.exit(1);
  }
  const login = await loginRes.json();
  const token = login.accessToken;
  if (!token) {
    console.error("No accessToken in login response");
    process.exit(1);
  }
  const header = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
  );
  console.log("Token alg:", header.alg, "permissions:", header.permissions?.length ?? 0);

  const jwksRes = await fetch(`${ORCH}/.well-known/jwks.json`);
  console.log("JWKS status:", jwksRes.status, await jwksRes.json().then((j) => j.keys?.length ?? 0), "keys");

  const meRes = await fetch(`${FIN}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Finance /api/auth/me:", meRes.status);
  if (!meRes.ok) {
    console.error(await meRes.text());
    process.exit(1);
  }
  console.log("OK — CP JWT accepted by Finance");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
