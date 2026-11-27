/** Lifted from era-hotel-pms/nest/generated/import__entity.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getImportAdapter } from '@/lib/import/adapters';
import { assertHotelImportAccess } from '@/lib/import/auth';
import { runImport, runImportBuffers, runFilelessImport } from '@/lib/import/run-import';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ImportEntityController {
  @Post("api/import/:entity")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const { entity } = httpReq.params;
    const adapter = getImportAdapter(entity);
    if (!adapter) {
      return sendJson(httpRes, { error: `Unknown import entity: ${entity}` }, 404);
    }

    const access = await assertHotelImportAccess();

    const url = requestUrl;
    const dryRun = url.searchParams.get('dryRun') === '1';

    if (adapter.fileless) {
      const result = await runFilelessImport(adapter, dryRun);
      if (!dryRun) {
        await recordHotelAudit(
          { userId: access.userId, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
          'ImportRun',
          entity,
          'IMPORT_FILELESS',
          { via: access.via, ...result },
        );
      }
      return sendJson(httpRes, result);
    }

    const contentType = nestHeader(httpReq, 'content-type') ?? '';

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
          { userId: access.userId, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
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
          { userId: access.userId, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
          'ImportRun',
          entity,
          'IMPORT_UPLOAD',
          { via: access.via, ...result },
        );
      }
      return sendJson(httpRes, result);
    }
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
