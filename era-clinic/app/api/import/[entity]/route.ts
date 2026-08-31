import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { getImportAdapter } from "@/lib/import/adapters";
import { assertClinicImportAccess } from "@/lib/import/auth";
import { runImport, runImportBuffers, runFilelessImport } from "@/lib/import/run-import";
import { recordClinicAudit } from "@/lib/satellite-audit";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  try {
    const { entity } = await params;
    const adapter = getImportAdapter(entity);
    if (!adapter) return jsonError(`Unknown import entity: ${entity}`, 404);

    const access = await assertClinicImportAccess();
    if (access.error) return access.error;
    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1";

    if (adapter.fileless) {
      const result = await runFilelessImport(adapter, dryRun);
      if (!dryRun) {
        await recordClinicAudit(
          { userId: access.userId, request },
          "ImportRun",
          entity,
          "IMPORT_FILELESS",
          { ...result },
        );
      }
      return jsonOk(result);
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const files = form.getAll("file").filter((f): f is File => f instanceof File);
      if (!files.length) return jsonError("Missing file field", 400);
      const buffers = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer())));
      const result = await runImportBuffers(adapter, buffers, dryRun);
      if (!dryRun) {
        await recordClinicAudit(
          { userId: access.userId, request },
          "ImportRun",
          entity,
          "IMPORT_UPLOAD",
          { files: files.map((f) => f.name), ...result },
        );
      }
      return jsonOk(result);
    }

    const body = (await request.json()) as { fileBase64?: string };
    if (!body.fileBase64) return jsonError("Missing fileBase64", 400);
    const result = await runImport(adapter, Buffer.from(body.fileBase64, "base64"), dryRun);
    if (!dryRun) {
      await recordClinicAudit(
        { userId: access.userId, request },
        "ImportRun",
        entity,
        "IMPORT_UPLOAD",
        { ...result },
      );
    }
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
