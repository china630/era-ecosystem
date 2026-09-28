import bcrypt from "bcrypt";
import {
  OrganizationKind,
  Prisma,
  TariffTier,
  UserRole,
} from "@prisma/client";
import { provisionNasAccountsForOrganization } from "../../lib/chart/chart-seed";
import { PRICING_MODULE_SEED_DEFAULTS } from "../../lib/core/pricing-module-seed";
import {
  blindIndexVoenForSeed,
  normalizeVoenForSeed,
} from "../../lib/demo/pii-for-org-seed";
import { PLATFORM_SUPER_ADMIN_EMAILS } from "../../lib/platform/upsert-platform-super-admins";
import type { SeedContext } from "../_engine/upsert";

const BCRYPT_ROUNDS = 10;

/** Keep in sync with @era/contracts ERA_LAB_DEMO */
const LAB_DEMO_OWNER_EMAIL = "owner@demo.com";
const LAB_DEMO_OWNER_PASSWORD = "12345678";
const LAB_DEMO_TAX_ID = "0123456789";
const LAB_DEMO_NAME = "ERA Lab Kafe";

function demoActiveModules(): string[] {
  return [
    ...new Set<string>([
      "nas",
      "ifrs",
      "production",
      ...PRICING_MODULE_SEED_DEFAULTS.map((m) => m.key),
    ]),
  ];
}

async function upsertDemoOwnerUser(
  prisma: SeedContext["prisma"],
  email: string,
  password: string,
): Promise<{ id: string }> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    create: {
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      isSuperAdmin: false,
      locale: "AZ",
    },
    update: {
      passwordHash: hash,
    },
    select: { id: true },
  });
}

/** Extra logins that should see demo orgs under /companies (comma-separated emails). */
function parseExtraDemoMemberEmails(): string[] {
  const raw = process.env.SEED_DEMO_EXTRA_MEMBER_EMAILS?.trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
}

/**
 * Super-admins (and optional `SEED_DEMO_EXTRA_MEMBER_EMAILS`) get ADMIN on each demo org so
 * local testing under a real account is not limited to `SEED_DEMO_USER_EMAIL` only.
 */
async function attachDemoOrgMembershipsForLocalTesters(
  prisma: SeedContext["prisma"],
  organizationIds: string[],
  demoOwnerUserId: string,
): Promise<void> {
  if (organizationIds.length === 0) return;

  const extra = parseExtraDemoMemberEmails();
  const emails = [
    ...new Set<string>([...PLATFORM_SUPER_ADMIN_EMAILS, ...extra]),
  ];

  for (const emailRaw of emails) {
    const email = emailRaw.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      console.info(`[seed:demo-org] skip attach — no user: ${email}`);
      continue;
    }
    if (user.id === demoOwnerUserId) continue;

    for (const organizationId of organizationIds) {
      const existing = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId },
        },
      });
      if (existing) continue;
      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId,
          role: UserRole.ADMIN,
        },
      });
      console.info(`[seed:demo-org] attached ADMIN: ${email} → org ${organizationId}`);
    }
  }
}

async function ensureDemoSubscription(
  prisma: SeedContext["prisma"],
  organizationId: string,
  modules: string[],
): Promise<void> {
  await prisma.organizationSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      currentTier: TariffTier.TIER_3,
      activeModules: modules,
      isTrial: false,
      isBlocked: false,
      expiresAt: new Date("2099-12-31T23:59:59.000Z"),
      customConfig: { modules } as Prisma.InputJsonValue,
    },
    update: {
      currentTier: TariffTier.TIER_3,
      activeModules: modules,
      isBlocked: false,
      expiresAt: new Date("2099-12-31T23:59:59.000Z"),
      customConfig: { modules } as Prisma.InputJsonValue,
    },
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { activeModules: modules },
  });

  for (const key of modules) {
    await prisma.organizationModule.upsert({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey: key },
      },
      create: {
        organizationId,
        moduleKey: key,
        priceSnapshot: new Prisma.Decimal(0),
      },
      update: {},
    });
  }
}

/**
 * When `SEED_DEMO_ORG=1`: attach Finance owner to the **ERA lab firm**
 * (VÖEN 0123456789). Control plane creates the org (`seed-lab-demo-org.ts`).
 * Does not mint Alpha/Beta/Budget/NGO stub MMCs.
 *
 * Env (optional):
 * - `SEED_DEMO_USER_EMAIL` — default owner@demo.com
 * - `SEED_DEMO_USER_PASSWORD` — default 12345678
 * - `SEED_DEMO_EXTRA_MEMBER_EMAILS` — extra ADMIN memberships
 */
export async function seedDemoOrganizations(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  if (process.env.SEED_DEMO_ORG !== "1") return;

  const email =
    process.env.SEED_DEMO_USER_EMAIL?.trim().toLowerCase() || LAB_DEMO_OWNER_EMAIL;
  const password =
    process.env.SEED_DEMO_USER_PASSWORD?.trim() || LAB_DEMO_OWNER_PASSWORD;

  const owner = await upsertDemoOwnerUser(ctx.prisma, email, password);
  const voen = normalizeVoenForSeed(LAB_DEMO_TAX_ID);
  const taxIdBlindIndex = blindIndexVoenForSeed(voen);
  const existing = await ctx.prisma.organization.findFirst({
    where: { taxIdBlindIndex },
    select: { id: true, name: true },
  });
  if (!existing) {
    console.warn(
      `[seed:demo-org] lab org VÖEN ${LAB_DEMO_TAX_ID} missing — run orch seed-lab-demo-org.ts (not creating stub MMCs)`,
    );
    return;
  }

  await ctx.prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: { userId: owner.id, organizationId: existing.id },
    },
    create: {
      userId: owner.id,
      organizationId: existing.id,
      role: UserRole.OWNER,
    },
    update: { role: UserRole.OWNER, deletedAt: null },
  });

  const modules = demoActiveModules();
  await ensureDemoSubscription(ctx.prisma, existing.id, modules);
  await provisionNasAccountsForOrganization(
    ctx.prisma,
    existing.id,
    OrganizationKind.COMMERCIAL,
  );
  await attachDemoOrgMembershipsForLocalTesters(ctx.prisma, [existing.id], owner.id);

  console.info(
    `[seed:demo-org] lab org ${existing.id} (${existing.name ?? LAB_DEMO_NAME}) owner ${email}`,
  );
}
