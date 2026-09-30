/**
 * Upsert the ERA lab demo organization (VÖEN 0123456789, ERA ID 100000).
 * SoT for café / later satellite presets. Never uses sentinel demo-org.
 *
 * Usage (from era-orchestrator, DATABASE_URL set):
 *   npx tsx packages/database/prisma/scripts/seed-lab-demo-org.ts
 */
import { createHash, createCipheriv, createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, TariffTier, UserRole } from "../../generated/client";
import { closePrismaPool, createPrismaClient } from "../prisma-client";

/** Keep in sync with @era/contracts ERA_LAB_DEMO */
const LAB = {
  taxId: "0123456789",
  publicOrgNumber: 100_000,
  ownerEmail: "owner@demo.com",
  ownerPassword: "12345678",
  cafeName: "ERA Lab Kafe",
} as const;

const FNB_KEY = "industry_fnb_pos";
const FNB_ZAL = "fnb_waiter_pin";

function piiKey(primaryName: string): Buffer {
  const raw = process.env[primaryName]?.trim();
  if (raw) {
    const asB64 = Buffer.from(raw, "base64");
    return asB64.length >= 32
      ? createHash("sha256").update(asB64).digest()
      : createHash("sha256").update(raw).digest();
  }
  return createHash("sha256").update(`${primaryName}:erafinance-dev-fallback`).digest();
}

function encryptText(value: string): string {
  const key = piiKey("PII_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function blindIndexVoen(voen: string): string {
  const key = piiKey("PII_BLIND_INDEX_KEY");
  return createHmac("sha256", key).update(`voen:${voen.replace(/\D/g, "")}`).digest("hex");
}

const LAB_MODULES = [FNB_KEY, FNB_ZAL] as const;

async function upsertLabSubscription(
  prisma: ReturnType<typeof createPrismaClient>,
  organizationId: string,
): Promise<string[]> {
  const existing = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    select: { activeModules: true },
  });
  const set = new Set(existing?.activeModules ?? []);
  for (const m of LAB_MODULES) set.add(m);
  const activeModules = [...set];
  if (existing) {
    await prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        activeModules,
        isTrial: false,
        isBlocked: false,
      },
    });
  } else {
    await prisma.organizationSubscription.create({
      data: {
        organizationId,
        currentTier: TariffTier.TIER_0,
        isTrial: false,
        isBlocked: false,
        activeModules,
        customConfig: { modules: activeModules, signupSource: "lab-demo" },
      },
    });
  }
  await prisma.organization.update({
    where: { id: organizationId },
    data: { activeModules },
  });
  return activeModules;
}

