import { Controller, HttpCode, Post, Req, HttpException } from "@nestjs/common";
import type { Request } from "express";
import {
  nestHeader,
  readNestForm,
  withClinicHttp,
  clinicRoute,
  clinicBody,
} from "../../bridge";
import { getImportAdapter } from "@/lib/import/adapters";
import { assertClinicImportAccess } from "@/lib/import/auth";
import { runImport, runImportBuffers, runFilelessImport } from "@/lib/import/run-import";
import { expressKitHeaders } from "@era/satellite-kit";
import { recordClinicAudit } from "@/lib/satellite-audit";


export const maxDuration = 300;

@Controller()
export class ImportEntityController {

  @Post("api/import/:entity")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    return withClinicHttp(httpReq, async () => {
      const { entity } = httpReq.params;
    const adapter = getImportAdapter(entity);
    if (!adapter) throw new HttpException({ error: `Unknown import entity: ${entity}` }, 404);

    const access = await assertClinicImportAccess(clinicRoute(httpReq));
    if (access.error) return clinicBody(access.error);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const dryRun = url.searchParams.get("dryRun") === "1";

    if (adapter.fileless) {
      const result = await runFilelessImport(adapter, dryRun);
      if (!dryRun) {
        await recordClinicAudit(
          { userId: access.userId, request: expressKitHeaders(httpReq) },
          "ImportRun",
          entity,
          "IMPORT_FILELESS",
          { ...result },
        );
      }
      return result;
    }

    const contentType = nestHeader(httpReq, "content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await readNestForm(httpReq);
      const files = form.getAll("file").filter((f): f is File => f instanceof File);
      if (!files.length) throw new HttpException({ error: "Missing file field" }, 400);
      const buffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
      const result = await runImportBuffers(adapter, buffers, dryRun);
      if (!dryRun) {
        await recordClinicAudit(
          { userId: access.userId, request: expressKitHeaders(httpReq) },
          "ImportRun",
          entity,
          "IMPORT_UPLOAD",
          { files: files.map((f) => f.name), ...result },
        );
      }
      return result;
    }

    const body = (httpReq.body) as { fileBase64?: string };
    if (!body.fileBase64) throw new HttpException({ error: "Missing fileBase64" }, 400);
    const result = await runImport(adapter, Buffer.from(body.fileBase64, "base64"), dryRun);
    if (!dryRun) {
      await recordClinicAudit(
        { userId: access.userId, request: expressKitHeaders(httpReq) },
        "ImportRun",
        entity,
        "IMPORT_UPLOAD",
        { ...result },
      );
    }
    return result;
  
        });
  }
}
