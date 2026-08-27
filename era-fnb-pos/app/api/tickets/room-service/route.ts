import { assertFnbEntitled } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureOutletByCode } from "@/lib/outlet-helpers";
import { prisma } from "@/lib/prisma";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { requestOrganizationId } from "@/lib/request-organization";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const schema = z.object({
  roomNumber: z.string().min(1),
  guestName: z.string().optional(),
  outletCode: z.string().default("RESTAURANT"),
  lines: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().int().positive().default(1),
        unitPriceAzn: z.number().nonnegative(),
      }),
    )
    .min(1),
});

/** Room service ticket — no table; routes to KDS via standard fire flow. */
export async function POST(request: Request) {
  await assertFnbEntitled();
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const body = schema.parse(await request.json());
  const outlet = await ensureOutletByCode(body.outletCode);
  const cookieOutlet = await getSelectedOutletId();
  const outletId = cookieOutlet && cookieOutlet === outlet.id ? outlet.id : outlet.id;

  const subtotal = body.lines.reduce((s, l) => s + l.qty * l.unitPriceAzn, 0);
  const ticket = await prisma.ticket.create({
    data: {
      organizationId: requestOrganizationId(),
      outletId,
      serviceChannel: "ROOM_SERVICE",
      guestName: body.guestName ?? `Room ${body.roomNumber}`,
      roomChargeReservationId: null,
      subtotalAzn: subtotal,
      totalAzn: subtotal,
      lines: {
        create: body.lines.map((l) => ({
          description: l.description,
          qty: l.qty,
          unitPriceAzn: l.unitPriceAzn,
        })),
      },
    },
    include: { lines: true },
  });

  return NextResponse.json(ticket, { status: 201 });
}
