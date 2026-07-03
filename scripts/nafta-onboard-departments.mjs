#!/usr/bin/env node
/**
 * Idempotent Nafta commercial dept + workforce org tree + role matrix bootstrap.
 * Requires ORCH_API_URL, ORCH_SUPER_ADMIN_TOKEN, ERA_HOTEL_ORGANIZATION_ID (parent).
 * Optional: ORCH_OWNER_TOKEN for workforce CP routes (falls back to super-admin token).
 *
 * Usage:
 *   node scripts/nafta-onboard-departments.mjs
 */
const base = (process.env.ORCH_API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const token = process.env.ORCH_SUPER_ADMIN_TOKEN?.trim();
const ownerToken = process.env.ORCH_OWNER_TOKEN?.trim() || token;
const parentOrgId = process.env.ERA_HOTEL_ORGANIZATION_ID?.trim();

if (!token || !parentOrgId) {
  console.error("Set ORCH_SUPER_ADMIN_TOKEN and ERA_HOTEL_ORGANIZATION_ID");
  process.exit(1);
}

const departments = [
  { name: "Nafta F&B", envKey: "ERA_FB_ORGANIZATION_ID" },
  { name: "Nafta Clinic", envKey: "ERA_CLINIC_ORGANIZATION_ID" },
];

const orgTree = [
  { name: "Nafta Sanatorium", code: "HQ", children: ["Med Block", "Administration", "F&B"] },
];

const NAFTA_POSITIONS = [
  { orgUnit: "Med Block", name: "Therapist", templates: [{ key: "industry_clinic", role: "DOCTOR" }] },
  { orgUnit: "F&B", name: "Waiter", templates: [{ key: "industry_fnb_pos", role: "WAITER" }] },
  { orgUnit: "Administration", name: "Reception", templates: [{ key: "industry_hotel_pms", role: "RECEPTION" }] },
];

async function api(path, init = {}, useOwner = false) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${useOwner ? ownerToken : token}`,
      "Content-Type": "application/json",
      "x-organization-id": parentOrgId,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function bootstrapRoleMatrix(orgUnitsByName) {
  const positions = await api("/platform/v1/workforce/positions", {}, true);
  const list = Array.isArray(positions) ? positions : positions.items ?? [];
  const posByKey = new Map(list.map((p) => [`${p.orgUnitId}:${p.name}`, p]));

  for (const spec of NAFTA_POSITIONS) {
    const unit = orgUnitsByName.get(spec.orgUnit);
    if (!unit) {
      console.warn(`Skip position ${spec.name}: org unit ${spec.orgUnit} missing`);
      continue;
    }
    let position = posByKey.get(`${unit.id}:${spec.name}`);
    if (!position) {
      position = await api(
        "/platform/v1/workforce/positions",
        {
          method: "POST",
          body: JSON.stringify({ orgUnitId: unit.id, name: spec.name, totalSlots: 20 }),
        },
        true,
      );
      console.log(`Created position ${spec.name}: ${position.id}`);
      posByKey.set(`${unit.id}:${spec.name}`, position);
    } else {
      console.log(`Position exists: ${spec.name}`);
    }

    for (const tmpl of spec.templates) {
      await api(
        "/platform/v1/workforce/role-templates",
        {
          method: "PUT",
          body: JSON.stringify({
            positionId: position.id,
            satelliteKey: tmpl.key,
            satelliteRole: tmpl.role,
          }),
        },
        true,
      );
      console.log(`Role template ${spec.name} → ${tmpl.key} ${tmpl.role}`);
    }
  }
}

async function bootstrapWorkforceOrg() {
  try {
    await api("/platform/v1/workforce/scope/bootstrap", { method: "POST", body: "{}" }, true);
    console.log("Workforce scope bootstrapped");
  } catch (e) {
    if (String(e).includes("409") || String(e).includes("already")) {
      console.log("Workforce scope already exists");
    } else {
      throw e;
    }
  }

  const { items } = await api("/platform/v1/workforce/org-units", {}, true);
  const byName = new Map((items ?? []).map((u) => [u.name, u]));
  const rootSpec = orgTree[0];
  let root = byName.get(rootSpec.name);
  if (!root) {
    const hq = byName.get("Headquarters");
    if (hq) {
      root = await api(
        `/platform/v1/workforce/org-units/${hq.id}`,
        { method: "PATCH", body: JSON.stringify({ name: rootSpec.name, code: rootSpec.code }) },
        true,
      );
      console.log(`Renamed HQ → ${rootSpec.name}`);
      byName.set(rootSpec.name, root);
    }
  }
  if (!root) {
    root = await api(
      "/platform/v1/workforce/org-units",
      { method: "POST", body: JSON.stringify({ name: rootSpec.name, code: rootSpec.code }) },
      true,
    );
    console.log(`Created root org unit ${rootSpec.name}: ${root.id}`);
    byName.set(rootSpec.name, root);
  }

  for (const childName of rootSpec.children) {
    if (byName.has(childName)) {
      console.log(`Org unit exists: ${childName}`);
      continue;
    }
    const row = await api(
      "/platform/v1/workforce/org-units",
      {
        method: "POST",
        body: JSON.stringify({ name: childName, parentId: root.id }),
      },
      true,
    );
    console.log(`Created org unit ${childName}: ${row.id}`);
    byName.set(childName, row);
  }

  await bootstrapRoleMatrix(byName);
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

  await bootstrapWorkforceOrg();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
