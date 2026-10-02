/**
 * ERA Lab Kafe overlay — VÖEN 0123456789 / ERA ID 100000.
 * Idempotent upsert on that org only. Does not wipe other tenants. Never demo-org.
 *
 *   npm run db:seed:demo
 * Requires orch lab org (npx tsx …/seed-lab-demo-org.ts) then:
 *   ERA_LAB_DEMO_ORGANIZATION_ID=<uuid>
 *   or CONTROL_PLANE_SERVICE_TOKEN + orch URL to resolve orgNo 100000.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { ERA_LAB_DEMO } from "@era/contracts";
import {
  enterSatelliteTenant,
  hashPassword,
  isSentinelOrganizationId,
} from "@era/satellite-kit";
import {
  asSatellitePrisma,
  createSatelliteTenantExtension,
} from "@era/satellite-kit/tenancy";
import { ensureSystemFnbRoles } from "../src/lib/auth/ensure-system-fnb-roles";
import { hashStaffPin } from "../src/lib/labor-pin";
import { recordMenuItemPrice } from "../src/lib/menu-price-history";

const base = new PrismaClient();
const prisma = asSatellitePrisma(
  base.$extends(createSatelliteTenantExtension(Prisma as never) as never) as unknown as PrismaClient,
);

async function resolveLabOrganizationId(): Promise<string> {
  const envId = process.env.ERA_LAB_DEMO_ORGANIZATION_ID?.trim();
  if (envId) {
    if (isSentinelOrganizationId(envId)) {
      throw new Error("ERA_LAB_DEMO_ORGANIZATION_ID must be a real org UUID");
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
      "Set ERA_LAB_DEMO_ORGANIZATION_ID or CONTROL_PLANE_SERVICE_TOKEN to resolve ERA ID 100000",
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
      `Lab org ERA ID ${ERA_LAB_DEMO.publicOrgNumber} not found (${res.status}). Run orch seed-lab-demo-org.ts first.`,
    );
  }
  const data = (await res.json()) as { organizationId?: string };
  const id = data.organizationId?.trim() ?? "";
  if (!id || isSentinelOrganizationId(id)) {
    throw new Error("Orch returned an invalid lab organizationId");
  }
  return id;
}

async function main() {
  const organizationId = await resolveLabOrganizationId();
  enterSatelliteTenant({ organizationId });

  await ensureSystemFnbRoles(prisma, organizationId, "kafe");

  const managerRole = await prisma.role.findFirstOrThrow({
    where: { code: "FB_MANAGER" },
  });

  const ownerHash = await hashPassword(ERA_LAB_DEMO.ownerPassword);
  await prisma.user.upsert({
    where: {
      organizationId_login: {
        organizationId,
        login: ERA_LAB_DEMO.ownerLogin,
      },
    },
    update: {
      passwordHash: ownerHash,
      email: ERA_LAB_DEMO.ownerEmail,
      roleId: managerRole.id,
      fullName: "ERA Lab Owner",
    },
    create: {
      login: ERA_LAB_DEMO.ownerLogin,
      email: ERA_LAB_DEMO.ownerEmail,
      fullName: "ERA Lab Owner",
      passwordHash: ownerHash,
      roleId: managerRole.id,
    },
  });

  await prisma.fnbOrgProfile.upsert({
    where: { organizationId },
    create: {
      edition: "kafe",
      hotelMode: false,
      waiterPinPacks: 1,
      activeModules: ["industry_fnb_pos", "fnb_waiter_pin"],
    },
    update: {
      edition: "kafe",
      hotelMode: false,
      waiterPinPacks: 1,
      activeModules: ["industry_fnb_pos", "fnb_waiter_pin"],
    },
  });

  const outlet = await prisma.outlet.upsert({
    where: { organizationId_code: { organizationId, code: "KAFE" } },
    update: { name: ERA_LAB_DEMO.cafeName, publicSlug: "era-lab-kafe", active: true },
    create: {
      code: "KAFE",
      name: ERA_LAB_DEMO.cafeName,
      revenueCenterCode: "FOOD",
      publicSlug: "era-lab-kafe",
    },
  });

  const phantom = await prisma.outlet.findFirst({
    where: { code: "RESTAURANT" },
  });
  if (phantom) {
    const tickets = await prisma.ticket.count({ where: { outletId: phantom.id } });
    if (tickets === 0) {
      await prisma.menuCategory.deleteMany({ where: { outletId: phantom.id } });
      await prisma.posTable.deleteMany({ where: { outletId: phantom.id } });
      await prisma.outlet.update({
        where: { id: phantom.id },
        data: { active: false },
      });
    }
  }

  for (const code of ["T-01", "T-02", "T-03", "T-04"]) {
    await prisma.posTable.upsert({
      where: { outletId_code: { outletId: outlet.id, code } },
      update: {},
      create: {
        outletId: outlet.id,
        code,
        name: `Masa ${code}`,
        seats: 4,
      },
    });
  }

  await prisma.staffRoster.upsert({
    where: {
      organizationId_staffCode: { organizationId, staffCode: "CASHIER-01" },
    },
    update: {
      pinHash: hashStaffPin(ERA_LAB_DEMO.cashierPin),
      pinRole: "CASHIER",
      outletId: outlet.id,
      active: true,
      fullName: "Lab Cashier",
    },
    create: {
      staffCode: "CASHIER-01",
      fullName: "Lab Cashier",
      pinHash: hashStaffPin(ERA_LAB_DEMO.cashierPin),
      pinRole: "CASHIER",
      outletId: outlet.id,
      active: true,
    },
  });

  await prisma.staffRoster.upsert({
    where: {
      organizationId_staffCode: { organizationId, staffCode: "WAITER-01" },
    },
    update: {
      pinHash: hashStaffPin(ERA_LAB_DEMO.waiterPin),
      pinRole: "WAITER",
      outletId: outlet.id,
      active: true,
      fullName: "Lab Waiter",
    },
    create: {
      staffCode: "WAITER-01",
      fullName: "Lab Waiter",
      pinHash: hashStaffPin(ERA_LAB_DEMO.waiterPin),
      pinRole: "WAITER",
      outletId: outlet.id,
      active: true,
    },
  });

  const cat =
    (await prisma.menuCategory.findFirst({
      where: { outletId: outlet.id, name: "Əsas" },
    })) ??
    (await prisma.menuCategory.create({
      data: {
        outletId: outlet.id,
        name: "Əsas",
        code: "ESAS",
        sortOrder: 1,
      },
    }));

  const dishes: Array<{ plu: string; name: string; priceAzn: number }> = [
    { plu: "KAFE-001", name: "Dönər", priceAzn: 6 },
    { plu: "KAFE-002", name: "Çay", priceAzn: 1.5 },
    { plu: "KAFE-003", name: "Qəhvə", priceAzn: 3 },
  ];

  for (const d of dishes) {
    const item = await prisma.menuItem.upsert({
      where: { categoryId_plu: { categoryId: cat.id, plu: d.plu } },
      update: { name: d.name, priceAzn: d.priceAzn },
      create: {
        categoryId: cat.id,
        plu: d.plu,
        name: d.name,
        priceAzn: d.priceAzn,
      },
    });
    const open = await prisma.menuItemPrice.findFirst({
      where: { menuItemId: item.id, effectiveTo: null },
    });
    if (!open) {
      await recordMenuItemPrice(prisma, item.id, d.priceAzn, {
        reason: "lab-demo",
      });
    }
  }

  console.log(
    `era-fnb-pos lab kafe OK org=${organizationId} login=${ERA_LAB_DEMO.ownerLogin} orgNo=${ERA_LAB_DEMO.publicOrgNumber} PIN cashier=${ERA_LAB_DEMO.cashierPin} waiter=${ERA_LAB_DEMO.waiterPin}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => base.$disconnect());
