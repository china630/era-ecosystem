import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

/** Default FO register when the caller does not pass one (demo / Nafta front cash). */
export const DEFAULT_FRONT_CASH_REGISTER = 'FO-01';

export type EnsureOpenCashShiftInput = {
  cashier?: string;
  registerId?: string;
  fiscalDeviceId?: string;
  bankTerminalId?: string;
};

/**
 * Prefer the primary OPEN shift; otherwise any OPEN.
 * Normal ops keep at most one OPEN (API open refuses a second).
 */
export async function findOpenCashShift() {
  let shift = await prisma.cashShift.findFirst({
    where: { status: 'OPEN', isPrimary: true },
    orderBy: { openedAt: 'desc' },
  });
  if (!shift) {
    shift = await prisma.cashShift.findFirst({
      where: { status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });
  }
  return shift;
}

async function resolveCashierLabel(explicit?: string): Promise<string> {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  try {
    const { getSatelliteSession } = await import('@/lib/auth/session');
    const session = await getSatelliteSession();
    const fromSession = session?.email?.trim() || session?.login?.trim();
    if (fromSession) return fromSession;
  } catch {
    // Cron / unit tests / no Next request context.
  }
  return 'front-cash';
}

/**
 * One operational CashShift per org for Front Cash fiscal money moves.
 * Reuses OPEN if present; otherwise opens a primary shift on the first CASH/CARD op.
 */
export async function ensureOpenCashShift(input: EnsureOpenCashShiftInput = {}) {
  const existing = await findOpenCashShift();
  if (existing) return existing;

  const organizationId = requestOrganizationId();
  const registerId = input.registerId?.trim() || DEFAULT_FRONT_CASH_REGISTER;
  const cashier = await resolveCashierLabel(input.cashier);

  const { resolveDefaultDevicesForSatellite, assertLiveFiscalReady } =
    await import('@era/satellite-kit');
  if (process.env.ERA_FISCAL_LIVE === 'true') {
    assertLiveFiscalReady({ organizationId, registerRef: registerId });
  }
  const defaults = resolveDefaultDevicesForSatellite({
    organizationId,
    registerRef: registerId,
    fiscalDeviceId: input.fiscalDeviceId,
    bankTerminalId: input.bankTerminalId,
  });

  try {
    return await prisma.cashShift.create({
      data: {
        organizationId,
        cashier,
        registerId,
        isPrimary: true,
        status: 'OPEN',
        fiscalDeviceId: input.fiscalDeviceId ?? defaults.fiscalDeviceId ?? null,
        bankTerminalId: input.bankTerminalId ?? defaults.bankTerminalId ?? null,
      },
    });
  } catch (err) {
    const raced = await findOpenCashShift();
    if (raced) return raced;
    throw err;
  }
}

/** Explicit manager/API open — refuses when any OPEN shift already exists. */
export async function openCashShiftExplicit(input: {
  cashier: string;
  registerId: string;
  isPrimary?: boolean;
  fiscalDeviceId?: string;
  bankTerminalId?: string;
  audit?: { userId?: string | null; request?: Request };
}) {
  const existing = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
  if (existing) throw new Error('A cash shift is already open');

  const organizationId = requestOrganizationId();
  const registerId = input.registerId.trim();
  const cashier = input.cashier.trim();
  if (!registerId || !cashier) throw new Error('cashier and registerId required');

  const hasPrimary = await prisma.cashShift.findFirst({
    where: { status: 'OPEN', isPrimary: true },
  });
  const isPrimary = input.isPrimary ?? !hasPrimary;

  const { resolveDefaultDevicesForSatellite, assertLiveFiscalReady } =
    await import('@era/satellite-kit');
  if (process.env.ERA_FISCAL_LIVE === 'true') {
    assertLiveFiscalReady({ organizationId, registerRef: registerId });
  }
  const defaults = resolveDefaultDevicesForSatellite({
    organizationId,
    registerRef: registerId,
    fiscalDeviceId: input.fiscalDeviceId,
    bankTerminalId: input.bankTerminalId,
  });

  const shift = await prisma.cashShift.create({
    data: {
      organizationId,
      cashier,
      registerId,
      isPrimary,
      status: 'OPEN',
      fiscalDeviceId: input.fiscalDeviceId ?? defaults.fiscalDeviceId ?? null,
      bankTerminalId: input.bankTerminalId ?? defaults.bankTerminalId ?? null,
    },
  });
  const { recordHotelAudit } = await import('@/lib/satellite-audit');
  await recordHotelAudit(input.audit ?? {}, 'CashShift', shift.id, 'OPEN', {
    cashier,
    registerId,
    isPrimary,
  });
  return shift;
}

export async function closeOpenCashShift(audit?: {
  userId?: string | null;
  request?: Request;
}) {
  const open = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
  if (!open) throw new Error('No open cash shift');
  const closed = await prisma.cashShift.update({
    where: { id: open.id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  const { recordHotelAudit } = await import('@/lib/satellite-audit');
  await recordHotelAudit(audit ?? {}, 'CashShift', closed.id, 'CLOSE', {
    cashier: closed.cashier,
    registerId: closed.registerId,
  });
  return closed;
}
