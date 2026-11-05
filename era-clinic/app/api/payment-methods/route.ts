import { NextResponse } from 'next/server';
import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import {
  getSatelliteSession,
  handleRouteError,
  requireClinicPermission,
} from '@/lib/api-utils';
import { CLINIC_PERMISSION } from '@/lib/auth/clinic-permissions';
import { clinicDeskPaymentMethods } from '@/lib/org-payment-methods';
import { requestOrganizationId } from '@/lib/request-organization';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const organizationId = requestOrganizationId();
    const locale = (request.headers.get('accept-language') ?? 'en').slice(0, 2);
    const loc = locale === 'az' || locale === 'ru' ? locale : 'en';
    if (paymentMethodsSynced(organizationId)) {
      const rows = listPaymentMethodsForSatellite({
        organizationId,
        satelliteKey: 'clinic',
      });
      return NextResponse.json({
        synced: true,
        methods: rows.map((row) => ({
          code: row.code,
          label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
        })),
      });
    }
    return NextResponse.json({
      synced: false,
      methods: clinicDeskPaymentMethods().map((code) => ({ code, label: code })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
