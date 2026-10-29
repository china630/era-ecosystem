/**
 * Phase D — buffet lab demo week (idempotent).
 * Prerequisite: `npm run db:seed:demo` (ERA ID 100000 / KAFE remains).
 *
 *   npm run db:seed:buffet-demo
 *
 * Org (first wins): ERA_BUFFET_DEMO_ORGANIZATION_ID → ERA_FB_ORGANIZATION_ID → lab resolve.
 * Outlet: NAFTANI (never invents RESTAURANT).
 * Force refresh week: SEED_BUFFET_FORCE=1
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { ERA_LAB_DEMO } from "@era/contracts";
import {
  enterSatelliteTenant,
  isSentinelOrganizationId,
} from "@era/satellite-kit";
import { todayBakuYmd, bakuCivilUtcDate } from "@era/satellite-kit/time";
import {
  asSatellitePrisma,
  createSatelliteTenantExtension,
} from "@era/satellite-kit/tenancy";
import {
  defaultBuffetCostSettings,
  parseBuffetCostSettings,
} from "../src/lib/buffet-cost-settings";
import { mondayOfWeekYmd, addDaysYmd, ymdForWeekday } from "../src/lib/buffet-week-calendar";
import { BUFFET_MEALS } from "../src/lib/buffet-planner-math";

const base = new PrismaClient();
const prisma = asSatellitePrisma(
  base.$extends(createSatelliteTenantExtension(Prisma as never) as never) as unknown as PrismaClient,
);

const FORCE = process.env.SEED_BUFFET_FORCE === "1";
const MID_NIGHTS = 180;
const MARKER = "buffetDemoSeed";

async function resolveOrganizationId(): Promise<string> {
  for (const key of [
    "ERA_BUFFET_DEMO_ORGANIZATION_ID",
    "ERA_FB_ORGANIZATION_ID",
    "ERA_LAB_DEMO_ORGANIZATION_ID",
  ] as const) {
    const envId = process.env[key]?.trim();
    if (!envId) continue;
    if (isSentinelOrganizationId(envId)) {
      throw new Error(`${key} must be a real org UUID (not demo-org / nafta sentinel)`);
    }
    return envId;
  }
  const orch = (
    process.env.ORCH_API_URL ||
    process.env.NEXT_PUBLIC_ORCH_API_URL ||
    "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
  const token =
    process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
    "";
  if (!token) {
    throw new Error(
      "Set ERA_BUFFET_DEMO_ORGANIZATION_ID / ERA_FB_ORGANIZATION_ID / ERA_LAB_DEMO_ORGANIZATION_ID or CONTROL_PLANE_SERVICE_TOKEN for ERA ID 100000",
    );
  }
  const res = await fetch(
    `${orch}/internal/v1/organizations/by-public-number/${ERA_LAB_DEMO.publicOrgNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-service-token": token,
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `Lab org ERA ID ${ERA_LAB_DEMO.publicOrgNumber} not found (${res.status}). Run orch seed-lab-demo-org + npm run db:seed:demo first.`,
    );
  }
  const data = (await res.json()) as { organizationId?: string };
  const id = data.organizationId?.trim() ?? "";
  if (!id || isSentinelOrganizationId(id)) {
    throw new Error("Orch returned an invalid lab organizationId");
  }
  return id;
}

function weekBounds(): { monday: string; sunday: string } {
  const anchor =
    process.env.SEED_BUFFET_WEEK_START?.trim() || todayBakuYmd();
  const monday = mondayOfWeekYmd(anchor);
  return { monday, sunday: addDaysYmd(monday, 6) };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("[seed-buffet-demo] Refuse: NODE_ENV=production");
    process.exit(1);
  }

  const organizationId = await resolveOrganizationId();
  enterSatelliteTenant({ organizationId });

  const manager = await prisma.user.findFirst({
    where: { organizationId, login: ERA_LAB_DEMO.ownerLogin },
  });
  if (!manager) {
    throw new Error(
      `Missing lab owner login "${ERA_LAB_DEMO.ownerLogin}". Run npm run db:seed:demo first.`,
    );
  }

  const profile = await prisma.fnbOrgProfile.findUnique({
    where: { organizationId },
  });
  if (!profile) {
    throw new Error("Missing FnbOrgProfile — run npm run db:seed:demo first.");
  }
  const modules = new Set(profile.activeModules ?? []);
  modules.add("industry_fnb_pos");
  modules.add("fnb_buffet_planner");
  await prisma.fnbOrgProfile.update({
    where: { organizationId },
    data: { activeModules: [...modules] },
  });

  const outlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId, code: "NAFTANI" } },
    update: {
      name: "Naftani buffet (lab)",
      active: true,
      capTill: true,
      capTables: true,
      capBuffetPlanner: true,
      shapeHint: "restaurant",
    },
    create: {
      organizationId,
      code: "NAFTANI",
      name: "Naftani buffet (lab)",
      publicSlug: "naftani-buffet-lab",
      active: true,
      capTill: true,
      capTables: true,
      capBuffetPlanner: true,
      shapeHint: "restaurant",
    },
  });

  const settings = parseBuffetCostSettings(
    profile.buffetCostSettingsJson,
    Boolean(profile.hotelMode),
  );
  settings.orgDefaults.buffetCostModel = "HYBRID";
  settings.orgDefaults.staffBuffetOverlap = "OVERLAP_PCT";
  settings.orgDefaults.overlapPct = 30;
  if (Boolean(profile.hotelMode)) {
    settings.orgDefaults.cogsPostingMode = "DAY_DOCUMENT";
  }
  settings.forecastPack = {
    bands: settings.forecastPack.bands.length
      ? settings.forecastPack.bands
      : defaultBuffetCostSettings(Boolean(profile.hotelMode)).forecastPack.bands,
    keySkuNorms: [
      { sku: "MEAT", name: "Meat", unit: "kg", qtyPerGuestNight: 0.12, aznPerGuestNight: 2.4 },
      { sku: "OIL", name: "Oil", unit: "L", qtyPerGuestNight: 0.02, aznPerGuestNight: 0.3 },
      { sku: "FLOUR", name: "Flour", unit: "kg", qtyPerGuestNight: 0.05, aznPerGuestNight: 0.2 },
      { sku: "PASTA", name: "Pasta", unit: "kg", qtyPerGuestNight: 0.04, aznPerGuestNight: 0.25 },
    ],
  };
  // Buffet outlet HYBRID; keep peer overrides; Hoodmani/XUDMANI stay OFF if present.
  settings.outletOverrides = { ...settings.outletOverrides };
  settings.outletOverrides[outlet.id] = {
    ...settings.outletOverrides[outlet.id],
    buffetCostModel: "HYBRID",
    overlapPct: 30,
  };
  const peerOutlets = await prisma.outlet.findMany({
    where: {
      organizationId,
      code: { in: ["HOODMANI", "XUDMANI", "HUDMANI"] },
      active: true,
    },
    select: { id: true, code: true },
  });
  for (const peer of peerOutlets) {
    settings.outletOverrides[peer.id] = {
      ...settings.outletOverrides[peer.id],
      buffetCostModel: "OFF",
    };
  }
  await prisma.fnbOrgProfile.update({
    where: { organizationId },
    data: { buffetCostSettingsJson: settings as unknown as Prisma.InputJsonValue },
  });

  const { monday, sunday } = weekBounds();

  let template = await prisma.buffetWeekTemplate.findFirst({
    where: { organizationId, outletId: outlet.id, name: "Lab buffet week" },
  });
  if (!template) {
    await prisma.buffetWeekTemplate.updateMany({
      where: { organizationId, outletId: outlet.id, active: true },
      data: { active: false },
    });
    template = await prisma.buffetWeekTemplate.create({
      data: {
        organizationId,
        outletId: outlet.id,
        name: "Lab buffet week",
        active: true,
      },
    });
  } else if (!template.active) {
    await prisma.buffetWeekTemplate.updateMany({
      where: { organizationId, outletId: outlet.id, active: true },
      data: { active: false },
    });
    template = await prisma.buffetWeekTemplate.update({
      where: { id: template.id },
      data: { active: true },
    });
  }

  for (let weekday = 1; weekday <= 7; weekday++) {
    for (const meal of BUFFET_MEALS) {
      await prisma.buffetWeekTemplateSlot.upsert({
        where: {
          templateId_weekday_meal: {
            templateId: template.id,
            weekday,
            meal,
          },
        },
        create: {
          organizationId,
          templateId: template.id,
          weekday,
          meal,
          coversAdult: meal === "BREAKFAST" ? 80 : meal === "LUNCH" ? 120 : 90,
          coversChild: meal === "BREAKFAST" ? 10 : 15,
        },
        update: FORCE
          ? {
              coversAdult: meal === "BREAKFAST" ? 80 : meal === "LUNCH" ? 120 : 90,
              coversChild: meal === "BREAKFAST" ? 10 : 15,
            }
          : {},
      });
    }
  }

  for (let weekday = 1; weekday <= 7; weekday++) {
    const ymd = ymdForWeekday(monday, weekday);
    const serviceDate = bakuCivilUtcDate(ymd);
    for (const meal of BUFFET_MEALS) {
      const slot = await prisma.buffetWeekTemplateSlot.findUnique({
        where: {
          templateId_weekday_meal: {
            templateId: template.id,
            weekday,
            meal,
          },
        },
      });
      if (!slot) continue;
      const existing = await prisma.buffetPlan.findUnique({
        where: {
          outletId_serviceDate_meal: {
            outletId: outlet.id,
            serviceDate,
            meal,
          },
        },
      });
      if (existing && !FORCE) continue;
      if (existing && FORCE) {
        await prisma.buffetPlan.update({
          where: { id: existing.id },
          data: {
            coversAdult: slot.coversAdult,
            coversChild: slot.coversChild,
            status: "DRAFT",
          },
        });
      } else {
        await prisma.buffetPlan.create({
          data: {
            organizationId,
            outletId: outlet.id,
            serviceDate,
            meal,
            coversAdult: slot.coversAdult,
            coversChild: slot.coversChild,
            status: "DRAFT",
          },
        });
      }
    }
  }

  for (let d = 0; d < 7; d++) {
    const ymd = addDaysYmd(monday, d);
    const serviceDate = bakuCivilUtcDate(ymd);
    await prisma.buffetGuestNightEntry.upsert({
      where: {
        organizationId_serviceDate: { organizationId, serviceDate },
      },
      create: {
        organizationId,
        outletId: outlet.id,
        serviceDate,
        guestNights: MID_NIGHTS,
        source: "MANUAL",
        notes: MARKER,
      },
      update: FORCE
        ? { guestNights: MID_NIGHTS, outletId: outlet.id, source: "MANUAL", notes: MARKER }
        : { outletId: outlet.id },
    });
  }

  await prisma.buffetStaffMealPlan.updateMany({
    where: { organizationId, outletId: outlet.id, active: true },
    data: { active: false },
  });
  let staffPlan = await prisma.buffetStaffMealPlan.findFirst({
    where: { organizationId, outletId: outlet.id, name: "Lab staff meals" },
  });
  if (!staffPlan) {
    staffPlan = await prisma.buffetStaffMealPlan.create({
      data: {
        organizationId,
        outletId: outlet.id,
        name: "Lab staff meals",
        active: true,
      },
    });
  } else {
    staffPlan = await prisma.buffetStaffMealPlan.update({
      where: { id: staffPlan.id },
      data: { active: true },
    });
  }
  for (let weekday = 1; weekday <= 7; weekday++) {
    for (const meal of ["BREAKFAST", "LUNCH"] as const) {
      await prisma.buffetStaffMealPlanSlot.upsert({
        where: {
          planId_weekday_meal: {
            planId: staffPlan.id,
            weekday,
            meal,
          },
        },
        create: {
          organizationId,
          planId: staffPlan.id,
          weekday,
          meal,
          coversStaff: meal === "BREAKFAST" ? 12 : 18,
        },
        update: FORCE ? { coversStaff: meal === "BREAKFAST" ? 12 : 18 } : {},
      });
    }
  }

  const mgmtDays = [1, 3, 5].map((wd) => ymdForWeekday(monday, wd));
  for (const ymd of mgmtDays) {
    const serviceDate = bakuCivilUtcDate(ymd);
    await prisma.buffetManagementMeal.upsert({
      where: {
        outletId_serviceDate_meal_actorLabel: {
          outletId: outlet.id,
          serviceDate,
          meal: "LUNCH",
          actorLabel: "Lab GM",
        },
      },
      create: {
        organizationId,
        outletId: outlet.id,
        serviceDate,
        meal: "LUNCH",
        actorLabel: "Lab GM",
        notes: MARKER,
      },
      update: { notes: MARKER },
    });
  }

  const cat = await prisma.menuCategory.upsert({
    where: { outletId_code: { outletId: outlet.id, code: "BUFF-COMP" } },
    update: { name: "Buffet COMP", sortOrder: 90 },
    create: {
      organizationId,
      outletId: outlet.id,
      name: "Buffet COMP",
      code: "BUFF-COMP",
      sortOrder: 90,
    },
  });
  const compItem = await prisma.menuItem.upsert({
    where: { categoryId_plu: { categoryId: cat.id, plu: "BUFF-COMP-01" } },
    update: {
      name: "Staff tasting (COMP)",
      priceAzn: 0,
      recipeSku: "MEAT",
      active: true,
    },
    create: {
      organizationId,
      categoryId: cat.id,
      plu: "BUFF-COMP-01",
      name: "Staff tasting (COMP)",
      priceAzn: 0,
      recipeSku: "MEAT",
      active: true,
    },
  });

  const midYmd = addDaysYmd(monday, 2);
  const closedAt = bakuCivilUtcDate(midYmd);
  closedAt.setUTCHours(14, 0, 0, 0);
  const existingComp = await prisma.ticket.findFirst({
    where: {
      organizationId,
      outletId: outlet.id,
      externalRef: `${MARKER}-comp-${midYmd}`,
    },
  });
  if (!existingComp || FORCE) {
    if (existingComp) {
      await prisma.ticketLine.deleteMany({ where: { ticketId: existingComp.id } });
      await prisma.ticket.delete({ where: { id: existingComp.id } });
    }
    await prisma.ticket.create({
      data: {
        organizationId,
        outletId: outlet.id,
        status: "CLOSED",
        covers: 1,
        walkInLabel: "Buffet COMP demo",
        serviceChannel: "WALK_IN",
        paymentMethod: "COMP",
        subtotalAzn: 0,
        totalAzn: 0,
        openedAt: closedAt,
        closedAt,
        externalRef: `${MARKER}-comp-${midYmd}`,
        lines: {
          create: [
            {
              organizationId,
              menuItemId: compItem.id,
              description: compItem.name,
              qty: 2,
              unitPriceAzn: 0,
              kitchenStatus: "SERVED",
            },
          ],
        },
      },
    });
  }

  console.log(
    [
      "[seed-buffet-demo] OK",
      `org=${organizationId}`,
      `outletCode=${outlet.code}`,
      `week=${monday}..${sunday}`,
      `guestNights/day=${MID_NIGHTS} (MID)`,
      `module=fnb_buffet_planner`,
      `login=${ERA_LAB_DEMO.ownerLogin}`,
      `Finance: SEED_BUFFET_OUTLET_CODE=${outlet.code} ERA_BUFFET_DEMO_ORGANIZATION_ID=${organizationId} npm run db:seed:buffet-demo`,
    ].join("\n  "),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => base.$disconnect());
