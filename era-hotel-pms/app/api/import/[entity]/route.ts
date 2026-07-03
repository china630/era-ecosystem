import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { getImportAdapter } from '@/lib/import/adapters';
import { assertHotelImportAccess } from '@/lib/import/auth';
import { runImport, runFilelessImport } from '@/lib/import/run-import';
import { recordHotelAudit } from '@/lib/satellite-audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  try {
    const { entity } = await params;
    const adapter = getImportAdapter(entity);
    if (!adapter) {
      return jsonError(`Unknown import entity: ${entity}`, 404);
    }

    const access = await assertHotelImportAccess();

    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === '1';

    if (adapter.fileless) {
      const result = await runFilelessImport(adapter, dryRun);
      if (!dryRun) {
        await recordHotelAudit(
          { userId: access.userId, request },
          'ImportRun',
          entity,
          'IMPORT_FILELESS',
          { via: access.via, ...result },
        );
      }
      return jsonOk(result);
    }

    const contentType = request.headers.get('content-type') ?? '';
    let buffer: Buffer;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return jsonError('Missing file field', 400);
      }
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = (await request.json()) as { fileBase64?: string };
      if (!body.fileBase64) {
        return jsonError('Missing fileBase64', 400);
      }
      buffer = Buffer.from(body.fileBase64, 'base64');
    }

    const result = await runImport(adapter, buffer, dryRun);
    if (!dryRun) {
      await recordHotelAudit(
        { userId: access.userId, request },
        'ImportRun',
        entity,
        'IMPORT_UPLOAD',
        { via: access.via, ...result },
      );
    }
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
