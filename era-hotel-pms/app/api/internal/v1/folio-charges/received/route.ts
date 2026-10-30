import { jsonOk } from "@/lib/api-utils";
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseFolioChargeRef } from '@era/satellite-kit/integration/folio-charge-ref';
import { prisma } from '@/lib/prisma';
import { enterRequestTenant } from '@/lib/request-organization';

/** Canonical key plus a stored `pay-` row from before the shared contract. */
function chargeRefCandidates(externalRef: string): string[] {
  const raw = externalRef.trim();
  const parsed = parseFolioChargeRef(raw);
  const out = new Set<string>([raw]);
  if (parsed?.ref) out.add(parsed.ref);
  if (parsed?.source === 'clinic') out.add(`pay-${parsed.ref}`);
  return [...out];
}

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  externalRef: z.string().min(1),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === expected;
}

/** Clinic check-in marks the existing folio line received. Amount stays the same. */
export async function POST(request: Request) {
  if (!assertServiceToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = bodySchema.parse(await request.json());
  enterRequestTenant(body.organizationId);
  const charge = await prisma.folioCharge.findFirst({
    where: { externalRef: { in: chargeRefCandidates(body.externalRef) } },
  });
  if (!charge) return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
  if (!charge.serviceReceivedAt) {
    await prisma.folioCharge.update({
      where: { id: charge.id },
      data: { serviceReceivedAt: new Date() },
    });
  }
  return jsonOk({ ok: true, chargeId: charge.id });
}
