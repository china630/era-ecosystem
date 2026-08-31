import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { listImportEntities } from "@/lib/import/adapters";
import { assertFnbImportAccess } from "@/lib/import/auth";

export async function GET(request: Request) {
  try {
    await assertFnbImportAccess(request);
    return jsonOk(listImportEntities());
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return jsonError(err.message, 401);
    }
    if (err instanceof Error && err.message.startsWith("Forbidden")) {
      return jsonError(err.message, 403);
    }
    return handleRouteError(err);
  }
}
