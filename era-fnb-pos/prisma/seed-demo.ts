/**
 * ERA Lab Kafe overlay — VÖEN 0123456789 / ERA ID 100000.
 * Idempotent upsert on that org only. Does not wipe other tenants. Never demo-org.
 *
 *   npm run db:seed:demo
 * Requires orch lab org (npx tsx …/seed-lab-demo-org.ts) then:
 *   ERA_LAB_DEMO_ORGANIZATION_ID=<uuid>
 *   or CONTROL_PLANE_SERVICE_TOKEN + orch URL to resolve orgNo 100000.
 */
import { PrismaClient } from "@prisma/client";
import { ERA_LAB_DEMO } from "@era/contracts";
import { hashPassword, isSentinelOrganizationId } from "@era/satellite-kit";
import { ensureSystemFnbRoles } from "../src/lib/auth/ensure-system-fnb-roles";
import { hashStaffPin } from "../src/lib/labor-pin";
import { recordMenuItemPrice } from "../src/lib/menu-price-history";

process.env.ERA_SKIP_TENANT_FILTER = "1";

const prisma = new PrismaClient();

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

  await ensureSystemFnbRoles(prisma, organizationId, "kafe");

  const managerRole = await prisma.role.findFirstOrThrow({
    where: { organizationId, code: "FB_MANAGER" },
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
      organizationId,
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
      organizationId,
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
    update: { name: ERA_LAB_DEMO.cafeName, publicSlug: "era-lab-kafe" },
    create: {
      organizationId,
      code: "KAFE",
      name: ERA_LAB_DEMO.cafeName,
      revenueCenterCode: "FOOD",
      publicSlug: "era-lab-kafe",
    },
  });

  for (const code of ["T-01", "T-02", "T-03", "T-04"]) {
    await prisma.posTable.upsert({
      where: { outletId_code: { outletId: outlet.id, code } },
      update: {},
      create: {
        outletId: outlet.id,
        organizationId,
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
      organizationId,
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
      organizationId,
      staffCode: "WAITER-01",
      fullName: "Lab Waiter",
      pinHash: hashStaffPin(ERA_LAB_DEMO.waiterPin),
      pinRole: "WAITER",
      outletId: outlet.id,
      active: true,
    },
  });

  let cat = await prisma.menuCategory.findFirst({
    where: { organizationId, outletId: outlet.id, name: "Əsas" },
  });
  if (!cat) {
    cat = await prisma.menuCategory.create({
      data: {
        organizationId,
        outletId: outlet.id,
        name: "Əsas",
        sortOrder: 1,
      },
    });
  }

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
        organizationId,
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
  .finally(() => prisma.$disconnect());
