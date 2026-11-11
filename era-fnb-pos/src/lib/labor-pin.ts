import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

/** SHA-256 PIN hash used by `/api/labor/clock` (AC-FNB-LABOR). */
export function hashStaffPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

const DUMMY_PIN_HASH = hashStaffPin("timing-pad");

export function pinMatches(storedHash: string | null | undefined, pin: string): boolean {
  const derived = Buffer.from(hashStaffPin(pin), "hex");
  const stored = Buffer.from(
    storedHash && storedHash.length === DUMMY_PIN_HASH.length
      ? storedHash
      : DUMMY_PIN_HASH,
    "hex",
  );
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived) && Boolean(storedHash);
}

export function listActiveStaffRoster() {
  return prisma.staffRoster.findMany({
    where: { active: true },
    select: {
      id: true,
      staffCode: true,
      fullName: true,
      pinRole: true,
      outletId: true,
      globalPersonId: true,
    },
  });
}

export function countActiveWaitersForOrg(organizationId: string) {
  return prisma.staffRoster.count({
    where: { organizationId, active: true, pinRole: "WAITER" },
  });
}

export function upsertStaffRosterRow(data: {
  organizationId: string;
  staffCode: string;
  fullName: string;
  pinHash: string;
  pinRole: "CASHIER" | "WAITER" | "KITCHEN" | "MANAGER";
  outletId: string;
  globalPersonId?: string;
}) {
  const { organizationId, staffCode, ...rest } = data;
  return prisma.staffRoster.upsert({
    where: {
      organizationId_staffCode: { organizationId, staffCode },
    },
    create: {
      organizationId,
      staffCode,
      ...rest,
    },
    update: {
      fullName: rest.fullName,
      pinHash: rest.pinHash,
      pinRole: rest.pinRole,
      outletId: rest.outletId,
      globalPersonId: rest.globalPersonId,
      active: true,
    },
  });
}

export function findStaffRosterByStaffCode(staffCode: string) {
  return prisma.staffRoster.findFirst({
    where: { staffCode },
  });
}

export function createPinClockEvent(data: {
  staffCode: string;
  eventType: "CLOCK_IN" | "CLOCK_OUT";
}) {
  return prisma.pinClockEvent.create({ data });
}

export function findActiveStaffByIdForOrg(staffId: string, organizationId: string) {
  return prisma.staffRoster.findFirst({
    where: {
      id: staffId,
      organizationId,
      active: true,
    },
  });
}

export function recordStaffPinFailure(
  staffId: string,
  pinFailCount: number,
  pinLockedUntil: Date | null,
) {
  return prisma.staffRoster.update({
    where: { id: staffId },
    data: { pinFailCount, pinLockedUntil },
  });
}

export function clearStaffPinFailures(staffId: string) {
  return prisma.staffRoster.update({
    where: { id: staffId },
    data: { pinFailCount: 0, pinLockedUntil: null },
  });
}

export function listTerminalStaffRoster(organizationId: string, outletId: string) {
  return prisma.staffRoster.findMany({
    where: { organizationId, outletId, active: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}
