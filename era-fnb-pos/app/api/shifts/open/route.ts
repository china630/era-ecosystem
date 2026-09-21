import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureOutletByCode } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { reportPosShiftStatus } from "@/lib/pms-bridge-client";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";

const openSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  openingCash: z.number().nonnegative().default(0),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function GET(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_OPEN);
  if (denied) return denied;
  const shift = await prisma.posShift.findFirst({
    where: { status: "OPEN" },
    include: { outlet: true },
    orderBy: { openedAt: "desc" },
  });
  return NextResponse.json(shift ?? { status: "NONE" });
}

export async function POST(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_OPEN);
  if (denied) return denied;
  const body = openSchema.parse(await request.json());

  const outlet = await ensureOutletByCode(body.outletCode);

  const { resolveDefaultDevicesForSatellite } = await import("@era/satellite-kit");
  const { requestOrganizationId } = await import("@/lib/request-organization");
  const organizationId = requestOrganizationId();
  const defaults = resolveDefaultDevicesForSatellite({
    organizationId,
    outletCode: outlet.code,
  });
  const fiscalDeviceId =
    body.fiscalDeviceId ?? defaults.fiscalDeviceId ?? undefined;
  const bankTerminalId =
    body.bankTerminalId ?? defaults.bankTerminalId ?? undefined;

  // Live mode: empty catalog or unresolved KKM cannot open a till
  const live = process.env.ERA_FISCAL_LIVE === "true";
  if (live) {
    const { assertLiveFiscalReady } = await import("@era/satellite-kit");
    assertLiveFiscalReady({ organizationId, outletCode: outlet.code });
    if (!fiscalDeviceId) {
      return NextResponse.json(
        {
          error: "Select a fiscal cash register (KKM) before opening the shift",
          code: "DEVICE_SELECTION_REQUIRED",
        },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.posShift.findFirst({
    where: { outletId: outlet.id, status: "OPEN" },
    include: { outlet: true },
  });
  if (existing) {
    return NextResponse.json(existing);
  }

  const shift = await prisma.posShift.create({
    data: {
      outletId: outlet.id,
      openingCash: body.openingCash,
      fiscalDeviceId: fiscalDeviceId ?? null,
      bankTerminalId: bankTerminalId ?? null,
    },
    include: { outlet: true },
  });

  await reportPosShiftStatus({
    outletCode: outlet.code,
    status: "OPEN",
    shiftId: shift.id,
  });

  const { reportFnbPosStationCapacity } = await import("@/lib/report-pos-capacity");
  void reportFnbPosStationCapacity(prisma).catch(() => undefined);

  return NextResponse.json(shift, { status: 201 });
}
