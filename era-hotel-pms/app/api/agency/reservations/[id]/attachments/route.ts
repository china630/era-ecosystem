import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getAgencySession } from '@/lib/auth/agency-session';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { prisma } from '@/lib/prisma';
import { uploadReservationAttachmentFile } from '@/lib/services/reservation-attachments.service';

/**
 * Agency uploads optional passport scan for own reservation.
 * multipart: file + optional kind=PASSPORT_SCAN
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireHotelModule('hotel_agency_portal');
    const session = await getAgencySession();
    const { id } = await params;
    const reservation = await prisma.reservation.findFirst({
      where: { id, agencyId: session.agencyId },
    });
    if (!reservation) {
      return jsonError('Reservation not found', 404);
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return jsonError('file required', 400);
    }
    const kindRaw = String(form.get('kind') ?? 'PASSPORT_SCAN');
    const kind = kindRaw === 'OTHER' ? 'OTHER' : 'PASSPORT_SCAN';
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) {
      return jsonError('File too large (max 8MB)', 400);
    }
    const row = await uploadReservationAttachmentFile({
      reservationId: id,
      fileName: file.name || 'passport.bin',
      mimeType: file.type || undefined,
      buffer,
      kind,
    });
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
