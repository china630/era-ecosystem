import { NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  isSatelliteStaffDeactivated,
  isSatelliteStaffProvisioned,
  satelliteStaffDeactivatedSchema,
  satelliteStaffProvisionedSchema,
} from "@era/contracts";
import { prisma } from "@/lib/prisma";

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const ROLE_CODES: Record<string, string> = {
  RECEPTION: "reception",
  HOUSEKEEPING: "housekeeping",
  MANAGER: "manager",
  STAFF: "reception",
};

export async function POST(request: Request) {
  const secret = process.env.SATELLITE_BRIDGE_SECRET?.trim() ?? "";
  const header = request.headers.get("x-satellite-bridge-secret")?.trim() ?? "";
  if (secret && header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = await request.json();
    if (isSatelliteStaffProvisioned(event)) {
      /** T3 ops cache: fullName is display stamp only; identifiers stay in MDM (Plan D). */
      const parsed = satelliteStaffProvisionedSchema.parse(event);
      const p = parsed.payload;
      const roleCode = ROLE_CODES[p.satelliteRole] ?? "reception";
      const role = await prisma.role.findFirst({ where: { code: roleCode } });
      if (!role) return NextResponse.json({ error: `Role ${roleCode} missing` }, { status: 400 });
      const login = p.login ?? `emp-${p.staffCode.toLowerCase()}`;
      const pin = p.pin ?? "0000";
      const globalPersonId = parsed.globalPersonId ?? null;
      const cpEmploymentId = p.cpEmploymentId;

      const byCp = await prisma.user.findFirst({ where: { cpEmploymentId } });
      const user = byCp
        ? await prisma.user.update({
            where: { id: byCp.id },
            data: {
              fullName: p.fullName,
              status: "ACTIVE",
              globalPersonId,
              cpEmploymentId,
              roleId: role.id,
            },
          })
        : await prisma.user.upsert({
            where: { login },
            create: {
              login,
              fullName: p.fullName,
              passwordHash: hashSecret(pin),
              roleId: role.id,
              isCrossSystem: true,
              globalPersonId,
              cpEmploymentId,
              ...(p.financeEmployeeId ? { financeEmployeeId: p.financeEmployeeId } : {}),
            },
            update: {
              fullName: p.fullName,
              status: "ACTIVE",
              globalPersonId,
              cpEmploymentId,
              roleId: role.id,
            },
          });
      return NextResponse.json({ satelliteUserId: user.id });
    }
    if (isSatelliteStaffDeactivated(event)) {
      const parsed = satelliteStaffDeactivatedSchema.parse(event);
      if (parsed.payload.satelliteUserId) {
        await prisma.user.updateMany({
          where: { id: parsed.payload.satelliteUserId },
          data: { status: "DISABLED" },
        });
      }
      await prisma.user.updateMany({
        where: { cpEmploymentId: parsed.payload.cpEmploymentId },
        data: { status: "DISABLED" },
      });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unsupported event" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provision failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
