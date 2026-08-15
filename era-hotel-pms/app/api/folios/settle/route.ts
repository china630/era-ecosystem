import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { settleFolio, getFolioSettlementPreview } from '@/lib/services/folio-settlement.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const lineSchema = z.object({
  method: z.enum([
    'CASH',
    'CARD',
    'COMPANY_ACCOUNT',
    'LOYALTY_POINTS',
    'DEPOSIT',
    'BANK_TRANSFER',
  ]),
  amount: z.number().positive(),
  registerRef: z.string().optional(),
  bankReference: z.string().max(120).optional(),
  loyaltyCustomerRef: z.string().optional(),
  authorizationId: z.string().uuid().optional(),
});

const settleSchema = z.object({
  folioId: z.string().uuid(),
  lines: z.array(lineSchema).min(1),
  discountAmount: z.number().positive().optional(),
  discountDescription: z.string().max(200).optional(),
  applyDeposits: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const folioId = new URL(request.url).searchParams.get('folioId');
    if (!folioId) throw new Error('folioId required');
    return jsonOk(serialize(await getFolioSettlementPreview(folioId)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = settleSchema.parse(await request.json());
    return jsonOk(serialize(await settleFolio(body)), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
