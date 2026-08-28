/**
 * SaaS Wave 9 — live SHARED pool smoke (clinic).
 * One DB + tenant extension: Org B must not see Org A patients.
 *
 * Gate: set ERA_WAVE9_POOL_SMOKE=1 and DATABASE_URL, then:
 *   node scripts/saas-wave9-two-org-pool-smoke.mjs
 * Exit 0 when gated off (CI safe). Exit 1 on assertion failure.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const require = createRequire(path.join(appRoot, "package.json"));

const ORG_A = process.env.ERA_WAVE9_ORG_A ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = process.env.ERA_WAVE9_ORG_B ?? "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MARK_A = "WAVE9-SMOKE-A";
const MARK_B = "WAVE9-SMOKE-B";

function skip(msg) {
  console.log(`[wave9-clinic-smoke] SKIP: ${msg}`);
  process.exit(0);
}

function fail(msg) {
  console.error(`[wave9-clinic-smoke] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  if (process.env.ERA_WAVE9_POOL_SMOKE !== "1") {
    skip("ERA_WAVE9_POOL_SMOKE≠1 (opt-in local/dev only)");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    fail("DATABASE_URL required when ERA_WAVE9_POOL_SMOKE=1");
  }

  const { PrismaClient, Prisma } = require("@prisma/client");
  const kitTenancyPath = path.resolve(
    appRoot,
    "../packages/satellite-kit/dist/tenancy/satellite-tenant-extension.js",
  );
  const kitCtxPath = path.resolve(
    appRoot,
    "../packages/satellite-kit/dist/tenancy/satellite-tenant-context.js",
  );
  const { createSatelliteTenantExtension } = await import(
    pathToFileURL(kitTenancyPath).href
  );
  const { runWithSatelliteTenant } = await import(pathToFileURL(kitCtxPath).href);

  const prevSkip = process.env.ERA_SKIP_TENANT_FILTER;
  process.env.ERA_SKIP_TENANT_FILTER = "1";
  const base = new PrismaClient();
  const prisma = base.$extends(createSatelliteTenantExtension(Prisma));

  try {
    await prisma.patientRef.deleteMany({
      where: { refCode: { in: [MARK_A, MARK_B] } },
    });

    const patA = await prisma.patientRef.create({
      data: {
        organizationId: ORG_A,
        refCode: MARK_A,
        fullName: "Wave9 Smoke Alice",
      },
    });
    const patB = await prisma.patientRef.create({
      data: {
        organizationId: ORG_B,
        refCode: MARK_B,
        fullName: "Wave9 Smoke Bob",
      },
    });

    if (prevSkip === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prevSkip;

    await runWithSatelliteTenant({ organizationId: ORG_B }, async () => {
      const list = await prisma.patientRef.findMany({
        where: { refCode: { in: [MARK_A, MARK_B] } },
      });
      if (list.some((p) => p.id === patA.id || p.refCode === MARK_A)) {
        fail(`Org B list leaked Org A patient ${patA.id}`);
      }
      if (!list.some((p) => p.id === patB.id)) {
        fail(`Org B list missing Org B patient ${patB.id}`);
      }

      const cross = await prisma.patientRef.findFirst({ where: { id: patA.id } });
      if (cross) {
        fail(`Org B findFirst by Org A id returned row (expected empty)`);
      }
    });

    console.log(
      `[wave9-clinic-smoke] PASS: Org B isolated from Org A (patients ${patA.id} / ${patB.id})`,
    );
  } finally {
    process.env.ERA_SKIP_TENANT_FILTER = "1";
    await prisma.patientRef.deleteMany({
      where: { refCode: { in: [MARK_A, MARK_B] } },
    }).catch(() => undefined);
    if (prevSkip === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prevSkip;
    await base.$disconnect();
  }
}

main().catch((err) => {
  console.error("[wave9-clinic-smoke] ERROR:", err);
  process.exit(1);
});
