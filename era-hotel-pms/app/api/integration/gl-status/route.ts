import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

const bodySchema = z.object({
  fiscalDocumentId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  glReference: z.string().min(1),
  glPostedAt: z.coerce.date().optional(),
});

/** Finance / 1C adapter callback — read-only GL posted status on fiscal document. */
export async function POST(request: Request) {
  try {
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    const doc = body.fiscalDocumentId
      ? await prisma.fiscalDocument.findUnique({ where: { id: body.fiscalDocumentId } })
      : body.invoiceNumber
        ? await prisma.fiscalDocument.findFirst({ where: { invoiceNumber: body.invoiceNumber } })
        : null;

    if (!doc) {
      return Response.json({ error: 'Fiscal document not found' }, { status: 404 });
    }

    const updated = await prisma.fiscalDocument.update({
      where: { id: doc.id },
      data: {
        glPostedAt: body.glPostedAt ?? new Date(),
        glReference: body.glReference,
        fiscalStatus: 'ACCEPTED',
      },
    });

    return jsonOk({
      id: updated.id,
      glPostedAt: updated.glPostedAt?.toISOString(),
      glReference: updated.glReference,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
