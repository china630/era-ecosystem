import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  listAgencyTransferredFolios,
} from '@/lib/services/agency-settlement.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const { id } = await params;
    return jsonOk(serialize(await listAgencyTransferredFolios(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    // Hotel does not accept agency money: it must be booked in Finance.
    // Cash (5–10% edge cases) is handled as a manual "handoff to accountant" process.
    return jsonError('Agency settlement is paid in Finance only (City Ledger handoff).', 409);
  } catch (err) {
    return handleRouteError(err);
  }
}
