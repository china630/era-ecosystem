import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getAgencySession } from '@/lib/auth/agency-session';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { getAgencyLedger } from '@/lib/services/agency-ledger.service';

/**
 * Agency portal City Ledger statement (read-only).
 * Scoped to session.agencyId — never accepts party id from query.
 */
export async function GET(request: Request) {
  try {
    await requireHotelModule('hotel_agency_portal');
    const session = await getAgencySession();
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from') ?? new Date().toISOString().slice(0, 10);
    const toStr = url.searchParams.get('to') ?? fromStr;
    const from = new Date(fromStr);
    const to = new Date(toStr);
    to.setHours(23, 59, 59, 999);
    const ledger = await getAgencyLedger(session.agencyId, from, to);
    return jsonOk(
      serialize({
        agencyId: session.agencyId,
        agencyCode: session.agencyCode,
        from: fromStr,
        to: toStr,
        opening: ledger.opening,
        newCharges: ledger.newCharges,
        payments: ledger.payments,
        cashPaid: ledger.cashPaid,
        netAmount: ledger.netAmount,
        cityLedger: ledger.cityLedger,
        closing: ledger.closing,
        statementBalance: ledger.statementBalance,
        reservationCount: ledger.reservationCount,
        folioCount: ledger.folioCount,
        lines: ledger.lines,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
