import { z } from "zod";
import { handleRouteError, jsonError, jsonOk, requireCustomerSession } from "@/lib/api-utils";
import {
  createCorporateApiKey,
  isOpenApiPermission,
  listCorporateApiKeys,
} from "@/lib/open-api-keys";

const createSchema = z.object({
  permissions: z.array(z.string().min(1)).min(1),
});

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    if (auth.session.channel !== "CORPORATE") {
      return jsonError("Corporate channel required", 403);
    }
    const items = await listCorporateApiKeys(auth.session.customerId);
    return jsonOk({ items });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    if (auth.session.channel !== "CORPORATE") {
      return jsonError("Corporate channel required", 403);
    }
    const body = createSchema.parse(await request.json());
    if (!body.permissions.every(isOpenApiPermission)) {
      return jsonError("Unknown permission", 400);
    }
    const { row, rawKey } = await createCorporateApiKey({
      customerId: auth.session.customerId,
      permissions: body.permissions,
    });
    return jsonOk({
      id: row.id,
      status: row.status,
      permissions: row.permissionsJson,
      rawKey,
      shownOnce: true,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
