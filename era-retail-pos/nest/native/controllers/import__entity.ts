/** Lifted from nest/generated/import__entity.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { getImportAdapter } from "@/lib/import/adapters";
import { assertRetailImportAccess } from "@/lib/import/auth";
import { runImport, runImportBuffers, runFilelessImport } from "@/lib/import/run-import";
import { enterRetailStaff, retailNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithRetailTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class ImportEntityController {
  @Post("api/import/:entity")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  try {
    const { entity } = httpReq.params;
    const adapter = getImportAdapter(entity);
    if (!adapter) {
      return sendJson(httpRes, { error: `Unknown import entity: ${entity}` }, 404);
    }

    await assertRetailImportAccess();

    const url = requestUrl;
    const dryRun = url.searchParams.get("dryRun") === "1";

    if (adapter.fileless) {
      const result = await runFilelessImport(adapter, dryRun);
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
      return sendJson(httpRes, result);
    }

    const body = (httpReq.body) as { fileBase64?: string };
    if (!body.fileBase64) {
      return sendJson(httpRes, { error: "Missing fileBase64" }, 400);
    }
    const result = await runImport(adapter, Buffer.from(body.fileBase64, "base64"), dryRun);
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
