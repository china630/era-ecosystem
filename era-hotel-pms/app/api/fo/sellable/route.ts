import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { parseHotelNoon } from '@/lib/hotel-calendar';
import { getSellablePreview } from '@/lib/services/room-type-availability.service';
import { getAvailabilityWithContractAllotment } from '@/lib/services/contract-allotment.service';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const url = new URL(request.url);
    const roomTypeId = url.searchParams.get('roomTypeId');
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const salesContractId = url.searchParams.get('salesContractId')?.trim() || null;
    if (!roomTypeId || !fromStr || !toStr) {
      throw new Error('roomTypeId, from, and to query params required');
    }
    const from = parseHotelNoon(fromStr);
    const to = parseHotelNoon(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error('Invalid from/to date');
    }

    if (salesContractId) {
      const data = await getAvailabilityWithContractAllotment(
        roomTypeId,
        from,
        to,
        salesContractId,
      );
      const bottleneck = data.nights.find((n) => n.available === data.available) ?? data.nights[0];
      return jsonOk(
        serialize({
          roomTypeId,
          from: fromStr.slice(0, 10),
          to: toStr.slice(0, 10),
          salesContractId,
          contractScoped: true,
          available: data.available,
          booked: bottleneck?.contractBooked ?? 0,
          quota: data.quota,
          contractAllotment: bottleneck?.contractAllotment ?? 0,
          reason: bottleneck && 'reason' in bottleneck ? bottleneck.reason ?? null : null,
          stopSell: false,
          nights: data.nights,
        }),
      );
    }

    const data = await getSellablePreview(roomTypeId, from, to);
    return jsonOk(
      serialize({
        roomTypeId,
        from: fromStr.slice(0, 10),
        to: toStr.slice(0, 10),
        contractScoped: false,
        ...data,
      }),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
