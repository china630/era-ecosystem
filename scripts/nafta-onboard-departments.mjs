#!/usr/bin/env node
/**
 * Idempotent Nafta department org bootstrap (after super-admin UI path).
 * Requires ORCH_API_URL, ORCH_SUPER_ADMIN_TOKEN, ERA_HOTEL_ORGANIZATION_ID (parent).
 *
 * Usage:
 *   node scripts/nafta-onboard-departments.mjs
 */
const base = (process.env.ORCH_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const token = process.env.ORCH_SUPER_ADMIN_TOKEN?.trim();
const parentOrgId = process.env.ERA_HOTEL_ORGANIZATION_ID?.trim();

if (!token || !parentOrgId) {
  console.error("Set ORCH_SUPER_ADMIN_TOKEN and ERA_HOTEL_ORGANIZATION_ID");
  process.exit(1);
}

const departments = [
  { name: "Nafta F&B", envKey: "ERA_FB_ORGANIZATION_ID" },
  { name: "Nafta Clinic", envKey: "ERA_CLINIC_ORGANIZATION_ID" },
];

async function api(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main() {
  const existing = await api(`/v1/admin/orgs/${parentOrgId}/departments`);
  const byName = new Map(existing.map((d) => [d.name, d]));

  for (const spec of departments) {
    let row = byName.get(spec.name);
    if (!row) {
      row = await api(`/v1/admin/orgs/${parentOrgId}/departments`, {
        method: "POST",
        body: JSON.stringify({ name: spec.name }),
      });
      console.log(`Created ${spec.name}: ${row.id}`);
    } else {
      console.log(`Exists ${spec.name}: ${row.id}`);
    }
    console.log(`${spec.envKey}=${row.id}`);
  }

  const endpoints = [
    { key: "industry_fnb_pos", url: process.env.FNB_POS_URL ?? "http://127.0.0.1:3202" },
    { key: "industry_clinic", url: process.env.CLINIC_URL ?? "http://127.0.0.1:3203" },
  ];

  for (const ep of endpoints) {
    await api(`/v1/admin/orgs/${parentOrgId}/satellite-endpoints/${ep.key}`, {
      method: "PUT",
      body: JSON.stringify({ satelliteKey: ep.key, baseUrl: ep.url, enabled: true }),
    });
    console.log(`Endpoint ${ep.key} → ${ep.url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
