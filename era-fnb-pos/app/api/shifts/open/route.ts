import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveOpsOutlet } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { reportPosShiftStatus } from "@/lib/pms-bridge-client";
import { getSessionFromRequest, sessionActorName } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { sessionHasFnbPermission } from "@/lib/auth/permission-check";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFnbOrgProfile } from "@/lib/fnb-org-profile";
import { isShiftStale } from "@/lib/business-day";
import { cashDrawerForShift } from "@/lib/cash-drawer";

const openSchema = z.object({
  outletCode: z.string().min(1).optional(),
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
  const profile = await getFnbOrgProfile();
  const mayClose = session
    ? sessionHasFnbPermission(session, PERMISSIONS.SHIFTS_CLOSE)
    : false;
  const mayPay = session
    ? sessionHasFnbPermission(session, PERMISSIONS.TICKETS_PAY)
    : false;
  if (!shift) {
    return NextResponse.json({
      status: "NONE",
      stale: false,
      businessDayStart: profile.businessDayStart,
      mayClose,
      mayPay,
    });
  }
  const closed = await prisma.ticket.findMany({
    where: {
      outletId: shift.outletId,
      status: "CLOSED",
      closedAt: { gte: shift.openedAt, lte: new Date() },
    },
    select: { paymentMethod: true, totalAzn: true },
  });
  const till = { cash: 0, card: 0, transfer: 0, openChecks: 0 };
  for (const row of closed) {
    const amount = Number(row.totalAzn);
    const method = (row.paymentMethod ?? "").toUpperCase();
    if (method === "CASH") till.cash += amount;
    else if (method === "CARD") till.card += amount;
    else if (method === "TRANSFER") till.transfer += amount;
  }
  till.cash = Math.round(till.cash * 100) / 100;
  till.card = Math.round(till.card * 100) / 100;
  till.transfer = Math.round(till.transfer * 100) / 100;
  till.openChecks = await prisma.ticket.count({
    where: { outletId: shift.outletId, status: { in: ["OPEN", "HELD"] } },
  });
  return NextResponse.json({
    ...shift,
    stale: isShiftStale(shift.openedAt, new Date(), profile.businessDayStart),
    businessDayStart: profile.businessDayStart,
    drawer: await cashDrawerForShift(shift),
    till,
    mayClose,
    mayPay,
  });
}

export async function POST(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = denyUnlessPermission(session, PERMISSIONS.SHIFTS_OPEN);
  if (denied) return denied;
  const body = openSchema.parse(await request.json());

  const outlet = await resolveOpsOutlet(body.outletCode);

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
      openedBy: sessionActorName(session),
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
