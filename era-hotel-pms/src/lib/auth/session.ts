import { headers } from "next/headers";
import { enterSatelliteTenant } from "@era/satellite-kit";
import { decodeSessionHeaderUtf8 } from "@/lib/auth/session-header-utf8";
import type { SessionPayload } from "./jwt";
import { prisma } from "@/lib/prisma";
import { assertHotelApiEntitled } from "@/lib/hotel-module-gate";

export async function getSessionFromHeaders(): Promise<SessionPayload | null> {
  const h = await headers();
  const userId = h.get("x-user-id");
  const role = h.get("x-user-role");
  const login = decodeSessionHeaderUtf8(h.get("x-user-login") ?? "");
  const fullName = decodeSessionHeaderUtf8(h.get("x-user-fullname") ?? "");
  let email = h.get("x-user-email")?.trim() || undefined;
  let organizationId = h.get("x-era-organization-id")?.trim() || undefined;
  if (!userId || !role) return null;

  // Legacy tokens (pre-email / pre-org claim): resolve from user row.
  if (!email || !organizationId) {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, organizationId: true },
    });
    email = email || row?.email?.trim() || undefined;
    organizationId = organizationId || row?.organizationId || undefined;
  }

  if (organizationId) {
    enterSatelliteTenant({ organizationId });
  }

  await assertHotelApiEntitled(undefined, organizationId);

  return {
    sub: userId,
    role,
    login: login ?? "",
    fullName: fullName ?? "",
    email,
    organizationId,
  };
}