async function upsertFnbSatelliteEntitlement(
  prisma: ReturnType<typeof createPrismaClient>,
  organizationId: string,
): Promise<void> {
  try {
    await prisma.satellite.upsert({
      where: { key: FNB_KEY },
      create: {
        key: FNB_KEY,
        name: "F&B POS",
        verticalSlug: "fnb",
        sortOrder: 40,
      },
      update: {},
    });
    await prisma.organizationSatelliteEntitlement.upsert({
      where: {
        organizationId_satelliteKey: {
          organizationId,
          satelliteKey: FNB_KEY,
        },
      },
      create: {
        organizationId,
        satelliteKey: FNB_KEY,
        isTrial: false,
        trialOverridden: true,
      },
      update: { isTrial: false, trialOverridden: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[lab-demo] satellite entitlement skipped: ${msg}\n`);
  }
}

async function pushFnbBindAndRuntime(
  organizationId: string,
  activeModules: string[],
): Promise<void> {
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() || "";
  const base = poolBaseUrl();
  if (!token) {
    process.stdout.write(
      "[lab-demo] skip F&B bind: SATELLITE_EVENT_SERVICE_TOKEN unset\n",
    );
    return;
  }
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  const timeout = AbortSignal.timeout(
    Number(process.env.SATELLITE_FANOUT_TIMEOUT_MS ?? 15_000),
  );
  const bindRes = await fetch(`${base}/api/internal/v1/organization/bind`, {
    method: "POST",
    headers,
    body: JSON.stringify({ organizationId, boundBy: "lab-demo-seed" }),
    signal: timeout,
  });
  process.stdout.write(`[lab-demo] F&B bind ${bindRes.status}\n`);
  const runtimeRes = await fetch(`${base}/api/internal/v1/runtime-config`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      organizationId,
      updatedBy: "lab-demo-seed",
      deploymentTopology: "SHARED",
      edition: "kafe",
      publicOrgNumber: LAB.publicOrgNumber,
      activeModules,
    }),
    signal: AbortSignal.timeout(
      Number(process.env.SATELLITE_FANOUT_TIMEOUT_MS ?? 15_000),
    ),
  });
  process.stdout.write(`[lab-demo] F&B runtime-config ${runtimeRes.status}\n`);
}

function poolBaseUrl(): string {
  const keys = [
    "ERA_FNB_POS_ORIGIN",
    "NEXT_PUBLIC_SATELLITE_FNB_POS_URL",
    "NEXT_PUBLIC_SATELLITE_FB_POS_URL",
  ];
  for (const k of keys) {
    const raw = process.env[k]?.trim();
    if (raw) return raw.replace(/\/$/, "");
  }
  return "https://fnb-pos.era-365.online";
}

async function main() {
  const prisma = createPrismaClient();
  const taxIdBlindIndex = blindIndexVoen(LAB.taxId);
  const passwordHash = await bcrypt.hash(LAB.ownerPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: LAB.ownerEmail },
    create: {
      email: LAB.ownerEmail,
      passwordHash,
      firstNameCipher: encryptText("Lab"),
      lastNameCipher: encryptText("Owner"),
    },
    update: { passwordHash },
  });

  const takenNumber = await prisma.organization.findUnique({
    where: { publicOrgNumber: LAB.publicOrgNumber },
    select: { id: true, taxIdBlindIndex: true, name: true },
  });
  const byVoen = await prisma.organization.findFirst({
    where: { taxIdBlindIndex },
    select: { id: true, publicOrgNumber: true, name: true },
  });

  if (
    takenNumber &&
    byVoen &&
    takenNumber.id !== byVoen.id
  ) {
    throw new Error(
      `ERA ID ${LAB.publicOrgNumber} belongs to ${takenNumber.id} but VÖEN ${LAB.taxId} is ${byVoen.id}`,
    );
  }
  if (takenNumber && !byVoen && takenNumber.taxIdBlindIndex !== taxIdBlindIndex) {
    throw new Error(
      `ERA ID ${LAB.publicOrgNumber} already used by org ${takenNumber.id} (${takenNumber.name})`,
    );
  }

  const settings = {
    edition: "kafe",
    signupSource: "lab-demo",
    hotelMode: false,
    waiterPinPacks: 1,
  };

  let organizationId: string;
  if (byVoen) {
    organizationId = byVoen.id;
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: LAB.cafeName,
        ownerId: user.id,
        publicOrgNumber: LAB.publicOrgNumber,
        taxIdBlindIndex,
        taxIdCipher: encryptText(LAB.taxId),
        subscriptionPlan: "kafe",
        deploymentTopology: "SHARED",
        settings,
      },
    });
  } else if (takenNumber) {
    organizationId = takenNumber.id;
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: LAB.cafeName,
        ownerId: user.id,
        taxIdBlindIndex,
        taxIdCipher: encryptText(LAB.taxId),
        subscriptionPlan: "kafe",
        deploymentTopology: "SHARED",
        settings,
      },
    });
  } else {
    const created = await prisma.organization.create({
      data: {
        name: LAB.cafeName,
        ownerId: user.id,
        publicOrgNumber: LAB.publicOrgNumber,
        taxIdBlindIndex,
        taxIdCipher: encryptText(LAB.taxId),
        subscriptionPlan: "kafe",
        deploymentTopology: "SHARED",
        settings,
      },
    });
    organizationId = created.id;
  }

  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: { userId: user.id, organizationId },
    },
    create: {
      userId: user.id,
      organizationId,
      role: UserRole.OWNER,
    },
    update: { deletedAt: null, role: UserRole.OWNER },
  });

  for (const moduleKey of [FNB_KEY, FNB_ZAL]) {
    await prisma.organizationModule.upsert({
      where: { organizationId_moduleKey: { organizationId, moduleKey } },
      create: {
        organizationId,
        moduleKey,
        priceSnapshot: new Prisma.Decimal(0),
      },
      update: {
        pendingDeactivation: false,
        cancelledAt: null,
        accessUntil: null,
        activatedAt: new Date(),
      },
    });
  }

  await prisma.satelliteEndpoint.upsert({
    where: {
      organizationId_satelliteKey: {
        organizationId,
        satelliteKey: FNB_KEY,
      },
    },
    create: {
      organizationId,
      satelliteKey: FNB_KEY,
      baseUrl: poolBaseUrl(),
      enabled: true,
    },
    update: {
      baseUrl: poolBaseUrl(),
      enabled: true,
    },
  });

  const activeModules = await upsertLabSubscription(prisma, organizationId);
  await upsertFnbSatelliteEntitlement(prisma, organizationId);
  try {
    await pushFnbBindAndRuntime(organizationId, activeModules);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[lab-demo] F&B bind/runtime skipped: ${msg}\n`);
  }

  process.stdout.write(
    `[lab-demo] org ${organizationId} ERA ID ${LAB.publicOrgNumber} VÖEN ${LAB.taxId} owner ${LAB.ownerEmail} modules ${activeModules.join(",")}\n`,
  );

  await prisma.$disconnect();
  await closePrismaPool();
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : e}\n`);
  process.exit(1);
});
