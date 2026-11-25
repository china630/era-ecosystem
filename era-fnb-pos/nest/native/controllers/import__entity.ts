/** Lifted from nest/generated/import__entity.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getImportAdapter } from "@/lib/import/adapters";
import { assertFnbImportAccess } from "@/lib/import/auth";
import { runImport, runImportBuffers, runFilelessImport } from "@/lib/import/run-import";
import { recordFbAudit } from "@/lib/satellite-audit";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ImportEntityController {
  @Post("api/import/:entity")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  try {
    const { entity } = httpReq.params;
    const adapter = getImportAdapter(entity);
    if (!adapter) {
      return sendJson(httpRes, { error: `Unknown import entity: ${entity}` }, 404);
    }

    const access = await assertFnbImportAccess();

    const url = new URL(new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString());
    const dryRun = url.searchParams.get("dryRun") === "1";

    if (adapter.fileless) {
      const result = await runFilelessImport(adapter, dryRun);
      if (!dryRun) {
        await recordFbAudit(
          { userId: access.userId, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
          "ImportRun",
          entity,
          "IMPORT_FILELESS",
          { via: access.via, ...result },
        );
      }
      return sendJson(httpRes, result);
    }

    const contentType = nestHeader(httpReq, "content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await readNestForm(httpReq);
      const files = form.getAll("file").filter((f): f is File => f instanceof File);
      if (!files.length) {
        return sendJson(httpRes, { error: "Missing file field" }, 400);
      }
      const buffers = await Promise.all(
        files.map(async (f) => Buffer.from(await f.arrayBuffer())),
      );
      const result = await runImportBuffers(adapter, buffers, dryRun);
      if (!dryRun) {
        await recordFbAudit(
          { userId: access.userId, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
          "ImportRun",
          entity,
          "IMPORT_UPLOAD",
          { via: access.via, files: files.map((f) => f.name), ...result },
        );
      }
      return sendJson(httpRes, result);
    }

    const body = (httpReq.body) as { fileBase64?: string };
    if (!body.fileBase64) {
      return sendJson(httpRes, { error: "Missing fileBase64" }, 400);
    }
    const result = await runImport(adapter, Buffer.from(body.fileBase64, "base64"), dryRun);
    if (!dryRun) {
      await recordFbAudit(
        { userId: access.userId, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
        "ImportRun",
        entity,
        "IMPORT_UPLOAD",
        { via: access.via, ...result },
      );
    }
    return sendJson(httpRes, result);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return sendJson(httpRes, { error: err.message }, 401);
    }
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return sendJson(httpRes, { error: err.message }, 403);
    }
    return sendRouteError(httpRes, err);
  }

        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
