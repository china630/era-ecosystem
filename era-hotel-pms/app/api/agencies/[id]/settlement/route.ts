import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  listAgencyTransferredFolios,
} from '@/lib/services/agency-settlement.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
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
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    // Hotel does not accept agency money: it must be booked in Finance.
    return Response.json(
      {
        error: 'Agency settlement is paid in Finance only (City Ledger handoff).',
        code: 'FINANCE_ONLY_SETTLEMENT',
      },
      { status: 409 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
