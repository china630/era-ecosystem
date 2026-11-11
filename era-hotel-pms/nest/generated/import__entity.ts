import { getImportAdapter } from '@/lib/import/adapters';
import { assertHotelImportAccess } from '@/lib/import/auth';
import { runImport, runImportBuffers, runFilelessImport } from '@/lib/import/run-import';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/import/:entity", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const { entity } = httpReq.params;
    const adapter = getImportAdapter(entity);
    if (!adapter) {
      return sendJson(httpRes, { error: `Unknown import entity: ${entity}` }, 404);
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
      return sendJson(httpRes, result);
    }

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const form = await readNestForm(httpReq);
      const files = form.getAll('file').filter((f): f is File => f instanceof File);
      if (!files.length) {
        return sendJson(httpRes, { error: 'Missing file field' }, 400);
      }
      const buffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
      const result = await runImportBuffers(adapter, buffers, dryRun);
      if (!dryRun) {
        await recordHotelAudit(
          { userId: access.userId, request },
          'ImportRun',
          entity,
          'IMPORT_UPLOAD',
          { via: access.via, files: files.map((f) => f.name), ...result },
        );
      }
      return sendJson(httpRes, result);
    } else {
      const body = (httpReq.body) as { fileBase64?: string };
      if (!body.fileBase64) {
        return sendJson(httpRes, { error: 'Missing fileBase64' }, 400);
      }
      const result = await runImport(adapter, Buffer.from(body.fileBase64, 'base64'), dryRun);
      if (!dryRun) {
        await recordHotelAudit(
          { userId: access.userId, request },
          'ImportRun',
          entity,
          'IMPORT_UPLOAD',
          { via: access.via, ...result },
        );
      }
      return sendJson(httpRes, result);
    }
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
