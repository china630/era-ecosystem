import { prisma } from '@/lib/prisma';
import { toDecimal, decimalToNumber } from '@/lib/decimal';
import { satelliteOrganizationId } from '@era/satellite-kit';

const CP_URL = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CP_TOKEN =
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();

async function callPlatformAuth(
  path: string,
  method: 'POST',
  body?: Record<string, unknown>,
): Promise<{ externalAuthId: string } | null> {
  const orgId = satelliteOrganizationId();
  if (!CP_URL || !CP_TOKEN || !orgId || orgId === 'demo-org') {
    return { externalAuthId: `mock-auth-${Date.now()}` };
  }
  try {
    const res = await fetch(`${CP_URL}/api/platform/payments/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${CP_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Organization-Id': orgId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      return { externalAuthId: `mock-auth-${Date.now()}` };
    }
    const data = (await res.json()) as { externalAuthId?: string; id?: string };
    return { externalAuthId: data.externalAuthId ?? data.id ?? `mock-auth-${Date.now()}` };
  } catch {
    return { externalAuthId: `mock-auth-${Date.now()}` };
  }
}

export async function createCheckInHold(reservationId: string, amount: number) {
  const folio = await prisma.folio.findFirst({
    where: { reservationId, type: 'GUEST' },
    select: { id: true },
  });

  const platform = await callPlatformAuth('/authorizations', 'POST', {
    reservationId,
    amountAzn: amount,
  });

  const expiresAt = new Date(Date.now() + 7 * 86400000);
  return prisma.cardAuthorization.create({
    data: {
      reservationId,
      folioId: folio?.id,
      amount: toDecimal(amount),
      status: 'HELD',
      externalAuthId: platform?.externalAuthId,
      expiresAt,
    },
  });
}

export async function captureAuthorization(id: string, amount?: number) {
  const auth = await prisma.cardAuthorization.findUnique({ where: { id } });
  if (!auth || auth.status !== 'HELD') throw new Error('Authorization not held');

  const captureAmount = amount ?? decimalToNumber(auth.amount);
  if (auth.externalAuthId) {
    await callPlatformAuth(`/authorizations/${auth.externalAuthId}/capture`, 'POST', {
      amountAzn: captureAmount,
    });
  }

  return prisma.cardAuthorization.update({
    where: { id },
    data: { status: 'CAPTURED', capturedAt: new Date(), amount: toDecimal(captureAmount) },
  });
}

export async function releaseAuthorization(id: string) {
  const auth = await prisma.cardAuthorization.findUnique({ where: { id } });
  if (!auth || auth.status !== 'HELD') throw new Error('Authorization not held');

  if (auth.externalAuthId) {
    await callPlatformAuth(`/authorizations/${auth.externalAuthId}/void`, 'POST');
  }

  return prisma.cardAuthorization.update({
    where: { id },
    data: { status: 'RELEASED', releasedAt: new Date() },
  });
}

export async function listAuthorizations(reservationId: string) {
  return prisma.cardAuthorization.findMany({
    where: { reservationId },
    orderBy: { createdAt: 'desc' },
  });
}
