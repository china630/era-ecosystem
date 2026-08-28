/**
 * SaaS Wave 9 — live SHARED pool smoke (hotel).
 * One DB + tenant extension: Org B must not see Org A guests.
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
const MARK_A = "WAVE9-SMOKE-GUEST-A";
const MARK_B = "WAVE9-SMOKE-GUEST-B";

function skip(msg) {
  console.log(`[wave9-hotel-smoke] SKIP: ${msg}`);
  process.exit(0);
}

function fail(msg) {
  console.error(`[wave9-hotel-smoke] FAIL: ${msg}`);
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
    await prisma.guest.deleteMany({
      where: { externalRef: { in: [MARK_A, MARK_B] } },
    });

    const guestA = await prisma.guest.create({
      data: {
        organizationId: ORG_A,
        externalRef: MARK_A,
        fullName: "Wave9 Smoke Alice",
      },
    });
    const guestB = await prisma.guest.create({
      data: {
        organizationId: ORG_B,
        externalRef: MARK_B,
        fullName: "Wave9 Smoke Bob",
      },
    });

    if (prevSkip === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prevSkip;

    await runWithSatelliteTenant({ organizationId: ORG_B }, async () => {
      const list = await prisma.guest.findMany({
        where: { externalRef: { in: [MARK_A, MARK_B] } },
      });
      if (list.some((g) => g.id === guestA.id || g.externalRef === MARK_A)) {
        fail(`Org B list leaked Org A guest ${guestA.id}`);
      }
      if (!list.some((g) => g.id === guestB.id)) {
        fail(`Org B list missing Org B guest ${guestB.id}`);
      }

      const cross = await prisma.guest.findFirst({ where: { id: guestA.id } });
      if (cross) {
        fail(`Org B findFirst by Org A id returned row (expected empty)`);
      }
    });

    console.log(
      `[wave9-hotel-smoke] PASS: Org B isolated from Org A (guests ${guestA.id} / ${guestB.id})`,
    );
  } finally {
    process.env.ERA_SKIP_TENANT_FILTER = "1";
    await prisma.guest.deleteMany({
      where: { externalRef: { in: [MARK_A, MARK_B] } },
    }).catch(() => undefined);
    if (prevSkip === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prevSkip;
    await base.$disconnect();
  }
}

main().catch((err) => {
  console.error("[wave9-hotel-smoke] ERROR:", err);
  process.exit(1);
});
