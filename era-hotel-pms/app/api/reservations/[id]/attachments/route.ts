import { z } from 'zod';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  createReservationAttachment,
  listReservationAttachments,
} from '@/lib/services/reservation-attachments.service';

const postSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().int().optional(),
  kind: z.enum(['PASSPORT_SCAN', 'OTHER']).optional(),
  storageKey: z.string().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await listReservationAttachments(id)));
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
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const { uploadReservationAttachmentFile } = await import(
        '@/lib/services/reservation-attachments.service'
      );
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return jsonError('file required', 400);
      }
      const kindRaw = String(form.get('kind') ?? 'OTHER');
      const kind = kindRaw === 'PASSPORT_SCAN' ? 'PASSPORT_SCAN' : 'OTHER';
      const buffer = Buffer.from(await file.arrayBuffer());
      const row = await uploadReservationAttachmentFile({
        reservationId: id,
        fileName: file.name || 'attachment.bin',
        mimeType: file.type || undefined,
        buffer,
        kind,
      });
      return jsonOk(serialize(row), 201);
    }
    const body = postSchema.parse(await request.json());
    return jsonOk(serialize(await createReservationAttachment(id, body)));
  } catch (err) {
    return handleRouteError(err);
  }
}
