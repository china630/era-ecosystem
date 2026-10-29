import { handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { refuseHotelCommissionPay } from '@/lib/services/agency-commission.service';

/** Hotel cash pay is forbidden — Finance AP only. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertPermission(await getSatelliteSession(), PERMISSIONS.FOLIO_PAYMENT);
    await params;
    refuseHotelCommissionPay();
  } catch (err) {
    return handleRouteError(err);
  }
}
