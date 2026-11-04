import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDeskPaymentMethods, hotelGuestTenders } from '@/lib/org-payment-methods';
import {
  listPaymentMethodsForSatellite,
  paymentMethodsSynced,
} from '@era/satellite-kit';
import { requestOrganizationId } from '@/lib/request-organization';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const guestOnly = new URL(request.url).searchParams.get('guest') === '1';
    const organizationId = requestOrganizationId();
    const locale = (request.headers.get('accept-language') ?? 'en').slice(0, 2);
    const loc = locale === 'az' || locale === 'ru' ? locale : 'en';

    if (paymentMethodsSynced(organizationId)) {
      const rows = listPaymentMethodsForSatellite({
        organizationId,
        satelliteKey: 'hotel',
      });
      const codes = guestOnly
        ? rows.filter(
            (r) =>
              r.code !== 'DEPOSIT' &&
              r.code !== 'CL_AGENCY' &&
              r.code !== 'CL_COMPANY' &&
              r.code !== 'COMPANY_ACCOUNT',
          )
        : rows;
      return jsonOk({
        synced: true,
        methods: codes.map((row) => ({
          code: row.code,
          label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
          fiscalHint: row.fiscalHint,
          fiscalDeviceId: row.fiscalDeviceId,
        })),
      });
    }

    const codes = guestOnly ? hotelGuestTenders() : hotelDeskPaymentMethods();
    return jsonOk({
      synced: false,
      methods: codes.map((code) => ({
        code,
        label: code,
        fiscalHint: code === 'CASH' ? 'CASH' : code === 'CARD' || code === 'EPOINT' ? 'CARD' : 'NONE',
        fiscalDeviceId: null,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
