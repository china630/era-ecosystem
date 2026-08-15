import { z } from "zod";
import { dboPaths, engineDboFetch, engineDboJson } from "@/lib/engine-dbo-client";
import { handleRouteError, jsonOk, requireCustomerSession } from "@/lib/api-utils";

const createSchema = z.object({
  productTemplateId: z.string().min(1),
  requestedMinor: z.number().int().positive(),
  currency: z.string().optional(),
});

export async function GET() {
  try {
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboFetch(dboPaths.loanApplications, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const auth = await requireCustomerSession();
    if (auth instanceof Response) return auth;
    const data = await engineDboJson("POST", dboPaths.loanApplications, body, {
      customerJwt: auth.session.customerJwt ?? undefined,
    });
    return jsonOk(data);
  } catch (err) {
    return handleRouteError(err);
  }
}
